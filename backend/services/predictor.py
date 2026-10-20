import os
import joblib
import pandas as pd
import numpy as np
from utils.logger import log_event

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
) -> dict:
    """
    Load artifacts from the per-user model store and run inference.
    The store parameter is a StoreBackend instance.
    """
    log_event(f"[{uid}] Starting prediction (model_id={model_id})")

    def _get(fname: str) -> str | None:
        try:
            return store.get_artifact_path(uid, model_id, fname)
        except Exception:
            return None

    model_path = _get("best_model.joblib")
    if not model_path:
        raise FileNotFoundError(f"No trained model found for model_id='{model_id}'.")

    model = joblib.load(model_path)
    df_pred = df.copy()

    # 1. Drop target column
    if target_column and target_column in df_pred.columns:
        df_pred = df_pred.drop(columns=[target_column])
        log_event(f"[{uid}] Dropped target column '{target_column}' from inference data.")

    # 2. Apply transformers
    preprocessors_path = _get("preprocessors.joblib")
    if preprocessors_path:
        from services.preprocessing import apply_transformers
        transformers = joblib.load(preprocessors_path)
        df_pred = apply_transformers(df_pred, transformers)
    else:
        feature_encoders_path = _get("feature_encoders.joblib")
        if feature_encoders_path:
            feature_encoders = joblib.load(feature_encoders_path)
            for col, le in feature_encoders.items():
                if col in df_pred.columns:
                    known = set(le.classes_)
                    df_pred[col] = df_pred[col].astype(str).apply(
                        lambda x: int(le.transform([x])[0]) if x in known else -1
                    )

    # 3. Align features
    features_path = _get("features.joblib")
    if features_path:
        features = joblib.load(features_path)
        for col in features:
            if col not in df_pred.columns:
                df_pred[col] = 0
        df_pred = df_pred[[c for c in features if c in df_pred.columns]]

    # Final safety: replace any NaN/inf
    df_pred = df_pred.replace([np.inf, -np.inf], 0).fillna(0)

    # 4. Predict
    raw_preds = model.predict(df_pred)

    # Decode labels
    target_encoder_path = _get("target_encoder.joblib")
    if target_encoder_path:
        target_encoder = joblib.load(target_encoder_path)
        try:
            raw_preds = target_encoder.inverse_transform(raw_preds.astype(int))
        except Exception as exc:
            log_event(f"[{uid}] Label decoding failed (non-critical): {exc}", level="WARNING")

    log_event(f"[{uid}] Prediction complete — {len(raw_preds)} samples.")
    return {"predictions": raw_preds.tolist()}
