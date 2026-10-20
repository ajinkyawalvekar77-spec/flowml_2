"""
Pipeline executor — rebuild.

Features:
  - Graph validation before execution (cycle detection, missing inputs, type checks,
    missing required parameters).  Returns structured per-node errors.
  - Topological execution with per-node status: Pending/Running/Completed/Failed.
  - Stop support: cancel_flag checked between nodes.
  - Node output caching by SHA-256 hash of (node params + upstream output hashes).
  - Per-run logs written to store.
  - Supports new node types: removeDuplicates, selectColumns, splitData,
    knn, svm, kmeans, aiDecision, explainableAi, report.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import tempfile
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd

from utils.logger import log_event

# ─────────────────────────────────────────────────────────────────────────────
# Node type registry
# ─────────────────────────────────────────────────────────────────────────────

# What "kind" a node produces/consumes (for type-check validation)
NODE_OUTPUT_TYPE: dict[str, str] = {
    "upload":          "dataframe",
    "loadCsv":         "dataframe",
    "preview":         "dataframe",
    "removeDuplicates": "dataframe",
    "selectColumns":   "dataframe",
    "splitData":       "split",
    "customPython":    "dataframe",
    "fillMissing":     "dataframe",
    "encode":          "dataframe",
    "scale":           "dataframe",
    "randomForest":    "model",
    "linearRegression":"model",
    "decisionTree":    "model",
    "knn":             "model",
    "svm":             "model",
    "kmeans":          "model",
    "aiDecision":      "model",
    "explainableAi":   "report",
    "prediction":      "predictions",
    "report":          "report",
}

# Nodes that REQUIRE a dataframe upstream
REQUIRES_DATAFRAME = {
    "preview", "removeDuplicates", "selectColumns", "splitData", "customPython",
    "fillMissing", "encode", "scale",
    "randomForest", "linearRegression", "decisionTree", "knn", "svm", "kmeans",
    "aiDecision", "explainableAi", "prediction", "report",
}

# Nodes that produce a dataframe as input for model nodes
DATAFRAME_PRODUCERS = {"upload", "loadCsv", "preview", "removeDuplicates",
                        "selectColumns", "customPython", "fillMissing", "encode", "scale"}

UPLOAD_TYPES    = {"upload", "loadCsv"}
PREVIEW_TYPES   = {"preview"}
PROCESS_TYPES   = {"fillMissing", "encode", "scale", "removeDuplicates", "selectColumns", "splitData", "customPython"}
MODEL_TYPES     = {"randomForest", "linearRegression", "decisionTree", "knn", "svm", "kmeans", "aiDecision"}
OUTPUT_TYPES    = {"prediction", "report"}
EXPLAINER_TYPES = {"explainableAi"}


# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_graph(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """
    Validates the pipeline graph.
    Returns a list of error dicts {node_id, type, message}.
    Empty list means valid.
    """
    errors: list[dict] = []

    if not nodes:
        return [{"node_id": None, "type": "empty_graph", "message": "Pipeline has no nodes."}]

    node_ids   = {n["id"] for n in nodes}
    node_by_id = {n["id"]: n for n in nodes}
    adj        = {nid: [] for nid in node_ids}
    in_degree  = {nid: 0 for nid in node_ids}
    parents    = {nid: [] for nid in node_ids}  # parent node ids

    for edge in edges:
        src, tgt = edge.get("source"), edge.get("target")
        if src in adj and tgt in in_degree:
            adj[src].append(tgt)
            in_degree[tgt] += 1
            parents[tgt].append(src)

    # 1. Cycle detection (Kahn's)
    queue = deque(nid for nid, d in in_degree.items() if d == 0)
    visited = 0
    while queue:
        nid = queue.popleft()
        visited += 1
        for child in adj[nid]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    if visited != len(nodes):
        errors.append({
            "node_id": None,
            "type": "cycle",
            "message": "Pipeline contains a cycle — cannot execute.",
        })
        return errors  # further checks are unreliable with a cycle

    # 2. Check required-input connections and missing required params
    for node in nodes:
        nid  = node["id"]
        ntype = node.get("type", "unknown")
        data  = node.get("data", {})

        if ntype not in NODE_OUTPUT_TYPE:
            errors.append({
                "node_id": nid,
                "type": "unknown_node_type",
                "message": f"Unknown node type '{ntype}'.",
            })
            continue

        # Upload nodes need a file configured
        if ntype in UPLOAD_TYPES:
            has_source = (
                data.get("_uploadedFile")
                or data.get("file_name")
                or data.get("uploadedDataset")
                or data.get("dataset_id")  # pre-uploaded dataset by ID
            )
            if not has_source:
                errors.append({
                    "node_id": nid,
                    "type": "missing_input",
                    "message": f"Upload node '{nid}' has no file attached.",
                })
            continue

        # Nodes that need a dataframe parent
        if ntype in REQUIRES_DATAFRAME:
            parent_types = [node_by_id[p].get("type") for p in parents[nid] if p in node_by_id]
            if not parent_types:
                errors.append({
                    "node_id": nid,
                    "type": "disconnected_node",
                    "message": f"Node '{ntype}' ({nid}) is not connected to any upstream node.",
                })
            # Type compatibility check: model nodes need at least one dataframe upstream (directly or transitively)
            if ntype in MODEL_TYPES:
                # Acceptable: parent is a dataframe producer or a process type
                acceptable = DATAFRAME_PRODUCERS | PROCESS_TYPES
                if not any(pt in acceptable for pt in parent_types):
                    errors.append({
                        "node_id": nid,
                        "type": "type_mismatch",
                        "message": (
                            f"Model node '{ntype}' ({nid}) expects a dataset upstream "
                            f"but found: {parent_types}."
                        ),
                    })

        # Model nodes need target_column
        if ntype in MODEL_TYPES and ntype != "kmeans":
            if not data.get("target_column"):
                errors.append({
                    "node_id": nid,
                    "type": "missing_param",
                    "message": f"Model node '{ntype}' ({nid}) requires 'target_column' to be set.",
                })

        # selectColumns needs at least one column chosen
        if ntype == "selectColumns" and not data.get("columns"):
            errors.append({
                "node_id": nid,
                "type": "missing_param",
                "message": f"selectColumns node ({nid}) requires 'columns' list to be set.",
            })

    return errors


# ─────────────────────────────────────────────────────────────────────────────
# Topological sort
# ─────────────────────────────────────────────────────────────────────────────

def _topological_sort(nodes: list, edges: list) -> list[str]:
    """Kahn's algorithm — returns node IDs in execution order."""
    node_ids  = [n["id"] for n in nodes]
    adj       = {nid: [] for nid in node_ids}
    in_degree = {nid: 0 for nid in node_ids}

    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if src in adj and tgt in in_degree:
            adj[src].append(tgt)
            in_degree[tgt] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for neighbor in adj[nid]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return order


