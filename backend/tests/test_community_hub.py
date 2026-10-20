import pytest
from starlette.testclient import TestClient
from app import app
from services.model_trainer import train_models
import pandas as pd
import numpy as np


@pytest.fixture
def client():
    return TestClient(app)


def test_community_pipelines_list(client):
    response = client.get("/api/community/pipelines")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 4

    # Verify initial regression and classification pipelines exist
    titles = [p["title"] for p in data]
    assert any("Regression" in title for title in titles)
    assert any("Titanic" in title for title in titles)


def test_community_publish_star_and_fork(client):
    new_pipeline = {
        "title": "Customer Churn Prediction Pipeline",
        "description": "Production gradient boosted tree pipeline for subscription churn forecasting.",
        "author": "tester_dev",
        "task_type": "classification",
        "tags": ["churn", "saas", "xgboost"],
        "nodes": [
            {"id": "n1", "type": "upload", "data": {"label": "Upload Dataset"}},
            {"id": "n2", "type": "scale", "data": {"label": "Scale Features", "scaling": "standard"}},
            {"id": "n3", "type": "randomForest", "data": {"label": "Random Forest", "target_column": "churn"}},
            {"id": "n4", "type": "prediction", "data": {"label": "Prediction"}},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
        ],
    }

    # 1. Publish
    resp = client.post("/api/community/pipelines", json=new_pipeline, headers={"Authorization": "Bearer test_user_hub"})
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "success"
    pipe_id = res_data["pipeline"]["id"]
    assert pipe_id.startswith("pipe-")

    # 2. Get by ID
    get_resp = client.get(f"/api/community/pipelines/{pipe_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == "Customer Churn Prediction Pipeline"

    # 3. Star pipeline
    star_resp = client.post(f"/api/community/pipelines/{pipe_id}/star", headers={"Authorization": "Bearer test_user_hub"})
    assert star_resp.status_code == 200
    assert star_resp.json()["status"] == "success"

    # 4. Fork pipeline with custom dataset attached
    fork_resp = client.post(
        f"/api/community/pipelines/{pipe_id}/fork",
        json={"target_dataset_id": "my_dataset_999", "dataset_name": "customer_data.csv"}
    )
    assert fork_resp.status_code == 200
    fork_data = fork_resp.json()["pipeline"]
    assert fork_data["id"].startswith("fork-")
    upload_node = next(n for n in fork_data["nodes"] if n["type"] == "upload")
    assert upload_node["data"]["dataset_id"] == "my_dataset_999"
    assert upload_node["data"]["file_name"] == "customer_data.csv"


def test_accurate_regression_training_and_metrics(tmp_path):
    """Verify regression training produces accurate continuous predictions and valid R², MSE, MAE metrics."""
    np.random.seed(42)
    n = 200
    X = pd.DataFrame({
        "sqft": np.random.uniform(500, 3500, n),
        "bedrooms": np.random.randint(1, 5, n),
        "age": np.random.uniform(1, 50, n),
    })
    # Realistic continuous price formula: $150/sqft + $25k/bedroom - $1k/age + noise
    y = 150.0 * X["sqft"] + 25000.0 * X["bedrooms"] - 1000.0 * X["age"] + np.random.normal(0, 5000, n)
    y = pd.Series(y, name="price")

    artifact_dir = str(tmp_path / "regression_test_model")

    results = train_models(
        X=X,
        y=y,
        task_type="regression",
        selected_model="Linear Regression",
        artifact_dir=artifact_dir,
    )

    assert results["best_model"] == "Linear Regression"
    eval_metrics = results["evaluation"]
    assert "r2" in eval_metrics
    assert "mse" in eval_metrics
    assert "rmse" in eval_metrics
    assert "mae" in eval_metrics

    # Model should have high R^2 on this linear relation (typically > 0.95)
    assert eval_metrics["r2"] > 0.90, f"Expected R² > 0.90, got {eval_metrics['r2']}"
    assert eval_metrics["rmse"] > 0
    assert eval_metrics["mae"] > 0
    assert len(results["test_predictions"]) > 0
