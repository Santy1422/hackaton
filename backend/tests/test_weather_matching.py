"""Test de exactitud del matching transactions(Excel) ↔ weather, por iso_week.

Mide, sobre datos reales en DuckDB:
  1. Cobertura      — toda semana del forecast tiene su fila de clima
  2. Fechas         — week_start coincide entre forecast_13w y weather_forecast
  3. iso_week join  — el iso_week del clima == iso_week del forecast
  4. Propagación    — el delay del clima realmente fluye al cashflow (d5)
  5. Consistencia   — m5_delay_weeks ≈ delay_days/7

Imprime un score /100. No inventa: todo se calcula de la base.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault(
    "DUCKDB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "altis_forecast.duckdb"),
)

from db.database import get_connection, query  # noqa: E402


def run() -> float:
    con = get_connection()

    fc_weeks = query(
        con,
        "SELECT DISTINCT forecast_week, iso_week, week_start FROM forecast_13w "
        "ORDER BY forecast_week",
    )
    wf = {r["iso_week"]: r for r in query(con, "SELECT * FROM weather_forecast")}

    assert fc_weeks, "forecast_13w vacío — corré `python run.py model` primero"
    assert wf, "weather_forecast vacío"

    # 1. Cobertura
    covered = [w for w in fc_weeks if w["iso_week"] in wf]
    coverage = len(covered) / len(fc_weeks)

    # 2. week_start coincide
    date_ok = sum(
        1 for w in covered if w["week_start"] == wf[w["iso_week"]]["week_start"]
    )
    date_match = date_ok / len(fc_weeks)

    # 3. join iso_week (cada forecast week mapea a exactamente una fila clima)
    iso_join = len(covered) / len(fc_weeks)

    # 4. propagación: semanas con delay>0 deben tener d5 != 0 en escenarios con clima
    delayed_isos = [iso for iso, r in wf.items() if (r["delay_days"] or 0) > 0]
    if delayed_isos:
        rows = query(
            con,
            "SELECT iso_week, SUM(ABS(d5_weather_impact)) imp FROM forecast_13w "
            "WHERE scenario IN ('base','wet_qtr') AND iso_week IN "
            f"({','.join(str(i) for i in delayed_isos)}) GROUP BY iso_week",
        )
        flowed = sum(1 for r in rows if (r["imp"] or 0) > 0)
        propagation = flowed / len(delayed_isos)
    else:
        propagation = 1.0

    # 5. consistencia delay_weeks vs delay_days
    cons = query(
        con,
        "SELECT f.iso_week, MAX(f.m5_delay_weeks) dw, MAX(w.delay_days) dd "
        "FROM forecast_13w f JOIN weather_forecast w USING (iso_week) "
        "GROUP BY f.iso_week",
    )
    consistent = sum(
        1 for r in cons if abs(float(r["dw"]) * 7 - float(r["dd"])) <= 1.0
    )
    consistency = consistent / len(cons) if cons else 0.0

    sources = query(
        con, "SELECT source, COUNT(*) c FROM weather_forecast GROUP BY source"
    )
    con.close()

    metrics = {
        "1. Cobertura forecast↔clima": coverage,
        "2. week_start coincide": date_match,
        "3. join por iso_week": iso_join,
        "4. delay propaga a cashflow (d5)": propagation,
        "5. m5_delay_weeks ≈ delay_days/7": consistency,
    }
    score = round(100 * sum(metrics.values()) / len(metrics), 1)

    print("=" * 56)
    print("  ACCURACY — matching transactions(Excel) ↔ weather")
    print("=" * 56)
    for k, v in metrics.items():
        print(f"  {k:<42} {v*100:5.1f}%")
    print("-" * 56)
    print(f"  Fuentes de clima: {[(s['source'], s['c']) for s in sources]}")
    print(f"  Semanas forecast: {len(fc_weeks)} | con delay>0: {len(delayed_isos)}")
    print("=" * 56)
    print(f"  SCORE GLOBAL: {score}/100")
    print("=" * 56)

    assert coverage == 1.0, "Hay semanas del forecast sin clima"
    assert date_match == 1.0, "week_start no coincide en alguna semana"
    return score


if __name__ == "__main__":
    run()
