"""Carga los datos de DuckDB → Postgres (Railway) para inspección.

DuckDB sigue siendo el store analítico de la spec; esto es un espejo en
Postgres para poder ver las transacciones desde un cliente SQL.

Uso:
    python db/load_to_postgres.py
"""

from __future__ import annotations

import asyncio
import os

import asyncpg
import duckdb

DUCKDB_PATH = os.getenv("DUCKDB_PATH", "altis_forecast.duckdb")

# asyncpg.connect no entiende el prefijo "+asyncpg" de SQLAlchemy
PG_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:oJBnSyaXTHsmORVcVfHlDEBqsSJhMlXx@shortline.proxy.rlwy.net:32375/railway",
).replace("+asyncpg", "")

TRANSACTIONS_DDL = """
CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY,
    date         DATE,
    period       INTEGER,
    doc_number   VARCHAR,
    journal      VARCHAR,
    gl_account   VARCHAR,
    debet        NUMERIC(15,2),
    credit       NUMERIC(15,2),
    net_amount   NUMERIC(15,2),
    description  VARCHAR,
    project_code VARCHAR,
    btw_type     VARCHAR,
    driver       VARCHAR,
    gl_label     VARCHAR,
    system       VARCHAR,
    opco         VARCHAR,
    source_file  VARCHAR,
    year         INTEGER,
    month        INTEGER,
    iso_week     INTEGER
);
"""

GL_MAPPING_DDL = """
CREATE TABLE IF NOT EXISTS gl_mapping (
    gl_account VARCHAR PRIMARY KEY,
    label      VARCHAR,
    driver     VARCHAR,
    btw_type   VARCHAR,
    reviewed_by VARCHAR
);
"""

COVENANT_DDL = """
CREATE TABLE IF NOT EXISTS covenant_rules (
    id             INTEGER PRIMARY KEY,
    threshold_type VARCHAR,
    value          NUMERIC(15,2),
    horizon_weeks  INTEGER,
    description    VARCHAR
);
"""

FORECAST_DDL = """
CREATE TABLE IF NOT EXISTS forecast_13w (
    id                     INTEGER PRIMARY KEY,
    scenario               VARCHAR,
    forecast_week          INTEGER,
    iso_week               INTEGER,
    week_start             DATE,
    opco                   VARCHAR,
    seasonal_index         NUMERIC(8,4),
    d1_milestone_billing   NUMERIC(15,2),
    d2_materials_outflow   NUMERIC(15,2),
    d3_subcon_payment      NUMERIC(15,2),
    d4_customer_collection NUMERIC(15,2),
    d5_weather_impact      NUMERIC(15,2),
    gross_inflow           NUMERIC(15,2),
    gross_outflow          NUMERIC(15,2),
    net_cashflow           NUMERIC(15,2),
    cumulative_cf          NUMERIC(15,2),
    m1_assumption          VARCHAR,
    m2_assumption          VARCHAR,
    m3_assumption          VARCHAR,
    m4_dso_days            INTEGER,
    m5_delay_weeks         NUMERIC(4,1)
);
"""

FC_COLS = [
    "id", "scenario", "forecast_week", "iso_week", "week_start", "opco",
    "seasonal_index", "d1_milestone_billing", "d2_materials_outflow",
    "d3_subcon_payment", "d4_customer_collection", "d5_weather_impact",
    "gross_inflow", "gross_outflow", "net_cashflow", "cumulative_cf",
    "m1_assumption", "m2_assumption", "m3_assumption", "m4_dso_days",
    "m5_delay_weeks",
]

TX_COLS = [
    "id", "date", "period", "doc_number", "journal", "gl_account",
    "debet", "credit", "net_amount", "description", "project_code",
    "btw_type", "driver", "gl_label", "system", "opco", "source_file",
    "year", "month", "iso_week",
]


async def main() -> None:
    duck = duckdb.connect(DUCKDB_PATH)
    tx = duck.execute(f"SELECT {', '.join(TX_COLS)} FROM transactions").fetchall()
    gl = duck.execute(
        "SELECT gl_account, label, driver, btw_type, reviewed_by FROM gl_mapping"
    ).fetchall()
    cov = duck.execute(
        "SELECT id, threshold_type, value, horizon_weeks, description FROM covenant_rules"
    ).fetchall()
    fc = duck.execute(f"SELECT {', '.join(FC_COLS)} FROM forecast_13w").fetchall()
    duck.close()

    pg = await asyncpg.connect(PG_DSN)
    for ddl in (TRANSACTIONS_DDL, GL_MAPPING_DDL, COVENANT_DDL, FORECAST_DDL):
        await pg.execute(ddl)

    await pg.execute("TRUNCATE transactions, gl_mapping, covenant_rules, forecast_13w")
    await pg.copy_records_to_table("transactions", records=tx, columns=TX_COLS)
    await pg.copy_records_to_table(
        "gl_mapping", records=gl,
        columns=["gl_account", "label", "driver", "btw_type", "reviewed_by"],
    )
    await pg.copy_records_to_table(
        "covenant_rules", records=cov,
        columns=["id", "threshold_type", "value", "horizon_weeks", "description"],
    )
    await pg.copy_records_to_table("forecast_13w", records=fc, columns=FC_COLS)

    n = await pg.fetchval("SELECT COUNT(*) FROM transactions")
    f = await pg.fetchval("SELECT COUNT(*) FROM forecast_13w")
    print(f"✅ {n} transacciones + {f} filas de forecast cargadas en Postgres (Railway)")
    await pg.close()


if __name__ == "__main__":
    asyncio.run(main())
