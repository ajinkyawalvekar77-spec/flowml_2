"""
Tests: Job queue — per-user concurrency limits and state transitions.
"""
import time
import threading
import pytest
from fastapi import HTTPException

from services.job_queue import (
    InProcessQueue,
    QUEUED, RUNNING, COMPLETED, FAILED, STOPPED,
)


def _noop(job):
    return {"ok": True}


def _slow(seconds=0.4):
    def fn(job):
        steps = int(seconds * 10)
        for _ in range(steps):
            if job.cancel_flag.is_set():
                return {"stopped": True}
            time.sleep(0.1)
        return {"ok": True}
    return fn



class TestQueueLimits:

    def test_basic_enqueue_and_complete(self):
        q = InProcessQueue()
        job = q.enqueue("u1", {}, _noop)
        time.sleep(0.4)
        assert job.state == COMPLETED
        assert job.result == {"ok": True}

    def test_concurrent_limit_enforced(self, monkeypatch):
        """
        MAX_CONCURRENT=1, MAX_QUEUED=2 with 1 worker thread.
        Use a gate to keep the 1 running job occupied, then verify the 4th is rejected.
        """
        import services.job_queue as jq_mod
        monkeypatch.setattr(jq_mod, "MAX_CONCURRENT", 1)
        monkeypatch.setattr(jq_mod, "MAX_QUEUED",     2)
        # Force single worker so at most 1 job can be RUNNING at a time
        monkeypatch.setenv("QUEUE_WORKERS", "1")

        gate = threading.Event()

        def gated(job):
            gate.wait(timeout=10)
            return {"ok": True}

        # Single-worker queue so only 1 slot is ever Running
        q = InProcessQueue()
        # Manually resize the executor to 1 worker
        q._executor._max_workers = 1

        # Enqueue 3 jobs: 1st immediately starts Running; 2nd and 3rd are Queued
        j0 = q.enqueue("u1", {}, gated)   # starts running (held by gate)
        time.sleep(0.15)                   # give pool time to pick it up
        j1 = q.enqueue("u1", {}, gated)   # queued (worker busy)
        j2 = q.enqueue("u1", {}, gated)   # queued (1 running + 2 queued = at limit)

        # 4th must be rejected (1 running + 2 queued → at capacity)
        with pytest.raises(HTTPException) as exc_info:
            q.enqueue("u1", {}, _noop)
        assert exc_info.value.status_code == 429

        gate.set()     # release all jobs
        time.sleep(0.5)

        # Other user is unaffected
        j_other = q.enqueue("u2", {}, _noop)
        time.sleep(0.4)
        assert j_other.state == COMPLETED

    def test_failed_job_state(self):
        def boom(job):
            raise RuntimeError("intentional failure")

        q = InProcessQueue()
        job = q.enqueue("u1", {}, boom)
        time.sleep(0.4)
        assert job.state == FAILED
        assert "intentional failure" in job.error

    def test_stop_running_job(self):
        q = InProcessQueue()
        job = q.enqueue("u1", {}, _slow(2.0))
        time.sleep(0.3)  # let it start

        q.stop_job(job.run_id, "u1")
        assert job.cancel_flag.is_set()
        time.sleep(0.6)
        assert job.state == STOPPED

    def test_stop_wrong_user_raises_403(self):
        q = InProcessQueue()
        job = q.enqueue("u1", {}, _slow(1.0))
        time.sleep(0.1)

        with pytest.raises(HTTPException) as exc_info:
            q.stop_job(job.run_id, "u2")
        assert exc_info.value.status_code == 403

    def test_stop_nonexistent_raises_404(self):
        q = InProcessQueue()
        with pytest.raises(HTTPException) as exc_info:
            q.stop_job("does-not-exist", "u1")
        assert exc_info.value.status_code == 404

    def test_list_jobs_per_user(self):
        q = InProcessQueue()
        q.enqueue("u1", {}, _noop)
        q.enqueue("u1", {}, _noop)
        q.enqueue("u2", {}, _noop)
        time.sleep(0.4)

        u1_jobs = q.list_jobs("u1")
        u2_jobs = q.list_jobs("u2")
        assert len(u1_jobs) == 2
        assert len(u2_jobs) == 1
        assert all(j["uid"] == "u1" for j in u1_jobs)

    def test_already_terminal_stop_raises_400(self):
        q = InProcessQueue()
        job = q.enqueue("u1", {}, _noop)
        time.sleep(0.4)
        assert job.state == COMPLETED

        with pytest.raises(HTTPException) as exc_info:
            q.stop_job(job.run_id, "u1")
        assert exc_info.value.status_code == 400
