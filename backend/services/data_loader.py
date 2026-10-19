import os
import pandas as pd
from utils.logger import log_event


def load_dataset(file_path: str) -> pd.DataFrame:
    """Loads a dataset from CSV or Excel. Auto-detects encoding for CSV files."""
    log_event(f"Loading dataset from {file_path}")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset not found at {file_path}")

    lower_path = file_path.lower()
    if lower_path.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file_path)
        log_event(f"Loaded Excel: {df.shape[0]} rows, {df.shape[1]} cols")
        return df

    # For .csv, .tsv, .txt, .data, or files without extension: attempt CSV / delimited loading
    for sep in (None, ',', '\t', ';', '|'):
        for encoding in ('utf-8', 'latin-1', 'cp1252'):
            try:
                # sep=None with engine='python' will auto-sniff delimiters if delimiter is not standard comma
                if sep is None:
                    df = pd.read_csv(file_path, encoding=encoding, sep=None, engine='python')
                else:
                    df = pd.read_csv(file_path, encoding=encoding, sep=sep, low_memory=False)

                if df.shape[1] >= 1 and df.shape[0] >= 0:
                    log_event(f"Loaded dataset ({encoding}, sep={sep}): {df.shape[0]} rows, {df.shape[1]} cols")
                    return df
            except Exception:
                continue

    raise ValueError("Unsupported file format or unparseable tabular dataset. Only CSV (.csv) and Excel (.xls/.xlsx) are supported.")


def get_dataset_metadata(df: pd.DataFrame, file_name: str) -> dict:
    """Returns basic metadata for a given dataframe."""
    return {
        "file_name": file_name,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "column_names": df.columns.tolist(),
    }
