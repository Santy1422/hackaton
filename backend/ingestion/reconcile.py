"""Reconcilia ambas fuentes en la tabla unificada `transactions`."""

from __future__ import annotations

from datetime import date, datetime

import pandas as pd

from db.database import get_connection

from .gb_snelstart import ingest_gb_files
from .peter_ummels import ingest_pu_files

GL_DRIVER_MAP = {
    "8000": {"driver": "milestone_billing", "btw_type": "hoog_21pct", "label": "Omzet hoog 21% BTW"},
    "8001": {"driver": "milestone_billing", "btw_type": "verlegd", "label": "Omzet verlegd"},
    "8002": {"driver": "milestone_billing", "btw_type": "laag_9pct", "label": "Omzet laag 9% BTW"},
    "8004": {"driver": "milestone_billing", "btw_type": "zero", "label": "Omzet 0%/niet belast"},
    "8005": {"driver": "milestone_billing", "btw_type": "verlegd", "label": "Omzet heffing verlegd"},
}


def _coerce_period(v):
    """Periode puede venir como entero (1-12) o como fecha (GB). Normaliza a mes."""
    if pd.isna(v):
        return None
    if isinstance(v, (pd.Timestamp, datetime, date)):
        return int(v.month)
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def _enrich(df: pd.DataFrame) -> pd.DataFrame:
    """Calcula net_amount, driver/label y campos derivados de fecha."""
    df = df.copy()
    df["period"] = df["period"].map(_coerce_period).astype("Int64")
    if "project_code" in df:
        df["project_code"] = df["project_code"].map(
            lambda v: None if pd.isna(v) else str(v)
        )
    df["net_amount"] = df["credit"] - df["debet"]
    df["driver"] = df["gl_account"].map(lambda g: GL_DRIVER_MAP.get(g, {}).get("driver"))
    df["gl_label"] = df["gl_account"].map(lambda g: GL_DRIVER_MAP.get(g, {}).get("label"))
    dt = pd.to_datetime(df["date"])
    df["year"] = dt.dt.year
    df["month"] = dt.dt.month
    df["iso_week"] = dt.dt.isocalendar().week.astype(int)
    return df


def reconcile_all(raw_dir: str = "data/raw/") -> int:
    """Ingiere ambas fuentes, enriquece e inserta en `transactions`.

    Devuelve el número de filas insertadas. Registra cada paso en
    `reconciliation_log`.
    """
    con = get_connection()
    frames = [ingest_gb_files(raw_dir), ingest_pu_files(raw_dir)]
    df = pd.concat([f for f in frames if not f.empty], ignore_index=True)
    if df.empty:
        return 0

    df = _enrich(df).reset_index(drop=True)
    df.insert(0, "id", range(1, len(df) + 1))

    con.execute("DELETE FROM transactions")
    con.register("df_tx", df)
    con.execute("INSERT INTO transactions BY NAME SELECT * FROM df_tx")

    _seed_gl_mapping(con)
    _seed_covenant_rules(con)

    con.execute(
        "INSERT INTO reconciliation_log (id, source_file, rows_inserted, errors) "
        "VALUES (1, 'ALL', ?, NULL)",
        [len(df)],
    )
    con.close()
    return len(df)


def _seed_gl_mapping(con) -> None:
    """Carga gl_mapping desde GL_DRIVER_MAP (reviewable por un controller)."""
    con.execute("DELETE FROM gl_mapping")
    for gl, m in GL_DRIVER_MAP.items():
        con.execute(
            "INSERT INTO gl_mapping (gl_account, label, driver, btw_type, reviewed_by) "
            "VALUES (?, ?, ?, ?, 'llm_auto')",
            [gl, m["label"], m["driver"], m["btw_type"]],
        )


def _seed_covenant_rules(con) -> None:
    """Umbral de covenant (min cumulative cashflow 13w) según spec."""
    con.execute("DELETE FROM covenant_rules")
    con.execute(
        "INSERT INTO covenant_rules (id, threshold_type, value, horizon_weeks, description) "
        "VALUES (1, 'min_cumulative_cashflow', -500000, 13, 'Min cumulative cashflow over 13 weeks')"
    )
