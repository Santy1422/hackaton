# Challenge 2 — Roofing/Construction: Weather-Driven Revenue Insight

## Challenger
A **digital finance guide / CFO-type** from Alta's group, self-described as the least technical person in the room ("still proud I transitioned from `VLOOKUP` to `XLOOKUP`"). He works for an **investor company that buys and consolidates roofing & construction companies in the Netherlands**, with the eventual goal of transferring them to another fund. He's based in Haarlem.

## The Problem
Reporting matters more than ever to stakeholders, banks, and investors — but in roofing/construction, **weather is the single most influential factor** on revenue:

- Above **28 °C** → can't work
- **Rain** → can't work
- **Freezing** → can't work
- **Too windy** → can't work

As a result, **revenue swings up and down**, and it's hard to explain *why* to investors. When asked "why is revenue down year-over-year?", the management answer is essentially *"have you seen the weather?"* — which isn't a defensible reporting narrative.

## The Data
- ~**3.5 years of revenue data** uploaded.
- The data is **"shitty"**: it's **lagging** and **nowhere near real-time invoicing**.
- Effectively a **blank sheet** — the challenger left it open: *"up to you what you make out of it."*

## The Goal
Help the CFO **better understand how weather impacts revenue**, specifically to:

1. **Quantify** the weather → revenue relationship.
2. **Forecast** revenue using weather as an input.
3. **Isolate** the weather effect from other factors such as:
   - **Pricing**
   - **Labor capacity**
4. Produce an **explainable story** he can tell investors and banks ("revenue dipped X% because of N lost working days due to weather, not because of pricing/demand").

## Solution Sketch

### 1. Get weather data
- Pull historical daily weather for the relevant Dutch regions (e.g. **KNMI** open data, or an API like Open-Meteo).
- Engineer **"workable day" features** from the stated thresholds:
  - `temp > 28°C` → non-workable
  - `precipitation > 0` (or a threshold) → non-workable
  - `temp <= 0°C` (freezing) → non-workable
  - `wind > X` → non-workable
- Aggregate to **workable days per period** (week/month) per region.

### 2. Align with revenue (handle the lag)
- The revenue data lags invoicing, so **align timeframes carefully** — model the lag explicitly (e.g. weather in month *t* → revenue recognized in month *t+1/t+2*).
- Normalize revenue per period.

### 3. Model & isolate factors
- Regression / time-series model with weather (workable days) as a key driver, **controlling for**:
  - Pricing changes
  - Labor capacity (headcount / available crews)
  - Seasonality and trend
- Use the model to **attribute** revenue variance: how much is weather vs. price vs. capacity.
- Consider explainable methods (linear/GLM coefficients, or SHAP values on a tree model) so the output is **investor-friendly**, not a black box.

### 4. Forecast
- Combine historical weather climatology (or seasonal forecasts) with the fitted model to **project revenue** and give ranges/confidence bands.

### 5. Deliver an explainable narrative
- A dashboard or report that says, e.g.:
  > "Q2 revenue was down 12% YoY. Weather accounts for ~9 pts (18 fewer workable days), pricing +2 pts, labor capacity −5 pts."
- This is exactly the **defensible, weather-isolated explanation** the CFO needs for investors and banks.

### Suggested tech approach
- **Python** (`pandas`, `statsmodels`/`scikit-learn`) for modeling.
- Weather ingestion from **KNMI / Open-Meteo**.
- Explainability via regression coefficients or **SHAP**.
- A simple **Power BI / Streamlit dashboard** for the narrative + forecast.
- Be transparent about **data quality limits** (lagging, non-real-time invoicing) in confidence intervals.

## Key success criteria
- Clear, **quantified** weather→revenue relationship.
- Ability to **isolate** weather from pricing & labor capacity.
- A **forecast** with honest uncertainty.
- An **explainable story** a non-technical CFO can present to investors.

## One-line summary
> Turn 3.5 years of lagging revenue data plus historical weather into a model that quantifies, isolates, and forecasts the weather effect on revenue — giving a non-technical CFO a defensible, investor-ready explanation for revenue swings.
