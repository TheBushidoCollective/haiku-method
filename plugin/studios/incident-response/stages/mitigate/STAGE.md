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

Stop user-facing impact as fast as safely possible. Mitigation is not the permanent fix — it's the action that returns the system to acceptable behavior while the resolve stage builds the proper fix on a calmer timeline. Common mitigation moves are reversible by design: roll back a deploy, flip a feature flag off, scale a resource up, shed load, drain traffic from a failing region. The mitigate stage runs in parallel with investigate; you do not need a confirmed root cause to apply a known-safe mitigation, but you must name what hypothesis the mitigation is acting on and what signal will confirm it worked.

## Per-unit baton

- `mitigation-planner` → `mitigator`: chosen mitigation action + hypothesis it targets + verification signal + rollback procedure.
- `mitigator` → `verifier`: `MITIGATION-LOG.md` slice (action, exact change, timestamp, rollback procedure).

## Inputs and outputs

Consumes `investigate/root-cause` — the working hypothesis and supporting evidence. The mitigate stage does not block on a confirmed root cause if a known-safe mitigation is available against the hypothesis, but the log records which hypothesis the mitigation acted on so that a wrong hypothesis can be detected from a non-recovering signal. Produces `MITIGATION-LOG.md` recording every action attempted, what changed, when, and the verification signal that proved (or refuted) recovery.

## Fix loop and gate

When review feedback opens against a mitigation action, `fix_hats: [classifier, mitigator, feedback-assessor]` dispatches per finding. The gate is `[ask, await]` — the user chooses between a fast local approval (because mitigation success is the canonical "incident over" moment and a human typically signs off explicitly) or `await` to block on an external event (e.g., a status-page resolution post, regulatory clock closure). Both paths require an explicit acknowledgment that user-facing impact has stopped.
