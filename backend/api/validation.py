"""Validación de path params + shape de errores (ver ENDPOINTS.md)."""

from __future__ import annotations

from fastapi import HTTPException

SCENARIOS = ("base", "wet_qtr", "dry_qtr")
OPCOS = ("Opco_A", "Opco_B", "Opco_C", "Opco_D")


def err(code: str, message: str, hint: str | None = None) -> dict:
    d = {"error": True, "code": code, "message": message}
    if hint:
        d["hint"] = hint
    return d


def validate_scenario(scenario: str) -> None:
    if scenario not in SCENARIOS:
        raise HTTPException(
            400,
            detail=err(
                "INVALID_SCENARIO",
                f"'{scenario}' is not a valid scenario.",
                "Use: base | wet_qtr | dry_qtr",
            ),
        )


def validate_opco(opco: str) -> None:
    if opco not in OPCOS:
        raise HTTPException(
            400,
            detail=err(
                "INVALID_OPCO",
                f"'{opco}' is not a valid opco.",
                "Use: Opco_A | Opco_B | Opco_C | Opco_D",
            ),
        )


def validate_week(week: int) -> None:
    if not 1 <= week <= 13:
        raise HTTPException(
            400,
            detail=err("INVALID_WEEK", f"Week must be 1-13, got {week}."),
        )


def not_computed() -> HTTPException:
    return HTTPException(
        404,
        detail=err(
            "FORECAST_NOT_COMPUTED",
            "No forecast found. Run POST /recompute first.",
            "Run: python run.py model",
        ),
    )
