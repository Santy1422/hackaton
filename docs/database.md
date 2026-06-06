# CLAUDE.md — Altis Groep Cash Forecast System

You are building a **13-week cash flow forecasting platform** for Altis Groep, a private-equity-backed roofing portfolio (4 OpCos). This file is your complete specification. Read it fully before writing any code.

---

## Project structure

```
altis-forecast/
├── CLAUDE.md                  ← this file
├── README.md                  ← you will generate this at the end
├── backend/
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── gb_snelstart.py    ← parser for GB_8000/8001/8002 files
│   │   ├── peter_ummels.py    ← parser for 82604-* files
│   │   └── reconcile.py       ← merges both into unified schema
│   ├── models/
│   │   ├── __init__.py
│   │   ├── m1_milestone.py    ← Prophet model, milestone billing
│   │   ├── m2_materials.py    ← lag regression, materials outflow
│   │   ├── m3_subcon.py       ← payment terms distribution
│   │   ├── m4_collections.py  ← DSO empirical model
│   │   ├── m5_weather.py      ← rain/frost → schedule delay
│   │   └── scenario_engine.py ← combines M1–M5, 3 scenarios
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py            ← FastAPI app
│   │   └── routes/
│   │       ├── forecast.py
│   │       ├── audit.py
│   │       └── covenant.py
│   ├── db/
│   │   ├── schema.sql         ← DuckDB schema
│   │   └── database.py        ← connection + query helpers
│   ├── requirements.txt
│   └── run.py                 ← entry point: ingest → model → serve
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── views/
│   │   │   ├── PEBoard.jsx
│   │   │   ├── CFOView.jsx
│   │   │   ├── OpcoMD.jsx
│   │   │   └── ProjectLead.jsx
│   │   ├── components/
│   │   │   ├── ScenarioToggle.jsx
│   │   │   ├── DrillDown.jsx
│   │   │   ├── CovenantGauge.jsx
│   │   │   └── KpiCard.jsx
│   │   └── hooks/
│   │       ├── useForecast.js
│   │       └── useAudit.js
│   ├── package.json
│   └── vite.config.js
└── data/
    └── raw/                   ← place the xlsx files here
```

---

## Step 1 — Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

**requirements.txt** must contain:
```
fastapi==0.111.0
uvicorn==0.29.0
pandas==2.2.2
openpyxl==3.1.2
duckdb==0.10.3
prophet==1.1.5
scikit-learn==1.4.2
httpx==0.27.0
pyarrow==16.0.0
python-dotenv==1.0.1
```

---

## Step 2 — Database schema

Create `backend/db/schema.sql` with exactly these tables:

