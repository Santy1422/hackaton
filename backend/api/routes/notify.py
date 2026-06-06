"""Endpoints de notificación por WhatsApp (Zavu)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db.database import get_connection, query
from integrations.zavu import send_whatsapp

from ..auth import require_roles
from ..validation import validate_scenario
from .reports import SCEN_LABEL, _eur, _scenario_stats

router = APIRouter(tags=["notify"])


class WhatsAppBody(BaseModel):
    to: str
    text: str


class AlertBody(BaseModel):
    to: str


@router.post("/whatsapp")
def notify_whatsapp(body: WhatsAppBody, user: dict = Depends(require_roles("pe_board", "cfo"))):
    """Envío directo de un mensaje de WhatsApp."""
    return send_whatsapp(body.to, body.text)


@router.post("/covenant/{scenario}")
def notify_covenant(
    scenario: str, body: AlertBody, user: dict = Depends(require_roles("pe_board", "cfo"))
):
    """Arma la alerta de covenant desde la DB y la manda por WhatsApp."""
    validate_scenario(scenario)
    con = get_connection()
    rules = query(
        con,
        "SELECT value FROM covenant_rules WHERE threshold_type='min_cumulative_cashflow' "
        "ORDER BY id LIMIT 1",
    )
    threshold = float(rules[0]["value"]) if rules else -500000.0
    st = _scenario_stats(con, scenario, threshold)
    con.close()
    if not st:
        return {"sent": False, "reason": "forecast not computed"}

    emoji = {"SAFE": "🟢", "WATCH": "🟡", "BREACH": "🔴"}.get(st["status"], "•")
    text = (
        f"{emoji} *Altis Forecast — Covenant {SCEN_LABEL.get(scenario, scenario)}*\n"
        f"Status: {st['status']}\n"
        f"Worst-case headroom: {st['headroom_fmt']} (floor {_eur(threshold)})\n"
        f"Low point: {st['low_point_fmt']} in week {st['low_week']}\n"
        f"Net 13w: {st['total_net_cashflow_fmt']} · ending {st['ending_cash_fmt']}"
    )
    result = send_whatsapp(body.to, text)
    return {"scenario": scenario, "message": text, "result": result}
