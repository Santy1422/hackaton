"""Endpoints de forecast: lee SIEMPRE de la tabla `forecast_13w`."""

from fastapi import APIRouter

from db.database import get_connection, query

router = APIRouter(tags=["forecast"])


@router.get("/{scenario}")
def get_forecast(scenario: str):
    """13-week forecast, todos los opcos combinados."""
    con = get_connection()
    rows = query(
        con,
        "SELECT forecast_week, week_start, "
        "SUM(net_cashflow) AS net_cashflow, SUM(cumulative_cf) AS cumulative_cf "
        "FROM forecast_13w WHERE scenario = ? "
        "GROUP BY forecast_week, week_start ORDER BY forecast_week",
        [scenario],
    )
    con.close()
    return {"scenario": scenario, "weeks": rows}


@router.get("/{scenario}/{opco}")
def get_forecast_opco(scenario: str, opco: str):
    """13-week forecast para un opco."""
    con = get_connection()
    rows = query(
        con,
        "SELECT * FROM forecast_13w WHERE scenario = ? AND opco = ? "
        "ORDER BY forecast_week",
        [scenario, opco],
    )
    con.close()
    return {"scenario": scenario, "opco": opco, "weeks": rows}


@router.get("/week/{scenario}/{week}")
def get_week_detail(scenario: str, week: int):
    """Detalle de una semana con los 5 drivers."""
    con = get_connection()
    rows = query(
        con,
        "SELECT * FROM forecast_13w WHERE scenario = ? AND forecast_week = ?",
        [scenario, week],
    )
    con.close()
    return {"scenario": scenario, "forecast_week": week, "rows": rows}
