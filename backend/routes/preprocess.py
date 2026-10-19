import os
import uuid
import joblib
import tempfile
import pathlib
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Dict, Optional

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset
from services.preprocessing import preprocess_data
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class PreprocessRequest(BaseModel):
    dataset_id: str
    config: Dict[str, Any]
    target_column: Optional[str] = None


@router.post("/preprocess")
async def preprocess(
    request: PreprocessRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Preprocess a dataset and save results + transformers under the caller's model store.
    Returns: processed_dataset_id (the new dataset to train on) and shape info.
    """
    try:
        file_path = store.get_dataset_path(uid, request.dataset_id)
    except Exception:
        raise_http_exception(404, "Dataset not found", f"Dataset '{request.dataset_id}' not found.")

    try:
        df = load_dataset(file_path)

        config = dict(request.config)
        if request.target_column:
            config["target_column"] = request.target_column

        processed_df, transformers = preprocess_data(df, config, save_preprocessors=False)

        # Save processed dataset as a new dataset entry
        processed_id = "processed_" + uuid.uuid4().hex[:8]
        orig_meta = store.get_dataset_meta(uid, request.dataset_id)
        orig_name = orig_meta.get("original_name", "dataset.csv")
        ext = orig_name.rsplit(".", 1)[-1].lower()
        processed_name = f"processed_{orig_name}"

        tmp_dataset = os.path.join(tempfile.gettempdir(), f"{processed_id}_{processed_name}")
        try:
            if ext == "csv":
                processed_df.to_csv(tmp_dataset, index=False)
            else:
                processed_df.to_excel(tmp_dataset, index=False)
            store.save_dataset(uid, processed_id, tmp_dataset)
        finally:
            if os.path.exists(tmp_dataset):
                try:
                    os.unlink(tmp_dataset)
                except Exception:
                    pass

        store.update_dataset_meta(uid, processed_id, {
            "dataset_id": processed_id,
            "original_name": processed_name,
            "source_dataset_id": request.dataset_id,
            "rows": int(processed_df.shape[0]),
            "columns": int(processed_df.shape[1]),
            "column_names": processed_df.columns.tolist(),
        })

        # Save transformers for inference reuse (under a model_id = processed_id)
        tmp_joblib = os.path.join(tempfile.gettempdir(), f"prep_{uuid.uuid4().hex}.joblib")
        try:
            joblib.dump(transformers, tmp_joblib)
            store.save_artifact(uid, processed_id, "preprocessors.joblib", tmp_joblib)
        finally:
            if os.path.exists(tmp_joblib):
                try:
                    os.unlink(tmp_joblib)
                except Exception:
                    pass

        log_event(f"[{uid}] Preprocessing OK → processed_dataset_id={processed_id}")
        return {
            "message": "Data preprocessed successfully.",
            "processed_dataset_id": processed_id,
            "rows": int(processed_df.shape[0]),
            "columns": int(processed_df.shape[1]),
            "column_names": processed_df.columns.tolist(),
        }

    except Exception as exc:
        log_event(f"[{uid}] Preprocessing error: {exc}", level="ERROR")
        raise_http_exception(500, "Error preprocessing dataset", str(exc))
