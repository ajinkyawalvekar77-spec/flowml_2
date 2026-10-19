import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, confusion_matrix, mean_squared_error, mean_absolute_error,
    precision_recall_fscore_support, r2_score,
)
from sklearn.preprocessing import LabelEncoder
from utils.logger import log_event
from services.preprocessing import apply_transformers, preprocess_data

from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    RandomForestRegressor, GradientBoostingRegressor,
)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor

RESULT_PREVIEW_LIMIT = 500

MODEL_ZOOS = {
    "classification": {
        "Logistic Regression": lambda: LogisticRegression(max_iter=1000),
        "Random Forest": lambda: RandomForestClassifier(n_estimators=100, random_state=42),
        "Decision Tree": lambda: DecisionTreeClassifier(random_state=42),
        "SVM": lambda: SVC(probability=True, random_state=42),
        "KNN": KNeighborsClassifier,
        "Gradient Boosting": lambda: GradientBoostingClassifier(random_state=42),
    },
    "regression": {
        "Linear Regression": LinearRegression,
        "Ridge": Ridge,
        "Lasso": Lasso,
        "Random Forest Regressor": lambda: RandomForestRegressor(n_estimators=100, random_state=42),
        "KNN Regressor": KNeighborsRegressor,
        "Decision Tree Regressor": lambda: DecisionTreeRegressor(random_state=42),
        "SVR": SVR,
        "Gradient Boosting Regressor": lambda: GradientBoostingRegressor(random_state=42),
    },
}

MODEL_ALIASES = {
    "randomForest": {"classification": "Random Forest", "regression": "Random Forest Regressor"},
    "Random Forest": {"classification": "Random Forest", "regression": "Random Forest Regressor"},
    "Random Forest Regressor": {"regression": "Random Forest Regressor"},
    "Random Forest Classifier": {"classification": "Random Forest"},
    "decisionTree": {"classification": "Decision Tree", "regression": "Decision Tree Regressor"},
    "Decision Tree": {"classification": "Decision Tree", "regression": "Decision Tree Regressor"},
    "Decision Tree Regressor": {"regression": "Decision Tree Regressor"},
    "Decision Tree Classifier": {"classification": "Decision Tree"},
    "linearRegression": {"regression": "Linear Regression"},
    "Linear Regression": {"regression": "Linear Regression"},
    "logisticRegression": {"classification": "Logistic Regression"},
    "Logistic Regression": {"classification": "Logistic Regression"},
    "knn": {"classification": "KNN", "regression": "KNN Regressor"},
    "KNN": {"classification": "KNN", "regression": "KNN Regressor"},
    "KNN Regressor": {"regression": "KNN Regressor"},
    "KNN Classifier": {"classification": "KNN"},
    "svm": {"classification": "SVM", "regression": "SVR"},
    "SVM": {"classification": "SVM", "regression": "SVR"},
    "SVR": {"regression": "SVR"},
    "SVC": {"classification": "SVM"},
    "Gradient Boosting": {"classification": "Gradient Boosting", "regression": "Gradient Boosting Regressor"},
    "Gradient Boosting Regressor": {"regression": "Gradient Boosting Regressor"},
    "Gradient Boosting Classifier": {"classification": "Gradient Boosting"},
}


