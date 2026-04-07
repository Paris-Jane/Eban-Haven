# ─────────────────────────────────────────────────────────────────────────────
# Eban-Haven ML Service — Unified FastAPI microservice
# Serves: /predict/reintegration-readiness  +  /predict/donor-churn
# ─────────────────────────────────────────────────────────────────────────────
# Build:
#   docker build -t eban-haven-ml .
#
# Run locally:
#   docker run -p 8000:8000 eban-haven-ml
#
# Deploy to Azure Container Apps:
#   az containerapp create \
#     --name eban-haven-ml \
#     --resource-group eban-haven-rg \
#     --image <your-acr>.azurecr.io/eban-haven-ml:latest \
#     --target-port 8000 \
#     --ingress external
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Don't write .pyc files; ensure stdout/stderr aren't buffered
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (layer-cached separately from source code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy unified service + both model artifacts
COPY app.py .
COPY reintegration_model.joblib .
COPY reintegration_model_metadata.json .
COPY donor_churn_model.joblib .
COPY donor_churn_metadata.json .

EXPOSE 8000

# Liveness probe: GET /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
