"""
Job Queue — in-process implementation.

Interface is Redis/RQ-compatible in shape so swapping is straightforward:
    - Replace InProcessQueue with RQQueue (same .enqueue / .get_job_status methods)
    - Replace JobRecord with an RQ Job proxy

Per-user limits (env-configurable):
    MAX_CONCURRENT_PER_USER  (default 1) — running jobs
    MAX_QUEUED_PER_USER      (default 3) — waiting jobs

States: Queued → Running → Completed | Failed | Stopped
"""

from __future__ import annotations

import os
import threading
import uuid
from collections import defaultdict
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from fastapi import HTTPException, status

MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT_PER_USER", "1"))
MAX_QUEUED     = int(os.getenv("MAX_QUEUED_PER_USER", "3"))

# Job states
QUEUED    = "Queued"
RUNNING   = "Running"
COMPLETED = "Completed"
FAILED    = "Failed"
STOPPED   = "Stopped"


class JobRecord:
    """Holds the mutable state of one pipeline run."""

    def __init__(self, run_id: str, uid: str, payload: dict):
        self.run_id    = run_id
        self.uid       = uid
        self.payload   = payload  # original pipeline definition
        self.state     = QUEUED
        self.created   = datetime.now(timezone.utc).isoformat()
        self.started:  Optional[str] = None
        self.finished: Optional[str] = None
        self.error:    Optional[str] = None
        self.result:   Optional[dict] = None
        self._cancel   = threading.Event()  # set this to request a stop

    def to_dict(self) -> dict:
        return {
            "run_id":   self.run_id,
            "uid":      self.uid,
            "state":    self.state,
            "created":  self.created,
            "started":  self.started,
            "finished": self.finished,
            "error":    self.error,
        }

    def request_stop(self):
        self._cancel.set()

    @property
    def cancel_flag(self) -> threading.Event:
        return self._cancel


class InProcessQueue:
    """
    Thread-safe in-process job queue backed by a thread-pool executor.
    One executor thread per "slot"; default pool = MAX_CONCURRENT * total users,
    capped at 8 so we don't spin up too many threads.
    """

    def __init__(self):
        self._lock  = threading.Lock()
        self._jobs: dict[str, JobRecord] = {}             # run_id → JobRecord
        self._user_running: dict[str, int]  = defaultdict(int)
        self._user_queued:  dict[str, int]  = defaultdict(int)
        self._executor = ThreadPoolExecutor(
            max_workers=int(os.getenv("QUEUE_WORKERS", "4")),
            thread_name_prefix="flowml-worker",
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def enqueue(self, uid: str, payload: dict, fn: Callable) -> JobRecord:
        """
        Enqueue a job for uid.
        fn is called as fn(job) where job is the JobRecord.
        Raises 429 if per-user limits are exceeded.
        Reads limits dynamically so monkeypatching works in tests.
        """
        import services.job_queue as _mod
        _max_concurrent = _mod.MAX_CONCURRENT
        _max_queued     = _mod.MAX_QUEUED

        with self._lock:
            running = self._user_running[uid]
            queued  = self._user_queued[uid]

            if running >= _max_concurrent and queued >= _max_queued:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Per-user limit reached: max {MAX_CONCURRENT} running + "
                        f"{MAX_QUEUED} queued. Wait for an existing run to finish."
                    ),
                )

            run_id = uuid.uuid4().hex
            job = JobRecord(run_id=run_id, uid=uid, payload=payload)
            self._jobs[run_id] = job
            self._user_queued[uid] += 1

        # Submit to thread pool (runs when a slot is free)
        self._executor.submit(self._run_job, job, fn)
        return job

    def get_job(self, run_id: str) -> Optional[JobRecord]:
        return self._jobs.get(run_id)

    def stop_job(self, run_id: str, uid: str) -> JobRecord:
        job = self._jobs.get(run_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
        if job.uid != uid:
            raise HTTPException(status_code=403, detail="Access denied.")
        if job.state in (COMPLETED, FAILED, STOPPED):
            raise HTTPException(status_code=400, detail=f"Run is already in terminal state: {job.state}.")
        job.request_stop()
        return job

    def list_jobs(self, uid: str) -> list[dict]:
        with self._lock:
            return [
                j.to_dict()
                for j in self._jobs.values()
                if j.uid == uid
            ]

    def list_all_jobs(self) -> list[dict]:
        with self._lock:
            return [j.to_dict() for j in self._jobs.values()]

    # ── Internal ──────────────────────────────────────────────────────────────

    def _run_job(self, job: JobRecord, fn: Callable):
        with self._lock:
            self._user_queued[job.uid]  -= 1
            self._user_running[job.uid] += 1

        job.state   = RUNNING
        job.started = datetime.now(timezone.utc).isoformat()

        try:
            result = fn(job)
            if job.cancel_flag.is_set():
                job.state = STOPPED
            else:
                job.state  = COMPLETED
                job.result = result
        except Exception as exc:
            job.state = FAILED
            job.error = str(exc)
        finally:
            job.finished = datetime.now(timezone.utc).isoformat()
            with self._lock:
                self._user_running[job.uid] -= 1


# ── Module-level singleton ────────────────────────────────────────────────────
_queue = InProcessQueue()


def get_queue() -> InProcessQueue:
    """FastAPI dependency."""
    return _queue

get_job_queue = get_queue
