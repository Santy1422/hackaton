# Altis Groep — Forecast API (FastAPI + Postgres)

13-week cash-flow forecast by driver, covenant headroom, WIP, and empirically
calibrated weather. JWT auth with 4 roles (PE Board · CFO · Opco MD · Project
Lead). Claude-written report narratives and a WhatsApp assistant (Zavu).

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill DATABASE_URL and secrets
```

## Commands

```bash
python run.py serve       # API on :8000  (RELOAD=1 for hot-reload in dev)
python run.py seed        # create the 4 role users (demo password: altis2025)
python run.py ingest      # parse xlsx → Postgres (transactions)
python run.py model       # run M1–M5 → forecast_13w (+ weather calibration)
python run.py calibrate   # recompute & persist the weather↔billing calibration
python run.py all         # ingest + model + serve
python mcp_server.py      # MCP server (stdio) exposing forecast + Zavu tools
```

API: http://localhost:8000 · Docs: `/docs` · Health: `/api/health`

## Endpoints (overview)

| Area | Routes |
|------|--------|
| Auth | `POST /api/auth/login` · `GET /api/auth/me` · `GET /api/auth/roles` |
| Forecast | `GET /api/forecast/{scenario}` · `/{scenario}/{opco}` · `/week/{scenario}/{week}` |
| Covenant | `GET /api/covenant/{scenario}` |
| Audit | `GET /api/audit/week/{scenario}/{week}` |
| Data | `GET /api/wip/{opco}` · `/weather` · `/milestones/{opco}` · `/actuals/*` · `/stats` · `/sources` · `/gl-mapping` |
| Savings | `GET /api/savings` |
| Reports | `POST /api/reports/narrative` (Claude prose) · `GET /api/reports/pdf/{token}` |
| WhatsApp | `POST /api/notify/whatsapp` · `/covenant/{scenario}` · `/ask` · `/forecast-ready` · `GET /whatsapp-link` · `GET/POST /automations` · `POST /whatsapp/webhook` |

Full detail: `/docs` (OpenAPI). WhatsApp/Zavu/MCP: see `docs/WHATSAPP.md`.

## Tests

```bash
pytest -q            # full suite
```

## Environment variables

See `.env.example`. Summary:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | **yes** | — | Postgres (`postgresql://…`) |
| `JWT_SECRET` | yes (prod) | dev value | token signing — **change in prod** |
| `JWT_EXPIRE_HOURS` | no | `12` | token lifetime |
| `CORS_ORIGINS` | yes (prod) | `localhost:5173,4173` | frontend origins (comma-sep.) |
| `ANTHROPIC_API_KEY` | no | — | Claude narratives + WhatsApp assistant (else deterministic fallback) |
| `ENABLE_SCHEDULER` | no | `0` | WhatsApp crons (APScheduler) |
| `SCHEDULER_TZ` | no | `Europe/Amsterdam` | cron timezone |
| `ZAVU_API_KEY` | no | — | WhatsApp via Zavu (else dry-run) |
| `ZAVU_SENDER` | no | built-in | sender ID (`Zavu-Sender` header) |
| `ZAVU_RECIPIENTS` | no | — | cron recipients (E.164, comma-sep.) |
| `ZAVU_WEBHOOK_SECRET` | no | — | validate `x-zavu-signature` |
| `ZAVU_TEMPLATE_ID` | no | — | approved template for proactive sends |
| `ZAVU_WHATSAPP_NUMBER` | no | bot number | wa.me link |
| `PUBLIC_BASE_URL` | no | Railway domain | public base for the PDF URL |

## Deploy (Railway)

Connected to GitHub (`Santy1422/hackaton`, **root dir `backend`**, branch `main`)
→ auto-deploys on push. Build via Railpack (`requirements.txt`); start from
`railpack.json` / `Procfile`: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.

- `DATABASE_URL` references the project's Postgres service (`${{Postgres.DATABASE_URL}}`).
- Schema auto-applies on connect (`CREATE TABLE IF NOT EXISTS`); run `python run.py seed` once.
- Health: `/api/health`.

Live: https://backend-production-a629e.up.railway.app

## Docs

- `docs/AUTH.md` — JWT auth, roles, login endpoints.
- `docs/WEATHER.md` — two-signal weather model (physical schedule + calibrated €).
- `docs/WHATSAPP.md` — Zavu integration, webhook, crons, templates, PDF, MCP.
