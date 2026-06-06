"""Parser para archivos GB_8000/8001/8002 (sistema GB_Snelstart).

Formato:
- Sheet: 'Blad1', header en fila 0
- Columnas: Rekening, Periode, Datum, Boeknummer, Trek, Debet, Credit,
  Boekingstekst, Dagboek, BTW, BTW-srt
"""

from __future__ import annotations

import glob
import os

import pandas as pd

OPCO_MAP = {"8000": "Opco_A", "8001": "Opco_B", "8002": "Opco_C"}


def parse_file(path: str) -> pd.DataFrame:
    """Lee un archivo GB_* y lo normaliza al esquema canónico."""
    df = pd.read_excel(path, sheet_name="Blad1")
    code = os.path.basename(path).split("_")[1][:4]  # 8000 / 8001 / 8002
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
            "opco": OPCO_MAP.get(code, "Opco_A"),
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
