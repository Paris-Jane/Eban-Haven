from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    import psycopg2
except Exception:  # pragma: no cover
    psycopg2 = None


BASE = Path(__file__).resolve().parent
SUPPORTERS_CSV = BASE.parent / "backend" / "EbanHaven.Api" / "Data" / "lighthouse" / "supporters.csv"
DONATIONS_CSV = BASE.parent / "backend" / "EbanHaven.Api" / "Data" / "lighthouse" / "donations.csv"
MODEL_PATH = BASE / "donor_churn_model.joblib"
METADATA_PATH = BASE / "donor_churn_metadata.json"

TARGET_HORIZON_DAYS = 365
FEATURE_COLS = [
    "days_since_last_donation",
    "days_since_first_donation",
    "days_since_joined",
    "total_donations",
    "pct_recurring",
    "avg_days_between_donations",
    "total_amount",
    "avg_amount",
    "max_amount",
    "amount_trend",
    "acquisition_channel",
    "supporter_type",
    "relationship_type",
]
NUMERIC_FEATURES = [
    "days_since_last_donation",
    "days_since_first_donation",
    "days_since_joined",
    "total_donations",
    "pct_recurring",
    "avg_days_between_donations",
    "total_amount",
    "avg_amount",
    "max_amount",
    "amount_trend",
]
CATEGORICAL_FEATURES = ["acquisition_channel", "supporter_type", "relationship_type"]


