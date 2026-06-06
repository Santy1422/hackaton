"""Calibración empírica clima ↔ negocio sobre datos REALES de Altis.

Dos señales separadas, cada una con su evidencia (decisión de producto):

  1. FINANCIERA (€)  — calibrada de los datos: regresión deseasonalizada
     billing_residual ~ rain + temp + wind + frost (2024-2025). El clima explica
     <10% de la varianza, así que el impacto € que aplicamos es pequeño y honesto.
     No inventamos un efecto que los datos no respaldan.

  2. SCHEDULE (días) — límites físicos de la obra de techado: no se puede
     impermeabilizar con lluvia fuerte, helada o viento alto. Esto SÍ es real e
     independiente de que el billing trimestral se suavice. Es lo que ve el
     Project Lead como "weather schedule risk".

Todo se alinea por iso_week para matchear billing semanal ↔ clima semanal.
"""

from __future__ import annotations

import json
import math
from datetime import date

import httpx
import numpy as np

from db.database import execute, get_connection, init_schema, query

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
AMSTERDAM = (52.37, 4.89)
CALIB_YEARS = ("2024-01-01", "2025-12-31")

# Límites físicos de la obra de techado (señal de SCHEDULE, no financiera)
RAIN_STOP_MM = 15.0   # >15 mm/día → no se puede trabajar la cubierta
FROST_STOP_C = 0.0    # helada → no se aplica membrana/asfalto
WIND_STOP_BFT = 6.0   # > Bft 6 → grúa/trabajo en altura parado

VARS = ("rain", "temp", "wind", "frost")
VAR_UNIT = {"rain": "mm/week", "temp": "°C", "wind": "Bft (max)", "frost": "days"}

# cache por proceso: la llamada al archivo Open-Meteo tarda ~30s
_CACHE: dict[tuple, dict] = {}


