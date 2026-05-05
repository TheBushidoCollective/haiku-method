---
title: >-
  haiku_human_write and SPA upload routes emit zero telemetry — sensitive
  operations are invisible
status: rejected
origin: adversarial-review
author: observability
author_type: agent
created_at: '2026-05-02T05:32:49Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:32:49Z'
resolution: null
replies: []
---

**Mandate violation:** "key operations emit structured logs with correlation IDs" — `haiku_human_write` (the agent-attributed-to-human bypass) and the SPA upload routes (`/api/intents/.../uploads/{stage-output,knowledge}`) are the two highest-risk write paths in this whole feature. Both emit zero OTLP telemetry.

**Evidence:**
- `grep emitTelemetry packages/haiku/src/tools/orchestrator/haiku_human_write.ts` → 0 hits.
- `grep emitTelemetry packages/haiku/src/http/upload-routes.ts` → 0 hits.
- `grep emitTelemetry packages/haiku/src/http/assessments-routes.ts` → 0 hits.
- `grep emitTelemetry packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts` → 0 hits.
- These paths DO write to the file-based audit logs (`write-audit.jsonl`, `action-log.jsonl`) but those are intent-local files. There is no aggregation, no central ingest, no real-time alerting surface. To find a misuse you must `find .haiku/intents/*/write-audit.jsonl` across every active worktree on every host.

**Why this is a finding:** `haiku_human_write` is the named misuse vector in the feature itself (see `agent-writes-on-behalf-of-human.feature`). Runbook scenario 7 ("haiku_human_write misuse") tells the operator to grep through write-audit.jsonl manually because there is nothing else to look at. SPA uploads have the same problem — runbook scenario 8 tells the operator to read the HTTP server log. There is no telemetry emit so there is no alerting on the misuse pattern this feature was built to detect.

**Suggested fix:** Add `emitTelemetry` calls to:
1. `haiku_human_write.ts` after `appendWriteAudit` succeeds → `haiku.human_write.recorded` with `{intent_slug, stage, path_hash, author_id, has_rationale}` (path-hash, not full path, if path itself can leak sensitive info; otherwise plain path is fine since the workflow surface is opaque to PII).
2. `upload-routes.ts` for both knowledge and stage-output success paths → `haiku.upload.recorded` with `{intent_slug, stage, route, target_path, bytes}`.
3. `upload-routes.ts` for rejection paths → `haiku.upload.rejected` with `{intent_slug, stage, route, reason}` (reason like `bad_target_path`, `stage_not_writable`, `intent_locked`, `path_outside_tracked_surface`). The rejection metric is the alertable signal — repeated rejections from the SPA mean the UI is misrouting.
4. `haiku_classify_drift.ts` *also* emit `haiku.drift.assessments.resolved` next to the existing `haiku.assessment.recorded` so the assessments-zero-completion alert (filed separately) becomes meaningful.

Without these emits, the runbook for scenarios 7-9 is detective work, not operations.

**File refs:**
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:691` (appendWriteAudit success — needs telemetry call)
- `packages/haiku/src/http/upload-routes.ts` (needs telemetry on success + rejection)
- `packages/haiku/src/http/assessments-routes.ts` (needs read/write telemetry)
- `.haiku/knowledge/RUNBOOK.md:162-185` (scenario 7) and `:187-209` (scenario 8) — both depend on greppable on-disk logs because no telemetry exists

---

**Rejection reason:** Out of operations-stage scope. Adding OTLP telemetry to haiku_human_write, SPA upload routes, baseline-init, and assessments-routes is a new instrumentation effort across 4+ different code paths, each with its own per-route correlation context. This is a follow-on observability intent, not a drift-detection-rollout deliverable. The on-disk JSONL files (write-audit.jsonl, action-log.jsonl) plus runbook diagnostics already provide the per-intent observability path the runbook depends on; surfacing those as OTLP events is an enhancement, not a rollout blocker.