def train_models(
    X: pd.DataFrame,
    y: pd.Series,
    task_type: str,
    test_size: float = 0.2,
    selected_model: str | None = None,
    model_parameters: dict | None = None,
    preprocessing_config: dict | None = None,
    artifact_dir: str | None = None,
    random_state: int = 42,
) -> dict:
    """Train and evaluate one configured estimator or compare the supported model zoo."""
    if artifact_dir is None:
        raise ValueError("A run-specific artifact directory is required for model training.")
    if task_type not in MODEL_ZOOS:
        raise ValueError(f"Unknown task_type '{task_type}'. Use 'classification' or 'regression'.")
    if X.empty or y.empty or len(X) != len(y):
        raise ValueError("Training requires non-empty features and target with matching row counts.")

    X = X.copy()
    y = y.copy()
    config = {
        "missing_values": "mean",
        "categorical_encoding": "label",
        "scaling": "none",
        **(preprocessing_config or {}),
    }

    # Ensure non-numeric feature columns are always encoded for ML estimators
    non_numeric_cols = [col for col in X.columns if not pd.api.types.is_numeric_dtype(X[col])]
    if non_numeric_cols:
        if config.get("categorical_encoding") in (None, "none"):
            config["categorical_encoding"] = "label"
        if config.get("encoding_columns"):
            config["encoding_columns"] = list(dict.fromkeys(list(config["encoding_columns"]) + non_numeric_cols))

    if config.get("remove_duplicates"):
        duplicate_columns = config.get("duplicate_columns")
        if duplicate_columns is None:
            frame = X.copy()
            frame["__flowml_training_target__"] = y
            keep = config.get("keep", "first")
            frame = frame.drop_duplicates(keep=keep)
            y = frame.pop("__flowml_training_target__")
            X = frame
        else:
            target_column_names = {config.get("target_column"), y.name}
            duplicate_columns = [
                "__flowml_training_target__" if column in target_column_names else column
                for column in duplicate_columns
            ]
            duplicate_columns = [
                column for column in duplicate_columns
                if column in X.columns or column == "__flowml_training_target__"
            ]
            if duplicate_columns:
                frame = X.copy()
                frame["__flowml_training_target__"] = y
                frame = frame.drop_duplicates(subset=duplicate_columns, keep=config.get("keep", "first"))
                y = frame.pop("__flowml_training_target__")
                X = frame

    if X.empty or y.empty or len(X) != len(y):
        raise ValueError("Preprocessing left no training rows or features.")

    input_features = X.columns.tolist()
    target_encoder = None

    # Auto-align task_type if selected_model clearly belongs to regression or classification
    if selected_model:
        canonical_reg = MODEL_ALIASES.get(selected_model, {}).get("regression", selected_model)
        canonical_clf = MODEL_ALIASES.get(selected_model, {}).get("classification", selected_model)
        if canonical_reg in MODEL_ZOOS["regression"] and canonical_clf not in MODEL_ZOOS["classification"]:
            task_type = "regression"
        elif canonical_clf in MODEL_ZOOS["classification"] and canonical_reg not in MODEL_ZOOS["regression"]:
            task_type = "classification"

    # Auto-detect regression if numerical target has high cardinality (continuous)
    if task_type == "classification" and pd.api.types.is_numeric_dtype(y) and y.nunique() > 20:
        canonical_reg = MODEL_ALIASES.get(selected_model, {}).get("regression", selected_model) if selected_model else None
        if canonical_reg in MODEL_ZOOS["regression"] or not selected_model:
            log_event(f"Detected continuous numerical target ({y.nunique()} unique values). Setting task_type='regression'.")
            task_type = "regression"

    if task_type == "classification":
        target_encoder = LabelEncoder()
        y = pd.Series(target_encoder.fit_transform(y.astype(str)), index=y.index)
    else:
        # Ensure regression target is cleanly numeric, handling strings with $, commas or spaces
        if not pd.api.types.is_numeric_dtype(y):
            cleaned_y = pd.to_numeric(pd.Series(y).astype(str).str.replace(r'[\$, ]', '', regex=True), errors='coerce')
            if cleaned_y.notna().sum() > 0:
                y = pd.Series(cleaned_y.fillna(cleaned_y.median()).values, index=y.index)
            else:
                raise ValueError("Regression target must contain numeric values.")
        else:
            y = pd.to_numeric(pd.Series(y), errors='coerce')
            if y.isna().any():
                y = y.fillna(y.median())

    stratify = y if task_type == "classification" else None
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify
        )
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

    # Large dataset guard: For O(N^2) memory/compute models (SVM, KNN), subsample if > 25,000 rows
    is_expensive_model = selected_model and any(m in selected_model.lower() for m in ["svm", "svr", "knn"])
    if is_expensive_model and len(X_train) > 25_000:
        log_event(f"Large dataset detected ({len(X_train)} train rows). Subsampling 25,000 rows for {selected_model} to ensure fast training.")
        sample_indices = X_train.sample(n=25_000, random_state=random_state).index
        X_train = X_train.loc[sample_indices]
        y_train = y_train.loc[sample_indices]

    config["target_column"] = "__flowml_target__"
    train_frame = X_train.copy()
    train_frame[config["target_column"]] = y_train
    training_config = {**config, "remove_duplicates": False}
    processed_train, transformers = preprocess_data(train_frame, training_config)
    transformers["config"] = config
    X_train_processed = processed_train.drop(columns=[config["target_column"]])
    X_test_processed = apply_transformers(X_test, transformers)
    expected_features = X_train_processed.columns.tolist()
    missing_transformed = [col for col in expected_features if col not in X_test_processed.columns]
    if missing_transformed:
        raise ValueError(f"Preprocessing did not produce expected features: {missing_transformed}")
    X_test_processed = X_test_processed[expected_features]

    # Guard: Ensure all columns in X_train_processed and X_test_processed are strictly numeric
    for col in X_train_processed.columns:
        if not pd.api.types.is_numeric_dtype(X_train_processed[col]):
            le = LabelEncoder()
            X_train_processed[col] = le.fit_transform(X_train_processed[col].astype(str))
            known = set(le.classes_)
            X_test_processed[col] = X_test_processed[col].astype(str).apply(
                lambda val: int(le.transform([val])[0]) if val in known else -1
            )
            if "label_encoders" not in transformers:
                transformers["label_encoders"] = {}
            transformers["label_encoders"][col] = le
            transformers["encoding"] = transformers.get("encoding") or "label"

    # Guard: Impute any remaining NaNs in numeric features
    if X_train_processed.isna().any().any():
        medians = X_train_processed.median(numeric_only=True).fillna(0)
        X_train_processed = X_train_processed.fillna(medians)
        X_test_processed = X_test_processed.fillna(medians)

    model_zoo = MODEL_ZOOS[task_type]
    if selected_model:
        canonical = MODEL_ALIASES.get(selected_model, {}).get(task_type, selected_model)
        if canonical not in model_zoo:
            # Check other zoo
            other_task = "regression" if task_type == "classification" else "classification"
            other_canonical = MODEL_ALIASES.get(selected_model, {}).get(other_task, selected_model)
            if other_canonical in MODEL_ZOOS[other_task]:
                task_type = other_task
                model_zoo = {other_canonical: MODEL_ZOOS[other_task][other_canonical]}
            else:
                supported = ", ".join(model_zoo)
                raise ValueError(
                    f"Model '{selected_model}' is not supported for {task_type}. Supported models: {supported}."
                )
        else:
            model_zoo = {canonical: model_zoo[canonical]}

    results = []
    best_model_name = None
    best_model = None
    best_score = -float("inf") if task_type == "classification" else float("inf")
    best_predictions = None

    for name, model_factory in model_zoo.items():
        try:
            model = model_factory()
            if selected_model and model_parameters:
                try:
                    model.set_params(**model_parameters)
                except (TypeError, ValueError) as exc:
                    raise ValueError(f"Invalid parameters for {name}: {exc}") from exc
            model.fit(X_train_processed, y_train)
            predictions = model.predict(X_test_processed)
            if task_type == "classification":
                accuracy = float(accuracy_score(y_test, predictions))
                precision, recall, f1, support = precision_recall_fscore_support(
                    y_test, predictions, labels=np.arange(len(target_encoder.classes_)),
                    zero_division=0,
                )
                class_metrics = [
                    {
                        "class": str(target_encoder.classes_[i]),
                        "precision": float(precision[i]),
                        "recall": float(recall[i]),
                        "f1_score": float(f1[i]),
                        "support": int(support[i]),
                    }
                    for i in range(len(target_encoder.classes_))
                ]
                metrics = {
                    "accuracy": accuracy,
                    "precision": float(np.mean(precision)),
                    "recall": float(np.mean(recall)),
                    "f1_score": float(np.mean(f1)),
                    "confusion_matrix": confusion_matrix(
                        y_test, predictions, labels=np.arange(len(target_encoder.classes_))
                    ).tolist(),
                    "class_labels": [str(value) for value in target_encoder.classes_],
                    "class_metrics": class_metrics,
                }
                score = accuracy
            else:
                mse = float(mean_squared_error(y_test, predictions))
                mae = float(mean_absolute_error(y_test, predictions))
                rmse = float(np.sqrt(mse))
                r2_val = float(r2_score(y_test, predictions)) if len(y_test) > 1 else None

                # Calculate percentage-based accuracy and precision factors for regression
                r2_acc = max(0.0, min(1.0, r2_val)) if r2_val is not None else 0.0
                denom = np.maximum(np.abs(y_test), 1e-6)
                relative_errors = np.abs((y_test - predictions) / denom)
                mape = float(np.mean(relative_errors))
                mape_acc = max(0.0, min(1.0, 1.0 - mape))

                # Precision: proportion of predictions within ±15%, ±10%, and ±20% tolerance
                precision_15 = float(np.mean(relative_errors <= 0.15))
                precision_10 = float(np.mean(relative_errors <= 0.10))
                precision_20 = float(np.mean(relative_errors <= 0.20))

                # Intuitive accuracy: variance explained when positive, otherwise closeness (1 - MAPE)
                reg_accuracy = r2_acc if (r2_val is not None and r2_val > 0) else mape_acc

                metrics = {
                    "accuracy": reg_accuracy,
                    "precision": precision_15,
                    "tolerance_precision": precision_15,
                    "tolerance_10": precision_10,
                    "tolerance_20": precision_20,
                    "mape": mape,
                    "mae": mae,
                    "mse": mse,
                    "rmse": rmse,
                    "r2": r2_val,
                }
                score = mse

            results.append({"model_name": name, **metrics})
            if (task_type == "classification" and score > best_score) or (
                task_type == "regression" and score < best_score
            ):
                best_score = score
                best_model_name = name
                best_model = model
                best_predictions = predictions
        except Exception as exc:
            log_event(f"{name} failed: {exc}", level="WARNING")
            results.append({"model_name": name, "error": str(exc)})

    if best_model is None:
        failures = "; ".join(f"{item['model_name']}: {item['error']}" for item in results)
        raise RuntimeError(f"Model training/evaluation failed: {failures}")

    selected_metrics = next(item for item in results if item["model_name"] == best_model_name)
    display_actual = (
        target_encoder.inverse_transform(np.asarray(y_test, dtype=int)).tolist()
        if target_encoder is not None else y_test.tolist()
    )
    display_predictions = (
        target_encoder.inverse_transform(np.asarray(best_predictions, dtype=int)).tolist()
        if target_encoder is not None else best_predictions.tolist()
    )
    status = "completed"
    destination = artifact_dir
    os.makedirs(destination, exist_ok=True)
    joblib.dump(best_model, os.path.join(destination, "best_model.joblib"))
    joblib.dump(expected_features, os.path.join(destination, "features.joblib"))
    joblib.dump(input_features, os.path.join(destination, "input_features.joblib"))
    joblib.dump(task_type, os.path.join(destination, "task_type.joblib"))
    joblib.dump(transformers, os.path.join(destination, "preprocessors.joblib"))
    joblib.dump((X_test_processed, y_test), os.path.join(destination, "test_data.joblib"))
    joblib.dump(results, os.path.join(destination, "model_results.joblib"))
    if target_encoder is not None:
        joblib.dump(target_encoder, os.path.join(destination, "target_encoder.joblib"))
    joblib.dump({
        "estimator": best_model,
        "preprocessors": transformers,
        "input_features": input_features,
        "features": expected_features,
        "target_encoder": target_encoder,
        "task_type": task_type,
    }, os.path.join(destination, "model_bundle.joblib"))

    log_event(f"Training complete. Selected model: {best_model_name}")
    return {
        "models": results,
        "best_model": best_model_name,
        "selected_model": best_model_name if selected_model else None,
        "model_selection": "configured" if selected_model else "automl",
        "model_parameters": best_model.get_params(deep=False),
        "training_status": status,
        "task_type": task_type,
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "evaluation": selected_metrics,
        "best_score": selected_metrics["accuracy"] if task_type == "classification" else selected_metrics["r2"],
        "input_features": input_features,
        "input_schema": {
            name: ("number" if pd.api.types.is_numeric_dtype(X[name]) else "string")
            for name in input_features
        },
        "feature_names": expected_features,
        "test_predictions": display_predictions[:RESULT_PREVIEW_LIMIT],
        "test_actual": display_actual[:RESULT_PREVIEW_LIMIT],
        "test_preview_rows": min(len(display_actual), RESULT_PREVIEW_LIMIT),
    }
