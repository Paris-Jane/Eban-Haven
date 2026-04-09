"""
app.py — Unified FastAPI prediction service for Eban-Haven ML pipelines.
Serves the Reintegration Readiness, Donor Churn, Donor Upgrade Propensity,
and Marketing Analysis pipelines.

Start locally:
    uvicorn app:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

_BASE = Path(__file__).parent

# ── Load models at startup ─────────────────────────────────────────────────────

def _load(model_file: str, meta_file: str):
    mp = _BASE / model_file
    mj = _BASE / meta_file
    if not mp.exists():
        raise FileNotFoundError(f"Model not found: {mp}")
    return joblib.load(mp), json.loads(mj.read_text())

_reint_model, _reint_meta   = _load("reintegration_model.joblib",  "reintegration_model_metadata.json")

# Build feature-importance lookup.
# The model may be a raw estimator or a Pipeline; importances live on the
# final estimator in either case.  If the importance vector length doesn't
# match feature_columns (e.g. after OHE expansion), fall back to equal weights
# so the service always starts and gap analysis degrades gracefully.
def _extract_importances(model) -> list[float]:
    # Raw estimator
    if hasattr(model, "feature_importances_"):
        return model.feature_importances_.tolist()
    # sklearn Pipeline — try last step
    if hasattr(model, "steps"):
        for _, step in reversed(model.steps):
            if hasattr(step, "feature_importances_"):
                return step.feature_importances_.tolist()
    # Named attribute fallback (e.g. model[-1])
    try:
        return model[-1].feature_importances_.tolist()
    except Exception:
        pass
    return []

_raw_importances = _extract_importances(_reint_model)
_feature_cols    = _reint_meta["feature_columns"]
if len(_raw_importances) == len(_feature_cols):
    _reint_feature_importance: dict[str, float] = dict(zip(_feature_cols, _raw_importances))
else:
    # Lengths differ (OHE or unknown structure) — equal weight so gaps still rank
    _reint_feature_importance = {f: 1.0 for f in _feature_cols}

# Features where a higher resident value is better — gap = benchmark - resident
# Features NOT in this list are "lower is better" — gap = resident - benchmark
_HIGHER_IS_BETTER = {
    "days_in_program", "total_sessions", "pct_progress_noted",
    "latest_attendance_rate", "avg_progress_percent", "avg_general_health_score",
    "pct_psych_checkup_done", "num_health_records", "total_plans", "pct_plans_achieved",
}

_FEATURE_LABELS: dict[str, str] = {
    "days_in_program":          "Time in programme",
    "total_sessions":           "Counselling sessions",
    "pct_progress_noted":       "Session progress rate",
    "pct_concerns_flagged":     "Concern rate",
    "latest_attendance_rate":   "Programme attendance",
    "avg_progress_percent":     "Educational progress",
    "avg_general_health_score": "General health score",
    "pct_psych_checkup_done":   "Psych check-up rate",
    "num_health_records":       "Health records",
    "total_incidents":          "Total incidents",
    "num_severe_incidents":     "Severe incidents",
    "total_plans":              "Intervention plans",
    "pct_plans_achieved":       "Plans achieved",
}

_FEATURE_SUGGESTIONS: dict[str, str] = {
    "days_in_program":          "Continue the resident in the programme to build stability and skills over time.",
    "total_sessions":           "Schedule additional counselling or therapeutic sessions.",
    "pct_progress_noted":       "Ensure progress is consistently documented in each session.",
    "pct_concerns_flagged":     "Address outstanding concerns raised during sessions with the resident.",
    "latest_attendance_rate":   "Work with the resident to improve programme attendance.",
    "avg_progress_percent":     "Develop a focused education or skills plan to boost academic progress.",
    "avg_general_health_score": "Arrange a health assessment and follow-up medical support.",
    "pct_psych_checkup_done":   "Book pending psychological check-ups with the resident.",
    "num_health_records":       "Increase the frequency of health monitoring and record-keeping.",
    "total_incidents":          "Review recent incidents and implement a behaviour support plan.",
    "num_severe_incidents":     "Prioritise de-escalation support and address root causes of severe incidents.",
    "total_plans":              "Create additional targeted intervention plans with the resident.",
    "pct_plans_achieved":       "Review unmet intervention goals and adjust plans to improve completion rates.",
}
_churn_model, _churn_meta   = _load("donor_churn_model.joblib",     "donor_churn_metadata.json")

# Upgrade propensity model — optional until notebook has been run
_upgrade_model_path = _BASE / "donor_upgrade_model.joblib"
_upgrade_meta_path  = _BASE / "donor_upgrade_metadata.json"
try:
    if _upgrade_model_path.exists() and _upgrade_meta_path.exists():
        _upgrade_model, _upgrade_meta = _load("donor_upgrade_model.joblib", "donor_upgrade_metadata.json")
    else:
        _upgrade_model, _upgrade_meta = None, json.loads(_upgrade_meta_path.read_text()) if _upgrade_meta_path.exists() else {}
except Exception as _upgrade_load_err:
    print(f"WARNING: Could not load donor_upgrade_model.joblib ({_upgrade_load_err}). Upgrade endpoint will return 503.")
    _upgrade_model = None
    _upgrade_meta  = json.loads(_upgrade_meta_path.read_text()) if _upgrade_meta_path.exists() else {}

# Marketing analysis metadata (generated by marketing-campaign-analysis.ipynb)
_marketing_meta_path = _BASE / "marketing_analysis_metadata.json"
_marketing_meta: dict = json.loads(_marketing_meta_path.read_text()) if _marketing_meta_path.exists() else {}

# Social post strategy metadata (generated by social-post-strategy-analysis.ipynb)
_social_post_strategy_meta_path = _BASE / "social_post_strategy_metadata.json"
_social_post_strategy_meta: dict = (
    json.loads(_social_post_strategy_meta_path.read_text())
    if _social_post_strategy_meta_path.exists()
    else {}
)

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Eban-Haven ML Service",
    description="Reintegration Readiness, Donor Churn, and Marketing Analysis endpoints.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Narrowed to Azure backend URL in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            "reintegration_readiness": _reint_meta.get("model_version", "1.0.0"),
            "donor_churn":             _churn_meta.get("model_version",  "1.0.0"),
            "donor_upgrade_propensity": _upgrade_meta.get("model_version", "not_trained") if _upgrade_model else "not_trained",
        },
        "analyses": {
            "marketing_campaign": _marketing_meta.get("pipeline_version", "not_run"),
            "social_post_strategy": _social_post_strategy_meta.get("pipeline_version", "not_run"),
        }
    }

# ── Marketing Campaign Analysis ────────────────────────────────────────────────

@app.get("/marketing/campaign-analysis")
def get_marketing_analysis():
    """
    Returns pre-computed causal estimates from marketing-campaign-analysis.ipynb.
    Re-run the notebook to refresh these results after each campaign.
    Returns 503 if the notebook has not been run yet.
    """
    if not _marketing_meta or _marketing_meta.get("last_run") is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="Marketing analysis has not been run yet. Execute marketing-campaign-analysis.ipynb to generate results."
        )
    return _marketing_meta

@app.get("/marketing/post-strategy-analysis")
def get_social_post_strategy_analysis():
    """
    Returns pre-computed post-level strategy findings from social-post-strategy-analysis.ipynb.
    If the notebook has not been run yet, returns the scaffold metadata so the app can
    surface current data gaps and instrumentation recommendations without inventing findings.
    """
    if not _social_post_strategy_meta:
        raise HTTPException(
            status_code=503,
            detail="Social post strategy analysis metadata is missing. Execute social-post-strategy-analysis.ipynb to generate results."
        )
    return _social_post_strategy_meta

# ── Reintegration Readiness ────────────────────────────────────────────────────

class ResidentFeatures(BaseModel):
    resident_id:              Optional[int]   = None
    safehouse_id:             str
    age_at_entry:             int             = Field(..., ge=10, le=25)
    days_in_program:          int             = Field(..., ge=0)
    referral_source:          str
    total_sessions:           float           = Field(..., ge=0)
    pct_progress_noted:       float           = Field(..., ge=0.0, le=1.0)
    pct_concerns_flagged:     float           = Field(..., ge=0.0, le=1.0)
    latest_attendance_rate:   float           = Field(..., ge=0.0, le=1.0)
    avg_progress_percent:     float           = Field(..., ge=0.0, le=100.0)
    avg_general_health_score: float           = Field(..., ge=1.0, le=10.0)
    pct_psych_checkup_done:   float           = Field(..., ge=0.0, le=1.0)
    num_health_records:       float           = Field(..., ge=0)
    total_incidents:          float           = Field(..., ge=0)
    num_severe_incidents:     float           = Field(..., ge=0)
    total_plans:              float           = Field(..., ge=0)
    pct_plans_achieved:       float           = Field(..., ge=0.0, le=1.0)

class ImprovementArea(BaseModel):
    feature:         str
    label:           str
    resident_value:  float
    benchmark_value: float
    gap_score:       float
    suggestion:      str

class ReintegrationResponse(BaseModel):
    resident_id:                Optional[int]
    reintegration_probability:  float
    prediction:                 str
    risk_tier:                  str
    threshold_used:             float
    top_improvements:           list[ImprovementArea]

def _compute_improvements(features: ResidentFeatures) -> list[ImprovementArea]:
    """Return top 3 actionable features ranked by importance-weighted gap from benchmark."""
    benchmarks: dict[str, float] = _reint_meta.get("benchmark_medians", {})
    row        = features.model_dump()
    improvements: list[ImprovementArea] = []

    for feature, benchmark in benchmarks.items():
        resident_value = float(row.get(feature, 0.0))
        importance     = _reint_feature_importance.get(feature, 0.0)

        if feature in _HIGHER_IS_BETTER:
            gap = benchmark - resident_value        # positive = resident lags
        else:
            gap = resident_value - benchmark        # positive = resident worse than benchmark

        if gap <= 0:
            continue                                # resident already meets or exceeds benchmark

        gap_score = round(importance * gap, 6)
        improvements.append(ImprovementArea(
            feature=feature,
            label=_FEATURE_LABELS.get(feature, feature),
            resident_value=round(resident_value, 4),
            benchmark_value=round(benchmark, 4),
            gap_score=round(gap_score, 6),
            suggestion=_FEATURE_SUGGESTIONS.get(feature, ""),
        ))

    improvements.sort(key=lambda x: x.gap_score, reverse=True)
    return improvements[:3]

@app.post("/predict/reintegration-readiness", response_model=ReintegrationResponse)
def predict_reintegration(features: ResidentFeatures):
    threshold = _reint_meta["best_threshold"]
    try:
        row  = features.model_dump()
        df   = pd.DataFrame([row])[_reint_meta["feature_columns"]]
        prob = float(_reint_model.predict_proba(df)[0, 1])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    prediction = "Ready" if prob >= threshold else "Not Ready"
    risk_tier  = "High Readiness" if prob >= 0.70 else ("Moderate Readiness" if prob >= threshold else "Low Readiness")

    return ReintegrationResponse(
        resident_id=features.resident_id,
        reintegration_probability=round(prob, 4),
        prediction=prediction,
        risk_tier=risk_tier,
        threshold_used=round(threshold, 4),
        top_improvements=_compute_improvements(features),
    )

# ── Donor Churn ────────────────────────────────────────────────────────────────

class DonorFeatures(BaseModel):
    supporter_id              : Optional[int]   = None
    days_since_last_donation  : float           = Field(..., ge=0)
    days_since_first_donation : float           = Field(..., ge=0)
    days_since_joined         : float           = Field(..., ge=0)
    total_donations           : float           = Field(..., ge=0)
    pct_recurring             : float           = Field(..., ge=0.0, le=1.0)
    avg_days_between_donations: Optional[float] = Field(None, ge=0)
    total_amount              : float           = Field(..., ge=0)
    avg_amount                : float           = Field(..., ge=0)
    max_amount                : float           = Field(..., ge=0)
    amount_trend              : float           = Field(0.0)
    acquisition_channel       : str
    supporter_type            : str
    relationship_type         : str

class DonorChurnResponse(BaseModel):
    supporter_id      : Optional[int]
    churn_probability : float
    prediction        : str
    risk_tier         : str
    threshold_used    : float
    top_risk_signals  : list[str]

def _churn_risk_signals(f: DonorFeatures) -> list[str]:
    signals = []
    if f.days_since_last_donation > 365:
        signals.append("high_recency")
    if f.pct_recurring == 0.0:
        signals.append("zero_recurring")
    if f.amount_trend < 0:
        signals.append("negative_trend")
    if f.total_donations <= 1:
        signals.append("one_time_only")
    return signals

def _score_churn(features: DonorFeatures) -> DonorChurnResponse:
    threshold = _churn_meta["best_threshold"]
    row  = features.model_dump()
    df   = pd.DataFrame([row])[_churn_meta["feature_columns"]]
    prob = float(_churn_model.predict_proba(df)[0, 1])

    prediction = "At Risk" if prob >= threshold else "Stable"
    risk_tier  = "High Risk" if prob >= 0.75 else ("Moderate Risk" if prob >= threshold else "Low Risk")

    return DonorChurnResponse(
        supporter_id=features.supporter_id,
        churn_probability=round(prob, 4),
        prediction=prediction,
        risk_tier=risk_tier,
        threshold_used=round(threshold, 4),
        top_risk_signals=_churn_risk_signals(features),
    )

@app.post("/predict/donor-churn", response_model=DonorChurnResponse)
def predict_churn(features: DonorFeatures):
    try:
        return _score_churn(features)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/predict/donor-churn-batch", response_model=list[DonorChurnResponse])
def predict_churn_batch(features_list: list[DonorFeatures]):
    """Score multiple supporters in one call. Caller filters by threshold/limit."""
    if not features_list:
        return []
    try:
        rows  = [f.model_dump() for f in features_list]
        df    = pd.DataFrame(rows)[_churn_meta["feature_columns"]]
        probs = _churn_model.predict_proba(df)[:, 1]
        return [
            DonorChurnResponse(
                supporter_id=f.supporter_id,
                churn_probability=round(float(p), 4),
                prediction="At Risk" if float(p) >= _churn_meta["best_threshold"] else "Stable",
                risk_tier="High Risk" if float(p) >= 0.75 else (
                    "Moderate Risk" if float(p) >= _churn_meta["best_threshold"] else "Low Risk"
                ),
                threshold_used=round(_churn_meta["best_threshold"], 4),
                top_risk_signals=_churn_risk_signals(f),
            )
            for f, p in zip(features_list, probs)
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Donor Upgrade Propensity ───────────────────────────────────────────────────

class DonorUpgradeFeatures(BaseModel):
    supporter_id             : Optional[int]   = None
    days_since_last_donation : float           = Field(..., ge=0)
    total_donations          : float           = Field(..., ge=0)
    avg_amount               : float           = Field(..., ge=0)
    amount_trend             : float           = Field(0.0)
    pct_recurring            : float           = Field(..., ge=0.0, le=1.0)
    num_campaigns            : int             = Field(..., ge=0)
    acquisition_channel      : str
    relationship_type        : str

class DonorUpgradeResponse(BaseModel):
    supporter_id         : Optional[int]
    upgrade_probability  : float
    prediction           : str        # "Likely to Upgrade" | "Unlikely"
    propensity_tier      : str        # "High" | "Moderate" | "Low"
    threshold_used       : float
    top_upgrade_signals  : list[str]

def _upgrade_signals(f: DonorUpgradeFeatures) -> list[str]:
    signals = []
    if f.amount_trend > 0:
        signals.append("positive_amount_trend")
    if f.pct_recurring > 0.5:
        signals.append("majority_recurring")
    if f.num_campaigns >= 3:
        signals.append("multi_campaign_donor")
    if f.total_donations >= 5:
        signals.append("high_frequency")
    if f.relationship_type == "International":
        signals.append("international_donor")
    return signals

def _score_upgrade(f: DonorUpgradeFeatures) -> DonorUpgradeResponse:
    if _upgrade_model is None:
        raise HTTPException(
            status_code=503,
            detail="Upgrade propensity model not trained yet. Run donor-upgrade-propensity.ipynb first.",
        )
    threshold = _upgrade_meta["best_threshold"]
    row  = f.model_dump()
    df   = pd.DataFrame([row])[_upgrade_meta["feature_columns"]]
    prob = float(_upgrade_model.predict_proba(df)[0, 1])

    prediction = "Likely to Upgrade" if prob >= threshold else "Unlikely"
    tier       = "High" if prob >= 0.70 else ("Moderate" if prob >= threshold else "Low")

    return DonorUpgradeResponse(
        supporter_id        = f.supporter_id,
        upgrade_probability = round(prob, 4),
        prediction          = prediction,
        propensity_tier     = tier,
        threshold_used      = round(threshold, 4),
        top_upgrade_signals = _upgrade_signals(f),
    )

@app.post("/predict/donor-upgrade-propensity", response_model=DonorUpgradeResponse)
def predict_upgrade(features: DonorUpgradeFeatures):
    try:
        return _score_upgrade(features)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/predict/donor-upgrade-propensity-batch", response_model=list[DonorUpgradeResponse])
def predict_upgrade_batch(features_list: list[DonorUpgradeFeatures]):
    """Score multiple donors in one call. Returns all results sorted by upgrade_probability desc."""
    if not features_list:
        return []
    if _upgrade_model is None:
        raise HTTPException(
            status_code=503,
            detail="Upgrade propensity model not trained yet. Run donor-upgrade-propensity.ipynb first.",
        )
    try:
        threshold = _upgrade_meta["best_threshold"]
        rows  = [f.model_dump() for f in features_list]
        df    = pd.DataFrame(rows)[_upgrade_meta["feature_columns"]]
        probs = _upgrade_model.predict_proba(df)[:, 1]
        results = [
            DonorUpgradeResponse(
                supporter_id        = f.supporter_id,
                upgrade_probability = round(float(p), 4),
                prediction          = "Likely to Upgrade" if float(p) >= threshold else "Unlikely",
                propensity_tier     = "High" if float(p) >= 0.70 else ("Moderate" if float(p) >= threshold else "Low"),
                threshold_used      = round(threshold, 4),
                top_upgrade_signals = _upgrade_signals(f),
            )
            for f, p in zip(features_list, probs)
        ]
        return sorted(results, key=lambda r: r.upgrade_probability, reverse=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
