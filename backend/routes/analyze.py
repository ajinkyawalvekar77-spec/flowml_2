from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset
from services.data_analyzer import analyze_dataset
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class AnalyzeRequest(BaseModel):
    dataset_id: str


@router.post("/analyze")
async def analyze_data(
    request: AnalyzeRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Analyze a previously uploaded dataset owned by the caller."""
    try:
        file_path = store.get_dataset_path(uid, request.dataset_id)
    except Exception:
        log_event(f"[{uid}] Analyze: dataset {request.dataset_id} not found", level="ERROR")
        raise_http_exception(404, "Dataset not found", f"Dataset '{request.dataset_id}' not found.")

    try:
        df = load_dataset(file_path)
        insights = analyze_dataset(df)
        return insights
    except Exception as e:
        log_event(f"[{uid}] Analysis error: {e}", level="ERROR")
        raise_http_exception(500, "Error analyzing dataset", str(e))
