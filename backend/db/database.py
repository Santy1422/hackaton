"""Conexión a Postgres (Railway) — única base de datos de prod.

`forecast_13w` es la única fuente de verdad: todas las vistas leen de aquí,
ninguna recalcula sus propios números.
"""

from __future__ import annotations

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(Path(__file__).parent.parent / ".env")

# psycopg usa postgresql://  (sin el sufijo +asyncpg de SQLAlchemy)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:oJBnSyaXTHsmORVcVfHlDEBqsSJhMlXx@shortline.proxy.rlwy.net:32375/railway",
).replace("+asyncpg", "")

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> psycopg.Connection:
    """Conexión Postgres en autocommit, filas como dicts."""
    return psycopg.connect(DATABASE_URL, autocommit=True, row_factory=dict_row)


def init_schema(con: psycopg.Connection) -> None:
    """Aplica `schema.sql` (idempotente: CREATE TABLE IF NOT EXISTS)."""
    con.execute(SCHEMA_PATH.read_text())


def execute(con: psycopg.Connection, sql: str, params=None):
    """Ejecuta una sentencia. Acepta placeholders `?` (se traducen a %s)."""
    return con.execute(sql.replace("?", "%s"), params or [])


def executemany(con: psycopg.Connection, sql: str, rows) -> None:
    """Ejecuta una sentencia para muchas filas (placeholders `?`)."""
    with con.cursor() as cur:
        cur.executemany(sql.replace("?", "%s"), list(rows))


def query(con: psycopg.Connection, sql: str, params=None) -> list[dict]:
    """Ejecuta una consulta y devuelve filas como lista de dicts."""
    return execute(con, sql, params).fetchall()


def copy_rows(con: psycopg.Connection, table: str, cols: list[str], rows) -> int:
    """Carga masiva con COPY. `rows` = iterable de tuplas en orden `cols`."""
    n = 0
    with con.cursor() as cur:
        with cur.copy(f"COPY {table} ({', '.join(cols)}) FROM STDIN") as cp:
            for r in rows:
                cp.write_row(r)
                n += 1
    return n
