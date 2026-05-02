# Drift Detection — Operational Runbook

This runbook covers operational scenarios introduced by the out-of-band human file modifications feature: the per-stage drift-detection gate, the upstream-reconciliation gate, the pending-assessment marker store, the human-attributed write tool, the SPA upload endpoints, and the SPA drift visibility panel.

Reach for it when something fires unexpectedly, when a baseline corrupts, when findings flood, when a human-attributed write goes wrong, when an SPA upload misroutes, when the drift visibility panel shows something confusing, or when the gate needs to be turned off fast.

Path conventions used throughout (verified against `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts`, `drift-baseline.ts`, `drift-markers.ts`, `upstream-reconciliation.ts`, `run-tick.ts`):

- Per-stage baseline: `.haiku/intents/{slug}/stages/{stage}/baseline.json`
- Per-stage baseline content sidecars: `.haiku/intents/{slug}/stages/{stage}/baseline-content/{sha256}`
- Per-stage drift assessments: `.haiku/intents/{slug}/stages/{stage}/drift-assessments/DA-NN.json`
- Per-stage state.json: `.haiku/intents/{slug}/stages/{stage}/state.json` (carries `upstream_reconciliation_fingerprint`, `upstream_reconciliation_acknowledged`, `drift_baseline_established_at`)
- Intent-root pending-marker store: `.haiku/intents/{slug}/drift-markers.json`
- Intent-root active drift dispatch: `.haiku/intents/{slug}/drift-dispatch.json`
- Intent-root action log: `.haiku/intents/{slug}/action-log.jsonl`
- Intent-root write-audit log: `.haiku/intents/{slug}/write-audit.jsonl`
- Intent-root features: `.haiku/intents/{slug}/features/*.feature` — for this intent (`out-of-band-human-file-modifications`), the five owned feature files are:
  - `.haiku/intents/out-of-band-human-file-modifications/features/silent-filesystem-drop-detection.feature`
  - `.haiku/intents/out-of-band-human-file-modifications/features/manual-change-assessment.feature`
  - `.haiku/intents/out-of-band-human-file-modifications/features/agent-writes-on-behalf-of-human.feature`
  - `.haiku/intents/out-of-band-human-file-modifications/features/explicit-spa-upload.feature`
  - `.haiku/intents/out-of-band-human-file-modifications/features/drift-assessment-visibility.feature`
- Repo settings: `.haiku/settings.yml`

The kill-switch (scenario 2) is the universal rollback for the per-stage drift-detection gate. `haiku_reconciliation_acknowledge` is the per-stage release valve for the upstream-reconciliation gate. They have different scopes; the rest of the runbook leans on these two as backstops.

---

## Scenario 1 — False-positive finding flood after upgrade

Owns the `silent-filesystem-drop-detection.feature` migration path.

**Symptom.** An existing intent's first tick after upgrade produces dozens of `manual_change_assessment` findings, or the first elaborate of a stage emits an `upstream_reconciliation_required` action that surfaces pre-existing upstream drift the user already knows about.

**Diagnostic.**

1. Confirm the per-stage baseline exists. Read `.haiku/intents/{slug}/stages/{stage}/baseline.json`. If the file is absent, the gate runs in establish-mode on the next tick (no findings) — confirm by re-running `haiku_run_next` and watching the response action.
2. Confirm the upstream-reconciliation fingerprint is stamped. Read `.haiku/intents/{slug}/stages/{stage}/state.json` and look for `upstream_reconciliation_fingerprint`. If it is null/missing on a stage with completed prior stages, the next tick will silently establish it (`stampFingerprint` short-circuit at `run-tick.ts:334`).
3. Compare the telemetry traffic and saturation signals. `haiku.drift.gate.tick` should fire once per tick. `haiku.drift.findings.count` should be zero in steady state. `haiku.drift.surface.size` tells you whether the surface enumeration matches expectations.

**Remediation.** Both auto-heal paths are designed exactly for this:

- The drift gate's silent establish path in `drift-detection-gate.ts` (`baseline === null` → write fresh baseline, `baselineEstablished: true`, `action: null`) handles a missing baseline automatically.
- The previously-unseen-file silent auto-add inside the steady-state scan (`drift-detection-gate.ts:480-501`) prevents brand-new tracked-surface files from showing up as synthetic out-of-band findings on first sight.
- The fingerprint short-circuit in `run-tick.ts:334-340` silently establishes the upstream-corpus fingerprint the first time it sees a stage and on every subsequent tick that finds a matching fingerprint.

Re-run `haiku_run_next` and confirm the action transitions to a normal phase response. If the gate keeps firing despite a present baseline and stamped fingerprint, jump to scenario 2 and use the kill-switch as the failsafe while you investigate.

**Escalation.** Persistent post-establish flood that the kill-switch silences but you cannot otherwise explain → file an issue with the `findings` payload and `state.json` snapshot.

---

## Scenario 2 — Kill-switch (per-stage drift detection disabled)

**Symptom.** The user wants the per-stage drift-detection gate off entirely — for triage, load-shedding, or to unblock work while a deeper bug is investigated.

**Diagnostic.** None — this is an explicit user choice.

**Remediation.** Add `drift_detection: false` to `.haiku/settings.yml`. The setting is read by `isDriftDetectionDisabled(haikuRoot)` in `drift-baseline.ts:723`, which is the first check inside `runDriftDetectionGate`. When disabled the gate is a complete no-op (`{ findings: [], baselineEstablished: false, action: null }`). Confirm by checking that the `haiku.drift.gate.tick` telemetry event reports the kill-switch path on the next tick.

**Scope clause (CRITICAL).** `drift_detection: false` disables only the per-stage drift-detection gate. It does NOT silence the upstream-reconciliation gate. To silence reconciliation findings on a specific stage, run:

```
haiku_reconciliation_acknowledge { intent: "{slug}", stage: "{stage}", rationale: "load-shedding while investigating <issue>" }
```

The rationale must be at least 10 characters (`state-tools.ts:8405`). To silence both gates in concert, set the kill-switch and acknowledge each affected stage. If you find yourself doing this often, file a feature request — there is no combined kill-switch by design.

**Escalation.** None — this is the universal rollback. If the kill-switch does not stop the gate from firing, the issue is upstream of operations and must be investigated as a defect.

---

## Scenario 3 — Baseline corruption

Backs scenario 1 when the baseline file is present but unreadable.

**Symptom.** The drift gate returns `error: 'baseline_corrupt'` with a `BaselineCorruptError`-derived `errorMessage`. The pre-tick gate result has `action: null` and no findings — the workflow refuses to advance until the baseline is repaired.

**Diagnostic.**

1. Read `.haiku/intents/{slug}/stages/{stage}/baseline.json`. Expect either unparseable JSON or a structurally valid JSON object that fails the baseline schema (missing `entries`, malformed entry record, etc.).
2. Confirm the file is readable but invalid — a missing baseline is establish-mode, not corruption.

**Remediation.** Run `haiku_repair { intent: "{slug}" }`. The repair pass scans the intent for metadata issues and applies safe mechanical fixes. If `haiku_repair` cannot recover the baseline, the safe manual path is:

