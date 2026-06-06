"""Parser para exports del sistema Snelstart."""

from __future__ import annotations

from .base import BaseParser, CanonicalTransaction


class SnelstartParser(BaseParser):
    source_system = "snelstart"

    def parse(self, raw: bytes | str) -> list[CanonicalTransaction]:
        # TODO: mapear columnas del export de Snelstart al esquema canónico
        raise NotImplementedError
