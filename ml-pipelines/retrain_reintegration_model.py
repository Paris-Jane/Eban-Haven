from __future__ import annotations

import getpass
import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import psycopg2
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import fbeta_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


FEATURE_COLS = [
    "safehouse_id",
    "age_at_entry",
    "days_in_program",
    "referral_source",
    "current_risk_level",
    "reintegration_type",
    "case_status",
    "total_sessions",
    "pct_progress_noted",
    "pct_concerns_flagged",
    "latest_attendance_rate",
    "avg_progress_percent",
    "avg_general_health_score",
    "pct_psych_checkup_done",
    "num_health_records",
    "total_incidents",
    "num_severe_incidents",
    "total_plans",
    "pct_plans_achieved",
    "active_plan_count",
]
CAT_COLS = ["safehouse_id", "referral_source", "current_risk_level", "reintegration_type", "case_status"]
NUM_COLS = [col for col in FEATURE_COLS if col not in CAT_COLS]
OBS_HORIZON_DAYS = 540
RANDOM_STATE = 42
BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / "reintegration_model.joblib"
METADATA_PATH = BASE / "reintegration_model_metadata.json"
DATA_DIR = BASE.parent / "backend" / "EbanHaven.Api" / "Data" / "lighthouse"

def _assemble_dataset(
    residents: pd.DataFrame,
    safehouses: pd.DataFrame,
    process_recordings: pd.DataFrame,
    education_records: pd.DataFrame,
    health_records: pd.DataFrame,
    incident_reports: pd.DataFrame,
    intervention_plans: pd.DataFrame,
) -> pd.DataFrame:
    residents = residents.copy()
    safehouses = safehouses.copy()
    process_recordings = process_recordings.copy()
    education_records = education_records.copy()
    health_records = health_records.copy()
    incident_reports = incident_reports.copy()
    intervention_plans = intervention_plans.copy()

    if "safehouse_code" not in safehouses.columns:
        safehouses["safehouse_code"] = safehouses.get("name", "Unknown")

    residents["date_of_admission"] = pd.to_datetime(residents["date_of_admission"], errors="coerce", utc=True)
    process_recordings["progress_noted"] = process_recordings["progress_noted"].fillna(False).astype(bool)
    process_recordings["concerns_flagged"] = process_recordings["concerns_flagged"].fillna(False).astype(bool)

    if "progress_percent" in education_records.columns:
        education_records["progress_percent"] = pd.to_numeric(education_records["progress_percent"], errors="coerce")
    if "general_health_score" in health_records.columns:
        health_records["general_health_score"] = pd.to_numeric(health_records["general_health_score"], errors="coerce")

    session_agg = (
        process_recordings.groupby("resident_id", dropna=False)
        .agg(
            total_sessions=("resident_id", "size"),
            pct_progress_noted=("progress_noted", "mean"),
            pct_concerns_flagged=("concerns_flagged", "mean"),
        )
        .reset_index()
    )

    edu_agg = (
        education_records.groupby("resident_id", dropna=False)
        .agg(avg_progress_percent=("progress_percent", "mean"))
        .reset_index()
    )

    health_agg = (
        health_records.groupby("resident_id", dropna=False)
        .agg(
            avg_general_health_score=("general_health_score", "mean"),
            num_health_records=("general_health_score", "size"),
        )
        .reset_index()
    )

    incident_reports["is_severe"] = incident_reports["severity"].isin(["High", "Severe", "Critical"])
    incident_agg = (
        incident_reports.groupby("resident_id", dropna=False)
        .agg(
            total_incidents=("resident_id", "size"),
            num_severe_incidents=("is_severe", "sum"),
        )
        .reset_index()
    )

    intervention_plans["is_achieved"] = intervention_plans["status"].astype(str).str.lower().isin(["achieved", "completed"])
    intervention_plans["is_active"] = ~intervention_plans["status"].astype(str).str.lower().isin(
        ["achieved", "completed", "cancelled", "closed"]
    )
    plan_agg = (
        intervention_plans.groupby("resident_id", dropna=False)
        .agg(
            total_plans=("resident_id", "size"),
            pct_plans_achieved=("is_achieved", "mean"),
            active_plan_count=("is_active", "sum"),
        )
        .reset_index()
    )

    df = residents.merge(safehouses[["safehouse_id", "safehouse_code"]], on="safehouse_id", how="left")
    for agg_df in (session_agg, edu_agg, health_agg, incident_agg, plan_agg):
        df = df.merge(agg_df, on="resident_id", how="left")

    present_age_numeric = pd.to_numeric(
        df["present_age"].astype(str).str.extract(r"(\d+)")[0] if "present_age" in df.columns else pd.Series(dtype=float),
        errors="coerce",
    )
    admission_dates = pd.to_datetime(df["date_of_admission"], errors="coerce", utc=True)
    now_utc = pd.Timestamp.utcnow()

    df = df.assign(
        safehouse_id=df["safehouse_code"].fillna("Unknown"),
        age_at_entry=present_age_numeric.clip(lower=10, upper=25).fillna(15).astype(int),
        days_in_program=((now_utc - admission_dates).dt.total_seconds().fillna(0) / 86400).clip(lower=0),
        referral_source=df.get("referral_source", pd.Series(index=df.index, dtype=object)).fillna("Unknown"),
        current_risk_level=df.get("current_risk_level", pd.Series(index=df.index, dtype=object)).fillna("Unknown"),
        reintegration_type=df.get("reintegration_type", pd.Series(index=df.index, dtype=object)).fillna("Unknown"),
        case_status=df.get("case_status", pd.Series(index=df.index, dtype=object)).fillna("Unknown"),
        latest_attendance_rate=0.0,
        pct_psych_checkup_done=0.0,
        total_sessions=df["total_sessions"].fillna(0.0),
        pct_progress_noted=df["pct_progress_noted"].fillna(0.0),
        pct_concerns_flagged=df["pct_concerns_flagged"].fillna(0.0),
        avg_progress_percent=df["avg_progress_percent"].fillna(0.0),
        avg_general_health_score=df["avg_general_health_score"].fillna(5.0).clip(lower=1.0, upper=10.0),
        num_health_records=df["num_health_records"].fillna(0.0),
        total_incidents=df["total_incidents"].fillna(0.0),
        num_severe_incidents=df["num_severe_incidents"].fillna(0.0),
        total_plans=df["total_plans"].fillna(0.0),
        pct_plans_achieved=df["pct_plans_achieved"].fillna(0.0),
        active_plan_count=df["active_plan_count"].fillna(0.0),
    )

    for col in NUM_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["target"] = (df["reintegration_status"] == "Completed").astype(int)
    df = df[(df["target"] == 1) | (df["days_in_program"] >= OBS_HORIZON_DAYS)].copy()
    return df[["resident_id", "reintegration_status", "target", *FEATURE_COLS]].reset_index(drop=True)


