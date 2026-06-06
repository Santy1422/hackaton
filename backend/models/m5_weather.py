"""M5 — Weather impact (modelo de umbrales no lineal) + integración Open-Meteo.

Para un horizonte de 13 semanas el forecast meteorológico real solo cubre
~16 días, así que combinamos:

1. Open-Meteo Forecast API   → días cercanos (real, gratis, sin API key)
2. Open-Meteo Archive API    → climatología por iso_week (media histórica 3a)
3. Normales mensuales NL      → fallback offline (KNMI / De Bilt)

Todo se devuelve alineado por `iso_week` para matchear con el billing semanal.
"""

from __future__ import annotations

from datetime import date, timedelta

import httpx
import pandas as pd

AMSTERDAM = (52.37, 4.89)
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
CLIMATOLOGY_YEARS = 3  # cuántos años hacia atrás para la media histórica

RAIN_THRESHOLD_MM = 15.0  # >15mm/día = work stop
FROST_THRESHOLD_C = 0.0  # <0°C = work stop
WIND_THRESHOLD_BFT = 6.0  # >Bft 6 = stop

# Normales climáticas mensuales NL (precip mm/día, temp media °C) — aprox KNMI De Bilt
NL_MONTHLY = {
    1: (2.3, 3.4), 2: (1.9, 3.7), 3: (2.1, 6.2), 4: (1.4, 9.3),
    5: (1.9, 13.1), 6: (2.3, 15.6), 7: (2.5, 17.9), 8: (2.6, 17.5),
    9: (2.8, 14.7), 10: (3.0, 11.0), 11: (2.7, 7.0), 12: (2.6, 4.2),
}


# ----------------------------------------------------------------------------
# Modelo de impacto (umbrales)
# ----------------------------------------------------------------------------
def compute_delay_weeks(rain_mm: float, frost_days: int, wind_bft: float) -> float:
    """Semanas de retraso de facturación causadas por el clima (no lineal)."""
    rain_stop_days = max(0, (rain_mm / 10) - (RAIN_THRESHOLD_MM / 10))
    frost_stop_days = frost_days if frost_days > 0 else 0
    wind_stop_days = max(0, (wind_bft - WIND_THRESHOLD_BFT) * 0.5)
    total_stop_days = rain_stop_days + frost_stop_days + wind_stop_days
    return total_stop_days / 7


def apply_weather_to_forecast(m1_forecast, m4_forecast, weather_df):
    """Desplaza billing y collection hacia adelante por delay_weeks.

    Implementado dentro de `scenario_engine` (difiere fracción del cobro).
    """
    raise NotImplementedError


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def kmh_to_bft(kmh: float) -> float:
    """Convierte km/h a escala Beaufort (aproximación)."""
    return round((max(kmh, 0) / 3.01) ** (2 / 3), 1)


def _horizon_weeks(start: date, weeks: int):
    return [
        (i + 1, int((start + timedelta(weeks=i)).isocalendar()[1]),
         start + timedelta(weeks=i))
        for i in range(weeks)
    ]


def _normals_row(week_start: date) -> dict:
    rain_d, temp = NL_MONTHLY[week_start.month]
    return {
        "rain_mm": round(rain_d * 7, 1),
        "temp_avg": float(temp),
        "wind_bft": 3.5,
        "frost_days": 1 if temp < 2 else 0,
        "source": "nl-normals",
    }


def _fetch_forecast_daily(lat: float, lon: float) -> dict[date, dict]:
    """Pronóstico diario real (hasta 16 días) → {date: metrics}."""
    try:
        resp = httpx.get(
            FORECAST_URL,
            params={
                "latitude": lat, "longitude": lon,
                "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
                "forecast_days": 16, "timezone": "Europe/Amsterdam",
            },
            timeout=10,
        )
        d = resp.json()["daily"]
        return _index_daily(d)
    except Exception:
        return {}


def _fetch_climatology(lat: float, lon: float, start: date, end: date) -> dict[int, dict]:
    """Media histórica por iso_week sobre la misma ventana de años previos."""
    acc: dict[int, list[dict]] = {}
    for back in range(1, CLIMATOLOGY_YEARS + 1):
        try:
            s = start.replace(year=start.year - back)
            e = end.replace(year=end.year - back)
            resp = httpx.get(
                ARCHIVE_URL,
                params={
                    "latitude": lat, "longitude": lon,
                    "start_date": s.isoformat(), "end_date": e.isoformat(),
                    "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
                    "timezone": "Europe/Amsterdam",
                },
                timeout=15,
            )
            for day, m in _index_daily(resp.json()["daily"]).items():
                acc.setdefault(int(day.isocalendar()[1]), []).append(m)
        except Exception:
            continue
    out: dict[int, dict] = {}
    for iso, days in acc.items():
        df = pd.DataFrame(days)
        out[iso] = {
            "rain_mm": round(float(df["rain_mm"].sum()) / CLIMATOLOGY_YEARS, 1),
            "temp_avg": round(float(df["temp_avg"].mean()), 1),
            "wind_bft": round(float(df["wind_bft"].max()), 1),
            "frost_days": int(round(float(df["frost"].sum()) / CLIMATOLOGY_YEARS)),
            "source": "open-meteo-archive",
        }
    return out


def _index_daily(d: dict) -> dict[date, dict]:
    """Normaliza la respuesta diaria de Open-Meteo a {date: metrics}."""
    out = {}
    for i, t in enumerate(d["time"]):
        out[date.fromisoformat(t)] = {
            "rain_mm": float(d["precipitation_sum"][i] or 0),
            "temp_avg": (float(d["temperature_2m_max"][i] or 0)
                         + float(d["temperature_2m_min"][i] or 0)) / 2,
            "wind_bft": kmh_to_bft(float(d["windspeed_10m_max"][i] or 0)),
            "frost": 1 if float(d["temperature_2m_min"][i] or 0) < FROST_THRESHOLD_C else 0,
        }
    return out


def _agg_forecast_week(daily: dict[date, dict], week_start: date) -> dict | None:
    """Agrega los 7 días de una semana del pronóstico real, si están todos."""
    days = [daily.get(week_start + timedelta(days=k)) for k in range(7)]
    present = [x for x in days if x]
    if len(present) < 4:  # cobertura insuficiente
        return None
    df = pd.DataFrame(present)
    return {
        "rain_mm": round(float(df["rain_mm"].sum()), 1),
        "temp_avg": round(float(df["temp_avg"].mean()), 1),
        "wind_bft": round(float(df["wind_bft"].max()), 1),
        "frost_days": int(df["frost"].sum()),
        "source": "open-meteo-forecast",
    }


def fetch_weather_forecast(
    start: date | None = None, weeks: int = 13, lat: float = AMSTERDAM[0], lon: float = AMSTERDAM[1]
) -> pd.DataFrame:
    """13 semanas de clima NL alineadas por iso_week (forecast + climatología + normales).

    Columnas: forecast_week, iso_week, week_start, rain_mm, temp_avg,
    wind_bft, frost_days, source.
    """
    if start is None:
        today = date.today()
        start = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
    horizon = _horizon_weeks(start, weeks)
    end = horizon[-1][2] + timedelta(days=6)

    daily = _fetch_forecast_daily(lat, lon)
    clim = _fetch_climatology(lat, lon, start, end)

    rows = []
    for fw, iso, ws in horizon:
        wk = _agg_forecast_week(daily, ws) or clim.get(iso) or _normals_row(ws)
        rows.append({"forecast_week": fw, "iso_week": iso, "week_start": ws, **wk})
    return pd.DataFrame(rows)
