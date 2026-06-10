"""Ollama client + Postgres context builder for Altis Groep financial Q&A."""

from __future__ import annotations

import httpx

from db.database import get_connection, query

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"

SYSTEM_PROMPT = """\
You are a financial analyst assistant for Altis Groep, a private-equity-backed \
roofing portfolio company in the Netherlands.

You have access to live data from the Altis Postgres database:
- 13-week cash flow forecast (scenarios: base / wet_qtr / dry_qtr)
- Netherlands weather forecast (rain, frost, wind — all stop roofing work)
- Transaction actuals from 4 accounting systems (Opco_A, Opco_B, Opco_C, Opco_D)
- Bank covenant headroom vs minimum cumulative cash flow threshold

Cash flow drivers in the model:
  D1 Milestone billing  — invoices tied to project completion stages
  D2 Materials outflow  — supplies ordered ahead of execution
  D3 Subcontractor pay  — tied to project progress
  D4 Customer collection — invoice-to-cash lag per customer segment
  D5 Weather impact     — rain/frost/wind → work stops → deferred billing

Weather thresholds that stop roofing work:
  Rain > 15 mm/day | Frost < 0 °C | Wind > Bft 6 | Heat > 28 °C

Key empirical finding: weather (r=0.12) explains only 1.4% of billing variance. \
The main revenue driver is project-pipeline concentration in large one-off contracts.

Answer concisely with specific numbers from the context. \
If the data does not cover the question, say so clearly.\
"""


def _fmt(val, prefix: str = "€") -> str:
    return f"{prefix}{float(val or 0):,.0f}"


def _build_context(scenario: str = "base", opco: str | None = None) -> str:
    con = get_connection()
    parts: list[str] = []
    try:
        # --- 13-week forecast ---
        rows = query(
            con,
            "SELECT forecast_week, week_start, "
            "SUM(net_cashflow) AS net, SUM(gross_inflow) AS inflow, "
            "SUM(gross_outflow) AS outflow, SUM(d1_milestone_billing) AS d1, "
            "SUM(d2_materials_outflow) AS d2, SUM(d3_subcon_payment) AS d3, "
            "SUM(d4_customer_collection) AS d4, SUM(d5_weather_impact) AS d5 "
            "FROM forecast_13w WHERE scenario = ? "
            + ("AND opco = ? " if opco else "")
            + "GROUP BY forecast_week, week_start ORDER BY forecast_week",
            [scenario, opco] if opco else [scenario],
        )
        if rows:
            scope = f"scenario={scenario}" + (f", opco={opco}" if opco else "")
            parts.append(f"## 13-Week Cash Flow Forecast ({scope})")
            cum = 0.0
            for r in rows:
                cum += float(r["net"] or 0)
                parts.append(
                    f"  Wk{r['forecast_week']} {r['week_start']}: "
                    f"net {_fmt(r['net'])}  "
                    f"[in {_fmt(r['inflow'])} | out {_fmt(r['outflow'])}]  "
                    f"d1={_fmt(r['d1'])} d2={_fmt(r['d2'])} "
                    f"d3={_fmt(r['d3'])} d4={_fmt(r['d4'])} "
                    f"d5_weather={_fmt(r['d5'])}  cum {_fmt(cum)}"
                )

        # --- Weather forecast ---
        weather = query(
            con,
            "SELECT iso_week, week_start, temp_avg, rain_mm, frost_days, "
            "wind_bft, risk_level, delay_days "
            "FROM weather_forecast ORDER BY iso_week LIMIT 13",
        )
        if weather:
            parts.append("\n## Netherlands Weather Forecast")
            for w in weather:
                parts.append(
                    f"  iso_week={w['iso_week']} {w.get('week_start', '')}: "
                    f"temp {w.get('temp_avg', '?')}°C  "
                    f"rain {w.get('rain_mm', '?')} mm  "
                    f"frost {w.get('frost_days', 0)} days  "
                    f"wind Bft {w.get('wind_bft', '?')}  "
                    f"risk={w.get('risk_level', '?')}  "
                    f"delay={w.get('delay_days', 0)} days"
                )
        else:
            parts.append("\n## Weather\n  (no rows in DB — fetch via GET /api/weather)")

        # --- Bank covenant ---
        rules = query(
            con,
            "SELECT value, horizon_weeks FROM covenant_rules "
            "WHERE threshold_type = 'min_cumulative_cashflow' ORDER BY id LIMIT 1",
        )
        threshold = float(rules[0]["value"]) if rules else -500_000.0
        horizon = int(rules[0]["horizon_weeks"]) if rules else 13

        cf = query(
            con,
            "SELECT SUM(net_cashflow) AS total FROM forecast_13w WHERE scenario = ?",
            [scenario],
        )
        total_cf = float((cf[0]["total"] or 0) if cf else 0)
        headroom = total_cf - threshold
        status = "BREACH" if total_cf < threshold else (
            "WATCH" if headroom < abs(threshold) * 0.2 else "SAFE"
        )
        parts.append(
            f"\n## Bank Covenant ({scenario})\n"
            f"  Threshold: cumulative CF ≥ {_fmt(threshold)} over {horizon} weeks\n"
            f"  Forecast cumulative CF: {_fmt(total_cf)}\n"
            f"  Headroom: {_fmt(headroom)}  |  Status: {status}"
        )

        # --- Scenario comparison ---
        sc_lines = []
        for sc in ("base", "wet_qtr", "dry_qtr"):
            r = query(
                con,
                "SELECT SUM(net_cashflow) AS total FROM forecast_13w WHERE scenario = ?",
                [sc],
            )
            total = float((r[0]["total"] or 0) if r else 0)
            sc_lines.append(f"  {sc}: cumulative CF {_fmt(total)}")
        parts.append("\n## Scenario Comparison\n" + "\n".join(sc_lines))

        # --- Actuals by opco and year ---
        actuals = query(
            con,
            "SELECT opco, year, SUM(credit) AS revenue, COUNT(*) AS txns "
            "FROM transactions WHERE credit > 0 AND year >= 2023 "
            "GROUP BY opco, year ORDER BY opco, year",
        )
        if actuals:
            parts.append("\n## Historical Revenue by Opco")
            for a in actuals:
                parts.append(
                    f"  {a['opco']} {a['year']}: "
                    f"revenue {_fmt(a['revenue'])}  ({a['txns']} transactions)"
                )

    except Exception as exc:
        parts.append(f"\n[context error: {exc}]")
    finally:
        con.close()

    return "\n".join(parts) if parts else "No data available in the database yet."


def chat(
    question: str,
    scenario: str = "base",
    opco: str | None = None,
    model: str = DEFAULT_MODEL,
) -> str:
    """Query local Ollama model with live DB context. Returns answer string."""
    context = _build_context(scenario=scenario, opco=opco)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Current Altis database context:\n\n{context}"
                f"\n\n---\nQuestion: {question}"
            ),
        },
    ]
    try:
        resp = httpx.post(
            f"{OLLAMA_URL}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=90,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]
    except httpx.ConnectError:
        raise RuntimeError(
            "Ollama is not running. Start it with: ollama serve "
            "(pull a model first: ollama pull llama3.2)"
        )
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"Ollama error {e.response.status_code}: {e.response.text}")


def list_ollama_models() -> list[str]:
    """Return names of locally available Ollama models."""
    try:
        resp = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        return [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        return []