1. Copy `.haiku/intents/{slug}/stages/{stage}/baseline.json` aside to `baseline.json.bak`.
2. Delete `baseline.json` (the gate treats a missing baseline as establish-mode).
3. Re-run `haiku_run_next`. The gate's silent-establish path in `drift-detection-gate.ts:402-442` writes a fresh baseline from current disk state and returns `baselineEstablished: true, action: null`.

You will lose the SHA history that lived in the corrupted baseline; the next tick treats current disk content as the new baseline.

**Escalation.** `haiku_repair` itself fails, or the baseline keeps corrupting after a fresh establish → file an issue with the corrupted file content and the repair output. Use the kill-switch (scenario 2) to keep work moving while the issue is investigated.

---

## Scenario 4 — Baseline write failure (graceful degradation)

Owns the unit-02 emitter `haiku.drift.baseline.write_failed`.

**Symptom.** Telemetry shows repeated `haiku.drift.baseline.write_failed` events with the same `path` attribute. The `site` attribute identifies the failing call site: `establish` (silent-establish path, `drift-detection-gate.ts:434`) or `post-write` (post-finding silent auto-add, `drift-detection-gate.ts:600`). Each emit also carries `error: <stringified Error>`.

**Diagnostic.**

1. Filesystem permissions on `.haiku/intents/{slug}/stages/{stage}/`. The baseline write is `writeBaselineSync(intentDir, activeStage, baseline)` — the process needs write access to the stage directory.
2. Disk space. `df -h` on the worktree filesystem.
3. Concurrent process holding the file open. The atomic write goes through a tempfile + rename in the same directory; another process holding `baseline.json` open does not block the rename, but it can leave a stale `.tmp` sidecar — check for `.baseline-*.json.tmp` siblings.
4. Filesystem readonly toggling (mounted volume, container layer, network filesystem hiccup).

**Remediation.** Fix the underlying I/O issue (permissions, space, mount). Re-run `haiku_run_next` and observe whether `haiku.drift.baseline.write_failed` stops firing. If the failure persists, set `drift_detection: false` in `.haiku/settings.yml` (scenario 2) to break the loop while investigating; the gate stays silent and stops attempting writes.

**Escalation.** Persistent failure with no obvious I/O cause → file an issue with the `error` and `site` attributes from the telemetry events plus a `ls -la` of the stage directory.

---

## Scenario 5 — Reconciliation fingerprint mismatch (legitimate corpus drift)

**Symptom.** A stage's first elaborate emits `upstream_reconciliation_required` with a non-empty `findings` array. The findings list one or more `kind` values from `tool_name`, `http_status`, `field_name`, each with a `concept` and `occurrences` cross-referencing the divergent files. Telemetry shows `haiku.reconciliation.fingerprint.drifted` followed by emit of the findings count.

**Diagnostic.**

1. Read the finding list. Each entry names its `kind`, `concept`, and the `occurrences` (file + line + excerpt) showing both sides of the divergence.
2. Confirm the corpus actually drifted by checking `state.json.upstream_reconciliation_fingerprint` against the current corpus fingerprint (the gate logs both before deciding).
3. Inspect the cited files at the intent root and at `.haiku/intents/{slug}/stages/{prior}/{artifacts,discovery,outputs}/...`.

**Remediation.** Two paths, both implemented in `run-tick.ts:367-400`:

- **Reconcile.** Edit the upstream artifacts so the divergent identifiers/codes/field names converge on one canonical form. Re-run `haiku_run_next`. The reconciliation gate recomputes the fingerprint, finds no findings, and silently stamps the new fingerprint via `stampFingerprint` (run-tick.ts:346).
- **Acknowledge.** If the divergence is intentional (the artifacts genuinely describe different surfaces), call:
  ```
  haiku_reconciliation_acknowledge { intent: "{slug}", stage: "{stage}", rationale: "<≥10 chars explaining why>" }
  ```
  This sets `upstream_reconciliation_acknowledged: true` on the stage's state.json (`state-tools.ts:8422`); the gate short-circuits on subsequent ticks via the `upstream_reconciliation_acknowledged === true` check at `run-tick.ts:271`.

**Escalation.** Detector emits a finding the user is sure is wrong → file an issue with the `kind`, `concept`, and full `occurrences` payload. Acknowledge to unblock; the fix lives upstream of operations.

---

## Scenario 6 — Manual change assessment classification went wrong

Owns `manual-change-assessment.feature`.

**Symptom.** A `manual_change_assessment` finding was classified `ignore` or `inline-fix` but the user expected `surface-as-feedback` (or `trigger-revisit`). The wrong classification has been written to disk and the workflow has advanced past it.

**Diagnostic.**

1. Read the assessment record at `.haiku/intents/{slug}/stages/{stage}/drift-assessments/DA-NN.json` (per-stage path — NOT at intent root). The record shows the classification outcome the agent chose plus the dispatched DriftFinding.
2. Cross-check via the SPA's drift-assessments view (scenario 9 path — `/api/drift-assessments` style endpoints) for the same record.
3. If the file under-classification was masked by an active marker, read `.haiku/intents/{slug}/drift-markers.json` and check whether an open marker for that path is suppressing fresh detection.

**Remediation.**

- **Interactive mode.** Edit the file again to retrigger the gate (a new SHA on the same path produces a fresh dispatch on the next tick, provided the existing marker is stale per `isStaleMarker` at `drift-markers.ts:361`). Classify correctly the second time.
- **Autopilot mode.** Open feedback against the producing stage so the next iteration revisits with the corrected expectation. Use:
  ```
  haiku_feedback { intent: "{slug}", stage: "{stage}", title: "Re-classify drift on {path}", body: "<context>", origin: "agent", resolution: "stage_revisit" }
  ```

**Escalation.** The dispatch will not re-fire even after the file SHA changes → check the marker store (scenario 10).

---

## Scenario 7 — `haiku_human_write` misuse

Owns `agent-writes-on-behalf-of-human.feature`.

**Symptom.** Either (a) a write attributed to the user that the user did not request, or (b) a `haiku_human_write` call rejected with `code: "path_outside_tracked_surface"`.

**Diagnostic.**

1. Read the write-audit trail: `.haiku/intents/{slug}/write-audit.jsonl`. Each line is one human-attributed write with `path`, `sha`, `tick_counter`, `author_class: "human-via-mcp"`, and the calling tool/route.
2. Cross-reference with `.haiku/intents/{slug}/action-log.jsonl` — both logs are appended on a successful human write (`haiku_human_write.ts` and `http/upload-routes.ts`).
3. For a `path_outside_tracked_surface` rejection, confirm the target was inside one of the allowed roots: `knowledge/`, `stages/{stage}/knowledge/`, `stages/{stage}/discovery/`, `stages/{stage}/artifacts/` (or the `outputs/` alias). Workflow-managed files (`units/`, `feedback/`, `intent.md`, `state.json`, `write-audit.jsonl`) are refused by design.

**Remediation.**

- **Unwanted write landed.** Revert the file in git (`git checkout HEAD -- {path}` from the worktree), and file feedback against the agent's hat:
  ```
  haiku_feedback { intent: "{slug}", stage: "{stage}", title: "Spurious haiku_human_write on {path}", body: "<what the agent did and why it was wrong>", origin: "agent" }
  ```
  The next gate tick treats the revert as a normal modification and emits a `manual_change_assessment` for the agent to re-classify. The audit trail in `write-audit.jsonl` is append-only and preserves the misuse evidence.
