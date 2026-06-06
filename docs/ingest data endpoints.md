# ENDPOINTS.md — Altis Groep Forecast API

Complete specification for every endpoint. For each one: URL, method, input,
what model/table it reads, what it returns, and the exact JSON shape.

---

## Base URL

```
http://localhost:8000/api
```

All responses are JSON. All monetary values are in EUR, rounded to 2 decimals.
All dates are ISO 8601 strings (`YYYY-MM-DD`).

---

## Authentication

None for the hackathon prototype. Add Bearer token middleware before production.

---

## Endpoints index

| # | Method | Path | Role | Table/Model |
|---|--------|------|------|-------------|
| 1 | GET | `/forecast/{scenario}` | CFO, PE | `forecast_13w` |
| 2 | GET | `/forecast/{scenario}/{opco}` | Opco MD | `forecast_13w` |
| 3 | GET | `/forecast/week/{scenario}/{week}` | CFO drill-down | `forecast_13w` |
| 4 | GET | `/audit/week/{scenario}/{week}` | CFO, jury | `forecast_13w` + `transactions` |
| 5 | GET | `/covenant/{scenario}` | PE Board | `forecast_13w` + `covenant_rules` |
| 6 | GET | `/wip/{opco}` | Opco MD | `transactions` |
| 7 | GET | `/weather` | Project Lead | `weather_forecast` |
| 8 | GET | `/milestones/{opco}` | Project Lead | `transactions` |
| 9 | GET | `/actuals/monthly` | CFO, PE | `transactions` |
| 10 | GET | `/actuals/weekly/{opco}` | CFO | `transactions` |
| 11 | GET | `/stats` | All roles | `transactions` + `forecast_13w` |
| 12 | GET | `/gl-mapping` | CFO audit | `gl_mapping` |
| 13 | PUT | `/gl-mapping/{gl_account}` | Controller | `gl_mapping` |
| 14 | POST | `/recompute` | Admin | all models |
| 15 | GET | `/health` | DevOps | — |

---

## 1. `GET /forecast/{scenario}`

**Who calls it:** CFO view (main chart), PE Board (cumulative line).

**Path params:**
| Param | Values | Required |
|-------|--------|----------|
| `scenario` | `base` \| `wet_qtr` \| `dry_qtr` | yes |

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `opco` | string | all | Filter to one opco |
| `group_by` | `week` \| `opco` | `week` | Aggregation level |

**Reads from:** `forecast_13w` — aggregate all opcos by `forecast_week`.

**SQL:**
```sql
SELECT
    scenario,
    forecast_week,
    week_start,
    SUM(d1_milestone_billing)   AS d1_milestone_billing,
    SUM(d2_materials_outflow)   AS d2_materials_outflow,
    SUM(d3_subcon_payment)      AS d3_subcon_payment,
    SUM(d4_customer_collection) AS d4_customer_collection,
    SUM(d5_weather_impact)      AS d5_weather_impact,
    SUM(gross_inflow)           AS gross_inflow,
    SUM(gross_outflow)          AS gross_outflow,
    SUM(net_cashflow)           AS net_cashflow,
    SUM(SUM(net_cashflow)) OVER (
        ORDER BY forecast_week
    )                           AS cumulative_cf
FROM forecast_13w
WHERE scenario = ?
GROUP BY scenario, forecast_week, week_start
ORDER BY forecast_week
```

**Response:**
```json
{
  "scenario": "base",
  "generated_at": "2026-06-06T10:00:00",
  "weeks": [
    {
      "forecast_week": 1,
      "week_start": "2026-06-06",
      "d1_milestone_billing": 472249.00,
      "d2_materials_outflow": -222632.00,
      "d3_subcon_payment": -134928.00,
      "d4_customer_collection": 341069.00,
      "d5_weather_impact": 0.00,
      "gross_inflow": 341069.00,
      "gross_outflow": -357560.00,
      "net_cashflow": -16491.00,
      "cumulative_cf": -16491.00
    }
  ],
  "totals": {
    "total_gross_inflow": 3483506.00,
    "total_gross_outflow": -3661677.00,
    "total_net_cashflow": -178106.00,
    "final_cumulative_cf": -178106.00
  }
}
```

---

## 2. `GET /forecast/{scenario}/{opco}`

**Who calls it:** Opco MD view (own company cash chart).

