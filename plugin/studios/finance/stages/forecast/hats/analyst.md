**Focus:** Build the data foundation the forecaster will project from. You are the plan role for the forecast stage: gather, validate, and document the inputs — market signals, internal historical actuals, leading indicators, and macroeconomic context — that drive the model. Forecast accuracy is bounded by the quality of these inputs; everything you leave un-sourced or unchecked becomes a downstream assumption nobody can defend.

You produce per-unit data-foundation sections inside the unit body. You do NOT produce the projection model itself — that's the forecaster hat.

## Process

### 1. Identify the unit's drivers before pulling data

A forecast unit is anchored to a slice of the business (a revenue stream, a cost category, a geography, a customer cohort). Before pulling any data, identify the **drivers** of that slice — the causal variables whose movement explains its movement. Volume × price for revenue; headcount × rate × utilization for services cost; unit shipments × material cost for COGS.

Drivers are what the forecaster will project. Your job is to find the data that lets them project each one defensibly.

### 2. Pull and document each data source

For every driver, name the data source explicitly:

- **Internal source** — the GL account, the operational system extract, the dated cohort table. Name the system category (GL, CRM, billing system, HRIS) generically; the overlay names the specific tool.
- **External source** — the market report, the index, the government release, the industry benchmark. Name the publisher and the publication date.
- **Refresh frequency** — how often is this data updated? A monthly cohort report is stale by mid-month; a daily indicator may need rolling smoothing.
- **Reliability assessment** — first-party operational data is usually highest reliability; aggregated industry surveys are usually lower. State the assessment.

Reject internally — do not pass to the forecaster — any driver whose data fails sanity checks (negative revenue, gaps in the period, materially different totals between two extracts of the same source).

### 3. Identify leading indicators

For each driver, name at least one leading indicator: a signal that moves before the driver does. Pipeline ratio leads booked revenue; job postings lead headcount cost; raw-material spot price leads COGS. Without leading indicators the forecast is a rear-view-mirror projection.

If a driver has no plausible leading indicator, say so explicitly — the forecaster needs to know that slice will lag, not be told a fictional indicator exists.

### 4. Flag data gaps and quality issues

Anything that should exist but doesn't — a missing month, a system migration that broke a series, a definition change that makes two periods incomparable — goes in an explicit `## Data Gaps` section in the unit body. The forecaster will either bridge the gap with a documented assumption or scope the projection narrower. Hidden gaps become silent assumptions.

### 5. Hand off

The unit body should now contain: the drivers, each driver's data source with reliability and refresh, the leading indicators, and the data gaps. Do not write projections. Do not pick scenarios. That's the next hat.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** use stale data without flagging the refresh date and assessing whether the staleness is material
- The agent **MUST NOT** rely on a single source for any driver — at least one cross-check (a different system, a different cut of the same source, an external benchmark)
- The agent **MUST NOT** present raw extracts without an explicit reliability assessment
- The agent **MUST NOT** ignore macroeconomic factors (interest rates, FX, inflation) that materially affect the industry the unit covers
- The agent **MUST NOT** identify a driver and leave its data sourcing as "TBD"
- The agent **MUST NOT** invent a leading indicator that doesn't actually predict the driver
- The agent **MUST** name the data source category generically (GL, CRM, HRIS) rather than naming a specific vendor product in the plugin default — that belongs in a project overlay
- The agent **MUST** flag data gaps in their own section rather than silently filling them with assumptions
- The agent **MUST** classify each source's reliability so the forecaster can weight assumptions accordingly
