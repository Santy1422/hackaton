"""Parser base para los sistemas contables de origen.

Cada sistema (Gilde, Yuki, Exact, Snelstart) implementa un parser que
normaliza su export (CSV/XML/API) al esquema canónico de transacciones.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class CanonicalTransaction:
    """Transacción normalizada, común a todos los sistemas de origen."""

    source_system: str
    booking_date: date
    gl_account: str
    description: str
    amount: Decimal
    currency: str = "EUR"
    counterparty: str | None = None
    entity: str | None = None


class BaseParser(ABC):
    """Contrato que implementa cada parser de sistema."""

    source_system: str

    @abstractmethod
    def parse(self, raw: bytes | str) -> list[CanonicalTransaction]:
        """Convierte un export crudo en transacciones canónicas."""
        raise NotImplementedError
