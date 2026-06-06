# Altis Groep — 13-Week Cash Flow Forecast

Plataforma de forecasting de caja a 13 semanas para Altis Groep (portfolio
de techado PE-backed, 4 OpCos). Ingesta multi-sistema → reconciliación GL →
5 drivers de caja → 3 escenarios → dashboard con audit trail completo.

## Quick start

```bash
# 1. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Datos (los .xlsx van en data/raw/) + modelos
python run.py ingest      # parsea xlsx → DuckDB (24.247 txns)
python run.py model       # corre M1-M5 → forecast_13w (156 filas)
python run.py serve       # FastAPI en http://localhost:8000/docs

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

`python run.py all` hace ingest + model + serve de una.

## Arquitectura

```
data/raw/*.xlsx
   → ingestion/   (gb_snelstart, peter_ummels, reconcile)
   → db/          (DuckDB: schema unificado, single source of truth)
   → models/      (M1 billing · M2 materials · M3 subcon · M4 collections · M5 weather → scenario_engine)
   → api/         (FastAPI: 15 endpoints, forecast/audit/covenant/...)
   → frontend/    (React + Vite + Tailwind + Recharts: 4 vistas de rol)
```

`forecast_13w` es la **única fuente de verdad**: las 4 vistas leen de ahí,
ninguna recalcula. Cada fila guarda sus supuestos (audit trail).

## Modelos

- **M1 — Milestone billing:** índice estacional (2024-2025) × run-rate por OpCo × multiplicador de escenario.
- **M2 — Materials:** OLS lag, `materials[t] = α + β·billing[t+2]` (fallback 33%).
- **M3 — Subcontractors:** 20% del milestone distribuido por payment terms (net14/30/60).
- **M4 — Collections:** billing desplazado por DSO/7 semanas, por OpCo y escenario.
- **M5 — Weather:** umbrales (lluvia>15mm, helada<0°C, viento>Bft6) → difiere caja; fetch Open-Meteo con fallback sintético.

## Escenarios

| | revenue | DSO | weather |
|---|---|---|---|
| **base** | ×1.00 | ×1.00 | on |
| **wet_qtr** | ×0.82 | ×1.20 | on (+lluvia) |
| **dry_qtr** | ×1.12 | ×0.86 | off |

## Audit trail

`GET /api/audit/week/{scenario}/{week}` traza cada número:
driver → assumption → cuentas GL → filas origen → archivos fuente.
En el dashboard: CFO → click en una barra → modal DrillDown.

## Covenant

Umbral `min_cumulative_cashflow = -€500.000` a 13 semanas.
Headroom = cumulative_cf − threshold. Status: SAFE / WATCH / BREACH.

## Postgres mirror (opcional)

DuckDB es el motor analítico. `python db/load_to_postgres.py` espeja las
tablas a Postgres (Railway) para inspección desde un cliente SQL.

## Deploy

**Backend** (FastAPI + Postgres). Cualquier host con Python (Railway / Render / Fly).
El `Procfile` ya trae el comando de prod:

```
web: uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

Variables de entorno (ver `backend/.env.example`):

| Var | Para qué |
|-----|----------|
| `DATABASE_URL` | Postgres (requerido) |
| `JWT_SECRET` | firma de tokens (poné uno largo y real) |
| `CORS_ORIGINS` | URL(s) del frontend desplegado, coma-separadas |
| `ANTHROPIC_API_KEY` | informes narrados (opcional) |
| `ZAVU_API_KEY` · `ENABLE_SCHEDULER` | WhatsApp + crons (opcional) |

El schema se crea solo al arrancar (`init_schema`, idempotente). Sembrá los usuarios
demo una vez con `python run.py seed`.

**Frontend** (Vite/React, estático). Build → subí `dist/` a cualquier host estático
(Vercel / Netlify / Railway). Configurá:

```
VITE_API_URL=https://tu-backend.example   # ver frontend/.env.example
npm run build                              # genera dist/
```

Recordá poner la URL del frontend en `CORS_ORIGINS` del backend.

## Notas

- `data/raw/*.xlsx` y `*.duckdb` están en `.gitignore` (datos financieros reales).
- El frontend usa Tailwind (preferencia del proyecto) en vez de CSS plano.
- `html2pdf` se carga de forma diferida (solo al generar un informe) para no inflar el bundle.
