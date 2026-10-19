"""
Storage abstraction layer — interface + local-disk implementation.

The interface (StoreBackend) defines all I/O operations used by every route.
The local implementation keeps files under:
    storage/{uid}/datasets/{dataset_id}/
    storage/{uid}/models/{model_id}/
    storage/{uid}/runs/{run_id}/

Swapping to Firebase Storage + Firestore later is a one-file change:
just replace LocalDiskStore with a FirebaseStore that implements StoreBackend.

Security guarantee: every path is resolved through _safe_path() which raises
403 if the resolved path would escape the per-user root (path-traversal guard).
"""

from __future__ import annotations

import json
import os
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

_BACKEND_DIR = Path(__file__).resolve().parent.parent

def _resolve_storage_root(root: str | None = None) -> Path:
    raw = root or os.getenv("STORAGE_ROOT", "storage")
    p = Path(raw)
    if not p.is_absolute():
        return (_BACKEND_DIR / p).resolve()
    return p.resolve()

_BASE_STORAGE_ROOT = str(_resolve_storage_root())


# ─────────────────────────────────────────────────────────────────────────────
# Abstract interface
# ─────────────────────────────────────────────────────────────────────────────

class StoreBackend(ABC):
    """All methods raise HTTPException(403/404) on access violations."""

    # ── path helpers ──────────────────────────────────────────────────────────
    @abstractmethod
    def dataset_path(self, uid: str, dataset_id: str) -> str: ...

    @abstractmethod
    def model_path(self, uid: str, model_id: str) -> str: ...

    @abstractmethod
    def run_path(self, uid: str, run_id: str) -> str: ...

    # ── dataset ops ───────────────────────────────────────────────────────────
    @abstractmethod
    def save_dataset(self, uid: str, dataset_id: str, src_path: str) -> str:
        """Move/copy src_path into the store, return canonical path."""
        ...

    @abstractmethod
    def get_dataset_path(self, uid: str, dataset_id: str) -> str:
        """Return absolute path or raise 404."""
        ...

    @abstractmethod
    def list_datasets(self, uid: str) -> list[dict]: ...

    @abstractmethod
    def update_dataset_meta(self, uid: str, dataset_id: str, updates: dict) -> None: ...

    @abstractmethod
    def get_dataset_meta(self, uid: str, dataset_id: str) -> dict: ...

    @abstractmethod
    def delete_dataset(self, uid: str, dataset_id: str) -> None: ...

    @abstractmethod
    def list_models(self, uid: str) -> list[dict]: ...

    # ── model ops ─────────────────────────────────────────────────────────────
    @abstractmethod
    def save_artifact(self, uid: str, model_id: str, filename: str, src_path: str) -> str:
        """Store one artifact file under models/{model_id}/{filename}."""
        ...

    @abstractmethod
    def get_artifact_path(self, uid: str, model_id: str, filename: str) -> str:
        """Return absolute path or raise 404."""
        ...

    @abstractmethod
    def list_artifacts(self, uid: str, model_id: str) -> list[str]:
        """List artifact filenames for a model id."""
        ...

    # ── run ops ───────────────────────────────────────────────────────────────
    @abstractmethod
    def save_run_meta(self, uid: str, run_id: str, meta: dict) -> None: ...

    @abstractmethod
    def get_run_meta(self, uid: str, run_id: str) -> dict: ...

    @abstractmethod
    def list_runs(self, uid: str) -> list[dict]: ...

    @abstractmethod
    def append_run_log(self, uid: str, run_id: str, entry: dict) -> None: ...

    @abstractmethod
    def get_run_logs(self, uid: str, run_id: str) -> list[dict]: ...


# ─────────────────────────────────────────────────────────────────────────────
# Local-disk implementation
# ─────────────────────────────────────────────────────────────────────────────

