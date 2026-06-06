"""Parser para exports del sistema Exact."""

from __future__ import annotations

from .base import BaseParser, CanonicalTransaction


class ExactParser(BaseParser):
    source_system = "exact"

    def parse(self, raw: bytes | str) -> list[CanonicalTransaction]:
        # TODO: mapear columnas del export de Exact al esquema canónico
        raise NotImplementedError
