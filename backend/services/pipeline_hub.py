import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from utils.logger import log_event

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "storage")
STORAGE_FILE = os.path.join(DATA_DIR, "pipelines_hub.json")

INITIAL_COMMUNITY_PIPELINES = [
    {
        "id": "pipe-regression-universal",
        "title": "Universal Tabular Regression Engine",
        "author": "alex_ml",
        "author_avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=alex",
        "description": "Production-ready regression workflow. Imputes missing values with median, normalizes features with StandardScaler, trains Linear Regression & Ridge models, and computes R², RMSE, MAE, and batch predictions.",
        "task_type": "regression",
        "tags": ["regression", "scikit-learn", "finance", "tabular", "continuous"],
        "stars": 42,
        "forks": 19,
        "is_public": True,
        "created_at": "2026-10-01T12:00:00Z",
        "nodes": [
            {
                "id": "node-upload-1",
                "type": "upload",
                "data": {"label": "Upload Dataset", "description": "Primary CSV or tabular data source"},
                "position": {"x": 50, "y": 140}
            },
            {
                "id": "node-impute-2",
                "type": "fillMissing",
                "data": {"label": "Fill Missing", "missing_values": "median", "description": "Median imputation for continuous distributions"},
                "position": {"x": 320, "y": 140}
            },
            {
                "id": "node-scale-3",
                "type": "scale",
                "data": {"label": "Scale Features", "scaling": "standard", "description": "StandardScaler normalisation for linear/ridge estimators"},
                "position": {"x": 590, "y": 140}
            },
            {
                "id": "node-model-4",
                "type": "linearRegression",
                "data": {"label": "Linear Regression", "task_type": "regression", "description": "Baseline linear regression model"},
                "position": {"x": 860, "y": 140}
            },
            {
                "id": "node-pred-5",
                "type": "prediction",
                "data": {"label": "Prediction Engine", "description": "Generates continuous output inferences"},
                "position": {"x": 1130, "y": 140}
            }
        ],
        "edges": [
            {"id": "e-1-2", "source": "node-upload-1", "target": "node-impute-2", "animated": True, "style": {"stroke": "#6366F1"}},
            {"id": "e-2-3", "source": "node-impute-2", "target": "node-scale-3", "animated": True, "style": {"stroke": "#6366F1"}},
            {"id": "e-3-4", "source": "node-scale-3", "target": "node-model-4", "animated": True, "style": {"stroke": "#6366F1"}},
            {"id": "e-4-5", "source": "node-model-4", "target": "node-pred-5", "animated": True, "style": {"stroke": "#6366F1"}}
        ]
    },
    {
        "id": "pipe-housing-valuation",
        "title": "Housing Valuation & Price Predictor",
        "author": "sarah_ds",
        "author_avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=sarah",
        "description": "Accurate real estate valuation pipeline with missing-value imputation, MinMax feature scaling, and Linear & Tree Regression for pricing predictions.",
        "task_type": "regression",
        "tags": ["housing", "prices", "real-estate", "regression"],
        "stars": 38,
        "forks": 14,
        "is_public": True,
        "created_at": "2026-10-03T15:30:00Z",
        "nodes": [
            {
                "id": "node-upload-1",
                "type": "upload",
                "data": {"label": "Upload Dataset", "file_name": "housing.csv"},
                "position": {"x": 50, "y": 140}
            },
            {
                "id": "node-impute-2",
                "type": "fillMissing",
                "data": {"label": "Fill Missing", "missing_values": "mean"},
                "position": {"x": 320, "y": 140}
            },
            {
                "id": "node-scale-3",
                "type": "scale",
                "data": {"label": "Scale Features", "scaling": "minmax"},
                "position": {"x": 590, "y": 140}
            },
            {
                "id": "node-model-4",
                "type": "linearRegression",
                "data": {"label": "Linear Regression", "target_column": "MedHouseVal", "task_type": "regression"},
                "position": {"x": 860, "y": 140}
            },
            {
                "id": "node-pred-5",
                "type": "prediction",
                "data": {"label": "Prediction Engine"},
                "position": {"x": 1130, "y": 140}
            }
        ],
        "edges": [
            {"id": "e-1-2", "source": "node-upload-1", "target": "node-impute-2", "animated": True, "style": {"stroke": "#F97316"}},
            {"id": "e-2-3", "source": "node-impute-2", "target": "node-scale-3", "animated": True, "style": {"stroke": "#F97316"}},
            {"id": "e-3-4", "source": "node-scale-3", "target": "node-model-4", "animated": True, "style": {"stroke": "#F97316"}},
            {"id": "e-4-5", "source": "node-model-4", "target": "node-pred-5", "animated": True, "style": {"stroke": "#F97316"}}
        ]
    },
    {
        "id": "pipe-titanic-classifier",
        "title": "Titanic Survival Classifier",
        "author": "chen_ml",
        "author_avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=chen",
        "description": "Kaggle benchmark pipeline. Handles missing demographic features, standardizes scales, and trains Random Forest classifier with 100 trees for high precision accuracy.",
        "task_type": "classification",
        "tags": ["classification", "random-forest", "kaggle", "benchmark"],
        "stars": 56,
        "forks": 27,
        "is_public": True,
        "created_at": "2026-09-28T08:15:00Z",
        "nodes": [
            {
                "id": "node-upload-1",
                "type": "upload",
                "data": {"label": "Upload Dataset", "file_name": "titanic.csv"},
                "position": {"x": 50, "y": 140}
            },
            {
                "id": "node-impute-2",
                "type": "fillMissing",
                "data": {"label": "Fill Missing", "missing_values": "median"},
                "position": {"x": 320, "y": 140}
            },
            {
                "id": "node-scale-3",
                "type": "scale",
                "data": {"label": "Scale Features", "scaling": "standard"},
                "position": {"x": 590, "y": 140}
            },
            {
                "id": "node-model-4",
                "type": "randomForest",
                "data": {"label": "Random Forest", "n_estimators": 100, "max_depth": 10, "target_column": "Survived", "task_type": "classification"},
                "position": {"x": 860, "y": 140}
            },
            {
                "id": "node-pred-5",
                "type": "prediction",
                "data": {"label": "Prediction Engine"},
                "position": {"x": 1130, "y": 140}
            }
        ],
        "edges": [
            {"id": "e-1-2", "source": "node-upload-1", "target": "node-impute-2", "animated": True, "style": {"stroke": "#7C3AED"}},
            {"id": "e-2-3", "source": "node-impute-2", "target": "node-scale-3", "animated": True, "style": {"stroke": "#7C3AED"}},
            {"id": "e-3-4", "source": "node-scale-3", "target": "node-model-4", "animated": True, "style": {"stroke": "#7C3AED"}},
            {"id": "e-4-5", "source": "node-model-4", "target": "node-pred-5", "animated": True, "style": {"stroke": "#7C3AED"}}
        ]
    },
    {
        "id": "pipe-automl-tournament",
        "title": "AutoML Model Tournament",
        "author": "kush_admin",
        "author_avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=kush",
        "description": "Full end-to-end AutoML pipeline. Automatically tests all available classifiers/regressors, identifies the winning model based on held-out metrics, and generates explainability insights.",
        "task_type": "all",
        "tags": ["automl", "comparison", "benchmark", "ai-decision"],
        "stars": 61,
        "forks": 32,
        "is_public": True,
        "created_at": "2026-10-05T18:00:00Z",
        "nodes": [
            {
                "id": "node-upload-1",
                "type": "upload",
                "data": {"label": "Upload Dataset"},
                "position": {"x": 50, "y": 140}
            },
            {
                "id": "node-impute-2",
                "type": "fillMissing",
                "data": {"label": "Fill Missing", "missing_values": "mean"},
                "position": {"x": 320, "y": 140}
            },
            {
                "id": "node-scale-3",
                "type": "scale",
                "data": {"label": "Scale Features", "scaling": "standard"},
                "position": {"x": 590, "y": 140}
            },
            {
                "id": "node-ai-4",
                "type": "aiDecision",
                "data": {"label": "AI AutoML Decision", "task_type": "classification"},
                "position": {"x": 860, "y": 140}
            },
            {
                "id": "node-pred-5",
                "type": "prediction",
                "data": {"label": "Prediction Engine"},
                "position": {"x": 1130, "y": 140}
            }
        ],
        "edges": [
            {"id": "e-1-2", "source": "node-upload-1", "target": "node-impute-2", "animated": True, "style": {"stroke": "#10B981"}},
            {"id": "e-2-3", "source": "node-impute-2", "target": "node-scale-3", "animated": True, "style": {"stroke": "#10B981"}},
            {"id": "e-3-4", "source": "node-scale-3", "target": "node-ai-4", "animated": True, "style": {"stroke": "#10B981"}},
            {"id": "e-4-5", "source": "node-ai-4", "target": "node-pred-5", "animated": True, "style": {"stroke": "#10B981"}}
        ]
    }
]


