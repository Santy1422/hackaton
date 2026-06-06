"""Driver 2/5 — Gastos operativos (pagos a proveedores, nómina)."""

from __future__ import annotations

from .base import BaseDriver, DriverResult


class OpexDriver(BaseDriver):
    name = "opex"

    def project(self, horizon_months: int, assumptions: dict) -> DriverResult:
        raise NotImplementedError