```sql
-- Unified transactions (reconciled from all systems)
CREATE TABLE IF NOT EXISTS transactions (
    id               INTEGER PRIMARY KEY,
    date             DATE NOT NULL,
    period           INTEGER,
    doc_number       VARCHAR,
    journal          VARCHAR,
    gl_account       VARCHAR NOT NULL,
    debet            DECIMAL(15,2) DEFAULT 0,
    credit           DECIMAL(15,2) DEFAULT 0,
    net_amount       DECIMAL(15,2),
    description      VARCHAR,
    project_code     VARCHAR,
    btw_type         VARCHAR,
    driver           VARCHAR,
    gl_label         VARCHAR,
    system           VARCHAR NOT NULL,   -- 'GB_Snelstart' | 'PeterUmmels_Exact'
    opco             VARCHAR NOT NULL,   -- 'Opco_A' | 'Opco_B' | 'Opco_C' | 'Opco_D'
    source_file      VARCHAR,
    year             INTEGER,
    month            INTEGER,
    iso_week         INTEGER
);

-- GL account mapping (LLM-assisted, human-reviewable)
CREATE TABLE IF NOT EXISTS gl_mapping (
    gl_account       VARCHAR PRIMARY KEY,
    label            VARCHAR,
    driver           VARCHAR,
    btw_type         VARCHAR,
    system           VARCHAR,
    opco             VARCHAR,
    reviewed_by      VARCHAR DEFAULT 'llm_auto',
    reviewed_at      TIMESTAMP DEFAULT current_timestamp
);

-- Seasonal index (derived from 2024–2025 actuals)
CREATE TABLE IF NOT EXISTS seasonal_index (
    iso_week         INTEGER PRIMARY KEY,
    avg_weekly_revenue DECIMAL(15,2),
    seasonal_index   DECIMAL(8,4)
);

-- Weather forecast (KNMI / Open-Meteo)
CREATE TABLE IF NOT EXISTS weather_forecast (
    iso_week         INTEGER PRIMARY KEY,
    week_start       DATE,
    temp_avg         DECIMAL(5,2),
    rain_mm          DECIMAL(7,2),
    frost_days       INTEGER DEFAULT 0,
    wind_bft         DECIMAL(4,1),
    risk_level       VARCHAR,   -- 'low' | 'medium' | 'high'
    delay_days       INTEGER DEFAULT 0,
    source           VARCHAR DEFAULT 'open-meteo'
);

-- Covenant rules
CREATE TABLE IF NOT EXISTS covenant_rules (
    id               INTEGER PRIMARY KEY,
    threshold_type   VARCHAR,   -- 'min_cumulative_cashflow'
    value            DECIMAL(15,2),
    horizon_weeks    INTEGER,
    description      VARCHAR
);

-- Forecast output (single source of truth)
CREATE TABLE IF NOT EXISTS forecast_13w (
    id                    INTEGER PRIMARY KEY,
    scenario              VARCHAR NOT NULL,   -- 'base' | 'wet_qtr' | 'dry_qtr'
    forecast_week         INTEGER NOT NULL,
    iso_week              INTEGER,
    week_start            DATE,
    opco                  VARCHAR,
    seasonal_index        DECIMAL(8,4),
    d1_milestone_billing  DECIMAL(15,2),
    d2_materials_outflow  DECIMAL(15,2),
    d3_subcon_payment     DECIMAL(15,2),
    d4_customer_collection DECIMAL(15,2),
    d5_weather_impact     DECIMAL(15,2),
    gross_inflow          DECIMAL(15,2),
    gross_outflow         DECIMAL(15,2),
    net_cashflow          DECIMAL(15,2),
    cumulative_cf         DECIMAL(15,2),
    -- Audit trail columns
    m1_assumption         VARCHAR,
    m2_assumption         VARCHAR,
    m3_assumption         VARCHAR,
    m4_dso_days           INTEGER,
    m5_delay_weeks        DECIMAL(4,1),
    computed_at           TIMESTAMP DEFAULT current_timestamp
);
```

---

## Step 3 — Ingestion parsers

### `backend/ingestion/gb_snelstart.py`

Parse all files matching `GB_8000*.xlsx`, `GB_8001*.xlsx`, `GB_8002*.xlsx`.

**File format:**
- Sheet: `Blad1`
- Header row 0 (no skip needed)
- Columns: `Rekening, Periode, Datum, Boeknummer, Trek, Debet, Credit, Boekingstekst, Dagboek, BTW, BTW-srt`

**Mapping rules:**
```python
opco_map = {'8000': 'Opco_A', '8001': 'Opco_B', '8002': 'Opco_C'}
# gl_account = str(Rekening)
# date = Datum
# period = Periode
# doc_number = str(Boeknummer)
# journal = Dagboek
# debet = Debet (fill NaN with 0)
# credit = Credit (fill NaN with 0)
# description = Boekingstekst
# project_code = Trek
# btw_type = BTW-srt
# system = 'GB_Snelstart'
```

### `backend/ingestion/peter_ummels.py`

Parse all files matching `82604-*.xlsx`.

**File format:**
- Sheet: `Sheet1`
- Metadata rows 1–12 (skip them)
- GL account is in row 7 (index 6), cell `B7` — value like `"8005 - omzet waarbij de heffing naar u is verlegd"`
- Header row: row 13 (index 12) → `Nr., Per., Datum, Bkst.nr., Dagboek, Debet, Credit`
- Data starts at row 14 (index 13)
- Only include rows where `Nr.` is an integer

**Mapping rules:**
```python
# gl_account = extract first 4 chars of cell B7 (e.g. "8005")
# date = Datum
# period = Per.
# doc_number = str(Bkst.nr.)
# journal = Dagboek
# debet = Debet (0 if None)
# credit = Credit (0 if None)
# system = 'PeterUmmels_Exact'
# opco = 'Opco_D'
```

