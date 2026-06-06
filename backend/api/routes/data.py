"""Endpoints 6-15: wip, weather, milestones, actuals, stats, gl-mapping,
recompute, health. Montados bajo /api."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.database import get_connection, query

from ..auth import enforce_opco_scope, get_current_user, require_roles
from ..validation import OPCO_META, err, validate_opco

router = APIRouter(tags=["data"])


# 6. GET /wip/{opco}  — opco_md (su opco) + pe_board / cfo (cualquiera)
@router.get("/wip/{opco}")
def get_wip(
    opco: str,
    user: dict = Depends(require_roles("pe_board", "cfo", "opco_md")),
):
    validate_opco(opco)
    enforce_opco_scope(user, opco)
    con = get_connection()
    summary = query(
        con,
        "SELECT COUNT(DISTINCT doc_number) AS active_projects, "
        "SUM(credit) AS total_billed_90d, AVG(credit) AS avg_transaction_value, "
        "SUM(credit) / 13.0 AS weekly_run_rate FROM transactions "
        "WHERE opco = ? AND date >= CURRENT_DATE - INTERVAL '90 days' AND credit > 0",
        [opco],
    )
    top = query(
        con,
        "SELECT project_code, doc_number, MAX(date) AS last_activity, "
        "SUM(credit) AS total_billed, COUNT(*) AS transaction_count, "
        "MAX(gl_account) AS gl_account, MAX(gl_label) AS gl_label FROM transactions "
        "WHERE opco = ? AND date >= CURRENT_DATE - INTERVAL '90 days' AND credit > 0 "
        "GROUP BY project_code, doc_number ORDER BY total_billed DESC LIMIT 50",
        [opco],
    )
    con.close()
    s = summary[0] if summary else {}
    wip_value = float(s.get("total_billed_90d") or 0)
    run_rate = float(s.get("weekly_run_rate") or 0)
    risk = "high" if run_rate > 200000 else "medium" if run_rate > 80000 else "low"
    return {
        "opco": opco,
        "summary": {
            "wip_value": round(wip_value, 2),
            "active_projects": int(s.get("active_projects") or 0),
            "weekly_run_rate": round(run_rate, 2),
            "avg_transaction_value": round(float(s.get("avg_transaction_value") or 0), 2),
            "risk_level": risk,
        },
        "top_projects": top,
    }


# 7. GET /weather  — cualquier usuario autenticado (no es opco-específico)
#    Cada semana trae DOS señales separadas y calibradas:
#      schedule  → días de obra perdidos (límite físico de techado) — Project Lead
#      financial → € de desviación del cashflow por anomalía (calibrado de datos)
@router.get("/weather")
def get_weather(
    weeks: int = 13,
    lat: float = 52.37,
    lon: float = 4.89,
    user: dict = Depends(get_current_user),
):
    from models.weather_calibration import (
        financial_impact_eur,
        load_or_calibrate,
        schedule_signal,
    )

    con = get_connection()
    rows = query(con, "SELECT * FROM weather_forecast ORDER BY iso_week LIMIT ?", [weeks])
    source = "weather_forecast"

    # fallback: tabla vacía → fetch en vivo de Open-Meteo
    if not rows:
        try:
            from models.m5_weather import fetch_weather_forecast

            df = fetch_weather_forecast(lat=lat, lon=lon, weeks=weeks)
            rows = [
                {
                    "iso_week": int(r.get("iso_week", i)),
                    "week_start": r.get("week_start"),
                    "temp_avg": round(float(r.get("temp_avg", 0)), 1),
                    "rain_mm": round(float(r.get("rain_mm", 0)), 1),
                    "frost_days": int(r.get("frost_days", 0)),
                    "wind_bft": round(float(r.get("wind_bft", 0)), 1),
                    "source": r.get("source", "open-meteo"),
                }
                for i, r in enumerate(df.to_dict("records"), start=1)
            ]
            source = "open-meteo"
        except Exception as e:
            con.close()
            raise HTTPException(
                503, detail=err("WEATHER_API_UNAVAILABLE", f"Open-Meteo unreachable: {e}")
            )

    try:
        calib = load_or_calibrate(con, lat, lon)
    except Exception:
        calib = None
    con.close()

    out = []
    for i, r in enumerate(rows, start=1):
        rain = float(r.get("rain_mm") or 0)
        frost = int(r.get("frost_days") or 0)
        wind = float(r.get("wind_bft") or 0)
        iso = int(r.get("iso_week") or i)
        sched = schedule_signal(rain, frost, wind)
        fin = financial_impact_eur(r, iso, calib) if calib else None
        out.append(
            {
                "forecast_week": i,
                "iso_week": iso,
                "week_start": r.get("week_start"),
                "temp_avg": round(float(r.get("temp_avg") or 0), 1),
                "rain_mm": round(rain, 1),
                "frost_days": frost,
                "wind_bft": round(wind, 1),
                "source": r.get("source"),
                "risk_level": sched["risk_level"],          # = schedule risk (físico)
                "schedule": sched,                          # Project Lead
                "financial": fin,                           # CFO / forecast (calibrado)
            }
        )

    return {
        "source": source,
        "location": {"lat": lat, "lon": lon},
        "weeks": out,
        "calibration": _calib_summary(calib) if calib else None,
    }


def _calib_summary(calib: dict) -> dict:
    """Resumen liviano de la calibración para mostrar inline en el dashboard."""
    return {
        "method": calib["method"],
        "period": calib["period"],
        "n_weeks": calib["n_weeks"],
        "multivariate_r2": calib["multivariate_r2"],
        "financial_confidence": calib["financial_confidence"],
        "significant_drivers": calib["significant_drivers"],
        "verdict": calib["verdict"],
    }


# 7b. GET /weather/calibration  — evidencia empírica clima↔billing (audit)
@router.get("/weather/calibration")
def get_weather_calibration(
    refresh: bool = False,
    lat: float = 52.37,
    lon: float = 4.89,
    user: dict = Depends(get_current_user),
):
    from models.weather_calibration import calibrate, load_or_calibrate, persist

    con = get_connection()
    try:
        if refresh:
            calib = calibrate(con, lat, lon, force=True)
            persist(con, calib)
        else:
            calib = load_or_calibrate(con, lat, lon)
    except Exception as e:
        con.close()
        raise HTTPException(
            503, detail=err("CALIBRATION_UNAVAILABLE", f"Could not calibrate: {e}")
        )
    con.close()
    return calib


# 8. GET /milestones/{opco}  — project_lead/opco_md (su opco) + pe_board / cfo
@router.get("/milestones/{opco}")
def get_milestones(opco: str, user: dict = Depends(get_current_user)):
    validate_opco(opco)
    enforce_opco_scope(user, opco)
    con = get_connection()
    rows = query(
        con,
        "SELECT doc_number, MAX(description) AS description, MAX(gl_account) AS gl_account, "
        "SUM(credit) AS contract_value, MAX(date) AS last_billed_date, "
        "COUNT(*) AS installments_billed FROM transactions "
        "WHERE opco = ? AND credit > 50000 AND date >= CURRENT_DATE - INTERVAL '180 days' "
        "GROUP BY doc_number ORDER BY last_billed_date DESC LIMIT 20",
        [opco],
    )
    con.close()
    return {"opco": opco, "milestones": rows}


# 9. GET /actuals/monthly  — consolidado cross-opco: pe_board / cfo
@router.get("/actuals/monthly")
def get_actuals_monthly(
    from_year: int = 2024,
    user: dict = Depends(require_roles("pe_board", "cfo")),
):
    con = get_connection()
    rows = query(
        con,
        "SELECT DATE_TRUNC('month', date) AS month, opco, SUM(credit) AS revenue, "
        "COUNT(DISTINCT doc_number) AS invoice_count FROM transactions "
        "WHERE EXTRACT(YEAR FROM date)::int >= ? AND credit > 0 "
        "GROUP BY DATE_TRUNC('month', date), opco ORDER BY month, opco",
        [from_year],
    )
    yearly = query(
        con,
        "SELECT EXTRACT(YEAR FROM date)::int AS y, SUM(credit) AS total FROM transactions "
        "WHERE credit > 0 GROUP BY EXTRACT(YEAR FROM date)::int ORDER BY y",
    )
    con.close()
    months: dict[str, dict] = {}
    for r in rows:
        key = str(r["month"])[:7]
        m = months.setdefault(key, {"month": key, "total_revenue": 0.0, "by_opco": {}, "invoice_count": 0})
        rev = float(r["revenue"] or 0)
        m["by_opco"][r["opco"]] = round(rev, 2)
        m["total_revenue"] = round(m["total_revenue"] + rev, 2)
        m["invoice_count"] += int(r["invoice_count"] or 0)
    yoy = {f"{int(y['y'])}_total": round(float(y["total"] or 0), 2) for y in yearly}
    return {"from_year": from_year, "months": list(months.values()), "yoy": yoy}


# 10. GET /actuals/weekly/{opco}  — opco_md (su opco) + pe_board / cfo
@router.get("/actuals/weekly/{opco}")
def get_actuals_weekly(
    opco: str,
    user: dict = Depends(require_roles("pe_board", "cfo", "opco_md")),
):
    validate_opco(opco)
    enforce_opco_scope(user, opco)
    con = get_connection()
    rows = query(
        con,
        "SELECT year, iso_week, MIN(date) AS week_start, SUM(credit) AS revenue, "
        "COUNT(*) AS transaction_count FROM transactions "
        "WHERE opco = ? AND credit > 0 AND year IN (2024, 2025) "
        "GROUP BY year, iso_week ORDER BY year, iso_week",
        [opco],
    )
    con.close()
    return {"opco": opco, "weeks": rows}


# GET /sources  — conectores ERP (onboarding): sistemas reales + última sync
@router.get("/sources")
def get_sources(user: dict = Depends(get_current_user)):
    con = get_connection()
    systems = query(
        con,
        "SELECT system, COUNT(*) AS transactions, MAX(date) AS last_date "
        "FROM transactions GROUP BY system ORDER BY transactions DESC",
    )
    total = query(con, "SELECT COUNT(*) AS n FROM transactions")
    mapped = query(con, "SELECT COUNT(*) AS n FROM gl_mapping")
    log = query(
        con,
        "SELECT timestamp, rows_inserted FROM reconciliation_log ORDER BY id DESC LIMIT 1",
    )
    con.close()
    return {
        "systems": systems,
        "total_transactions": int(total[0]["n"]) if total else 0,
        "gl_accounts_mapped": int(mapped[0]["n"]) if mapped else 0,
        "last_sync": log[0]["timestamp"] if log else None,
        "last_rows_inserted": int(log[0]["rows_inserted"]) if log else 0,
    }


# GET /opcos  — lista real de operating companies (data-driven, no hardcode).
# Soporta "alta de nueva opco = cambio de datos, no de código".
@router.get("/opcos")
def get_opcos(user: dict = Depends(require_roles("pe_board", "cfo"))):
    con = get_connection()
    rows = query(
        con,
        "SELECT opco, COUNT(*) AS transactions, "
        "SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) AS revenue, "
        "MAX(date) AS last_activity FROM transactions "
        "WHERE opco IS NOT NULL GROUP BY opco ORDER BY opco",
    )
    con.close()
    total_rev = sum(float(r["revenue"] or 0) for r in rows) or 1.0
    return {
        "opcos": [
            {
                "id": r["opco"],
                "name": OPCO_META.get(r["opco"], {}).get("name", r["opco"]),
                "system": OPCO_META.get(r["opco"], {}).get("system"),
                "transactions": int(r["transactions"] or 0),
                "revenue": round(float(r["revenue"] or 0), 2),
                "share": round(float(r["revenue"] or 0) / total_rev, 4),
                "last_activity": r["last_activity"],
            }
            for r in rows
        ]
    }


# 11. GET /stats  — cualquier usuario autenticado (KPIs de cabecera)
@router.get("/stats")
def get_stats(user: dict = Depends(get_current_user)):
    con = get_connection()
    tx = query(
        con,
        "SELECT COUNT(*) AS total_rows, MIN(date) AS dmin, MAX(date) AS dmax FROM transactions",
    )
    by_year = query(
        con,
        "SELECT year, SUM(credit) AS rev FROM transactions WHERE credit > 0 GROUP BY year ORDER BY year",
    )
    mapped = query(con, "SELECT COUNT(*) AS n FROM gl_mapping")
    fc = query(
        con,
        "SELECT COUNT(*) AS rows, COUNT(DISTINCT scenario) AS scen, MAX(computed_at) AS last "
        "FROM forecast_13w",
    )
    con.close()
    t = tx[0] if tx else {}
    return {
        "transactions": {
            "total_rows": int(t.get("total_rows") or 0),
            "date_range": {"from": t.get("dmin"), "to": t.get("dmax")},
            "gl_accounts_mapped": int(mapped[0]["n"]) if mapped else 0,
        },
        "revenue": {f"total_{int(y['year'])}": round(float(y["rev"] or 0), 2) for y in by_year if y["year"]},
        "forecast": {
            "horizon_weeks": 13,
            "rows": int(fc[0]["rows"]) if fc else 0,
            "scenarios_computed": int(fc[0]["scen"]) if fc else 0,
            "last_computed_at": fc[0]["last"] if fc else None,
        },
    }


# 12. GET /gl-mapping  — gobierno de datos: cfo
@router.get("/gl-mapping")
def get_gl_mapping(user: dict = Depends(require_roles("cfo"))):
    con = get_connection()
    mappings = query(con, "SELECT * FROM gl_mapping ORDER BY gl_account")
    con.close()
    return {"mappings": mappings, "total_mapped": len(mappings)}


# 13. PUT /gl-mapping/{gl_account}
class GLMappingUpdate(BaseModel):
    label: str | None = None
    driver: str | None = None
    btw_type: str | None = None
    reviewed_by: str = "controller"


@router.put("/gl-mapping/{gl_account}")
def update_gl_mapping(
    gl_account: str,
    body: GLMappingUpdate,
    user: dict = Depends(require_roles("cfo")),
):
    con = get_connection()
    existing = query(con, "SELECT gl_account FROM gl_mapping WHERE gl_account = ?", [gl_account])
    if not existing:
        con.execute(
            "INSERT INTO gl_mapping (gl_account, label, driver, btw_type, reviewed_by, reviewed_at) "
            "VALUES (?, ?, ?, ?, ?, current_timestamp)",
            [gl_account, body.label, body.driver, body.btw_type, body.reviewed_by],
        )
    else:
        con.execute(
            "UPDATE gl_mapping SET label = COALESCE(?, label), driver = COALESCE(?, driver), "
            "btw_type = COALESCE(?, btw_type), reviewed_by = ?, reviewed_at = current_timestamp "
            "WHERE gl_account = ?",
            [body.label, body.driver, body.btw_type, body.reviewed_by, gl_account],
        )
    con.close()
    return {
        "gl_account": gl_account,
        "updated": True,
        "recompute_triggered": False,
        "message": f"GL {gl_account} updated. Run POST /recompute to refresh forecast.",
    }


# 14. POST /recompute
class RecomputeOptions(BaseModel):
    scenarios: list[str] | None = None
    fetch_fresh_weather: bool = True


@router.post("/recompute")
def recompute(
    options: RecomputeOptions | None = None,
    user: dict = Depends(require_roles("cfo")),
):
    start = time.perf_counter()
    warnings: list[str] = []
    rows_written = 0
    try:
        from ingestion.reconcile import reconcile_all

        rows_written = reconcile_all("data/raw/")
    except Exception as e:
        warnings.append(f"ingestion: {e}")
    try:
        from db.database import get_connection as _gc
        from models.scenario_engine import run_all_scenarios

        run_all_scenarios(_gc())
    except NotImplementedError:
        warnings.append("models: scenario_engine not implemented yet")
    except Exception as e:
        warnings.append(f"models: {e}")
    # refrescar la calibración empírica clima↔billing (best-effort)
    try:
        from models.weather_calibration import calibrate, persist

        c = get_connection()
        persist(c, calibrate(c, force=True))
        c.close()
    except Exception as e:
        warnings.append(f"calibration: {e}")
    return {
        "status": "ok" if not warnings else "partial",
        "duration_seconds": round(time.perf_counter() - start, 2),
        "rows_written": rows_written,
        "warnings": warnings,
    }


# 15. GET /health
@router.get("/health")
def health():
    try:
        con = get_connection()
        tx = query(con, "SELECT COUNT(*) AS n FROM transactions")
        fc = query(con, "SELECT COUNT(*) AS n FROM forecast_13w")
        con.close()
        return {
            "status": "ok",
            "db": "connected",
            "transactions_rows": int(tx[0]["n"]),
            "forecast_rows": int(fc[0]["n"]),
        }
    except Exception as e:
        raise HTTPException(500, detail=err("DB_ERROR", f"DB connection failed: {e}"))
