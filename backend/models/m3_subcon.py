"""M3 — Subcontractor payments (ratio fijo de milestone + payment terms)."""

from __future__ import annotations

SUBCON_RATIO = 0.20  # 20% del revenue de milestone
PAYMENT_TERMS_DAYS = {
    "base": {"net14": 0.4, "net30": 0.6},
    "wet_qtr": {"net14": 0.3, "net60": 0.7},  # pago más lento en wet quarter
    "dry_qtr": {"net14": 0.6, "net30": 0.4},
}


def predict(m1_forecast, scenario: str = "base"):
    """Aplica SUBCON_RATIO y distribuye según payment terms.

    net14: pagado 2 semanas después del milestone; net30: 4 semanas después.
    Devuelve serie semanal de outflow (negativa).
    """
    raise NotImplementedError


ASSUMPTION = "Subcon ratio {ratio:.0%} of milestone, {scenario} payment terms"
