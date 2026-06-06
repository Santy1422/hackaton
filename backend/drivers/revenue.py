"""Driver 1/5 — Ingresos (cobros de clientes)."""

from __future__ import annotations

from .base import BaseDriver, DriverResult


class RevenueDriver(BaseDriver):
    name = "revenue"

    def project(self, horizon_months: int, assumptions: dict) -> DriverResult:
        raise NotImplementedError