def load_live_dataset(password: str) -> pd.DataFrame:
    conn = psycopg2.connect(
        host="eban-haven-db.postgres.database.azure.com",
        port=5432,
        dbname="postgres",
        user="havendb",
        password=password,
        sslmode="require",
        connect_timeout=20,
    )
    try:
        residents = pd.read_sql_query(
            """
            SELECT resident_id, safehouse_id, present_age, date_of_admission, reintegration_status, current_risk_level, reintegration_type, case_status
            FROM residents
            WHERE resident_id IS NOT NULL
            """,
            conn,
        )
        safehouses = pd.read_sql_query(
            "SELECT safehouse_id, safehouse_code FROM safehouses",
            conn,
        )
        process_recordings = pd.read_sql_query(
            "SELECT resident_id, progress_noted, concerns_flagged FROM process_recordings",
            conn,
        )
        education_records = pd.read_sql_query(
            "SELECT resident_id, progress_percent FROM education_records",
            conn,
        )
        health_records = pd.read_sql_query(
            "SELECT resident_id, general_health_score FROM health_wellbeing_records",
            conn,
        )
        incident_reports = pd.read_sql_query(
            "SELECT resident_id, severity FROM incident_reports",
            conn,
        )
        intervention_plans = pd.read_sql_query(
            "SELECT resident_id, status FROM intervention_plans",
            conn,
        )
    finally:
        conn.close()
    return _assemble_dataset(
        residents,
        safehouses,
        process_recordings,
        education_records,
        health_records,
        incident_reports,
        intervention_plans,
    )


