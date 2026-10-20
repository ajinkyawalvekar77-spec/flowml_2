"""
Tests: New ML node types — removeDuplicates, selectColumns, splitData, kmeans.
Also: aiDecision, explainableAi, report via executor.
"""
import os
import threading
import tempfile
import pytest
import pandas as pd
import numpy as np

from services.pipeline_executor import execute_pipeline, validate_graph
from services.pipeline_executor import _cache, _cache_lock
from services.store import LocalDiskStore


def clear_cache():
    with _cache_lock:
        _cache.clear()


def make_store(tmp_path):
    return LocalDiskStore(root=str(tmp_path / "storage"))


def store_csv(store, uid, ds_id, tmp_path, df=None):
    """Helper: write a DataFrame to CSV and register it in the store correctly."""
    if df is None:
        df = pd.DataFrame({
            "a": [1.0, 2.0, 2.0, 3.0, 4.0, 5.0] * 10,
            "b": [10.0, 20.0, 20.0, 30.0, 40.0, 50.0] * 10,
            "target": [0, 1, 1, 0, 1, 0] * 10,
        })
    fname = f"{ds_id}.csv"
    csv_path = tmp_path / fname
    df.to_csv(csv_path, index=False)
    store.save_dataset(uid, ds_id, str(csv_path))
    # update_dataset_meta sets the 'file' key used by get_dataset_path
    store.update_dataset_meta(uid, ds_id, {
        "file": fname,
        "original_name": fname,
    })


def _pipeline(store, uid, nodes, edges, run_id="test-run"):
    clear_cache()
    return execute_pipeline(
        {"nodes": nodes, "edges": edges},
        uid=uid, run_id=run_id, store=store,
    )


# ── removeDuplicates ──────────────────────────────────────────────────────────

