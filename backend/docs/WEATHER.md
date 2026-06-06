# Weather ↔ Cashflow — Two Honest Signals

Roofing is weather-exposed, but we refuse to fabricate a weather effect the data
doesn't support. We measured the relationship on Altis' own data (101 weeks,
2024-2025) and split it into **two separate signals**, each with its own evidence.

| Signal | Unit | What it means | Who sees it | Grounding |
|--------|------|---------------|-------------|-----------|
| **Schedule** | days | Physical roofing work-stops (can't lay membrane in heavy rain / frost / high wind) | Project Lead | Physical limits of the trade |
| **Financial** | € | Deviation of cashflow from the weather *anomaly* vs the iso-week normal | CFO / forecast | Empirical regression on real billing |

> **Key honesty point:** weather explains **<10% of billing variance**
> (multivariate R² ≈ 0.07). Only **temperature** is statistically significant
> (r = −0.23, p = 0.02); rain has **no** measurable effect (r ≈ −0.03, p = 0.78).
> So the **financial** signal is small and applies **only significant drivers** —
> we never move cash on a coefficient the data can't defend. The **schedule**
> signal is independent: it's about *when* work can physically happen, not how
> much gets billed.

---

## The calibration

`models/weather_calibration.py` fits the relationship empirically:

1. Pull weekly billing (`transactions`, 2024-2025) and weekly weather (Open-Meteo
   archive), joined by `(iso_year, iso_week)`.
2. **Deseasonalize** both: subtract each variable's iso-week mean. This removes
   the seasonality confound (summer = more roofing **and** less rain), isolating
   the weather effect.
3. Fit a multivariate OLS on the residuals → € coefficient per weather variable,
   plus per-variable Pearson r/p and overall R².
4. Compute iso-week **normals** (used later to turn a forecast week's weather
   into an *anomaly*).

Results are cached per process and persisted to the `weather_calibration` table
(latest row = current), so the frontend never pays the ~30s archive call.

**Financial impact of a forecast week** =
`Σ β_var · (week_value − iso_week_normal)` over **significant drivers only**.
At-normal weather → €0. The endpoint also returns each driver's raw contribution
with an `applied` flag, so non-significant drivers are visible but not counted.

**Schedule impact** = physical work-stops:
`rain > 15 mm`, `frost days`, `wind > Bft 6` → workable days lost.

---

## Endpoints

Both require `Authorization: Bearer <token>` (any authenticated role).

### `GET /api/weather`

13-week outlook, each week carrying **both** signals plus a calibration summary.

```jsonc
{
  "source": "weather_forecast",
  "location": { "lat": 52.37, "lon": 4.89 },
  "weeks": [
    {
      "forecast_week": 4,
      "iso_week": 27,
      "week_start": "2026-06-29",
      "temp_avg": 17.9, "rain_mm": 37.8, "frost_days": 0, "wind_bft": 7.4,
      "source": "open-meteo-archive",
      "risk_level": "high",                       // = schedule risk (physical)
      "schedule": {                               // Project Lead
        "workable_days_lost": 3.0,
        "risk_level": "high",
        "reasons": ["heavy rain (38 mm)", "high wind (Bft 7)"],
        "delay_weeks": 0.43
      },
      "financial": {                              // CFO / forecast (calibrated)
        "impact_eur": -10254,
        "by_driver_eur": {
          "rain":  { "eur": 4855,    "applied": false },
          "temp":  { "eur": -10254,  "applied": true  },
          "wind":  { "eur": -114691, "applied": false },
          "frost": { "eur": 0,       "applied": false }
        },
        "dominant_driver": "temp",
        "confidence": "low",
        "basis": "calibrated β · anomaly vs iso_week normal, significant drivers only (temp); R²=0.072"
      }
    }
    // ... 13 weeks
  ],
  "calibration": {
    "method": "deseasonalized multivariate OLS (residuals vs iso_week mean)",
    "period": "2024-2025",
    "n_weeks": 101,
    "multivariate_r2": 0.072,
    "financial_confidence": "low",
    "significant_drivers": ["temp"],
    "verdict": "Weather explains <10% of billing variance — weak financial signal."
  }
}
```

**Query params:** `weeks` (default 13), `lat`, `lon`.
Falls back to a live Open-Meteo fetch if `weather_forecast` is empty
(`503 WEATHER_API_UNAVAILABLE` if Open-Meteo is unreachable).

### `GET /api/weather/calibration`

Full empirical evidence — for the audit view / "show your work" panel.

```jsonc
{
  "method": "deseasonalized multivariate OLS (residuals vs iso_week mean)",
  "period": "2024-2025",
  "n_weeks": 101,
  "billing_mean_eur": 595554,
  "billing_std_eur": 319070,
  "drivers": {
    "rain":  { "r": -0.028, "p_value": 0.781, "coef_eur_per_unit": 1079.0,   "unit": "mm/week",  "significant": false },
    "temp":  { "r": -0.228, "p_value": 0.020, "coef_eur_per_unit": -33076.0, "unit": "°C",       "significant": true  },
    "wind":  { "r": -0.127, "p_value": 0.201, "coef_eur_per_unit": -44112.0, "unit": "Bft (max)","significant": false },
    "frost": { "r": 0.098,  "p_value": 0.329, "coef_eur_per_unit": -23239.0, "unit": "days",     "significant": false }
  },
  "significant_drivers": ["temp"],
  "multivariate_r2": 0.072,
  "financial_confidence": "low",
  "verdict": "Weather explains <10% of billing variance — weak financial signal.",
  "normals_by_iso_week": { "24": { "rain": 31.2, "temp": 15.3, "wind": 4.9, "frost": 0.0 } /* ... */ },
  "intercept_eur": 0.0
}
```

**Query params:** `refresh=true` recomputes from scratch and re-persists
(otherwise returns the cached/persisted calibration). `lat`, `lon`.

---

## Where it's used

- **Frontend** consumes `GET /api/weather` directly: the Project Lead view reads
  `schedule`, any € view reads `financial`, and the `calibration` block lets any
  view show "measured on N weeks, R²=…, honest" inline.
- **`POST /api/recompute`** refreshes the calibration (best-effort) alongside
  ingestion + scenario models.
- **Forecast `d5_weather_impact`** (in `scenario_engine`) remains a *schedule-driven
  timing shift* of cash — weather moves *when* cash lands, not the total. The
  calibrated **magnitude** is surfaced separately here and is intentionally **not**
  double-counted into the cashflow.

---

## Tests

```bash
.venv/bin/pytest tests/test_weather_calibration.py -v
```

12 tests: Pearson + deseasonalize math, schedule thresholds, the
significant-drivers-only financial rule (incl. zero-at-normal), and both
endpoints (skipped gracefully if Open-Meteo/DB is unreachable).
