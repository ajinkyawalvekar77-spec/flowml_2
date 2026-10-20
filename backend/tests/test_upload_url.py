"""
Tests for URL dataset import (GitHub, Kaggle, direct web URLs).
"""
import io
import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import auth_headers


def test_upload_url_missing_url(client):
    r = client.post(
        "/api/upload-url",
        json={"url": ""},
        headers=auth_headers("test_user"),
    )
    assert r.status_code == 400


def test_upload_url_invalid_url_protocol(client):
    r = client.post(
        "/api/upload-url",
        json={"url": "ftp://example.com/data.csv"},
        headers=auth_headers("test_user"),
    )
    assert r.status_code == 400


class FakeResponse:
    def __init__(self, data: bytes):
        self._buf = io.BytesIO(data)
        self.headers = {"content-type": "text/csv"}

    def read(self, amt=-1):
        return self._buf.read(amt)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


def test_upload_url_mocked_success(client, tmp_storage):
    csv_bytes = b"feature_a,feature_b,target\n1,2,0\n3,4,1\n5,6,0\n"

    with patch("urllib.request.urlopen", return_value=FakeResponse(csv_bytes)):
        r = client.post(
            "/api/upload-url",
            json={
                "url": "https://github.com/someuser/somerepo/blob/main/data.csv",
                "file_name": "custom_data.csv",
            },
            headers=auth_headers("test_user"),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["file_name"] == "custom_data.csv"
        assert data["rows"] == 3
        assert data["columns"] == 3
        assert "dataset_id" in data
        assert data["source_type"] == "github"

        # Verify dataset is previewable
        ds_id = data["dataset_id"]
        prev_r = client.get(
            f"/api/datasets/{ds_id}/preview",
            headers=auth_headers("test_user"),
        )
        assert prev_r.status_code == 200
        prev_data = prev_r.json()
        assert prev_data["rows"] == 3
        assert len(prev_data["preview_rows"]) == 3
