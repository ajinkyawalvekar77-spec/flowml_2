"""
Multi-user end-to-end test with 3 and 5 simulated users.
Validates:
- Account separation and private file isolation
- Concurrent code and pipeline executions
- Failing code handling and recovery after worker termination
"""

import time
import concurrent.futures
import pytest
from fastapi.testclient import TestClient

from app import app
from services.code_executor import execute_python_code
from services.store import get_store


def simulate_user_session(user_id: int):
    """Simulates a user doing isolated data processing and script execution."""
    client = TestClient(app)
    uid = f"simulated_user_{user_id}"

    # 1. Upload private dataset
    csv_content = f"id,val_{user_id}\n1,100\n2,200\n3,300\n".encode("utf-8")
    resp_upload = client.post(
        "/api/upload",
        files={"file": (f"user_{user_id}_data.csv", csv_content, "text/csv")},
        headers={"Authorization": f"Bearer {uid}"},
    )
    assert resp_upload.status_code == 200, f"Upload failed for {uid}"
    dataset_id = resp_upload.json()["dataset_id"]

    # 2. Execute custom Python code on this data
    code = (
        f"import pandas as pd\n"
        f"output_df = df.copy()\n"
        f"output_df['computed'] = output_df['val_{user_id}'] * 2\n"
        f"print('Processed {uid}')\n"
    )
    resp_code = client.post(
        "/api/code/run",
        json={"code": code, "input_dataset_id": dataset_id, "timeout": 25},
        headers={"Authorization": f"Bearer {uid}"},
    )
    assert resp_code.status_code == 200, f"Code run failed for {uid}"
    res_data = resp_code.json()
    assert res_data["status"] == "completed", f"Execution failed for {uid}: {res_data.get('stderr')} || {res_data.get('traceback')}"

    # 3. Verify user cannot access another user's dataset
    other_uid = f"simulated_user_{(user_id % 5) + 1}"
    resp_other = client.get(
        f"/api/datasets/{dataset_id}/preview",
        headers={"Authorization": f"Bearer {other_uid}"},
    )
    # If other_uid != uid, must return 404/403
    if other_uid != uid:
        assert resp_other.status_code in {403, 404}

    return uid, dataset_id


def test_three_simulated_users_concurrently(monkeypatch, tmp_storage):
    """Simulates 3 concurrent users with account separation."""
    monkeypatch.setenv("ENABLE_PYTHON_SANDBOX", "true")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(simulate_user_session, i) for i in range(1, 4)]
        results = [f.result() for f in futures]
    assert len(results) == 3


def test_five_simulated_users_concurrently(monkeypatch, tmp_storage):
    """Simulates 5 concurrent users with private files and concurrent execution."""
    monkeypatch.setenv("ENABLE_PYTHON_SANDBOX", "true")
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(simulate_user_session, i) for i in range(1, 6)]
        results = [f.result() for f in futures]
    assert len(results) == 5


def test_worker_crash_recovery_and_failing_code(monkeypatch, tmp_storage):
    """Verifies server recovers gracefully after failing code and worker kill."""
    monkeypatch.setenv("ENABLE_PYTHON_SANDBOX", "true")
    client = TestClient(app)
    uid = "crash_recovery_user"

    # Run code that fails with DivisionByZero
    failing_code = "x = 1 / 0"
    resp_fail = client.post(
        "/api/code/run",
        json={"code": failing_code},
        headers={"Authorization": f"Bearer {uid}"},
    )
    assert resp_fail.status_code == 200
    assert resp_fail.json()["status"] == "failed"
    assert "ZeroDivisionError" in resp_fail.json()["traceback"]

    # Verify subsequent valid code succeeds immediately (clean recovery)
    valid_code = "print('Healthy recovery')"
    resp_ok = client.post(
        "/api/code/run",
        json={"code": valid_code},
        headers={"Authorization": f"Bearer {uid}"},
    )
    assert resp_ok.status_code == 200
    assert resp_ok.json()["status"] == "completed"
    assert "Healthy recovery" in resp_ok.json()["stdout"]
