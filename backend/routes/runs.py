"""
Runs API — async job queue for pipeline execution.

POST /api/runs          — Submit a pipeline; returns run_id immediately.
GET  /api/runs          — List caller's runs (from store + in-memory queue).
GET  /api/runs/{id}     — Get status + result for a single run.
POST /api/runs/{id}/stop — Request graceful stop.
"""

from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Optional

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.job_queue import InProcessQueue, get_queue
from services.pipeline_executor import execute_pipeline
from utils.logger import log_event

router = APIRouter()


class RunRequest(BaseModel):
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    workflow: Optional[dict[str, Any]] = None


@router.post("/runs", status_code=202)
async def submit_run(
    request: RunRequest,
    uid: str   = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
    queue: InProcessQueue = Depends(get_queue),
):
    """
    Enqueue a pipeline run.  Returns {run_id, state} immediately.
    The actual execution happens in a background thread.
    """
    payload = request.model_dump()

    def _run(job):
        """This function executes in a worker thread."""
        try:
            store.save_run_meta(uid, job.run_id, {
                "state":   "Running",
                "started": datetime.now(timezone.utc).isoformat(),
            })
            result = execute_pipeline(
                workflow_data={"nodes": payload["nodes"], "edges": payload["edges"]},
                uid=uid,
                run_id=job.run_id,
                store=store,
                cancel_flag=job.cancel_flag,
            )
            store.save_run_meta(uid, job.run_id, {
                "state":    job.state,  # set by queue after fn returns
                "finished": datetime.now(timezone.utc).isoformat(),
                "summary":  result.get("status"),
            })
            return result
        except Exception as exc:
            store.save_run_meta(uid, job.run_id, {
                "state":    "Failed",
                "finished": datetime.now(timezone.utc).isoformat(),
                "error":    str(exc),
            })
            raise

    job = queue.enqueue(uid=uid, payload=payload, fn=_run)

    # Persist initial run metadata
    store.save_run_meta(uid, job.run_id, {
        "run_id":  job.run_id,
        "uid":     uid,
        "state":   job.state,
        "created": job.created,
    })

    log_event(f"[{uid}] Run queued: {job.run_id}")
    return {"run_id": job.run_id, "state": job.state}


@router.get("/runs")
async def list_runs(
    uid: str   = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
    queue: InProcessQueue = Depends(get_queue),
):
    """List all pipeline runs for the caller, merging store + in-memory state."""
    # In-memory jobs have the freshest state
    in_memory = {j["run_id"]: j for j in queue.list_jobs(uid)}
    # Persisted runs as fallback for completed jobs no longer in memory
    persisted = {r["run_id"]: r for r in store.list_runs(uid)}

    merged = {}
    for rid, record in {**persisted, **in_memory}.items():
        merged[rid] = record

    return sorted(merged.values(), key=lambda r: r.get("created", ""), reverse=True)


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    uid: str   = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
    queue: InProcessQueue = Depends(get_queue),
):
    """Get status, logs, and result for a single run owned by the caller."""
    # Check in-memory first (freshest state)
    job = queue.get_job(run_id)
    if job is not None:
        if job.uid != uid:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Access denied.")
        base = job.to_dict()
    else:
        # Fallback to persisted metadata
        meta = store.get_run_meta(uid, run_id)  # raises 404 if not found
        base = meta

    logs   = store.get_run_logs(uid, run_id)
    result = store.get_run_result(uid, run_id)

    return {**base, "logs": logs, "result": result}


@router.post("/runs/{run_id}/stop")
async def stop_run(
    run_id: str,
    uid: str   = Depends(get_current_user),
    queue: InProcessQueue = Depends(get_queue),
    store: StoreBackend   = Depends(get_store),
):
    """Request graceful stop for a running job."""
    job = queue.stop_job(run_id, uid)
    store.save_run_meta(uid, run_id, {"state": "Stopping"})
    log_event(f"[{uid}] Stop requested for run {run_id}")
    return {"run_id": run_id, "state": "Stopping"}
