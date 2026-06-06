"""Driver 4/5 — Capital de trabajo (DSO / DPO / inventario)."""

from __future__ import annotations

from .base import BaseDriver, DriverResult


class WorkingCapitalDriver(BaseDriver):
    name = "working_capital"

    def project(self, horizon_months: int, assumptions: dict) -> DriverResult:
        raise NotImplementedError
