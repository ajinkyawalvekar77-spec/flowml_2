"""
Legacy /api/pipeline endpoint — synchronous execution for backward compatibility.
New code should prefer /api/runs (async with job queue).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.pipeline_executor import execute_pipeline, validate_graph
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class PipelineRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    workflow: Dict[str, Any] = None


@router.post("/pipeline")
async def run_pipeline(
    request: PipelineRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Synchronous pipeline execution (no queue).
    Validates the graph first and returns structured errors if invalid.
    """
    # Pre-validate
    errors = validate_graph(request.nodes, request.edges)
    if errors:
        return {
            "status": "error",
            "message": "Graph validation failed.",
            "validation_errors": errors,
            "results": [],
        }

    try:
        results = execute_pipeline(
            {"nodes": request.nodes, "edges": request.edges},
            uid=uid,
            store=store,
        )
        return results
    except Exception as e:
        log_event(f"[{uid}] Pipeline execution error: {e}", level="ERROR")
        raise_http_exception(500, "Error running pipeline", str(e))
