"""Parser para exports del sistema Yuki."""

from __future__ import annotations

from .base import BaseParser, CanonicalTransaction


class YukiParser(BaseParser):
    source_system = "yuki"

    def parse(self, raw: bytes | str) -> list[CanonicalTransaction]:
        # TODO: mapear columnas del export de Yuki al esquema canónico
        raise NotImplementedError
