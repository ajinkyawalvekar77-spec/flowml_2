import pandas as pd
import numpy as np
from utils.logger import log_event


def analyze_dataset(df: pd.DataFrame) -> dict:
    """
    Analyzes the dataframe and returns rich insights including stats,
    missing value percentages, inferred task type, and more.
    """
    log_event("Analyzing dataset...")

    row_count = int(df.shape[0])
    col_count = int(df.shape[1])

    # Missing values (count + percentage)
    missing_values = {col: int(cnt) for col, cnt in df.isnull().sum().items()}
    missing_pct = {
        col: round(cnt / row_count * 100, 2) if row_count > 0 else 0.0
        for col, cnt in missing_values.items()
    }

    # Column types
    column_types = {col: str(dtype) for col, dtype in df.dtypes.items()}

    # Numeric vs categorical
    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    categorical_columns = df.select_dtypes(include=["object", "category", "bool"]).columns.tolist()

    # Unique value counts per column
    unique_counts = {col: int(df[col].nunique()) for col in df.columns}

    # Detect likely ID / high-cardinality text columns (>90 % unique values among non-numeric)
    possible_id_columns = [
        col for col in categorical_columns
        if row_count > 0 and df[col].nunique() / row_count > 0.9
    ]

    # Suggested target column
    suggested_target = None
    lower_cols = [c.lower() for c in df.columns]
    priority_candidates = [
        "target", "label", "class", "y", "output", "result",
        "outcome", "price", "salary", "sales", "revenue", "churn",
        "survived", "default", "fraud", "diagnosis",
    ]
    for candidate in priority_candidates:
        if candidate in lower_cols:
            idx = lower_cols.index(candidate)
            suggested_target = df.columns[idx]
            break
    if not suggested_target and col_count > 0:
        suggested_target = df.columns[-1]

    # Infer task type from target column
    suggested_task_type = "classification"
    if suggested_target and suggested_target in numeric_columns:
        n_unique = df[suggested_target].nunique()
        if n_unique > 20:
            suggested_task_type = "regression"

    # Basic descriptive statistics for numeric columns (serialisable dict)
    stats = {}
    if numeric_columns:
        desc = df[numeric_columns].describe()
        for col in numeric_columns:
            col_stats = {}
            for stat_name in desc.index:
                val = desc.loc[stat_name, col]
                col_stats[stat_name] = round(float(val), 4) if not np.isnan(val) else None
            stats[col] = col_stats

    log_event("Dataset analysis completed.")
    return {
        "row_count": row_count,
        "col_count": col_count,
        "column_types": column_types,
        "missing_values": missing_values,
        "missing_pct": missing_pct,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "unique_counts": unique_counts,
        "possible_id_columns": possible_id_columns,
        "suggested_target": suggested_target,
        "suggested_task_type": suggested_task_type,
        "stats": stats,
    }
