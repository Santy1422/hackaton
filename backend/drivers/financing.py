"""Driver 5/5 — Financiación (deuda, intereses, dividendos)."""

from __future__ import annotations

from .base import BaseDriver, DriverResult


class FinancingDriver(BaseDriver):
    name = "financing"

    def project(self, horizon_months: int, assumptions: dict) -> DriverResult:
        raise NotImplementedError