# ---------------------------------------------------------------- stats puros
def pearson(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Pearson r + p-value aprox (t de Student vía normal)."""
    if len(x) < 3 or np.std(x) == 0 or np.std(y) == 0:
        return 0.0, 1.0
    r = float(np.corrcoef(x, y)[0, 1])
    if abs(r) >= 1.0:
        return r, 0.0
    n = len(x)
    t = r * math.sqrt((n - 2) / (1 - r * r))
    p = 2 * (1 - 0.5 * (1 + math.erf(abs(t) / math.sqrt(2))))
    return r, p


def deseasonalize(keys, values) -> np.ndarray:
    """Residuo de cada valor vs la media de su iso_week (entre años).

    Aísla el efecto del clima de la estacionalidad (verano = más obra Y menos lluvia).
    """
    by_week: dict[int, list[float]] = {}
    for (_iy, iw), val in zip(keys, values):
        by_week.setdefault(iw, []).append(val)
    means = {iw: float(np.mean(vs)) for iw, vs in by_week.items()}
    return np.array([val - means[iw] for (_iy, iw), val in zip(keys, values)])


# -------------------------------------------------------------- data fetchers
def _weekly_billing(con) -> dict[tuple[int, int], float]:
    rows = query(
        con,
        "SELECT EXTRACT(ISOYEAR FROM date)::int iy, EXTRACT(WEEK FROM date)::int iw, "
        "SUM(credit) rev FROM transactions "
        "WHERE credit > 0 AND EXTRACT(ISOYEAR FROM date)::int IN (2024, 2025) GROUP BY 1, 2",
    )
    return {(int(r["iy"]), int(r["iw"])): float(r["rev"]) for r in rows}


def _kmh_to_bft(kmh: float) -> float:
    return round((max(kmh, 0) / 3.01) ** (2 / 3), 1)


def _weekly_weather(lat: float, lon: float) -> dict[tuple[int, int], dict]:
    resp = httpx.get(
        ARCHIVE_URL,
        params={
            "latitude": lat, "longitude": lon,
            "start_date": CALIB_YEARS[0], "end_date": CALIB_YEARS[1],
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
        a["temps"].append(
            (float(d["temperature_2m_max"][i] or 0) + float(d["temperature_2m_min"][i] or 0)) / 2
        )
        a["wind"] = max(a["wind"], _kmh_to_bft(float(d["windspeed_10m_max"][i] or 0)))
        a["frost"] += 1 if float(d["temperature_2m_min"][i] or 0) < FROST_STOP_C else 0
    return {
        k: {"rain": v["rain"], "temp": float(np.mean(v["temps"])), "wind": v["wind"], "frost": v["frost"]}
        for k, v in acc.items()
    }


# ----------------------------------------------------------------- calibración
def calibrate(con=None, lat: float = AMSTERDAM[0], lon: float = AMSTERDAM[1], force: bool = False) -> dict:
    """Ajusta clima→billing sobre datos reales. Cacheado por proceso.

    Devuelve coeficientes € por unidad, r/p por variable, R² multivariante,
    normales por iso_week (para calcular anomalías) y un veredicto honesto.
    """
    cache_key = (round(lat, 2), round(lon, 2))
    if not force and cache_key in _CACHE:
        return _CACHE[cache_key]

    own_con = con is None
    con = con or get_connection()
    try:
        billing = _weekly_billing(con)
    finally:
        if own_con:
            con.close()
    weather = _weekly_weather(lat, lon)

    keys = sorted(set(billing) & set(weather))
    if len(keys) < 10:
        raise ValueError(f"Insufficient overlap to calibrate ({len(keys)} weeks)")

    rev = np.array([billing[k] for k in keys])
    series = {v: np.array([weather[k][v] for k in keys]) for v in VARS}

    rev_d = deseasonalize(keys, rev)
    series_d = {v: deseasonalize(keys, series[v]) for v in VARS}

    # OLS multivariante sobre residuos deseasonalizados → β € por unidad
    X = np.column_stack([series_d[v] for v in VARS] + [np.ones(len(keys))])
    beta, *_ = np.linalg.lstsq(X, rev_d, rcond=None)
    pred = X @ beta
    ss_res = float(np.sum((rev_d - pred) ** 2))
    ss_tot = float(np.sum((rev_d - rev_d.mean()) ** 2)) or 1.0
    r2 = 1 - ss_res / ss_tot

    drivers = {}
    for i, v in enumerate(VARS):
        r, p = pearson(series_d[v], rev_d)
        drivers[v] = {
            "r": round(r, 3),
            "p_value": round(p, 3),
            "coef_eur_per_unit": round(float(beta[i]), 1),
            "unit": VAR_UNIT[v],
            "significant": bool(p < 0.05),
        }

    # normales por iso_week (media entre años) → base para anomalías del forecast
    normals: dict[int, dict] = {}
    by_week: dict[int, list[dict]] = {}
    for (_iy, iw) in keys:
        by_week.setdefault(iw, []).append(weather[(_iy, iw)])
    for iw, vals in by_week.items():
        normals[iw] = {v: round(float(np.mean([x[v] for x in vals])), 2) for v in VARS}

    sig = [v for v in VARS if drivers[v]["significant"]]
    if r2 < 0.10:
        verdict = "Weather explains <10% of billing variance — weak financial signal."
    elif r2 < 0.25:
        verdict = "Weather explains some billing variance but is not a dominant driver."
    else:
        verdict = "Weather is a meaningful driver of billing."

    payload = {
        "method": "deseasonalized multivariate OLS (residuals vs iso_week mean)",
        "period": "2024-2025",
        "location": {"lat": lat, "lon": lon},
        "n_weeks": len(keys),
        "billing_mean_eur": round(float(rev.mean())),
        "billing_std_eur": round(float(rev.std())),
        "drivers": drivers,
        "significant_drivers": sig,
        "multivariate_r2": round(r2, 3),
        "financial_confidence": "low" if r2 < 0.10 else "medium" if r2 < 0.25 else "high",
        "verdict": verdict,
        "normals_by_iso_week": normals,
        "intercept_eur": round(float(beta[-1]), 1),
    }
    _CACHE[cache_key] = payload
    return payload


def persist(con, calib: dict) -> None:
    """Guarda la calibración en `weather_calibration` (audit + lectura rápida)."""
    init_schema(con)
    execute(
        con,
        "INSERT INTO weather_calibration (n_weeks, period, multivariate_r2, payload) "
        "VALUES (?, ?, ?, ?)",
        [calib["n_weeks"], calib["period"], calib["multivariate_r2"], json.dumps(calib)],
    )


def load_or_calibrate(con=None, lat: float = AMSTERDAM[0], lon: float = AMSTERDAM[1]) -> dict:
    """Lee la última calibración persistida; si no hay, la calcula y la guarda.

    Evita pagar la llamada de ~30s a Open-Meteo en cada request del frontend.
    """
    own_con = con is None
    con = con or get_connection()
    try:
        init_schema(con)  # asegura que la tabla exista (idempotente)
        rows = query(
            con,
            "SELECT payload FROM weather_calibration ORDER BY computed_at DESC LIMIT 1",
        )
        if rows and rows[0]["payload"]:
            calib = json.loads(rows[0]["payload"])
            # normalizar claves de normals (JSON convierte int→str)
            calib["normals_by_iso_week"] = {
                int(k): v for k, v in calib.get("normals_by_iso_week", {}).items()
            }
            return calib
        calib = calibrate(con, lat, lon)
        persist(con, calib)
        return calib
    finally:
        if own_con:
            con.close()


# ----------------------------------------------- señal 1: impacto financiero €
def financial_impact_eur(week_weather: dict, iso_week: int, calib: dict) -> dict:
    """€ de desviación del cashflow por anomalía climática de la semana.

    impact = Σ β_var · (valor_semana − normal_iso_week).  Honesto: si la señal
    es débil (R² bajo), el número es pequeño — así debe ser.
    """
    nbw = calib.get("normals_by_iso_week", {})
    normal = nbw.get(iso_week) or nbw.get(str(iso_week)) or {}
    drivers = calib["drivers"]
    # nombres en weather_forecast → vars del modelo de calibración
    ALIASES = {"rain": ("rain_mm", "rain"), "temp": ("temp_avg", "temp"),
               "wind": ("wind_bft", "wind"), "frost": ("frost_days", "frost")}
    contrib = {}
    total = 0.0
    for v in VARS:
        val = next((float(week_weather[a]) for a in ALIASES[v] if week_weather.get(a) is not None), 0.0)
        anomaly = val - float(normal.get(v, val))
        eur = drivers[v]["coef_eur_per_unit"] * anomaly
        applied = drivers[v]["significant"]  # solo variables significativas mueven €
        contrib[v] = {"eur": round(eur), "applied": applied}
        if applied:
            total += eur
    applied_only = {k: c["eur"] for k, c in contrib.items() if c["applied"]}
    dominant = (min(applied_only, key=lambda k: abs(applied_only[k]) * -1)
                if applied_only else None)
    return {
        "impact_eur": round(total),
        "by_driver_eur": contrib,
        "dominant_driver": dominant,
        "confidence": calib["financial_confidence"],
        "basis": (
            f"calibrated β · anomaly vs iso_week normal, significant drivers only "
            f"({', '.join(calib['significant_drivers']) or 'none'}); R²={calib['multivariate_r2']}"
        ),
    }


# ----------------------------------------------- señal 2: schedule (físico)
def schedule_signal(rain_mm: float, frost_days: int, wind_bft: float) -> dict:
    """Días de obra perdidos por límites físicos de techado (independiente del €)."""
    reasons = []
    rain_days = max(0.0, (rain_mm - RAIN_STOP_MM) / 10.0)
    if rain_days > 0:
        reasons.append(f"heavy rain ({rain_mm:.0f} mm)")
    frost_lost = float(frost_days) if frost_days > 0 else 0.0
    if frost_lost > 0:
        reasons.append(f"frost ({frost_days} d)")
    wind_lost = max(0.0, (wind_bft - WIND_STOP_BFT) * 0.5)
    if wind_lost > 0:
        reasons.append(f"high wind (Bft {wind_bft:.0f})")
    days_lost = round(rain_days + frost_lost + wind_lost, 1)
    risk = "high" if days_lost >= 2 else "medium" if days_lost > 0 else "low"
    return {
        "workable_days_lost": days_lost,
        "risk_level": risk,
        "reasons": reasons,
        "delay_weeks": round(days_lost / 7, 2),
    }
