# Altis Groep — Weather-Aware 13-Week Cash Flow Forecast

Liquidity forecasting platform for Altis Groep, a PE-backed Dutch roofing
portfolio. Multi-system ingestion → GL reconciliation → 5 cash drivers → 3
scenarios → role-based dashboard with a full audit trail, Claude-written reports,
and a WhatsApp assistant.

**Live**
- Frontend: https://frontend-production-5272f.up.railway.app
- Backend: https://backend-production-a629e.up.railway.app · `/api/health` · `/docs`

Demo logins (password `altis2025`): `board@altis.com` · `cfo@altis.com` ·
`md@altis.com` · `lead@altis.com`.

## What it does

- **Ingestion** — parses the accounting exports (Snelstart, Exact, Gilde, Yuki)
  into one unified `transactions` table.
- **Driver model (M1–M5)** — milestone billing, materials, subcontractors,
  collections (DSO), and **weather** (empirically calibrated) → `forecast_13w`,
  the single source of truth.
- **Scenarios** — Base / Wet quarter / Dry quarter, with covenant headroom and
  SAFE/WATCH/BREACH status.
- **Roles** — PE Board, CFO, Opco MD, Project Lead, each with its own view; JWT auth.
- **Audit trail** — every figure traces back to its driver, assumptions and source rows.
- **Reports** — weekly/monthly PDF; the prose is written by Claude over real data.
- **WhatsApp (Zavu)** — covenant alerts, scheduled digests, and an inbound bot
  that answers questions and replies with the analysis + PDF. Plus an MCP server.

## Architecture

```
data/raw/*.xlsx
  → ingestion/      (parsers per system → reconcile)
  → db/             (Postgres: unified schema, single source of truth)
  → models/         (M1 billing · M2 materials · M3 subcon · M4 collections · M5 weather → scenario_engine)
  → api/            (FastAPI: auth, forecast, covenant, audit, savings, reports, notify/WhatsApp)
  → frontend/       (React + Vite + Tailwind + Recharts: 4 role views)
  + mcp_server.py   (MCP tools over the forecast + Zavu)
  + scheduler.py    (APScheduler crons → WhatsApp)
```

`forecast_13w` is the **single source of truth** — every view reads from it.

## Quick start (local)

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL + secrets
python run.py seed              # create the 4 role users
python run.py ingest            # xlsx → Postgres
python run.py model             # M1–M5 → forecast_13w
python run.py serve             # http://localhost:8000/docs

# Frontend (another terminal)
cd frontend && npm install
cp .env.example .env            # VITE_API_URL=http://localhost:8000
npm run dev                     # http://localhost:5173
```

## Stack

- **Backend** — FastAPI · Postgres (psycopg) · pandas/numpy · APScheduler · Anthropic SDK (Claude) · fpdf2 · Zavu (WhatsApp) · MCP
- **Frontend** — React 18 · Vite · Tailwind · Recharts · html2pdf

## Deploy (Railway · project `intuitive-youthfulness`)

Three services in one project: **Postgres**, **backend**, **frontend**. Both apps
are connected to GitHub (`Santy1422/hackaton`) with root dirs `backend`/`frontend`
and auto-deploy on push to `main`. Set env vars in each service's dashboard
(`.env` is gitignored and not deployed). Register the Zavu webhook at
`<backend>/api/notify/whatsapp/webhook`.

## Docs

- `backend/README.md` — API commands, endpoints, env, deploy.
- `backend/docs/AUTH.md` — JWT auth & roles.
- `backend/docs/WEATHER.md` — two-signal weather model.
- `backend/docs/WHATSAPP.md` — Zavu, webhook, crons, templates, PDF, MCP.
- `frontend/README.md` — frontend stack, views, env, deploy.

## Notes

- `data/raw/*.xlsx` and `*.duckdb` are gitignored (real financial data).
- WhatsApp proactive sends need a Meta-approved template; inbound replies work
  within the 24h window opened when the user messages the bot (see WHATSAPP.md).
