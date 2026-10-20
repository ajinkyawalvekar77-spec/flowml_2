"""
Account and user data governance routes.
"""

import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from services.store import get_store
from services.audit import log_security_event

router = APIRouter(prefix="/account", tags=["Account"])


@router.delete("")
@router.delete("/data")
async def delete_user_account_and_data(
    uid: str = Depends(get_current_user),
):
    """
    Permanently deletes all datasets, models, runs, preprocessors,
    and storage directories belonging to the authenticated user.
    """
    store = get_store()
    user_root = os.path.join(store.base_dir, uid)

    if os.path.exists(user_root):
        try:
            shutil.rmtree(user_root)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete user data: {str(e)}",
            )

    log_security_event(
        event_type="ACCOUNT_DATA_DELETED",
        actor_uid=uid,
        details={"deleted_path": user_root},
        severity="INFO",
    )

    return {
        "status": "success",
        "deleted": True,
        "uid": uid,
        "message": "All user datasets, models, runs, and storage artifacts have been permanently deleted.",
    }
