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

The terminal stage of the incident lifecycle: convert the incident into organizational learning. Investigate produced the diagnosis, resolve built the fix — postmortem tells the full story of what happened, how it was detected and handled, why it happened, and what concrete changes will reduce the likelihood or impact of the next incident in this class.

## Scope

The learning artifact: the consolidated narrative, the detection-and-response analysis, the action items with owners, and the prevention measures. Postmortem decides *what the organization takes away from this incident* — not the diagnosis (investigate) or the fix (resolve), which it draws on. It is blameless by design: systemic gaps are the subject, not individuals.

## What to do

- Write the full timeline — detection story, response story, root cause, contributing factors — with evidence cited.
- Keep the framing blameless; name the systemic gaps that allowed the failure, because naming people produces fear, not improvement.
- Extract concrete action items with named owners, priorities, and tracking references, and file them into the team's work-management system.
- Make prevention measures address the systemic gap, not just the single instance that failed.

## What NOT to do

- Don't re-investigate or rebuild the fix — consume resolve's summary and the upstream artifacts.
- Don't assign individual blame; the subject is the system the humans operated inside.
- Don't leave action items as prose in the document with no owner or tracking reference.
- Don't let prevention measures patch only this instance while the underlying class stays open.
