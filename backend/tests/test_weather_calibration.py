"""Tests de la calibración empírica clima↔billing y sus dos señales.

  - Unidad (sin red/DB): stats, schedule físico, impacto financiero significativo.
  - Integración (red + DB): /api/weather (dos señales) y /api/weather/calibration.

Correr:  .venv/bin/pytest tests/test_weather_calibration.py -v
"""

from __future__ import annotations

import numpy as np
import pytest

from models.weather_calibration import (
    deseasonalize,
    financial_impact_eur,
    pearson,
    schedule_signal,
)

# calib sintético: temp y frost significativos; rain y wind no.
FAKE_CALIB = {
    "drivers": {
        "rain": {"coef_eur_per_unit": 1000.0, "significant": False, "unit": "mm/week"},
        "temp": {"coef_eur_per_unit": -30000.0, "significant": True, "unit": "°C"},
        "wind": {"coef_eur_per_unit": -40000.0, "significant": False, "unit": "Bft"},
        "frost": {"coef_eur_per_unit": -20000.0, "significant": True, "unit": "days"},
    },
    "significant_drivers": ["temp", "frost"],
    "normals_by_iso_week": {27: {"rain": 20.0, "temp": 18.0, "wind": 4.0, "frost": 0.0}},
    "multivariate_r2": 0.07,
    "financial_confidence": "low",
}


# ================================================================ stats puros
class TestStats:
    def test_pearson_perfect_positive(self):
        r, p = pearson(np.array([1, 2, 3, 4.0]), np.array([2, 4, 6, 8.0]))
        assert round(r, 3) == 1.0

    def test_pearson_no_variance_is_zero(self):
        r, p = pearson(np.array([5, 5, 5.0]), np.array([1, 2, 3.0]))
        assert r == 0.0 and p == 1.0

    def test_deseasonalize_subtracts_isoweek_mean(self):
        # misma iso_week (10) en dos años: media 150 → residuos -50, +50
        keys = [(2024, 10), (2025, 10), (2024, 11)]
        vals = [100.0, 200.0, 999.0]
        out = deseasonalize(keys, vals)
        assert out[0] == -50.0 and out[1] == 50.0
        assert out[2] == 0.0  # único en su semana → residuo 0


# ============================================== señal SCHEDULE (física, días)
class TestScheduleSignal:
    def test_clear_week_no_loss(self):
        s = schedule_signal(rain_mm=5, frost_days=0, wind_bft=3)
        assert s["workable_days_lost"] == 0.0
        assert s["risk_level"] == "low" and s["reasons"] == []

    def test_heavy_rain_loses_days(self):
        s = schedule_signal(rain_mm=45, frost_days=0, wind_bft=3)
        assert s["workable_days_lost"] > 0
        assert any("rain" in r for r in s["reasons"])

    def test_frost_and_wind_combine_to_high(self):
        s = schedule_signal(rain_mm=0, frost_days=2, wind_bft=8)
        assert s["risk_level"] == "high"
        assert any("frost" in r for r in s["reasons"])
        assert any("wind" in r for r in s["reasons"])


# ============================================ señal FINANCIERA (€, calibrada)
class TestFinancialImpact:
    def test_only_significant_drivers_move_eur(self):
        week = {"rain_mm": 30, "temp_avg": 16, "wind_bft": 8, "frost_days": 1}
        fin = financial_impact_eur(week, 27, FAKE_CALIB)
        # temp: -30000 * (16-18) = +60000 ; frost: -20000 * (1-0) = -20000 → 40000
        assert fin["impact_eur"] == 40000
        # rain y wind NO se aplican aunque su β sea grande
        assert fin["by_driver_eur"]["rain"]["applied"] is False
        assert fin["by_driver_eur"]["wind"]["applied"] is False
        assert fin["by_driver_eur"]["temp"]["applied"] is True

    def test_dominant_driver_is_largest_significant(self):
        week = {"rain_mm": 30, "temp_avg": 16, "wind_bft": 8, "frost_days": 1}
        fin = financial_impact_eur(week, 27, FAKE_CALIB)
        assert fin["dominant_driver"] == "temp"

    def test_weather_at_normal_has_zero_impact(self):
        week = {"rain_mm": 20, "temp_avg": 18, "wind_bft": 4, "frost_days": 0}
        fin = financial_impact_eur(week, 27, FAKE_CALIB)
        assert fin["impact_eur"] == 0

    def test_confidence_propagated(self):
        fin = financial_impact_eur({"temp_avg": 18}, 27, FAKE_CALIB)
        assert fin["confidence"] == "low"


# ================================================ INTEGRACIÓN (red + DB)
class TestCalibrationEndpoint:
    def test_calibration_endpoint_shape(self, client, auth_headers):
        try:
            r = client.get("/api/weather/calibration", headers=auth_headers("cfo@altis.com"))
        except Exception as e:  # red/DB caída
            pytest.skip(f"calibration unavailable: {e}")
        if r.status_code == 503:
            pytest.skip("Open-Meteo / DB unavailable")
        assert r.status_code == 200
        body = r.json()
        assert body["n_weeks"] >= 10
        assert set(body["drivers"]) == {"rain", "temp", "wind", "frost"}
        assert "multivariate_r2" in body and "verdict" in body

    def test_weather_has_both_signals(self, client, auth_headers):
        try:
            r = client.get("/api/weather", headers=auth_headers("lead@altis.com"))
        except Exception as e:
            pytest.skip(f"weather unavailable: {e}")
        if r.status_code == 503:
            pytest.skip("weather source unavailable")
        assert r.status_code == 200
        weeks = r.json()["weeks"]
        assert weeks, "no weather weeks"
        w = weeks[0]
        assert "schedule" in w and "workable_days_lost" in w["schedule"]
        assert "financial" in w and "impact_eur" in w["financial"]
        assert w["risk_level"] in ("low", "medium", "high")
