import os
import uuid
import asyncio
import tempfile
import joblib
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

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


@router.post("/train")
async def train(
    request: TrainRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Train multiple ML models. Uses processed_dataset_id if provided, else dataset_id.
    Returns leaderboard + model_id (key for subsequent predict/download calls).
    """
    # Resolve training file (prefer preprocessed)
    file_path: Optional[str] = None
    used_dataset_id: Optional[str] = None
    for ds_id in [request.processed_dataset_id, request.dataset_id]:
        if ds_id:
            try:
                file_path = store.get_dataset_path(uid, ds_id)
                used_dataset_id = ds_id
                break
            except Exception:
                pass

    if file_path is None:
        raise_http_exception(404, "Dataset not found", "Neither dataset could be located.")

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

    # Detect preprocessors for this dataset (if preprocessed)
    preprocessors_path: Optional[str] = None
    if request.processed_dataset_id:
        try:
            preprocessors_path = store.get_artifact_path(
                uid, request.processed_dataset_id, "preprocessors.joblib"
            )
        except Exception:
            pass

    model_id = uuid.uuid4().hex

    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: train_models(X, y, request.task_type)
        )
    except Exception as exc:
        log_event(f"[{uid}] Training error: {exc}", level="ERROR")
        raise_http_exception(500, "Error training models", str(exc))

    # Artifacts are written to legacy save dir by train_models; re-save into store
    legacy_save_dir = "models/saved_models"
    artifact_files = [
        "best_model.joblib", "features.joblib", "task_type.joblib",
        "target_encoder.joblib", "feature_encoders.joblib",
        "fallback_imputer.joblib", "test_data.joblib", "model_results.joblib",
    ]
    for fname in artifact_files:
        src = os.path.join(legacy_save_dir, fname)
        if os.path.exists(src):
            store.save_artifact(uid, model_id, fname, src)

    # Copy preprocessors into the model store too (for inference)
    if preprocessors_path and os.path.exists(preprocessors_path):
        store.save_artifact(uid, model_id, "preprocessors.joblib", preprocessors_path)

    # Save lightweight metadata — use delete=False + explicit close before copy (Windows-safe)
    meta_tmp = tempfile.mktemp(suffix=".joblib")
    try:
        joblib.dump({
            "model_id": model_id,
            "target_column": request.target_column,
            "task_type": request.task_type,
            "dataset_id": used_dataset_id,
            "best_model": results["best_model"],
        }, meta_tmp)
        store.save_artifact(uid, model_id, "model_meta.joblib", meta_tmp)
    finally:
        try:
            os.unlink(meta_tmp)
        except OSError:
            pass

    log_event(f"[{uid}] Training OK → model_id={model_id}, best={results['best_model']}")
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
            "artifacts": m.get("artifacts", []),
            "version": "1.0.0",
        }
        try:
            meta_path = store.get_artifact_path(uid, mid, "model_meta.joblib")
            if os.path.exists(meta_path):
                data = joblib.load(meta_path)
                meta_info.update(data)
                meta_info["algorithm"] = data.get("best_model", "Trained Model")
        except Exception:
            pass
        enriched.append(meta_info)
    return enriched


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

