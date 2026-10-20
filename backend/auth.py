
"""
Authentication dependency for FastAPI.

Production:
    Verifies Firebase ID tokens using Firebase Admin SDK.
    Supports FIREBASE_SERVICE_ACCOUNT_JSON on Vercel.

Admin API:
    Uses an expiring signed session token.

Development:
    DEV_AUTH=1 enables development-only authentication.
    NEVER enable DEV_AUTH in production.
"""

import os
import json
import base64
import hashlib
import hmac
import time
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
                data = json.load(f)
                return set(data)
        except (OSError, ValueError, TypeError):
            return set()

    return set()


def set_user_active_status(uid: str, is_active: bool):
    users = get_deactivated_users()

    if is_active:
        users.discard(uid)
    else:
        users.add(uid)

    path = _get_deactivated_path()
    directory = os.path.dirname(path)

    if directory:
        os.makedirs(directory, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(list(users), f)


def _firebase_app():
    """Initialize Firebase Admin using Vercel or local credentials."""
    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            service_account_json = os.getenv(
                "FIREBASE_SERVICE_ACCOUNT_JSON"
            )

            if service_account_json:
                service_account_info = json.loads(
                    service_account_json
                )
                cred = credentials.Certificate(service_account_info)
            else:
                cred_path = os.getenv(
                    "FIREBASE_CREDENTIALS",
                    "firebase-credentials.json",
                )

                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                else:
                    cred = credentials.ApplicationDefault()

            firebase_admin.initialize_app(cred)

        return firebase_admin.get_app()

    except ImportError as exc:
        raise RuntimeError(
            "firebase-admin is not installed."
        ) from exc


def _admin_auth_secret() -> Optional[bytes]:
    secret = os.getenv("ADMIN_AUTH_SECRET", "")

    if len(secret.encode("utf-8")) < 32:
        return None

    return secret.encode("utf-8")


def get_configured_admin_credentials() -> tuple[Set[str], Optional[str]]:
    """Return configured admin usernames and password."""

    usernames = {
        username.strip()
        for username in os.getenv("ADMIN_USERNAMES", "").split(",")
        if username.strip()
    }

    password = os.getenv("ADMIN_PASSWORD")

    return usernames, password if password else None


def create_admin_session_token(username: str) -> str:
    """Create an expiring, signed admin session token."""

    secret = _admin_auth_secret()

    if not secret:
        raise RuntimeError(
            "ADMIN_AUTH_SECRET must contain at least 32 characters."
        )

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

    signature = hmac.new(
        secret, encoded_payload, hashlib.sha256
    ).digest()

    encoded_signature = base64.urlsafe_b64encode(
        signature
    ).rstrip(b"=")

    return (
        f"{encoded_payload.decode('ascii')}."
        f"{encoded_signature.decode('ascii')}"
    )


def verify_admin_session_token(token: str) -> Optional[str]:
    """Verify an admin session and return its username."""

    secret = _admin_auth_secret()

    if not secret:
        return None

    try:
        encoded_payload, encoded_signature = token.split(".", 1)

        payload_bytes = encoded_payload.encode("ascii")

        signature = base64.urlsafe_b64decode(
            encoded_signature
            + "=" * (-len(encoded_signature) % 4)
        )

        expected_signature = hmac.new(
            secret, payload_bytes, hashlib.sha256
        ).digest()

        if not hmac.compare_digest(signature, expected_signature):
            return None

        payload = json.loads(
            base64.urlsafe_b64decode(
                encoded_payload
                + "=" * (-len(encoded_payload) % 4)
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

    except (
        ValueError,
        TypeError,
        UnicodeError,
        json.JSONDecodeError,
    ):
        return None


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Return the authenticated user's UID."""

    token = creds.credentials

    if DEV_AUTH:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A non-empty Bearer token is required.",
            )

        uid = token

        if uid in get_deactivated_users():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact an administrator.",
            )

        return uid

    try:
        from firebase_admin import auth as fb_auth

        app = _firebase_app()
        decoded = fb_auth.verify_id_token(token, app=app)
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
    """Require a valid admin session token."""

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