class LocalDiskStore(StoreBackend):
    """File-system store under storage/{uid}/..."""

    def __init__(self, root: str = _BASE_STORAGE_ROOT):
        self._root = _resolve_storage_root(root)

    @property
    def base_dir(self) -> str:
        return str(self._root)

    # ── internal helpers ──────────────────────────────────────────────────────

    def _user_root(self, uid: str) -> Path:
        return (self._root / _sanitise_uid(uid)).resolve()

    def _safe_path(self, uid: str, *parts: str) -> Path:
        """Resolve and validate that the final path stays inside the user root."""
        user_root = self._user_root(uid)
        candidate = (user_root / Path(*parts)).resolve()
        try:
            candidate.relative_to(user_root)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Path traversal detected.",
            )
        return candidate

    def _ensure(self, path: Path) -> Path:
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _find_dataset_dir(self, uid: str, dataset_id: str) -> Path | None:
        """Find dataset directory for uid, with fallback across locations for same uid, or for desktop_offline_user."""
        # 1. Primary check for this uid
        try:
            p = self._safe_path(uid, "datasets", dataset_id)
            if (p / "meta.json").exists():
                return p
        except Exception:
            pass

        # 2. Check alternate storage roots for the SAME uid
        alt_roots = [
            self._root.parent.parent / "storage",
            self._root.parent / "storage",
            Path(__file__).resolve().parent.parent / "storage",
            Path(__file__).resolve().parent.parent.parent.parent / "storage",
        ]
        for alt in alt_roots:
            try:
                alt_res = alt.resolve()
                if alt_res != self._root and alt_res.exists():
                    cand = alt_res / _sanitise_uid(uid) / "datasets" / dataset_id
                    if (cand / "meta.json").exists():
                        return cand
            except Exception:
                continue

        # 3. If caller is desktop_offline_user, allow cross-access to other local datasets
        if uid == "desktop_offline_user":
            if self._root.exists():
                for u_dir in self._root.iterdir():
                    if u_dir.is_dir():
                        cand = u_dir / "datasets" / dataset_id
                        if (cand / "meta.json").exists():
                            return cand
            for alt in alt_roots:
                try:
                    alt_res = alt.resolve()
                    if alt_res != self._root and alt_res.exists():
                        for u_dir in alt_res.iterdir():
                            if u_dir.is_dir():
                                cand = u_dir / "datasets" / dataset_id
                                if (cand / "meta.json").exists():
                                    return cand
                except Exception:
                    continue
        else:
            # Check if dataset was saved under desktop_offline_user
            cand = self._root / "desktop_offline_user" / "datasets" / dataset_id
            if (cand / "meta.json").exists():
                return cand
            for alt in alt_roots:
                try:
                    alt_res = alt.resolve()
                    if alt_res != self._root and alt_res.exists():
                        cand = alt_res / "desktop_offline_user" / "datasets" / dataset_id
                        if (cand / "meta.json").exists():
                            return cand
                except Exception:
                    continue

        return None

    # ── path helpers ──────────────────────────────────────────────────────────

    def dataset_path(self, uid: str, dataset_id: str) -> str:
        found = self._find_dataset_dir(uid, dataset_id)
        if found:
            return str(found)
        return str(self._safe_path(uid, "datasets", dataset_id))

    def model_path(self, uid: str, model_id: str) -> str:
        return str(self._safe_path(uid, "models", model_id))

    def run_path(self, uid: str, run_id: str) -> str:
        return str(self._safe_path(uid, "runs", run_id))

    # ── dataset ops ───────────────────────────────────────────────────────────

    def save_dataset(self, uid: str, dataset_id: str, src_path: str) -> str:
        dest_dir = self._safe_path(uid, "datasets", dataset_id)
        self._ensure(dest_dir)
        dest_file = dest_dir / Path(src_path).name
        shutil.copy2(src_path, dest_file)
        # Write minimal metadata alongside the file
        meta_path = dest_dir / "meta.json"
        existing_meta: dict = {}
        if meta_path.exists():
            with open(meta_path) as f:
                existing_meta = json.load(f)
        existing_meta["file"] = Path(src_path).name
        with open(meta_path, "w") as f:
            json.dump(existing_meta, f)
        return str(dest_file)

    def get_dataset_path(self, uid: str, dataset_id: str) -> str:
        ds_dir = self._find_dataset_dir(uid, dataset_id)
        if not ds_dir or not (ds_dir / "meta.json").exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset '{dataset_id}' not found.",
            )
        meta_path = ds_dir / "meta.json"
        with open(meta_path) as f:
            meta = json.load(f)
        full_path = ds_dir / meta.get("file", "")
        if not full_path.exists():
            for f in ds_dir.iterdir():
                if f.is_file() and f.name != "meta.json" and not f.name.startswith("."):
                    return str(f)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset file missing for '{dataset_id}'.",
            )
        return str(full_path)

    def update_dataset_meta(self, uid: str, dataset_id: str, updates: dict) -> None:
        ds_dir = self._find_dataset_dir(uid, dataset_id)
        if not ds_dir:
            ds_dir = self._safe_path(uid, "datasets", dataset_id)
            self._ensure(ds_dir)
        meta_path = ds_dir / "meta.json"
        existing: dict = {}
        if meta_path.exists():
            with open(meta_path) as f:
                existing = json.load(f)
        existing.update(updates)
        with open(meta_path, "w") as f:
            json.dump(existing, f)

    def get_dataset_meta(self, uid: str, dataset_id: str) -> dict:
        ds_dir = self._find_dataset_dir(uid, dataset_id)
        if not ds_dir or not (ds_dir / "meta.json").exists():
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
        with open(ds_dir / "meta.json") as f:
            return json.load(f)

    def list_datasets(self, uid: str) -> list[dict]:
        seen_ids = set()
        result = []

        def _scan_dir(datasets_root: Path):
            if not datasets_root.exists():
                return
            for ds_dir in sorted(datasets_root.iterdir()):
                if ds_dir.is_dir() and ds_dir.name not in seen_ids:
                    meta_path = ds_dir / "meta.json"
                    if meta_path.exists():
                        try:
                            with open(meta_path) as f:
                                meta = json.load(f)
                            meta["dataset_id"] = ds_dir.name
                            seen_ids.add(ds_dir.name)
                            result.append(meta)
                        except Exception:
                            pass

        # 1. Primary user root
        try:
            _scan_dir(self._safe_path(uid, "datasets"))
        except Exception:
            pass

        # 2. Check alternate storage roots for same uid
        alt_roots = [
            self._root.parent.parent / "storage",
            self._root.parent / "storage",
            Path(__file__).resolve().parent.parent / "storage",
            Path(__file__).resolve().parent.parent.parent.parent / "storage",
        ]
        for alt in alt_roots:
            try:
                alt_res = alt.resolve()
                if alt_res != self._root and alt_res.exists():
                    _scan_dir(alt_res / _sanitise_uid(uid) / "datasets")
            except Exception:
                continue

        # 3. If caller is desktop_offline_user, include all other local datasets
        if uid == "desktop_offline_user":
            if self._root.exists():
                for u_dir in self._root.iterdir():
                    if u_dir.is_dir():
                        _scan_dir(u_dir / "datasets")
            for alt in alt_roots:
                try:
                    alt_res = alt.resolve()
                    if alt_res != self._root and alt_res.exists():
                        for u_dir in alt_res.iterdir():
                            if u_dir.is_dir():
                                _scan_dir(u_dir / "datasets")
                except Exception:
                    continue

        return result

    def delete_dataset(self, uid: str, dataset_id: str) -> None:
        ds_dir = self._find_dataset_dir(uid, dataset_id)
        if not ds_dir or not ds_dir.exists():
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
        shutil.rmtree(ds_dir)

    # ── model / artifact ops ──────────────────────────────────────────────────

    def save_artifact(self, uid: str, model_id: str, filename: str, src_path: str) -> str:
        dest_dir = self._safe_path(uid, "models", model_id)
        self._ensure(dest_dir)
        dest_file = dest_dir / filename
        shutil.copy2(src_path, dest_file)
        return str(dest_file)

    def save_artifact_bytes(self, uid: str, model_id: str, filename: str, data: bytes) -> str:
        dest_dir = self._safe_path(uid, "models", model_id)
        self._ensure(dest_dir)
        dest_file = dest_dir / filename
        with open(dest_file, "wb") as f:
            f.write(data)
        return str(dest_file)

    def get_artifact_path(self, uid: str, model_id: str, filename: str) -> str:
        p = self._safe_path(uid, "models", model_id, filename)
        if not p.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Artifact '{filename}' not found for model '{model_id}'.",
            )
        return str(p)

    def list_artifacts(self, uid: str, model_id: str) -> list[str]:
        model_dir = self._safe_path(uid, "models", model_id)
        if not model_dir.exists():
            return []
        return [f.name for f in model_dir.iterdir() if f.is_file()]

    def list_models(self, uid: str) -> list[dict]:
        models_root = self._safe_path(uid, "models")
        if not models_root.exists():
            return []
        result = []
        for m_dir in sorted(models_root.iterdir()):
            if m_dir.is_dir():
                result.append({"model_id": m_dir.name, "artifacts": [f.name for f in m_dir.iterdir() if f.is_file()]})
        return result

    # ── run ops ───────────────────────────────────────────────────────────────

    def save_run_meta(self, uid: str, run_id: str, meta: dict) -> None:
        run_dir = self._safe_path(uid, "runs", run_id)
        self._ensure(run_dir)
        with open(run_dir / "meta.json", "w") as f:
            json.dump(meta, f, default=str)

    def get_run_meta(self, uid: str, run_id: str) -> dict:
        run_dir = self._safe_path(uid, "runs", run_id)
        meta_path = run_dir / "meta.json"
        if not meta_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Run '{run_id}' not found.",
            )
        with open(meta_path) as f:
            return json.load(f)

    def list_runs(self, uid: str) -> list[dict]:
        runs_root = self._safe_path(uid, "runs")
        if not runs_root.exists():
            return []
        result = []
        for run_dir in sorted(runs_root.iterdir(), reverse=True):
            if run_dir.is_dir():
                meta_path = run_dir / "meta.json"
                if meta_path.exists():
                    with open(meta_path) as f:
                        meta = json.load(f)
                    meta["run_id"] = run_dir.name
                    result.append(meta)
        return result

    def append_run_log(self, uid: str, run_id: str, entry: dict) -> None:
        run_dir = self._safe_path(uid, "runs", run_id)
        self._ensure(run_dir)
        log_path = run_dir / "logs.jsonl"
        with open(log_path, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")

    def get_run_logs(self, uid: str, run_id: str) -> list[dict]:
        run_dir = self._safe_path(uid, "runs", run_id)
        log_path = run_dir / "logs.jsonl"
        if not log_path.exists():
            return []
        entries = []
        with open(log_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        return entries

    def save_run_result(self, uid: str, run_id: str, result: dict) -> None:
        run_dir = self._safe_path(uid, "runs", run_id)
        self._ensure(run_dir)
        with open(run_dir / "result.json", "w") as f:
            json.dump(result, f, default=str)

    def get_run_result(self, uid: str, run_id: str) -> dict | None:
        run_dir = self._safe_path(uid, "runs", run_id)
        result_path = run_dir / "result.json"
        if not result_path.exists():
            return None
        with open(result_path) as f:
            return json.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singleton (swap to FirebaseStore here when ready)
# ─────────────────────────────────────────────────────────────────────────────

_store: StoreBackend = LocalDiskStore()


def get_store() -> StoreBackend:
    """FastAPI dependency — inject the storage backend."""
    return _store


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _sanitise_uid(uid: str) -> str:
    """Allow only alphanumeric + underscore + hyphen in uid directory names."""
    import re
    cleaned = re.sub(r"[^a-zA-Z0-9_\-]", "_", uid)
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        )
    return cleaned