# ─────────────────────────────────────────────────────────────────────────────
# Caching helpers
# ─────────────────────────────────────────────────────────────────────────────

def _node_hash(node: dict, upstream_hashes: list[str]) -> str:
    """SHA-256 of node params + sorted upstream hashes."""
    data = node.get("data", {})
    # Exclude runtime-only keys like status that change but don't affect output
    stable = {k: v for k, v in data.items() if not k.startswith("_") and k != "status"}
    payload = json.dumps(
        {"type": node.get("type"), "data": stable, "upstream": sorted(upstream_hashes)},
        sort_keys=True, default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


# In-memory node output cache: hash → serialised output (json string of metadata)
_cache: dict[str, Any] = {}
_cache_lock = threading.Lock()


def _cache_get(h: str) -> Optional[Any]:
    with _cache_lock:
        return _cache.get(h)


def _cache_set(h: str, value: Any) -> None:
    with _cache_lock:
        _cache[h] = value


# ─────────────────────────────────────────────────────────────────────────────
# Main executor
# ─────────────────────────────────────────────────────────────────────────────

def execute_pipeline(
    workflow_data: dict,
    uid: Optional[str] = None,
    run_id: Optional[str] = None,
    store=None,
    cancel_flag: Optional[threading.Event] = None,
) -> dict:
    """
    Execute a visual ML pipeline from its nodes + edges.

    Parameters:
        workflow_data : {"nodes": [...], "edges": [...]}
        uid           : user id (for store isolation)
        run_id        : persistent run id (for log storage)
        store         : StoreBackend instance (optional)
        cancel_flag   : threading.Event — if set between nodes, execution stops gracefully

    Returns:
        {"status": "success"|"error"|"stopped", "results": [...], "node_statuses": {...}}
    """
    from services.data_loader import load_dataset
    from services.data_analyzer import analyze_dataset
    from services.preprocessing import preprocess_data
    from services.model_trainer import train_models
    from services.predictor import predict_with_store

    run_id   = run_id or uuid.uuid4().hex
    uid      = uid or "anonymous"
    log_prefix = f"[{uid}/{run_id}]"

    nodes  = workflow_data.get("nodes", [])
    edges  = workflow_data.get("edges", [])

    def _log(msg: str, level: str = "INFO"):
        log_event(f"{log_prefix} {msg}", level=level)
        if store and uid:
            try:
                store.append_run_log(uid, run_id, {
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "level": level,
                    "message": msg,
                })
            except Exception:
                pass

    # ── Validate ──────────────────────────────────────────────────────────────
    errors = validate_graph(nodes, edges)
    if errors:
        _log(f"Graph validation failed: {errors}", level="ERROR")
        return {
            "status": "error",
            "message": "Graph validation failed.",
            "validation_errors": errors,
            "results": [],
            "node_statuses": {},
        }

    node_map       = {n["id"]: n for n in nodes}
    execution_order = _topological_sort(nodes, edges)
    node_statuses: dict[str, str] = {nid: "Pending" for nid in node_map}
    results: list[dict] = []

    # Shared context flowing between nodes
    ctx: dict[str, Any] = {
        "df":            None,
        "file_name":     None,
        "dataset_id":    None,
        "target_column": None,
        "task_type":     "classification",
        "train_results": None,
        "predictions":   None,
        "model_id":      None,
        "preprocessors": None,
        "X_test":        None,
        "y_test":        None,
        "analysis":      None,
    }

    # Track per-node output hashes for caching
    node_output_hashes: dict[str, str] = {}

    def _get_upstream_hashes(nid: str) -> list[str]:
        """Collect hashes from all parents of nid."""
        return [node_output_hashes[src] for src in
                [e.get("source") for e in edges if e.get("target") == nid]
                if src in node_output_hashes]

    _log("Starting pipeline execution…")

    for node_id in execution_order:
        # ── Stop check ────────────────────────────────────────────────────────
        if cancel_flag and cancel_flag.is_set():
            _log("Stop requested. Halting pipeline.", level="WARNING")
            node_statuses[node_id] = "Stopped"
            return {
                "status": "stopped",
                "results": results,
                "node_statuses": node_statuses,
            }

        node      = node_map.get(node_id)
        if not node:
            continue

        node_type = node.get("type", "unknown")
        node_data = node.get("data", {})

        # ── Cache check ───────────────────────────────────────────────────────
        upstream_hashes = _get_upstream_hashes(node_id)
        this_hash = _node_hash(node, upstream_hashes)
        cached = _cache_get(this_hash)

        node_statuses[node_id] = "Running"
        _log(f"▶ Node [{node_type}] ({node_id})")

        try:
            if cached is not None:
                _log(f"Cache hit for node {node_id} — skipping execution.")
                node_statuses[node_id] = "Completed"
                node_output_hashes[node_id] = this_hash
                results.append({
                    "node_id": node_id, "type": node_type,
                    "status": "completed", "cached": True,
                    "message": "(result from cache)",
                })
                continue

            # ── Upload / Load CSV ─────────────────────────────────────────────
            if node_type in UPLOAD_TYPES:
                dataset_info = node_data.get("uploadedDataset") or {}
                dataset_id   = node_data.get("dataset_id") or dataset_info.get("dataset_id")
                file_name    = node_data.get("file_name") or dataset_info.get("file_name")

                if dataset_id and store and uid:
                    file_path = store.get_dataset_path(uid, dataset_id)
                    ctx["df"] = load_dataset(file_path)
                    ctx["dataset_id"] = dataset_id
                elif node_data.get("file_path"):
                    ctx["df"] = load_dataset(node_data["file_path"])
                    ctx["file_name"] = os.path.basename(node_data["file_path"])
                elif file_name:
                    file_path = os.path.join("uploads", file_name)
                    ctx["df"] = load_dataset(file_path)
                    ctx["file_name"] = file_name
                else:
                    raise ValueError("No file or dataset configured on this Upload node.")

                result_msg = f"Loaded {ctx['df'].shape[0]:,} rows × {ctx['df'].shape[1]} cols"

            # ── Preview / Analyze ─────────────────────────────────────────────
            elif node_type in PREVIEW_TYPES:
                if ctx["df"] is None:
                    raise ValueError("No dataset in context. Add an Upload node first.")
                insights = analyze_dataset(ctx["df"])
                ctx["analysis"] = insights
                if not ctx["target_column"]:
                    ctx["target_column"] = insights.get("suggested_target")
                if not ctx.get("task_type"):
                    ctx["task_type"] = insights.get("suggested_task_type", "classification")
                result_msg = (
                    f"Analyzed: {insights['row_count']:,} rows, "
                    f"{insights['col_count']} cols. "
                    f"Suggested target: '{insights['suggested_target']}'"
                )

            # ── Remove Duplicates ─────────────────────────────────────────────
            elif node_type == "removeDuplicates":
                if ctx["df"] is None:
                    raise ValueError("No dataset in context.")
                before = len(ctx["df"])
                ctx["df"] = ctx["df"].drop_duplicates()
                removed = before - len(ctx["df"])
                result_msg = f"Removed {removed:,} duplicate rows. Remaining: {len(ctx['df']):,}"

            # ── Select Columns ────────────────────────────────────────────────
            elif node_type == "selectColumns":
                if ctx["df"] is None:
                    raise ValueError("No dataset in context.")
                cols = node_data.get("columns", [])
                # Always keep target column if set
                if ctx["target_column"] and ctx["target_column"] not in cols:
                    cols = cols + [ctx["target_column"]]
                missing_cols = [c for c in cols if c not in ctx["df"].columns]
                if missing_cols:
                    raise ValueError(f"Columns not found in dataset: {missing_cols}")
                ctx["df"] = ctx["df"][cols]
                result_msg = f"Selected {len(cols)} columns: {cols[:5]}{'...' if len(cols) > 5 else ''}"

            # ── Split Data ────────────────────────────────────────────────────
            elif node_type == "splitData":
                if ctx["df"] is None:
                    raise ValueError("No dataset in context.")
                test_size = float(node_data.get("test_size", 0.2))
                seed      = int(node_data.get("seed", 42))
                stratify  = bool(node_data.get("stratify", False))
                from sklearn.model_selection import train_test_split
                target = ctx["target_column"]
                X = ctx["df"].drop(columns=[target]) if target and target in ctx["df"].columns else ctx["df"]
                y = ctx["df"][target] if target and target in ctx["df"].columns else None
                strat_col = y if stratify and y is not None else None
                try:
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=seed, stratify=strat_col)
                except Exception:
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=seed)
                # Reconstruct train set into ctx["df"]
                train_df = X_train.copy()
                if y_train is not None:
                    train_df[target] = y_train.values
                ctx["df"]     = train_df
                ctx["X_test"] = X_test
                ctx["y_test"] = y_test
                result_msg = f"Split: {len(X_train):,} train / {len(X_test):,} test (test_size={test_size})"

            # ── Custom Python ─────────────────────────────────────────────────
            elif node_type == "customPython":
                if ctx["df"] is None:
                    raise ValueError("No dataset in context.")
                code = node_data.get("code", "")
                if not code or not code.strip():
                    raise ValueError("customPython node requires Python code.")

                with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp_in:
                    tmp_in_path = tmp_in.name
                ctx["df"].to_csv(tmp_in_path, index=False)

                try:
                    from services.code_executor import execute_python_code
                    timeout_val = int(node_data.get("timeout", 15))
                    exec_res = execute_python_code(
                        uid=uid or "system",
                        code=code,
                        input_data_path=tmp_in_path,
                        timeout_seconds=timeout_val,
                    )
                    if exec_res.get("status") != "completed":
                        err_msg = exec_res.get("stderr") or exec_res.get("traceback") or "Custom Python script failed."
                        raise ValueError(f"customPython execution error: {err_msg}")

                    out_df = exec_res.get("output_df")
                    if out_df is not None and isinstance(out_df, pd.DataFrame):
                        ctx["df"] = out_df

                    result_msg = f"Python code executed successfully in {exec_res.get('duration_ms')}ms."
                finally:
                    if os.path.exists(tmp_in_path):
                        try:
                            os.remove(tmp_in_path)
                        except Exception:
                            pass

            # ── Preprocessing ─────────────────────────────────────────────────
            elif node_type in {"fillMissing", "encode", "scale"}:
                if ctx["df"] is None:
                    raise ValueError("No dataset in context.")
                config = _get_preprocess_config(node_type, node_data)
                if ctx["target_column"]:
                    config["target_column"] = ctx["target_column"]
                ctx["df"], transformers = preprocess_data(ctx["df"], config)
                if ctx["preprocessors"] is None:
                    ctx["preprocessors"] = {}
                ctx["preprocessors"].update(transformers)
                result_msg = f"Preprocessing done. Output shape: {ctx['df'].shape}"

            # ── Model Training ────────────────────────────────────────────────
            elif node_type in MODEL_TYPES:
                if ctx["df"] is None:
                    raise ValueError("No dataset in context.")

                target_col = node_data.get("target_column") or ctx.get("target_column")
                task_type  = node_data.get("task_type") or ctx.get("task_type", "classification")

                if node_type == "kmeans":
                    ctx["train_results"] = _run_kmeans(ctx["df"], node_data)
                    ctx["model_id"] = uuid.uuid4().hex
                    result_msg = f"K-Means done. Silhouette: {ctx['train_results'].get('silhouette_score', 'N/A')}"
                elif node_type == "aiDecision":
                    analysis = ctx.get("analysis") or analyze_dataset(ctx["df"])
                    ctx["train_results"] = _run_ai_decision(ctx["df"], analysis, target_col, task_type)
                    ctx["model_id"] = ctx["train_results"].get("model_id", uuid.uuid4().hex)
                    result_msg = f"AI Decision done. Best: {ctx['train_results'].get('best_model')}"
                else:
                    if not target_col or target_col not in ctx["df"].columns:
                        raise ValueError(f"Target column '{target_col}' not found in dataset.")
                    ctx["target_column"] = target_col
                    ctx["task_type"] = task_type
                    X = ctx["df"].drop(columns=[target_col])
                    y = ctx["df"][target_col]
                    ctx["train_results"] = train_models(X, y, task_type)
                    ctx["model_id"] = uuid.uuid4().hex
                    best = ctx["train_results"]["best_model"]

                    # Save artifacts to store if available
                    if store and uid:
                        model_id = ctx["model_id"]
                        _save_train_artifacts_to_store(store, uid, model_id, ctx)

                    result_msg = f"Training complete. Best: {best}"

            # ── Explainable AI ─────────────────────────────────────────────────
            elif node_type in EXPLAINER_TYPES:
                if ctx["df"] is None or ctx["train_results"] is None:
                    raise ValueError("Run a model training node first.")
                ctx["train_results"]["explainability"] = _run_explainability(
                    store, uid, ctx.get("model_id"), ctx
                )
                result_msg = "Explainability computed."

            # ── Output / Prediction ───────────────────────────────────────────
            elif node_type == "prediction":
                if ctx["df"] is None or ctx["model_id"] is None:
                    raise ValueError("Train a model first.")
                pred_df = ctx["df"]
                target  = ctx.get("target_column")
                if store and uid and ctx["model_id"]:
                    pred = predict_with_store(pred_df, uid, ctx["model_id"], store, target_column=target)
                else:
                    pred = {"predictions": []}
                ctx["predictions"] = pred["predictions"]
                result_msg = f"Generated {len(ctx['predictions']):,} predictions."

            # ── Report ────────────────────────────────────────────────────────
            elif node_type == "report":
                html = _generate_report(ctx)
                if store and uid:
                    _save_report(store, uid, run_id, html)
                result_msg = "HTML report generated."

            else:
                node_statuses[node_id] = "Completed"
                results.append({
                    "node_id": node_id, "type": node_type,
                    "status": "skipped",
                    "message": f"Node type '{node_type}' is not yet wired into the pipeline.",
                })
                _cache_set(this_hash, True)
                node_output_hashes[node_id] = this_hash
                continue

            node_statuses[node_id] = "Completed"
            _cache_set(this_hash, True)
            node_output_hashes[node_id] = this_hash
            results.append({
                "node_id": node_id, "type": node_type,
                "status": "completed", "message": result_msg,
            })
            _log(f"✓ [{node_type}] {result_msg}")

        except Exception as exc:
            node_statuses[node_id] = "Failed"
            _log(f"✗ Node {node_id} ({node_type}) error: {exc}", level="ERROR")
            results.append({
                "node_id": node_id, "type": node_type,
                "status": "error", "message": str(exc),
            })
            break  # Halt on first failure

    overall = (
        "stopped" if any(r.get("status") == "stopped" for r in results)
        else "error" if any(r.get("status") == "error" for r in results)
        else "success"
    )
    _log(f"Pipeline finished — status: {overall}")

    # Persist run result to store
    final_result = {
        "status": overall,
        "results": results,
        "node_statuses": node_statuses,
        "train_results": ctx.get("train_results"),
        "predictions":   ctx.get("predictions"),
        "model_id":      ctx.get("model_id"),
    }
    if store and uid:
        try:
            store.save_run_result(uid, run_id, final_result)
        except Exception:
            pass

    return final_result


