"""
Tests for Phase 3: Security hardening, file limits, account deletion, and safe errors.
"""

import os
import pytest
from fastapi.testclient import TestClient

from app import app
from services.store import get_store


def test_invalid_file_type_rejected():
    """Uploading executable or unsupported file type must return 400 Bad Request."""
    client = TestClient(app)
    bad_file = ("script.py", b"print('malicious')", "text/x-python")
    resp = client.post(
        "/api/upload",
        files={"file": bad_file},
        headers={"Authorization": "Bearer sec_user"},
    )
    assert resp.status_code == 400
    assert "Invalid file format" in str(resp.json()["detail"])


def test_file_size_limit_rejection(monkeypatch):
    """Uploading file larger than MAX_UPLOAD_SIZE_MB must be rejected with 413."""
    monkeypatch.setenv("MAX_UPLOAD_SIZE_MB", "1")  # 1MB limit for test
    client = TestClient(app)

    # 1.5 MB payload
    large_csv = b"col1,col2\n" + (b"123,456\n" * 160000)
    resp = client.post(
        "/api/upload",
        files={"file": ("large.csv", large_csv, "text/csv")},
        headers={"Authorization": "Bearer sec_user"},
    )
    assert resp.status_code == 413
    assert "File Too Large" in str(resp.json()["detail"])


def test_account_and_data_deletion():
    """Calling DELETE /api/account permanently removes user files and directory."""
    client = TestClient(app)
    uid = "user_to_delete_999"
    store = get_store()

    # Pre-create sample file in user storage
    user_ds_dir = os.path.join(store.base_dir, uid, "datasets")
    os.makedirs(user_ds_dir, exist_ok=True)
    sample_file = os.path.join(user_ds_dir, "my_data.csv")
    with open(sample_file, "w") as f:
        f.write("a,b\n1,2\n")

    assert os.path.exists(sample_file)

    # Request deletion
    resp = client.delete(
        "/api/account",
        headers={"Authorization": f"Bearer {uid}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] is True

    # Verify user directory was destroyed
    assert not os.path.exists(os.path.join(store.base_dir, uid))


def test_secure_error_messages_no_stack_trace():
    """Unhandled internal errors must not leak Python stack traces to clients."""
    client = TestClient(app)
    # Target nonexistent endpoint or trigger 404/405/500
    resp = client.get("/api/nonexistent-route-999")
    assert resp.status_code == 404
    # Response should not contain File, line, Traceback
    assert "Traceback" not in resp.text
    assert "site-packages" not in resp.text
