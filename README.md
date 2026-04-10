# Eban Haven — full-stack application

Monorepo for the Eban Haven program platform: **resident case management** (safehouses, health, education, counseling sessions, home visits, incidents, intervention plans), **donor and contributions** tracking, **admin dashboards and reports**, and supporting **ML / analytics** notebooks.

## Repository layout

| Path | Description |
|------|-------------|
| `backend/EbanHaven.Api` | ASP.NET Core **.NET 10** REST API (`/api/...`). Uses **PostgreSQL** via EF Core when a Supabase connection string is configured; otherwise falls back to an in-memory **Lighthouse** CSV-backed store for local development. |
| `frontend` | **React 19**, **Vite 8**, **TypeScript**, **Tailwind CSS 4** SPA. Admin and public routes; API calls go to `/api` (proxied in dev) or `VITE_API_BASE_URL` in production. |
| `ml-pipelines` | Jupyter notebooks and data notes (e.g. reintegration readiness feature alignment). |
| `deployment` | Deployment-related scripts and references. |

Solution file: `EbanHaven.sln`.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (LTS 20+ recommended)
- Optional: **PostgreSQL** / [Supabase](https://supabase.com/) project and connection string for full persistence (see below)

## Backend (API)

```bash
cd backend/EbanHaven.Api
dotnet restore
dotnet run
```

Default **HTTP** profile listens on **http://localhost:5277** (see `Properties/launchSettings.json`).

### Configuration

Use `appsettings.Development.json`, environment variables, or [.NET user secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets) for local values. Typical sections include:

- **Database:** `ConnectionStrings:Supabase` (or `SupaBaseConnection`) — Npgsql connection string when using Supabase/Postgres.
- **Auth:** JWT issuer/secret, staff credentials, Google sign-in (`Authentication:Google` or `GoogleAuth`), Supabase JWT validation if applicable.
- **Integrations (optional):** OpenAI, Gmail, Meta, etc., depending on features you enable.

If no database connection string is set, the API runs against the **in-memory Lighthouse** adapter so you can still explore endpoints without Postgres.

## Frontend (web)

```bash
cd frontend
npm install
npm run dev
```

Development server proxies **`/api`** to **http://localhost:5277** (see `vite.config.ts`), so run the API locally for full stack, or point the app at a deployed API.

### Environment variables

Copy `frontend/.env.example` to `frontend/.env` and adjust:

- **`VITE_API_BASE_URL`** — Base URL of the .NET API in production (omit or leave unset locally to use the Vite proxy).
- **`VITE_GOOGLE_CLIENT_ID`** — Optional; enables Google sign-in in the browser (must match server Google OAuth client configuration).
- Other variables in `.env.example` as needed for Supabase-direct modes or hosting.

## Builds

```bash
# Frontend (output in frontend/dist)
cd frontend && npm run build

# Backend
cd backend/EbanHaven.Api && dotnet build -c Release
```

## Other scripts

- **`frontend`:** `npm run import:lighthouse` — CSV → Supabase/Lighthouse import helper (requires env vars documented in the script).

## ML / data

See `ml-pipelines/data/README.md` for dataset notes. Notebooks under `ml-pipelines` should stay aligned with the API’s feature contract when used for reintegration or churn models.

---

For questions or deployment specifics, extend this document with your team’s hosting URLs, branch strategy, and CI steps.
