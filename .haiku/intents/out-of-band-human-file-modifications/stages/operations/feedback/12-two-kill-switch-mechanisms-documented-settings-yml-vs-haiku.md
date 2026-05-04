---
title: >-
  Two kill-switch mechanisms documented (settings.yml vs
  HAIKU_DRIFT_GATE_DISABLED env) — env form is fake
status: rejected
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-02T05:32:02Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:32:02Z'
resolution: null
replies: []
---

## Finding

`.haiku/knowledge/RUNBOOK.md` documents the drift-gate kill-switch in two different and inconsistent forms:

**Real form** (works) — scenarios 2, 4, 9, 10 + `plugin/README.md`:
- `drift_detection: false` in `.haiku/settings.yml`, read by `isDriftDetectionDisabled(haikuRoot)` at `drift-baseline.ts:723`. Verified:

```
$ grep -rn "isDriftDetectionDisabled\|drift_detection" packages/haiku/src/orchestrator/workflow/drift-baseline.ts
723:export function isDriftDetectionDisabled(haikuRoot: string): boolean {
729:    return (data as Record<string, unknown>).drift_detection === false
```

**Fake form** (no-op) — runbook lines ~608, 695-715 (entire `kill-switch-engaged` scenario):
- `HAIKU_DRIFT_GATE_DISABLED=1` env var. Does not exist:

```
$ grep -rn "HAIKU_DRIFT_GATE_DISABLED" packages/haiku/src/
(no output)
```

The `kill-switch-engaged` runbook scenario (lines 693-720) tells the operator: `env | grep HAIKU_DRIFT`, `unset HAIKU_DRIFT_GATE_DISABLED`, "Restart MCP. Next tick should emit `haiku.drift.gate.tick` instead of `kill_switch_hit`." None of this works because the env var is never read. The `drift-gate-availability-burn` scenario (line 608) similarly says: "consider engaging kill switch to stop the budget bleed while you investigate (`HAIKU_DRIFT_GATE_DISABLED=1`)." Pasting that into a shell sets a no-op env var; the gate keeps burning.

Compounded by alerts.yaml line 165 (`kill-switch-engaged` rule), which fires on `haiku.drift.gate.kill_switch_hit` — that telemetry IS emitted (gate.ts:403), but only when `settings.yml` flips it. Operators reading the alert will be routed to the runbook section that tells them to set the wrong env var.

## Why this is a security finding (mandate: no insecure defaults)

The kill-switch is the universal rollback for the drift-detection gate. It is also documented as the rollback for the privacy-adjacent burn-rate alerts (`drift-availability-fast-burn`, `drift-availability-slow-burn`). During an incident — including a privacy incident where the operator wants to immediately stop emitting drift-related telemetry — pasting the documented env-var command leaves the gate running. The operator believes they've engaged a safety mechanism; they have not. This is the textbook "insecure default": a security control that appears engaged but is functionally absent.

## Spirit of the mandate

Operations stage owns "the user reaches for when something fires unexpectedly … or when the gate needs to be turned off fast" (unit-01 scope). Two contradictory kill-switch mechanisms in the same runbook is the worst possible state — the operator who consults the env-var section first will not consult the settings.yml section. The mandate "no insecure defaults" extends to incident-response controls; a half-broken kill-switch IS an insecure default.

## Fix shape (suggestion, do not implement here)

Either:
1. Implement the env-var form in `drift-baseline.ts:isDriftDetectionDisabled` (env beats settings, both honored), OR
2. Delete the entire `kill-switch-engaged` scenario from RUNBOOK.md and rewrite the `drift-availability-fast-burn` rollback step to reference the real settings.yml form. Update alerts.yaml `kill-switch-engaged` runbook anchor accordingly.

Path (2) is preferred because adding a second kill-switch mechanism inflates the surface; a single source of truth (settings.yml) is what `plugin/README.md` already commits to.

## Refs

- `.haiku/knowledge/RUNBOOK.md:608, 693-720` (fake env-var kill-switch)
- `.haiku/knowledge/RUNBOOK.md:53-69` (real settings.yml kill-switch, scenario 2)
- `plugin/README.md:101-113` (real settings.yml kill-switch, only documented form)
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:718-731` (`isDriftDetectionDisabled` only reads settings.yml)
- `deploy/operations/drift-detection-alerts.yaml:157-166` (alert routes operators to broken section)

---

**Rejection reason:** Duplicate of FB-01. Both findings flag the same root cause: RUNBOOK.md and alerts.yaml reference HAIKU_DRIFT_GATE_DISABLED env var as the kill-switch, but the actual implementation is `drift_detection: false` in .haiku/settings.yml (per isDriftDetectionDisabled in drift-baseline.ts). FB-01 (reliability) will drive the fix; rejecting this security-lens duplicate prevents a redundant fix-loop dispatch. The credential-shaped PII keys finding (FB-14) is a separate, in-scope security finding that survives.