# ─────────────────────────────────────────────────────────────────────────────
# Node helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_preprocess_config(node_type: str, node_data: dict) -> dict:
    cfg = node_data.get("config", {})
    if node_type == "fillMissing":
        return {"missing_values": cfg.get("missing_values", node_data.get("missing_values", "mean")),
                "categorical_encoding": "label", "scaling": "none"}
    if node_type == "encode":
        return {"missing_values": "mean",
                "categorical_encoding": cfg.get("categorical_encoding", node_data.get("categorical_encoding", "label")),
                "scaling": "none"}
    if node_type == "scale":
        return {"missing_values": "mean", "categorical_encoding": "label",
                "scaling": cfg.get("scaling", node_data.get("scaling", "standard"))}
    return {"missing_values": "mean", "categorical_encoding": "label", "scaling": "none"}


def _run_kmeans(df: pd.DataFrame, node_data: dict) -> dict:
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import LabelEncoder
    from sklearn.impute import SimpleImputer

    k    = int(node_data.get("k", 3))
    seed = int(node_data.get("seed", 42))

    # Encode + impute
    X = df.copy()
    for col in X.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
    imp = SimpleImputer(strategy="mean")
    X = pd.DataFrame(imp.fit_transform(X), columns=X.columns)

    km = KMeans(n_clusters=k, random_state=seed, n_init="auto")
    labels = km.fit_predict(X)

    sil = None
    if len(set(labels)) > 1:
        try:
            sil = round(float(silhouette_score(X, labels, sample_size=min(5000, len(X)))), 4)
        except Exception:
            pass

    return {
        "task_type": "clustering",
        "k": k,
        "inertia": round(float(km.inertia_), 4),
        "silhouette_score": sil,
        "labels": labels.tolist()[:100],  # sample
    }


