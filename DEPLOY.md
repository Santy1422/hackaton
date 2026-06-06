# Deploy (Railway)

Two services from this monorepo, both auto-deploy on push to `main`.
Build: **Railpack** (auto-detected). Config lives in each service's
`railpack.json` (+ backend `Procfile` / `railway.json`).

## Backend — Root Directory `backend`

Start: `uvicorn api.main:app --host 0.0.0.0 --port $PORT` · Health: `/api/health`

| Variable | Required | Value |
|----------|----------|-------|
| `DATABASE_URL` | **yes** | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `JWT_SECRET` | **yes** | a long random string |
| `CORS_ORIGINS` | optional | extra frontend origins, comma-separated. **Any `*.up.railway.app` is already allowed by regex**, so usually not needed |
| `ANTHROPIC_API_KEY` | optional | enables Claude narratives + assistant (else deterministic fallback) |
| `ZAVU_API_KEY`, `ZAVU_*` | optional | WhatsApp via Zavu (else dry-run) |
| `ENABLE_SCHEDULER` | optional | `1` to run WhatsApp crons |

- Schema auto-applies on startup (`CREATE TABLE IF NOT EXISTS`).
- First deploy only: run `python run.py seed` once (creates the 4 role users).
  The transaction/forecast data is already in Postgres; re-ingestion is offline
  and not needed at runtime (the source xlsx are not in the repo).

## Frontend — Root Directory `frontend`

Build: `npm run build` (auto) · Start: `serve -s dist -l $PORT` (SPA fallback)

| Variable | Required | Value |
|----------|----------|-------|
| `VITE_API_URL` | **yes** | the **backend** service URL, e.g. `https://backend-production-a629e.up.railway.app` |

> ⚠️ `VITE_API_URL` is baked at **build time** — set it as a service variable
> *before* the build. Change it → trigger a rebuild. This is the one value that
> must be right; CORS is already handled by the backend regex.

## Smoke test after deploy

```bash
curl https://<backend>/api/health          # {"status":"ok","db":"connected",...}
# open https://<frontend>/ → login: cfo@altis.com / altis2025
```
