"""M2 — Materials outflow (OLS lag regression: materials[t] ~ billing[t+2])."""

from __future__ import annotations

FALLBACK_RATIO = 0.33  # materials = billing * 0.33 si faltan datos


def fit_and_predict(transactions_df, m1_forecast):
    """Materiales se ordenan 2 semanas antes de facturar.

    1. De actuals: billing semanal y debet semanal (proxy de costo)
    2. Alinea materials[t] ~ billing[t+2]
    3. OLS: materials = alpha + beta * billing_lead2
    4. Aplica al forecast M1: materials[t] = alpha + beta * m1[t+2]
    5. Devuelve valores negativos (outflows)

    Fallback si faltan datos: materials = billing * FALLBACK_RATIO
    """
    raise NotImplementedError


ASSUMPTION = (
    "OLS lag regression: materials[t] = {alpha:.0f} + {beta:.3f} * "
    "billing[t+2], R²={r2:.2f}"
)
