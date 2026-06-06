"""Endpoint 4: audit trail. El endpoint más importante del demo.

Traza cada driver → assumption → GL accounts → source rows → source files.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from db.database import get_connection, query

from ..auth import require_roles
from ..validation import not_computed, validate_scenario, validate_week

router = APIRouter(tags=["audit"])


def _source_rows(con, iso_week: int) -> list[dict]:
    """Transacciones reales (2024-2025) que entrenaron al modelo para esa semana."""
    return query(
        con,
        "SELECT gl_account, gl_label, opco, source_file, COUNT(*) AS row_count, "
        "SUM(credit) AS total_credit FROM transactions "
        "WHERE driver = 'milestone_billing' AND iso_week = ? AND year IN (2024, 2025) "
        "GROUP BY gl_account, gl_label, opco, source_file ORDER BY total_credit DESC",
        [iso_week],
    )


@router.get("/week/{scenario}/{week}")
def get_audit(
    scenario: str, week: int, user: dict = Depends(require_roles("pe_board", "cfo"))
):
    validate_scenario(scenario)
    validate_week(week)
    con = get_connection()
    fc = query(
        con,
        "SELECT * FROM forecast_13w WHERE scenario = ? AND forecast_week = ? LIMIT 1",
        [scenario, week],
    )
    if not fc:
        con.close()
        raise not_computed()
    row = fc[0]

    src = _source_rows(con, row.get("iso_week")) if row.get("iso_week") else []
    gl_accounts = [
        {"gl": s["gl_account"], "label": s["gl_label"], "opco": s["opco"]}
        for s in {(s["gl_account"], s["gl_label"], s["opco"]): s for s in src}.values()
    ]
    source_files = sorted({s["source_file"] for s in src if s["source_file"]})
    training_rows = sum(int(s["row_count"]) for s in src)

    cum = query(
        con,
        "SELECT SUM(net_cashflow) AS cum FROM forecast_13w "
        "WHERE scenario = ? AND forecast_week <= ?",
        [scenario, week],
    )
    cov = query(con, "SELECT value FROM covenant_rules ORDER BY id LIMIT 1")
    meta = query(
        con,
        "SELECT COUNT(*) AS total, COUNT(DISTINCT system) AS systems FROM transactions",
    )
    mapped = query(con, "SELECT COUNT(*) AS n FROM gl_mapping")
    con.close()

    cumulative_cf = round(float(cum[0]["cum"] or 0), 2)
    threshold = float(cov[0]["value"]) if cov else 0.0

    return {
        "scenario": scenario,
        "forecast_week": week,
        "week_start": row.get("week_start"),
        "net_cashflow": row.get("net_cashflow"),
        "cumulative_cf": cumulative_cf,
        "covenant_headroom": round(cumulative_cf - threshold, 2),
        "drivers": {
            "d1_milestone_billing": {
                "value": row.get("d1_milestone_billing"),
                "direction": "inflow",
                "assumption": row.get("m1_assumption"),
                "model": "M1 — Prophet",
                "gl_accounts": gl_accounts,
                "training_rows": training_rows,
                "source_files": source_files,
            },
            "d2_materials_outflow": {
                "value": row.get("d2_materials_outflow"),
                "direction": "outflow",
                "assumption": row.get("m2_assumption"),
                "model": "M2 — Lag regression",
                "gl_accounts": [],
                "source_files": [],
            },
            "d3_subcon_payment": {
                "value": row.get("d3_subcon_payment"),
                "direction": "outflow",
                "assumption": row.get("m3_assumption"),
                "model": "M3 — Payment terms distribution",
                "gl_accounts": [g for g in gl_accounts if g["gl"] == "8001"],
                "source_files": [],
            },
            "d4_customer_collection": {
                "value": row.get("d4_customer_collection"),
                "direction": "inflow",
                "assumption": f"DSO {row.get('m4_dso_days')}d under {scenario} scenario",
                "model": "M4 — DSO collections",
                "gl_accounts": gl_accounts,
                "training_rows": training_rows,
                "source_files": source_files,
            },
            "d5_weather_impact": {
                "value": row.get("d5_weather_impact"),
                "direction": "neutral",
                "assumption": f"Weather threshold model: delay_weeks={row.get('m5_delay_weeks')}",
                "model": "M5 — Weather impact",
                "gl_accounts": [],
                "source_files": [],
            },
        },
        "audit_metadata": {
            "computed_at": row.get("computed_at"),
            "total_source_transactions": int(meta[0]["total"]) if meta else 0,
            "systems_reconciled": int(meta[0]["systems"]) if meta else 0,
            "gl_accounts_mapped": int(mapped[0]["n"]) if mapped else 0,
        },
    }
