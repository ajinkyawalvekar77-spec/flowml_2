import os
import joblib
import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder, StandardScaler, MinMaxScaler
from utils.logger import log_event

PREPROCESSORS_DIR = "models/saved_models"


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def preprocess_data(
    df: pd.DataFrame,
    config: dict,
    save_preprocessors: bool = False,
    save_path: str | None = None,
) -> tuple[pd.DataFrame, dict]:
    """
    Applies preprocessing based on config dict.

    Returns (processed_df, transformers) always.
    If save_preprocessors=True and save_path is given, saves to save_path;
    otherwise falls back to the legacy global PREPROCESSORS_DIR (kept for
    backward-compat with old pipeline executor path).

    config keys:
        missing_values       : "mean" | "median" | "most_frequent" | "constant" | "drop"
        categorical_encoding : "label" | "onehot"
        scaling              : "standard" | "minmax" | "none"
        target_column        : str  (excluded from imputation/scaling)
    """
    log_event("Starting data preprocessing...")
    processed_df = df.copy()
    transformers: dict = {}

    target_col = config.get("target_column")

    # ── 1. Missing-value imputation ──────────────────────────────────────────
    strategy = config.get("missing_values", "mean")
    processed_df, transformers = _impute(processed_df, strategy, transformers, target_col)

    # ── 2. Categorical encoding ──────────────────────────────────────────────
    encoding = config.get("categorical_encoding", "label")
    processed_df, transformers = _encode(processed_df, encoding, transformers, target_col)

    # ── 3. Feature scaling ───────────────────────────────────────────────────
    scaling = config.get("scaling", "none")
    processed_df, transformers = _scale(processed_df, scaling, target_col, transformers)

    transformers["config"] = config
    transformers["final_columns"] = list(processed_df.columns)

    if save_preprocessors:
        dest = save_path or os.path.join(PREPROCESSORS_DIR, "preprocessors.joblib")
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        joblib.dump(transformers, dest)
        log_event(f"Preprocessors saved → {dest}")

    log_event(f"Preprocessing complete. Output shape: {processed_df.shape}")
    return processed_df, transformers


