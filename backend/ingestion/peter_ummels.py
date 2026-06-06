"""Parser para archivos 82604-* (sistema PeterUmmels_Exact, Opco_B).

Formato:
- Sheet: 'Sheet1'
- Metadata filas 1-12 (skip)
- GL account en B7 (índice 6): p.ej. "8005 - omzet ...", se toman 4 chars
- Header en fila 13 (índice 12): Nr., Per., Datum, Bkst.nr., Dagboek, Debet, Credit
- Datos desde fila 14 (índice 13); solo filas donde Nr. es entero
"""

from __future__ import annotations

import glob
import os

import pandas as pd


def parse_file(path: str) -> pd.DataFrame:
    """Lee un archivo 82604-* y lo normaliza al esquema canónico."""
    raw = pd.read_excel(path, sheet_name="Sheet1", header=None)
    gl_account = str(raw.iloc[6, 1])[:4]  # B7 → primeros 4 chars

    df = pd.read_excel(path, sheet_name="Sheet1", skiprows=12)
    df = df[pd.to_numeric(df["Nr."], errors="coerce").notna()]

    out = pd.DataFrame(
        {
            "gl_account": gl_account,
            "date": pd.to_datetime(df["Datum"]),
            "period": df["Per."],
            "doc_number": df["Bkst.nr."].astype(str),
            "journal": df["Dagboek"],
            "debet": df["Debet"].fillna(0),
            "credit": df["Credit"].fillna(0),
            "system": "PeterUmmels_Exact",
            "opco": "Opco_B",
            "source_file": os.path.basename(path),
        }
    )
    return out


def ingest_pu_files(raw_dir: str = "data/raw/") -> pd.DataFrame:
    """Parsea todos los 82604-*.xlsx de `raw_dir`."""
    frames = [
        parse_file(p)
        for p in sorted(glob.glob(os.path.join(raw_dir, "82604-*.xlsx")))
    ]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
