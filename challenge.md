# Altis Groep Challenge — Weather-Aware Cash Flow Forecasting

> Build a working prototype that gives the Altis CFO, operating-company MDs, and project
> leads a **weather-aware 13-week cash flow forecast** and/or **role-based dashboards** —
> all built on a **single reconciled data foundation** drawn from four accounting systems.
> Not a generic BI template. A decision-support tool built for the realities of a roofing
> portfolio under private-equity governance.

---

## The Setting
**Altis Groep** is a private-equity-backed investor that buys and consolidates roofing &
construction companies in the Netherlands, with the eventual goal of transferring them to
another fund. In roofing, **weather is the single most influential factor** on when work
happens, when it gets billed, and when cash arrives — so revenue and cash flow swing, and
those swings are hard to explain to the board and the banks.

Weather thresholds that stop work on a roof:
- Above **~28 °C** → can't work
- **Rain** → can't work
- **Freezing** → can't work
- **Too windy** → can't work

The mission is to turn that reality into a **defensible, traceable forecast** the finance
team would actually open on a Monday instead of a spreadsheet.

---

## What You Receive

| Asset | What It Is |
|-------|-----------|
| **Sample data exports** (`.csv`/`.xlsx`) | Anonymised exports from each accounting system: **Gilde, Yuki, Exact, Snelstart** |
| **Chart of accounts mapping** (`.xlsx`/`.csv`) | GL account mappings across the four systems |
| **Project & WIP data** (`.csv`/`.xlsx`) | Project-level WIP, milestones, billing status |
| **Weather data** (`.csv` / API) | Historical and forecast weather relevant to roofing |
| **Covenant terms** (`.docx`/`.pdf`) | Covenant headroom thresholds and calculation rules |
| **Business context document** (`.docx`/`.pdf`) | How Altis operates, role descriptions, decision processes |

> **Data usage terms:** All Altis-provided datasets are anonymised and licensed **for this
> hackathon only**. Within **3 days after the event** you must permanently delete every copy
> from all storage (local, cloud, repos, notebooks, VMs). If in doubt, delete it.

---

## The Four Roles
The system surfaces different views depending on who is looking. Each must be specific to
**roofing and private equity** — not a generic dashboard with a different logo.

| Role | What They Need to See |
|------|----------------------|
| **PE Board** | Covenant headroom before a board meeting; consolidated portfolio view |
| **CFO** | 13-week cash flow forecast by driver; scenario toggles; cross-opco comparison |
| **Opco MD** | WIP exposure for their operating company; project-level risk signals |
| **Project Lead** | Next invoiceable milestone; materials outflows ahead of execution; schedule risk from weather |

---

## The Cash Flow Driver Model
Don't lump all cash movements together. Model **separate, independently tunable streams**.
A judge should click any forecast figure and see which drivers produced it.

| Driver | What It Represents |
|--------|--------------------|
| **Materials outflows** | Payments for roofing materials, ordered ahead of execution |
| **Subcontractor payments** | Payments tied to project progress |
| **Milestone billing** | Invoiceable milestones per project, tied to completion stage |
| **Customer payment behaviour** | Payment lag from invoice to receipt, per customer segment |
| **Weather impact** | Rain/frost → schedule delay → deferred billing and shifted outflows |

---

## The Output
- **Format:** Interactive dashboard / prototype — technology is up to you
- **Data foundation:** Reconciled from four accounting systems into **one schema**
- **Forecast horizon:** **13 weeks**, week-by-week
- **Scenarios:** **Base / wet-quarter / dry-quarter** — toggle cleanly, affect the right
  downstream numbers
- **Traceability:** Every forecast number traces back to its drivers; every assumption traces
  back to the toggle that produced it
- **Not a mockup** — a functional system that processes real or realistic data and produces
  defensible outputs

---

## Challenge Tiers
Depth beats breadth — a serious answer to one role outperforms a surface pass at all four.

### Tier 1 — CFO Dashboard (baseline)
Single-role 13-week cash flow forecast for the CFO, from **at least one** accounting system.

**Required:**
- Data ingestion from ≥1 accounting system
- Basic driver separation — materials, subcontractors, billing as distinct categories
- 13-week forecast view with week-by-week projections
- Covenant headroom indicator — flagged near threshold
- Scenario toggle — at minimum a base scenario, adjustable key assumptions
- Traceability — any figure traced back to source data and assumptions

**Bonus:** weather as a simple multiplier · a 2nd system reconciled into the same schema ·
payment-lag modelling as a separate driver

### Tier 2 — Multi-Role Dashboard
Two+ roles (**CFO + Opco MD** minimum), **3+** accounting systems, meaningful
weather-to-schedule translation.

**Required:**
- Everything from Tier 1 for the CFO
- **Opco MD view:** WIP exposure, project-level risk signals, subcontractor/materials commitments
- Multi-system reconciliation (3+ systems → one schema)
- **Weather-to-schedule translation:** not a flat multiplier — a model that turns weather
  delays into shifted billing and outflows
- Three scenarios: base / wet-quarter / dry-quarter affecting the right downstream numbers

