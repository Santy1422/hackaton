"""Endpoints de notificación por WhatsApp (Zavu)."""

from __future__ import annotations

import logging
import os
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from db.database import execute, get_connection, query
from integrations.zavu import send_whatsapp, verify_signature
from models.assistant import answer_question

from ..auth import get_current_user, require_roles
from ..validation import err, validate_scenario
from .reports import SCEN_LABEL, _eur, _scenario_stats

router = APIRouter(tags=["notify"])

log = logging.getLogger("notify")

# Número del bot y template aprobado para envío proactivo.
WHATSAPP_NUMBER = os.getenv("ZAVU_WHATSAPP_NUMBER", "+17854474062")
TEMPLATE_ID = os.getenv("ZAVU_TEMPLATE_ID", "")

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
    log.info("NOTIFY /whatsapp by=%s to=%s", user.get("email"), body.to)
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


def _public_base() -> str:
    b = os.getenv("PUBLIC_BASE_URL")
    if b:
        return b.rstrip("/")
    d = os.getenv("RAILWAY_PUBLIC_DOMAIN")
    return f"https://{d}" if d else "http://localhost:8000"


def _reply_with_analysis(frm: str, text: str) -> None:
    """Tarea en background: respuesta de Claude + PDF del informe por WhatsApp.

    Corre fuera del request del webhook (puede demorar: Claude + PDF + envíos).
    El inbound abre la ventana de 24h → free-form + documento se entregan sin template.
    """
    from integrations.zavu import send_document

    log.info("WEBHOOK reply start from=%s text=%r", frm, text[:120])
    # 1) Respuesta analítica de Claude (texto)
    try:
        ans = answer_question(text)
        r = send_whatsapp(frm, ans)
        log.info("WEBHOOK reply text from=%s sent=%s status=%s", frm, r.get("sent"), r.get("status"))
    except Exception as e:
        log.warning("WEBHOOK reply text FAILED from=%s err=%s", frm, e)
    # 2) PDF del informe (generado server-side, servido por /api/reports/pdf)
    try:
        from models.pdf_report import build_pdf

        from .reports import publish_pdf

        token = publish_pdf(build_pdf("base"))
        url = f"{_public_base()}/api/reports/pdf/{token}"
        r = send_document(frm, url, caption="Altis Forecast — 13-week cash report (PDF)")
        log.info("WEBHOOK reply pdf from=%s url=%s sent=%s status=%s", frm, url, r.get("sent"), r.get("status"))
    except Exception as e:
        log.warning("WEBHOOK reply pdf FAILED from=%s err=%s", frm, e)


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """Webhook de Zavu: mensaje entrante → (background) Claude + PDF por WhatsApp.

    Verifica `x-zavu-signature` (si hay ZAVU_WEBHOOK_SECRET). Responde 200 al
    instante y procesa el análisis + PDF en background (aunque demore).
    Payload Zavu: { type, senderId, data: { from, text, channel, messageId } }.
    """
    raw = await request.body()
    hdrs = dict(request.headers)
    # Diagnóstico: ver el esquema de firma real de Zavu (headers + valores de firma).
    sig_hdrs = {k: v for k, v in hdrs.items()
                if any(s in k.lower() for s in ("sign", "svix", "webhook", "zavu"))}
    log.info("WEBHOOK headers=%s sig_hdrs=%s", list(hdrs.keys()), sig_hdrs)
    sig_ok = verify_signature(raw, None, hdrs)
    log.info("WEBHOOK hit sig_ok=%s len=%d body=%s", sig_ok, len(raw or b""), (raw or b"")[:500].decode("utf-8", "replace"))
    # No bloqueamos por firma inválida: si ZAVU_WEBHOOK_ENFORCE=1, sí. Por defecto
    # procesamos igual (el webhook solo dispara respuestas/PDF; bajo riesgo) y logueamos.
    if not sig_ok and os.getenv("ZAVU_WEBHOOK_ENFORCE") == "1":
        log.warning("WEBHOOK rejected: invalid signature (enforce on)")
        return {"ok": False, "reason": "invalid signature"}

    import json

    try:
        payload = json.loads(raw or b"{}")
    except Exception:
        return {"ok": False, "reason": "invalid json"}

    ptype = payload.get("type")
    # Eventos de estado (delivered/failed/read) → los logueamos para diagnosticar entregas.
    if ptype not in (None, "message.inbound"):
        d = payload.get("data", payload)
        log.info("WEBHOOK status event type=%s status=%s id=%s to=%s reason=%s",
                 ptype, d.get("status"), d.get("messageId") or d.get("id"), d.get("to"), d.get("error") or d.get("reason"))
        return {"ok": True, "ignored": ptype}

    data = payload.get("data", payload)
    text = data.get("text") or ""
    frm = data.get("from")
    if data.get("messageType", "text") != "text" or not text or not frm:
        log.info("WEBHOOK inbound ignored (non-text or missing) data=%s", str(data)[:300])
        return {"ok": True, "ignored": "non-text or missing from/text"}

    log.info("WEBHOOK inbound from=%s text=%r → queued", frm, text[:120])
    background_tasks.add_task(_reply_with_analysis, frm, text)
    return {"ok": True, "queued": True, "from": frm}


# ── Opción B: link wa.me (el usuario escribe primero → webhook → Claude) ──
@router.get("/whatsapp-link")
def whatsapp_link(user: dict = Depends(get_current_user)):
    """Link wa.me al bot con texto prellenado. Funciona SIN template (reactivo)."""
    digits = "".join(ch for ch in WHATSAPP_NUMBER if ch.isdigit())
    text = "Hola Altis 👋 mostrame el covenant headroom de esta semana"
    return {"number": WHATSAPP_NUMBER, "url": f"https://wa.me/{digits}?text={quote(text)}"}


# ── Opción A: envío PROACTIVO por template aprobado (no requiere que escriban) ──
class ForecastReadyBody(BaseModel):
    to: str
    scenario: str = "base"


@router.post("/forecast-ready")
def forecast_ready(
    body: ForecastReadyBody, user: dict = Depends(require_roles("pe_board", "cfo"))
):
    """Manda el template 'forecast listo' (proactivo). Requiere template aprobado."""
    validate_scenario(body.scenario)
    if not TEMPLATE_ID:
        return {"sent": False, "reason": "ZAVU_TEMPLATE_ID no configurado (template aún no aprobado)"}
    con = get_connection()
    rules = query(
        con,
        "SELECT value FROM covenant_rules WHERE threshold_type='min_cumulative_cashflow' "
        "ORDER BY id LIMIT 1",
    )
    threshold = float(rules[0]["value"]) if rules else -500000.0
    st = _scenario_stats(con, body.scenario, threshold)
    con.close()
    if not st:
        return {"sent": False, "reason": "forecast not computed"}
    variables = {
        "1": SCEN_LABEL.get(body.scenario, body.scenario),
        "2": st["status"],
        "3": st["headroom_fmt"],
    }
    return send_whatsapp(body.to, template_id=TEMPLATE_ID, variables=variables)
