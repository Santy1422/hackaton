"""M5 — Weather impact (modelo de umbrales no lineal) + fetch Open-Meteo."""

from __future__ import annotations

import httpx
import pandas as pd

RAIN_THRESHOLD_MM = 15.0  # >15mm/día = work stop
FROST_THRESHOLD_C = 0.0  # <0°C = work stop
WIND_THRESHOLD_BFT = 6.0  # >Bft 6 = stop


def compute_delay_weeks(rain_mm: float, frost_days: int, wind_bft: float) -> float:
    """Semanas de retraso de facturación causadas por el clima (no lineal)."""
    rain_stop_days = max(0, (rain_mm / 10) - (RAIN_THRESHOLD_MM / 10))
    frost_stop_days = frost_days if frost_days > 0 else 0
    wind_stop_days = max(0, (wind_bft - WIND_THRESHOLD_BFT) * 0.5)
    total_stop_days = rain_stop_days + frost_stop_days + wind_stop_days
    return total_stop_days / 7


def apply_weather_to_forecast(m1_forecast, m4_forecast, weather_df):
    """Desplaza billing y collection hacia adelante por delay_weeks.

    Devuelve (m1_adjusted, m4_adjusted, weather_impact_series).
    """
    raise NotImplementedError


def fetch_weather_forecast(lat: float = 52.37, lon: float = 4.89, weeks: int = 13):
    """13 semanas de pronóstico desde Open-Meteo (gratis, sin API key).

    Coords default: Amsterdam NL. Devuelve DataFrame con columnas:
    week_start, rain_mm, temp_avg, wind_bft, frost_days.

    Si la API falla, fallback a clima sintético (verano NL: ~12mm/sem,
    18°C, Bft 3).
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
        "forecast_days": weeks * 7,
        "timezone": "Europe/Amsterdam",
    }
    try:
        resp = httpx.get(url, params=params, timeout=10)
        data = resp.json()["daily"]
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["time"])
        df["iso_week"] = df["date"].dt.isocalendar().week.astype(int)
        weekly = df.groupby("iso_week").agg(
            week_start=("date", "min"),
            rain_mm=("precipitation_sum", "sum"),
            temp_avg=("temperature_2m_max", "mean"),
            wind_bft=("windspeed_10m_max", lambda s: _kmh_to_bft(s.max())),
            frost_days=("temperature_2m_min", lambda s: int((s < 0).sum())),
        )
        return weekly.reset_index()
    except Exception:
        return _synthetic_weather(weeks)


def _kmh_to_bft(kmh: float) -> float:
    """Convierte km/h a escala Beaufort (aproximación)."""
    return round((kmh / 3.01) ** (2 / 3), 1)


def _synthetic_weather(weeks: int) -> pd.DataFrame:
    """Fallback: promedio estacional NL en verano."""
    return pd.DataFrame(
        {
            "iso_week": list(range(1, weeks + 1)),
            "rain_mm": [12.0] * weeks,
            "temp_avg": [18.0] * weeks,
            "wind_bft": [3.0] * weeks,
            "frost_days": [0] * weeks,
        }
    )
