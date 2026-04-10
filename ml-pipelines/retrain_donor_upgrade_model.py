from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score, roc_curve
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    import psycopg2
except Exception:  # pragma: no cover
    psycopg2 = None


BASE = Path(__file__).resolve().parent
SUPPORTERS_CSV = BASE.parent / "backend" / "EbanHaven.Api" / "Data" / "lighthouse" / "supporters.csv"
DONATIONS_CSV = BASE.parent / "backend" / "EbanHaven.Api" / "Data" / "lighthouse" / "donations.csv"
MODEL_PATH = BASE / "donor_upgrade_model.joblib"
METADATA_PATH = BASE / "donor_upgrade_metadata.json"

FEATURE_COLS = [
    "days_since_last_donation",
    "total_donations",
    "avg_amount",
    "amount_trend",
    "pct_recurring",
    "num_campaigns",
    "acquisition_channel",
    "relationship_type",
]
NUMERIC_FEATURES = [
    "days_since_last_donation",
    "total_donations",
    "avg_amount",
    "amount_trend",
    "pct_recurring",
    "num_campaigns",
]
CATEGORICAL_FEATURES = ["acquisition_channel", "relationship_type"]


def _load_from_db(conn_str: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is not installed")
    conn = psycopg2.connect(conn_str)
    try:
        supporters = pd.read_sql_query(
            "SELECT supporter_id, relationship_type, acquisition_channel, created_at FROM supporters",
            conn,
        )
        donations = pd.read_sql_query(
            """
            SELECT supporter_id, donation_type, donation_date, is_recurring, campaign_name, amount
            FROM donations
            """,
            conn,
        )
    finally:
        conn.close()
    return supporters, donations


def load_data() -> tuple[pd.DataFrame, pd.DataFrame, str]:
    conn_str = os.getenv("HAVEN_DB_CONN")
    if conn_str:
        supporters, donations = _load_from_db(conn_str)
        return supporters, donations, "azure_postgresql"
    return pd.read_csv(SUPPORTERS_CSV), pd.read_csv(DONATIONS_CSV), "csv_snapshot"


def _amount_trend(amounts: list[float]) -> float:
    clean = pd.to_numeric(pd.Series(amounts), errors="coerce").dropna()
    if len(clean) < 2:
        return 0.0
    x = np.arange(len(clean))
    return float(np.polyfit(x, clean.values, 1)[0])


def build_upgrade_dataset(supporters: pd.DataFrame, donations: pd.DataFrame) -> pd.DataFrame:
    supporters = supporters.copy()
    supporters["created_at"] = pd.to_datetime(supporters.get("created_at"), errors="coerce", utc=True)

    donations = donations.copy()
    donations = donations[donations["donation_type"].fillna("Monetary") == "Monetary"].copy()
    donations["donation_date"] = pd.to_datetime(donations["donation_date"], errors="coerce", utc=True)
    donations["amount"] = pd.to_numeric(donations["amount"], errors="coerce")
    donations = donations.dropna(subset=["supporter_id", "donation_date", "amount"]).copy()
    donations["year"] = donations["donation_date"].dt.year
    donations = donations.sort_values(["supporter_id", "donation_date"]).reset_index(drop=True)

    rows: list[dict] = []
    now_utc = pd.Timestamp.utcnow()
    for supporter_id, grp in donations.groupby("supporter_id"):
        grp = grp.sort_values("donation_date").reset_index(drop=True)
        years = sorted(grp["year"].dropna().unique())
        pairs = [(years[i - 1], years[i]) for i in range(1, len(years)) if years[i] == years[i - 1] + 1]
        if not pairs:
            continue

        prior_year, recent_year = pairs[-1]
        supporter = supporters[supporters["supporter_id"] == supporter_id]
        if supporter.empty:
            continue
        supporter_row = supporter.iloc[0]

        recent_total = grp.loc[grp["year"] == recent_year, "amount"].sum()
        prior_total = grp.loc[grp["year"] == prior_year, "amount"].sum()
        observed = grp.loc[grp["year"] <= prior_year].copy()
        if observed.empty:
            continue

        rows.append(
            {
                "supporter_id": int(supporter_id),
                "label": int(recent_total > prior_total),
                "days_since_last_donation": float((now_utc - observed["donation_date"].max()).days),
                "total_donations": float(len(observed)),
                "avg_amount": float(observed["amount"].mean()),
                "amount_trend": _amount_trend(observed["amount"].tolist()),
                "pct_recurring": float(observed["is_recurring"].fillna(False).astype(bool).mean()),
                "num_campaigns": float(observed["campaign_name"].dropna().nunique()),
                "acquisition_channel": supporter_row.get("acquisition_channel", "Unknown") or "Unknown",
                "relationship_type": supporter_row.get("relationship_type", "Unknown") or "Unknown",
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No valid donor upgrade rows could be built from the available data.")
    return df


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def main() -> None:
    supporters, donations, data_source = load_data()
    df_model = build_upgrade_dataset(supporters, donations)
    X = df_model[FEATURE_COLS].copy()
    y = df_model["label"].astype(int).copy()

    preprocess = build_preprocessor()
    lr_pipeline = Pipeline(
        [
            ("preprocess", preprocess),
            ("classifier", LogisticRegression(C=0.5, class_weight="balanced", solver="liblinear", random_state=42)),
        ]
    )
    gbm_pipeline = Pipeline(
        [
            ("preprocess", preprocess),
            ("classifier", GradientBoostingClassifier(random_state=42, n_estimators=40, learning_rate=0.05, max_depth=2)),
        ]
    )

    loo = LeaveOneOut()
    lr_probs = cross_val_predict(lr_pipeline, X, y, cv=loo, method="predict_proba")[:, 1]
    gbm_probs = cross_val_predict(gbm_pipeline, X, y, cv=loo, method="predict_proba")[:, 1]
    lr_auc = roc_auc_score(y, lr_probs)
    gbm_auc = roc_auc_score(y, gbm_probs)

    fpr, tpr, thresholds = roc_curve(y, lr_probs)
    youden = tpr - fpr
    best_threshold = float(thresholds[np.argmax(youden)])
    lr_preds = (lr_probs >= best_threshold).astype(int)

    lr_pipeline.fit(X, y)
    joblib.dump(lr_pipeline, MODEL_PATH)

    metadata = {
        "model_name": "donor_upgrade_propensity_lr",
        "model_version": "1.1.0",
        "target": "YoY giving increase (most_recent_year_total > prior_year_total)",
        "labeling_strategy": "Per donor: most recent consecutive calendar-year pair",
        "feature_columns": FEATURE_COLS,
        "numerical_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "roc_auc_loo": round(float(lr_auc), 4),
        "gbm_roc_auc_loo": round(float(gbm_auc), 4),
        "f1_loo": round(float(f1_score(y, lr_preds, zero_division=0)), 4),
        "precision_loo": round(float(precision_score(y, lr_preds, zero_division=0)), 4),
        "recall_loo": round(float(recall_score(y, lr_preds, zero_division=0)), 4),
        "best_threshold": round(best_threshold, 4),
        "n_training_samples": int(len(df_model)),
        "n_positive": int(y.sum()),
        "n_negative": int((1 - y).sum()),
        "cv_strategy": "LeaveOneOut",
        "trained_on": pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
        "currency": "PHP",
        "data_source": data_source,
        "data_warning": (
            f"Trained on {len(df_model)} labeled donors from the "
            f"{'live Azure PostgreSQL database' if data_source == 'azure_postgresql' else 'committed CSV snapshot'}. "
            "Retrain with GradientBoostingClassifier when N > 100."
        ),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
