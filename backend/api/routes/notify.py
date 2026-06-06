"""Endpoints de notificación por WhatsApp (Zavu)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from db.database import execute, get_connection, query
from integrations.zavu import send_whatsapp, verify_signature
from models.assistant import answer_question

from ..auth import get_current_user, require_roles
from ..validation import err, validate_scenario
from .reports import SCEN_LABEL, _eur, _scenario_stats

router = APIRouter(tags=["notify"])

# Catálogo de crons de WhatsApp (single source of truth, server-side).
# `default_enabled` es el estado inicial; cada usuario persiste el suyo en DB.
AUTOMATIONS = [
    {"id": "weekly_digest", "label": "Weekly forecast digest", "schedule": "Mondays · 08:00", "cron": "0 8 * * 1", "default_enabled": True},
    {"id": "covenant_alert", "label": "Covenant alert", "schedule": "when status → WATCH / BREACH", "cron": "0 * * * *", "default_enabled": True},
    {"id": "monthly_report", "label": "Monthly report (PDF)", "schedule": "1st of month · 08:00", "cron": "0 8 1 * *", "default_enabled": False},
]
AUTOMATION_IDS = {a["id"] for a in AUTOMATIONS}


def _ensure_prefs(con) -> None:
    con.execute(
        "CREATE TABLE IF NOT EXISTS automation_prefs ("
        "  user_id INTEGER NOT NULL,"
        "  automation_id VARCHAR NOT NULL,"
        "  enabled BOOLEAN NOT NULL,"
        "  updated_at TIMESTAMP DEFAULT current_timestamp,"
        "  PRIMARY KEY (user_id, automation_id)"
        ")"
    )


def _automations_for(con, user_id: int) -> list[dict]:
    """Catálogo + estado por usuario (default si aún no tocó el toggle)."""
    _ensure_prefs(con)
    prefs = {
        r["automation_id"]: r["enabled"]
        for r in query(con, "SELECT automation_id, enabled FROM automation_prefs WHERE user_id = ?", [user_id])
    }
    return [
        {
            "id": a["id"],
            "label": a["label"],
            "schedule": a["schedule"],
            "cron": a["cron"],
            "enabled": prefs.get(a["id"], a["default_enabled"]),
        }
        for a in AUTOMATIONS
    ]


class WhatsAppBody(BaseModel):
    to: str
    text: str


class AlertBody(BaseModel):
    to: str


class AskBody(BaseModel):
    question: str
    to: str | None = None  # si viene, además responde por WhatsApp


@router.post("/whatsapp")
def notify_whatsapp(body: WhatsAppBody, user: dict = Depends(get_current_user)):
    """Envío directo de un mensaje de WhatsApp (cualquier usuario autenticado)."""
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


@router.get("/automations")
def list_automations(user: dict = Depends(get_current_user)):
    """Crons de WhatsApp del usuario (catálogo + estado persistido)."""
    con = get_connection()
    autos = _automations_for(con, user["id"])
    con.close()
    return {"automations": autos}


class AutomationToggle(BaseModel):
    id: str
    enabled: bool


@router.post("/automations")
def set_automation(body: AutomationToggle, user: dict = Depends(get_current_user)):
    """Activa/desactiva un cron para el usuario (persistido en DB)."""
    if body.id not in AUTOMATION_IDS:
        raise HTTPException(404, detail=err("UNKNOWN_AUTOMATION", f"No automation '{body.id}'."))
    con = get_connection()
    _ensure_prefs(con)
    execute(
        con,
        "INSERT INTO automation_prefs (user_id, automation_id, enabled, updated_at) "
        "VALUES (?, ?, ?, current_timestamp) "
        "ON CONFLICT (user_id, automation_id) DO UPDATE SET "
        "enabled = EXCLUDED.enabled, updated_at = current_timestamp",
        [user["id"], body.id, body.enabled],
    )
    autos = _automations_for(con, user["id"])
    con.close()
    return {"automations": autos}


@router.post("/ask")
def ask(body: AskBody, user: dict = Depends(get_current_user)):
    """Pregunta sobre el forecast respondida por Claude (opcionalmente por WhatsApp)."""
    text = answer_question(body.question)
    out = {"question": body.question, "answer": text}
    if body.to:
        out["result"] = send_whatsapp(body.to, text)
    return out


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request):
    """Webhook de Zavu: mensaje entrante → Claude responde → reply por WhatsApp.

    Verifica `x-zavu-signature` (si hay ZAVU_WEBHOOK_SECRET). Solo procesa
    `message.inbound` de WhatsApp tipo texto; el resto se ignora con 200.
    Payload Zavu: { type, senderId, data: { from, text, channel, messageId } }.
    """
    raw = await request.body()
    if not verify_signature(raw, request.headers.get("x-zavu-signature"), dict(request.headers)):
        return {"ok": False, "reason": "invalid signature"}

    import json

    try:
        payload = json.loads(raw or b"{}")
    except Exception:
        return {"ok": False, "reason": "invalid json"}

    if payload.get("type") not in (None, "message.inbound"):
        return {"ok": True, "ignored": payload.get("type")}

    data = payload.get("data", payload)
    text = data.get("text") or ""
    frm = data.get("from")
    if data.get("messageType", "text") != "text" or not text or not frm:
        return {"ok": True, "ignored": "non-text or missing from/text"}

    answer = answer_question(text)
    result = send_whatsapp(frm, answer)
    return {"ok": True, "from": frm, "answer": answer, "result": result}
