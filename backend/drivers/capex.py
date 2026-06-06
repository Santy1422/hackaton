"""Driver 3/5 — Inversiones de capital (capex)."""

from __future__ import annotations

from .base import BaseDriver, DriverResult


class CapexDriver(BaseDriver):
    name = "capex"

    def project(self, horizon_months: int, assumptions: dict) -> DriverResult:
        raise NotImplementedError
