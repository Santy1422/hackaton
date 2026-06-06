"""Genera la PROSA de los informes con Claude Sonnet — nunca los números.

Principio: los números reales se calculan del forecast y se pasan al modelo;
Claude solo redacta el texto explicativo alrededor de esas cifras. Si falta
ANTHROPIC_API_KEY (o el SDK/llamada falla), se usa una narrativa determinista.
"""

from __future__ import annotations

import json
import os

MODEL = "claude-sonnet-4-6"  # el usuario pidió Sonnet

# Sistema estable (se cachea con prompt caching). NO contiene datos volátiles.
SYSTEM_PROMPT = """You are a treasury analyst writing the narrative sections of a \
13-week cash-flow report for Altis Groep, a PE-backed Dutch roofing portfolio (4 opcos).

Hard rules:
- You are given the real figures as JSON. Use ONLY those figures.
- NEVER invent, compute, round differently, or alter any number. Quote the \
provided values verbatim (they are already formatted).
- Be concise, board-ready, and defensible to a bank. No hype, no emoji.
- Roofing cash dynamics: firms pay materials and subcontractors AHEAD of \
collecting on milestones, so cash dips into a financed trough mid-horizon, then \
recovers. Weather changes the TIMING of billing/collections, not committed outflows.

Return ONLY a JSON object with these string fields (no markdown, no extra keys):
- executive_summary: 2-4 sentences on the 13-week cash position and what drives it.
- covenant_commentary: 2-3 sentences on covenant headroom and status, bank-facing.
- scenario_commentary: 2-3 sentences comparing base / wet_qtr / dry_qtr.
- risks: array of 2-4 short risk bullets (strings).
- recommendation: 1-2 sentences, an actionable next step for the CFO/board."""

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "executive_summary": {"type": "string"},
        "covenant_commentary": {"type": "string"},
        "scenario_commentary": {"type": "string"},
        "risks": {"type": "array", "items": {"type": "string"}},
        "recommendation": {"type": "string"},
    },
    "required": [
        "executive_summary",
        "covenant_commentary",
        "scenario_commentary",
        "risks",
        "recommendation",
    ],
}


def generate_narrative(payload: dict) -> dict:
    """Devuelve las secciones de prosa. Usa Claude si hay API key; si no, fallback."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return _fallback(payload, source="fallback:no-api-key")
    try:
        return _claude(payload)
    except Exception as e:  # SDK ausente, red caída, etc. → narrativa determinista
        return _fallback(payload, source=f"fallback:{type(e).__name__}")


def _claude(payload: dict) -> dict:
    import anthropic

    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1200,
        # Prompt caching: el system es estable → se cachea; los datos van en el user turn.
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
        messages=[
            {
                "role": "user",
                "content": (
                    f"Report type: {payload.get('kind')} · active scenario: "
                    f"{payload.get('scenario')}.\nReal figures (use verbatim):\n"
                    + json.dumps(payload, ensure_ascii=False, indent=2)
                ),
            }
        ],
    )
    text = next((b.text for b in resp.content if b.type == "text"), "{}")
    data = json.loads(text)
    data["source"] = MODEL
    return data


def _fallback(payload: dict, source: str) -> dict:
    """Narrativa determinista sobre los mismos números (sin LLM)."""
    s = payload.get("scenario", "base")
    act = payload.get("active", {})
    status = act.get("status", "—")
    net = act.get("total_net_cashflow_fmt", "—")
    ending = act.get("ending_cash_fmt", "—")
    low_fmt = act.get("low_point_fmt", "—")
    low_wk = act.get("low_week", "—")
    headroom = act.get("headroom_fmt", "—")
    alls = payload.get("all_scenarios", {})

    return {
        "executive_summary": (
            f"Over the next 13 weeks the portfolio is projected to net {net} of cash, "
            f"ending at {ending}. Because materials and subcontractors are paid ahead of "
            f"milestone collections, cash dips to a financed low of {low_fmt} in week {low_wk} "
            f"before collections pull it back."
        ),
        "covenant_commentary": (
            f"Against the −€500k covenant floor, worst-case headroom is {headroom}, giving a "
            f"status of {status} under the {s} scenario."
        ),
        "scenario_commentary": (
            "Weather shifts when the firm bills and collects, not what it has committed to pay: "
            + " · ".join(f"{k}: {v.get('status', '—')}" for k, v in alls.items())
            + "."
        ),
        "risks": [
            "A slipped milestone or a wet fortnight deepens the mid-horizon trough.",
            "Materials/subcontractor outflows are committed ahead of collections.",
            "Collections timing (DSO) is the main lever on covenant headroom.",
        ],
        "recommendation": (
            "Pre-arrange revolver headroom to bridge the week-"
            f"{low_wk} trough and monitor collections weekly against plan."
        ),
        "source": source,
    }
