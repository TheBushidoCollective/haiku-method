---
title: 'RT (HIGH): THREAT-MODEL.md §5 fabricates the drift-gate kill-switch identifier'
status: rejected
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-05-03T09:16:03Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-03T09:16:03Z'
resolution: inline_fix
replies: []
---

## Finding

**THREAT-MODEL.md §5** ("guard-workflow-fields PreToolUse-bypass class") names the drift-detection kill-switch as the env var `HAIKU_DRIFT_DETECTION=0`:

> "if the drift-detection gate is disabled (via `HAIKU_DRIFT_DETECTION=0` or operator kill-switch), the compensating control evaporates and the agent's Bash bypass becomes silent."

This identifier does not exist in the codebase. The actual kill-switch is a settings.json field — `settings.drift_detection === false` — checked in `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:5` and emits telemetry `haiku.drift.gate.kill_switch_hit` (line 403).

## Evidence

```
$ grep -rn 'HAIKU_DRIFT_DETECTION' packages/
(no match — env var does not exist)

$ grep -nE 'drift_detection|kill[_-]switch' packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
5://       1. Checks the kill-switch (`settings.drift_detection === false` → no-op).
403:		emitTelemetry("haiku.drift.gate.kill_switch_hit", { ...gateAttrs(ctx) })
```

## Severity

**HIGH** — the threat model is supposed to be the operator's reference for what is and isn't a compensating control. An operator reading §5 looks for an env-var override that doesn't exist; the actual settings.json toggle goes unmonitored. The "operator-alert if the kill-switch is enabled" deferred residual recommended in ASSESSMENTS.md cannot be implemented against the wrong identifier — anyone scaffolding the alerting will wire it to the non-existent env var and miss every actual disable event.

## Required fix

THREAT-MODEL.md §5 must replace `HAIKU_DRIFT_DETECTION=0` with `settings.drift_detection === false` and reference the real telemetry signal `haiku.drift.gate.kill_switch_hit`. Cross-check ASSESSMENTS.md §4 / FB-08 references for the same drift.

## Why this matters for unit-04 specifically

This is unit-04's synthesis layer. The whole point of the threat model is to be the load-bearing reference next-wave reviewers trust. A wrong control identifier in §5 is exactly the class of error this hat (red-team on the synthesis artifacts) exists to catch.

---

**Rejection reason:** stale — the flagged artifact .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md does not exist on the security stage branch this fix chain forked from. The file was authored on commit 31f9a4850 on the haiku/out-of-band-human-file-modifications/unit-04-threat-model-and-assessments branch, which has not yet been merged into haiku/out-of-band-human-file-modifications/security. The fix-security-FB-11 worktree (forked from security stage branch HEAD = cf782a2b9) contains no artifacts/ directory under stages/security/. The finding itself is technically correct (HAIKU_DRIFT_DETECTION env var does not exist; the real kill-switch is settings.drift_detection === false at packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:5 with telemetry haiku.drift.gate.kill_switch_hit at line 403), but it cannot be applied here without engine-prohibited manual git operations (cherry-pick / hand-merge of the unit-04 branch). Per .claude/rules/no-engine-shortcuts.md the workflow engine must merge unit-04 into the security stage branch before red-team findings on its artifacts can be dispatched as review_fix; once that ordering is fixed, re-running the red-team will resurface this same finding against the actual artifact and the fix can land in one line edit on THREAT-MODEL.md §5.
