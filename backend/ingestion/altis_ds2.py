"""Parser para 'Altis dataset 2.xlsx' → dos opcos reales.

El archivo trae dos empresas distintas del portfolio:

  - Hojas '2023'..'2026'  → libro de ventas de una OpCo (sistema Gilde) → Opco_C
      cols: Datum, Bkst.nr., Dagboek, Debet, Credit, Btw-bedrag
      (sin columna de cuenta GL ni project_code: revenue se reconoce por el
       diario de Verkoop y el signo del Credit)
  - Hoja 'Company E 2026' → facturas de Company E (sistema Yuki) → Opco_D
      cols: Factuurdatum, Factuurnummer, Factuurbedrag

Reconcilia ambas estructuras heterogéneas al esquema canónico de `transactions`.
"""

from __future__ import annotations

import glob
import os

import pandas as pd

DS2_GLOB = "Altis dataset 2.xlsx"
TX_SHEETS = ("2023", "2024", "2025", "2026")
COMPANY_E_SHEET = "Company E 2026"

# Revenue en diario de ventas → cuenta 8000 (omzet) para que mapee a milestone_billing.
REVENUE_GL = "8000"


def _parse_gilde(path: str) -> pd.DataFrame:
    """Hojas anuales de transacciones → Opco_C (Gilde)."""
    frames = []
    xl = pd.ExcelFile(path)
    for sheet in TX_SHEETS:
        if sheet not in xl.sheet_names:
            continue
        df = pd.read_excel(path, sheet_name=sheet)
        df = df[pd.to_datetime(df["Datum"], errors="coerce").notna()]
        if df.empty:
            continue
        credit = pd.to_numeric(df["Credit"], errors="coerce").fillna(0)
        debet = pd.to_numeric(df["Debet"], errors="coerce").fillna(0)
        frames.append(
            pd.DataFrame(
                {
                    # libro de ventas → cuenta omzet 8000 (un débito = nota de crédito/reversa)
                    "gl_account": REVENUE_GL,
                    "date": pd.to_datetime(df["Datum"]),
                    "period": pd.to_datetime(df["Datum"]).dt.month,
                    "doc_number": df["Bkst.nr."].astype(str),
                    "journal": df["Dagboek"],
                    "debet": debet,
                    "credit": credit,
                    "description": df["Dagboek"],
                    "project_code": None,
                    "btw_type": None,
                    "system": "Gilde",
                    "opco": "Opco_C",
                    "source_file": f"{os.path.basename(path)}#{sheet}",
                }
            )
        )
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def _parse_company_e(path: str) -> pd.DataFrame:
    """Hoja 'Company E 2026' (facturas) → Opco_D (Yuki)."""
    if COMPANY_E_SHEET not in pd.ExcelFile(path).sheet_names:
        return pd.DataFrame()
    raw = pd.read_excel(path, sheet_name=COMPANY_E_SHEET, header=None)
    # cols: 0=Factuurdatum, 2=Factuurnummer, 5=Factuurbedrag; datos donde col0 es fecha
    rows = raw[pd.to_datetime(raw[0], errors="coerce").notna()]
    if rows.empty:
        return pd.DataFrame()
    amount = pd.to_numeric(rows[5], errors="coerce").fillna(0)
    return pd.DataFrame(
        {
            "gl_account": REVENUE_GL,            # factura = revenue
            "date": pd.to_datetime(rows[0]),
            "period": pd.to_datetime(rows[0]).dt.month,
            "doc_number": rows[2].astype(str),
            "journal": "Verkoop (factuur)",
            "debet": 0.0,
            "credit": amount,
            "description": "Customer invoice",
            "project_code": None,
            "btw_type": None,
            "system": "Yuki",
            "opco": "Opco_D",
            "source_file": f"{os.path.basename(path)}#{COMPANY_E_SHEET}",
        }
    )


def ingest_ds2_files(raw_dir: str = "data/raw/") -> pd.DataFrame:
    """Parsea 'Altis dataset 2.xlsx' → Opco_C (Gilde) + Opco_D (Yuki)."""
    frames = []
    for path in sorted(glob.glob(os.path.join(raw_dir, DS2_GLOB))):
        frames.append(_parse_gilde(path))
        frames.append(_parse_company_e(path))
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
