"""Endpoint 5: covenant. Cumulative CF + headroom vs threshold, 3 escenarios."""

from __future__ import annotations

from fastapi import APIRouter

from db.database import get_connection, query

from ..validation import SCENARIOS, not_computed, validate_scenario

router = APIRouter(tags=["covenant"])


def _scenario_series(con, scenario: str, threshold: float) -> tuple[list[dict], dict]:
    rows = query(
        con,
        "SELECT forecast_week, week_start, SUM(net_cashflow) AS net_cashflow "
        "FROM forecast_13w WHERE scenario = ? "
        "GROUP BY forecast_week, week_start ORDER BY forecast_week",
        [scenario],
    )
    cum = 0.0
    weeks = []
    for r in rows:
        cum += float(r["net_cashflow"] or 0)
        headroom = round(cum - threshold, 2)
        weeks.append(
            {
                "forecast_week": r["forecast_week"],
                "week_start": r["week_start"],
                "net_cashflow": round(float(r["net_cashflow"] or 0), 2),
                "cumulative_cf": round(cum, 2),
                "covenant_headroom": headroom,
                "covenant_breach": cum < threshold,
            }
        )
    if not weeks:
        return [], {}
    min_w = min(weeks, key=lambda w: w["covenant_headroom"])
    any_breach = any(w["covenant_breach"] for w in weeks)
    final = weeks[-1]["covenant_headroom"]
    status = "BREACH" if any_breach else ("WATCH" if final < threshold * -0.4 else "SAFE")
    summary = {
        "min_headroom": min_w["covenant_headroom"],
        "min_headroom_week": min_w["forecast_week"],
        "any_breach": any_breach,
        "final_headroom": final,
        "status": status,
    }
    return weeks, summary


@router.get("/{scenario}")
def get_covenant(scenario: str):
    validate_scenario(scenario)
    con = get_connection()
    rules = query(
        con,
        "SELECT value, threshold_type, horizon_weeks FROM covenant_rules "
        "WHERE threshold_type = 'min_cumulative_cashflow' ORDER BY id LIMIT 1",
    )
    threshold = float(rules[0]["value"]) if rules else -500000.0

    weeks, summary = _scenario_series(con, scenario, threshold)
    if not weeks:
        con.close()
        raise not_computed()

    all_scenarios = {}
    for s in SCENARIOS:
        _, summ = _scenario_series(con, s, threshold)
        if summ:
            all_scenarios[s] = {
                "final_headroom": summ["final_headroom"],
                "any_breach": summ["any_breach"],
                "status": summ["status"],
            }
    con.close()

    return {
        "scenario": scenario,
        "covenant_threshold": threshold,
        "threshold_type": "min_cumulative_cashflow",
        "horizon_weeks": rules[0]["horizon_weeks"] if rules else 13,
        "weeks": weeks,
        "summary": summary,
        "all_scenarios": all_scenarios,
    }
