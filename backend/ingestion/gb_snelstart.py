"""Parser para los exports de GB (sistema Snelstart) → Opco_A.

GB es UNA empresa (portfolio company 1). Los archivos GB_8000/8001/8002 son sus
cuentas de revenue con distinto IVA (omzet hoog 21% / verlegd / laag 9%), NO
opcos distintos. Todas las filas pertenecen al mismo opco; la cuenta real se
conserva en `gl_account` (8000/8001/8002) para el mapeo de drivers e IVA.

Formato:
- Sheet: 'Blad1', header en fila 0
- Columnas: Rekening, Periode, Datum, Boeknummer, Trek, Debet, Credit,
  Boekingstekst, Dagboek, BTW, BTW-srt
"""

from __future__ import annotations

import glob
import os

import pandas as pd

OPCO = "Opco_A"  # GB / Snelstart


def parse_file(path: str) -> pd.DataFrame:
    """Lee un archivo GB_* y lo normaliza al esquema canónico (todo Opco_A)."""
    df = pd.read_excel(path, sheet_name="Blad1")
    out = pd.DataFrame(
        {
            "gl_account": df["Rekening"].astype(str),
            "date": pd.to_datetime(df["Datum"]),
            "period": df["Periode"],
            "doc_number": df["Boeknummer"].astype(str),
            "journal": df["Dagboek"],
            "debet": df["Debet"].fillna(0),
            "credit": df["Credit"].fillna(0),
            "description": df["Boekingstekst"],
            "project_code": df["Trek"],
            "btw_type": df["BTW-srt"],
            "system": "GB_Snelstart",
            "opco": OPCO,
            "source_file": os.path.basename(path),
        }
    )
    return out


def ingest_gb_files(raw_dir: str = "data/raw/") -> pd.DataFrame:
    """Parsea todos los GB_8000/8001/8002*.xlsx de `raw_dir`."""
    frames = []
    for pattern in ("GB_8000*.xlsx", "GB_8001*.xlsx", "GB_8002*.xlsx"):
        for path in sorted(glob.glob(os.path.join(raw_dir, pattern))):
            frames.append(parse_file(path))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
