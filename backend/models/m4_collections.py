"""M4 — Customer collections (lag DSO empírico, por OpCo)."""

from __future__ import annotations

DSO_DAYS = {
    "base": {"Opco_A": 35, "Opco_B": 38, "Opco_C": 30, "Opco_D": 32},
    "wet_qtr": {"Opco_A": 42, "Opco_B": 45, "Opco_C": 37, "Opco_D": 39},
    "dry_qtr": {"Opco_A": 30, "Opco_B": 33, "Opco_C": 25, "Opco_D": 28},
}


def predict(m1_forecast, scenario: str = "base", opco: str = "Opco_B"):
    """El cash llega DSO días después de la factura.

    collection[t] = milestone_billed[t - DSO/7 semanas]
    Devuelve serie semanal de inflow.
    """
    raise NotImplementedError


ASSUMPTION = "DSO {dso_days}d for {opco} under {scenario} scenario"
