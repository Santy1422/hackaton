"""Endpoints de forecast: correr escenarios Base / Wet / Dry."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/scenarios")
def list_scenarios():
    return {"scenarios": ["base", "wet", "dry"]}
