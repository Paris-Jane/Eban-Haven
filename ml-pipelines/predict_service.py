"""
predict_service.py — FastAPI prediction microservice for Reintegration Readiness model.

Start:
    uvicorn predict_service:app --host 0.0.0.0 --port 8001

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
_BASE = Path(__file__).parent
_MODEL_PATH    = _BASE / "reintegration_model.joblib"
_METADATA_PATH = _BASE / "reintegration_model_metadata.json"

if not _MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model file not found at {_MODEL_PATH}. "
        "Run the notebook top-to-bottom first to generate it."
    )

_model = joblib.load(_MODEL_PATH)

with open(_METADATA_PATH) as f:
    _meta = json.load(f)

_THRESHOLD    : float     = _meta["best_threshold"]
_FEATURE_COLS : list[str] = _meta["feature_columns"]


# ── Pydantic schemas ───────────────────────────────────────────────────────────
class ResidentFeatures(BaseModel):
    resident_id            : Optional[int]   = Field(None,  description="DB primary key (optional, echoed back)")
    safehouse_id           : str             = Field(...,   description="e.g. 'SH001'")
    age_at_entry           : int             = Field(...,   ge=10, le=25)
    days_in_program        : int             = Field(...,   ge=0)
    referral_source        : str             = Field(...,   description="e.g. 'NGO Partner'")
    total_sessions         : float           = Field(...,   ge=0)
    pct_progress_noted     : float           = Field(...,   ge=0.0, le=1.0)
    pct_concerns_flagged   : float           = Field(...,   ge=0.0, le=1.0)
    latest_attendance_rate : float           = Field(...,   ge=0.0, le=1.0)
    avg_progress_percent   : float           = Field(...,   ge=0.0, le=100.0)
    avg_general_health_score : float         = Field(...,   ge=1.0, le=10.0)
    pct_psych_checkup_done : float           = Field(...,   ge=0.0, le=1.0)
    num_health_records     : float           = Field(...,   ge=0)
    total_incidents        : float           = Field(...,   ge=0)
    num_severe_incidents   : float           = Field(...,   ge=0)
    total_plans            : float           = Field(...,   ge=0)
    pct_plans_achieved     : float           = Field(...,   ge=0.0, le=1.0)


class PredictionResponse(BaseModel):
    resident_id                : Optional[int]
    reintegration_probability  : float
    prediction                 : str   # "Ready" | "Not Ready"
    risk_tier                  : str   # "High Readiness" | "Moderate Readiness" | "Low Readiness"
    threshold_used             : float


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Reintegration Readiness API",
    description="Predicts probability that a resident is ready for reintegration.",
    version=_meta.get("model_version", "1.0.0"),
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# In production, replace "*" with your Azure backend origin, e.g.:
#   allow_origins=["https://your-app.azurewebsites.net"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # TODO: narrow to your Azure backend URL
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status":  "ok",
        "model":   _meta["model_name"],
        "version": _meta["model_version"],
        "roc_auc_test": _meta["roc_auc_test"],
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(features: ResidentFeatures) -> PredictionResponse:
    try:
        row = features.model_dump()
        df  = pd.DataFrame([row])[_FEATURE_COLS]
        prob = float(_model.predict_proba(df)[0, 1])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    prediction = "Ready" if prob >= _THRESHOLD else "Not Ready"

    if prob >= 0.70:
        risk_tier = "High Readiness"
    elif prob >= _THRESHOLD:
        risk_tier = "Moderate Readiness"
    else:
        risk_tier = "Low Readiness"

    return PredictionResponse(
        resident_id               = features.resident_id,
        reintegration_probability = round(prob, 4),
        prediction                = prediction,
        risk_tier                 = risk_tier,
        threshold_used            = round(_THRESHOLD, 4),
    )
