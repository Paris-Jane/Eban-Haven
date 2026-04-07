"""
app.py — Unified FastAPI prediction service for Eban-Haven ML pipelines.
Serves both the Reintegration Readiness and Donor Churn models.

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
_churn_model, _churn_meta   = _load("donor_churn_model.joblib",     "donor_churn_metadata.json")

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Eban-Haven ML Service",
    description="Reintegration Readiness + Donor Churn prediction endpoints.",
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
        }
    }

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

class ReintegrationResponse(BaseModel):
    resident_id:                Optional[int]
    reintegration_probability:  float
    prediction:                 str
    risk_tier:                  str
    threshold_used:             float

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
    )

# ── Donor Churn ────────────────────────────────────────────────────────────────

class DonorFeatures(BaseModel):
    supporter_id:             Optional[int]  = None
    supporter_type:           str
    total_donations:          float          = Field(..., ge=0)
    total_amount_php:         float          = Field(..., ge=0)
    months_since_last_gift:   float          = Field(..., ge=0)
    avg_gift_amount:          float          = Field(..., ge=0)
    donation_frequency:       float          = Field(..., ge=0)
    is_recurring:             float          = Field(..., ge=0.0, le=1.0)
    num_campaigns:            float          = Field(..., ge=0)
    channel_diversity:        float          = Field(..., ge=0)

class DonorChurnResponse(BaseModel):
    supporter_id:      Optional[int]
    churn_probability: float
    prediction:        str
    risk_tier:         str
    threshold_used:    float

@app.post("/predict/donor-churn", response_model=DonorChurnResponse)
def predict_churn(features: DonorFeatures):
    threshold = _churn_meta["best_threshold"]
    try:
        row  = features.model_dump()
        df   = pd.DataFrame([row])[_churn_meta["feature_columns"]]
        prob = float(_churn_model.predict_proba(df)[0, 1])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    prediction = "Likely to Churn" if prob >= threshold else "Likely to Retain"
    risk_tier  = "High Risk" if prob >= 0.70 else ("Moderate Risk" if prob >= threshold else "Low Risk")

    return DonorChurnResponse(
        supporter_id=features.supporter_id,
        churn_probability=round(prob, 4),
        prediction=prediction,
        risk_tier=risk_tier,
        threshold_used=round(threshold, 4),
    )
