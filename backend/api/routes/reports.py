"""Endpoint: narrativa de informes redactada por Claude sobre datos reales de la DB.

El backend calcula TODOS los números desde `forecast_13w` + `covenant_rules` y se
los pasa a Claude; el modelo solo escribe la prosa (nunca inventa cifras).
"""

from __future__ import annotations

import secrets
import time

from fastapi import APIRouter, Depends, Response

from pydantic import BaseModel

from db.database import get_connection, query
from models.report_narrative import generate_narrative

from ..auth import get_current_user, require_roles
from ..validation import SCENARIOS, validate_scenario

router = APIRouter(tags=["reports"])

# Store efímero de PDFs generados (1 réplica) → URL pública para que Zavu los baje.
_PDF_STORE: dict[str, tuple[bytes, float]] = {}
_PDF_TTL = 3600  # 1 hora


def publish_pdf(data: bytes) -> str:
    """Guarda un PDF y devuelve un token para servirlo en /api/reports/pdf/{token}."""
    now = time.time()
    for k, (_, exp) in list(_PDF_STORE.items()):
        if exp < now:
            _PDF_STORE.pop(k, None)
    token = secrets.token_urlsafe(16)
    _PDF_STORE[token] = (data, now + _PDF_TTL)
    return token


@router.get("/pdf/{token}")
def get_pdf(token: str):
    """Sirve un PDF generado (público, efímero) — lo descarga Zavu para WhatsApp."""
    item = _PDF_STORE.get(token)
    if not item or item[1] < time.time():
        return Response(status_code=404)
    return Response(
        content=item[0],
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="altis-forecast-{token[:8]}.pdf"'},
    )


@router.get("/download/{scenario}")
def download_pdf(scenario: str, user: dict = Depends(get_current_user)):
    """Genera y devuelve el PDF del informe (server-side, datos reales).

    Robusto: no depende de html2pdf en el browser. Cualquier usuario autenticado.
    """
    validate_scenario(scenario)
    from models.pdf_report import build_pdf

    pdf = build_pdf(scenario)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="altis-forecast-{scenario}.pdf"'},
    )


SCEN_LABEL = {"base": "Base", "wet_qtr": "Wet quarter", "dry_qtr": "Dry quarter"}


def _eur(n) -> str:
    v = round(float(n or 0))
    return f"-€{abs(v):,.0f}" if v < 0 else f"€{v:,.0f}"


def _scenario_stats(con, scenario: str, threshold: float) -> dict:
    """Agrega forecast_13w por semana y deriva status / headroom / valle (desde la DB)."""
    weeks = query(
        con,
        "SELECT forecast_week, SUM(net_cashflow) AS net, "
        "SUM(d1_milestone_billing) AS d1, SUM(d2_materials_outflow) AS d2, "
        "SUM(d3_subcon_payment) AS d3, SUM(d4_customer_collection) AS d4, "
        "SUM(d5_weather_impact) AS d5 "
        "FROM forecast_13w WHERE scenario = ? GROUP BY forecast_week ORDER BY forecast_week",
        [scenario],
    )
    if not weeks:
        return {}
    cum = 0.0
    min_cum, min_week = None, None
    drivers = {f"d{i}": 0.0 for i in range(1, 6)}
    total_net = 0.0
    for w in weeks:
        net = float(w["net"] or 0)
        total_net += net
        cum += net
        for i in range(1, 6):
            drivers[f"d{i}"] += float(w[f"d{i}"] or 0)
        if min_cum is None or cum < min_cum:
            min_cum, min_week = cum, w["forecast_week"]
    headroom = min_cum - threshold
    status = "BREACH" if min_cum < threshold else "WATCH" if min_cum < threshold + 200000 else "SAFE"
    return {
        "status": status,
        "total_net_cashflow_fmt": _eur(total_net),
        "ending_cash_fmt": _eur(cum),
        "low_point_fmt": _eur(min_cum),
        "low_week": min_week,
        "headroom_fmt": _eur(headroom),
        "drivers_fmt": {k: _eur(v) for k, v in drivers.items()},
    }


class NarrativeBody(BaseModel):
    scenario: str = "base"
    kind: str = "weekly"  # weekly | monthly


@router.post("/narrative")
def report_narrative(
    body: NarrativeBody, user: dict = Depends(require_roles("pe_board", "cfo"))
):
    validate_scenario(body.scenario)
    con = get_connection()
    rules = query(
        con,
        "SELECT value FROM covenant_rules WHERE threshold_type='min_cumulative_cashflow' "
        "ORDER BY id LIMIT 1",
    )
    threshold = float(rules[0]["value"]) if rules else -500000.0

    all_scen = {}
    for s in SCENARIOS:
        st = _scenario_stats(con, s, threshold)
        if st:
            all_scen[s] = {"status": st["status"], "headroom_fmt": st["headroom_fmt"]}
    active = _scenario_stats(con, body.scenario, threshold)
    con.close()

    payload = {
        "kind": body.kind,
        "scenario": body.scenario,
        "scenario_label": SCEN_LABEL.get(body.scenario, body.scenario),
        "covenant_threshold_fmt": _eur(threshold),
        "active": active,
        "all_scenarios": all_scen,
    }

    narrative = generate_narrative(payload)
    return {"scenario": body.scenario, "kind": body.kind, "data": payload, "narrative": narrative}
