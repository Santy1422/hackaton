"""Asistencia LLM para mapeos de GL ambiguos.

Cuando el `GLMapper` no encuentra una regla, se le pide a un modelo
Claude que proponga la cuenta unificada más probable, devolviendo
una explicación que alimenta el audit log.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LLMSuggestion:
    unified_account: str
    confidence: float
    rationale: str


def suggest_mapping(
    source_system: str,
    source_account: str,
    description: str,
    candidate_accounts: list[str],
) -> LLMSuggestion:
    """Propone una cuenta unificada usando el LLM.

    TODO: integrar el Anthropic SDK (claude-opus-4-8) con prompt caching
    sobre el plan de cuentas unificado.
    """
    raise NotImplementedError