**Path params:**
| Param | Values |
|-------|--------|
| `scenario` | `base` \| `wet_qtr` \| `dry_qtr` |
| `opco` | `Opco_A` \| `Opco_B` \| `Opco_C` \| `Opco_D` |

**Reads from:** `forecast_13w` filtered by `opco`.

**SQL:**
```sql
SELECT
    forecast_week, week_start,
    d1_milestone_billing, d2_materials_outflow,
    d3_subcon_payment, d4_customer_collection,
    d5_weather_impact, gross_inflow, gross_outflow,
    net_cashflow,
    SUM(net_cashflow) OVER (ORDER BY forecast_week) AS cumulative_cf
FROM forecast_13w
WHERE scenario = ? AND opco = ?
ORDER BY forecast_week
```

**Response:** same shape as endpoint 1, scoped to one opco.
Adds:
```json
{
  "opco": "Opco_B",
  "portfolio_share_pct": 38.43
}
```

---

## 3. `GET /forecast/week/{scenario}/{week}`

**Who calls it:** CFO DrillDown modal (click a bar → this endpoint).

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `scenario` | string | `base` \| `wet_qtr` \| `dry_qtr` |
| `week` | integer | 1–13 |

**Reads from:** `forecast_13w` — all opcos for that week, plus per-opco breakdown.

**Response:**
```json
{
  "scenario": "base",
  "forecast_week": 5,
  "week_start": "2026-07-04",
  "portfolio": {
    "d1_milestone_billing": 581947.00,
    "d2_materials_outflow": -274346.00,
    "d3_subcon_payment": -166270.00,
    "d4_customer_collection": 420295.00,
    "d5_weather_impact": 0.00,
    "gross_inflow": 420295.00,
    "gross_outflow": -440617.00,
    "net_cashflow": -20322.00,
    "cumulative_cf": -75386.00
  },
  "by_opco": [
    {
      "opco": "Opco_A",
      "net_cashflow": -937.00,
      "share_pct": 4.61
    },
    {
      "opco": "Opco_B",
      "net_cashflow": -7808.00,
      "share_pct": 38.43
    },
    {
      "opco": "Opco_D",
      "net_cashflow": -11577.00,
      "share_pct": 56.96
    }
  ]
}
```

---

## 4. `GET /audit/week/{scenario}/{week}`

**Who calls it:** CFO DrillDown modal — "trace this number" button. The jury
will hit this endpoint during the demo.

**Path params:** same as endpoint 3.

**Reads from:**
- `forecast_13w` — the forecast values and stored assumptions
- `transactions` — actual source rows that trained the model for this week

**This is the most important endpoint. Every driver must expose:**
- The computed value
- The assumption string (stored at model-run time)
- Which GL accounts contributed
- How many source transaction rows
- Which source files

**SQL (per driver, example for D1):**
```sql
-- Forecast row
SELECT d1_milestone_billing, m1_assumption
FROM forecast_13w
WHERE scenario = ? AND forecast_week = ?;

-- Source transactions (trained on these)
SELECT
    gl_account,
    gl_label,
    source_file,
    COUNT(*)      AS row_count,
    SUM(credit)   AS total_credit
FROM transactions
WHERE driver = 'milestone_billing'
  AND iso_week = (SELECT iso_week FROM forecast_13w
                  WHERE scenario = ? AND forecast_week = ? LIMIT 1)
  AND year IN (2024, 2025)
GROUP BY gl_account, gl_label, source_file
ORDER BY total_credit DESC;
```