def _load_from_db(conn_str: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is not installed")
    conn = psycopg2.connect(conn_str)
    try:
        supporters = pd.read_sql_query(
            """
            SELECT supporter_id, supporter_type, relationship_type, acquisition_channel, created_at
            FROM supporters
            """,
            conn,
        )
        donations = pd.read_sql_query(
            """
            SELECT donation_id, supporter_id, donation_type, donation_date, is_recurring,
                   campaign_name, channel_source, currency_code, amount, estimated_value
            FROM donations
            """,
            conn,
        )
    finally:
        conn.close()
    return supporters, donations


def _load_data() -> tuple[pd.DataFrame, pd.DataFrame, str]:
    conn_str = os.getenv("HAVEN_DB_CONN")
    if conn_str:
        supporters, donations = _load_from_db(conn_str)
        return supporters, donations, "azure_postgresql"
    supporters = pd.read_csv(SUPPORTERS_CSV)
    donations = pd.read_csv(DONATIONS_CSV)
    return supporters, donations, "csv_snapshot"


def _amount_trend(amounts: pd.Series) -> float:
    clean = pd.to_numeric(amounts, errors="coerce").dropna()
    if len(clean) < 2:
        return 0.0
    x = np.arange(len(clean))
    return float(np.polyfit(x, clean.values, 1)[0])


def build_historical_snapshots(
    supporters: pd.DataFrame,
    donations: pd.DataFrame,
    target_horizon_days: int = TARGET_HORIZON_DAYS,
) -> pd.DataFrame:
    supporters = supporters.copy()
    supporters["created_at"] = pd.to_datetime(supporters["created_at"], errors="coerce", utc=True)

    donations = donations.copy()
    donations = donations[donations["donation_type"].fillna("Monetary") == "Monetary"].copy()
    donations["donation_date"] = pd.to_datetime(donations["donation_date"], errors="coerce", utc=True)
    donations["amount"] = pd.to_numeric(donations["amount"], errors="coerce")
    donations = donations.dropna(subset=["supporter_id", "donation_date", "amount"]).copy()
    donations = donations.sort_values(["supporter_id", "donation_date"]).reset_index(drop=True)

    global_end = donations["donation_date"].max()
    rows: list[dict] = []

    for supporter_id, grp in donations.groupby("supporter_id"):
        grp = grp.sort_values("donation_date").reset_index(drop=True)
        if len(grp) < 2:
            continue

        supporter = supporters[supporters["supporter_id"] == supporter_id]
        if supporter.empty:
            continue
        supporter_row = supporter.iloc[0]

        donation_dates = grp["donation_date"].tolist()
        amounts = grp["amount"].tolist()
        recurring = grp["is_recurring"].fillna(False).astype(bool).tolist()

        for snap_idx in range(0, len(grp) - 1):
            observation_date = donation_dates[snap_idx]
            horizon_end = observation_date + pd.Timedelta(days=target_horizon_days)
            if horizon_end > global_end:
                continue

            observed_dates = donation_dates[: snap_idx + 1]
            observed_amounts = pd.Series(amounts[: snap_idx + 1], dtype=float)
            observed_recurring = recurring[: snap_idx + 1]

            future_dates = [dt for dt in donation_dates[snap_idx + 1 :] if dt <= horizon_end]
            churned = 1 if len(future_dates) == 0 else 0

            day_gaps = np.diff(pd.Series(observed_dates).view("int64")) / 86_400_000_000_000 if len(observed_dates) > 1 else []

            rows.append(
                {
                    "supporter_id": int(supporter_id),
                    "observation_date": observation_date,
                    "target": churned,
                    "days_since_last_donation": 0.0,
                    "days_since_first_donation": float((observation_date - observed_dates[0]).days),
                    "days_since_joined": float((observation_date - supporter_row["created_at"]).days)
                    if pd.notna(supporter_row["created_at"])
                    else float((observation_date - observed_dates[0]).days),
                    "total_donations": float(len(observed_dates)),
                    "pct_recurring": float(np.mean(observed_recurring)) if observed_recurring else 0.0,
                    "avg_days_between_donations": float(np.mean(day_gaps)) if len(day_gaps) else 0.0,
                    "total_amount": float(observed_amounts.sum()),
                    "avg_amount": float(observed_amounts.mean()),
                    "max_amount": float(observed_amounts.max()),
                    "amount_trend": _amount_trend(observed_amounts),
                    "acquisition_channel": supporter_row.get("acquisition_channel", "Unknown") or "Unknown",
                    "supporter_type": supporter_row.get("supporter_type", "Unknown") or "Unknown",
                    "relationship_type": supporter_row.get("relationship_type", "Unknown") or "Unknown",
                }
            )

    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError("No donor churn snapshots could be built from the available data.")
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


def candidate_search_spaces(preprocessor: ColumnTransformer) -> list[tuple[str, Pipeline, dict]]:
    return [
        (
            "logreg",
            Pipeline(
                [
                    ("preprocess", preprocessor),
                    (
                        "classifier",
                        LogisticRegression(
                            class_weight="balanced",
                            max_iter=1000,
                            solver="liblinear",
                            random_state=42,
                        ),
                    ),
                ]
            ),
            {
                "classifier__C": np.logspace(-2, 2, 20),
                "classifier__penalty": ["l1", "l2"],
            },
        ),
        (
            "gbm",
            Pipeline(
                [
                    ("preprocess", preprocessor),
                    ("classifier", GradientBoostingClassifier(random_state=42)),
                ]
            ),
            {
                "classifier__n_estimators": [50, 80, 120, 160],
                "classifier__learning_rate": [0.03, 0.05, 0.08, 0.1],
                "classifier__max_depth": [1, 2, 3],
                "classifier__subsample": [0.7, 0.85, 1.0],
                "classifier__min_samples_leaf": [1, 2, 4],
            },
        ),
        (
            "rf",
            Pipeline(
                [
                    ("preprocess", preprocessor),
                    (
                        "classifier",
                        RandomForestClassifier(
                            random_state=42,
                            class_weight="balanced_subsample",
                        ),
                    ),
                ]
            ),
            {
                "classifier__n_estimators": [150, 250, 400],
                "classifier__max_depth": [3, 5, 8, None],
                "classifier__min_samples_leaf": [1, 2, 4, 6],
                "classifier__max_features": ["sqrt", "log2", 0.7],
            },
        ),
    ]


def main() -> None:
    supporters, donations, data_source = _load_data()
    df = build_historical_snapshots(supporters, donations)
    X = df[FEATURE_COLS].copy()
    y = df["target"].astype(int).copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    preprocessor = build_preprocessor()
    inner_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    search_results: dict[str, dict[str, float | str | dict]] = {}

    for name, pipeline, params in candidate_search_spaces(preprocessor):
        search = RandomizedSearchCV(
            estimator=pipeline,
            param_distributions=params,
            n_iter=min(10, int(np.prod([len(v) for v in params.values()]))),
            scoring="roc_auc",
            cv=inner_cv,
            n_jobs=-1,
            random_state=42,
            refit=True,
        )
        search.fit(X_train, y_train)
        best_estimator = search.best_estimator_

        train_cv_probs = cross_val_predict(
            best_estimator,
            X_train,
            y_train,
            cv=inner_cv,
            method="predict_proba",
            n_jobs=-1,
        )[:, 1]

        thresholds = np.unique(np.round(train_cv_probs, 4))
        best_threshold = 0.5
        best_f1 = -1.0
        for threshold in thresholds:
            preds = (train_cv_probs >= threshold).astype(int)
            score = f1_score(y_train, preds, zero_division=0)
            if score > best_f1:
                best_threshold = float(threshold)
                best_f1 = float(score)

        test_probs = best_estimator.predict_proba(X_test)[:, 1]
        test_preds = (test_probs >= best_threshold).astype(int)
        search_results[name] = {
            "best_cv_roc_auc": float(search.best_score_),
            "best_threshold": best_threshold,
            "roc_auc_test": float(roc_auc_score(y_test, test_probs)),
            "f1_test": float(f1_score(y_test, test_preds, zero_division=0)),
            "precision_test": float(precision_score(y_test, test_preds, zero_division=0)),
            "recall_test": float(recall_score(y_test, test_preds, zero_division=0)),
            "best_params": search.best_params_,
            "best_estimator": best_estimator,
        }

    best_name = max(search_results, key=lambda name: (search_results[name]["roc_auc_test"], search_results[name]["f1_test"]))
    best = search_results[best_name]
    final_pipeline = best["best_estimator"]
    final_pipeline.fit(X, y)

    metadata = {
        "model_name": f"donor_churn_{best_name}",
        "model_version": "3.0.0",
        "target": "no donation in next 365 days after observation snapshot",
        "labeling_strategy": "Historical donor snapshots censored to avoid future-lookahead leakage",
        "feature_columns": FEATURE_COLS,
        "numerical_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "roc_auc_test": round(best["roc_auc_test"], 4),
        "f1_test": round(best["f1_test"], 4),
        "precision_test": round(best["precision_test"], 4),
        "recall_test": round(best["recall_test"], 4),
        "best_threshold": round(best["best_threshold"], 4),
        "trained_on": pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
        "currency": "PHP",
        "n_training_samples": int(len(X_train)),
        "n_test_samples": int(len(X_test)),
        "n_positive_total": int(y.sum()),
        "n_negative_total": int((1 - y).sum()),
        "observation_horizon_days": TARGET_HORIZON_DAYS,
        "cv_strategy": "StratifiedKFold(5) + RandomizedSearchCV on training set",
        "cv_roc_auc_mean": round(best["best_cv_roc_auc"], 4),
        "data_source": data_source,
        "model_candidates": {
            name: {
                k: (
                    {pk: (float(pv) if isinstance(pv, np.floating) else pv) for pk, pv in value.items()}
                    if k == "best_params"
                    else round(value, 4)
                )
                for k, value in result.items()
                if k != "best_estimator"
            }
            for name, result in search_results.items()
        },
    }

    joblib.dump(final_pipeline, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))

    test_probs = best["best_estimator"].predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= best["best_threshold"]).astype(int)
    print(json.dumps(metadata, indent=2))
    print(classification_report(y_test, test_preds, digits=3))


if __name__ == "__main__":
    main()
