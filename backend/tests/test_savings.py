"""Tests del endpoint /api/savings (ahorro/ROI por OpCo).

Verifica auth por rol, estructura de la respuesta y coherencia de los números
(no-negativos, total = suma de ejes, % sobre revenue razonable).
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient  # noqa: E402

import api.main  # noqa: E402

client = TestClient(api.main.app)


def _cfo_headers() -> dict:
    r = client.post("/api/auth/login", json={"email": "cfo@altis.com", "password": "altis2025"})
    if r.status_code != 200:
        return {}
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_savings_requires_auth():
    assert client.get("/api/savings").status_code == 401


def test_savings_structure_and_coherence():
    headers = _cfo_headers()
    if not headers:
        import pytest

        pytest.skip("usuarios sin sembrar — corré `python run.py seed`")

    r = client.get("/api/savings", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "opcos" in data and "portfolio" in data and "assumptions" in data

    if not data["opcos"]:
        import pytest

        pytest.skip("sin datos — corré `python run.py ingest && python run.py model`")

    for o in data["opcos"]:
        # ahorros no negativos
        assert o["dso_annual_saving"] >= 0
        assert o["buffer_annual_saving"] >= 0
        assert o["weather_annual_saving"] >= 0
        # total = suma de los 3 ejes (tolerancia de redondeo)
        s = o["dso_annual_saving"] + o["buffer_annual_saving"] + o["weather_annual_saving"]
        assert abs(s - o["total_annual_saving"]) <= 1.0
        # el ahorro no puede superar el revenue
        assert 0 <= o["saving_pct_of_revenue"] < 100

    # el total del portfolio = suma de OpCos
    tot = sum(o["total_annual_saving"] for o in data["opcos"])
    assert abs(tot - data["portfolio"]["total_annual_saving"]) <= 1.0
