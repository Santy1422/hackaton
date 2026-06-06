"""Parser para exports del sistema Gilde."""

from __future__ import annotations

from .base import BaseParser, CanonicalTransaction


class GildeParser(BaseParser):
    source_system = "gilde"

    def parse(self, raw: bytes | str) -> list[CanonicalTransaction]:
        # TODO: mapear columnas del export de Gilde al esquema canónico
        raise NotImplementedError
