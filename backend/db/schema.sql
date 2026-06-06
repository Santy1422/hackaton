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

-- Users (auth + role-based views)
CREATE TABLE IF NOT EXISTS users (
    id               SERIAL PRIMARY KEY,
    email            VARCHAR UNIQUE NOT NULL,
    full_name        VARCHAR,
    password_hash    VARCHAR NOT NULL,
    role             VARCHAR NOT NULL,   -- 'pe_board' | 'cfo' | 'opco_md' | 'project_lead'
    opco             VARCHAR,            -- NULL for pe_board/cfo; 'Opco_A'..'Opco_D' for opco_md/project_lead
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT current_timestamp
);

-- Weather→billing calibration (empirical, audit-able). Latest row = current.
CREATE TABLE IF NOT EXISTS weather_calibration (
    id               SERIAL PRIMARY KEY,
    computed_at      TIMESTAMP DEFAULT current_timestamp,
    n_weeks          INTEGER,
    period           VARCHAR,
    multivariate_r2  DECIMAL(8,4),
    payload          TEXT             -- full calibration JSON (coeffs, normals, verdict)
);

-- Reconciliation log (every ingestion transformation)
CREATE TABLE IF NOT EXISTS reconciliation_log (
    id               INTEGER PRIMARY KEY,
    timestamp        TIMESTAMP DEFAULT current_timestamp,
    source_file      VARCHAR,
    rows_inserted    INTEGER,
    errors           VARCHAR
);
