# Report Stage — Execution

## Per-unit baton (`reporter → communicator → verifier`)

Every report unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating in `PROJECT-DASHBOARD.md`:

1. **`reporter` (plan):** Reads the status data from `track`, the baseline from `plan`, and the success criteria from `charter`. Picks the small set of metrics that trace to success criteria. Defines objective numeric thresholds for green / amber / red on each indicator. Builds forecasts from actual velocity (linear earned-value, re-baselined estimate, or Monte Carlo for high-uncertainty work) and shows forecast-vs-baseline delta explicitly. Structures the dashboard so headline + success criteria + health lead. Hands off when every metric traces to a charter criterion, every health indicator has an objective rule, and the forecast is computed from actuals rather than from the original plan.
2. **`communicator` (do):** Reads the reporter's dashboard. Maps audiences from the charter's stakeholder list, captures their decision needs and detail level, and tailors a report per audience that's curated from (not re-derived from) the shared dashboard. Surfaces required decisions and action items in a dedicated section near the top of each report with owner, deadline, and consequence-of-delay. Publishes the cadence map with off-cycle triggers. Hands off when every charter stakeholder has a mapped audience and cadence, every audience-specific report tells a consistent story, and decisions are surfaced explicitly.
3. **`verifier` (verify):** Reads the unit's full body. Checks accurate data sourcing, objective thresholds, forecast-vs-baseline delta visibility, and decision-callout structure per the verifier mandate. Either advances or rejects with the failing criterion named.

The hat order is `plan → do → verify` because the dashboard structure and threshold rules frame what gets tailored per audience. Tailoring per audience before the underlying signal is stable produces inconsistent stories across surfaces.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `accuracy` review agent and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, reporter, feedback-assessor]` chain dispatches per finding. Classifier routes; `reporter` re-authors the affected metric, threshold, forecast, or audience view; the assessor independently decides closure.
4. **Gate** — The gate is `ask` — local approval before the report goes to stakeholders catches data inaccuracies and tone issues.

## Reviewer guidance specific to this stage

- **Subjective health ratings** are the highest-priority finding. Without an objective threshold, the indicator color becomes a comfort dial and trend analysis becomes impossible.
- **Forecasts that equal the baseline despite tracking showing slip** are next — the project communicates false confidence at exactly the moment the data wants attention.
- **Inconsistency across audience-specific views** (executive view says green, detail view says amber) is corrosive. The single source of truth has fractured; fix the source before re-publishing surfaces.
- **Required decisions buried in narrative** stall. They need to be surfaced in a structured section near the top, with owner, deadline, and consequence-of-delay.