def _ensure_storage() -> List[Dict[str, Any]]:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(STORAGE_FILE):
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(INITIAL_COMMUNITY_PIPELINES, f, indent=2)
        return list(INITIAL_COMMUNITY_PIPELINES)

    try:
        with open(STORAGE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, list):
                return list(INITIAL_COMMUNITY_PIPELINES)
            return data
    except Exception as e:
        log_event(f"Error reading community pipelines storage: {e}", level="WARNING")
        return list(INITIAL_COMMUNITY_PIPELINES)


def _save_storage(pipelines: List[Dict[str, Any]]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(STORAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(pipelines, f, indent=2)


def get_all_pipelines(
    search: Optional[str] = None,
    task_type: Optional[str] = None,
    sort_by: str = "popular",
    user_id: Optional[str] = None,
    author_username: Optional[str] = None,
    only_mine: bool = False,
) -> List[Dict[str, Any]]:
    """Return all public pipelines with search, task_type filtering, user stars, and sorting."""
    pipelines = _ensure_storage()

    # Filter by task_type
    if task_type and task_type != "all":
        pipelines = [p for p in pipelines if p.get("task_type") in (task_type, "all")]

    # Search query in title, description, author, or tags
    if search:
        s = search.lower().strip()
        pipelines = [
            p for p in pipelines
            if s in p.get("title", "").lower()
            or s in p.get("description", "").lower()
            or s in p.get("author", "").lower()
            or any(s in tag.lower() for tag in p.get("tags", []))
        ]

    # User-specific filtering
    if only_mine and user_id:
        pipelines = [
            p for p in pipelines
            if p.get("user_id") == user_id or (author_username and p.get("author") == author_username)
        ]

    # Star decoration
    user_stars_file = os.path.join(DATA_DIR, "user_stars.json")
    user_stars = set()
    if user_id and os.path.exists(user_stars_file):
        try:
            with open(user_stars_file, "r", encoding="utf-8") as f:
                stars_map = json.load(f)
                user_stars = set(stars_map.get(user_id, []))
        except Exception:
            pass

    for p in pipelines:
        p["is_starred"] = p["id"] in user_stars

    # Sorting
    if sort_by == "popular":
        pipelines.sort(key=lambda p: (p.get("stars", 0) * 2 + p.get("forks", 0)), reverse=True)
    elif sort_by == "stars":
        pipelines.sort(key=lambda p: p.get("stars", 0), reverse=True)
    elif sort_by == "recent":
        pipelines.sort(key=lambda p: p.get("created_at", ""), reverse=True)

    return pipelines


def get_pipeline_by_id(pipeline_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    pipelines = _ensure_storage()
    for p in pipelines:
        if p["id"] == pipeline_id:
            p_copy = dict(p)
            user_stars_file = os.path.join(DATA_DIR, "user_stars.json")
            if user_id and os.path.exists(user_stars_file):
                try:
                    with open(user_stars_file, "r", encoding="utf-8") as f:
                        stars_map = json.load(f)
                        p_copy["is_starred"] = pipeline_id in stars_map.get(user_id, [])
                except Exception:
                    p_copy["is_starred"] = False
            return p_copy
    return None


def create_pipeline(data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """Publish a new ML pipeline to the community hub with user attribution."""
    pipelines = _ensure_storage()

    new_id = f"pipe-{uuid.uuid4().hex[:8]}"
    author = (data.get("author") or user_id or "data_scientist").strip()
    avatar = data.get("author_avatar") or f"https://api.dicebear.com/7.x/bottts/svg?seed={author}"

    new_pipe = {
        "id": new_id,
        "title": data.get("title", "Untitled ML Pipeline"),
        "author": author,
        "author_avatar": avatar,
        "user_id": user_id or data.get("user_id", "local_user"),
        "description": data.get("description", "A custom machine learning visual pipeline built with FlowML Studio."),
        "task_type": data.get("task_type", "all"),
        "tags": data.get("tags") or ["custom", "pipeline"],
        "stars": 1,
        "forks": 0,
        "is_public": data.get("is_public", True),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
    }

    pipelines.insert(0, new_pipe)
    _save_storage(pipelines)
    log_event(f"Published community pipeline: '{new_pipe['title']}' ({new_id}) by {author}")
    return new_pipe


def fork_pipeline(pipeline_id: str, target_dataset_id: Optional[str] = None, dataset_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fork or load a public pipeline directly, optionally attaching a custom dataset."""
    pipelines = _ensure_storage()
    for p in pipelines:
        if p["id"] == pipeline_id:
            p["forks"] = p.get("forks", 0) + 1
            _save_storage(pipelines)

            forked = json.loads(json.dumps(p))
            forked["id"] = f"fork-{uuid.uuid4().hex[:8]}"

            # If user wants to attach their dataset directly to this pipeline
            if target_dataset_id and forked.get("nodes"):
                for node in forked["nodes"]:
                    if node.get("type") == "upload":
                        node_data = node.get("data", {})
                        node_data["dataset_id"] = target_dataset_id
                        if dataset_name:
                            node_data["file_name"] = dataset_name
                        node["data"] = node_data
                        break

            log_event(f"Forked pipeline: {pipeline_id} -> {forked['id']} (dataset_id: {target_dataset_id})")
            return forked
    return None


def star_pipeline(pipeline_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Toggle or increment stars count."""
    pipelines = _ensure_storage()
    user_stars_file = os.path.join(DATA_DIR, "user_stars.json")
    os.makedirs(DATA_DIR, exist_ok=True)

    stars_map = {}
    if os.path.exists(user_stars_file):
        try:
            with open(user_stars_file, "r", encoding="utf-8") as f:
                stars_map = json.load(f)
        except Exception:
            stars_map = {}

    uid = user_id or "default_user"
    user_starred = set(stars_map.get(uid, []))

    for p in pipelines:
        if p["id"] == pipeline_id:
            if pipeline_id in user_starred:
                user_starred.remove(pipeline_id)
                p["stars"] = max(0, p.get("stars", 1) - 1)
                is_starred = False
            else:
                user_starred.add(pipeline_id)
                p["stars"] = p.get("stars", 0) + 1
                is_starred = True

            stars_map[uid] = list(user_starred)
            try:
                with open(user_stars_file, "w", encoding="utf-8") as f:
                    json.dump(stars_map, f, indent=2)
            except Exception:
                pass

            _save_storage(pipelines)
            return {"stars": p["stars"], "is_starred": is_starred}
    return None


def delete_pipeline(pipeline_id: str) -> bool:
    pipelines = _ensure_storage()
    initial_len = len(pipelines)
    pipelines = [p for p in pipelines if p["id"] != pipeline_id]
    if len(pipelines) < initial_len:
        _save_storage(pipelines)
        return True
    return False