### `backend/ingestion/reconcile.py`

Merge both sources into the `transactions` table:

```python
GL_DRIVER_MAP = {
    '8000': {'driver': 'milestone_billing', 'btw_type': 'hoog_21pct',  'label': 'Omzet hoog 21% BTW'},
    '8001': {'driver': 'milestone_billing', 'btw_type': 'verlegd',     'label': 'Omzet verlegd'},
    '8002': {'driver': 'milestone_billing', 'btw_type': 'laag_9pct',   'label': 'Omzet laag 9% BTW'},
    '8004': {'driver': 'milestone_billing', 'btw_type': 'zero',        'label': 'Omzet 0%/niet belast'},
    '8005': {'driver': 'milestone_billing', 'btw_type': 'verlegd',     'label': 'Omzet heffing verlegd'},
}
```

Populate `year`, `month`, `iso_week` from `date`. Insert into DuckDB `transactions` table. Log every transformation to a `reconciliation_log` with timestamp, source_file, rows_inserted, any errors.

---

## Step 4 — Forecast models

### M1 — `backend/models/m1_milestone.py`

**Purpose:** Predict weekly milestone billing for the next 13 weeks.

**Method:** Prophet with weekly seasonality + external regressor.

```python
from prophet import Prophet

def fit_and_predict(transactions_df, weather_df, horizon=13):
    # 1. Aggregate weekly revenue from transactions
    #    filter: credit > 0, group by iso_week + year
    #    ds = week_start date, y = total credit
    
    # 2. Add weather_delay_weeks as regressor
    #    delay_weeks = weather_df['delay_days'] / 7
    
    # 3. Fit Prophet
    model = Prophet(weekly_seasonality=True, yearly_seasonality=True)
    model.add_regressor('weather_delay_weeks')
    model.fit(df)
    
    # 4. Predict 13 weeks forward from today
    future = model.make_future_dataframe(periods=horizon, freq='W')
    future['weather_delay_weeks'] = weather_df['delay_days'] / 7  # merge on iso_week
    forecast = model.predict(future)
    
    # 5. Return last 13 rows: ds, yhat, yhat_lower, yhat_upper
    return forecast.tail(horizon)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
```

**Assumption stored in audit:** `"Prophet(weekly+yearly seasonality) + weather_delay regressor, trained on {n} weeks of actuals"`

### M2 — `backend/models/m2_materials.py`

**Purpose:** Materials are ordered 2 weeks before billing. Outflow = f(billing[t+2]).

**Method:** OLS regression on historical data.

```python
from sklearn.linear_model import LinearRegression

def fit_and_predict(transactions_df, m1_forecast):
    # 1. From actuals: compute weekly billing and weekly debet (cost proxy)
    # 2. Align: materials[t] ~ billing[t+2] (shift billing 2 weeks back)
    # 3. Fit OLS: materials = alpha + beta * billing_lead2
    # 4. Apply to M1 forecast: materials[t] = alpha + beta * m1[t+2]
    # 5. Return negative values (outflows)
    
    # Fallback if not enough data: materials = billing * 0.33
    pass
```

**Assumption stored in audit:** `"OLS lag regression: materials[t] = {alpha:.0f} + {beta:.3f} * billing[t+2], R²={r2:.2f}"`

### M3 — `backend/models/m3_subcon.py`

**Purpose:** Subcontractor payments linked to GL 8001 (verlegd = subcon signal).

**Method:** Fixed ratio of milestone billing with payment terms lag.

```python
SUBCON_RATIO = 0.20          # 20% of milestone revenue
PAYMENT_TERMS_DAYS = {
    'base':    {'net14': 0.4, 'net30': 0.6},
    'wet_qtr': {'net14': 0.3, 'net60': 0.7},  # slower payment in wet quarter
    'dry_qtr': {'net14': 0.6, 'net30': 0.4},
}

def predict(m1_forecast, scenario='base'):
    # Apply ratio and distribute across payment terms
    # net14: paid 2 weeks after milestone, net30: 4 weeks after
    # Return weekly outflow series (negative)
    pass
```

