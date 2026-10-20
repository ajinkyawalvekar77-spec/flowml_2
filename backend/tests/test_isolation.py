"""
Tests: User isolation — user A must get 403 / 404 on user B's resources.
"""
import pytest
from tests.conftest import auth_headers, make_csv


def _upload(client, uid, csv_path):
    with open(csv_path, "rb") as f:
        r = client.post(
            "/api/upload",
            files={"file": ("data.csv", f, "text/csv")},
            headers=auth_headers(uid),
        )
    assert r.status_code == 200, f"Upload failed: {r.text}"
    return r.json()["dataset_id"]


class TestUserIsolation:

    def test_analyze_other_user_dataset(self, client, tmp_storage):
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post("/api/analyze",
                        json={"dataset_id": ds_id},
                        headers=auth_headers("user_b"))
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_preprocess_other_user_dataset(self, client, tmp_storage):
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post(
            "/api/preprocess",
            json={
                "dataset_id": ds_id,
                "config": {
                    "missing_values": "mean",
                    "categorical_encoding": "label",
                    "scaling": "none",
                },
            },
            headers=auth_headers("user_b"),
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_train_success_for_owner(self, client, tmp_storage):
        """Sanity check: user_a can train on their own dataset."""
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post(
            "/api/train",
            json={
                "dataset_id": ds_id,
                "target_column": "target",
                "task_type": "classification",
            },
            headers=auth_headers("user_a"),
        )
        assert r.status_code == 200, f"Training failed: {r.text}"
        assert "model_id" in r.json()

    def test_predict_other_user_dataset_rejected(self, client, tmp_storage):
        """User B cannot predict using user A's dataset_id."""
        _, storage_tmp = tmp_storage
        csv_a = make_csv(storage_tmp, name="user_a_data.csv")
        csv_b = make_csv(storage_tmp, name="user_b_data.csv")

        ds_id_a = _upload(client, "user_a", csv_a)
        ds_id_b = _upload(client, "user_b", csv_b)

        # Train a model for user_a
        r = client.post("/api/train",
                        json={"dataset_id": ds_id_a,
                              "target_column": "target",
                              "task_type": "classification"},
                        headers=auth_headers("user_a"))
        assert r.status_code == 200, r.text
        model_id = r.json()["model_id"]

        # User B tries to predict with user A's model_id but their own dataset
        # → model_id belongs to user_a → store 404
        r = client.post("/api/predict",
                        json={"dataset_id": ds_id_b, "model_id": model_id},
                        headers=auth_headers("user_b"))
        assert r.status_code in (403, 404), f"Expected 403/404, got {r.status_code}: {r.text}"

    def test_download_own_model(self, client, tmp_storage):
        """User_a can download their own model."""
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post("/api/train",
                        json={"dataset_id": ds_id,
                              "target_column": "target",
                              "task_type": "classification"},
                        headers=auth_headers("user_a"))
        assert r.status_code == 200, r.text
        model_id = r.json()["model_id"]

        r = client.get(f"/api/download-model?model_id={model_id}",
                       headers=auth_headers("user_a"))
        assert r.status_code == 200, f"Own model download failed: {r.status_code}: {r.text}"

    def test_download_other_user_model_rejected(self, client, tmp_storage):
        """User B cannot download user A's model."""
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post("/api/train",
                        json={"dataset_id": ds_id,
                              "target_column": "target",
                              "task_type": "classification"},
                        headers=auth_headers("user_a"))
        assert r.status_code == 200, r.text
        model_id = r.json()["model_id"]

        r = client.get(f"/api/download-model?model_id={model_id}",
                       headers=auth_headers("user_b"))
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_stop_other_user_run(self, client, tmp_storage, fresh_queue):
        """User B cannot stop user A's run."""
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post(
            "/api/runs",
            json={
                "nodes": [{"id": "n1", "type": "upload",
                            "data": {"dataset_id": ds_id}}],
                "edges": [],
            },
            headers=auth_headers("user_a"),
        )
        assert r.status_code == 202, r.text
        run_id = r.json()["run_id"]

        r = client.post(f"/api/runs/{run_id}/stop",
                        headers=auth_headers("user_b"))
        assert r.status_code in (403, 404), f"Expected 403/404, got {r.status_code}: {r.text}"

    def test_get_other_user_run(self, client, tmp_storage, fresh_queue):
        """User B cannot GET user A's run."""
        _, storage_tmp = tmp_storage
        csv = make_csv(storage_tmp)
        ds_id = _upload(client, "user_a", csv)

        r = client.post(
            "/api/runs",
            json={
                "nodes": [{"id": "n1", "type": "upload",
                            "data": {"dataset_id": ds_id}}],
                "edges": [],
            },
            headers=auth_headers("user_a"),
        )
        assert r.status_code == 202
        run_id = r.json()["run_id"]

        r = client.get(f"/api/runs/{run_id}",
                       headers=auth_headers("user_b"))
        assert r.status_code in (403, 404), f"Expected 403/404, got {r.status_code}: {r.text}"

    def test_path_traversal_rejected(self, client, tmp_storage):
        """Path traversal in dataset_id must be blocked."""
        r = client.post(
            "/api/analyze",
            json={"dataset_id": "../../etc/passwd"},
            headers=auth_headers("user_a"),
        )
        assert r.status_code in (400, 403, 404), f"Expected 400/403/404, got {r.status_code}"
