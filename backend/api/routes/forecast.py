"""Endpoints 1-3: forecast. Lee SIEMPRE de `forecast_13w`."""

from __future__ import annotations

from fastapi import APIRouter

from db.database import get_connection, query

from ..validation import not_computed, validate_opco, validate_scenario, validate_week

router = APIRouter(tags=["forecast"])

DRIVER_COLS = (
    "d1_milestone_billing",
    "d2_materials_outflow",
    "d3_subcon_payment",
    "d4_customer_collection",
    "d5_weather_impact",
    "gross_inflow",
    "gross_outflow",
    "net_cashflow",
)

_AGG = ", ".join(f"SUM({c}) AS {c}" for c in DRIVER_COLS)


def _with_cumulative(weeks: list[dict]) -> list[dict]:
    cum = 0.0
    for w in weeks:
        cum += float(w.get("net_cashflow") or 0)
        w["cumulative_cf"] = round(cum, 2)
    return weeks


# 1. GET /forecast/{scenario}
@router.get("/{scenario}")
def get_forecast(scenario: str):
    validate_scenario(scenario)
    con = get_connection()
    weeks = query(
        con,
        f"SELECT forecast_week, week_start, {_AGG} FROM forecast_13w "
        "WHERE scenario = ? GROUP BY forecast_week, week_start "
        "ORDER BY forecast_week",
        [scenario],
    )
    con.close()
    if not weeks:
        raise not_computed()
    _with_cumulative(weeks)
    totals = {
        "total_gross_inflow": round(sum(float(w["gross_inflow"] or 0) for w in weeks), 2),
        "total_gross_outflow": round(sum(float(w["gross_outflow"] or 0) for w in weeks), 2),
        "total_net_cashflow": round(sum(float(w["net_cashflow"] or 0) for w in weeks), 2),
        "final_cumulative_cf": weeks[-1]["cumulative_cf"],
    }
    return {"scenario": scenario, "weeks": weeks, "totals": totals}


# 2. GET /forecast/{scenario}/{opco}
@router.get("/{scenario}/{opco}")
def get_forecast_opco(scenario: str, opco: str):
    validate_scenario(scenario)
    validate_opco(opco)
    con = get_connection()
    weeks = query(
        con,
        f"SELECT forecast_week, week_start, {_AGG} FROM forecast_13w "
        "WHERE scenario = ? AND opco = ? GROUP BY forecast_week, week_start "
        "ORDER BY forecast_week",
        [scenario, opco],
    )
    # portfolio share: net del opco vs total del escenario
    share = query(
        con,
        "SELECT "
        "(SELECT ABS(SUM(net_cashflow)) FROM forecast_13w WHERE scenario=? AND opco=?) AS o, "
        "(SELECT ABS(SUM(net_cashflow)) FROM forecast_13w WHERE scenario=?) AS t",
        [scenario, opco, scenario],
    )
    con.close()
    if not weeks:
        raise not_computed()
    _with_cumulative(weeks)
    o, t = (share[0]["o"] or 0), (share[0]["t"] or 0)
    pct = round(100 * float(o) / float(t), 2) if t else 0.0
    return {"scenario": scenario, "opco": opco, "portfolio_share_pct": pct, "weeks": weeks}


# 3. GET /forecast/week/{scenario}/{week}
@router.get("/week/{scenario}/{week}")
def get_forecast_week(scenario: str, week: int):
    validate_scenario(scenario)
    validate_week(week)
    con = get_connection()
    portfolio = query(
        con,
        f"SELECT forecast_week, week_start, {_AGG} FROM forecast_13w "
        "WHERE scenario = ? AND forecast_week = ? GROUP BY forecast_week, week_start",
        [scenario, week],
    )
    by_opco = query(
        con,
        "SELECT opco, SUM(net_cashflow) AS net_cashflow FROM forecast_13w "
        "WHERE scenario = ? AND forecast_week = ? GROUP BY opco ORDER BY opco",
        [scenario, week],
    )
    # cumulative hasta esta semana
    prev = query(
        con,
        "SELECT SUM(net_cashflow) AS cum FROM forecast_13w "
        "WHERE scenario = ? AND forecast_week <= ?",
        [scenario, week],
    )
    con.close()
    if not portfolio:
        raise not_computed()
    p = portfolio[0]
    p["cumulative_cf"] = round(float(prev[0]["cum"] or 0), 2)
    total = sum(abs(float(o["net_cashflow"] or 0)) for o in by_opco) or 1.0
    for o in by_opco:
        o["share_pct"] = round(100 * abs(float(o["net_cashflow"] or 0)) / total, 2)
    return {
        "scenario": scenario,
        "forecast_week": week,
        "week_start": p.get("week_start"),
        "portfolio": p,
        "by_opco": by_opco,
    }
