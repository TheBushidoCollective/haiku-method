---
name: report
description: Create stakeholder updates and project dashboards
hats: [reporter, communicator, verifier]
fix_hats: [classifier, reporter, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: track
    discovery: status-report
  - stage: plan
    discovery: project-plan
  - stage: charter
    discovery: project-charter
outputs:
  - discovery: project-dashboard
    hat: communicator
---

# Report

Turn raw tracking data into stakeholder-ready communication: an executive dashboard, role-tailored status reports, and clearly-surfaced decisions or escalations needing action. Report is downstream of `track` — accuracy here depends entirely on tracking quality upstream, and the verifier's job is to catch the cases where presentation has drifted from the underlying data.

## Per-unit baton

Each unit is a reporting surface — a dashboard panel, a role-specific status report (executive, sponsor, team lead, dependent team), a forecast view, or a decision/escalation callout. The three hats walk it in `plan → do → verify` order:

- **`reporter`** (plan) designs the visualization, picks the metrics and objective health thresholds, and forecasts based on actual velocity (not the original plan)
- **`communicator`** (do) tailors the content for each audience, surfaces required decisions and action items, and sets the cadence / channel for each stakeholder group
- **`verifier`** (verify) checks the body for accurate data sourcing, objective (not subjective) health indicators, and explicit action-item callouts — advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The report stage consumes `track/discovery/status-report` (the data), `plan/discovery/project-plan` (the baseline), and `charter/discovery/project-charter` (the success criteria). Its output is `PROJECT-DASHBOARD.md`, consumed by `close` (the run of dashboards becomes the project history) and by stakeholders directly.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, reporter, feedback-assessor]` dispatches per finding. The gate is `ask` — local approval before the report goes to stakeholders catches data inaccuracies and tone issues. Project overlays at `.haiku/studios/project-management/stages/report/` may add audience-specific templates, branded dashboard layouts, or integration with a specific reporting tool without modifying the plugin defaults.
