"""
Tests: Pipeline executor — validation errors, caching, stop support.
"""
import os
import threading
import tempfile
import time
import pytest
import pandas as pd

from services.pipeline_executor import validate_graph, execute_pipeline
from services.pipeline_executor import _cache, _cache_lock, _node_hash
from services.store import LocalDiskStore


def clear_cache():
    with _cache_lock:
        _cache.clear()


def make_store(tmp_path):
    return LocalDiskStore(root=str(tmp_path / "storage"))


def store_csv(store, uid, ds_id, tmp_path):
    """Write a CSV and register it correctly (with 'file' key in meta)."""
    df = pd.DataFrame({
        "sepal_length": [5.1 + i * 0.01 for i in range(20)],
        "target": [i % 3 for i in range(20)],
    })
    fname = f"{ds_id}.csv"
    csv_path = tmp_path / fname
    df.to_csv(csv_path, index=False)
    store.save_dataset(uid, ds_id, str(csv_path))
    store.update_dataset_meta(uid, ds_id, {"file": fname, "original_name": fname})


# ── Validation tests ──────────────────────────────────────────────────────────

class TestValidation:

    def test_empty_graph(self):
        errors = validate_graph([], [])
        assert any(e["type"] == "empty_graph" for e in errors)

    def test_cycle_detection(self):
        nodes = [
            {"id": "a", "type": "fillMissing", "data": {}},
            {"id": "b", "type": "fillMissing", "data": {}},
        ]
        edges = [
            {"source": "a", "target": "b"},
            {"source": "b", "target": "a"},  # cycle
        ]
        errors = validate_graph(nodes, edges)
        assert any(e["type"] == "cycle" for e in errors), errors

    def test_disconnected_model_node(self):
        """Model node with no parents should error."""
        nodes = [{"id": "n1", "type": "randomForest",
                  "data": {"target_column": "y"}}]
        errors = validate_graph(nodes, [])
        assert any(e["type"] == "disconnected_node" for e in errors), errors

    def test_missing_target_column(self):
        """Model node without target_column param should error."""
        nodes = [
            {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}},
            {"id": "n2", "type": "randomForest", "data": {}},  # no target
        ]
        edges = [{"source": "n1", "target": "n2"}]
        errors = validate_graph(nodes, edges)
        assert any(e["type"] == "missing_param" for e in errors), errors

    def test_upload_node_no_file(self):
        nodes = [{"id": "n1", "type": "upload", "data": {}}]
        errors = validate_graph(nodes, [])
        assert any(e["type"] == "missing_input" for e in errors), errors

    def test_upload_with_dataset_id_valid(self):
        """Upload node with dataset_id should pass validation."""
        nodes = [{"id": "n1", "type": "upload", "data": {"dataset_id": "abc123"}}]
        errors = validate_graph(nodes, [])
        assert errors == [], errors

    def test_select_columns_no_columns(self):
        nodes = [
            {"id": "n1", "type": "upload", "data": {"file_name": "x.csv"}},
            {"id": "n2", "type": "selectColumns", "data": {}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        errors = validate_graph(nodes, edges)
        assert any(e["type"] == "missing_param" for e in errors), errors

    def test_valid_simple_pipeline(self):
        nodes = [
            {"id": "n1", "type": "upload", "data": {"file_name": "data.csv"}},
            {"id": "n2", "type": "randomForest",
             "data": {"target_column": "y"}},
        ]
        edges = [{"source": "n1", "target": "n2"}]
        errors = validate_graph(nodes, edges)
        assert errors == [], errors

    def test_unknown_node_type(self):
        nodes = [{"id": "n1", "type": "lolWat", "data": {}}]
        errors = validate_graph(nodes, [])
        assert any(e["type"] == "unknown_node_type" for e in errors), errors


# ── Caching tests ─────────────────────────────────────────────────────────────

class TestCaching:

    def test_same_node_same_hash(self):
        node = {"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}}
        assert _node_hash(node, []) == _node_hash(node, [])

    def test_different_param_different_hash(self):
        n1 = {"id": "n1", "type": "fillMissing", "data": {"missing_values": "mean"}}
        n2 = {"id": "n1", "type": "fillMissing", "data": {"missing_values": "median"}}
        assert _node_hash(n1, []) != _node_hash(n2, [])

    def test_different_upstream_different_hash(self):
        node = {"id": "n1", "type": "fillMissing", "data": {}}
        assert _node_hash(node, ["aaa"]) != _node_hash(node, ["bbb"])

    def test_cached_node_skipped(self, tmp_path):
        """Same graph run twice: second run should report cache hits."""
        clear_cache()
        store = make_store(tmp_path)
        store_csv(store, "u1", "ds1", tmp_path)

        nodes = [{"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}}]
        edges = []

        r1 = execute_pipeline({"nodes": nodes, "edges": edges},
                               uid="u1", run_id="run1", store=store)
        assert r1["status"] == "success", r1

        r2 = execute_pipeline({"nodes": nodes, "edges": edges},
                               uid="u1", run_id="run2", store=store)
        assert r2["status"] == "success", r2
        assert r2["results"][0].get("cached") is True
        clear_cache()


# ── Stop support tests ────────────────────────────────────────────────────────

class TestStopSupport:

    def test_stop_flag_halts_pipeline(self, tmp_path):
        """Setting the cancel flag BEFORE execution should halt immediately."""
        clear_cache()
        store = make_store(tmp_path)
        store_csv(store, "u1", "ds1", tmp_path)

        cancel = threading.Event()
        cancel.set()  # already cancelled

        nodes = [{"id": "n1", "type": "upload", "data": {"dataset_id": "ds1"}}]
        r = execute_pipeline(
            {"nodes": nodes, "edges": []},
            uid="u1", run_id="run-stop", store=store, cancel_flag=cancel,
        )
        assert r["status"] == "stopped", r
        clear_cache()

    def test_stop_via_queue(self):
        """Queue.stop_job should set cancel_flag and transition to Stopped."""
        from services.job_queue import InProcessQueue, STOPPED

        q = InProcessQueue()
        events = {
            "started": threading.Event(),
            "can_finish": threading.Event(),
        }

        def slow_fn(job):
            events["started"].set()
            events["can_finish"].wait(timeout=5)
            return {"done": True}

        job = q.enqueue("u1", {}, slow_fn)
        events["started"].wait(timeout=3)

        q.stop_job(job.run_id, "u1")
        assert job.cancel_flag.is_set()
        events["can_finish"].set()
        time.sleep(0.3)
        assert job.state == STOPPED