**Assumption stored in audit:** `"Subcon ratio {SUBCON_RATIO:.0%} of milestone, {scenario} payment terms"`

### M4 — `backend/models/m4_collections.py`

**Purpose:** Cash actually arrives DSO days after invoice. Model the lag.

**Method:** Empirical DSO distribution from Kasboek vs Verkoopboek matching.

```python
DSO_DAYS = {
    'base':    {'Opco_A': 35, 'Opco_B': 38, 'Opco_C': 30, 'Opco_D': 32},
    'wet_qtr': {'Opco_A': 42, 'Opco_B': 45, 'Opco_C': 37, 'Opco_D': 39},
    'dry_qtr': {'Opco_A': 30, 'Opco_B': 33, 'Opco_C': 25, 'Opco_D': 28},
}

def predict(m1_forecast, scenario='base', opco='Opco_B'):
    # collection[t] = milestone_billed[t - DSO/7 weeks]
    # Apply DSO lag to shift billing into collection timing
    # Return weekly inflow series
    pass
```

**Assumption stored in audit:** `"DSO {dso_days}d for {opco} under {scenario} scenario"`

### M5 — `backend/models/m5_weather.py`

**Purpose:** Rain and frost delay roofing work → billing shifts → cash timing changes.

**Method:** Non-linear threshold model.

```python
RAIN_THRESHOLD_MM   = 15.0   # >15mm/day = work stop
FROST_THRESHOLD_C   = 0.0    # <0°C = work stop
WIND_THRESHOLD_BFT  = 6.0    # >Bft 6 = stop

def compute_delay_weeks(rain_mm, frost_days, wind_bft):
    """
    Returns float: number of weeks of billing delay caused by weather.
    Non-linear: each additional day above threshold compounds.
    """
    rain_stop_days  = max(0, (rain_mm / 10) - (RAIN_THRESHOLD_MM / 10))
    frost_stop_days = frost_days if frost_days > 0 else 0
    wind_stop_days  = max(0, (wind_bft - WIND_THRESHOLD_BFT) * 0.5)
    total_stop_days = rain_stop_days + frost_stop_days + wind_stop_days
    return total_stop_days / 7   # convert to weeks

def apply_weather_to_forecast(m1_forecast, m4_forecast, weather_df):
    """
    Shifts billing and collection forward by delay_weeks.
    Returns (m1_adjusted, m4_adjusted, weather_impact_series).
    """
    pass
```

**Assumption stored in audit:** `"Weather threshold model: rain>{RAIN_THRESHOLD_MM}mm | frost<{FROST_THRESHOLD_C}°C | wind>Bft{WIND_THRESHOLD_BFT} → delay_weeks={delay:.1f}"`

### `backend/models/scenario_engine.py`

Combines M1–M5 for all 3 scenarios and writes to `forecast_13w`:

```python
SCENARIOS = {
    'base':    {'revenue_mult': 1.00, 'dso_mult': 1.00, 'weather_active': True},
    'wet_qtr': {'revenue_mult': 0.82, 'dso_mult': 1.20, 'weather_active': True,  'extra_rain_mm': 18},
    'dry_qtr': {'revenue_mult': 1.12, 'dso_mult': 0.86, 'weather_active': False},
}

def run_all_scenarios(db_conn):
    for scenario_name, params in SCENARIOS.items():
        for opco in ['Opco_A', 'Opco_B', 'Opco_C', 'Opco_D']:
            m1 = run_m1(opco, params)
            m2 = run_m2(m1, params)
            m3 = run_m3(m1, scenario_name, opco)
            m4 = run_m4(m1, scenario_name, opco)
            m5 = run_m5(m1, m4, scenario_name, params)
            
            rows = assemble_forecast_rows(
                scenario_name, opco, m1, m2, m3, m4, m5
            )
            db_conn.executemany(INSERT_FORECAST_SQL, rows)
```

**Critical:** every row must store its assumptions in `m1_assumption`, `m2_assumption`, etc. These are the audit trail shown to the jury.

---

## Step 5 — FastAPI

### `backend/api/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import forecast, audit, covenant

