"""Zavu — envío de WhatsApp (REST). https://docs.zavu.dev

Auth: header `Authorization: Bearer <ZAVU_API_KEY>`.
Sender (perfil del remitente): header `Zavu-Sender: <senderId>`.
Body: { to, channel:"whatsapp", messageType:"text"|"template", text|content }.

Si falta ZAVU_API_KEY hace un "dry-run" (no rompe): devuelve el preview.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

import httpx

ZAVU_URL = "https://api.zavu.dev/v1/messages"


def verify_signature(raw_body: bytes, signature: str | None, headers: dict | None = None) -> bool:
    """Verifica el header `x-zavu-signature`. Robusto a varios esquemas.

    Sin ZAVU_WEBHOOK_SECRET → no verifica (dev → True). Con secret, acepta si
    el HMAC-SHA256 coincide bajo cualquiera de estas combinaciones:
      - clave: secret tal cual · (si `whsec_…`) base64-decode del resto · resto en texto
      - mensaje: body crudo · estilo Svix `{id}.{ts}.{body}` · `{ts}.{body}`
      - encoding: hex · base64
    Cubre tanto HMAC plano como el esquema Svix (prefijo `whsec_`).
    """
    secret = os.getenv("ZAVU_WEBHOOK_SECRET")
    if not secret:
        return True
    if not signature:
        return False
    headers = {k.lower(): v for k, v in (headers or {}).items()}

    # tokens de firma (Svix: "v1,<b64> v1,<b64>"; o "sha256=<hex>"; o plano).
    # No partir por "=" a lo bruto: el padding base64 lleva "=".
    tokens = {signature.strip()}
    for item in signature.strip().split():
        it = item.strip()
        if "," in it:  # estilo Svix "v1,<sig>"
            tokens.add(it.split(",", 1)[1])
        elif it.startswith(("sha256=", "sha1=")):
            tokens.add(it.split("=", 1)[1])
        else:
            tokens.add(it)

    keys = [secret.encode()]
    if secret.startswith("whsec_"):
        rest = secret[len("whsec_"):]
        keys.append(rest.encode())
        try:
            keys.append(base64.b64decode(rest))
        except Exception:
            pass

    wid = headers.get("webhook-id") or headers.get("x-zavu-id") or headers.get("zavu-id")
    wts = (headers.get("webhook-timestamp") or headers.get("x-zavu-timestamp")
           or headers.get("zavu-timestamp"))
    msgs = [raw_body]
    if wid and wts:
        msgs.append(f"{wid}.{wts}.".encode() + raw_body)
    if wts:
        msgs.append(f"{wts}.".encode() + raw_body)

    for k in keys:
        for m in msgs:
            mac = hmac.new(k, m, hashlib.sha256).digest()
            for cand in (mac.hex(), base64.b64encode(mac).decode()):
                for t in tokens:
                    if hmac.compare_digest(cand, t.strip()):
                        return True
    return False
# Sender ID por defecto (overridable por env ZAVU_SENDER).
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

    return _post(body, to)


def send_document(to: str, media_url: str, caption: str | None = None) -> dict:
    """Envía un PDF/documento por WhatsApp (Zavu messageType=document)."""
    body = {
        "to": to,
        "channel": "whatsapp",
        "messageType": "document",
        "content": {"mediaUrl": media_url},
    }
    if caption:
        body["text"] = caption
    if not os.getenv("ZAVU_API_KEY"):
        return {"sent": False, "reason": "missing ZAVU_API_KEY (dry-run)", "to": to, "preview": body}
    return _post(body, to)


def _post(body: dict, to: str) -> dict:
    api_key = os.getenv("ZAVU_API_KEY")
    sender = os.getenv("ZAVU_SENDER", DEFAULT_SENDER)
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
