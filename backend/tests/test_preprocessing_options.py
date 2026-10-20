import numpy as np
import pandas as pd
import pytest

from services.model_trainer import train_models
from services.preprocessing import apply_transformers, preprocess_data


def test_manual_column_options_apply_only_to_selected_features():
    frame = pd.DataFrame({
        "numeric": [0.0, 10.0, 20.0],
        "numeric_other": [100.0, 200.0, 300.0],
        "category": ["a", "b", "a"],
        "category_other": ["x", "y", "z"],
        "target": [0, 1, 0],
    })

    processed, _ = preprocess_data(frame, {
        "target_column": "target",
        "missing_values": "none",
        "categorical_encoding": "label",
        "encoding_columns": ["category"],
        "scaling": "minmax",
        "scaling_columns": ["numeric"],
    })

    assert processed["category"].tolist() == [0, 1, 0]
    assert processed["category_other"].tolist() == ["x", "y", "z"]
    assert processed["numeric"].tolist() == [0.0, 0.5, 1.0]
    assert processed["numeric_other"].tolist() == [100.0, 200.0, 300.0]
    assert processed["target"].tolist() == [0, 1, 0]


def test_automatic_columns_and_manual_column_retention_work():
    frame = pd.DataFrame({
        "keep": [1, 2],
        "drop": [3, 4],
        "target": [0, 1],
    })

    processed, _ = preprocess_data(frame, {
        "target_column": "target",
        "selected_columns": ["keep"],
        "missing_values": "none",
        "categorical_encoding": "none",
        "scaling": "none",
    })

    assert processed.columns.tolist() == ["keep", "target"]


def test_duplicate_selection_and_robust_scaling_are_applied():
    frame = pd.DataFrame({
        "key": [1, 1, 2],
        "unselected": [10, 20, 30],
        "value": [0.0, 1.0, 100.0],
        "target": [0, 0, 1],
    })

    processed, _ = preprocess_data(frame, {
        "target_column": "target",
        "remove_duplicates": True,
        "duplicate_columns": ["key"],
        "missing_values": "none",
        "categorical_encoding": "none",
        "scaling": "robust",
        "scaling_columns": ["value"],
    })

    assert processed["key"].tolist() == [1, 2]
    assert processed["unselected"].tolist() == [10, 30]
    assert processed["value"].tolist() == pytest.approx([-1.0, 1.0])


def test_selected_columns_are_applied_again_to_inference_data():
    training = pd.DataFrame({
        "selected": [0.0, 2.0, 4.0],
        "ignored": [100.0, 200.0, 300.0],
        "target": [0, 1, 0],
    })
    _, transformers = preprocess_data(training, {
        "target_column": "target",
        "selected_columns": ["selected"],
        "missing_values": "none",
        "categorical_encoding": "none",
        "scaling": "standard",
        "scaling_columns": ["selected"],
    })

    transformed = apply_transformers(training.drop(columns=["target"]), transformers)
    assert transformed.columns.tolist() == ["selected"]
    assert transformed["selected"].tolist() == pytest.approx([-1.224744871391589, 0.0, 1.224744871391589])


def test_training_uses_requested_holdout_ratio_and_seed(tmp_path):
    features = pd.DataFrame({"value": np.arange(100, dtype=float)})
    target = pd.Series(np.tile([0, 1], 50))
    result = train_models(
        features,
        target,
        "classification",
        selected_model="Decision Tree",
        test_size=0.3,
        random_state=13,
        artifact_dir=str(tmp_path),
    )

    assert result["train_size"] == 70
    assert result["test_size"] == 30
