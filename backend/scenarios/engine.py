"""Motor de escenarios: Base / Wet / Dry.

Aplica ajustes de supuestos sobre los drivers para generar tres
proyecciones de caja comparables:

- base: supuestos centrales
- wet:  escenario optimista (más liquidez / mejores cobros)
- dry:  escenario adverso (estrés de caja)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from drivers.base import BaseDriver, CashFlowPoint


class Scenario(str, Enum):
    BASE = "base"
    WET = "wet"
    DRY = "dry"


# Multiplicadores de ejemplo por escenario (placeholder, se afinan luego)
SCENARIO_FACTORS: dict[Scenario, float] = {
    Scenario.BASE: 1.0,
    Scenario.WET: 1.15,
    Scenario.DRY: 0.85,
}


@dataclass
class ForecastResult:
    scenario: Scenario
    points: list[CashFlowPoint]


class ScenarioEngine:
    def __init__(self, drivers: list[BaseDriver]):
        self.drivers = drivers

    def run(
        self, scenario: Scenario, horizon_months: int, assumptions: dict
    ) -> ForecastResult:
        """Corre todos los drivers bajo un escenario y agrega la caja."""
        # TODO: ejecutar cada driver, aplicar SCENARIO_FACTORS y agregar por período
        raise NotImplementedError
