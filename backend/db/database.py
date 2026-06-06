"""Conexión a DuckDB y helpers de consulta.

`forecast_13w` es la única fuente de verdad: todas las vistas de roles
leen de aquí, ninguna recalcula sus propios números.
"""

from __future__ import annotations

import os
from pathlib import Path

import duckdb

DB_PATH = os.getenv("DUCKDB_PATH", "altis_forecast.duckdb")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection(path: str = DB_PATH) -> duckdb.DuckDBPyConnection:
    """Devuelve una conexión DuckDB con el esquema ya inicializado."""
    con = duckdb.connect(path)
    init_schema(con)
    return con


def init_schema(con: duckdb.DuckDBPyConnection) -> None:
    """Aplica `schema.sql` (idempotente: usa CREATE TABLE IF NOT EXISTS)."""
    con.execute(SCHEMA_PATH.read_text())


def query(con: duckdb.DuckDBPyConnection, sql: str, params: list | None = None):
    """Ejecuta una consulta y devuelve filas como lista de dicts."""
    cur = con.execute(sql, params or [])
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]
