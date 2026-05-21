---
name: mitigate
description: Apply immediate fixes to stop the bleeding — rollbacks, feature flags, scaling
hats: [mitigation-planner, mitigator, verifier]
fix_hats: [classifier, mitigator, feedback-assessor]
review: [ask, await]
elaboration: collaborative
inputs:
  - stage: investigate
    discovery: root-cause
---

# Mitigate

Stop user-facing impact as fast as safely possible. Mitigation is not the permanent fix — it returns the system to acceptable behavior while resolve builds the proper fix on a calmer timeline. It runs in parallel with investigate: a known-safe mitigation doesn't wait for a confirmed root cause, as long as the action names the hypothesis it's acting on.

## Scope

Restoring acceptable behavior with reversible actions: rollbacks, feature-flag flips, scaling, load shedding, traffic draining. Mitigate decides *how to stop the bleeding now* — not why it's bleeding (investigate) or how to fix it for good (resolve). Its moves are temporary by design and meant to be undone once resolve lands.

## What to do

- Prefer reversible, known-safe actions; name the hypothesis each mitigation targets and the signal that will confirm it worked.
- Record every action — the exact change, the timestamp, and the rollback procedure — as you go.
- Watch the verification signal; a non-recovering signal means the hypothesis was wrong, not that you should escalate the same move.
- Require an explicit acknowledgment that user-facing impact has actually stopped before calling the incident mitigated.

## What NOT to do

- Don't build the permanent fix or ship the regression test — that's resolve; mitigation is the holding action.
- Don't redo the diagnosis; consume investigate's working hypothesis.
- Don't apply an irreversible change as a mitigation when a reversible one exists.
- Don't leave a mitigation in place without recording which hypothesis it's holding back, or resolve can't clean it up safely.
