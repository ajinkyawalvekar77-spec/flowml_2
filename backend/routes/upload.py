import os
import re
import io
import ssl
import json
import uuid
import shutil
import socket
import zipfile
import tempfile
import urllib.request
import urllib.parse
import urllib.error
import base64
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from auth import get_current_user
from services.store import StoreBackend, get_store
from services.data_loader import load_dataset, get_dataset_metadata
from utils.helpers import allowed_file, raise_http_exception
from utils.logger import log_event

router = APIRouter()


class UploadUrlRequest(BaseModel):
    url: str
    file_name: Optional[str] = None


def _get_kaggle_auth_header() -> Optional[str]:
    """Retrieve Kaggle credentials if configured."""
    user = os.getenv("KAGGLE_USERNAME")
    key = os.getenv("KAGGLE_KEY")
    if user and key:
        token = base64.b64encode(f"{user}:{key}".encode("utf-8")).decode("ascii")
        return f"Basic {token}"
    try:
        cfg_path = os.path.expanduser("~/.kaggle/kaggle.json")
        if os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            u = data.get("username")
            k = data.get("key")
            if u and k:
                token = base64.b64encode(f"{u}:{k}".encode("utf-8")).decode("ascii")
                return f"Basic {token}"
    except Exception:
        pass
    return None


def _resolve_download_url(url: str) -> tuple[str, str, str, Optional[str]]:
    """
    Normalizes dataset links from GitHub, Kaggle, GDrive, Dropbox, HuggingFace, or direct web URLs.
    Returns: (download_url, inferred_filename, source_type, selected_file_in_archive)
    """
    clean_url = url.strip()
    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        raise_http_exception(400, "Invalid URL", "Dataset link must begin with http:// or https://")

    parsed = urllib.parse.urlparse(clean_url)
    selected_file = None
    if parsed.query:
        qs = urllib.parse.parse_qs(parsed.query)
        if "select" in qs and qs["select"]:
            selected_file = qs["select"][0]

    # 1. GitHub blob / raw
    gh_match = re.match(r"https?://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/([^/]+)/(.+)", clean_url)
    if gh_match:
        owner, repo, branch, path = gh_match.groups()
        download_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
        filename = path.rsplit("/", 1)[-1]
        return download_url, filename, "github", None

    if "raw.githubusercontent.com" in clean_url:
        filename = parsed.path.rsplit("/", 1)[-1] or "github_dataset.csv"
        return clean_url, filename, "github", None

    # 2. Kaggle dataset
    kag_match = re.search(r"kaggle\.com/(?:datasets/)?([^/?#]+)/([^/?#]+)", clean_url)
    if kag_match:
        owner, ds_slug = kag_match.groups()
        download_url = f"https://www.kaggle.com/api/v1/datasets/download/{owner}/{ds_slug}"
        filename = selected_file or f"{ds_slug}.csv"
        return download_url, filename, "kaggle", selected_file

    # 3. Google Drive
    gdrive_match = re.search(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)", clean_url)
    if gdrive_match:
        file_id = gdrive_match.group(1)
        download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        return download_url, "gdrive_dataset.csv", "gdrive", None

    # 4. Dropbox
    if "dropbox.com" in clean_url:
        dl_url = re.sub(r"[?&]dl=0", "", clean_url)
        sep = "&" if "?" in dl_url else "?"
        download_url = f"{dl_url}{sep}dl=1"
        filename = parsed.path.rsplit("/", 1)[-1] or "dropbox_dataset.csv"
        return download_url, filename, "dropbox", None

    # 5. Hugging Face
    hf_match = re.match(r"https?://huggingface\.co/datasets/([^/]+/[^/]+)/blob/([^/]+)/(.+)", clean_url)
    if hf_match:
        repo, branch, path = hf_match.groups()
        download_url = f"https://huggingface.co/datasets/{repo}/resolve/{branch}/{path}"
        filename = path.rsplit("/", 1)[-1]
        return download_url, filename, "huggingface", None

    # 6. Direct web URL
    raw_name = parsed.path.rsplit("/", 1)[-1] or "dataset.csv"
    return clean_url, raw_name, "web_url", selected_file


