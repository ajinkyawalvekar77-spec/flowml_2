from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from typing import Any, Dict, List, Optional
import pandas as pd

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset
from services.predictor import predict_with_store
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class PredictRequest(BaseModel):
    model_id: str
    dataset_id: Optional[str] = None
    target_column: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None

    @model_validator(mode="after")
    def require_data_source(self):
        if bool(self.dataset_id) == bool(self.rows):
            raise ValueError("Provide exactly one of dataset_id or rows.")
        return self


@router.post("/predict")
async def generate_predictions(
    request: PredictRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Run inference using a trained model owned by the caller.
    target_column is dropped server-side so training data can be used for demo.
    """
    try:
        if request.rows is not None:
            df = pd.DataFrame(request.rows)
            if df.empty:
                raise ValueError("Provide at least one row of input data.")
        else:
            try:
                file_path = store.get_dataset_path(uid, request.dataset_id)
            except HTTPException as exc:
                if exc.status_code == 404:
                    raise_http_exception(404, "Dataset not found", f"Dataset '{request.dataset_id}' not found.")
                raise
            df = load_dataset(file_path)
        result = predict_with_store(
            df, uid, request.model_id, store,
            target_column=request.target_column, dataset_id=request.dataset_id,
        )
        log_event(f"[{uid}] Prediction OK → {len(result['predictions'])} rows")
        return result
    except FileNotFoundError as exc:
        raise_http_exception(404, "Model not found", str(exc))
    except ValueError as exc:
        raise_http_exception(422, "Prediction input is invalid", str(exc))
    except Exception as exc:
        log_event(f"[{uid}] Prediction error: {exc}", level="ERROR")
        raise_http_exception(500, "Error running predictions", str(exc))
