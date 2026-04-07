"""
donor_churn_service.py — FastAPI prediction microservice for Donor Churn model.
Runs independently on port 8002 (separate from predict_service.py on 8001).

Start:
    uvicorn donor_churn_service:app --host 0.0.0.0 --port 8002

Dependencies:
    pip install fastapi uvicorn joblib scikit-learn pandas numpy
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

# ── Load model at startup ──────────────────────────────────────────────────────
_BASE          = Path(__file__).parent
_MODEL_PATH    = _BASE / "donor_churn_model.joblib"
_METADATA_PATH = _BASE / "donor_churn_metadata.json"

if not _MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found at {_MODEL_PATH}. "
        "Run donor-churn-predictor.ipynb top-to-bottom first."
    )

_model = joblib.load(_MODEL_PATH)

with open(_METADATA_PATH) as f:
    _meta = json.load(f)

_THRESHOLD    : float     = _meta["best_threshold"]
_FEATURE_COLS : list[str] = _meta["feature_columns"]


# ── Pydantic schemas ───────────────────────────────────────────────────────────
class SupporterFeatures(BaseModel):
    supporter_id              : Optional[int]   = Field(None)
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
    acquisition_channel       : str             = Field(...)
    supporter_type            : str             = Field(...)
    relationship_type         : str             = Field(...)


class ChurnPredictionResponse(BaseModel):
    supporter_id      : Optional[int]
    churn_probability : float
    prediction        : str         # "At Risk" | "Stable"
    risk_tier         : str         # "High Risk" | "Moderate Risk" | "Low Risk"
    threshold_used    : float
    top_risk_signals  : list[str]


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Donor Churn Prediction API",
    description="Predicts churn probability for individual or batches of supporters.",
    version=_meta.get("model_version", "1.0.0"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO: narrow to your Azure backend URL in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────────
def _risk_signals(f: SupporterFeatures) -> list[str]:
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


def _score(features: SupporterFeatures) -> ChurnPredictionResponse:
    row = features.model_dump()
    df  = pd.DataFrame([row])[_FEATURE_COLS]
    prob = float(_model.predict_proba(df)[0, 1])

    prediction = "At Risk" if prob >= _THRESHOLD else "Stable"
    if prob >= 0.75:
        risk_tier = "High Risk"
    elif prob >= _THRESHOLD:
        risk_tier = "Moderate Risk"
    else:
        risk_tier = "Low Risk"

    return ChurnPredictionResponse(
        supporter_id      = features.supporter_id,
        churn_probability = round(prob, 4),
        prediction        = prediction,
        risk_tier         = risk_tier,
        threshold_used    = round(_THRESHOLD, 4),
        top_risk_signals  = _risk_signals(features),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    return {
        "status":       "ok",
        "model":        _meta["model_name"],
        "version":      _meta["model_version"],
        "roc_auc_test": _meta["roc_auc_test"],
        "threshold":    _THRESHOLD,
    }


@app.post("/predict", response_model=ChurnPredictionResponse)
def predict(features: SupporterFeatures) -> ChurnPredictionResponse:
    try:
        return _score(features)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict-batch", response_model=list[ChurnPredictionResponse])
def predict_batch(features_list: list[SupporterFeatures]) -> list[ChurnPredictionResponse]:
    """
    Score multiple supporters in a single call.
    The .NET API uses this endpoint to avoid N individual HTTP calls.
    Returns all results (caller filters by threshold / limit).
    """
    if not features_list:
        return []
    try:
        rows = [f.model_dump() for f in features_list]
        df   = pd.DataFrame(rows)[_FEATURE_COLS]
        probs = _model.predict_proba(df)[:, 1]

        results = []
        for f, prob in zip(features_list, probs):
            prob = float(prob)
            prediction = "At Risk" if prob >= _THRESHOLD else "Stable"
            if prob >= 0.75:
                risk_tier = "High Risk"
            elif prob >= _THRESHOLD:
                risk_tier = "Moderate Risk"
            else:
                risk_tier = "Low Risk"
            results.append(ChurnPredictionResponse(
                supporter_id      = f.supporter_id,
                churn_probability = round(prob, 4),
                prediction        = prediction,
                risk_tier         = risk_tier,
                threshold_used    = round(_THRESHOLD, 4),
                top_risk_signals  = _risk_signals(f),
            ))
        return results
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