def apply_transformers(df: pd.DataFrame, transformers: dict) -> pd.DataFrame:
    """
    Apply *already-fitted* transformers (loaded from disk) to new data.
    This guarantees identical encodings at inference time.
    """
    df = df.copy()

    # ── Numeric imputer ──────────────────────────────────────────────────────
    if "numeric_imputer" in transformers:
        cols = [c for c in transformers["numeric_imputer_cols"] if c in df.columns]
        if cols:
            df[cols] = pd.DataFrame(
                transformers["numeric_imputer"].transform(df[cols]),
                columns=cols, index=df.index,
            )

    # ── Categorical imputer ──────────────────────────────────────────────────
    if "cat_imputer" in transformers:
        cols = [c for c in transformers["cat_imputer_cols"] if c in df.columns]
        if cols:
            df[cols] = pd.DataFrame(
                transformers["cat_imputer"].transform(df[cols]),
                columns=cols, index=df.index,
            )

    # ── Label encoding ───────────────────────────────────────────────────────
    encoding = transformers.get("encoding")
    if encoding == "label" and "label_encoders" in transformers:
        for col, le in transformers["label_encoders"].items():
            if col in df.columns:
                known = set(le.classes_)
                df[col] = df[col].astype(str).apply(
                    lambda x: int(le.transform([x])[0]) if x in known else -1
                )

    # ── One-hot encoding ─────────────────────────────────────────────────────
    elif encoding == "onehot" and "onehot_columns" in transformers:
        onehot_cols = [c for c in transformers["onehot_columns"] if c in df.columns]
        if onehot_cols:
            df = pd.get_dummies(df, columns=onehot_cols)
        # Align columns to training-time schema
        if "post_onehot_columns" in transformers:
            for col in transformers["post_onehot_columns"]:
                if col not in df.columns:
                    df[col] = 0
            df = df[[c for c in transformers["post_onehot_columns"] if c in df.columns]]

    # ── Scaler ───────────────────────────────────────────────────────────────
    if "scaler" in transformers:
        cols = [c for c in transformers["scaler_cols"] if c in df.columns]
        if cols:
            df[cols] = pd.DataFrame(
                transformers["scaler"].transform(df[cols]),
                columns=cols, index=df.index,
            )

    return df


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _impute(df: pd.DataFrame, strategy: str, transformers: dict, target_col: str | None = None):
    # Exclude target column from imputer fits so saved transformers are feature-only
    all_num_cols = df.select_dtypes(include="number").columns.tolist()
    all_cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    num_cols = [c for c in all_num_cols if c != target_col]
    cat_cols = [c for c in all_cat_cols if c != target_col]

    if strategy == "drop":
        before = len(df)
        df = df.dropna()
        log_event(f"Dropped {before - len(df)} rows with missing values.")
        return df, transformers

    if strategy == "constant":
        # Numeric → 0, categorical → "missing" (handle target separately)
        if all_num_cols:
            df[all_num_cols] = df[all_num_cols].fillna(0)
        if all_cat_cols:
            df[all_cat_cols] = df[all_cat_cols].fillna("missing")
        log_event("Filled missing values with constant (0 / 'missing').")
        return df, transformers

    # strategy in {"mean", "median", "most_frequent"}
    if num_cols:
        num_imputer = SimpleImputer(strategy=strategy)
        df[num_cols] = pd.DataFrame(
            num_imputer.fit_transform(df[num_cols]),
            columns=num_cols, index=df.index,
        )
        transformers["numeric_imputer"] = num_imputer
        transformers["numeric_imputer_cols"] = num_cols
    # Always impute target numeric separately (with mean) so it's clean for training
    if target_col and target_col in df.columns and df[target_col].isnull().any():
        df[target_col] = df[target_col].fillna(df[target_col].mode()[0] if df[target_col].dtype == object else df[target_col].mean())

    if cat_cols:
        cat_imputer = SimpleImputer(strategy="most_frequent")
        df[cat_cols] = pd.DataFrame(
            cat_imputer.fit_transform(df[cat_cols]),
            columns=cat_cols, index=df.index,
        )
        transformers["cat_imputer"] = cat_imputer
        transformers["cat_imputer_cols"] = cat_cols
    # Always impute target categorical separately
    if target_col and target_col in df.columns and df[target_col].isnull().any():
        df[target_col] = df[target_col].fillna(df[target_col].mode()[0])

    return df, transformers


def _encode(df: pd.DataFrame, encoding: str, transformers: dict, target_col: str | None = None):
    # Only encode feature columns, not the target
    all_cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    cat_cols = [c for c in all_cat_cols if c != target_col]
    if not cat_cols:
        return df, transformers

    if encoding == "label":
        label_encoders = {}
        for col in cat_cols:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            label_encoders[col] = le
        transformers["label_encoders"] = label_encoders
        transformers["encoding"] = "label"

    elif encoding == "onehot":
        transformers["onehot_columns"] = cat_cols
        transformers["encoding"] = "onehot"
        # Preserve target by only one-hot encoding feature columns
        df = pd.get_dummies(df, columns=cat_cols)
        transformers["post_onehot_columns"] = [c for c in df.columns if c != target_col]

    return df, transformers


def _scale(df: pd.DataFrame, scaling: str, target_col: str | None, transformers: dict):
    if scaling == "none":
        return df, transformers

    num_cols = df.select_dtypes(include="number").columns.tolist()
    if target_col and target_col in num_cols:
        num_cols.remove(target_col)

    if not num_cols:
        return df, transformers

    scaler = StandardScaler() if scaling == "standard" else MinMaxScaler()
    df[num_cols] = pd.DataFrame(
        scaler.fit_transform(df[num_cols]),
        columns=num_cols, index=df.index,
    )
    transformers["scaler"] = scaler
    transformers["scaler_cols"] = num_cols
    return df, transformers