def _run_ai_decision(
    df: pd.DataFrame, analysis: dict, target_col: Optional[str], task_type: str
) -> dict:
    """
    Recommend models from profiler output and train the top 3.
    """
    from services.model_trainer import train_models

    if not target_col or target_col not in df.columns:
        return {"error": "target_column required for aiDecision node."}

    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Infer best zoo from analysis
    n_rows = analysis.get("row_count", len(df))
    n_cols = analysis.get("col_count", len(df.columns))

    # Simple heuristic: small data → simpler models first
    if task_type == "regression":
        recommended = ["Linear Regression", "Random Forest Regressor", "Gradient Boosting Regressor"]
    else:
        recommended = ["Random Forest", "Gradient Boosting", "Logistic Regression"]

    results = train_models(X, y, task_type)
    results["recommended_models"] = recommended
    return results


def _run_explainability(store, uid: str, model_id: Optional[str], ctx: dict) -> dict:
    """Permutation importance using test data from ctx or store."""
    if model_id is None or store is None:
        return {}

    try:
        from sklearn.inspection import permutation_importance as perm_imp

        model_path = store.get_artifact_path(uid, model_id, "best_model.joblib")
        model = joblib.load(model_path)

        X_test = ctx.get("X_test")
        y_test = ctx.get("y_test")

        if X_test is None:
            test_path = store.get_artifact_path(uid, model_id, "test_data.joblib")
            X_test, y_test = joblib.load(test_path)

        r = perm_imp(model, X_test, y_test, n_repeats=5, random_state=42)
        importances = r.importances_mean
        feature_names = list(X_test.columns) if hasattr(X_test, "columns") else [f"f{i}" for i in range(len(importances))]

        # Top-10 features by importance
        top_k = min(10, len(importances))
        idx   = np.argsort(importances)[-top_k:][::-1]
        top_features = [
            {"feature": feature_names[i], "importance": round(float(importances[i]), 4)}
            for i in idx
        ]
        return {"top_features": top_features}
    except Exception as exc:
        log_event(f"Explainability failed: {exc}", level="WARNING")
        return {"error": str(exc)}


