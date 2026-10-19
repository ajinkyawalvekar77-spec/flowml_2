import json
from fastapi import APIRouter, Query, Header, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services import pipeline_hub
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter(prefix="/community", tags=["Community Pipeline Hub"])


def extract_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract user identifier from Bearer token or return default offline user."""
    if not authorization or not isinstance(authorization, str):
        return "local_user"
    token = authorization
    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    return token or "local_user"


class PublishPipelineRequest(BaseModel):
    title: str
    description: Optional[str] = "Custom visual machine learning pipeline created in FlowML Studio"
    author: Optional[str] = "data_scientist"
    task_type: Optional[str] = "all"
    tags: Optional[List[str]] = []
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    is_public: Optional[bool] = True


class ForkPipelineRequest(BaseModel):
    target_dataset_id: Optional[str] = None
    dataset_name: Optional[str] = None


@router.get("/pipelines")
async def list_pipelines(
    search: Optional[str] = Query(None, description="Search query for title, author, or tags"),
    task_type: Optional[str] = Query(None, description="Filter by task_type: all | regression | classification"),
    sort: Optional[str] = Query("popular", description="Sort order: popular | stars | recent"),
    only_mine: Optional[bool] = Query(False, description="Filter only pipelines created by the logged-in user"),
    authorization: Optional[str] = Header(None),
):
    """Browse public community ML pipelines, similar to GitHub repositories, with user-specific stars and filters."""
    try:
        user_id = extract_user_id(authorization)
        return pipeline_hub.get_all_pipelines(
            search=search,
            task_type=task_type,
            sort_by=sort or "popular",
            user_id=user_id,
            only_mine=bool(only_mine),
        )
    except Exception as e:
        log_event(f"Error fetching hub pipelines: {e}", level="ERROR")
        raise_http_exception(500, "Could not fetch community pipelines", str(e))


@router.get("/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str, authorization: Optional[str] = Header(None)):
    """Retrieve details and node graph for a specific community pipeline."""
    user_id = extract_user_id(authorization)
    pipe = pipeline_hub.get_pipeline_by_id(pipeline_id, user_id=user_id)
    if not pipe:
        raise_http_exception(404, "Pipeline not found", f"No pipeline with id '{pipeline_id}' exists.")
    return pipe


@router.post("/pipelines")
async def publish_pipeline(request: PublishPipelineRequest, authorization: Optional[str] = Header(None)):
    """Publish an ML pipeline to the community hub so any user can access and run it on their dataset."""
    if not request.nodes:
        raise_http_exception(400, "Empty pipeline", "Cannot publish a pipeline with 0 nodes.")

    user_id = extract_user_id(authorization)
    payload = request.model_dump()
    payload["user_id"] = user_id

    try:
        new_pipe = pipeline_hub.create_pipeline(payload, user_id=user_id)
        return {
            "status": "success",
            "message": f"Pipeline '{new_pipe['title']}' published to Community Hub successfully!",
            "pipeline": new_pipe,
        }
    except Exception as e:
        log_event(f"Error publishing community pipeline: {e}", level="ERROR")
        raise_http_exception(500, "Failed to publish pipeline", str(e))


@router.post("/pipelines/{pipeline_id}/fork")
async def fork_pipeline(pipeline_id: str, request: Optional[ForkPipelineRequest] = None):
    """Fork or load a community pipeline, optionally binding directly to a user's dataset."""
    target_dataset_id = request.target_dataset_id if request else None
    dataset_name = request.dataset_name if request else None

    pipe = pipeline_hub.fork_pipeline(
        pipeline_id,
        target_dataset_id=target_dataset_id,
        dataset_name=dataset_name,
    )
    if not pipe:
        raise_http_exception(404, "Pipeline not found", f"Cannot fork pipeline '{pipeline_id}'.")
    return {
        "status": "success",
        "message": f"Pipeline '{pipe['title']}' forked and configured for dataset.",
        "pipeline": pipe,
    }


@router.post("/pipelines/{pipeline_id}/star")
async def star_pipeline(pipeline_id: str, authorization: Optional[str] = Header(None)):
    """Toggle star / like a community pipeline."""
    user_id = extract_user_id(authorization)
    result = pipeline_hub.star_pipeline(pipeline_id, user_id=user_id)
    if not result:
        raise_http_exception(404, "Pipeline not found", f"Cannot star pipeline '{pipeline_id}'.")
    return {
        "status": "success",
        "stars": result["stars"],
        "is_starred": result.get("is_starred", True),
    }


@router.get("/pipelines/{pipeline_id}/export")
async def export_pipeline(pipeline_id: str):
    """Export pipeline structure as a JSON payload for offline distribution."""
    pipe = pipeline_hub.get_pipeline_by_id(pipeline_id)
    if not pipe:
        raise_http_exception(404, "Pipeline not found", f"Cannot export pipeline '{pipeline_id}'.")
    return JSONResponse(
        content=pipe,
        headers={"Content-Disposition": f"attachment; filename={pipe.get('id', 'pipeline')}.flowml"}
    )


@router.post("/pipelines/import")
async def import_pipeline(pipeline_data: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Import a .flowml pipeline structure."""
    if not pipeline_data.get("nodes"):
        raise_http_exception(400, "Invalid pipeline format", "Pipeline missing 'nodes' definition.")
    user_id = extract_user_id(authorization)
    new_pipe = pipeline_hub.create_pipeline(pipeline_data, user_id=user_id)
    return {
        "status": "success",
        "message": "Pipeline imported into Community Hub.",
        "pipeline": new_pipe,
    }


@router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, authorization: Optional[str] = Header(None)):
    """Delete a pipeline from the community hub."""
    user_id = extract_user_id(authorization)
    pipe = pipeline_hub.get_pipeline_by_id(pipeline_id)
    if not pipe:
        raise_http_exception(404, "Pipeline not found", f"Could not find pipeline '{pipeline_id}'.")

    # If user owns it or if local dev user, allow deletion
    if pipe.get("user_id") and pipe.get("user_id") != user_id and user_id not in ("local_user", "dev_user_123"):
        raise_http_exception(403, "Forbidden", "You can only delete pipelines you created.")

    success = pipeline_hub.delete_pipeline(pipeline_id)
    if not success:
        raise_http_exception(500, "Failed to delete", f"Could not delete pipeline '{pipeline_id}'.")
    return {"status": "success", "message": f"Pipeline '{pipeline_id}' deleted."}
