import os
import joblib
import pandas as pd
from fastapi import HTTPException
import numpy as np
from utils.logger import log_event
from services.preprocessing import apply_transformers

SAVE_DIR = "models/saved_models"


def predict(df: pd.DataFrame, target_column: str | None = None) -> dict:
    """
    Load the best trained model and generate predictions for *df*.

    Steps:
      1. Drop target column if present (prevents data leakage).
      2. Apply saved preprocessors (from the preprocessing step) if available.
         Otherwise fall back to the feature encoders saved during training.
      3. Align DataFrame columns to training-time feature list.
      4. Run inference, then decode labels for classification tasks.
    """
    log_event("Starting prediction process.")

    model_path = os.path.join(SAVE_DIR, "best_model.joblib")
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            "No trained model found at models/saved_models/best_model.joblib. "
            "Please train a model first."
        )

    model      = joblib.load(model_path)
    df_pred    = df.copy()

    # ── 1. Drop target column ────────────────────────────────────────────────
    if target_column and target_column in df_pred.columns:
        df_pred = df_pred.drop(columns=[target_column])
        log_event(f"Dropped target column '{target_column}' from inference data.")

    # ── 2. Apply transformers ────────────────────────────────────────────────
    preprocessors_path = os.path.join(SAVE_DIR, "preprocessors.joblib")
    if os.path.exists(preprocessors_path):
        # Use the full preprocessing pipeline (preferred path)
        from services.preprocessing import apply_transformers
        transformers = joblib.load(preprocessors_path)
        df_pred = apply_transformers(df_pred, transformers)
        log_event("Applied saved preprocessing pipeline to inference data.")
    else:
        # Fallback: use per-column encoders saved during training
        _apply_fallback_encoding(df_pred)

    # Fill any remaining NaNs
    if df_pred.isnull().values.any():
        _apply_fallback_imputation(df_pred)

    # ── 3. Align features ────────────────────────────────────────────────────
    features_path = os.path.join(SAVE_DIR, "features.joblib")
    if os.path.exists(features_path):
        features = joblib.load(features_path)
        # Add columns that are missing from the inference set (fill with 0)
        for col in features:
            if col not in df_pred.columns:
                df_pred[col] = 0
                log_event(f"Feature '{col}' missing in inference data — filled with 0.", level="WARNING")
        # Keep only model features in original order
        df_pred = df_pred[[c for c in features if c in df_pred.columns]]

    # Final safety: replace any NaN/inf that slipped through
    df_pred = df_pred.replace([np.inf, -np.inf], 0).fillna(0)

    # ── 4. Predict ───────────────────────────────────────────────────────────
    raw_preds = model.predict(df_pred)

    # Decode integer labels back to original class names for classification
    target_encoder_path = os.path.join(SAVE_DIR, "target_encoder.joblib")
    if os.path.exists(target_encoder_path):
        target_encoder = joblib.load(target_encoder_path)
        try:
            raw_preds = target_encoder.inverse_transform(raw_preds.astype(int))
        except Exception as exc:
            log_event(f"Label decoding failed (non-critical): {exc}", level="WARNING")

    log_event(f"Prediction complete — {len(raw_preds)} samples.")
    return {"predictions": raw_preds.tolist()}


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _apply_fallback_encoding(df: pd.DataFrame) -> None:
    """Encode categoricals using the encoders saved during training, in-place."""
    path = os.path.join(SAVE_DIR, "feature_encoders.joblib")
    if os.path.exists(path):
        feature_encoders: dict = joblib.load(path)
        for col, le in feature_encoders.items():
            if col in df.columns:
                known = set(le.classes_)
                df[col] = df[col].astype(str).apply(
                    lambda x: int(le.transform([x])[0]) if x in known else -1
                )
    else:
        # Last resort: fit a fresh encoder (order may differ, but prevents crash)
        from sklearn.preprocessing import LabelEncoder
        for col in df.select_dtypes(include=["object", "category", "string"]).columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))


def _apply_fallback_imputation(df: pd.DataFrame) -> None:
    """Impute NaNs using the imputer saved during training or a fresh one, in-place."""
    path = os.path.join(SAVE_DIR, "fallback_imputer.joblib")
    cols = df.columns.tolist()
    if os.path.exists(path):
        imputer = joblib.load(path)
        arr = imputer.transform(df)
    else:
        from sklearn.impute import SimpleImputer
        imputer = SimpleImputer(strategy="mean")
        arr = imputer.fit_transform(df)
    # Assign safely without dtype issues
    result = pd.DataFrame(arr, columns=cols, index=df.index)
    df[cols] = result[cols]