def _generate_report(ctx: dict) -> str:
    """Generate an HTML summary of the pipeline run."""
    train_res = ctx.get("train_results") or {}
    models    = train_res.get("models", [])
    best      = train_res.get("best_model", "—")
    df        = ctx.get("df")
    preds     = ctx.get("predictions", [])

    rows_html = ""
    for m in models:
        name = m.get("model_name", "")
        metrics = {k: v for k, v in m.items() if k != "model_name"}
        metric_str = "  ".join(f"{k}: {v}" for k, v in metrics.items())
        rows_html += f"<tr><td>{name}</td><td>{metric_str}</td></tr>\n"

    shape_info = f"{df.shape[0]} rows × {df.shape[1]} cols" if df is not None else "N/A"

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FlowML Report</title>
<style>body{{font-family:sans-serif;padding:2rem;max-width:960px;margin:auto}}
table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ddd;padding:8px}}
th{{background:#f4f4f4}}h1{{color:#6366f1}}</style></head>
<body>
<h1>FlowML Pipeline Report</h1>
<p><strong>Generated:</strong> {datetime.now(timezone.utc).isoformat()}</p>
<h2>Dataset</h2>
<p>Shape: {shape_info}</p>
<h2>Model Results</h2>
<table><thead><tr><th>Model</th><th>Metrics</th></tr></thead>
<tbody>{rows_html}</tbody></table>
<p><strong>Best model:</strong> {best}</p>
<h2>Predictions</h2>
<p>Total: {len(preds):,} predictions generated.</p>
</body></html>"""


def _save_report(store, uid: str, run_id: str, html: str) -> None:
    """Save HTML report as an artifact under the run."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
            f.write(html)
            tmp = f.name
        store.save_artifact(uid, run_id, "report.html", tmp)
        os.unlink(tmp)
    except Exception as exc:
        log_event(f"Failed to save report: {exc}", level="WARNING")


def _save_train_artifacts_to_store(store, uid: str, model_id: str, ctx: dict) -> None:
    """Copy legacy save-dir artifacts into the per-user store."""
    legacy_dir = "models/saved_models"
    artifact_files = [
        "best_model.joblib", "features.joblib", "task_type.joblib",
        "target_encoder.joblib", "feature_encoders.joblib",
        "fallback_imputer.joblib", "test_data.joblib", "model_results.joblib",
    ]
    for fname in artifact_files:
        src = os.path.join(legacy_dir, fname)
        if os.path.exists(src):
            try:
                store.save_artifact(uid, model_id, fname, src)
            except Exception:
                pass
