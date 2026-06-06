# Altis Groep — Forecast API (FastAPI + Postgres)

13-week cash-flow forecast por driver, covenant headroom, WIP, y clima calibrado
empíricamente. Auth JWT con 4 roles (PE Board · CFO · Opco MD · Project Lead).

## Setup local

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # completá DATABASE_URL y secretos
```

## Comandos

```bash
python run.py serve       # API en :8000  (RELOAD=1 para hot-reload en dev)
python run.py seed        # crea los 4 usuarios por rol (password demo: altis2025)
python run.py model       # corre M1–M5 → forecast_13w (+ calibración de clima)
python run.py calibrate   # recalcula y persiste la calibración clima↔billing
python run.py ingest      # parsea xlsx → Postgres
python run.py all         # ingest + model + serve
```

API: http://localhost:8000 · Docs: http://localhost:8000/docs · Health: `/api/health`

## Tests

```bash
pip install -r requirements-dev.txt   # pytest + pyflakes (solo dev)
pytest -q                             # suite completa
```

## Variables de entorno

Ver `.env.example`. Mínimo para correr:

| Variable | Requerida | Default | Para qué |
|----------|-----------|---------|----------|
| `DATABASE_URL` | **sí** | — | Postgres (`postgresql://…`) |
| `JWT_SECRET` | sí (prod) | `altis-dev-secret-change-me` | firma de tokens — **cambiar en prod** |
| `JWT_EXPIRE_HOURS` | no | `12` | vida del token |
| `CORS_ORIGINS` | sí (prod) | `localhost:5173,localhost:4173` | orígenes del frontend (coma-sep.) |
| `ANTHROPIC_API_KEY` | no | — | informes narrados (sin esto, fallback determinista) |
| `ENABLE_SCHEDULER` | no | `0` | crons de WhatsApp (Zavu) |
| `ZAVU_API_KEY` / `ZAVU_RECIPIENTS` | no | — | alertas WhatsApp (sin key = dry-run) |

## Deploy (Railway)

1. Nuevo servicio apuntando a este repo, **Root Directory = `backend`**.
2. Variables de entorno: al menos `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`.
3. Build NIXPACKS (auto-detecta `requirements.txt`). Start desde `Procfile` /
   `railway.json`: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.
4. Healthcheck: `/api/health`.
5. El schema se aplica solo al arrancar (`CREATE TABLE IF NOT EXISTS`). La primera
   vez, correr `python run.py seed` para crear los usuarios.

## Docs

- `docs/AUTH.md` — auth JWT, roles y endpoints de login.
- `docs/WEATHER.md` — modelo de clima de dos señales (schedule físico + € calibrado).
