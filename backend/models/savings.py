"""Estimación de ahorro / ROI por OpCo del sistema de forecasting.

Todo se calcula sobre datos reales (transactions + forecast_13w). Cada eje
declara su fórmula y supuestos — nada se inventa. Los factores económicos
(coste de capital, reducción de buffer, etc.) son supuestos explícitos y
configurables, no números mágicos.

Ejes:
  1. DSO        — llevar cada OpCo al mejor DSO del portfolio libera caja.
  2. Buffer     — mejor forecast ⇒ menor colchón de seguridad inmovilizado.
  3. Weather    — planificar con el clima evita días parados/retrabajo
                  (señal débil: el clima explica ~8% del billing — baja confianza).
  4. ROI total  — beneficio anual combinado.
"""

from __future__ import annotations

import numpy as np

from db.database import query

from .m4_collections import DSO_DAYS

# --- Supuestos económicos (explícitos, no mágicos) ---------------------------
COST_OF_CAPITAL = 0.08          # 8% anual (típico PE) — valor del capital liberado
BUFFER_Z = 1.65                 # colchón al 95% (una cola)
FORECAST_BUFFER_REDUCTION = 0.25  # un buen forecast 13w reduce el buffer ~25%
WEATHER_IDLE_COST = 0.05        # 5% del billing diferido = coste crew idle/retrabajo
WEATHER_SIGNAL = 0.08           # calibración por confianza: R²≈0.08 clima→billing
WEATHER_CONFIDENCE = "low"      # validado empíricamente (2024-2025)

WEEKS_PER_YEAR = 52
HORIZON = 13


def _weekly_net_std(con, opco: str) -> float:
    rows = query(
        con,
        "SELECT net_cashflow AS n FROM forecast_13w "
        "WHERE scenario = 'base' AND opco = ? ORDER BY forecast_week",
        [opco],
    )
    vals = [float(r["n"] or 0) for r in rows]
    return float(np.std(vals)) if len(vals) > 1 else 0.0


def _weather_delay_weeks(con, opco: str) -> float:
    rows = query(
        con,
        "SELECT m5_delay_weeks AS d FROM forecast_13w "
        "WHERE scenario = 'base' AND opco = ?",
        [opco],
    )
    return sum(float(r["d"] or 0) for r in rows)


def compute_savings(con) -> dict:
    """Ahorro anual estimado por OpCo + totales del portfolio."""
    rev_rows = query(
        con,
        "SELECT opco, SUM(credit) AS rev FROM transactions "
        "WHERE year = 2025 AND credit > 0 GROUP BY opco",
    )
    revenue = {r["opco"]: float(r["rev"] or 0) for r in rev_rows}
    if not revenue:
        return {"opcos": [], "portfolio": {}, "assumptions": _assumptions()}

    dso = DSO_DAYS["base"]
    # mejor DSO entre las OpCos que efectivamente tienen ingresos
    active = [o for o in revenue if revenue[o] > 0]
    best_dso = min(dso[o] for o in active)

    opcos = []
    for opco in sorted(revenue):
        rev = revenue[opco]
        daily = rev / 365.0
        weekly = rev / WEEKS_PER_YEAR

        # 1. DSO: caja liberada (one-time) + beneficio anual de financiación
        dso_days_saved = max(0, dso[opco] - best_dso)
        dso_release = dso_days_saved * daily
        dso_annual = dso_release * COST_OF_CAPITAL

        # 2. Buffer: reducción del colchón por mejor forecast
        std = _weekly_net_std(con, opco)
        buffer = BUFFER_Z * std
        buffer_release = buffer * FORECAST_BUFFER_REDUCTION
        buffer_annual = buffer_release * COST_OF_CAPITAL

        # 3. Weather: días parados evitados (anualizado), calibrado por la
        #    confianza empírica del clima sobre el billing (R²≈0.08)
        delay_weeks = _weather_delay_weeks(con, opco)
        weather_13w = delay_weeks * weekly * WEATHER_IDLE_COST * WEATHER_SIGNAL
        weather_annual = weather_13w * (WEEKS_PER_YEAR / HORIZON)

        total_annual = round(dso_annual + buffer_annual + weather_annual, 2)
        opcos.append({
            "opco": opco,
            "revenue_2025": round(rev, 2),
            "dso_days": dso[opco],
            "dso_days_saved": dso_days_saved,
            "dso_cash_released": round(dso_release, 2),
            "dso_annual_saving": round(dso_annual, 2),
            "buffer_cash_released": round(buffer_release, 2),
            "buffer_annual_saving": round(buffer_annual, 2),
            "weather_delay_weeks_13w": round(delay_weeks, 1),
            "weather_annual_saving": round(weather_annual, 2),
            "total_annual_saving": total_annual,
            "saving_pct_of_revenue": round(100 * total_annual / rev, 2) if rev else 0.0,
        })

    portfolio = {
        "revenue_2025": round(sum(o["revenue_2025"] for o in opcos), 2),
        "dso_cash_released": round(sum(o["dso_cash_released"] for o in opcos), 2),
        "buffer_cash_released": round(sum(o["buffer_cash_released"] for o in opcos), 2),
        "total_annual_saving": round(sum(o["total_annual_saving"] for o in opcos), 2),
        "best_dso_days": best_dso,
    }
    portfolio["saving_pct_of_revenue"] = (
        round(100 * portfolio["total_annual_saving"] / portfolio["revenue_2025"], 2)
        if portfolio["revenue_2025"] else 0.0
    )
    return {"opcos": opcos, "portfolio": portfolio, "assumptions": _assumptions()}


def _assumptions() -> dict:
    return {
        "cost_of_capital": COST_OF_CAPITAL,
        "buffer_z": BUFFER_Z,
        "forecast_buffer_reduction": FORECAST_BUFFER_REDUCTION,
        "weather_idle_cost": WEATHER_IDLE_COST,
        "weather_signal_calibration": WEATHER_SIGNAL,
        "weather_confidence": WEATHER_CONFIDENCE,
        "notes": (
            "DSO usa los supuestos de M4 (no medidos contra cobros reales). "
            "El ahorro por clima es de baja confianza (R²≈0.08 clima→billing). "
            "Coste de capital y reducción de buffer son supuestos económicos."
        ),
    }
