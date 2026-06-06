"""Combina M1–M5 para los 3 escenarios y escribe en `forecast_13w`.

Regla crítica: cada fila guarda sus supuestos (m1_assumption, ...). Ese es
el audit trail que ve el jurado.
"""

from __future__ import annotations

SCENARIOS = {
    "base": {"revenue_mult": 1.00, "dso_mult": 1.00, "weather_active": True},
    "wet_qtr": {"revenue_mult": 0.82, "dso_mult": 1.20, "weather_active": True, "extra_rain_mm": 18},
    "dry_qtr": {"revenue_mult": 1.12, "dso_mult": 0.86, "weather_active": False},
}

OPCOS = ["Opco_A", "Opco_B", "Opco_C", "Opco_D"]


def run_all_scenarios(db_conn) -> None:
    """Corre todos los escenarios × opcos y persiste en `forecast_13w`.

    Para cada (scenario, opco): M1→M2→M3→M4→M5, ensambla filas con sus
    supuestos y las inserta. Wet quarter debe mover en conjunto:
    M1 revenue ↓ + M5 delay ↑ + M4 DSO ↑ + M3 payment terms más lentos.
    """
    raise NotImplementedError