def load_snapshot_dataset() -> pd.DataFrame:
    residents = pd.read_csv(DATA_DIR / "residents.csv")
    safehouses = pd.read_csv(DATA_DIR / "safehouses.csv")
    process_recordings = pd.read_csv(DATA_DIR / "process_recordings.csv")
    education_records = pd.read_csv(DATA_DIR / "education_records.csv")
    health_records = pd.read_csv(DATA_DIR / "health_wellbeing_records.csv")
    incident_reports = pd.read_csv(DATA_DIR / "incident_reports.csv")
    intervention_plans = pd.read_csv(DATA_DIR / "intervention_plans.csv")
    return _assemble_dataset(
        residents,
        safehouses,
        process_recordings,
        education_records,
        health_records,
        incident_reports,
        intervention_plans,
    )


def load_dataset_from_environment(prompt_if_missing: bool = False) -> tuple[pd.DataFrame, str]:
    conn_str = os.getenv("HAVEN_DB_CONN")
    if conn_str:
        conn = psycopg2.connect(conn_str)
        try:
            residents = pd.read_sql_query(
                "SELECT resident_id, safehouse_id, present_age, date_of_admission, reintegration_status, current_risk_level, reintegration_type, case_status FROM residents",
                conn,
            )
            safehouses = pd.read_sql_query("SELECT safehouse_id, safehouse_code FROM safehouses", conn)
            process_recordings = pd.read_sql_query("SELECT resident_id, progress_noted, concerns_flagged FROM process_recordings", conn)
            education_records = pd.read_sql_query("SELECT resident_id, progress_percent FROM education_records", conn)
            health_records = pd.read_sql_query("SELECT resident_id, general_health_score FROM health_wellbeing_records", conn)
            incident_reports = pd.read_sql_query("SELECT resident_id, severity FROM incident_reports", conn)
            intervention_plans = pd.read_sql_query("SELECT resident_id, status FROM intervention_plans", conn)
        finally:
            conn.close()
        return (
            _assemble_dataset(
                residents,
                safehouses,
                process_recordings,
                education_records,
                health_records,
                incident_reports,
                intervention_plans,
            ),
            "azure_postgresql",
        )

    if prompt_if_missing:
        try:
            password = getpass.getpass("Azure DB password (leave blank to use CSV snapshot): ")
        except Exception:
            password = ""
        if password:
            return load_live_dataset(password), "azure_postgresql"

    return load_snapshot_dataset(), "csv_snapshot"


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                CAT_COLS,
            ),
            (
                "num",
                Pipeline([("imputer", SimpleImputer(strategy="median"))]),
                NUM_COLS,
            ),
        ],
        remainder="drop",
    )


def evaluate_models(X: pd.DataFrame, y: pd.Series) -> tuple[str, dict[str, dict[str, float]]]:
    preprocess = build_preprocessor()
    candidates = {
        "logreg": LogisticRegression(C=1.0, class_weight="balanced", max_iter=500, random_state=RANDOM_STATE),
        "gbm": GradientBoostingClassifier(
            random_state=RANDOM_STATE,
            n_estimators=120,
            learning_rate=0.05,
            max_depth=2,
        ),
        "rf": RandomForestClassifier(
            random_state=RANDOM_STATE,
            n_estimators=250,
            max_depth=5,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
        ),
    }

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    results: dict[str, dict[str, float]] = {}

    for name, model in candidates.items():
        pipe = Pipeline([("preprocess", preprocess), ("model", model)])
        cv_scores = cross_validate(pipe, X, y, cv=cv, scoring={"roc_auc": "roc_auc", "f1": "f1"})
        train_probs = cross_val_predict(pipe, X_train, y_train, cv=cv, method="predict_proba")[:, 1]

        best_threshold = 0.5
        best_f0_5 = -1.0
        for threshold in np.unique(np.round(train_probs, 4)):
            preds = (train_probs >= threshold).astype(int)
            score = fbeta_score(y_train, preds, beta=0.5, zero_division=0)
            if score > best_f0_5:
                best_f0_5 = score
                best_threshold = float(threshold)

        pipe.fit(X_train, y_train)
        test_probs = pipe.predict_proba(X_test)[:, 1]
        test_preds = (test_probs >= best_threshold).astype(int)

        results[name] = {
            "best_threshold": best_threshold,
            "roc_auc_test": float(roc_auc_score(y_test, test_probs)),
            "f0_5_test": float(fbeta_score(y_test, test_preds, beta=0.5, zero_division=0)),
            "precision_test": float(precision_score(y_test, test_preds, zero_division=0)),
            "recall_test": float(recall_score(y_test, test_preds, zero_division=0)),
            "cv_roc_auc_mean": float(np.mean(cv_scores["test_roc_auc"])),
            "cv_f1_mean": float(np.mean(cv_scores["test_f1"])),
        }

    best_name = max(results, key=lambda name: (results[name]["f0_5_test"], results[name]["roc_auc_test"]))
    return best_name, results


