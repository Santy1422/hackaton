"""M1 — Milestone billing forecast (Prophet, semanal + regresor clima)."""

from __future__ import annotations


def fit_and_predict(transactions_df, weather_df, horizon: int = 13):
    """Predice milestone billing semanal para las próximas `horizon` semanas.

    1. Agrega revenue semanal (credit>0, group by iso_week+year): ds, y
    2. Agrega weather_delay_weeks = delay_days/7 como regresor
    3. Ajusta Prophet(weekly+yearly) con add_regressor('weather_delay_weeks')
    4. Predice 13 semanas hacia adelante
    5. Devuelve ds, yhat, yhat_lower, yhat_upper
    """
    raise NotImplementedError


ASSUMPTION = (
    "Prophet(weekly+yearly seasonality) + weather_delay regressor, "
    "trained on {n} weeks of actuals"
)