**Response:**
```json
{
  "scenario": "base",
  "forecast_week": 5,
  "week_start": "2026-07-04",
  "net_cashflow": -20322.00,
  "cumulative_cf": -75386.00,
  "covenant_headroom": 424614.00,
  "drivers": {
    "d1_milestone_billing": {
      "value": 581947.00,
      "direction": "inflow",
      "assumption": "Prophet(weekly+yearly seasonality) + weather_delay regressor, trained on 104 weeks of actuals, seasonal_index=1.41, weather_delay=0.0w",
      "model": "M1 — Prophet",
      "gl_accounts": [
        {"gl": "8000", "label": "Omzet hoog 21% BTW",    "opco": "Opco_A"},
        {"gl": "8001", "label": "Omzet verlegd",          "opco": "Opco_B"},
        {"gl": "8005", "label": "Omzet heffing verlegd",  "opco": "Opco_D"}
      ],
      "training_rows": 847,
      "source_files": [
        "GB_8001_jan-dec_25.xlsx",
        "GB_8001_jan-dec_24.xlsx",
        "82604-2025-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx"
      ]
    },
    "d2_materials_outflow": {
      "value": -274346.00,
      "direction": "outflow",
      "assumption": "OLS lag regression: materials[t] = 1240 + 0.472 * billing[t+2], R²=0.81, 2-week lead time",
      "model": "M2 — Lag regression",
      "gl_accounts": [],
      "training_rows": 102,
      "source_files": ["GB_8000_jan-dec_25.xlsx", "GB_8001_jan-dec_25.xlsx"]
    },
    "d3_subcon_payment": {
      "value": -166270.00,
      "direction": "outflow",
      "assumption": "Subcon ratio 20% of milestone, base payment terms: 40% net14 / 60% net30",
      "model": "M3 — Payment terms distribution",
      "gl_accounts": [
        {"gl": "8001", "label": "Omzet verlegd — BTW verlegd signal", "opco": "Opco_B"}
      ],
      "training_rows": 0,
      "source_files": []
    },
    "d4_customer_collection": {
      "value": 420295.00,
      "direction": "inflow",
      "assumption": "DSO empirical: Opco_A=35d, Opco_B=38d, Opco_D=32d — base scenario. Billing shifted by DSO/7 weeks.",
      "model": "M4 — DSO collections",
      "gl_accounts": [
        {"gl": "8000", "label": "Omzet hoog 21% BTW",   "opco": "Opco_A"},
        {"gl": "8001", "label": "Omzet verlegd",         "opco": "Opco_B"},
        {"gl": "8005", "label": "Omzet heffing verlegd", "opco": "Opco_D"}
      ],
      "training_rows": 847,
      "source_files": [
        "GB_8001_jan-dec_25.xlsx",
        "82604-2025-Dakdekkersbedrijf_Peter_Ummels-04-06-2026-FinTransactions.xlsx"
      ]
    },
    "d5_weather_impact": {
      "value": 0.00,
      "direction": "neutral",
      "assumption": "Weather threshold model: rain=3mm (<15mm threshold), frost=0d, wind=Bft2.1 — no delay this week",
      "model": "M5 — Weather impact",
      "gl_accounts": [],
      "training_rows": 0,
      "source_files": [],
      "weather_inputs": {
        "rain_mm": 3.0,
        "frost_days": 0,
        "wind_bft": 2.1,
        "delay_weeks": 0.0
      }
    }
  },
  "audit_metadata": {
    "computed_at": "2026-06-06T10:00:00",
    "total_source_transactions": 24247,
    "systems_reconciled": ["GB_Snelstart", "PeterUmmels_Exact"],
    "gl_accounts_mapped": 5,
    "gl_accounts_unmapped": 0
  }
}
```

---

## 5. `GET /covenant/{scenario}`

**Who calls it:** PE Board view (covenant gauge + scenario comparison).

**Reads from:** `forecast_13w` + `covenant_rules`.

**SQL:**
```sql
SELECT
    f.scenario,
    f.forecast_week,
    f.week_start,
    SUM(f.net_cashflow)                                    AS net_cashflow,
    SUM(SUM(f.net_cashflow)) OVER (ORDER BY f.forecast_week) AS cumulative_cf,
    SUM(SUM(f.net_cashflow)) OVER (ORDER BY f.forecast_week)
        - c.value                                          AS covenant_headroom,
    CASE WHEN SUM(SUM(f.net_cashflow)) OVER (ORDER BY f.forecast_week)
              < c.value THEN true ELSE false END           AS covenant_breach
FROM forecast_13w f
CROSS JOIN covenant_rules c
WHERE f.scenario = ?
  AND c.threshold_type = 'min_cumulative_cashflow'
GROUP BY f.scenario, f.forecast_week, f.week_start, c.value
ORDER BY f.forecast_week
```