def fit_final_model(best_name: str, X: pd.DataFrame, y: pd.Series) -> Pipeline:
    preprocess = build_preprocessor()
    if best_name == "logreg":
        model = LogisticRegression(C=1.0, class_weight="balanced", max_iter=500, random_state=RANDOM_STATE)
    elif best_name == "gbm":
        model = GradientBoostingClassifier(
            random_state=RANDOM_STATE,
            n_estimators=120,
            learning_rate=0.05,
            max_depth=2,
        )
    else:
        model = RandomForestClassifier(
            random_state=RANDOM_STATE,
            n_estimators=250,
            max_depth=5,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
        )

    pipeline = Pipeline([("preprocess", preprocess), ("model", model)])
    pipeline.fit(X, y)
    return pipeline


def main() -> None:
    df, source = load_dataset_from_environment(prompt_if_missing=True)
    data_warning = (
        "Primary training source is the live Azure PostgreSQL case-management database. This artifact was trained on that primary source."
        if source == "azure_postgresql"
        else "Primary training source is Azure PostgreSQL; this run used the committed CSV snapshot fallback because no live DB connection was provided."
    )

    X = df[FEATURE_COLS].copy()
    y = df["target"].astype(int).copy()

    best_name, results = evaluate_models(X, y)
    pipeline = fit_final_model(best_name, X, y)

    benchmarks = (
        df.loc[df["target"] == 1, NUM_COLS]
        .median(numeric_only=True)
        .fillna(0.0)
        .to_dict()
    )

    metadata = {
        "model_name": f"reintegration_readiness_{best_name}",
        "model_version": "4.0.0",
        "trained_on": pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
        "target": f"reintegration_status == Completed among residents with >= {OBS_HORIZON_DAYS} observed days or completed exit",
        "labeling_strategy": (
            f"Mature-cohort readiness model: positives are completed reintegrations; "
            f"negatives are residents with at least {OBS_HORIZON_DAYS} days in programme who have not completed."
        ),
        "feature_columns": FEATURE_COLS,
        "categorical_features": CAT_COLS,
        "numeric_features": NUM_COLS,
        "best_threshold": round(results[best_name]["best_threshold"], 4),
        "roc_auc_test": round(results[best_name]["roc_auc_test"], 4),
        "f0_5_test": round(results[best_name]["f0_5_test"], 4),
        "precision_test": round(results[best_name]["precision_test"], 4),
        "recall_test": round(results[best_name]["recall_test"], 4),
        "cv_roc_auc_mean": round(results[best_name]["cv_roc_auc_mean"], 4),
        "cv_f1_mean": round(results[best_name]["cv_f1_mean"], 4),
        "n_training_samples": int(len(df)),
        "n_positive_total": int(y.sum()),
        "n_negative_total": int((1 - y).sum()),
        "observation_horizon_days": OBS_HORIZON_DAYS,
        "class_balance_positive_rate": round(float(y.mean()), 4),
        "data_source": source,
        "primary_data_source": "azure_postgresql",
        "fallback_data_source": "csv_snapshot",
        "data_source_role": "primary" if source == "azure_postgresql" else "fallback_only",
        "model_candidates": {
            name: {metric: round(value, 4) for metric, value in metrics.items()}
            for name, metrics in results.items()
        },
        "benchmark_medians": {feature: round(float(value), 4) for feature, value in benchmarks.items()},
        "data_warning": (
            f"{data_warning} Mature cohort filter: {OBS_HORIZON_DAYS}+ days. "
            "Feature contract matches the enriched resident payload served by the web app."
        ),
    }

    joblib.dump(pipeline, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))

    print(f"selected_model={best_name}")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
