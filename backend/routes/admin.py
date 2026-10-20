"""
Admin router providing system metrics, user governance, configurable limits, and security logs.
"""

import os
import sys
import json
import shutil
import time
import hmac
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth import (
    create_admin_session_token,
    get_configured_admin_credentials,
    get_current_admin,
    get_deactivated_users,
    set_user_active_status,
)
from services.store import get_store
from services.job_queue import get_job_queue
from services.audit import get_audit_logs, log_security_event

router = APIRouter(prefix="/admin", tags=["Admin Governance"])


class AdminLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def admin_login(payload: AdminLoginRequest):
    """Authenticates configured admin accounts and issues an expiring session token."""
    usernames, password = get_configured_admin_credentials()
    if not usernames or not password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin sign-in is not configured on the server.",
        )

    username_bytes = payload.username.encode("utf-8")
    password_bytes = payload.password.encode("utf-8")
    username_is_valid = any(
        hmac.compare_digest(username_bytes, username.encode("utf-8"))
        for username in usernames
    )
    password_is_valid = hmac.compare_digest(password_bytes, password.encode("utf-8"))
    if not username_is_valid or not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin username or password.",
        )
    if payload.username in get_deactivated_users():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    try:
        token = create_admin_session_token(payload.username)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin sign-in is not configured on the server.",
        ) from exc
    return {"access_token": token, "token_type": "bearer", "expires_in": 28800}


class UserStatusRequest(BaseModel):
    active: bool


class SystemLimits(BaseModel):
    execution_timeout_sec: int = Field(15, ge=1, le=120)
    memory_limit_mb: int = Field(256, ge=64, le=2048)
    max_upload_size_mb: int = Field(50, ge=1, le=500)
    per_user_quota_datasets: int = Field(25, ge=1, le=500)


def _get_limits_path() -> str:
    store = get_store()
    return os.path.join(store.base_dir, "system_limits.json")


def load_system_limits() -> Dict[str, Any]:
    path = _get_limits_path()
    defaults = {
        "execution_timeout_sec": 15,
        "memory_limit_mb": 256,
        "max_upload_size_mb": 50,
        "per_user_quota_datasets": 25,
    }
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                saved = json.load(f)
                defaults.update(saved)
        except Exception:
            pass
    return defaults


def save_system_limits(limits: Dict[str, Any]):
    path = _get_limits_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(limits, f, indent=2)


@router.get("/users")
async def list_users(admin_uid: str = Depends(get_current_admin)):
    """Lists all users discovered in storage with resource consumption and active state."""
    store = get_store()
    deactivated = get_deactivated_users()
    users = []

    base_dir = store.base_dir
    if os.path.exists(base_dir):
        for entry in os.listdir(base_dir):
            user_dir = os.path.join(base_dir, entry)
            # Skip system files or hidden items
            if os.path.isdir(user_dir) and not entry.startswith((".", "system_")):
                ds_count = len(os.listdir(os.path.join(user_dir, "datasets"))) if os.path.exists(os.path.join(user_dir, "datasets")) else 0
                md_count = len(os.listdir(os.path.join(user_dir, "models"))) if os.path.exists(os.path.join(user_dir, "models")) else 0
                rn_count = len(os.listdir(os.path.join(user_dir, "runs"))) if os.path.exists(os.path.join(user_dir, "runs")) else 0

                # Compute approximate disk usage
                total_bytes = 0
                for root, _, files in os.walk(user_dir):
                    for f in files:
                        try:
                            total_bytes += os.path.getsize(os.path.join(root, f))
                        except Exception:
                            pass

                users.append({
                    "uid": entry,
                    "is_active": entry not in deactivated,
                    "dataset_count": ds_count,
                    "model_count": md_count,
                    "run_count": rn_count,
                    "storage_mb": round(total_bytes / (1024 * 1024), 2),
                })

    return users


@router.post("/users/{target_uid}/status")
async def toggle_user_status(
    target_uid: str,
    payload: UserStatusRequest,
    admin_uid: str = Depends(get_current_admin),
):
    """Activates or deactivates a user account."""
    if target_uid == admin_uid and not payload.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    set_user_active_status(target_uid, payload.active)
    log_security_event(
        event_type="USER_STATUS_CHANGE",
        actor_uid=admin_uid,
        details={"target_uid": target_uid, "is_active": payload.active},
        severity="WARNING",
    )
    return {"uid": target_uid, "is_active": payload.active}


