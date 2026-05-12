---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the adoption plan is evidence-based, tied to a business outcome, and measurable. Adoption plans that drift toward feature-pushing or vanity metrics show up as renewal-time disputes about whether the customer ever got value — this lens stops that drift at the stage where it starts.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **Outcome chain present and cited** — Every adoption play in `USAGE-REPORT.md` connects to a business outcome (cycle time, error rate, deal velocity, support volume, named KPI) with a cited source from the customer side. A play with no cited business outcome is a feature pitch.
- **Targets are measurable** — Every play declares a baseline, a target, a leading indicator, and an anti-metric. Each is named with a precise metric definition and a time window. Loose targets ("more usage", "better engagement") block downstream measurement.
- **Measurement matches the declared targets** — The analyst's measurement table uses the same metric definition, window, and segment the coach declared. Any drift between declared targets and measured targets is a finding.
- **Segmentation surfaces the bottleneck** — Flat rollup numbers without a segmentation cut (team, role, workflow stage, cohort, time) hide where the play is or is not landing.
- **Anti-metric is read, not skipped** — A play that hits the target with the anti-metric blowing up is not green overall. Reports that silently omit the anti-metric reading get a finding.
- **Sequencing matches dependency, not feature catalog** — Enablement steps that go in feature order rather than dependency order signal the play is feature-pushing.

## Common failure modes to look for

- A `USAGE-REPORT.md` whose targets are framed as activity ("users see the feature") rather than outcome ("users complete the workflow that the feature enables")
- A target metric and a measurement-table metric that read similarly but are subtly different definitions or windows
- A leading indicator that's just the lagging target with a different name
- A segmentation cut that's shown but doesn't actually point at a bottleneck — segmentation as decoration, not diagnosis
- An anti-metric that's named but never read in the measurement table
- An enablement plan with seven-plus steps that should have been split into multiple units
- An interpretation paragraph that prescribes the next play instead of describing what the data shows
