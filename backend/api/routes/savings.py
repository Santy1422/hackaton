"""Endpoint: estimación de ahorro / ROI por OpCo del sistema de forecasting."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from db.database import get_connection
from models.savings import compute_savings

from ..auth import require_roles
from ..validation import validate_opco

router = APIRouter(tags=["savings"])


@router.get("")
def get_savings(user: dict = Depends(require_roles("pe_board", "cfo"))):
    """Ahorro anual estimado por OpCo + totales del portfolio."""
    con = get_connection()
    try:
        return compute_savings(con)
    finally:
        con.close()


@router.get("/{opco}")
def get_savings_opco(opco: str, user: dict = Depends(require_roles("pe_board", "cfo"))):
    validate_opco(opco)
    con = get_connection()
    try:
        data = compute_savings(con)
    finally:
        con.close()
    match = next((o for o in data["opcos"] if o["opco"] == opco), None)
    return {"opco": opco, "saving": match, "assumptions": data["assumptions"]}