app = FastAPI(title="Altis Groep Forecast API")
app.add_middleware(CORSMiddleware, allow_origins=["*"])
app.include_router(forecast.router, prefix="/api/forecast")
app.include_router(audit.router,    prefix="/api/audit")
app.include_router(covenant.router, prefix="/api/covenant")
```

### Required endpoints

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/forecast/{scenario}` | 13-week forecast, all opcos combined |
| `GET` | `/api/forecast/{scenario}/{opco}` | 13-week forecast for one opco |
| `GET` | `/api/forecast/week/{scenario}/{week}` | Single week detail with all 5 drivers |
| `GET` | `/api/audit/week/{scenario}/{week}` | Full audit trail: drivers → GL → source rows |
| `GET` | `/api/covenant/{scenario}` | Cumulative CF + headroom vs threshold |
| `GET` | `/api/stats` | Summary stats from transactions table |
| `POST` | `/api/recompute` | Re-run all models (triggers run_all_scenarios) |

### Audit endpoint — critical for demo

`GET /api/audit/week/{scenario}/{week}` must return:

```json
{
  "scenario": "base",
  "forecast_week": 5,
  "week_start": "2026-07-04",
  "net_cashflow": -20322,
  "drivers": {
    "d1_milestone_billing": {
      "value": 581947,
      "assumption": "Prophet model, seasonal_index=1.41, weather_delay=0w",
      "gl_accounts": ["8000", "8001", "8005"],
      "source_rows": 847,
      "source_files": ["GB_8001_jan-dec_25.xlsx", "82604-2025-...xlsx"]
    },
    "d2_materials_outflow": { ... },
    "d3_subcon_payment":    { ... },
    "d4_customer_collection": { ... },
    "d5_weather_impact":    { ... }
  },
  "covenant_headroom": 424614
}
```

---

## Step 6 — Weather data fetch

In `backend/models/m5_weather.py`, fetch 13 weeks of forecast from Open-Meteo (free, no API key):

```python
import httpx

def fetch_weather_forecast(lat=52.37, lon=4.89, weeks=13):
    """
    Default coords: Amsterdam NL.
    Returns DataFrame with columns: week_start, rain_mm, temp_avg, wind_bft, frost_days.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat, "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
        "forecast_days": weeks * 7,
        "timezone": "Europe/Amsterdam"
    }
    resp = httpx.get(url, params=params, timeout=10)
    data = resp.json()["daily"]
    # Aggregate daily → weekly
    # frost_days = count of days where temp_min < 0
    # wind_bft = convert km/h to Beaufort scale
    # Return weekly DataFrame
```

If the API call fails, fall back to synthetic weather data based on the seasonal average for the Netherlands in summer (June–August: ~12mm/week, 18°C, Bft 3).

---

## Step 7 — Frontend

### Tech stack
- React 18 + Vite
- Recharts for all charts
- No UI library — raw CSS only
- Font: `Space Grotesk` (headings) + `DM Mono` (numbers/labels)

### `frontend/package.json` dependencies
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```

### API base URL
```js
// src/hooks/useForecast.js
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

### Four role views — what each must show

**PEBoard.jsx**
- Covenant headroom gauge (all 3 scenarios side by side)
- Portfolio revenue area chart (monthly actuals 2024–2026)
- 13-week cumulative CF line chart (all 3 scenarios overlaid)
- KPIs: YTD revenue, weekly run rate, gross 13w inflow, transaction count

**CFOView.jsx**
- Scenario toggle (Base / Wet / Dry)
- Weekly bar chart: gross inflow vs outflow + cumulative line
- Click any bar → DrillDown modal with audit trail from `/api/audit/week/`
- Driver breakdown horizontal bar chart
- GL mapping table

**OpcoMD.jsx**
- OpCo selector (A / B / D)
- WIP exposure KPIs
- OpCo-specific 13-week cash chart
- Subcontractor commitment breakdown
- Project risk table (5 projects with status, milestone, risk badge)

**ProjectLead.jsx**
- Next billable milestone highlighted
- Milestones table (next 13 weeks) with billing date, value, weather risk
- Weather risk list (week by week, rain mm, delay days)
- Materials outflow vs billing bar chart

### DrillDown modal

