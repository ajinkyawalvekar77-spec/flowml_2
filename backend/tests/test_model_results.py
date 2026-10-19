import asyncio
import joblib
import numpy as np
import pandas as pd
import pytest

from services.model_trainer import train_models
from services.predictor import predict_with_store
from services.store import LocalDiskStore
from routes.predict import PredictRequest, generate_predictions
from routes.train import TrainRequest, train


def _persist_artifacts(artifact_dir, store, model_id, metadata):
    for filename in artifact_dir.iterdir():
        store.save_artifact("user-1", model_id, filename.name, str(filename))
    metadata_path = artifact_dir / "model_meta.joblib"
    joblib.dump(metadata, metadata_path)
    store.save_artifact("user-1", model_id, metadata_path.name, str(metadata_path))


def test_classification_evaluates_holdout_and_predicts_from_saved_model(tmp_path):
    X = pd.DataFrame({
        "signal": np.tile([0.0, 1.0], 60),
        "kind": np.tile(["a", "b", "a", "b"], 30),
    })
    y = pd.Series(np.tile(["negative", "positive"], 60), name="label")
    artifact_dir = tmp_path / "classifier"
    artifact_dir.mkdir()

    trained = train_models(
        X, y, "classification", selected_model="Random Forest",
        model_parameters={"n_estimators": 12, "max_depth": 4},
        preprocessing_config={
            "categorical_encoding": "onehot",
            "scaling": "standard",
            "missing_values": "mean",
        },
        artifact_dir=str(artifact_dir),
    )

    assert trained["best_model"] == "Random Forest"
    assert trained["model_selection"] == "configured"
    assert trained["evaluation"]["accuracy"] >= 0
    assert len(trained["evaluation"]["confusion_matrix"]) == 2
    assert len(trained["evaluation"]["class_metrics"]) == 2
    assert trained["model_parameters"]["n_estimators"] == 12
    assert (artifact_dir / "model_bundle.joblib").exists()

    store = LocalDiskStore(root=str(tmp_path / "storage"))
    model_id = "classifier-1"
    _persist_artifacts(artifact_dir, store, model_id, {
        "target_column": "label",
        "task_type": "classification",
        "algorithm": trained["best_model"],
        "input_schema": trained["input_schema"],
    })
    predicted = predict_with_store(
        pd.DataFrame({"signal": [0, 1], "kind": ["a", "b"]}),
        "user-1", model_id, store,
    )
    assert len(predicted["predictions"]) == 2
    assert len(predicted["probabilities"]) == 2
    assert predicted["evaluation"] is None
    assert "unavailable" in predicted["evaluation_message"]

    labeled = predict_with_store(
        pd.DataFrame({
            "signal": [0, 1, 0, 1],
            "kind": ["a", "b", "a", "b"],
            "label": ["negative", "positive", "negative", "positive"],
        }),
        "user-1", model_id, store,
    )
    assert labeled["evaluation"]["rows"] == 4
    assert len(labeled["evaluation"]["confusion_matrix"]) == 2

    with pytest.raises(ValueError, match="Input schema"):
        predict_with_store(
            pd.DataFrame({"signal": [0], "extra": ["value"]}),
            "user-1", model_id, store,
        )


def test_regression_returns_all_required_metrics_and_labeled_test_evaluation(tmp_path):
    X = pd.DataFrame({"x": np.arange(100, dtype=float), "offset": np.ones(100)})
    y = pd.Series(4.5 * X["x"] - 2.0, name="target")
    artifact_dir = tmp_path / "regressor"
    artifact_dir.mkdir()

    trained = train_models(
        X, y, "regression", selected_model="Linear Regression",
        artifact_dir=str(artifact_dir),
    )
    assert trained["best_model"] == "Linear Regression"
    assert {"mae", "mse", "rmse", "r2"} <= trained["evaluation"].keys()
    assert trained["evaluation"]["r2"] == pytest.approx(1.0)

    store = LocalDiskStore(root=str(tmp_path / "storage"))
    model_id = "regressor-1"
    _persist_artifacts(artifact_dir, store, model_id, {
        "target_column": "target",
        "task_type": "regression",
        "algorithm": trained["best_model"],
        "input_schema": trained["input_schema"],
    })
    test_data = pd.DataFrame({"x": [10.0, 20.0], "offset": [1.0, 1.0], "target": [43.0, 88.0]})
    predicted = predict_with_store(test_data, "user-1", model_id, store)
    assert predicted["predictions"] == pytest.approx([43.0, 88.0])
    assert predicted["evaluation"]["rows"] == 2
    assert predicted["evaluation"]["mae"] == pytest.approx(0.0)


def test_training_route_persists_model_metadata_and_bundle(tmp_path):
    store = LocalDiskStore(root=str(tmp_path / "storage"))
    dataset_path = tmp_path / "training.csv"
    pd.DataFrame({
        "x": np.arange(80, dtype=float),
        "target": np.tile(["no", "yes"], 40),
    }).to_csv(dataset_path, index=False)
    store.save_dataset("user-1", "data-1", str(dataset_path))

    result = asyncio.run(train(
        TrainRequest(
            dataset_id="data-1",
            target_column="target",
            task_type="classification",
            model_name="Logistic Regression",
            model_parameters={"C": 0.5},
        ),
        uid="user-1",
        store=store,
    ))

    assert result["best_model"] == "Logistic Regression"
    assert result["model_selection"] == "configured"
    assert result["model_id"]
    bundle = store.get_artifact_path("user-1", result["model_id"], "model_bundle.joblib")
    metadata = joblib.load(store.get_artifact_path("user-1", result["model_id"], "model_meta.joblib"))
    assert bundle
    assert metadata["algorithm"] == "Logistic Regression"
    assert metadata["training_status"] == "completed"
    prediction = asyncio.run(generate_predictions(
        PredictRequest(model_id=result["model_id"], rows=[{"x": 12.0}, {"x": 42.0}]),
        uid="user-1",
        store=store,
    ))
    assert len(prediction["predictions"]) == 2
    assert len(prediction["probabilities"]) == 2
    assert prediction["evaluation"] is None

    training_rows = asyncio.run(generate_predictions(
        PredictRequest(model_id=result["model_id"], dataset_id="data-1"),
        uid="user-1",
        store=store,
    ))
    assert training_rows["evaluation"] is None
    assert "training dataset" in training_rows["evaluation_message"]