def download_dataset_from_url(url: str, custom_name: Optional[str] = None) -> tuple[str, str, str]:
    """
    Downloads remote dataset to a local temporary file and returns (tmp_path, filename, source_type).
    """
    download_url, inferred_name, source_type, selected_file = _resolve_download_url(url)
    filename = (custom_name or inferred_name).strip()

    max_size_bytes = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024
    if max_size_bytes <= 0:
        max_size_bytes = 500 * 1024 * 1024

    headers = {
        "User-Agent": "Kaggle-API/1.0" if source_type == "kaggle" else "Mozilla/5.0",
        "Accept": "*/*",
    }
    if source_type == "kaggle":
        auth_hdr = _get_kaggle_auth_header()
        if auth_hdr:
            headers["Authorization"] = auth_hdr

    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(download_url, headers=headers)

    tmp_raw_path = None
    final_tmp_path = None
    try:
        # Stream response directly to a temporary file on disk (O(1) memory usage for lakhs of records)
        with tempfile.NamedTemporaryFile(delete=False) as raw_tmp:
            tmp_raw_path = raw_tmp.name
            try:
                with urllib.request.urlopen(req, context=ctx, timeout=180) as resp:
                    size_bytes = 0
                    first_chunk = True
                    is_html = False
                    while chunk := resp.read(256 * 1024):
                        size_bytes += len(chunk)
                        if size_bytes > max_size_bytes:
                            raise_http_exception(
                                413,
                                "File Too Large",
                                f"Dataset exceeds maximum allowed size of {max_size_bytes // (1024 * 1024)}MB.",
                            )
                        if first_chunk:
                            first_chunk = False
                            stripped = chunk.lstrip()
                            if stripped.startswith((b"<!doctype html", b"<!DOCTYPE html", b"<html", b"<HTML")):
                                is_html = True
                        raw_tmp.write(chunk)
            except HTTPException:
                raise
            except urllib.error.HTTPError as exc:
                if exc.code in (401, 403):
                    if source_type == "kaggle":
                        raise_http_exception(
                            403,
                            "Kaggle Access Forbidden",
                            "This Kaggle dataset requires authentication or competition rules acceptance. Please provide a public dataset link or configure Kaggle credentials.",
                        )
                    raise_http_exception(exc.code, "Access Forbidden", f"The server returned HTTP {exc.code} Forbidden.")
                if exc.code == 404:
                    raise_http_exception(404, "Dataset not found", "The dataset URL returned HTTP 404 Not Found. Please verify the URL.")
                raise_http_exception(400, "Download Failed", f"Failed to download dataset: HTTP {exc.code} {exc.reason}")
            except urllib.error.URLError as exc:
                raise_http_exception(400, "Network Error", f"Unable to reach dataset host: {exc.reason}")
            except (TimeoutError, socket.timeout):
                raise_http_exception(504, "Download Timeout", "Downloading dataset from the link timed out after 180 seconds.")
            except Exception as exc:
                raise_http_exception(500, "Download Error", f"Unexpected error downloading dataset: {str(exc)}")

        if size_bytes == 0:
            raise_http_exception(400, "Empty dataset", "The downloaded dataset was empty.")

        if is_html:
            raise_http_exception(
                400,
                "Invalid dataset format",
                "The link returned an HTML webpage instead of a dataset file. Please ensure the link points to a direct CSV/Excel file or public dataset.",
            )

        # Check for ZIP archive (e.g. from Kaggle)
        with open(tmp_raw_path, "rb") as check_f:
            magic_bytes = check_f.read(4)

        if magic_bytes == b"PK\x03\x04":
            try:
                with zipfile.ZipFile(tmp_raw_path, "r") as z:
                    names = z.namelist()
                    candidates = [
                        n for n in names
                        if n.lower().endswith((".csv", ".xlsx", ".xls"))
                        and not n.startswith("__MACOSX/")
                        and not os.path.basename(n).startswith(".")
                    ]
                    if not candidates:
                        raise_http_exception(
                            400,
                            "No tabular files in archive",
                            f"The downloaded ZIP does not contain any CSV or Excel files. Found files: {', '.join(names[:6])}",
                        )
                    chosen = None
                    if selected_file:
                        for c in candidates:
                            if os.path.basename(c).lower() == selected_file.lower():
                                chosen = c
                                break
                    if not chosen:
                        chosen = candidates[0]

                    ext = os.path.splitext(chosen)[1].lower()
                    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as out_tmp:
                        final_tmp_path = out_tmp.name
                        with z.open(chosen) as z_entry:
                            shutil.copyfileobj(z_entry, out_tmp)
                    filename = os.path.basename(chosen)
            except HTTPException:
                raise
            except Exception as exc:
                raise_http_exception(400, "Invalid archive", f"Could not extract ZIP archive: {str(exc)}")
        else:
            base, ext = os.path.splitext(filename)
            if ext.lower() not in (".csv", ".xlsx", ".xls"):
                ext = ".csv"
                filename = f"{base}{ext}"

            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as out_tmp:
                final_tmp_path = out_tmp.name
            shutil.copy2(tmp_raw_path, final_tmp_path)

        base, ext = os.path.splitext(filename)
        safe_base = re.sub(r"[^\w\-.]", "_", base) or "dataset"
        clean_filename = f"{safe_base}{ext}"

        return final_tmp_path, clean_filename, source_type

    except Exception:
        if final_tmp_path and os.path.exists(final_tmp_path):
            try:
                os.unlink(final_tmp_path)
            except Exception:
                pass
        raise
    finally:
        if tmp_raw_path and os.path.exists(tmp_raw_path):
            try:
                os.unlink(tmp_raw_path)
            except Exception:
                pass


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

    max_size_bytes = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024
    if max_size_bytes <= 0:
        raise_http_exception(500, "Upload unavailable", "The configured upload limit must be greater than zero.")

    client_name = file.filename.replace("\\", "/").rsplit("/", 1)[-1]
    if "." in client_name:
        ext = client_name.rsplit(".", 1)[-1].lower()
        safe_base = client_name.rsplit(".", 1)[0].replace(" ", "_") or "dataset"
        original_name = f"{safe_base}.{ext}"
    else:
        ext = "csv"
        safe_base = client_name.replace(" ", "_") or "dataset"
        original_name = f"{safe_base}.csv"

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
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    log_event(
        f"[{uid}] Upload error: {type(exc).__name__}: {exc}",
        level="ERROR",
    )

    raise_http_exception(
        500,
        "File processing error",
        f"Temporary upload processing failed: {type(exc).__name__}: {exc}",
    )


