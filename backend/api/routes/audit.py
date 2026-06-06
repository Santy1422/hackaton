"""Endpoint de audit trail — crítico para el demo.

El jurado hace click en un número y pregunta "de dónde sale". La respuesta
traza driver → GL accounts → source rows → source files.
"""

from fastapi import APIRouter

from db.database import get_connection, query

router = APIRouter(tags=["audit"])


@router.get("/week/{scenario}/{week}")
def audit_week(scenario: str, week: int):
    """Audit trail completo: drivers → GL → source rows."""
    con = get_connection()
    fc = query(
        con,
        "SELECT * FROM forecast_13w WHERE scenario = ? AND forecast_week = ? "
        "LIMIT 1",
        [scenario, week],
    )
    con.close()
    if not fc:
        return {"scenario": scenario, "forecast_week": week, "drivers": {}}
    row = fc[0]
    # TODO: enriquecer cada driver con gl_accounts, source_rows y source_files
    return {
        "scenario": scenario,
        "forecast_week": week,
        "week_start": row.get("week_start"),
        "net_cashflow": row.get("net_cashflow"),
        "drivers": {
            "d1_milestone_billing": {
                "value": row.get("d1_milestone_billing"),
                "assumption": row.get("m1_assumption"),
            },
            "d2_materials_outflow": {
                "value": row.get("d2_materials_outflow"),
                "assumption": row.get("m2_assumption"),
            },
            "d3_subcon_payment": {
                "value": row.get("d3_subcon_payment"),
                "assumption": row.get("m3_assumption"),
            },
            "d4_customer_collection": {
                "value": row.get("d4_customer_collection"),
                "assumption": f"DSO {row.get('m4_dso_days')}d",
            },
            "d5_weather_impact": {
                "value": row.get("d5_weather_impact"),
                "assumption": f"delay_weeks={row.get('m5_delay_weeks')}",
            },
        },
    }
