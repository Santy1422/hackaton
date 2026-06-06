"""Genera el informe de cash-flow en PDF (server-side) para mandar por WhatsApp.

Usa fpdf2 (puro Python, sin deps de sistema). Los números salen de la DB; el
análisis lo redacta Claude (report_narrative) — nunca inventa cifras. Las fuentes
core de fpdf son latin-1, así que el símbolo € se escribe como "EUR".
"""

from __future__ import annotations

from datetime import datetime, timezone

from db.database import get_connection
from models.assistant import SCEN_LABEL, SCENARIOS, gather_context
from models.report_narrative import generate_narrative


def _ascii(s) -> str:
    return (str(s or "")
            .replace("€", "EUR ").replace("–", "-").replace("—", "-")
            .replace("’", "'").replace("“", '"').replace("”", '"')
            .encode("latin-1", "ignore").decode("latin-1"))


def build_pdf(scenario: str = "base", con=None) -> bytes:
    from fpdf import FPDF

    own = con is None
    con = con or get_connection()
    try:
        ctx = gather_context(con)
        scen = ctx.get("scenarios", {})
    finally:
        if own:
            con.close()

    cur = scen.get(scenario, {})
    narrative = generate_narrative({
        "kind": "weekly", "scenario": scenario,
        "scenario_label": SCEN_LABEL.get(scenario, scenario),
        "covenant_threshold_fmt": ctx.get("covenant_threshold"),
        "active": {
            "status": cur.get("status"),
            "headroom_fmt": cur.get("headroom"),
            "low_point_fmt": cur.get("low_point"),
            "low_week": cur.get("low_week"),
            "total_net_cashflow_fmt": cur.get("net_13w"),
            "ending_cash_fmt": cur.get("ending_cash"),
        },
        "all_scenarios": {k: {"status": v.get("status"), "headroom_fmt": v.get("headroom")}
                          for k, v in scen.items()},
    })

    INK = (28, 37, 48)
    pdf = FPDF(format="A4")
    pdf.set_margins(14, 14, 14)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # Cabecera
    pdf.set_fill_color(*INK)
    pdf.rect(0, 0, 210, 26, "F")
    pdf.set_xy(14, 7)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "Altis Forecast - 13-week Cash Report", ln=1)
    pdf.set_x(14)
    pdf.set_font("Helvetica", "", 9)
    gen = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    pdf.cell(0, 5, _ascii(f"{SCEN_LABEL.get(scenario, scenario)} scenario  -  generated {gen}"), ln=1)

    pdf.set_text_color(*INK)
    pdf.ln(12)

    def h2(t):
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*INK)
        pdf.cell(0, 8, _ascii(t), ln=1)
        pdf.set_draw_color(*INK)
        y = pdf.get_y()
        pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
        pdf.ln(3)

    def para(t):
        if not t:
            return
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "", 10.5)
        pdf.set_text_color(40, 50, 60)
        pdf.multi_cell(pdf.epw, 5.5, _ascii(t))
        pdf.ln(2)

    h2("Executive summary")
    para(narrative.get("executive_summary", ""))

    h2("Covenant headroom")
    para(narrative.get("covenant_commentary", ""))
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(244, 241, 234)
    for w, lab in ((30, "Scenario"), (28, "Status"), (45, "Headroom"), (45, "Low point"), (32, "Low week")):
        pdf.cell(w, 7, lab, border=0, fill=True)
    pdf.ln(7)
    pdf.set_font("Helvetica", "", 9)
    for k in SCENARIOS:
        v = scen.get(k)
        if not v:
            continue
        pdf.cell(30, 7, _ascii(v["label"]))
        pdf.cell(28, 7, _ascii(v["status"]))
        pdf.cell(45, 7, _ascii(v["headroom"]))
        pdf.cell(45, 7, _ascii(v["low_point"]))
        pdf.cell(32, 7, _ascii("W" + str(v["low_week"])))
        pdf.ln(7)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, _ascii(f"Covenant floor: {ctx.get('covenant_threshold')}"), ln=1)
    pdf.ln(2)

    h2("Scenario read")
    para(narrative.get("scenario_commentary", ""))

    risks = narrative.get("risks") or []
    if risks:
        h2("Risks & recommendation")
        pdf.set_font("Helvetica", "", 10.5)
        pdf.set_text_color(40, 50, 60)
        for r in risks:
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(pdf.epw, 5.5, _ascii("- " + r))
        if narrative.get("recommendation"):
            pdf.ln(1)
            pdf.set_font("Helvetica", "B", 10.5)
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(pdf.epw, 5.5, _ascii("Recommendation: " + narrative["recommendation"]))

    pdf.ln(4)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(150, 150, 150)
    src = narrative.get("source", "")
    tag = "narrated by Claude" if src and not src.startswith("fallback") else "deterministic narrative"
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 4, _ascii(
        f"Methodology: drivers M1-M5 (milestone billing, materials, subcontractors, "
        f"collections, weather), reconciled from 4 accounting systems into forecast_13w. "
        f"Figures from the database; {tag}. Anonymised demo data."
    ))

    out = pdf.output()
    return bytes(out)