**Response:**
```json
{
  "scenario": "base",
  "covenant_threshold": -500000.00,
  "threshold_type": "min_cumulative_cashflow",
  "horizon_weeks": 13,
  "weeks": [
    {
      "forecast_week": 1,
      "week_start": "2026-06-06",
      "net_cashflow": -16491.00,
      "cumulative_cf": -16491.00,
      "covenant_headroom": 483509.00,
      "covenant_breach": false
    }
  ],
  "summary": {
    "min_headroom": 321894.00,
    "min_headroom_week": 13,
    "any_breach": false,
    "final_headroom": 321894.00,
    "status": "SAFE"
  },
  "all_scenarios": {
    "base":    {"final_headroom": 321894.00, "any_breach": false, "status": "SAFE"},
    "wet_qtr": {"final_headroom": 198432.00, "any_breach": false, "status": "WATCH"},
    "dry_qtr": {"final_headroom": 487211.00, "any_breach": false, "status": "SAFE"}
  }
}
```

---

## 6. `GET /wip/{opco}`

**Who calls it:** Opco MD view (WIP exposure panel).

**Path params:**
| Param | Values |
|-------|--------|
| `opco` | `Opco_A` \| `Opco_B` \| `Opco_C` \| `Opco_D` |

**Reads from:** `transactions` — derive WIP from recent unbilled activity.

**SQL:**
```sql
-- Active projects: unique doc_numbers with recent credit activity
SELECT
    project_code,
    doc_number,
    MAX(date)       AS last_activity,
    SUM(credit)     AS total_billed,
    COUNT(*)        AS transaction_count,
    gl_account,
    gl_label
FROM transactions
WHERE opco = ?
  AND date >= CURRENT_DATE - INTERVAL '90 days'
  AND credit > 0
GROUP BY project_code, doc_number, gl_account, gl_label
ORDER BY total_billed DESC
LIMIT 50;

-- WIP summary
SELECT
    opco,
    COUNT(DISTINCT doc_number)  AS active_projects,
    SUM(credit)                 AS total_billed_90d,
    AVG(credit)                 AS avg_transaction_value,
    SUM(credit) / 13.0          AS weekly_run_rate
FROM transactions
WHERE opco = ?
  AND date >= CURRENT_DATE - INTERVAL '90 days'
  AND credit > 0;
```

**Response:**
```json
{
  "opco": "Opco_B",
  "summary": {
    "wip_value": 1810804.00,
    "active_projects": 49,
    "monthly_revenue": 1293432.00,
    "weekly_run_rate": 225134.00,
    "risk_level": "high"
  },
  "commitment_breakdown": {
    "g_rekening_blocked_pct": 0.18,
    "g_rekening_blocked_eur": 325944.72,
    "outstanding_subcon_invoices_pct": 0.32,
    "outstanding_subcon_invoices_eur": 579457.28,
    "planned_material_purchases_pct": 0.25,
    "planned_material_purchases_eur": 452701.00,
    "free_wip_pct": 0.25,
    "free_wip_eur": 452701.00
  },
  "top_projects": [
    {
      "doc_number": "2302328",
      "project_code": null,
      "last_activity": "2026-05-20",
      "total_billed": 391500.00,
      "transaction_count": 3,
      "gl_account": "8005",
      "gl_label": "Omzet heffing verlegd"
    }
  ]
}
```

---

## 7. `GET /weather`

**Who calls it:** Project Lead view (weather risk list).

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `weeks` | integer | 13 | How many weeks to return |
| `lat` | float | 52.37 | Latitude (default Amsterdam) |
| `lon` | float | 4.89 | Longitude |

**Reads from:** `weather_forecast` table.
If table is empty or stale (>24h old), fetch from Open-Meteo and repopulate.

**Response:**
```json
{
  "source": "open-meteo",
  "fetched_at": "2026-06-06T08:00:00",
  "location": {"lat": 52.37, "lon": 4.89, "name": "Amsterdam, NL"},
  "weeks": [
    {
      "forecast_week": 1,
      "iso_week": 23,
      "week_start": "2026-06-06",
      "temp_avg": 18.2,
      "rain_mm": 8.0,
      "frost_days": 0,
      "wind_bft": 3.2,
      "risk_level": "low",
      "delay_days": 0,
      "delay_weeks": 0.0,
      "work_stop_days": 0,
      "note": "Normal conditions"
    },
    {
      "forecast_week": 3,
      "iso_week": 25,
      "week_start": "2026-06-20",
      "temp_avg": 16.1,
      "rain_mm": 31.0,
      "frost_days": 0,
      "wind_bft": 5.0,
      "risk_level": "high",
      "delay_days": 2,
      "delay_weeks": 0.29,
      "work_stop_days": 2,
      "note": "Rain above threshold — 2 stop-work days expected"
    }
  ],
  "m5_inputs": {
    "total_delay_weeks_13w": 0.71,
    "high_risk_weeks": 2,
    "medium_risk_weeks": 3,
    "low_risk_weeks": 8
  }
}
```

