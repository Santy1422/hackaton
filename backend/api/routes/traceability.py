"""Endpoints de trazabilidad: del número de forecast hasta la transacción origen."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/traceability", tags=["traceability"])


@router.get("/audit-log")
def get_audit_log():
    # TODO: devolver las entradas del AuditLog de reconciliación
    return {"entries": []}
