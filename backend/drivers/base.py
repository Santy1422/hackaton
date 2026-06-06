"""Driver base de flujo de caja.

Un driver toma transacciones reconciliadas + supuestos y proyecta una
serie temporal de impacto en caja. Los 5 drivers se combinan para el
forecast total.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal


@dataclass
class CashFlowPoint:
    period: date
    amount: Decimal


@dataclass
class DriverResult:
    driver: str
    points: list[CashFlowPoint] = field(default_factory=list)


class BaseDriver(ABC):
    name: str

    @abstractmethod
    def project(self, horizon_months: int, assumptions: dict) -> DriverResult:
        """Proyecta el impacto en caja del driver sobre el horizonte dado."""
        raise NotImplementedError
