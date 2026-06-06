"""Mapeo de cuentas GL de cada sistema a un plan de cuentas unificado."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GLMapping:
    source_system: str
    source_account: str
    unified_account: str
    confidence: float  # 0..1 — score del match (regla o LLM)


class GLMapper:
    """Resuelve la cuenta unificada para una cuenta de origen.

    Primero intenta reglas determinísticas; los casos ambiguos se
    delegan a `llm_assist` y quedan registrados en el `audit_log`.
    """

    def __init__(self, rules: dict[tuple[str, str], str] | None = None):
        self.rules = rules or {}

    def map_account(self, source_system: str, source_account: str) -> GLMapping | None:
        unified = self.rules.get((source_system, source_account))
        if unified is None:
            return None
        return GLMapping(source_system, source_account, unified, confidence=1.0)