class TestRemoveDuplicates:

    def test_duplicates_removed(self, tmp_path):
        store = make_store(tmp_path)
        store_csv(store, "u1", "ds1", tmp_path)

        nodes = [
            {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}},
            {"id": "n2", "type": "removeDuplicates", "data": {}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        r = _pipeline(store, "u1", nodes, edges, "r1")

        assert r["status"] == "success", r
        dedup = next(x for x in r["results"] if x["type"] == "removeDuplicates")
        assert "Removed" in dedup["message"]


# ── selectColumns ─────────────────────────────────────────────────────────────

class TestSelectColumns:

    def test_select_valid_columns(self, tmp_path):
        store = make_store(tmp_path)
        store_csv(store, "u1", "ds1", tmp_path)

        nodes = [
            {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}},
            {"id": "n2", "type": "selectColumns", "data": {"columns": ["a", "target"]}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        r = _pipeline(store, "u1", nodes, edges, "r2")
        assert r["status"] == "success", r

    def test_select_missing_column_fails(self, tmp_path):
        store = make_store(tmp_path)
        store_csv(store, "u1", "ds1", tmp_path)

        nodes = [
            {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}},
            {"id": "n2", "type": "selectColumns", "data": {"columns": ["nonexistent_col"]}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        r = _pipeline(store, "u1", nodes, edges, "r3")
        failed = [x for x in r["results"] if x["status"] == "error"]
        assert len(failed) > 0

    def test_select_columns_validation_error_when_empty(self):
        nodes = [
            {"id": "n1", "type": "upload", "data": {"file_name": "x.csv"}},
            {"id": "n2", "type": "selectColumns", "data": {}},
        ]
        errors = validate_graph(nodes, [{"source": "n1", "target": "n2"}])
        assert any(e["type"] == "missing_param" for e in errors)


# ── splitData ─────────────────────────────────────────────────────────────────

class TestSplitData:

    def test_split_produces_train_test(self, tmp_path):
        store = make_store(tmp_path)
        df = pd.DataFrame({
            "a": range(100), "b": range(100),
            "target": [i % 2 for i in range(100)],
        })
        store_csv(store, "u1", "ds1", tmp_path, df=df)

        nodes = [
            {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}},
            {"id": "n2", "type": "preview", "data": {}},
            {"id": "n3", "type": "splitData", "data": {"test_size": 0.2, "seed": 42}},
        ]
        edges = [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n3"}]
        r = _pipeline(store, "u1", nodes, edges, "r4")
        assert r["status"] == "success", r
        split_result = next(x for x in r["results"] if x["type"] == "splitData")
        assert "train" in split_result["message"].lower() or "/" in split_result["message"]


# ── kmeans ────────────────────────────────────────────────────────────────────

class TestKMeans:

    def test_kmeans_runs_and_has_silhouette(self):
        from services.pipeline_executor import _run_kmeans
        df = pd.DataFrame({
            "x": [1.0, 1.1, 1.2, 10.0, 10.1, 10.2, 5.0, 5.1, 5.2],
            "y": [1.0, 1.1, 1.2, 10.0, 10.1, 10.2, 5.0, 5.1, 5.2],
        })
        result = _run_kmeans(df, {"k": 3, "seed": 42})
        assert result["task_type"] == "clustering"
        assert result["silhouette_score"] is not None

    def test_kmeans_via_pipeline(self, tmp_path):
        store = make_store(tmp_path)
        df = pd.DataFrame({
            "x": [float(i) for i in range(30)],
            "y": [float(i % 5) for i in range(30)],
        })
        store_csv(store, "u1", "ds1", tmp_path, df=df)

        nodes = [
            {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}},
            {"id": "n2", "type": "kmeans", "data": {"k": 3, "seed": 42}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        r = _pipeline(store, "u1", nodes, edges, "r5")
        assert r["status"] == "success", r
        km_result = next(x for x in r["results"] if x["type"] == "kmeans")
        assert km_result["status"] == "completed"


# ── aiDecision ────────────────────────────────────────────────────────────────

class TestAiDecision:

    def test_ai_decision_trains_and_recommends(self):
        from services.pipeline_executor import _run_ai_decision
        from services.data_analyzer import analyze_dataset
        df = pd.DataFrame({
            "a": [float(i) for i in range(50)],
            "b": [float(i % 7) for i in range(50)],
            "target": [i % 2 for i in range(50)],
        })
        analysis = analyze_dataset(df)
        result = _run_ai_decision(df, analysis, "target", "classification")
        assert "best_model" in result
        assert "recommended_models" in result


# ── report ────────────────────────────────────────────────────────────────────

class TestReport:

    def test_report_generates_html(self):
        from services.pipeline_executor import _generate_report
        ctx = {
            "df": pd.DataFrame({"a": [1, 2], "target": [0, 1]}),
            "train_results": {
                "models": [{"model_name": "RF", "accuracy": 0.95}],
                "best_model": "RF",
            },
            "predictions": [0, 1, 0, 1],
        }
        html = _generate_report(ctx)
        assert "<html" in html
        assert "RF" in html
        assert "4" in html  # 4 predictions


# ── explainableAi ─────────────────────────────────────────────────────────────

class TestExplainableAi:

    def test_permutation_importance_returned(self, tmp_path):
        from services.pipeline_executor import _run_explainability
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        import joblib

        store = make_store(tmp_path)

        X = pd.DataFrame({
            "a": np.random.randn(50),
            "b": np.random.randn(50),
        })
        y = np.array([i % 2 for i in range(50)])
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        model = RandomForestClassifier(n_estimators=5, random_state=42)
        model.fit(X_train, y_train)

        # Windows-safe: write then immediately copy into store, no unlink while open
        model_tmp = tempfile.mktemp(suffix=".joblib")
        test_tmp  = tempfile.mktemp(suffix=".joblib")
        try:
            joblib.dump(model, model_tmp)
            joblib.dump((X_test, y_test), test_tmp)
            store.save_artifact("u1", "m1", "best_model.joblib", model_tmp)
            store.save_artifact("u1", "m1", "test_data.joblib",  test_tmp)
        finally:
            for p in [model_tmp, test_tmp]:
                try:
                    os.unlink(p)
                except OSError:
                    pass  # Windows may still hold handle; it's a temp file, OS cleans up

        ctx = {"X_test": X_test, "y_test": y_test}
        result = _run_explainability(store, "u1", "m1", ctx)

        assert "top_features" in result, result
        assert len(result["top_features"]) > 0
        assert "feature" in result["top_features"][0]
        assert "importance" in result["top_features"][0]
