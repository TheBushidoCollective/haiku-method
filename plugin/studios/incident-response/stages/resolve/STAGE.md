---
name: resolve
description: Implement permanent fix with proper testing and review
hats: [engineer, reviewer, verifier]
fix_hats: [classifier, engineer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: mitigate
    discovery: mitigation-log
---

# Resolve

Build the permanent fix. Mitigate stopped the bleeding with a reversible action; investigate produced the root cause. Resolve lands the code or system change that actually addresses that cause, ships a regression test that would have caught the incident, and plans the removal of the temporary mitigation once the fix is verified.

## Scope

The durable fix and its safety net: the change that addresses the root cause, a regression test that fails without it, a deployment plan, the mitigation-cleanup plan, and a check for the same defect class elsewhere. Resolve decides *how the incident is fixed for good* — not why it happened (investigate) or how impact was stopped in the moment (mitigate).

## What to do

- Address the diagnosed root cause itself, not the symptom the mitigation papered over.
- Ship a regression test that fails without the fix — proof it would have caught this incident.
- Plan the deployment with rollback criteria and a plan to remove the temporary mitigation once verified.
- Check whether the same class of defect exists elsewhere; a one-instance patch leaves the weakness for the next surface.

## What NOT to do

- Don't rely on the mitigation as the fix — it's a holding action that resolve is meant to retire.
- Don't redo the diagnosis or re-litigate the root cause; consume investigate's output.
- Don't land a fix without a regression test that proves it.
- Don't patch the single instance and walk away from the broader defect class.
