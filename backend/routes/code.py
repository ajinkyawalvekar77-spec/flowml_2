"""
Routes for Isolated Python Code Execution.
"""

import os
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth import get_current_user
from services.code_executor import execute_python_code, stop_code_run, get_code_history
from services.store import StoreBackend, get_store

router = APIRouter(prefix="/code", tags=["Code Execution"])


class CodeRunRequest(BaseModel):
    code: str = Field(..., description="Python code string to execute")
    input_dataset_id: Optional[str] = Field(None, description="Dataset ID to load as input DataFrame 'df'")
    timeout: Optional[int] = Field(15, ge=1, le=60, description="Max execution duration in seconds")


@router.post("/run", response_model=Dict[str, Any])
async def run_code(
    payload: CodeRunRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Executes Python script in an isolated worker sandbox.
    Guarantees user code never runs inside the FastAPI process.
    """
    if os.getenv("ENABLE_PYTHON_SANDBOX", "true").lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Python execution is disabled. Not available in this setup.",
        )

    if not payload.code or not payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code payload cannot be empty.",
        )

    result = execute_python_code(
        uid=uid,
        code=payload.code,
        input_dataset_id=payload.input_dataset_id,
        timeout_seconds=payload.timeout or 15,
        store=store,
    )
    # Exclude un-serializable pandas DataFrame object from JSON HTTP response
    res_dict = dict(result)
    res_dict.pop("output_df", None)
    return res_dict


@router.post("/runs/{run_id}/stop")
async def stop_code(
    run_id: str,
    uid: str = Depends(get_current_user),
):
    """Stops an active running worker process."""
    success = stop_code_run(run_id)
    return {"run_id": run_id, "stopped": success}


@router.get("/history", response_model=List[Dict[str, Any]])
async def list_code_history(
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Returns past execution runs for the current user."""
    return get_code_history(uid, store)
