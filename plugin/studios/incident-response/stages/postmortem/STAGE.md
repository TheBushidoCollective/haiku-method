---
name: postmortem
description: Document timeline, root cause, action items, and prevention measures
hats: [postmortem-author, action-item-tracker, verifier]
fix_hats: [classifier, postmortem-author, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: resolve
    discovery: resolution-summary
---

# Postmortem

Convert the incident into organizational learning. The investigation produced the diagnosis; the resolve stage built the fix; the postmortem stage tells the full story — what happened, how it was detected, how it was responded to, why it happened, and what concrete changes will reduce the likelihood or impact of the next incident in this class. The postmortem is blameless by design: humans operate inside systems, and the systemic gaps that allowed the failure are the subject. Naming individuals as the cause produces fear, not improvement.

## Per-unit baton

Each postmortem unit walks `postmortem-author → action-item-tracker → verifier` in order. A unit here is one postmortem section or capability — the consolidated narrative, the detection-and-response analysis, the action-item list, the prevention-measures plan:

- **`postmortem-author`** (plan + do) writes the narrative — timeline, detection story, response story, root cause, contributing factors. The baton: a `POSTMORTEM-DOCUMENT.md` slice with the section drafted, evidence cited, and the systemic gaps named.
- **`action-item-tracker`** (do — owner extraction) reads the narrative, extracts concrete follow-up actions with named owners, priorities, and tracking references, and ensures each action is filed into the team's existing work management system rather than living only in the document. The baton: an action-item table appended to the section, with each item bound to an owner and a tracking reference.
- **`verifier`** (verify) checks the section against the stage's body-level rules — blameless framing, timeline completeness, action items specific and owned, prevention measures address systemic gaps not just the instance. Advances or rejects to the responsible hat.

## Inputs and outputs

Consumes `resolve/resolution-summary` — the permanent fix details, regression-test references, and mitigation-cleanup plan. Implicitly consumes upstream artifacts as well (the incident brief, the root-cause analysis, the mitigation log) because the narrative spans the full lifecycle. Produces `POSTMORTEM-DOCUMENT.md` — the consolidated story, action items, and prevention measures that go to engineering, leadership, and (where appropriate) customers.

## Fix loop and gate

When review feedback opens against a section, `fix_hats: [classifier, postmortem-author, feedback-assessor]` dispatches per finding. The author re-owns corrections because the narrative is author-scope. The gate is `external` because the postmortem is a public artifact that goes through formal review (engineering review, leadership review, sometimes customer or regulator review depending on the incident class) — the workflow blocks until the external review system signals approval, typically via a merge or sign-off action in the team's docs platform.
