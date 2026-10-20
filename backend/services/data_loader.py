import os
import pandas as pd
from utils.logger import log_event


def load_dataset(file_path: str) -> pd.DataFrame:
    """Loads a dataset from CSV or Excel. Auto-detects encoding for CSV files."""
    log_event(f"Loading dataset from {file_path}")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset not found at {file_path}")

    if file_path.endswith('.csv'):
        # Try UTF-8 first, fall back to latin-1 for non-English data
        for encoding in ('utf-8', 'latin-1', 'cp1252'):
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                log_event(f"Loaded CSV with encoding={encoding}: {df.shape[0]} rows, {df.shape[1]} cols")
                return df
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode the CSV file with any standard encoding.")

    elif file_path.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file_path)
        log_event(f"Loaded Excel: {df.shape[0]} rows, {df.shape[1]} cols")
        return df

    else:
        raise ValueError("Unsupported file format. Only CSV (.csv) and Excel (.xls/.xlsx) are supported.")


def get_dataset_metadata(df: pd.DataFrame, file_name: str) -> dict:
    """Returns basic metadata for a given dataframe."""
    return {
        "file_name": file_name,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "column_names": df.columns.tolist(),
    }
