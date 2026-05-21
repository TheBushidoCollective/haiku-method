---
name: report
description: Create stakeholder updates and project dashboards
hats: [reporter, communicator, verifier]
fix_hats: [classifier, reporter, communicator, feedback-assessor]
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

Turn raw tracking data into stakeholder-ready communication: an executive dashboard, role-tailored status reports, and clearly surfaced decisions or escalations that need action. Report is downstream of track — its accuracy depends entirely on tracking quality, and its job is to present that data faithfully, not to reinterpret it.

## Scope

Dashboards, audience-tailored status reports, forecasts, and decision/escalation callouts. Report decides *how project state is communicated and to whom* — not what the underlying state is (track), what the plan was (plan), or what success means (charter). Units are reporting surfaces: a dashboard panel, a role-specific report, a forecast, an escalation.

## What to do

- Pick metrics and objective health thresholds, and forecast from actual velocity rather than the original plan.
- Tailor the content for each audience — executive, sponsor, team lead, dependent team — and set the cadence and channel per group.
- Surface required decisions and action items explicitly so stakeholders know what's being asked of them.
- Source every figure to the tracking data so presentation never drifts from reality.

## What NOT to do

- Don't invent or adjust the underlying numbers — report presents what track recorded; a data problem is a revisit to track.
- Don't accept or close deliverables; that's the close stage.
- Don't use a subjective health indicator where an objective threshold applies.
- Don't let presentation drift from the source data, or omit a decision the data demands.
