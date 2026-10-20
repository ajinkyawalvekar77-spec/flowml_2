import os
import joblib
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset
from services.visualization import (
    generate_correlation_heatmap,
    generate_distribution_plots,
    generate_feature_importance,
    generate_confusion_matrix,
    generate_actual_vs_predicted,
    generate_model_comparison,
)
from utils.helpers import raise_http_exception
from utils.logger import log_event

router = APIRouter()


class VisualizeRequest(BaseModel):
    dataset_id: str
    model_id: str


@router.post("/visualizations")
async def get_visualizations(
    request: VisualizeRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Return all available charts for the given dataset + model.
    Charts are base64-encoded PNGs ready for direct <img src="data:image/png;base64,..."> use.
    """
    try:
        file_path = store.get_dataset_path(uid, request.dataset_id)
    except Exception:
        raise_http_exception(404, "Dataset not found", f"Dataset '{request.dataset_id}' not found.")

    def _get_artifact(fname: str) -> str | None:
        try:
            return store.get_artifact_path(uid, request.model_id, fname)
        except Exception:
            return None

    try:
        df = load_dataset(file_path)
        charts: dict = {}

        # ── Dataset charts ────────────────────────────────────────────────────
        heatmap = generate_correlation_heatmap(df)
        if heatmap:
            charts["correlation_heatmap"] = f"data:image/png;base64,{heatmap}"

        dist = generate_distribution_plots(df)
        if dist:
            charts["distributions"] = f"data:image/png;base64,{dist}"

        # ── Model charts (only if model exists) ───────────────────────────────
        model_path = _get_artifact("best_model.joblib")
        features_path = _get_artifact("features.joblib")

        if model_path and features_path:
            model = joblib.load(model_path)
            features = joblib.load(features_path)

            fi = generate_feature_importance(model, features)
            if fi:
                charts["feature_importance"] = f"data:image/png;base64,{fi}"

            test_path = _get_artifact("test_data.joblib")
            task_type_path = _get_artifact("task_type.joblib")

            if test_path and task_type_path:
                task_type = joblib.load(task_type_path)
                X_test, y_test = joblib.load(test_path)

                if task_type == "classification":
                    cm = generate_confusion_matrix(model, X_test, y_test)
                    if cm:
                        charts["confusion_matrix"] = f"data:image/png;base64,{cm}"
                else:
                    avp = generate_actual_vs_predicted(model, X_test, y_test)
                    if avp:
                        charts["actual_vs_predicted"] = f"data:image/png;base64,{avp}"

            # Model comparison chart (requires training results — try meta)
            meta_path = _get_artifact("model_meta.joblib")
            results_path = _get_artifact("model_results.joblib")
            if results_path:
                model_results = joblib.load(results_path)
                mc = generate_model_comparison(model_results)
                if mc:
                    charts["model_comparison"] = f"data:image/png;base64,{mc}"

        return charts

    except Exception as exc:
        log_event(f"[{uid}] Visualization error: {exc}", level="ERROR")
        raise_http_exception(500, "Error generating visualizations", str(exc))


@router.get("/download-model")
async def download_model(
    model_id: str,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Download the best trained model artifact for caller's model_id."""
    try:
        model_path = store.get_artifact_path(uid, model_id, "best_model.joblib")
    except Exception:
        raise_http_exception(404, "Model not found", f"No trained model found for model_id='{model_id}'.")
    return FileResponse(
        path=model_path,
        filename="best_model.joblib",
        media_type="application/octet-stream",
    )
