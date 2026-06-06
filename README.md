# Altis Forecast

Plataforma de forecasting de flujo de caja: ingesta multi-sistema,
reconciliación de GL asistida por LLM, drivers de caja y escenarios
Base / Wet / Dry con trazabilidad completa.

## Estructura

```
altis-forecast/
├── backend/
│   ├── ingestion/          # Parsers por sistema (Gilde, Yuki, Exact, Snelstart)
│   ├── reconciliation/     # GL mapper + LLM assist + audit log
│   ├── drivers/            # 5 drivers de flujo de caja
│   ├── scenarios/          # Base / Wet / Dry engine
│   ├── api/                # FastAPI endpoints
│   └── db/                 # DuckDB schema unificado
├── frontend/
│   ├── src/
│   │   ├── views/          # CFO, PE, OpcoMD, ProjectLead
│   │   ├── components/     # Charts, DrillDown, ScenarioToggle
│   │   └── hooks/          # useForecast, useTraceability
│   └── package.json
├── data/                   # CSVs sintéticos (o los reales)
├── tests/
└── README.md
```

## Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload    # http://localhost:8000/docs
```

## Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```
