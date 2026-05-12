---
name: mitigate
description: Apply immediate fixes to stop the bleeding — rollbacks, feature flags, scaling
hats: [mitigator, verifier]
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

Each mitigate unit walks `mitigator → verifier` in order. A unit here is one mitigation action — one rollback, one flag flip, one scaling operation, one traffic redirect:

- **`mitigator`** (plan + do) chooses the fastest reversible action that addresses the hypothesized cause, names the exact commands or config changes, applies them, and documents what changed. The baton: a `MITIGATION-LOG.md` slice with the action, the exact change applied, the timestamp, and the rollback procedure for the mitigation itself.
- **`verifier`** (verify) confirms the mitigation actually stopped user-facing impact by measuring the same signals that detected the incident, waits long enough for metrics to stabilize, and checks for side effects introduced by the mitigation. Advances or rejects to the responsible hat.

This stage runs `plan → do → verify` with `mitigator` carrying the plan-and-do roles because a separate planner step adds latency during an active incident; the planning and the action are tightly coupled and live in the same head.

## Inputs and outputs

Consumes `investigate/root-cause` — the working hypothesis and supporting evidence. The mitigate stage does not block on a confirmed root cause if a known-safe mitigation is available against the hypothesis, but the log records which hypothesis the mitigation acted on so that a wrong hypothesis can be detected from a non-recovering signal. Produces `MITIGATION-LOG.md` recording every action attempted, what changed, when, and the verification signal that proved (or refuted) recovery.

## Fix loop and gate

When review feedback opens against a mitigation action, `fix_hats: [classifier, mitigator, feedback-assessor]` dispatches per finding. The gate is `[ask, await]` — the user chooses between a fast local approval (because mitigation success is the canonical "incident over" moment and a human typically signs off explicitly) or `await` to block on an external event (e.g., a status-page resolution post, regulatory clock closure). Both paths require an explicit acknowledgment that user-facing impact has stopped.
