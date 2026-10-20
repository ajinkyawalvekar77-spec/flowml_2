from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset
from services.predictor import predict_with_store
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class PredictRequest(BaseModel):
    dataset_id: str
    model_id: str
    target_column: Optional[str] = None


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
        file_path = store.get_dataset_path(uid, request.dataset_id)
    except Exception:
        raise_http_exception(404, "Dataset not found", f"Dataset '{request.dataset_id}' not found.")

    try:
        df = load_dataset(file_path)
        result = predict_with_store(df, uid, request.model_id, store, target_column=request.target_column)
        log_event(f"[{uid}] Prediction OK → {len(result['predictions'])} rows")
        return result
    except FileNotFoundError as exc:
        raise_http_exception(404, "Model not found", str(exc))
    except Exception as exc:
        log_event(f"[{uid}] Prediction error: {exc}", level="ERROR")
        raise_http_exception(500, "Error running predictions", str(exc))
