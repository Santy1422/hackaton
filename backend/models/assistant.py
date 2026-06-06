"""Asistente de WhatsApp: responde preguntas sobre el forecast con Claude.

El contexto numérico se arma desde la DB (Postgres) y se le pasa a Claude;
el modelo solo redacta la respuesta — nunca inventa cifras. Sin ANTHROPIC_API_KEY
cae a una respuesta determinista corta.
"""

from __future__ import annotations

import json
import os

from db.database import get_connection, query

MODEL = "claude-sonnet-4-6"
SCENARIOS = ("base", "wet_qtr", "dry_qtr")
SCEN_LABEL = {"base": "Base", "wet_qtr": "Wet quarter", "dry_qtr": "Dry quarter"}

SYSTEM = """You are the Altis Forecast assistant, replying over WhatsApp to a CFO/PE \
board member about a 13-week cash-flow forecast (PE-backed Dutch roofing portfolio).

Rules:
- You are given the real figures as JSON. Use ONLY those numbers, verbatim. NEVER invent or recompute.
- Answer in 1-4 short sentences, WhatsApp tone — concise, no markdown headers, at most light *bold*.
- If asked something the data doesn't cover, say so briefly.
- Covenant floor is the threshold; status SAFE/WATCH/BREACH reflects worst-case headroom."""


def _eur(n) -> str:
    v = round(float(n or 0))
    return f"-€{abs(v):,.0f}" if v < 0 else f"€{v:,.0f}"


def gather_context(con=None) -> dict:
    """Resumen numérico del forecast desde la DB para alimentar a Claude."""
    own = con is None
    con = con or get_connection()
    try:
        rules = query(
            con,
            "SELECT value FROM covenant_rules WHERE threshold_type='min_cumulative_cashflow' "
            "ORDER BY id LIMIT 1",
        )
        threshold = float(rules[0]["value"]) if rules else -500000.0
        scen = {}
        for s in SCENARIOS:
            rows = query(
                con,
                "SELECT forecast_week, SUM(net_cashflow) AS net FROM forecast_13w "
                "WHERE scenario = ? GROUP BY forecast_week ORDER BY forecast_week",
                [s],
            )
            if not rows:
                continue
            cum = 0.0
            mn, mw = None, None
            total = 0.0
            for r in rows:
                total += float(r["net"] or 0)
                cum += float(r["net"] or 0)
                if mn is None or cum < mn:
                    mn, mw = cum, r["forecast_week"]
            status = "BREACH" if mn < threshold else "WATCH" if mn < threshold + 200000 else "SAFE"
            scen[s] = {
                "label": SCEN_LABEL[s],
                "status": status,
                "headroom": _eur(mn - threshold),
                "low_point": _eur(mn),
                "low_week": mw,
                "net_13w": _eur(total),
                "ending_cash": _eur(cum),
            }
        return {"covenant_threshold": _eur(threshold), "scenarios": scen}
    finally:
        if own:
            con.close()


def answer_question(question: str, con=None) -> str:
    """Responde una pregunta de WhatsApp sobre el forecast (Claude o fallback)."""
    ctx = gather_context(con)
    if not ctx.get("scenarios"):
        return "El forecast aún no fue computado. Corré `python run.py model` primero."

    if not os.getenv("ANTHROPIC_API_KEY"):
        return _fallback(question, ctx)
    try:
        import anthropic

        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[
                {
                    "role": "user",
                    "content": f"Forecast data (use verbatim):\n{json.dumps(ctx, ensure_ascii=False)}\n\nQuestion: {question}",
                }
            ],
        )
        return next((b.text for b in resp.content if b.type == "text"), "").strip() or _fallback(question, ctx)
    except Exception:
        return _fallback(question, ctx)


def _fallback(question: str, ctx: dict) -> str:
    b = ctx["scenarios"].get("base", {})
    return (
        f"Base scenario: {b.get('headroom','—')} headroom — status {b.get('status','—')}. "
        f"Cash dips to {b.get('low_point','—')} in week {b.get('low_week','—')}. "
        f"(ask about base / wet_qtr / dry_qtr)"
    )


def weekly_digest_text(con=None) -> str:
    """Texto del digest semanal (lunes)."""
    ctx = gather_context(con)
    s = ctx.get("scenarios", {})
    if not s:
        return "Altis Forecast: el forecast aún no fue computado."
    lines = ["📊 *Altis Forecast — Weekly digest*"]
    for k in SCENARIOS:
        v = s.get(k)
        if v:
            lines.append(f"{v['label']}: {v['status']} · headroom {v['headroom']} (low {v['low_point']} wk {v['low_week']})")
    lines.append(f"Covenant floor: {ctx['covenant_threshold']}.")
    return "\n".join(lines)
