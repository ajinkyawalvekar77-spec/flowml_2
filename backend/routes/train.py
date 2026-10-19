import os
import uuid
import asyncio
import tempfile
import joblib
import shutil
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset
from services.model_trainer import train_models
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class TrainRequest(BaseModel):
    dataset_id: str
    processed_dataset_id: Optional[str] = None
    target_column: str
    task_type: str = "classification"   # "classification" | "regression"
    model_name: Optional[str] = None
    model_parameters: Optional[Dict[str, Any]] = None
    test_size: float = Field(default=0.2, gt=0, lt=1)
    random_state: int = 42


@router.post("/train")
async def train(
    request: TrainRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Train the configured estimator or compare the model zoo using held-out evaluation.
    Preprocessing settings from processed_dataset_id are refit on train rows only.
    """
    try:
        file_path = store.get_dataset_path(uid, request.dataset_id)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise_http_exception(404, "Dataset not found", f"Dataset '{request.dataset_id}' not found.")
        raise

    try:
        df = load_dataset(file_path)
    except Exception as exc:
        raise_http_exception(500, "Could not load dataset", str(exc))

    if request.target_column not in df.columns:
        raise_http_exception(
            400, "Invalid target column",
            f"Column '{request.target_column}' not in dataset. Available: {df.columns.tolist()}"
        )

    X = df.drop(columns=[request.target_column])
    y = df[request.target_column]

    preprocessing_config = None
    if request.processed_dataset_id:
        try:
            preprocessors_path = store.get_artifact_path(
                uid, request.processed_dataset_id, "preprocessors.joblib"
            )
            preprocessing_config = joblib.load(preprocessors_path).get("config")
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            raise_http_exception(
                400, "Preprocessing configuration unavailable",
                f"Preprocessing settings for dataset '{request.processed_dataset_id}' were not found.",
            )
        except Exception as exc:
            raise_http_exception(
                400, "Preprocessing configuration unavailable",
                f"Could not load preprocessing settings for this run: {exc}",
            )

    model_id = uuid.uuid4().hex

    with tempfile.TemporaryDirectory(prefix=f"flowml_{model_id}_") as artifact_dir:
        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: train_models(
                    X, y, request.task_type, selected_model=request.model_name,
                    model_parameters=request.model_parameters,
                    preprocessing_config=preprocessing_config,
                    artifact_dir=artifact_dir,
                    test_size=request.test_size,
                    random_state=request.random_state,
                )
            )
        except Exception as exc:
            log_event(f"[{uid}] Training/evaluation error: {exc}", level="ERROR")
            raise_http_exception(422, "Training or evaluation failed", str(exc))

        for fname in os.listdir(artifact_dir):
            store.save_artifact(uid, model_id, fname, os.path.join(artifact_dir, fname))

        metadata = {
            "model_id": model_id,
            "target_column": request.target_column,
            "task_type": results.get("task_type", request.task_type),
            "dataset_id": request.dataset_id,
            "algorithm": results["best_model"],
            "best_model": results["best_model"],
            "selected_model": results["selected_model"],
            "model_selection": results["model_selection"],
            "model_parameters": results["model_parameters"],
            "training_status": results["training_status"],
            "input_features": results["input_features"],
            "input_schema": results["input_schema"],
            "feature_names": results["feature_names"],
        }
        meta_tmp = os.path.join(artifact_dir, "model_meta.joblib")
        joblib.dump(metadata, meta_tmp)
        store.save_artifact(uid, model_id, "model_meta.joblib", meta_tmp)

    log_event(f"[{uid}] Training OK → model_id={model_id}, model={results['best_model']}")
    return {**results, "model_id": model_id}


@router.get("/models")
async def list_user_models(
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """List all trained models for the caller with algorithm, version, and metadata."""
    models = store.list_models(uid)
    enriched = []
    for m in models:
        mid = m["model_id"]
        meta_info = {
            "model_id": mid,
            "algorithm": "Unknown",
            "task_type": "classification",
            "target_column": None,
            "dataset_id": None,
            "training_status": "unknown",
            "artifacts": m.get("artifacts", []),
            "version": "1.0.0",
        }
        try:
            meta_path = store.get_artifact_path(uid, mid, "model_meta.joblib")
        except HTTPException as exc:
            if exc.status_code == 404:
                enriched.append(meta_info)
                continue
            raise
        if os.path.exists(meta_path):
            try:
                data = joblib.load(meta_path)
            except Exception as exc:
                log_event(f"[{uid}] Invalid metadata for model '{mid}': {exc}", level="ERROR")
                raise_http_exception(500, "Model metadata unavailable", f"Could not read metadata for model '{mid}'.")
            meta_info.update(data)
            meta_info["algorithm"] = data.get("algorithm", data.get("best_model", "Trained Model"))
        enriched.append(meta_info)
    return enriched


@router.get("/models/{model_id}/download")
async def download_model_bundle(
    model_id: str,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Download the trained estimator together with its fitted preprocessing."""
    try:
        artifact_path = store.get_artifact_path(uid, model_id, "model_bundle.joblib")
    except HTTPException as exc:
        if exc.status_code == 404:
            raise_http_exception(404, "Model artifact not found", f"No downloadable artifact exists for model '{model_id}'.")
        raise
    return FileResponse(
        path=artifact_path,
        filename=f"flowml_model_{model_id}.joblib",
        media_type="application/octet-stream",
    )


@router.delete("/models/{model_id}")
async def delete_user_model(
    model_id: str,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Delete a trained model artifact directory."""
    m_dir = store._safe_path(uid, "models", model_id)
    if not m_dir.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    shutil.rmtree(m_dir)
    return {"status": "deleted", "model_id": model_id}
