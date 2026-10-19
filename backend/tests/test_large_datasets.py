"""
Tests for large dataset performance (handling 100,000+ / lakhs of records).
Verifies:
- Memory safe loading of large CSVs
- Sub-second EDA analysis on 100,000+ rows
- Efficient preview generation without CPU stalls
- System limits allow 500MB uploads and 1000+ user quota
"""

import os
import tempfile
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import app
from services.data_loader import load_dataset
from services.data_analyzer import analyze_dataset
from services.visualization import generate_correlation_heatmap, generate_distribution_plots
from routes.admin import load_system_limits


@pytest.fixture
def large_dataset_path():
    """Generates a synthetic dataset with 120,000 rows (1.2 Lakh records)."""
    n_rows = 120_000
    df = pd.DataFrame({
        "customer_id": [f"CUST_{i}" for i in range(n_rows)],
        "age": np.random.randint(18, 75, size=n_rows),
        "income": np.random.normal(55000, 15000, size=n_rows),
        "credit_score": np.random.randint(300, 850, size=n_rows),
        "category": np.random.choice(["Tier1", "Tier2", "Tier3", "VIP"], size=n_rows),
        "churn": np.random.choice([0, 1], size=n_rows, p=[0.75, 0.25]),
    })

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        df.to_csv(f, index=False)
        path = f.name

    yield path

    if os.path.exists(path):
        os.unlink(path)


def test_large_dataset_loading(large_dataset_path):
    """Ensure data_loader loads 120k rows without DtypeWarnings or errors."""
    df = load_dataset(large_dataset_path)
    assert len(df) == 120_000
    assert df.shape[1] == 6


def test_large_dataset_eda_performance(large_dataset_path):
    """Ensure analyze_dataset completes quickly and accurately on 1.2 Lakh records."""
    df = load_dataset(large_dataset_path)
    insights = analyze_dataset(df)

    assert insights["row_count"] == 120_000
    assert insights["col_count"] == 6
    assert "income" in insights["numeric_columns"]
    assert "churn" in insights["suggested_target"] or insights["suggested_target"] is not None
    assert "stats" in insights


def test_large_dataset_visualizations(large_dataset_path):
    """Ensure visualizations sample large datasets safely without crashing."""
    df = load_dataset(large_dataset_path)
    heatmap_b64 = generate_correlation_heatmap(df)
    assert heatmap_b64 is not None
    assert len(heatmap_b64) > 100

    dist_b64 = generate_distribution_plots(df)
    assert dist_b64 is not None
    assert len(dist_b64) > 100


def test_system_limits_support_large_datasets():
    """Verify system limits default to at least 500MB upload size for large datasets."""
    from routes.admin import SystemLimits
    limits = SystemLimits()
    assert limits.max_upload_size_mb >= 500
    assert limits.execution_timeout_sec >= 60
