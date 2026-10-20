import matplotlib
matplotlib.use("Agg")

import io
import base64
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from utils.logger import log_event

# ─────────────────────────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────────────────────────

def _fig_to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
    buf.seek(0)
    data = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Dataset-level charts
# ─────────────────────────────────────────────────────────────────────────────

def generate_correlation_heatmap(df: pd.DataFrame) -> str:
    """Correlation heatmap for numeric columns."""
    log_event("Generating correlation heatmap…")
    numeric_df = df.select_dtypes(include="number")
    if numeric_df.empty or numeric_df.shape[1] < 2:
        log_event("Not enough numeric columns for heatmap.", level="WARNING")
        return ""

    n = numeric_df.shape[1]
    fig_w = min(14, n + 2)
    fig_h = min(12, n + 1)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))

    sns.heatmap(
        numeric_df.corr(),
        annot=(n <= 15),   # show numbers only if readable
        cmap="coolwarm",
        ax=ax,
        fmt=".2f",
        linewidths=0.4,
        square=True,
    )
    ax.set_title("Feature Correlation Heatmap", fontsize=14, fontweight="bold", pad=15)
    plt.tight_layout()
    return _fig_to_b64(fig)


def generate_distribution_plots(df: pd.DataFrame) -> str:
    """Histogram grid for up to 9 numeric columns."""
    log_event("Generating distribution plots…")
    numeric_df = df.select_dtypes(include="number")
    if numeric_df.empty:
        return ""

    cols = numeric_df.columns[: min(9, len(numeric_df.columns))]
    n    = len(cols)
    ncols = min(3, n)
    nrows = (n + ncols - 1) // ncols

    fig, axes = plt.subplots(nrows, ncols, figsize=(ncols * 4, nrows * 3))
    axes = np.array(axes).flatten()

    for i, col in enumerate(cols):
        axes[i].hist(numeric_df[col].dropna(), bins=30, color="#4F8EF7", edgecolor="white", alpha=0.85)
        axes[i].set_title(col, fontsize=10, fontweight="bold")
        axes[i].grid(axis="y", alpha=0.3)
        axes[i].set_xlabel("")

    for j in range(n, len(axes)):
        axes[j].set_visible(False)

    plt.suptitle("Feature Distributions", fontsize=13, fontweight="bold")
    plt.tight_layout()
    return _fig_to_b64(fig)


# ─────────────────────────────────────────────────────────────────────────────
# Model-level charts
# ─────────────────────────────────────────────────────────────────────────────

def generate_feature_importance(model, feature_names: list) -> str:
    """
    Feature importance chart.
    • Tree-based models  → feature_importances_
    • Linear models      → |coef_| (coefficients)
    • Others            → permutation_importance on saved test data (if available)
    """
    log_event("Generating feature importance chart…")
    importances = None

    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_

    elif hasattr(model, "coef_"):
        coef = model.coef_
        importances = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    # Note: permutation importance requires test data passed explicitly (no global path)

    if importances is None or len(importances) != len(feature_names):
        log_event("Feature importance not available for this model.", level="WARNING")
        return ""

    # Show top-20 features only
    k = min(20, len(importances))
    sorted_idx = np.argsort(importances)[-k:]
    sorted_names = [feature_names[i] for i in sorted_idx]
    sorted_vals  = importances[sorted_idx]

    fig, ax = plt.subplots(figsize=(10, max(5, k * 0.45)))
    bars = ax.barh(sorted_names, sorted_vals, color="#4F8EF7", edgecolor="white")
    ax.set_title("Feature Importance", fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("Importance Score")
    ax.grid(axis="x", alpha=0.3)
    for bar, val in zip(bars, sorted_vals):
        ax.text(
            bar.get_width() + max(sorted_vals) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{val:.4f}", va="center", ha="left", fontsize=8,
        )
    plt.tight_layout()
    return _fig_to_b64(fig)


def generate_confusion_matrix(model, X_test, y_test) -> str:
    """Confusion matrix for classification models."""
    log_event("Generating confusion matrix…")
    try:
        from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
        preds = model.predict(X_test)
        cm    = confusion_matrix(y_test, preds)

        n_classes = cm.shape[0]
        fig_size  = max(6, n_classes * 1.2)
        fig, ax   = plt.subplots(figsize=(fig_size, fig_size * 0.85))

        disp = ConfusionMatrixDisplay(confusion_matrix=cm)
        disp.plot(ax=ax, colorbar=True, cmap="Blues")
        ax.set_title("Confusion Matrix", fontsize=14, fontweight="bold", pad=15)
        plt.tight_layout()
        return _fig_to_b64(fig)
    except Exception as exc:
        log_event(f"Confusion matrix generation failed: {exc}", level="WARNING")
        return ""


def generate_actual_vs_predicted(model, X_test, y_test) -> str:
    """Scatter plot of actual vs predicted values for regression models."""
    log_event("Generating actual-vs-predicted plot…")
    try:
        preds = model.predict(X_test)
        fig, ax = plt.subplots(figsize=(7, 6))
        ax.scatter(y_test, preds, alpha=0.5, color="#4F8EF7", edgecolors="white", linewidths=0.4, s=40)
        # Perfect prediction line
        lo = min(float(np.min(y_test)), float(np.min(preds)))
        hi = max(float(np.max(y_test)), float(np.max(preds)))
        ax.plot([lo, hi], [lo, hi], "r--", linewidth=1.5, label="Perfect fit")
        ax.set_xlabel("Actual", fontsize=12)
        ax.set_ylabel("Predicted", fontsize=12)
        ax.set_title("Actual vs Predicted", fontsize=14, fontweight="bold", pad=15)
        ax.legend()
        ax.grid(alpha=0.3)
        plt.tight_layout()
        return _fig_to_b64(fig)
    except Exception as exc:
        log_event(f"Actual-vs-predicted plot failed: {exc}", level="WARNING")
        return ""


def generate_model_comparison(model_results: list) -> str:
    """
    Horizontal bar chart comparing all trained models by their primary metric.
    model_results: list of dicts from train_models() — each has model_name + metric fields.
    """
    log_event("Generating model comparison chart…")
    if not model_results:
        return ""
    try:
        names, scores = [], []
        # Detect metric: accuracy for classification, r2 for regression
        first = {k: v for k, v in model_results[0].items() if k != "model_name" and "error" not in k}
        metric = "accuracy" if "accuracy" in first else ("r2" if "r2" in first else next(iter(first), None))
        if not metric:
            return ""

        for m in model_results:
            if metric in m:
                names.append(m["model_name"])
                scores.append(m[metric])

        if not names:
            return ""

        sorted_pairs = sorted(zip(scores, names))
        s_scores, s_names = zip(*sorted_pairs)

        fig, ax = plt.subplots(figsize=(10, max(4, len(names) * 0.6)))
        colors = ["#22c55e" if v == max(s_scores) else "#4F8EF7" for v in s_scores]
        bars = ax.barh(s_names, s_scores, color=colors, edgecolor="white")
        for bar, val in zip(bars, s_scores):
            ax.text(
                bar.get_width() + max(s_scores) * 0.01,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.4f}", va="center", ha="left", fontsize=9,
            )
        ax.set_xlabel(metric.replace("_", " ").title())
        ax.set_title(f"Model Comparison — {metric.replace('_', ' ').title()}", fontsize=14, fontweight="bold", pad=15)
        ax.grid(axis="x", alpha=0.3)
        plt.tight_layout()
        return _fig_to_b64(fig)
    except Exception as exc:
        log_event(f"Model comparison chart failed: {exc}", level="WARNING")
        return ""