- **`path_outside_tracked_surface` rejection.** Confirm whether the target is genuinely a tracked-surface path. If the user wants the write under a non-tracked path (e.g., into a new top-level directory), the request itself is wrong — explain the boundary and pick a tracked destination. If the user is targeting a workflow-managed file (`units/`, `feedback/`, etc.), redirect them to the appropriate MCP tool (`haiku_unit_write`, `haiku_feedback_write`, etc.).

**Escalation.** Persistent unexplained `path_outside_tracked_surface` rejections on paths that should be tracked → file an issue and include the target path plus the resolved canonical path (the tool's error message includes the canonicalised form).

---

## Scenario 8 — SPA upload landed in the wrong place

Owns `explicit-spa-upload.feature`.

**Symptom.** Either (a) a knowledge upload via the review web UI doesn't appear in the next elaborate phase, or (b) a stage-output replacement upload doesn't trigger drift detection on the next tick.

**Diagnostic.**

1. Find the upload entry in `.haiku/intents/{slug}/write-audit.jsonl` (uploads are recorded the same way `haiku_human_write` records are). Confirm the recorded `path` matches the expected destination.
2. Check the HTTP server log around the upload time for the matching `POST /api/intents/{slug}/uploads/knowledge` or `POST /api/intents/{slug}/uploads/stage-output` route.
3. Confirm the file exists at the expected canonical path:
   - Knowledge upload (intent-scope): `.haiku/intents/{slug}/knowledge/{target_filename}`
   - Knowledge upload (stage-scope): `.haiku/intents/{slug}/stages/{stage}/knowledge/{target_filename}`
   - Stage output replacement: `.haiku/intents/{slug}/stages/{stage}/artifacts/{target_path}` (the `outputs/` alias canonicalises to `artifacts/`).
4. Confirm the file is present in the next tick's tracked-surface enumeration. The drift gate calls `enumerateTrackedSurface(intentDir, activeStage)`. If the file is in the right place but the gate doesn't see it, run with telemetry on and check `haiku.drift.surface.size` for the change.

**Remediation.**

- File landed in the wrong spot → re-upload to the correct path. The audit log records both writes; the misplaced one will be picked up by the next drift gate tick as its own finding (or as a removed file if you delete it before the next tick).
- File landed in the right spot but isn't surfacing → confirm the next tick saw it via `haiku.drift.surface.size` and `haiku.drift.findings.count`. The upload deliberately does NOT update the baseline; the next gate tick is what surfaces the change (`upload-routes.ts:10`). If the gate is silenced (kill-switch enabled), no surfacing happens — re-enable the gate.
- Upload UI is routing to the wrong path → file a bug with the request payload (`stage`, `target_path`, `target_filename`) and the actual destination on disk.

**Escalation.** Upload writes succeeded per audit log but the file is not on disk → likely a tempfile-cleanup race (`upload-routes.ts:30` notes the guard deletes tempfiles on rejection). File an issue with the audit entry plus a directory listing.

---

## Scenario 9 — Drift assessments panel shows stale or empty findings

Owns `drift-assessment-visibility.feature`.

**Symptom.** The SPA's drift banner or assessments view does not reflect a finding the user knows the gate emitted.

**Diagnostic.**

1. Read the per-stage assessment directory directly: `.haiku/intents/{slug}/stages/{stage}/drift-assessments/*.json`. Each file is one historical assessment record.
   - Files exist on disk but the panel is empty → SPA cached stale state. Refresh.
   - No files on disk → the gate did not write any. Check telemetry `haiku.drift.findings.count` over the relevant tick window. Zero findings means the gate genuinely saw none; non-zero means the gate emitted but the dispatch handler failed to land an assessment record (look for orchestrator errors in the tick log).
2. Confirm the active dispatch is sane: `.haiku/intents/{slug}/drift-dispatch.json`. The classify tool reads this to validate `tick_id`; a stale dispatch can mask a fresh one if the file isn't cleared on success.
3. Confirm the open marker count: telemetry `haiku.drift.markers.open_count` plus `total_count`. A high open count without matching assessments suggests the SPA is filtering by marker state and missing some.

**Remediation.** SPA cache → refresh (cache bust). Missing on-disk records but non-zero findings count → check the orchestrator tick log for dispatch errors; restart the MCP if a partial-write left an inconsistent state. Stale `drift-dispatch.json` → the classify tool deletes it on success; if it persists across multiple ticks, file an issue.

**Escalation.** SPA refresh does not reflect on-disk state → check `/api/drift-assessments` route handler (HTTP server log) for read errors; file a bug with the on-disk file list and the SPA payload.

---

## Scenario 10 — Pending-marker store leak

**Symptom.** A finding keeps re-firing after the agent classified it, or telemetry `haiku.drift.markers.open_count` grows monotonically across ticks while `total_count` matches.

**Diagnostic.**

1. Read `.haiku/intents/{slug}/drift-markers.json` (intent root, NOT per-stage). Look for entries where `path` matches the re-firing finding and `cleared_at` is null.
2. For each open marker, check the linked-resolution invariant. Per `drift-markers.ts:43-48` (MarkerInvariantError), exactly one of `linked_feedback_id` or `linked_revisit_target_stage` must be non-null. A leak almost always traces to a marker whose linked feedback was never closed/rejected (for `surface-as-feedback` outcome) or whose revisit never completed (for `trigger-revisit` outcome).
3. Confirm via telemetry: `haiku.drift.markers.open_count` is the saturation signal that flags this in real time (per unit-02 spec). `haiku.drift.clear_marker_failed` (emitted at `state-tools.ts:7618`) shows clear-time failures.

**Remediation.** Three escalating options:

1. **Resolve the linked artifact.** If the marker's `linked_feedback_id` is set, find the feedback file and resolve it (close or reject). The `clearMarkersForFeedbackSync` path (`baseline-clear-marker.ts:495`) clears all markers whose `linked_feedback_id` matches the closed feedback. If `linked_revisit_target_stage` is set, complete the revisit; the marker clears on revisit-complete via the legality matrix (`drift-markers.ts:299`).
2. **Manual edit (last-resort).** Copy `.haiku/intents/{slug}/drift-markers.json` to `drift-markers.json.bak` BEFORE editing. Set the offending entry's `cleared_at` to a current ISO-8601 timestamp and `resolved_sha` to the file's current SHA-256, conforming to the `PendingMarkerSchema` at `drift-markers.ts:85`. Atomically replace the file (write new content to `drift-markers.json.tmp` and `mv` into place, mirroring the `writeMarkersSync` pattern). Re-run `haiku_run_next` and observe whether the file stops re-firing.
3. **Kill-switch.** Set `drift_detection: false` in `.haiku/settings.yml` (scenario 2). The marker store is read by the gate; with the gate silenced, leaked markers stop influencing behavior. Use this while a deeper bug is investigated and file an issue with the offending marker JSON.

**Escalation.** Manual edit clears the marker but the same path leaks again on the next dispatch → the dispatch path itself is creating a marker without a valid linked artifact. File an issue with the marker JSON, the linked artifact (or absence thereof), and the dispatch tick id.

---

## Scenario 11 — Reconciliation gate fires on a stage with stable corpus

**Symptom.** `upstream_reconciliation_required` fires on a stage whose upstream corpus you believe is consistent. Telemetry shows `haiku.reconciliation.fingerprint.drifted` then `haiku.reconciliation.fingerprint.duration_ms` for the detector pass, then a non-empty findings list.

**Diagnostic.**

1. Compare the finding's cited files. Open each `occurrences[].file` at the listed line. The detector reports `tool_name`, `http_status`, or `field_name` divergences with cross-file evidence; if both occurrences point at the same identifier with no real divergence, the detector is mis-clustering.
2. Read `state.json.upstream_reconciliation_fingerprint` and recompute via `computeCorpusFingerprint(...)` (or trigger a re-tick and watch the telemetry). A mismatch means the corpus genuinely changed since the last successful scan; an exact match with the gate still firing is itself the bug.
3. Cross-check the synonym matrix at `upstream-reconciliation.ts:216-223` (tool-name verb classes) and `:439-446` (field-name pairs). False positives almost always trace to one of these heuristics treating two genuinely-distinct concepts as synonyms.

**Remediation.** Acknowledge to unblock:
```
haiku_reconciliation_acknowledge { intent: "{slug}", stage: "{stage}", rationale: "<≥10-char explanation>" }
```
The fix lives upstream of operations: file an issue with the offending finding's `kind`, `concept`, and full `occurrences` payload so the detector heuristic can be tightened.

**Escalation.** The same false positive recurs on multiple intents → the detector is genuinely too eager. File a single consolidated issue covering the pattern; do not file one per intent.

---

## Service Level Objectives (SLOs)

SLOs are defined against the **agent-perceived contract** of the drift-detection feature. The user is the agent driving the workflow; "healthy" means an `haiku_run_next` tick passes through both gates without the agent paying for false positives, slow ticks, or write failures it cannot resolve. Every SLO has an explicit error budget — an SLO without a budget is a wish.

> **Source of truth.** The machine-readable SLO definitions live in [`deploy/operations/drift-detection-slos.yaml`](../../deploy/operations/drift-detection-slos.yaml) and the burn-rate alerts that reference them in [`deploy/operations/drift-detection-alerts.yaml`](../../deploy/operations/drift-detection-alerts.yaml). The slos.yaml header explicitly declares itself the source of truth (line 14). This runbook section restates each SLO in operator-friendly prose; **if this prose contradicts slos.yaml, slos.yaml is right and this section is wrong** — file feedback to resync rather than treating the runbook as authoritative. The tables below cite the exact `slos.yaml` SLO name (`name:` field) and the alert IDs from `alerts.yaml` so an operator paged at 3am can answer "is this within budget?" by reading one canonical pair of files.
>
> Window, percentile, threshold, severity, and per-intent vs. aggregate scoping are inherited from slos.yaml. The universal rollback for any blown budget is the kill-switch (scenario 2) plus `haiku_reconciliation_acknowledge` per stage.

### Healthy baseline (define healthy first)

A "healthy" tick has all of:

1. `haiku.drift.gate.duration_ms` p95 ≤ 500ms (matches `drift-gate-latency-p95` SLO; tail beyond p95 is in budget so long as the burn-rate alert does not fire).
2. `haiku.drift.findings.count == 0` OR every emitted finding lands an assessment record on disk (`haiku.drift.assessments.count` increases by exactly the number of dispatched findings within one tick).
3. No `haiku.drift.baseline.corrupt`, `haiku.drift.baseline.write_failed`, `haiku.reconciliation.fingerprint.write_failed`, or `haiku.drift.clear_marker_failed` events emitted.
4. `haiku.drift.markers.open_count` is monotonically non-increasing across ticks for the same intent unless a new finding is dispatched on that tick.
5. `haiku.reconciliation.fingerprint.duration_ms` p95 ≤ 750ms (matches `reconciliation-fingerprint-latency-p95` SLO; corpus enumeration is heavier than per-tick drift but still inside the same hot path).
6. The fingerprint short-circuits: `haiku.reconciliation.fingerprint.matched` is the dominant emit; `.drifted` is rare and explicable.

Anything outside this envelope is unhealthy and is the cause one of the SLOs below pages on.

### SLO 1 — Gate availability

**slos.yaml name:** `drift-gate-availability` · **Window:** rolling 28d · **Scope:** aggregate across all intents on the host (per the SLI queries in slos.yaml — denominator is `count(haiku.drift.gate.tick)` across the service, not per intent).

**Target.** ≥ 99.5% of `haiku.drift.gate.tick` events complete without an error emit on the same tick. Error emits in scope (per slos.yaml SLI): `haiku.drift.baseline.corrupt`, `haiku.drift.baseline.write_failed`. Error budget: **0.5% of 28 days = 201.6 minutes** of broken-gate time per rolling 28-day window.

> Note: `haiku.drift.clear_marker_failed` is alerted on directly (see `drift-clear-marker-failed` in alerts.yaml when present, or Scenario 10) but is not part of the availability SLI numerator in slos.yaml. If you believe it should be, file feedback against slos.yaml — do not silently retune the runbook.

**Why this metric.** Alerting on `haiku.drift.baseline.write_failed` directly is alerting on a symptom. Alerting on the **rate of error emits per tick** is alerting on the *cause* the agent cares about: the gate as a whole stopped delivering its contract. A single write-failed event is in budget; sustained write-failed events burn it.

**Burn-rate alerts** (defined in alerts.yaml; multi-window multi-burn-rate per Google SRE Workbook).
- `drift-availability-fast-burn` (severity: **page**) — fires when 1h burn × 14.4 AND 6h burn × 6 both exceed threshold. Active outage of the gate.
- `drift-availability-slow-burn` (severity: **ticket**) — fires when 6h burn × 6 AND 24h burn × 1 both exceed threshold. Steady leak; investigate within the week.
- Single-event pages: `drift-baseline-corrupt`, `drift-baseline-write-failed`, `reconciliation-write-failed` (cause-based pages independent of SLO burn — every active intent on the host is at risk).

**Rollback.** Kill-switch silences the gate and stops error emits. Acknowledged stages bypass reconciliation. No customer-visible impact during rollback because the workflow continues without drift detection.

### SLO 2 — Gate latency

**slos.yaml name:** `drift-gate-latency-p95` · **Window:** rolling 7d · **Scope:** aggregate (denominator is `count(haiku.drift.gate.duration_ms)` across the service).

**Target.** ≥ 95% of `haiku.drift.gate.duration_ms` samples are < 500ms over a rolling 7-day window. Equivalent statement: **p95 ≤ 500ms over 7d**.

**Why this metric.** The drift gate sits in the synchronous tick hot path. Slow ticks make the agent feel slow regardless of whether anything is wrong with detection. Latency is the SLO the *user of the gate* (the orchestrator) experiences. p95 (not p99) is the SLO target because the gate's tail is dominated by FS-latency outliers that the kill-switch handles cleanly — the page-worthy condition is the **median** of the tail moving, not a single slow tick.

**Burn-rate alerts** (defined in alerts.yaml).
- `drift-gate-latency-p95-high` (severity: **ticket**) — fires when `histogram_quantile(0.95, rate(haiku.drift.gate.duration_ms[1h])) > 500`. Capacity warning; not a page. Paging on a single bad p95 hour generates noise on transient FS slowness.

**Diagnostic playbook.** Slow ticks point to one of: large `haiku.drift.surface.size` (file-count enumeration is the dominant cost), filesystem latency on baseline read/write, or marker-store growth (`haiku.drift.markers.total_count`). The remediation order is (1) check the saturation signals listed in §Healthy baseline, (2) if marker-store size is the culprit, work scenario 10, (3) if surface size is the culprit, the tracked-surface boundary may be too wide — file feedback against the design stage.

**Reconciliation latency** has its own sibling SLO in slos.yaml: `reconciliation-fingerprint-latency-p95` — **p95 ≤ 750ms over 7d**, ≥ 95% of samples under 750ms. Burn-rate alert: `reconciliation-fingerprint-latency-p95-high` (severity: **ticket**). Corpus enumeration is heavier than the per-tick drift surface scan, but the same hot-path constraint applies — page-class severity is reserved for write failures, not latency.

### SLO 3 — Finding signal-to-noise

**Target.** ≥ 95% of dispatched findings land an assessment record within one tick. Measured as `haiku.drift.assessments.count` increase divided by `haiku.drift.findings.count` over a 7-day window. Error budget: 5% of dispatched findings per intent per window.

**Why this metric.** A dispatched finding without an assessment is a finding that vanished — the agent saw it, classified it, but the dispatch handler did not land the record. This is the operational symptom that causes scenario 9 (panel shows nothing) and scenario 10 (markers leak). Alerting on it directly catches the *cause* of those user-visible symptoms before they pile up.

**Burn-rate alerts.**
- > 1% of findings unassessed in any 1-hour window → warn.
- > 5% of findings unassessed in any 6-hour window → page.
- Sustained ratio < 90% over 24 hours → page; investigate the dispatch path before the marker store leaks past `haiku.drift.markers.open_count` saturation.

### SLO 4 — Marker-store hygiene

**Target.** `haiku.drift.markers.open_count` ≤ 50 per intent at any tick boundary. Hard ceiling: ≤ 200 per intent (above this, scenario 10 is *certainly* in play).

**Why this metric.** Open markers without resolution are the slow-burning equivalent of a memory leak. They suppress fresh detection on paths that already have an unresolved marker (`isStaleMarker` at `drift-markers.ts:361`), so a marker leak silently degrades detection coverage. Alerting on the count directly is alerting on the *cause* of degraded coverage.

**Burn-rate alerts.**
- `haiku.drift.markers.open_count` > 50 for ≥ 1 hour → warn (work scenario 10 in business hours).
- `haiku.drift.markers.open_count` > 200 → page (work scenario 10 immediately).
- `haiku.drift.markers.open_count` strictly increasing for ≥ 6 consecutive ticks on the same intent → page (the leak is active, not historical).

### SLO 5 — Reconciliation correctness

**Target.** ≤ 1 acknowledged-because-of-false-positive rationale per intent per 30 days. Measured by sampling `haiku_reconciliation_acknowledge` rationales and counting those flagged as false-positive triage by the user.

**Why this metric.** The reconciliation gate pages humans (it blocks the workflow). Every false positive is a wasted human triage. This SLO is a quality bar on the *detector*, not on the operator — when it burns, the fix is upstream of operations (scenario 11 escalation), not in the runbook.

**Burn-rate alerts.**
- ≥ 2 false-positive acknowledgements in 7 days on any one detector heuristic (`tool_name`, `http_status`, `field_name`) → warn.
- ≥ 5 false-positive acknowledgements in 7 days across any heuristics → page; consider acknowledging affected stages broadly while the heuristic is tightened.

---

## Alerting rules

The mandate from the SRE hat is: alert on causes, not symptoms; never alert on a single error; never alert without a diagnostic step. Every rule below cites a cause, links to a scenario, and has a remediation handle. Alerts that fire without a runbook scenario are alert noise — file feedback against this runbook to add the scenario rather than acking the alert in silence.

| Rule (alerts.yaml ID) | Trigger | Severity | Linked scenario | First diagnostic step |
|---|---|---|---|---|
| `drift-availability-fast-burn` | SLO 1 (`drift-gate-availability`, 28d): 1h burn × 14.4 AND 6h burn × 6 both exceed | page | 3, 4 | Read `state.json` for the affected stage; identify which error emitter fired (`baseline.corrupt` vs `baseline.write_failed`) |
| `drift-availability-slow-burn` | SLO 1: 6h burn × 6 AND 24h burn × 1 both exceed | ticket | 3, 4, 10 | Group error emits by `path` attribute; one path repeating → I/O issue on that path |
| `drift-gate-latency-p95-high` | SLO 2 (`drift-gate-latency-p95`, 7d): `histogram_quantile(0.95, rate(haiku.drift.gate.duration_ms[1h])) > 500` | ticket | (latency playbook) | Compare `haiku.drift.surface.size` and `haiku.drift.markers.total_count` deltas across the window |
| `reconciliation-fingerprint-latency-p95-high` | sibling SLO (`reconciliation-fingerprint-latency-p95`, 7d): p95 of `reconciliation.fingerprint.duration_ms` over 1h > 750ms | ticket | 5, 11 | Inspect corpus size growth; confirm prior-stage artifacts have not exploded |
| `drift-finding-assessment-gap` | SLO 3: < 95% findings get assessments in 6h | page | 6, 9 | Compare `haiku.drift.findings.count` vs `haiku.drift.assessments.count` per stage; the delta tells you which dispatch path failed |
| `drift-marker-saturation-warn` | SLO 4: `open_count` > 50 for 1h | warn | 10 | Read `.haiku/intents/{slug}/drift-markers.json`; group open markers by linked-resolution invariant |
| `drift-marker-saturation-page` | SLO 4: `open_count` > 200 OR strictly increasing 6 ticks | page | 10 | Same as above; expect one path / one feedback ID dominating the leak |
| `reconciliation-false-positive-cluster` | SLO 5: 2+ false-positive acks in 7 days on a single heuristic | warn | 11 | List the offending findings' `kind` + `concept`; consolidate into one detector-tightening issue |
| `reconciliation-false-positive-spread` | SLO 5: 5+ false-positive acks in 7 days across heuristics | page | 11 | Acknowledge affected stages broadly; treat as detector regression |

**Rules that are deliberately NOT here.**

- "Alert on every `haiku.drift.baseline.write_failed`." Single write failures are in budget — alerting on the symptom would generate noise on every transient FS hiccup. The rate-of-error rule above (`drift-gate-availability-burn-*`) catches the cause at SLO scope. A single write failure that the agent does not also see in a burn-rate alert is, by definition, in budget.
- "Alert on every `haiku.drift.findings.count > 0`." Findings are the gate doing its job. The signal-to-noise SLO catches the *cause* a flood matters (assessment gap), not the flood itself.
- "Alert on every `upstream_reconciliation_required`." Same reason — these are the gate working as designed. The SLO 5 cluster rules catch *false-positive* clusters, which is the failure mode the user pays for.

If an oncall finds themselves silencing one of the listed alerts repeatedly, the underlying SLO target is wrong, not the alert — file feedback to retune the target rather than ignoring the page.

---

## Telemetry cross-reference

Every diagnostic step that says "check telemetry" or "check the metric" names an event from unit-02's completion criteria. The events used in this runbook:

| Event | Used in scenario / SLO |
|---|---|
| `haiku.drift.gate.tick` | 1, 2; SLO 1 (denominator) |
| `haiku.drift.gate.duration_ms` | SLO 2 |
| `haiku.drift.findings.count` | 1, 9; SLO 3 (denominator) |
| `haiku.drift.findings.mass_synthesized` | drift-findings-mass-synthesized runbook (mass-drift synthesis trigger; carries `raw_findings_count`, `effective_surface_size`, `drift_ratio`) |
| `haiku.drift.surface.size` | 1, 8; SLO 2 diagnostic |
| `haiku.drift.baseline.corrupt` | 3; SLO 1 numerator |
| `haiku.drift.baseline.write_failed` | 4; SLO 1 numerator |
| `haiku.drift.markers.open_count` | 9, 10; SLO 4 |
| `haiku.drift.markers.total_count` | 9, 10; SLO 2 diagnostic |
| `haiku.drift.assessments.count` | SLO 3 (numerator), Healthy baseline §2 |
| `haiku.drift.clear_marker_failed` | 10 (cause-based alert; not in `drift-gate-availability` SLI per slos.yaml) |
| `haiku.reconciliation.fingerprint.drifted` | 5, 11 |
| `haiku.reconciliation.fingerprint.duration_ms` | 11; SLO 2 sibling |
| `haiku.reconciliation.fingerprint.matched` | Healthy baseline §6 |
| `haiku.reconciliation.fingerprint.established` | Healthy baseline (silent first-time) |
| `haiku.reconciliation.fingerprint.write_failed` | SLO 1 sibling (reconciliation availability) |

If a needed event isn't listed above, the diagnostic step is wrong, not the runbook is incomplete — file feedback against unit-02 to extend the emitter set rather than referencing an undefined event.

---

## Feature coverage map

| Scenario | Feature file (under `.haiku/intents/out-of-band-human-file-modifications/features/`) |
|---|---|
| 1 | `silent-filesystem-drop-detection.feature` |
| 6 | `manual-change-assessment.feature` |
| 7 | `agent-writes-on-behalf-of-human.feature` |
| 8 | `explicit-spa-upload.feature` |
| 9 | `drift-assessment-visibility.feature` |

Scenarios 2, 3, 4, 5, 10, and 11 are operational footprint that the gate-detection features depend on but do not own — kill-switch behavior, baseline integrity, write-failure resilience, reconciliation-gate operations, marker-store hygiene, and false-positive triage.

---

## Closed issues / historical observability

### Marker-store concurrency race (closed via `removeMarkersSync`)

The drift gate originally used fire-and-forget async marker removal inside the synchronous tick path. Rapid successive ticks could re-detect the same stale marker before the async write landed, dispatching duplicate `manual_change_assessment` actions for the same file. The fix: a single synchronous batch-remove (`drift-markers.ts:393-405`, `removeMarkersSync`) called from the gate (`drift-detection-gate.ts:585-593`).

**How to verify the assumption still holds.** Confirm `removeMarkersSync` is the only marker-removal entry point in the gate's hot path. Specifically:

```
grep -n "removeMarker\|removeMarkersSync" packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
```

The gate file should reference `removeMarkersSync` only. Any new call to async `removeMarker` from within `runDriftDetectionGate` regresses the race; treat as a code-review red flag.

---

## External observability

Drift-detection telemetry is one signal among several. The full operational picture for this intent's surfaces uses:

- **Drift detection telemetry:** OTLP events `haiku.drift.*` and `haiku.reconciliation.*`. SLOs live in `deploy/operations/drift-detection-slos.yaml`; alert routing in `deploy/operations/drift-detection-alerts.yaml`.
- **Website errors:** Sentry project `haiku-spa` (via `@sentry/nextjs`).
- **MCP errors:** Sentry project `haiku-mcp`.
- **Tunnel health:** No dedicated monitoring — `localtunnel` is ephemeral per session and not part of the SLO surface.

---

## Alert anchors (paged-from-`drift-detection-alerts.yaml`)

Every `runbook:` URL in `deploy/operations/drift-detection-alerts.yaml` resolves to one of the headings below. The frontmatter gate `runbook-anchors-resolve-from-alerts-yaml` fails the unit if an alert URL points at a missing anchor (operators page at 3am to a 404 — unacceptable).

Each anchor is a thin operator entry-point: alert ID, severity, fires-when, the canonical scenario above with the full diagnostic + remediation playbook. The duplication that existed pre-fix (two parallel runbooks with contradictory remediation paths for the same fault) is gone — alert anchors point to one canonical scenario per fault, and the `Remediate` line below is the alert-time-to-action distillation only.

### drift-gate-baseline-corrupt

- **Alert:** `drift-baseline-corrupt` (severity: page) — `sum by (intent_slug, stage) (rate(haiku.drift.baseline.corrupt[5m])) > 0`
- **Cause:** `.haiku/intents/<slug>/stages/<stage>/baseline.json` failed JSON parse or schema validation.
- **Canonical scenario:** [Scenario 3 — Baseline corruption](#scenario-3--baseline-corruption) (full diagnostic + remediation).
- **Remediate (alert-time distillation):** Run `haiku_repair { intent: "<slug>" }`. If repair cannot recover the baseline, fall back to the manual establish-mode reset documented in scenario 3 (copy aside, delete, re-tick).
- **Escalation:** If `haiku.drift.baseline.corrupt` fires for >3 distinct intents in 1h, suspect filesystem corruption — page storage on-call and engage the kill-switch (see [`kill-switch-engaged`](#kill-switch-engaged) below) to stop further ticks while diagnosing.

### drift-gate-write-failed

- **Alert:** `drift-baseline-write-failed` (severity: page) — `sum by (intent_slug, stage) (rate(haiku.drift.baseline.write_failed[10m])) > 0`
- **Cause:** Filesystem write to `baseline.json` failed — disk full, EACCES, EROFS, filesystem corruption, or quota exhaustion. The gate rethrows; pre-rethrow this looped silently.
- **Canonical scenario:** [Scenario 4 — Baseline write failure (graceful degradation)](#scenario-4--baseline-write-failure-graceful-degradation) (full diagnostic + remediation).
- **Remediate (alert-time distillation):** Fix the underlying I/O fault (disk space, permissions, mount), re-tick, and confirm `haiku.drift.baseline.write_failed` stops firing. If the failure persists, kill-switch (scenario 2) to break the loop while investigating.
- **Escalation:** If write-failed spans >5 intents and persists after recovery, escalate to infra on-call.

### reconciliation-write-failed

- **Alert:** `reconciliation-write-failed` (severity: page) — `sum by (intent_slug, stage) (rate(haiku.reconciliation.fingerprint.write_failed[10m])) > 0`
- **Cause:** Failure persisting `upstream_reconciliation_fingerprint` to `state.json`. Same fault class as `drift-baseline-write-failed`, different file.
- **Canonical scenario:** Same as [Scenario 4](#scenario-4--baseline-write-failure-graceful-degradation), substituting `state.json` for `baseline.json` in the diagnostic checks. Once writable, the next tick re-establishes the fingerprint via `haiku.reconciliation.fingerprint.established`.
- **Cross-correlation:** If this fires for the same intent as `drift-baseline-write-failed`, the root cause is FS-wide. Engage the kill-switch and escalate to infra on-call.

### pii-deny-list-strip

- **Alert:** `pii-deny-list-strip` (severity: page) — `sum(rate(pii.deny.strip[1h])) > 0`
- **Cause:** A code path tried to emit a body-shaped attribute (`diff_unified`, `excerpt`, `*_body`, `content`, …) into telemetry. The runtime gate stripped it; the static CI gate (`pii-grep-gate-runs`) did not catch it. Every strip is a privacy regression.
- **Diagnose:**

  ```bash
  # 1. Find the emit site from the warned key + event name (stderr line)
  KEY="<key-from-warning>"
  EVENT="<event-name-from-warning>"
  grep -rn "emitTelemetry(\"$EVENT\"" packages/haiku/src/

  # 2. Check whether the static-gate test should have caught this
  grep -rn "$KEY" packages/haiku/test/telemetry-otel.test.mjs

  # 3. Confirm runtime sanitization is functioning
  node -e 'import("./packages/haiku/src/telemetry.ts").then(t => console.log([...t.__test.piiDenyKeys]))'
  ```

- **Remediate:** Fix the emit site (replace body-shaped attribute with a hash, byte count, or path), then add the offending key to the static CI gate so it cannot reach runtime again:

  ```ts
  // packages/haiku/src/<emit-site>.ts
  - { diff_unified: diffText }
  + { diff_bytes: String(Buffer.byteLength(diffText, "utf8")) }
  ```

  ```bash
  $EDITOR packages/haiku/test/telemetry-otel.test.mjs   # add the key to the deny-list assertion
  ```

- **Escalation:** If multiple distinct keys strip in <1h, treat as a privacy incident — stop telemetry export (`HAIKU_TELEMETRY_DISABLE=1`), page security, and audit the OTLP backend's last 24h of events for the leaked keys.
- **Rollback:** Telemetry events are append-only and may already be in the backend. If a leak is confirmed, contact the OTLP backend admin to purge events matching the offending keys; revert the regressing PR.

### drift-gate-availability-burn

- **Alerts:** `drift-availability-fast-burn` (severity: page; multi-window 1h × 14.4 AND 6h × 6) and `drift-availability-slow-burn` (severity: ticket; 6h × 6 AND 24h × 1). Both anchor here.
- **Cause:** Sustained ratio of error emits (`baseline.corrupt + baseline.write_failed + clear_marker_failed`) to `gate.tick` exceeds the SLO objective (see [SLO 1](#slo-1--gate-availability)).
- **Diagnose:** Identify the dragging intent — group `haiku.drift.baseline.corrupt` and `.write_failed` by `intent_slug` in the OTLP backend. The top offender hosts the issue. Distinguish single-intent flapping (one intent's `tick_iteration` cycling) from FS-wide (correlate with `haiku.reconciliation.fingerprint.write_failed`).
- **Remediate:** Single intent flapping → work [`drift-gate-baseline-corrupt`](#drift-gate-baseline-corrupt) above. FS-wide → work [`drift-gate-write-failed`](#drift-gate-write-failed).
- **Escalation:** Fast-burn that does not clear within 30 minutes → engage the kill-switch ([`kill-switch-engaged`](#kill-switch-engaged) below) to stop the budget bleed while diagnosing. Re-enable once `gate.tick` resumes cleanly for 1h.

### drift-gate-latency-high

- **Alert:** `drift-gate-latency-p95-high` (severity: ticket) — `histogram_quantile(0.95, rate(haiku.drift.gate.duration_ms[1h])) > 500`
- **Cause:** Surface scan slowdown. Correlate with `haiku.drift.surface.size` to separate corpus growth from filesystem latency.
- **Diagnose:** Group `haiku.drift.surface.size` by `intent_slug` over 7d. Compare against `haiku.reconciliation.fingerprint.duration_ms` — if both climbed together, the filesystem is the cause; if only the drift gate climbed, surface growth is. The top 5% of intents by surface size typically produce the bulk of the tail.
- **Remediate:** Surface growth → most often a knowledge dir bloating with binary attachments; check `.haiku/intents/<slug>/knowledge/attachments/` and apply an archive policy. Filesystem slowdown → triage with `iostat` / `vmstat` and engage infra on-call.
- **Cross-reference:** This is the page side of [SLO 2 — Gate latency](#slo-2--gate-latency); the diagnostic playbook for [Scenario 10 — Pending-marker store leak](#scenario-10--pending-marker-store-leak) is the first thing to rule out when latency degrades alongside marker-count growth.
- **Rollback:** N/A — latency degradation is gradual; no atomic action to revert.

### reconciliation-latency-high

- **Alert:** `reconciliation-fingerprint-latency-p95-high` (severity: ticket) — `histogram_quantile(0.95, rate(haiku.reconciliation.fingerprint.duration_ms[1h])) > 750`
- **Cause:** Upstream corpus byte volume exceeded what content-hashing can do in 750ms p95. Correlate with `haiku.reconciliation.corpus.bytes`.
- **Diagnose:** Group `haiku.reconciliation.corpus.bytes` by intent — the largest corpora drive the latency.
- **Remediate:** Apply the same archive/cleanup pattern as [`drift-gate-latency-high`](#drift-gate-latency-high). Long-term: consider hashing only summary metadata (file count + mtime aggregate) for corpora >10MB; file as a follow-up, not an emergency.
- **Cross-reference:** Sibling target of [SLO 2](#slo-2--gate-latency). False-positive triage for the reconciliation gate itself is [Scenario 11](#scenario-11--reconciliation-gate-fires-on-a-stage-with-stable-corpus).
- **Rollback:** N/A.

### drift-oom-synthetic

- **Alert:** `drift-surface-oom-synthetic` (severity: ticket) — `sum by (intent_slug, stage) (rate(haiku.drift.baseline.oom_synthetic[1d])) > 0`
- **Cause:** Surface size for an intent exceeded the in-memory baseline threshold. The gate downgraded to one synthetic finding per stage. Detection still works; per-file fidelity is lost.
- **Diagnose:** Read `intent_slug` and `stage` off the emit. Cross-check `haiku.drift.surface.size` for the same intent/stage to see how far over the threshold it sits.
- **Remediate:** If the intent has accumulated cruft (old assessments, archived attachments), prune. If the intent is genuinely large, the synthetic baseline is correct behavior — no action. The user will see one finding per stage instead of one per file; they can drill into git for details.
- **Escalation:** If >3 intents cross the threshold in a single week, the in-memory threshold itself may need raising. File a follow-up issue; do not page.
- **Rollback:** N/A.

### drift-markers-churn

- **Alert:** `drift-markers-stale-burst` (severity: info) — `sum by (intent_slug, stage) (rate(haiku.drift.markers.stale_removed[1d])) > 10`
- **Cause:** Humans are touching files and reverting, OR an upstream tool (formatter, linter, git rebase) is churning the surface.
- **Diagnose:** Group `haiku.drift.markers.stale_removed` by intent + stage; inspect the git history of the affected files for a churn pattern.
- **Remediate:** Usually no action — informational. If a specific tool is the culprit (e.g., a pre-commit hook re-writing files unnecessarily), tune the tool. There is no per-path surface-ignore list; if one is needed, file feedback against the design stage rather than working around it locally.
- **Cross-reference:** A high marker churn that comes with sustained `open_count` growth indicates [Scenario 10 — Pending-marker store leak](#scenario-10--pending-marker-store-leak), not just informational churn.
- **Rollback:** N/A.

### drift-findings-mass-synthesized

- **Alert:** `drift-findings-mass-synthesized` (severity: ticket) — `sum by (intent_slug, stage) (rate(haiku.drift.findings.mass_synthesized[1d])) > 0`
- **Cause:** > 50% of the tracked surface for an intent/stage drifted in a single tick. The gate (`drift-detection-gate.ts` §9) collapses the per-file findings into one synthetic event when `findings.length > effectiveSurfaceSize * 0.5`. This is NOT a surface-size or memory-cap event — the trigger is *drift volume relative to surface*, not absolute surface size (a 40-file surface with 30 files changed fires the same as a 4000-file surface with 3000 changed). Detection still works; per-file diff fidelity is lost for this tick. Distinct from `drift-oom-synthetic` (above), which IS a surface-size event.
- **Most-likely root causes (check in order):** (1) a bulk regenerate / scaffolder script ran (e.g. `bun run export:workflow-diagrams`, codegen, formatter applied repo-wide); (2) a `git rebase`, `git merge`, or branch swap landed many files at once; (3) a large refactor or rename touched the majority of tracked files in one commit; (4) an upstream tool (linter on `--fix-all`, auto-formatter, AI bulk edit) rewrote the surface.
- **Diagnose:** The emit carries `intent_slug`, `stage`, `raw_findings_count`, `effective_surface_size`, and `drift_ratio` (= `raw_findings_count / effective_surface_size`). Confirm a bulk operation is responsible by inspecting the affected stage branch around the synthesis timestamp: `git log --since="<alert_time -10m>" --until="<alert_time +1m>" --stat <stage-branch>`. A single commit touching dozens of files (or a rebase landing many commits at once) is the smoking gun. If git is silent, check for out-of-band tooling: codegen scripts (search `package.json` `"scripts"` for export/regen tasks), editor format-on-save run across many files, or an interrupted AI agent session that rewrote the surface.
- **Remediate:** If the bulk operation was intentional and approved (regen, refactor) → no action; the synthesis fired correctly. The agent will see one finding per stage and either accept it or trigger a stage revisit. Per-file fidelity returns on the next tick once the new content is the baseline. If the bulk operation was unintentional (rogue script, accidental rebase) → identify the source, revert, and re-run the gate; the synthetic finding clears once `findings.length / effectiveSurfaceSize` drops below 0.5. Do NOT prune the surface (the trigger is not surface size — pruning will not stop the alert and may hide real drift). Do NOT raise the 0.5 ratio threshold without an architecture revision — it is the documented out-of-sync heuristic (ARCHITECTURE.md §8.3).
- **Escalation:** If mass synthesis fires repeatedly on the same intent/stage with no identifiable bulk operation, escalate to engineering — the gate may be misclassifying steady-state churn as mass drift, OR the baseline-establishment path is failing to capture writes. File an issue capturing `raw_findings_count`, `effective_surface_size`, and the affected stage branch.
- **Rollback:** N/A. The synthesis is read-only telemetry; nothing to roll back.

### kill-switch-engaged

- **Alert:** `kill-switch-engaged` (severity: ticket) — `sum by (intent_slug, stage) (rate(haiku.drift.gate.kill_switch_hit[1h])) > 0`
- **Cause:** `drift_detection: false` is set in `.haiku/settings.yml`. Detection is OFF — this is intentional but should not stay on indefinitely.
- **Canonical scenario:** [Scenario 2 — Kill-switch (per-stage drift detection disabled)](#scenario-2--kill-switch-per-stage-drift-detection-disabled) (full mechanism, scope clause, reconciliation companion).
- **Diagnose:** Read `.haiku/settings.yml` and confirm `drift_detection: false` is present (`isDriftDetectionDisabled` in `drift-baseline.ts:723` is the only consumer). Check `git log .haiku/settings.yml` for who toggled it and when.
- **Remediate:** Remove or set `drift_detection: true` in `.haiku/settings.yml`. The next `haiku_run_next` tick emits `haiku.drift.gate.tick` instead of `kill_switch_hit`. **Do not** add `HAIKU_DRIFT_GATE_DISABLED` env var or any other off-switch — there is exactly one kill mechanism (the settings flag); inventing alternates is what produced the duplicated runbook this fix removed.
- **Escalation:** If the kill-switch has been on for >24h without a follow-up issue tracking resolution, file an issue and tag whoever set it. Long-running kill-switches mask other problems and burn the SLO 1 budget invisibly.
- **Rollback:** Re-set `drift_detection: false` if a regression appears immediately after re-enabling.

### assessments-stuck

- **Alert:** `assessments-zero-completion` (severity: info, possible false-positive) — `assessments.count[6h] > 0 AND assessments.resolved[6h] == 0`
- **Cause:** Drift assessments dispatched (`haiku.drift.assessments.count` ticked up) but the agent did not emit a corresponding resolution event. Possible loop, stuck agent, or missing resolution telemetry.
- **Telemetry coverage gap (KNOWN):** This alert depends on a `haiku.drift.assessments.resolved` event that does not yet exist. The alert is informational and may produce false positives until the resolution emit is wired. Tracked as future telemetry coverage work; do NOT silence the alert — the false positives are themselves diagnostic.
- **Canonical scenarios:** [Scenario 6 — Manual change assessment classification went wrong](#scenario-6--manual-change-assessment-classification-went-wrong) and [Scenario 9 — Drift assessments panel shows stale or empty findings](#scenario-9--drift-assessments-panel-shows-stale-or-empty-findings) cover the two upstream causes.
- **Diagnose:**

  ```bash
  # 1. List recently-dispatched, possibly-unresolved assessments
  find .haiku/intents/*/stages/*/drift-assessments -type f -newer /tmp/.6h-ago

  # 2. Check the agent's recent run-tick output for a stuck classification loop
  tail -200 ~/.claude/logs/mcp.log | grep manual_change_assessment
  ```

- **Remediate:** Agent intervention — instruct the agent to resolve the open assessment (`haiku_run_next` should pick it up). If the agent loops indefinitely, manually move the assessment file to `.resolved-manual/<ts>/` and document the case as a follow-up.
- **Escalation:** If assessments accumulate across many intents (>20 unresolved over 24h), the dispatch-vs-resolution loop is likely broken — file an incident.
- **Rollback:** N/A.
