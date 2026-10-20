import os
import uuid
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset, get_dataset_metadata
from utils.helpers import allowed_file, raise_http_exception
from utils.logger import log_event

router = APIRouter()


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Upload a CSV or Excel file.
    Returns dataset_id + schema metadata.
    """
    if not file.filename or not allowed_file(file.filename):
        log_event(f"[{uid}] Rejected upload: {file.filename}", level="ERROR")
        raise_http_exception(400, "Invalid file format", "Only CSV (.csv) and Excel (.xls/.xlsx) files are allowed.")

    max_size_bytes = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024
    if max_size_bytes <= 0:
        raise_http_exception(500, "Upload unavailable", "The configured upload limit must be greater than zero.")

    client_name = file.filename.replace("\\", "/").rsplit("/", 1)[-1]
    ext = client_name.rsplit(".", 1)[-1].lower()
    safe_base = client_name.rsplit(".", 1)[0].replace(" ", "_") or "dataset"
    original_name = f"{safe_base}.{ext}"

    tmp_path = None
    try:
        size_bytes = 0
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp_path = tmp.name
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > max_size_bytes:
                    raise_http_exception(
                        413,
                        "File Too Large",
                        f"File exceeds maximum allowed size of {max_size_bytes // (1024 * 1024)}MB.",
                    )
                tmp.write(chunk)

        if size_bytes == 0:
            raise_http_exception(400, "Empty file", "Upload a non-empty CSV or Excel dataset.")

        try:
            df = load_dataset(tmp_path)
        except Exception as exc:
            log_event(f"[{uid}] Invalid dataset content: {exc}", level="ERROR")
            raise_http_exception(
                400,
                "Invalid dataset",
                "The file could not be read as a valid CSV or Excel dataset.",
            )

        metadata = get_dataset_metadata(df, original_name)

        dataset_id = uuid.uuid4().hex
        store.save_dataset(uid, dataset_id, tmp_path)
        os.unlink(tmp_path)
        tmp_path = None

        store.update_dataset_meta(uid, dataset_id, {
            "dataset_id": dataset_id,
            "original_name": original_name,
            "rows": metadata["rows"],
            "columns": metadata["columns"],
            "column_names": metadata["column_names"],
        })
        log_event(f"[{uid}] Upload OK → dataset_id={dataset_id}")
        return {**metadata, "dataset_id": dataset_id, "file_name": original_name}

    except HTTPException:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    except Exception as exc:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        log_event(f"[{uid}] Upload error: {exc}", level="ERROR")
        raise_http_exception(
            500,
            "File processing error",
            "The dataset could not be stored. Please try again.",
        )



@router.get("/datasets")
async def list_user_datasets(
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """List all uploaded datasets for the current user."""
    return store.list_datasets(uid)


@router.get("/datasets/{dataset_id}/preview")
async def get_dataset_preview(
    dataset_id: str,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Get preview rows, column schemas, missing count, and duplicate count."""
    file_path = store.get_dataset_path(uid, dataset_id)
    df = load_dataset(file_path)
    
    meta = store.get_dataset_meta(uid, dataset_id)
    missing_counts = {col: int(cnt) for col, cnt in df.isnull().sum().to_dict().items()}
    total_missing = int(df.isnull().sum().sum())
    duplicate_count = int(df.duplicated().sum())

    # Generate head 15 rows
    head_df = df.head(15).replace({float("nan"): None})
    records = head_df.to_dict(orient="records")

    columns_info = []
    for col in df.columns:
        columns_info.append({
            "name": col,
            "type": str(df[col].dtype),
            "missing": missing_counts.get(col, 0),
            "unique": int(df[col].nunique()),
        })

    return {
        "dataset_id": dataset_id,
        "name": meta.get("original_name") or meta.get("file", dataset_id),
        "rows": len(df),
        "columns": len(df.columns),
        "total_missing": total_missing,
        "duplicate_count": duplicate_count,
        "columns_info": columns_info,
        "preview_rows": records,
    }


@router.delete("/datasets/{dataset_id}")
async def delete_user_dataset(
    dataset_id: str,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """Delete a dataset owned by current user."""
    store.delete_dataset(uid, dataset_id)
    return {"status": "deleted", "dataset_id": dataset_id}
