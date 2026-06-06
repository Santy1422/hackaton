"""MCP server de Altis Forecast — expone los datos + el envío Zavu como tools.

Conecta a Claude (Claude Desktop, o `mcp_servers` de la API) con el forecast real
(Postgres) y con WhatsApp (Zavu), todo desde la misma app/integraciones.

Run (stdio):  python mcp_server.py
Config Claude Desktop:
  { "mcpServers": { "altis": { "command": "python", "args": ["mcp_server.py"] } } }
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from integrations.zavu import send_whatsapp as _send_whatsapp
from models.assistant import answer_question, gather_context, weekly_digest_text

mcp = FastMCP("altis-forecast")


@mcp.tool()
def get_covenant() -> dict:
    """Covenant status + headroom de los 3 escenarios (base/wet_qtr/dry_qtr), desde la DB."""
    return gather_context()


@mcp.tool()
def get_weekly_digest() -> str:
    """Texto del digest semanal del forecast (status + headroom por escenario)."""
    return weekly_digest_text()


@mcp.tool()
def ask_forecast(question: str) -> str:
    """Responde una pregunta en lenguaje natural sobre el forecast de 13 semanas."""
    return answer_question(question)


@mcp.tool()
def send_whatsapp(to: str, text: str) -> dict:
    """Envía un mensaje de WhatsApp por Zavu. `to` en formato E.164 (+...)."""
    return _send_whatsapp(to, text)


@mcp.tool()
def send_covenant_alert(to: str, scenario: str = "base") -> dict:
    """Arma la alerta de covenant de un escenario y la manda por WhatsApp."""
    ctx = gather_context().get("scenarios", {})
    v = ctx.get(scenario)
    if not v:
        return {"sent": False, "reason": f"unknown scenario {scenario}"}
    text = (
        f"*Altis Covenant — {v['label']}*\nStatus: {v['status']}\n"
        f"Headroom: {v['headroom']} · low {v['low_point']} wk {v['low_week']}"
    )
    return _send_whatsapp(to, text)


if __name__ == "__main__":
    mcp.run()