---

## 8. `GET /milestones/{opco}`

**Who calls it:** Project Lead view (billable milestones table).

**Reads from:** `transactions` — proxy milestones from large credit entries.

**SQL:**
```sql
-- Proxy: each unique doc_number with credit > 50,000 = a milestone
-- Next milestone = earliest future billing date inferred from WIP pattern
SELECT
    doc_number,
    MAX(description)    AS description,
    MAX(gl_account)     AS gl_account,
    SUM(credit)         AS contract_value,
    MAX(date)           AS last_billed_date,
    COUNT(*)            AS installments_billed
FROM transactions
WHERE opco = ?
  AND credit > 50000
  AND date >= CURRENT_DATE - INTERVAL '180 days'
GROUP BY doc_number
ORDER BY last_billed_date DESC
LIMIT 20;
```

**Response:**
```json
{
  "opco": "Opco_B",
  "milestones": [
    {
      "doc_number": "2302328",
      "description": "Factuur Valkenswaard complex",
      "gl_account": "8005",
      "contract_value": 391500.00,
      "last_billed_date": "2026-05-20",
      "installments_billed": 3,
      "estimated_next_billing": "2026-06-09",
      "estimated_next_value": 130500.00,
      "weather_risk": "low",
      "billing_delay_days": 0,
      "status": "ready"
    }
  ]
}
```

---

## 9. `GET /actuals/monthly`

**Who calls it:** PE Board (revenue area chart), CFO (historical comparison).

**Query params:**
| Param | Type | Default |
|-------|------|---------|
| `from_year` | integer | 2024 |
| `opco` | string | all |

**Reads from:** `transactions`.

**SQL:**
```sql
SELECT
    DATE_TRUNC('month', date)           AS month,
    opco,
    SUM(credit)                         AS revenue,
    SUM(debet)                          AS costs,
    SUM(credit) - SUM(debet)            AS net,
    COUNT(DISTINCT doc_number)          AS invoice_count
FROM transactions
WHERE YEAR(date) >= ?
  AND credit > 0
GROUP BY DATE_TRUNC('month', date), opco
ORDER BY month, opco
```

**Response:**
```json
{
  "from_year": 2024,
  "months": [
    {
      "month": "2024-01",
      "total_revenue": 592826.63,
      "by_opco": {
        "Opco_A": 27341.20,
        "Opco_B": 241508.97,
        "Opco_D": 323976.46
      },
      "invoice_count": 48
    }
  ],
  "yoy": {
    "2024_total": 28272621.00,
    "2025_total": 31873462.00,
    "growth_pct": 12.7
  }
}
```

---

## 10. `GET /actuals/weekly/{opco}`

**Who calls it:** CFO (weekly run rate), feeds seasonal_index derivation.

**Reads from:** `transactions`.

**SQL:**
```sql
SELECT
    year,
    iso_week,
    MIN(date)       AS week_start,
    SUM(credit)     AS revenue,
    COUNT(*)        AS transaction_count
FROM transactions
WHERE opco = ?
  AND credit > 0
  AND year IN (2024, 2025)
GROUP BY year, iso_week
ORDER BY year, iso_week
```

**Response:**
```json
{
  "opco": "Opco_B",
  "weeks": [
    {
      "year": 2024,
      "iso_week": 1,
      "week_start": "2024-01-01",
      "revenue": 136420.50,
      "transaction_count": 22
    }
  ],
  "seasonal_index": [
    {"iso_week": 1,  "index": 0.81},
    {"iso_week": 13, "index": 1.68}
  ]
}
```

---

## 11. `GET /stats`

**Who calls it:** All role views (KPI cards top of screen).

**Reads from:** `transactions` + `forecast_13w`.

