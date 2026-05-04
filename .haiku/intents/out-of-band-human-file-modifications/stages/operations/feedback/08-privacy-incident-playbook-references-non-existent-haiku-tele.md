---
title: >-
  Privacy-incident playbook references non-existent HAIKU_TELEMETRY_DISABLE —
  leak-stop is a no-op
status: closed
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-02T05:31:38Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-08:bolt-2'
bolt: 2
triaged_at: '2026-05-02T05:31:38Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: ops-engineer
    completed_at: '2026-05-02T05:53:26Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-05-02T05:55:10Z'
    result: closed
---
## Finding

`.haiku/knowledge/RUNBOOK.md:583` (scenario `pii-deny-list-strip`, "Escalation") instructs operators during a confirmed privacy incident to:

> "stop telemetry export (`HAIKU_TELEMETRY_DISABLE=1`), page security, and audit the OTLP backend's last 24h of events for the leaked keys."

There is no `HAIKU_TELEMETRY_DISABLE` env var anywhere in the codebase. Verified:

```
$ grep -rn "TELEMETRY_DISABLE\|telemetryDisable\|disableTelemetry" packages/haiku/src/
(no output)
```

The only telemetry on/off control is `CLAUDE_CODE_ENABLE_TELEMETRY` (positive flag, default false) at `packages/haiku/src/config.ts:140` plus the OTLP endpoint env vars. Once OTLP is enabled, there is no documented runtime kill that disables it.

## Why this is a security finding (mandate: secrets/PII not logged)

The pii-deny-list-strip alert exists precisely because the runtime PII gate caught a body-shaped attribute escaping into telemetry. The escalation playbook is the operator's exfiltration-stop procedure. If the operator pastes `HAIKU_TELEMETRY_DISABLE=1` and restarts the MCP, telemetry export continues — additional PII can leak during the window the operator believes export is stopped. The runbook claims to be the canonical incident response; an incorrect privacy-incident playbook is itself a privacy risk.

## Spirit of the mandate

"No insecure defaults … secrets are not logged" includes the operational ability to *stop* the leak when a regression is detected. A documented-but-fake kill mechanism is functionally equivalent to no kill mechanism, with the additional harm that the operator believes mitigation is in place.

## Fix shape (suggestion, do not implement here)

Either:
1. Implement `HAIKU_TELEMETRY_DISABLE=1` in `telemetry.ts` (gate the `WILL_SEND` constant on it) and document the precedence (env override beats `CLAUDE_CODE_ENABLE_TELEMETRY=true`), OR
2. Replace the runbook escalation step with the real mechanism — unset `CLAUDE_CODE_ENABLE_TELEMETRY` and restart MCP, OR remove the OTLP endpoint env vars and restart, plus a verification step (no `haiku.drift.gate.tick` events arriving at the backend within N seconds).

Either path needs the `pii-deny-list-strip` alert annotation and the runbook section to converge on the same env var name.

## Refs

- `.haiku/knowledge/RUNBOOK.md:583` (escalation step)
- `packages/haiku/src/config.ts:140` (real telemetry flag)
- `packages/haiku/src/telemetry.ts:311` (WILL_SEND gate)
- `deploy/operations/drift-detection-alerts.yaml:60-72` (pii-deny-list-strip alert routes operators to this runbook section)