@router.post("/upload-url")
@router.post("/upload/url")
async def upload_dataset_from_url_route(
    req: UploadUrlRequest,
    uid: str = Depends(get_current_user),
    store: StoreBackend = Depends(get_store),
):
    """
    Download and store a dataset from a GitHub link, Kaggle dataset link, Google Drive, or web URL.
    Returns dataset_id + schema metadata.
    """
    if not req.url or not req.url.strip():
        raise_http_exception(400, "Missing URL", "Please provide a valid dataset link.")

    tmp_path = None
    try:
        tmp_path, original_name, source_type = download_dataset_from_url(req.url, req.file_name)

        try:
            df = load_dataset(tmp_path)
        except Exception as exc:
            log_event(f"[{uid}] Invalid dataset content from {req.url}: {exc}", level="ERROR")
            raise_http_exception(
                400,
                "Invalid dataset format",
                f"The downloaded file from the link could not be parsed as a valid CSV or Excel dataset ({str(exc)}).",
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
            "source_url": req.url,
            "source_type": source_type,
        })
        log_event(f"[{uid}] URL Import OK ({source_type}) → dataset_id={dataset_id}, file={original_name}")
        return {
            **metadata,
            "dataset_id": dataset_id,
            "file_name": original_name,
            "source_url": req.url,
            "source_type": source_type,
        }

    except HTTPException:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    except Exception as exc:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        log_event(f"[{uid}] URL Upload error for {req.url}: {exc}", level="ERROR")
        raise_http_exception(
            500,
            "Dataset import failed",
            f"Could not import dataset from link: {str(exc)}",
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
    n_rows = len(df)
    missing_counts = {col: int(cnt) for col, cnt in df.isnull().sum().to_dict().items()}
    total_missing = int(df.isnull().sum().sum())

    if n_rows > 100_000:
        sample_subset = df.sample(min(50_000, n_rows), random_state=42)
        duplicate_count = int(round(sample_subset.duplicated().sum() * (n_rows / len(sample_subset))))
    else:
        duplicate_count = int(df.duplicated().sum())

    # Generate head 15 rows
    head_df = df.head(15).replace({float("nan"): None})
    records = head_df.to_dict(orient="records")

    columns_info = []
    is_large = n_rows > 100_000
    for col in df.columns:
        if is_large and df[col].dtype == "object":
            sample_col = df[col].dropna()
            if len(sample_col) > 50_000:
                sample_col = sample_col.sample(50_000, random_state=42)
            unique_cnt = int(sample_col.nunique())
        else:
            unique_cnt = int(df[col].nunique())

        columns_info.append({
            "name": col,
            "type": str(df[col].dtype),
            "missing": missing_counts.get(col, 0),
            "unique": unique_cnt,
        })

    return {
        "dataset_id": dataset_id,
        "name": meta.get("original_name") or meta.get("file", dataset_id),
        "rows": n_rows,
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
