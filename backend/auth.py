"""
Authentication dependency for FastAPI.

Production:  Verifies a Firebase ID token from the Authorization header.
             Requires firebase-admin SDK initialised with a service account.
Admin API:   Uses an expiring signed session issued after configured username/password
             authentication.
Development: Set DEV_AUTH=1 in the environment; the token value is used
             directly as the uid (use any non-empty string as the Bearer
             token in curl/tests). NEVER enable DEV_AUTH in production.
"""

import os
import json
import base64
import hashlib
import hmac
import time
from functools import lru_cache
from typing import Optional, Set
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=True)

DEV_AUTH: bool = os.getenv("DEV_AUTH", "0") == "1"


def _get_deactivated_path() -> str:
    base = os.getenv("FLOWML_STORAGE_DIR", "storage")
    return os.path.join(base, "deactivated_users.json")


def get_deactivated_users() -> Set[str]:
    path = _get_deactivated_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()


def set_user_active_status(uid: str, is_active: bool):
    users = get_deactivated_users()
    if is_active:
        users.discard(uid)
    else:
        users.add(uid)
    path = _get_deactivated_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(list(users), f)


def _firebase_app():
    """Lazy-init Firebase Admin SDK (only when not in dev mode)."""
    try:
        import firebase_admin  # type: ignore
        from firebase_admin import credentials  # type: ignore

        if not firebase_admin._apps:
            cred_path = os.getenv("FIREBASE_CREDENTIALS", "firebase-credentials.json")
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
        return firebase_admin.get_app()
    except ImportError:
        raise RuntimeError(
            "firebase-admin is not installed. "
            "Install it or set DEV_AUTH=1 for local development."
        )


def _admin_auth_secret() -> Optional[bytes]:
    secret = os.getenv("ADMIN_AUTH_SECRET", "")
    if len(secret.encode("utf-8")) < 32:
        return None
    return secret.encode("utf-8")


def get_configured_admin_credentials() -> tuple[Set[str], Optional[str]]:
    """Returns admin usernames and the shared password from server configuration."""
    usernames = {
        username.strip()
        for username in os.getenv("ADMIN_USERNAMES", "").split(",")
        if username.strip()
    }
    password = os.getenv("ADMIN_PASSWORD")
    return usernames, password if password else None


def create_admin_session_token(username: str) -> str:
    """Creates an expiring, signed token for the admin API."""
    secret = _admin_auth_secret()
    if not secret:
        raise RuntimeError("ADMIN_AUTH_SECRET must contain at least 32 characters.")

    now = int(time.time())
    payload = {
        "exp": now + 8 * 60 * 60,
        "iat": now,
        "iss": "flowml-admin",
        "role": "admin",
        "sub": username,
    }
    encoded_payload = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).rstrip(b"=")
    signature = hmac.new(secret, encoded_payload, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return f"{encoded_payload.decode('ascii')}.{encoded_signature.decode('ascii')}"


def verify_admin_session_token(token: str) -> Optional[str]:
    """Returns the username for a valid admin session token, otherwise None."""
    secret = _admin_auth_secret()
    if not secret:
        return None

    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        payload_bytes = encoded_payload.encode("ascii")
        signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        expected_signature = hmac.new(secret, payload_bytes, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected_signature):
            return None

        payload = json.loads(
            base64.urlsafe_b64decode(
                encoded_payload + "=" * (-len(encoded_payload) % 4)
            )
        )
        if not isinstance(payload, dict):
            return None
        expires_at = payload.get("exp")
        username = payload.get("sub")
        if (
            payload.get("iss") != "flowml-admin"
            or payload.get("role") != "admin"
            or not isinstance(expires_at, int)
            or isinstance(expires_at, bool)
            or expires_at <= int(time.time())
            or not isinstance(username, str)
        ):
            return None
        configured_usernames, _ = get_configured_admin_credentials()
        if username not in configured_usernames:
            return None
        return username
    except (ValueError, TypeError, UnicodeError, json.JSONDecodeError):
        return None


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    FastAPI dependency that returns the authenticated user's uid.
    """
    token = creds.credentials

    if DEV_AUTH:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="DEV_AUTH: supply any non-empty string as Bearer token.",
            )
        uid = token
        if uid in get_deactivated_users():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact an administrator.",
            )
        return uid

    # --- Production path ---
    try:
        from firebase_admin import auth as fb_auth  # type: ignore

        _firebase_app()
        decoded = fb_auth.verify_id_token(token)
        uid = decoded["uid"]
        if uid in get_deactivated_users():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact an administrator.",
            )
        return uid
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )


async def get_current_admin(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    FastAPI dependency requiring admin privileges.
    """
    token = creds.credentials
    admin_uid = verify_admin_session_token(token)
    if admin_uid:
        if admin_uid in get_deactivated_users():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated.",
            )
        return admin_uid

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator access required.",
    )
