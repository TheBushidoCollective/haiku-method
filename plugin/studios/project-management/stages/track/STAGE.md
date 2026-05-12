---
name: track
description: Monitor progress, track risks, and manage issues
hats: [tracker, risk-monitor, verifier]
fix_hats: [classifier, tracker, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: plan
    discovery: project-plan
outputs:
  - discovery: status-report
    hat: tracker
---

# Track

Maintain a current, evidence-backed view of project state: actual progress against the plan baseline, the live risk register, the issue log, and any change-control requests. Track is the operational heartbeat — it runs on a cadence (weekly, bi-weekly, per sprint) and produces the inputs `report` turns into stakeholder communication.

## Per-unit baton

Each unit is a tracking surface — a work-package status entry, a risk-register row, an issue log entry, or a change-control item. The three hats walk it in `plan → do → verify` order:

- **`tracker`** (plan) collects and verifies progress data, computes planned-vs-actual variance, and identifies items off-track with named causes
- **`risk-monitor`** (do) reassesses the risk register against current conditions, monitors trigger thresholds, tracks mitigation execution, and surfaces newly-emerged risks
- **`verifier`** (verify) checks the body for currency of data, specific variance causes (not generic reasons), and named owners / target dates on open issues — advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The track stage consumes `plan/discovery/project-plan` as the baseline. Its output is `STATUS-REPORT.md`, consumed by `report` (turned into stakeholder dashboards) and `close` (the run-history that informs the retrospective).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, tracker, feedback-assessor]` dispatches per finding. The gate is `auto` — tracking runs at a high cadence and per-cycle status doesn't typically warrant a human gate; significant variance escalates via the issue log and risk register, not by blocking the track cadence. Project overlays at `.haiku/studios/project-management/stages/track/` can integrate with a specific PM tool, ticket tracker, or Gantt / timeline tool without modifying the plugin defaults.
