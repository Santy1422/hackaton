"""Endpoint de covenant: cumulative CF + headroom vs threshold."""

from fastapi import APIRouter

from db.database import get_connection, query

router = APIRouter(tags=["covenant"])


@router.get("/{scenario}")
def get_covenant(scenario: str):
    """Cumulative CF + headroom vs el umbral de covenant."""
    con = get_connection()
    rules = query(con, "SELECT * FROM covenant_rules ORDER BY id LIMIT 1")
    weeks = query(
        con,
        "SELECT forecast_week, SUM(net_cashflow) AS net_cashflow "
        "FROM forecast_13w WHERE scenario = ? "
        "GROUP BY forecast_week ORDER BY forecast_week",
        [scenario],
    )
    con.close()

    threshold = float(rules[0]["value"]) if rules else 0.0
    cumulative = 0.0
    series = []
    for w in weeks:
        cumulative += float(w["net_cashflow"] or 0)
        series.append(
            {
                "forecast_week": w["forecast_week"],
                "cumulative_cf": cumulative,
                "headroom": cumulative - threshold,
            }
        )
    return {"scenario": scenario, "threshold": threshold, "weeks": series}