**Bonus:** LLM-assisted GL account mapping (controller-reviewable) · Project Lead view with
next invoiceable milestone and schedule risk

### Tier 3 — Full Forecast Platform
All four roles, complete driver model, LLM-assisted GL mapping, architectural resilience.

**Required (per role):** everything from Tier 2 expanded to **all four roles**; **full five-driver
model**, independently tunable; driver model **survives edge cases** (new GL account, late
correction journal, slipping project); **LLM-assisted GL mapping** (auditable, controller-reviewable);
**new opco onboarding** as a config change, not a rebuild.

**Required (platform level):**
- Logical architecture separating: **ingestion → reconciliation → driver modelling →
  scenario generation → role-based presentation**
- One schema, one source of truth, feeding all roles
- Full auditability: click any figure → drivers → assumption → toggle → source data
- Documentation a controller can understand and adjust without the build team

---

## Deliverables
1. Data ingestion from ≥1 accounting system, reconciled into a unified schema
2. 13-week cash flow forecast, week-by-week, separated by driver streams
3. Covenant headroom indicator — flagged when approaching threshold
4. Scenario toggle (base / wet-quarter / dry-quarter) affecting the right downstream numbers
5. Traceability: any forecast figure → its drivers and source data
6. **README** with run instructions and architecture overview

---

## How It's Judged — 100 pts

**Challenge-Specific (60)**
| Criterion | Pts | What Matters |
|-----------|-----|--------------|
| Impact & Relevance | 24 | Solves a real weekly finance decision; would the CFO open this Monday instead of a spreadsheet? Addresses unspoken operational realities. |
| Technical Depth | 19 | Works end-to-end; survives edge cases; multiple systems reconcile into one schema. |
| Auditability | 17 | Controller can trace any number → drivers → assumption → toggle → source. Defensible to the board. |

**Overall Execution Quality (30)** — UX (8) · Documentation (6) · Polish (5) ·
Setup & Onboarding (4) · Reproducibility & Code Quality (4) · Deployment Readiness (3)

**Innovation Bonus (10)** — fresh ideas that *add value*, not just novelty. A creative idea
that ignores the requirements scores low.

> The per-challenge rubric weights it as: **Impact & Relevance 40% · Technical Depth 32% ·
> Auditability 28%.**

---

## Our Approach (working notes)
A pipeline aligned to the Tier-3 architecture — start at Tier 1 and extend.

**1. Ingestion → reconciliation (one schema)**
- Adapters per system (Gilde, Yuki, Exact, Snelstart) normalising to a common ledger schema.
- Apply the GL chart-of-accounts mapping; flag unmapped/new accounts for controller review
  (LLM-assisted *suggestions*, human-approved — never silent).
- Handle **Dutch GAAP & VAT** correctly: WIP / *periodisering*, BTW treatment.

**2. Weather → workable days**
- Pull historical + forecast weather (KNMI / Open-Meteo) for the relevant regions.
- Engineer **"workable day"** features from the thresholds (>28 °C, rain, freeze, high wind).
- Translate lost working days into **shifted milestone billing and outflows** — not a flat
  multiplier.

**3. Driver model (five independent streams)**
- Materials outflows, subcontractor payments, milestone billing, customer payment behaviour,
  weather impact — each independently tunable, each contributing traceably to weekly cash.
- Model **payment lag** explicitly (invoice → receipt) per customer segment.

**4. Scenario engine**
- Base / wet-quarter / dry-quarter toggles re-run the weather-impact and downstream billing
  streams, leaving an auditable assumption trail.

**5. Role-based presentation**
- One source of truth feeds all role views (Board / CFO / Opco MD / Project Lead) — no two
  numbers disagreeing.
- **Drill-down everywhere:** click a forecast figure → see contributing drivers → the
  assumption → the toggle → the source rows.

**Suggested stack (illustrative — judged on results, not tools):** Python (`pandas`,
`statsmodels`/`scikit-learn`) for reconciliation + forecasting; a unified data layer
(DuckDB/Postgres) for the schema; a dashboard layer (Streamlit / Recharts / D3); optional LLM
for GL-mapping suggestions. Deployment path should be realistic on Altis's existing stack —
no re-platforming.

---

## Pre-Submission Checklist
- [ ] Data from ≥1 accounting system ingested and reconciled
- [ ] Cash flow drivers modelled as separate streams (not lumped)
- [ ] 13-week forecast view, week-by-week
- [ ] Covenant headroom flagged near threshold
- [ ] Scenario toggle works (at minimum base)
- [ ] Any forecast figure traces back to drivers and source data
- [ ] Role views are roofing/PE-specific, not generic BI
- [ ] Weather affects **timing** meaningfully (not a flat multiplier)
- [ ] Architecture absorbs a new GL account / late correction without breaking
- [ ] VAT & Dutch GAAP handled correctly (WIP, periodisering)
- [ ] Same source of truth feeds forecast **and** dashboard
- [ ] Demo includes a controller-level audit-trail walkthrough
- [ ] Deployment path realistic on Altis's stack
- [ ] README with run instructions included
