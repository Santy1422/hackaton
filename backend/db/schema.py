"""Esquema unificado en DuckDB.

DuckDB actúa como almacén analítico local para las transacciones
normalizadas, los mapeos de GL y los resultados de forecast.
"""

from __future__ import annotations

import duckdb

DB_PATH = "altis_forecast.duckdb"

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id             BIGINT PRIMARY KEY,
    source_system  VARCHAR NOT NULL,
    booking_date   DATE    NOT NULL,
    gl_account     VARCHAR NOT NULL,
    unified_account VARCHAR,
    description    VARCHAR,
    amount         DECIMAL(18, 2) NOT NULL,
    currency       VARCHAR DEFAULT 'EUR',
    counterparty   VARCHAR,
    entity         VARCHAR
);

CREATE TABLE IF NOT EXISTS gl_mappings (
    source_system   VARCHAR NOT NULL,
    source_account  VARCHAR NOT NULL,
    unified_account VARCHAR NOT NULL,
    confidence      DOUBLE,
    method          VARCHAR,
    PRIMARY KEY (source_system, source_account)
);

CREATE TABLE IF NOT EXISTS forecasts (
    scenario   VARCHAR NOT NULL,
    driver     VARCHAR NOT NULL,
    period     DATE    NOT NULL,
    amount     DECIMAL(18, 2) NOT NULL
);
"""


def get_connection(path: str = DB_PATH) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(path)


def init_db(path: str = DB_PATH) -> None:
    con = get_connection(path)
    con.execute(SCHEMA)
    con.close()
