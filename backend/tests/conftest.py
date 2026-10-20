"""
Shared pytest fixtures for FlowML backend tests.
Uses DEV_AUTH=1 so no Firebase is needed.
"""
import os
import sys
import tempfile
import shutil
import pytest
import pandas as pd

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force dev auth mode
os.environ["DEV_AUTH"] = "1"
os.environ["STORAGE_ROOT"] = ""  # will be overridden per test
os.environ["ADMIN_USERNAMES"] = "vish@flowml,kush@flowml,ajinkya@flowml"
os.environ["ADMIN_PASSWORD"] = "flowml@2026"
os.environ["ADMIN_AUTH_SECRET"] = "test-only-admin-session-secret-at-least-32-chars"

from fastapi.testclient import TestClient
from app import app
from services.store import LocalDiskStore, get_store
from services.job_queue import InProcessQueue, get_queue


@pytest.fixture(scope="function")
def tmp_storage(tmp_path):
    """Creates an isolated storage root per test."""
    store = LocalDiskStore(root=str(tmp_path / "storage"))
    app.dependency_overrides[get_store] = lambda: store
    yield store, tmp_path
    app.dependency_overrides.pop(get_store, None)


@pytest.fixture(scope="function")
def fresh_queue():
    """Creates a fresh in-process queue per test."""
    q = InProcessQueue()
    app.dependency_overrides[get_queue] = lambda: q
    yield q
    app.dependency_overrides.pop(get_queue, None)


@pytest.fixture(scope="function")
def client(tmp_storage, fresh_queue):
    """TestClient with isolated storage + fresh queue."""
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def auth_headers(uid: str) -> dict:
    """In DEV_AUTH mode the Bearer token IS the uid."""
    return {"Authorization": f"Bearer {uid}"}


def make_csv(tmp_path, name="test.csv", rows=100):
    """Create a minimal Iris-like CSV and return its path."""
    df = pd.DataFrame({
        "sepal_length": [5.1 + i * 0.01 for i in range(rows)],
        "sepal_width":  [3.5 - i * 0.01 for i in range(rows)],
        "petal_length": [1.4 + i * 0.02 for i in range(rows)],
        "target": [i % 3 for i in range(rows)],
    })
    path = tmp_path / name
    df.to_csv(path, index=False)
    return path