# ─────────────────────────────────────────────────────────────────────────────
# Store-aware prediction (multi-user)
# ─────────────────────────────────────────────────────────────────────────────

def predict_with_store(
    df: pd.DataFrame,
    uid: str,
    model_id: str,
    store,
    target_column: str | None = None,
    dataset_id: str | None = None,
    evaluate: bool = True,
) -> dict:
    """Validate raw input, apply the stored fitted preprocessing, and evaluate labels if present."""
    log_event(f"[{uid}] Starting prediction (model_id={model_id})")

    def _get(fname: str) -> str | None:
        try:
            return store.get_artifact_path(uid, model_id, fname)
        except HTTPException as exc:
            if exc.status_code == 404:
                return None
            raise

    model_path = _get("best_model.joblib")
    feature_path = _get("input_features.joblib")
    transformed_features_path = _get("features.joblib")
    preprocessors_path = _get("preprocessors.joblib")
    metadata_path = _get("model_meta.joblib")
    if not model_path or not feature_path or not transformed_features_path or not preprocessors_path:
        raise FileNotFoundError(
            f"Model '{model_id}' is missing its estimator or fitted preprocessing artifacts."
        )

    model = joblib.load(model_path)
    expected_inputs = joblib.load(feature_path)
    expected_features = joblib.load(transformed_features_path)
    transformers = joblib.load(preprocessors_path)
    metadata = joblib.load(metadata_path) if metadata_path else {}
    saved_target = metadata.get("target_column")
    same_training_dataset = bool(dataset_id and dataset_id == metadata.get("dataset_id"))
    selected_target = target_column or saved_target
    if target_column and saved_target and target_column != saved_target:
        raise ValueError(f"Target column must be '{saved_target}' for this model.")

    df_pred = df.copy()
    actual = None
    if selected_target and selected_target in df_pred.columns:
        actual = df_pred[selected_target].copy()
        df_pred = df_pred.drop(columns=[selected_target])

    missing = [col for col in expected_inputs if col not in df_pred.columns]
    extra = [col for col in df_pred.columns if col not in expected_inputs]
    if missing or extra:
        parts = []
        if missing:
            parts.append(f"missing required features: {missing}")
        if extra:
            parts.append(f"unexpected features: {extra}")
        raise ValueError("Input schema does not match the trained model (" + "; ".join(parts) + ").")

    df_pred = df_pred[expected_inputs]
    input_schema = metadata.get("input_schema", {})
    for column, kind in input_schema.items():
        if column in df_pred.columns and kind == "number":
            try:
                df_pred[column] = pd.to_numeric(df_pred[column], errors="raise")
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Feature '{column}' must contain numeric values: {exc}") from exc
    df_transformed = apply_transformers(df_pred, transformers)
    missing_transformed = [col for col in expected_features if col not in df_transformed.columns]
    if missing_transformed:
        raise ValueError(f"Saved preprocessing did not produce model features: {missing_transformed}.")
    df_transformed = df_transformed[expected_features]
    if not np.isfinite(df_transformed.select_dtypes(include=[np.number])).all().all():
        raise ValueError("Input contains non-finite values after preprocessing.")

    raw_preds = model.predict(df_transformed)
    task_type = metadata.get("task_type")
    if not task_type:
        task_type_path = _get("task_type.joblib")
        if not task_type_path:
            raise FileNotFoundError(f"Model '{model_id}' has no task type metadata.")
        task_type = joblib.load(task_type_path)
    target_encoder_path = _get("target_encoder.joblib")
    target_encoder = joblib.load(target_encoder_path) if target_encoder_path else None
    probability_rows = None
    if task_type == "classification" and hasattr(model, "predict_proba"):
        class_values = model.classes_
        decoded_classes = (
            target_encoder.inverse_transform(np.asarray(class_values, dtype=int)).tolist()
            if target_encoder is not None else class_values.tolist()
        )
        probability_rows = [
            {str(label): float(probability) for label, probability in zip(decoded_classes, row)}
            for row in model.predict_proba(df_transformed)
        ]

    decoded_preds = (
        target_encoder.inverse_transform(np.asarray(raw_preds, dtype=int))
        if task_type == "classification" and target_encoder is not None
        else raw_preds
    )
    evaluation = None
    evaluation_message = "No target column was supplied; supervised metrics are unavailable."
    if not evaluate:
        evaluation_message = "Supervised evaluation was not requested for this inference run."
    elif same_training_dataset:
        evaluation_message = "This is the training dataset; use the held-out evaluation metrics instead."
    elif actual is not None:
        from sklearn.metrics import (
            accuracy_score, confusion_matrix, mean_absolute_error, mean_squared_error,
            precision_recall_fscore_support, r2_score,
        )

        labeled_mask = actual.notna().to_numpy()
        if not labeled_mask.any():
            evaluation_message = "No non-empty target values were supplied; supervised metrics are unavailable."
        elif task_type == "classification":
            try:
                labeled_actual = actual[labeled_mask]
                labeled_predictions = raw_preds[labeled_mask]
                encoded_actual = target_encoder.transform(labeled_actual.astype(str)) if target_encoder else labeled_actual
            except ValueError as exc:
                raise ValueError(f"Test target contains a class not seen during training: {exc}") from exc
            labels = np.arange(len(target_encoder.classes_)) if target_encoder else np.unique(encoded_actual)
            precision, recall, f1, support = precision_recall_fscore_support(
                encoded_actual, labeled_predictions, labels=labels, zero_division=0
            )
            evaluation = {
                "accuracy": float(accuracy_score(encoded_actual, labeled_predictions)),
                "precision": float(np.mean(precision)),
                "recall": float(np.mean(recall)),
                "f1_score": float(np.mean(f1)),
                "confusion_matrix": confusion_matrix(encoded_actual, labeled_predictions, labels=labels).tolist(),
                "class_labels": [
                    str(target_encoder.classes_[i]) if target_encoder else str(i) for i in labels
                ],
                "class_metrics": [
                    {
                        "class": str(target_encoder.classes_[i]) if target_encoder else str(i),
                        "precision": float(precision[j]),
                        "recall": float(recall[j]),
                        "f1_score": float(f1[j]),
                        "support": int(support[j]),
                    }
                    for j, i in enumerate(labels)
                ],
                "rows": int(labeled_mask.sum()),
            }
        else:
            try:
                actual_values = pd.to_numeric(actual[labeled_mask], errors="raise")
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Regression test target must be numeric: {exc}") from exc
            mse = float(mean_squared_error(actual_values, raw_preds[labeled_mask]))
            mae = float(mean_absolute_error(actual_values, raw_preds[labeled_mask]))
            rmse = float(np.sqrt(mse))
            r2_val = float(r2_score(actual_values, raw_preds[labeled_mask])) if len(actual_values) > 1 else None

            # Calculate percentage-based accuracy and precision factors for regression
            r2_acc = max(0.0, min(1.0, r2_val)) if r2_val is not None else 0.0
            denom = np.maximum(np.abs(actual_values), 1e-6)
            relative_errors = np.abs((actual_values - raw_preds[labeled_mask]) / denom)
            mape = float(np.mean(relative_errors))
            mape_acc = max(0.0, min(1.0, 1.0 - mape))
            precision_15 = float(np.mean(relative_errors <= 0.15))
            precision_10 = float(np.mean(relative_errors <= 0.10))
            precision_20 = float(np.mean(relative_errors <= 0.20))
            reg_accuracy = r2_acc if (r2_val is not None and r2_val > 0) else mape_acc

            evaluation = {
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
                "rows": int(labeled_mask.sum()),
            }
        if evaluation is not None:
            evaluation_message = f"Evaluation calculated from {int(labeled_mask.sum())} labeled rows."

    input_rows = df.astype(object).where(pd.notna(df), None).to_dict(orient="records")
    log_event(f"[{uid}] Prediction complete — {len(decoded_preds)} samples.")
    return {
        "predictions": decoded_preds.tolist(),
        "input_rows": input_rows,
        "probabilities": probability_rows,
        "evaluation": evaluation,
        "evaluation_message": evaluation_message,
        "algorithm": metadata.get("algorithm") or metadata.get("best_model"),
        "task_type": task_type,
        "target_column": saved_target,
    }
