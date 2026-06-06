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
import logging
import os

import httpx

ZAVU_URL = "https://api.zavu.dev/v1/messages"

log = logging.getLogger("zavu")


def verify_signature(raw_body: bytes, signature: str | None, headers: dict | None = None) -> bool:
    """Verifica la firma del webhook de Zavu (mismo esquema que FacturaHub, probado).

    Sin ZAVU_WEBHOOK_SECRET → no verifica (dev → True). Zavu firma estilo Stripe:
    header `x-zavu-signature: t=<timestamp>,v1=<hex>`, donde
    `v1 = HMAC_SHA256(secret, "<t>.<body>")` en hex (secret tal cual). Probamos las
    variantes de payload conocidas (`t.body`, `body`, `t:body`) y, por robustez,
    también el secret base64-decodificado si viene como `whsec_…`.
    """
    secret = os.getenv("ZAVU_WEBHOOK_SECRET")
    if not secret:
        return True
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    if not signature:
        signature = (
            headers.get("x-zavu-signature")
            or headers.get("x-webhook-signature")
            or headers.get("webhook-signature")
            or headers.get("x-signature")
        )
    if not signature:
        log.warning("verify_signature: no signature header (have: %s)", list(headers.keys()))
        return False

    # Parse "t=<ts>,v1=<hex>" → {t, v1}. (split por coma, luego por el primer '=').
    parts: dict[str, str] = {}
    for p in signature.split(","):
        eq = p.find("=")
        if eq > 0:
            parts[p[:eq].strip()] = p[eq + 1:].strip()
    t = parts.get("t", "")
    v1 = parts.get("v1") or parts.get("v0") or (signature.strip() if "=" not in signature else "")
    if not v1:
        log.warning("verify_signature: no v1 in signature %r", signature[:40])
        return False

    body = raw_body.decode("utf-8", "replace") if isinstance(raw_body, (bytes, bytearray)) else str(raw_body)
    payloads = [f"{t}.{body}", body, f"{t}:{body}"]

    keys = [secret.encode()]
    if secret.startswith("whsec_"):
        try:
            keys.append(base64.b64decode(secret[len("whsec_"):]))
        except Exception:
            pass

    for k in keys:
        for payload in payloads:
            expected = hmac.new(k, payload.encode(), hashlib.sha256).hexdigest()
            if len(expected) == len(v1) and hmac.compare_digest(expected, v1):
                return True
    log.warning("verify_signature: MISMATCH t=%s v1=%s… body_len=%d", t, v1[:12], len(body))
    return False
# Sender ID por defecto (overridable por env ZAVU_SENDER).
DEFAULT_SENDER = "kd7fv57av8kwqgncjzckcrnnn9885nv4"


def normalize_to(num: str) -> str:
    """Normaliza un destino a E.164 limpio. Arregla el trunk-0 holandés
    (`+3106…` → `+316…`), que WhatsApp rechaza."""
    n = "+" + "".join(c for c in (num or "") if c.isdigit())
    if n.startswith("+310") and len(n) > 4:  # NL: sin el 0 nacional tras +31
        n = "+31" + n[4:]
    return n


def send_whatsapp(
    to: str,
    text: str | None = None,
    *,
    template_id: str | None = None,
    variables: dict | None = None,
) -> dict:
    """Envía un WhatsApp por Zavu. Devuelve {sent, id?, status?, reason?}."""
    api_key = os.getenv("ZAVU_API_KEY")
    to = normalize_to(to)

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
    to = normalize_to(to)
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
    log.info("ZAVU → POST to=%s type=%s sender=%s tmpl=%s",
             to, body.get("messageType"), sender, body.get("content", {}).get("templateId"))
    try:
        resp = httpx.post(ZAVU_URL, headers=headers, json=body, timeout=20)
        if resp.status_code >= 400:
            log.warning("ZAVU ✗ to=%s http=%s body=%s", to, resp.status_code, resp.text[:600])
            resp.raise_for_status()
        data = resp.json()
        msg = data.get("message", {})
        log.info("ZAVU ✓ to=%s id=%s status=%s resp=%s",
                 to, msg.get("id"), msg.get("status"), str(data)[:400])
        return {"sent": True, "id": msg.get("id"), "status": msg.get("status"), "to": to}
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:600] if e.response is not None else str(e)
        log.warning("ZAVU ✗ to=%s HTTPStatusError %s", to, detail)
        return {"sent": False, "reason": detail, "to": to}
    except Exception as e:
        log.warning("ZAVU ✗ to=%s error=%s", to, e)
        return {"sent": False, "reason": str(e), "to": to}
