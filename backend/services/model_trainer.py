import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_squared_error, mean_absolute_error, r2_score,
)
from sklearn.preprocessing import LabelEncoder
from sklearn.impute import SimpleImputer
from utils.logger import log_event

# ── Classification models ────────────────────────────────────────────────────
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier

# ── Regression models ────────────────────────────────────────────────────────
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.svm import SVR

SAVE_DIR = "models/saved_models"


def train_models(X: pd.DataFrame, y: pd.Series, task_type: str, test_size: float = 0.2) -> dict:
    """
    Trains multiple models for the given task type and returns a comparison dict
    plus the name of the best model.  All fitted artefacts are saved to SAVE_DIR
    so they can be reloaded consistently at prediction time.
    """
    log_event(f"Starting model training — task: {task_type}, samples: {len(X)}")

    X = X.copy()

    # ── Encode target for classification ────────────────────────────────────
    target_encoder = None
    if task_type == "classification":
        target_encoder = LabelEncoder()
        y = target_encoder.fit_transform(y.astype(str))

    # ── Auto-encode categorical feature columns ──────────────────────────────
    feature_encoders: dict = {}
    cat_cols = X.select_dtypes(include=["object", "category", "string"]).columns.tolist()
    for col in cat_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        feature_encoders[col] = le

    # ── Auto-impute NaNs (safe DataFrame-preserving idiom) ───────────────────
    fallback_imputer = None
    if X.isnull().values.any():
        fallback_imputer = SimpleImputer(strategy="mean")
        X = pd.DataFrame(
            fallback_imputer.fit_transform(X),
            columns=X.columns,
            index=X.index,
        )

    # ── Train / test split ───────────────────────────────────────────────────
    stratify = y if task_type == "classification" else None
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=stratify
        )
    except ValueError:
        # Fallback without stratify if any class is too rare
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )

    log_event(f"Split: {len(X_train)} train / {len(X_test)} test")

    # ── Model zoo ────────────────────────────────────────────────────────────
    if task_type == "classification":
        model_zoo = {
            "Logistic Regression":   LogisticRegression(max_iter=1000),
            "Random Forest":          RandomForestClassifier(n_estimators=100, random_state=42),
            "Decision Tree":          DecisionTreeClassifier(random_state=42),
            "SVM":                    SVC(probability=True, random_state=42),
            "KNN":                    KNeighborsClassifier(),
            "Gradient Boosting":      GradientBoostingClassifier(random_state=42),
        }
    elif task_type == "regression":
        model_zoo = {
            "Linear Regression":              LinearRegression(),
            "Ridge":                          Ridge(),
            "Lasso":                          Lasso(),
            "Random Forest Regressor":        RandomForestRegressor(n_estimators=100, random_state=42),
            "Decision Tree Regressor":        DecisionTreeRegressor(random_state=42),
            "SVR":                            SVR(),
            "Gradient Boosting Regressor":    GradientBoostingRegressor(random_state=42),
        }
    else:
        raise ValueError(f"Unknown task_type '{task_type}'. Use 'classification' or 'regression'.")

    results = []
    best_model_name: str | None = None
    best_model = None
    best_score = -float("inf") if task_type == "classification" else float("inf")

    for name, model in model_zoo.items():
        try:
            log_event(f"Training {name}…")
            model.fit(X_train, y_train)
            preds = model.predict(X_test)

            if task_type == "classification":
                acc       = float(accuracy_score(y_test, preds))
                precision = float(precision_score(y_test, preds, average="macro", zero_division=0))
                recall    = float(recall_score(y_test, preds, average="macro", zero_division=0))
                f1        = float(f1_score(y_test, preds, average="macro", zero_division=0))
                score = acc
                results.append({
                    "model_name": name,
                    "accuracy":  round(acc, 4),
                    "precision": round(precision, 4),
                    "recall":    round(recall, 4),
                    "f1_score":  round(f1, 4),
                })
                if score > best_score:
                    best_score, best_model_name, best_model = score, name, model

            else:  # regression
                mse  = float(mean_squared_error(y_test, preds))
                rmse = float(np.sqrt(mse))
                mae  = float(mean_absolute_error(y_test, preds))
                r2   = float(r2_score(y_test, preds))
                score = mse
                results.append({
                    "model_name": name,
                    "mse":  round(mse, 4),
                    "rmse": round(rmse, 4),
                    "mae":  round(mae, 4),
                    "r2":   round(r2, 4),
                })
                if score < best_score:
                    best_score, best_model_name, best_model = score, name, model

        except Exception as exc:
            log_event(f"{name} failed: {exc}", level="WARNING")
            results.append({"model_name": name, "error": str(exc)})

    if best_model is None:
        raise RuntimeError("All models failed to train. Check your data.")

    log_event(f"Training complete. Best model: {best_model_name}")

    # ── Persist all artefacts ────────────────────────────────────────────────
    os.makedirs(SAVE_DIR, exist_ok=True)

    joblib.dump(best_model,     os.path.join(SAVE_DIR, "best_model.joblib"))
    joblib.dump(X.columns.tolist(), os.path.join(SAVE_DIR, "features.joblib"))
    joblib.dump(task_type,      os.path.join(SAVE_DIR, "task_type.joblib"))

    if target_encoder is not None:
        joblib.dump(target_encoder, os.path.join(SAVE_DIR, "target_encoder.joblib"))
    else:
        # Remove stale encoder from a previous run
        stale = os.path.join(SAVE_DIR, "target_encoder.joblib")
        if os.path.exists(stale):
            os.remove(stale)

    if feature_encoders:
        joblib.dump(feature_encoders, os.path.join(SAVE_DIR, "feature_encoders.joblib"))
    else:
        stale = os.path.join(SAVE_DIR, "feature_encoders.joblib")
        if os.path.exists(stale):
            os.remove(stale)

    if fallback_imputer is not None:
        joblib.dump(fallback_imputer, os.path.join(SAVE_DIR, "fallback_imputer.joblib"))

    # Save test data for post-training visualisations (confusion matrix etc.)
    joblib.dump((X_test, y_test), os.path.join(SAVE_DIR, "test_data.joblib"))

    # Save model results for comparison chart
    joblib.dump(results, os.path.join(SAVE_DIR, "model_results.joblib"))

    log_event(f"All artefacts saved to {SAVE_DIR}")

    return {
        "models":      results,
        "best_model":  best_model_name,
        "task_type":   task_type,
        "train_size":  int(len(X_train)),
        "test_size":   int(len(X_test)),
    }