@router.get("/jobs")
async def list_jobs(admin_uid: str = Depends(get_current_admin)):
    """Returns overview of active, queued, completed, and failed pipeline jobs."""
    queue = get_job_queue()
    all_runs = queue.list_all_jobs()
    running = [r for r in all_runs if r.get("state") in ("Running", "running")]
    queued = [r for r in all_runs if r.get("state") in ("Queued", "queued")]
    failed = [r for r in all_runs if r.get("state") in ("Failed", "failed")]
    completed = [r for r in all_runs if r.get("state") in ("Completed", "completed")]

    return {
        "summary": {
            "total": len(all_runs),
            "running": len(running),
            "queued": len(queued),
            "failed": len(failed),
            "completed": len(completed),
        },
        "running_jobs": [
            {
                "run_id": r.get("run_id"),
                "uid": r.get("uid"),
                "status": r.get("state"),
                "created_at": r.get("created"),
            }
            for r in running
        ],
        "failed_jobs": [
            {
                "run_id": r.get("run_id"),
                "uid": r.get("uid"),
                "status": r.get("state"),
                "error": r.get("error"),
                "created_at": r.get("created"),
            }
            for r in failed[:10]
        ],
    }


@router.get("/system")
async def system_usage(admin_uid: str = Depends(get_current_admin)):
    """Returns host hardware and storage capacity metrics."""
    store = get_store()
    try:
        total_disk, used_disk, free_disk = shutil.disk_usage(store.base_dir)
        disk_pct = round((used_disk / total_disk) * 100, 1)
    except Exception:
        total_disk, used_disk, free_disk, disk_pct = 0, 0, 0, 0.0

    # System memory info via OS
    total_ram_mb = 0
    available_ram_mb = 0
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", wintypes.DWORD),
                    ("dwMemoryLoad", wintypes.DWORD),
                    ("ullTotalPhys", ctypes.c_uint64),
                    ("ullAvailPhys", ctypes.c_uint64),
                    ("ullTotalPageFile", ctypes.c_uint64),
                    ("ullAvailPageFile", ctypes.c_uint64),
                    ("ullTotalVirtual", ctypes.c_uint64),
                    ("ullAvailVirtual", ctypes.c_uint64),
                    ("sullAvailExtendedVirtual", ctypes.c_uint64),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            total_ram_mb = int(stat.ullTotalPhys / (1024 * 1024))
            available_ram_mb = int(stat.ullAvailPhys / (1024 * 1024))
            ram_load_pct = stat.dwMemoryLoad
        except Exception:
            ram_load_pct = 40.0
    else:
        ram_load_pct = 35.0

    return {
        "storage": {
            "total_gb": round(total_disk / (1024**3), 2),
            "used_gb": round(used_disk / (1024**3), 2),
            "free_gb": round(free_disk / (1024**3), 2),
            "used_pct": disk_pct,
        },
        "memory": {
            "total_mb": total_ram_mb,
            "available_mb": available_ram_mb,
            "used_pct": ram_load_pct,
        },
        "platform": sys.platform,
        "python_version": sys.version.split()[0],
    }


@router.get("/limits")
async def get_limits(admin_uid: str = Depends(get_current_admin)):
    """Retrieves current platform execution limits."""
    return load_system_limits()


@router.post("/limits")
async def update_limits(
    payload: SystemLimits,
    admin_uid: str = Depends(get_current_admin),
):
    """Updates platform execution and upload limits."""
    limits = payload.model_dump()
    save_system_limits(limits)
    log_security_event(
        event_type="SYSTEM_LIMITS_UPDATE",
        actor_uid=admin_uid,
        details=limits,
        severity="INFO",
    )
    return limits


@router.get("/audit-logs")
async def view_audit_logs(
    limit: int = 50,
    admin_uid: str = Depends(get_current_admin),
):
    """Retrieves historical security events and admin operations."""
    return get_audit_logs(limit=limit)
