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

Maintain a current, evidence-backed view of project state: actual progress against the plan baseline, the live risk register, the issue log, and any change-control requests. Track is the operational heartbeat — it runs on a cadence and produces the inputs report turns into stakeholder communication.

## Scope

Progress measurement, risk monitoring, and issue management against the plan baseline. Track decides *where the project actually is versus where the plan said it would be* — not how the work was planned (plan) or how the state is communicated to stakeholders (report). Units are tracking surfaces: a work-package status, a risk-register row, an issue, a change-control item.

## What to do

- Collect and verify progress data, compute planned-vs-actual variance, and identify off-track items with named causes.
- Reassess the risk register against current conditions, monitor trigger thresholds, and surface newly emerged risks.
- Track mitigation execution and give every open issue a named owner and target date.
- Keep the data current to the cadence — stale tracking produces stale reporting.

## What NOT to do

- Don't change the plan baseline to match reality — variance is a signal to surface, not a number to erase.
- Don't shape the data into stakeholder reports; that's the report stage consuming this output.
- Don't record a generic variance cause ("behind schedule") instead of the specific one.
- Don't leave an open issue without an owner and a target date.