```jsx
// Opens on click of any forecast bar
// Calls: GET /api/audit/week/{scenario}/{week}
// Shows: 5 driver cards, each with value + assumption + GL accounts + source files
// Bottom: net cashflow + cumulative + covenant headroom
// Footer: "Source: N transactions from [files]"
```

---

## Step 8 — Entry point

### `backend/run.py`

```python
"""
Usage:
  python run.py ingest    # parse xlsx files → DuckDB
  python run.py model     # run all 5 models → forecast_13w
  python run.py serve     # start FastAPI on port 8000
  python run.py all       # ingest + model + serve
"""
import sys

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    
    if cmd in ('ingest', 'all'):
        from ingestion.gb_snelstart import ingest_gb_files
        from ingestion.peter_ummels import ingest_pu_files
        from ingestion.reconcile import reconcile_all
        ingest_gb_files('data/raw/')
        ingest_pu_files('data/raw/')
        reconcile_all()
        print("✅ Ingestion complete")
    
    if cmd in ('model', 'all'):
        from models.scenario_engine import run_all_scenarios
        from db.database import get_connection
        run_all_scenarios(get_connection())
        print("✅ Models complete")
    
    if cmd in ('serve', 'all'):
        import uvicorn
        uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
```

---

## Step 9 — README (generate last)

After building everything, generate `README.md` with:

1. **Quick start** (5 commands to go from zero to running)
2. **Architecture overview** (ingestion → schema → models → API → frontend)
3. **Data sources** (which xlsx files go in `data/raw/`)
4. **Model assumptions** (one paragraph per model, what it does, what it assumes)
5. **Scenario logic** (Base / Wet / Dry — what changes in each)
6. **Audit trail walkthrough** (how to click a number and trace it to source)
7. **Covenant calculation** (threshold, formula, how headroom is computed)
8. **Dutch accounting notes** (BTW verlegd, G-rekening, WIP recognition)

---

## Key constraints — do not violate

- **Single source of truth:** `forecast_13w` table feeds all 4 role views. No view computes its own numbers.
- **Every forecast row has assumptions stored.** No magic numbers without an audit column.
- **GL mapping is in the database**, not hardcoded in Python. A controller can update it without code changes.
- **Weather delay shifts billing forward**, it does not just multiply revenue down. M1 output must reflect the timing shift.
- **DSO model is per-opco**, not a single portfolio average.
- **Scenario switches must affect downstream correctly:** wet quarter → M1 revenue down + M5 delay up + M4 DSO up + M3 slower payment terms. All four must move together.
- **The `/api/audit/` endpoint is mandatory.** The jury will click a number and ask "where does this come from." The answer must trace to a source file and GL account.
- **No hardcoded file paths.** `data/raw/` is the only assumed location. Everything else is configurable via `.env`.

---

## Data files expected in `data/raw/`

```
GB_8000_jan-dec_23.xlsx
GB_8000_jan-dec_24.xlsx
GB_8000_jan-dec_25.xlsx
GB_8000_jan-mei_26.xlsx
GB_8001_jan-dec_23.xlsx
GB_8001_jan-dec_24.xlsx
GB_8001_jan-dec_25.xlsx
GB_8001_jan-mei_26.xlsx
GB_8002_jan-dec_23.xlsx
82604-2023-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx
82604-2023_2-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx
82604-2023_3-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-Fintransactions.xlsx
82604-2024-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions__1_.xlsx
82604-2024_2-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-Fintransactions.xlsx
82604-2025-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx
82604-2025_2-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-Fintransactions.xlsx
82604-2025_3-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-Fintransactions.xlsx
82604-2026-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx
82604-2026_2-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx
82604-2026_3-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-Fintransactions.xlsx
```

---

## What success looks like

When you are done, running `python run.py all` from `backend/` and `npm run dev` from `frontend/` must produce:

1. A running API at `http://localhost:8000`
2. A running dashboard at `http://localhost:5173`
3. Clicking CFO → any bar → DrillDown shows 5 driver cards with assumptions and source files
4. Switching scenario updates all numbers across all views simultaneously
5. PE Board covenant gauge shows correct headroom for each scenario
6. `GET /api/audit/week/base/5` returns a complete JSON with driver assumptions