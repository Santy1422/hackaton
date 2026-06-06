"""Estudio empírico: ¿el clima correlaciona con el billing real (Excel)?

Junta billing semanal (transactions) con clima histórico semanal (Open-Meteo
archive) por (iso_year, iso_week) para 2024-2025 y mide correlación.

Reporta dos cosas, sin inventar:
  - NAIVE: Pearson r entre lluvia y billing (confundido por estacionalidad:
    verano = más techado Y menos lluvia).
  - DESEASONALIZED: residuos vs la media por iso_week → aísla si, cuando el
    clima fue peor de lo normal para esa semana, el billing fue menor.
"""

from __future__ import annotations

import math
import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx  # noqa: E402
import numpy as np  # noqa: E402

from db.database import get_connection, query  # noqa: E402

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def _pearson(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Pearson r + p-value aprox (t de Student)."""
    if len(x) < 3:
        return 0.0, 1.0
    r = float(np.corrcoef(x, y)[0, 1])
    if abs(r) >= 1.0:
        return r, 0.0
    n = len(x)
    t = r * math.sqrt((n - 2) / (1 - r * r))
    # p-value de dos colas aprox vía distribución normal (n grande)
    p = 2 * (1 - 0.5 * (1 + math.erf(abs(t) / math.sqrt(2))))
    return r, p


def weekly_billing() -> dict[tuple[int, int], float]:
    con = get_connection()
    rows = query(
        con,
        "SELECT EXTRACT(ISOYEAR FROM date)::int iy, EXTRACT(WEEK FROM date)::int iw, "
        "SUM(credit) rev FROM transactions "
        "WHERE credit > 0 AND EXTRACT(ISOYEAR FROM date)::int IN (2024, 2025) GROUP BY 1, 2",
    )
    con.close()
    return {(int(r["iy"]), int(r["iw"])): float(r["rev"]) for r in rows}


def weekly_weather() -> dict[tuple[int, int], dict]:
    resp = httpx.get(
        ARCHIVE_URL,
        params={
            "latitude": 52.37, "longitude": 4.89,
            "start_date": "2024-01-01", "end_date": "2025-12-31",
            "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
            "timezone": "Europe/Amsterdam",
        },
        timeout=30,
    )
    d = resp.json()["daily"]
    acc: dict[tuple[int, int], dict] = {}
    for i, t in enumerate(d["time"]):
        dt = date.fromisoformat(t)
        iy, iw, _ = dt.isocalendar()
        a = acc.setdefault((iy, iw), {"rain": 0.0, "temps": [], "wind": 0.0, "frost": 0})
        a["rain"] += float(d["precipitation_sum"][i] or 0)
        a["temps"].append((float(d["temperature_2m_max"][i] or 0) + float(d["temperature_2m_min"][i] or 0)) / 2)
        a["wind"] = max(a["wind"], float(d["windspeed_10m_max"][i] or 0))
        a["frost"] += 1 if float(d["temperature_2m_min"][i] or 0) < 0 else 0
    return {
        k: {"rain": v["rain"], "temp": float(np.mean(v["temps"])), "wind": v["wind"], "frost": v["frost"]}
        for k, v in acc.items()
    }


def deseasonalize(keys, values) -> np.ndarray:
    """Residuo de cada valor vs la media de su iso_week (across años)."""
    by_week: dict[int, list[float]] = {}
    for (iy, iw), val in zip(keys, values):
        by_week.setdefault(iw, []).append(val)
    means = {iw: float(np.mean(vs)) for iw, vs in by_week.items()}
    return np.array([val - means[iw] for (iy, iw), val in zip(keys, values)])


def run() -> None:
    billing = weekly_billing()
    weather = weekly_weather()
    keys = sorted(set(billing) & set(weather))
    if len(keys) < 10:
        print("Datos insuficientes para correlacionar")
        return

    rev = np.array([billing[k] for k in keys])
    rain = np.array([weather[k]["rain"] for k in keys])
    temp = np.array([weather[k]["temp"] for k in keys])
    wind = np.array([weather[k]["wind"] for k in keys])
    frost = np.array([weather[k]["frost"] for k in keys])

    print("=" * 60)
    print("  WEATHER ↔ BILLING — empirical correlation (2024-2025)")
    print("=" * 60)
    print(f"  Matched weeks: {len(keys)}  (joined by iso_year + iso_week)")
    print(f"  Billing/week: mean €{rev.mean():,.0f}  std €{rev.std():,.0f}")
    print("-" * 60)
    print("  NAIVE Pearson r (raw, confounded by seasonality):")
    for name, arr in [("rain", rain), ("temp", temp), ("wind", wind), ("frost", frost)]:
        r, p = _pearson(arr, rev)
        print(f"    billing vs {name:<5}  r = {r:+.3f}   p = {p:.3f}")

    print("-" * 60)
    print("  DESEASONALIZED Pearson r (residuals vs iso_week mean):")
    rev_d = deseasonalize(keys, rev)
    sig = None
    for name, arr in [("rain", rain), ("temp", temp), ("wind", wind), ("frost", frost)]:
        arr_d = deseasonalize(keys, arr)
        r, p = _pearson(arr_d, rev_d)
        flag = "  <-- significant" if p < 0.05 else ""
        if name == "rain":
            sig = (r, p)
        print(f"    billing vs {name:<5}  r = {r:+.3f}   p = {p:.3f}{flag}")

    # R² del modelo multivariante deseasonalizado
    X = np.column_stack([deseasonalize(keys, a) for a in (rain, temp, wind, frost)])
    X = np.column_stack([X, np.ones(len(X))])
    beta, *_ = np.linalg.lstsq(X, rev_d, rcond=None)
    pred = X @ beta
    ss_res = float(np.sum((rev_d - pred) ** 2))
    ss_tot = float(np.sum((rev_d - rev_d.mean()) ** 2)) or 1.0
    r2 = 1 - ss_res / ss_tot

    print("-" * 60)
    print(f"  Multivariate R² (rain+temp+wind+frost → billing): {r2:.3f}")
    print("=" * 60)
    print("  HONEST READ:")
    rr, rp = sig
    if rp < 0.05 and rr < 0:
        verdict = "weather has a measurable negative signal on billing"
    elif abs(r2) < 0.1:
        verdict = "weather explains <10% of billing variance — WEAK signal"
    else:
        verdict = "weather explains some variance but not dominant"
    print(f"  → {verdict}")
    print(f"  → Weather→billing predictive accuracy ≈ {max(0, r2)*100:.0f}/100 (R²)")
    print("=" * 60)


if __name__ == "__main__":
    run()