**Response:**
```json
{
  "transactions": {
    "total_rows": 24247,
    "systems": ["GB_Snelstart", "PeterUmmels_Exact"],
    "opcos": ["Opco_A", "Opco_B", "Opco_C", "Opco_D"],
    "date_range": {"from": "2023-01-05", "to": "2026-06-02"},
    "gl_accounts_mapped": 5,
    "gl_accounts_unmapped": 0
  },
  "revenue": {
    "total_2023": 23648694.00,
    "total_2024": 28272621.00,
    "total_2025": 31873462.00,
    "ytd_2026":   14424352.00,
    "weekly_runrate_2024_2025": 578412.00,
    "yoy_growth_pct": 12.7
  },
  "forecast": {
    "horizon_weeks": 13,
    "scenarios_computed": ["base", "wet_qtr", "dry_qtr"],
    "last_computed_at": "2026-06-06T10:00:00"
  },
  "covenant": {
    "threshold": -500000.00,
    "base_headroom_week13": 321894.00,
    "wet_headroom_week13": 198432.00,
    "dry_headroom_week13": 487211.00,
    "any_breach": false
  }
}
```

---

## 12. `GET /gl-mapping`

**Who calls it:** CFO audit panel (GL mapping table in dashboard).

**Reads from:** `gl_mapping`.

**Response:**
```json
{
  "mappings": [
    {
      "gl_account": "8000",
      "label": "Omzet hoog 21% BTW",
      "driver": "milestone_billing",
      "btw_type": "hoog_21pct",
      "system": "GB_Snelstart",
      "opco": "Opco_A",
      "reviewed_by": "llm_auto",
      "reviewed_at": "2026-06-06T10:00:00"
    },
    {
      "gl_account": "8001",
      "label": "Omzet verlegd",
      "driver": "milestone_billing",
      "btw_type": "verlegd",
      "system": "GB_Snelstart",
      "opco": "Opco_B",
      "reviewed_by": "llm_auto",
      "reviewed_at": "2026-06-06T10:00:00"
    },
    {
      "gl_account": "8004",
      "label": "Omzet 0%/niet belast",
      "driver": "milestone_billing",
      "btw_type": "zero",
      "system": "PeterUmmels_Exact",
      "opco": "Opco_D",
      "reviewed_by": "llm_auto",
      "reviewed_at": "2026-06-06T10:00:00"
    },
    {
      "gl_account": "8005",
      "label": "Omzet heffing verlegd",
      "driver": "milestone_billing",
      "btw_type": "verlegd",
      "system": "PeterUmmels_Exact",
      "opco": "Opco_D",
      "reviewed_by": "llm_auto",
      "reviewed_at": "2026-06-06T10:00:00"
    }
  ],
  "unmapped_accounts": [],
  "total_mapped": 5,
  "total_unmapped": 0
}
```

---

## 13. `PUT /gl-mapping/{gl_account}`

**Who calls it:** Controller (human review of LLM-suggested mappings).

**Path params:**
| Param | Type |
|-------|------|
| `gl_account` | string e.g. `"8005"` |

**Request body:**
```json
{
  "label": "Omzet heffing verlegd — subcon",
  "driver": "milestone_billing",
  "btw_type": "verlegd",
  "reviewed_by": "controller_abc"
}
```

**Writes to:** `gl_mapping` table. Sets `reviewed_by` and `reviewed_at`.

**After save:** trigger `POST /recompute` automatically so forecast reflects
the updated mapping immediately.

**Response:**
```json
{
  "gl_account": "8005",
  "updated": true,
  "recompute_triggered": true,
  "message": "GL 8005 updated and forecast recomputed"
}
```

---

## 14. `POST /recompute`

**Who calls it:** Admin panel, or automatically after GL mapping update.

**What it does:** re-runs the full model pipeline in order:

```
1. reconcile.py — re-apply GL mapping to transactions
2. seasonal_index — recompute from actuals
3. m1_milestone.py — refit Prophet, regenerate 13w forecast
4. m2_materials.py — refit OLS lag regression
5. m3_subcon.py — reapply payment terms
6. m4_collections.py — reapply DSO per opco
7. m5_weather.py — re-fetch Open-Meteo, recompute delays
8. scenario_engine.py — rebuild all 3 scenarios → forecast_13w
```

**Request body:** (optional)
```json
{
  "scenarios": ["base", "wet_qtr", "dry_qtr"],
  "opcos": ["Opco_A", "Opco_B", "Opco_D"],
  "fetch_fresh_weather": true
}
```

