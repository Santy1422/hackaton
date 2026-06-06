"""Registro de auditoría para cada decisión de reconciliación.

Toda asignación de cuenta (por regla o por LLM) se persiste con su
origen, confianza y justificación, para garantizar trazabilidad.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class AuditEntry:
    timestamp: datetime
    source_system: str
    source_account: str
    unified_account: str
    method: str  # "rule" | "llm" | "manual"
    confidence: float
    rationale: str | None = None


class AuditLog:
    def __init__(self):
        self._entries: list[AuditEntry] = []

    def record(self, entry: AuditEntry) -> None:
        self._entries.append(entry)

    def entries(self) -> list[AuditEntry]:
        return list(self._entries)
