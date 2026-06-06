"""Zavu — envío de WhatsApp (REST). https://docs.zavu.dev

Auth: header `Authorization: Bearer <ZAVU_API_KEY>`.
Sender (perfil del remitente): header `Zavu-Sender: <senderId>`.
Body: { to, channel:"whatsapp", messageType:"text"|"template", text|content }.

Si falta ZAVU_API_KEY hace un "dry-run" (no rompe): devuelve el preview.
"""

from __future__ import annotations

import os

import httpx

ZAVU_URL = "https://api.zavu.dev/v1/messages"
# Sender ID por defecto (perfil "Decilo App"); overridable por env.
DEFAULT_SENDER = "kd7fv57av8kwqgncjzckcrnnn9885nv4"


def send_whatsapp(
    to: str,
    text: str | None = None,
    *,
    template_id: str | None = None,
    variables: dict | None = None,
) -> dict:
    """Envía un WhatsApp por Zavu. Devuelve {sent, id?, status?, reason?}."""
    api_key = os.getenv("ZAVU_API_KEY")
    sender = os.getenv("ZAVU_SENDER", DEFAULT_SENDER)

    body: dict = {"to": to, "channel": "whatsapp"}
    if template_id:
        body["messageType"] = "template"
        body["content"] = {"templateId": template_id, "templateVariables": variables or {}}
    else:
        body["messageType"] = "text"
        body["text"] = text or ""

    if not api_key:
        # Dry-run: sin credencial no llamamos a Zavu, pero no rompemos el flujo.
        return {"sent": False, "reason": "missing ZAVU_API_KEY (dry-run)", "to": to, "preview": body}

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if sender:
        headers["Zavu-Sender"] = sender
    try:
        resp = httpx.post(ZAVU_URL, headers=headers, json=body, timeout=15)
        resp.raise_for_status()
        msg = resp.json().get("message", {})
        return {"sent": True, "id": msg.get("id"), "status": msg.get("status"), "to": to}
    except Exception as e:
        return {"sent": False, "reason": str(e), "to": to}