**Response:**
```json
{
  "status": "ok",
  "duration_seconds": 4.3,
  "rows_written": 156,
  "scenarios_computed": ["base", "wet_qtr", "dry_qtr"],
  "warnings": [],
  "computed_at": "2026-06-06T10:04:18"
}
```

---

## 15. `GET /health`

**Who calls it:** Uptime monitoring, CI/CD check.

**Response:**
```json
{
  "status": "ok",
  "db": "connected",
  "transactions_rows": 24247,
  "forecast_rows": 156,
  "last_ingestion": "2026-06-06T09:00:00",
  "last_model_run": "2026-06-06T10:00:00",
  "weather_last_fetched": "2026-06-06T08:00:00"
}
```

---

## Error responses

All errors follow this shape:

```json
{
  "error": true,
  "code": "FORECAST_NOT_COMPUTED",
  "message": "No forecast found for scenario 'wet_qtr'. Run POST /recompute first.",
  "hint": "Run: python run.py model"
}
```

| HTTP code | `code` | When |
|-----------|--------|------|
| 400 | `INVALID_SCENARIO` | scenario not in `base/wet_qtr/dry_qtr` |
| 400 | `INVALID_OPCO` | opco not in known list |
| 400 | `INVALID_WEEK` | week not 1–13 |
| 404 | `FORECAST_NOT_COMPUTED` | `forecast_13w` is empty |
| 404 | `GL_NOT_FOUND` | GL account doesn't exist in mapping |
| 503 | `WEATHER_API_UNAVAILABLE` | Open-Meteo unreachable, using fallback |
| 500 | `DB_ERROR` | DuckDB connection failed |

---

## Frontend ↔ endpoint map

| View | Component | Calls |
|------|-----------|-------|
| All | KPI cards | `GET /stats` |
| PE Board | Revenue chart | `GET /actuals/monthly` |
| PE Board | Cumulative CF chart | `GET /forecast/base`, `wet_qtr`, `dry_qtr` |
| PE Board | Covenant gauge | `GET /covenant/base` (+ wet + dry for comparison) |
| CFO | Weekly bar chart | `GET /forecast/{scenario}` |
| CFO | DrillDown modal | `GET /forecast/week/{scenario}/{week}` + `GET /audit/week/{scenario}/{week}` |
| CFO | GL mapping table | `GET /gl-mapping` |
| CFO | Scenario toggle | re-calls `GET /forecast/{scenario}` on change |
| Opco MD | OpCo selector | `GET /forecast/{scenario}/{opco}` |
| Opco MD | WIP panel | `GET /wip/{opco}` |
| Opco MD | Project table | `GET /milestones/{opco}` |
| Project Lead | Weather list | `GET /weather` |
| Project Lead | Milestones table | `GET /milestones/{opco}` |
| Project Lead | Materials chart | `GET /forecast/{scenario}/{opco}` (use d2 field) |

---

## FastAPI implementation notes

```python
# backend/api/routes/forecast.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()

@router.get("/{scenario}")
def get_forecast(scenario: str):
    if scenario not in ("base", "wet_qtr", "dry_qtr"):
        raise HTTPException(400, detail={
            "error": True,
            "code": "INVALID_SCENARIO",
            "message": f"'{scenario}' is not a valid scenario.",
            "hint": "Use: base | wet_qtr | dry_qtr"
        })
    conn = get_connection()
    rows = conn.execute(FORECAST_SQL, [scenario]).fetchdf()
    if rows.empty:
        raise HTTPException(404, detail={
            "error": True,
            "code": "FORECAST_NOT_COMPUTED",
            "message": "No forecast found. Run POST /recompute first.",
            "hint": "Run: python run.py model"
        })
    return rows.to_dict("records")


# backend/api/routes/audit.py

@router.get("/week/{scenario}/{week}")
def get_audit(scenario: str, week: int):
    if not 1 <= week <= 13:
        raise HTTPException(400, detail={
            "error": True,
            "code": "INVALID_WEEK",
            "message": f"Week must be 1–13, got {week}."
        })
    conn = get_connection()
    forecast_row = conn.execute(FORECAST_WEEK_SQL, [scenario, week]).fetchone()
    source_rows  = conn.execute(SOURCE_ROWS_SQL,   [scenario, week]).fetchdf()
    return build_audit_response(forecast_row, source_rows)
```

---

## CORS config

```python
# backend/api/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)
```