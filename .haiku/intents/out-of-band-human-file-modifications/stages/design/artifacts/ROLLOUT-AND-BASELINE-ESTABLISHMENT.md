# Rollout & Baseline-Establishment Specification

*Design artifact for the `out-of-band-human-file-modifications` intent. This document specifies the first-tick-after-upgrade semantics, the baseline-establishment protocol, the per-stage `drift_baseline_established_at` marker, the kill-switch feature flag, reset semantics, steady-state operator metrics, and the telemetry event set. The development stage implements against this document and against `ARCHITECTURE.md`, which specifies the gate algorithm and data shape this document's fields plug into. These two documents form a consistent pair: `ARCHITECTURE.md` describes WHEN the gate runs and WHAT it computes; this document describes the FIRST-TICK behavior, the ESTABLISH-MODE semantics, and the EMERGENCY DISABLE flag.*

*No TypeScript file paths, function signatures, or shell commands appear in this document. Capability-level rules and named fields only.*

---

## 1. The False-Positive Storm Problem

DISCOVERY.md § "Risks: False positives storm" names the highest-priority rollout risk: without a deliberate establishment protocol, the first `haiku_run_next` tick after the feature ships fires `manual_change_assessment` for every file in every running intent that has drifted from its agent-last-written state for any reason. Existing intents may have dozens of such files — manual cleanups, git rebases, a designer's staged work, a PO's edits that predate the feature. Every one of them would become an assessment event on the same tick. This is an unacceptable flood.

The solution is a monotonic per-stage establishment marker that the drift-detection gate reads before emitting any events. When the marker is absent, the gate runs in **establish mode** — it records baselines but emits nothing. When the marker is present, the gate runs in **normal mode** — it compares against baselines and emits events for divergences. The marker is written exactly once per stage, on the tick where establishment completes, and never cleared by normal operation. The flood risk drops to zero because every pre-existing file, including every drifted file, is absorbed into the baseline during the silent establishment tick.

---

## 2. The `drift_baseline_established_at` Field

### 2.1 Location

The `drift_baseline_established_at` field lives in the per-stage `state.json` file at the same path level as other stage state fields:

```
.haiku/intents/{slug}/stages/{stage}/state.json
```

It is a top-level field on the stage state object, not nested inside a sub-object.

### 2.2 Shape

```
drift_baseline_established_at: string (ISO 8601 timestamp) | null
```

- **`null` or absent** — the stage has never run the drift-detection gate in establish mode to completion. This state triggers establish mode on the next tick.
- **ISO 8601 timestamp string** — the UTC timestamp at which the gate completed baseline establishment for this stage. Once written, this field is never cleared by normal operation. It is a monotonic write-once field.

The timestamp is the wall-clock time at the moment the gate writes the `baseline.json` file and the field together. It is informational — it enables operators to reason about when a given stage's baseline was established and whether it predates a suspicious drift event — but the gate's behavior depends only on the presence or absence of the field, not on its value.

### 2.3 Establish Mode vs. Normal Mode

| Condition | Mode | What the gate does |
|---|---|---|
| `drift_baseline_established_at` is `null` or absent | **Establish mode** | Enumerate tracked surface, compute SHAs, write `baseline.json`, write `drift_baseline_established_at` to `state.json`, emit zero drift events |
| `drift_baseline_established_at` is a timestamp string | **Normal mode** | Read `baseline.json`, compare against on-disk SHAs, emit drift events for divergences, dispatch `manual_change_assessment` if findings exist |

The rule is binary. There is no "partial establishment" state. The gate either writes the baseline and the marker together in the same tick (atomic with respect to the workflow engine's state-write pipeline), or it does not run establish mode at all. A crash between the `baseline.json` write and the `drift_baseline_established_at` write means the next tick observes `null` and re-runs establishment — the `baseline.json` is overwritten with the current state. This is safe because establish mode never fires drift events; the worst outcome of a double-establishment is a slightly newer baseline snapshot.

### 2.4 Monotonic Guarantee

Once `drift_baseline_established_at` is written, it persists across:

- Agent bolt completions
- Stage gate advances
- Branch switches within the intent's worktree
- The `haiku_intent_reset` operation **only if explicitly cleared** — reset semantics are specified in Section 7 below
- Plugin upgrades and version changes

The field is **never** overwritten with a newer timestamp by the drift-detection gate. If a situation arises that requires re-establishing the baseline (e.g., after a `haiku_repair` that detects baseline corruption), the repair tool sets `drift_baseline_established_at` back to `null`, which causes the next tick to re-run establishment. Re-establishment produces a new `baseline.json` and a new `drift_baseline_established_at` timestamp. The prior timestamp is lost; the new timestamp is the authoritative establishment time.

---

## 3. First-Tick-After-Upgrade Behavior

### 3.1 What Fires and What Does Not

On the first `haiku_run_next` tick for any intent stage that lacks a `drift_baseline_established_at` field (which is every stage in every existing intent on the first tick after the feature ships), the pre-tick gate runs in establish mode. The following table is definitive:

| Gate behavior | Establish mode | Normal mode |
|---|---|---|
| Enumerate tracked surface | **Yes** | Yes |
| Compute SHA-256 for each tracked file | **Yes** | Yes |
| Compare SHA against baseline | **No** — no baseline exists yet | Yes |
| Emit drift events | **No — zero events emitted** | Yes, if divergences found |
| Dispatch `manual_change_assessment` | **No** | Yes, if drift events exist |
| Write `baseline.json` | **Yes — full surface snapshot** | Only for files with terminal-outcome classifications |
| Write `drift_baseline_established_at` | **Yes — set to current UTC timestamp** | No |
| Block tick from advancing to per-state dispatch | **No** | Yes, if drift events dispatched |

No `manual_change_assessment` fires during establish mode. No `ignore`, `inline-fix`, `surface-as-feedback`, or `trigger-revisit` outcome is produced. The agent does not receive a drift-detection prompt on the establishment tick. The tick proceeds directly to per-state dispatch after the gate writes the baseline and the marker.

The first tick that fires drift events for actual human edits is the **second tick** after the feature ships — or more precisely, the first tick after establishment where the on-disk state of a tracked file diverges from the established baseline.

### 3.2 Author-Class Default During Establishment

Every file written to the baseline during establish mode receives `author_class: "agent"`. This is the conservative default because no provenance signal is available for files that predate the feature. The rationale for this choice is asymmetric risk:

**False-negative is acceptable:** A file that was actually written by a human before the feature shipped but is tagged `author_class: "agent"` in the baseline will not trigger a drift event for that prior human write. The human's edit is effectively absorbed. This is acceptable — it mirrors the behavior of any tool that starts tracking state from now rather than retroactively auditing all of history.

**False-positive is not acceptable:** If the default were `author_class: "human-implicit"`, the gate might behave unexpectedly on the first normal-mode tick for files that are re-written by the agent in that tick (since the agent sees a `human-implicit` file and might over-classify it). More critically, any scenario where the system misidentifies a pre-existing agent-written file as a human write and fires assessment events based on that misidentification constitutes a false-positive storm — exactly the risk DISCOVERY.md names as the top-priority rollout concern.

The `author_class: "agent"` default is the only choice that guarantees zero false positives during the establishment window. False-negative acknowledgment of pre-feature human writes is an accepted, explicitly documented trade-off.

### 3.3 No Migration Script Required

There is no separate migration script for existing intents. No database backfill. No one-time job. No manual operator action required to prepare existing intents for the feature.

The establish-mode logic handles every existing intent transparently on its next tick. The mechanism is:

1. The feature ships as part of a normal plugin version bump.
2. Every intent stage that lacks `drift_baseline_established_at` is automatically an establish-mode candidate.
3. The first `haiku_run_next` invocation on each intent triggers establishment for all its stages.
4. Subsequent ticks run in normal mode with no operator involvement.

**Development stage: do not write a one-time backfill script.** A backfill would require coordinating against live intents, risk race conditions with concurrent `haiku_run_next` calls, and add rollout complexity for zero benefit — the per-tick establishment logic is strictly simpler and strictly safer. Any migration script that pre-populates `drift_baseline_established_at` or `baseline.json` for existing intents before the feature ships is out of scope for this design and should not be implemented.

---

## 4. Establish-Mode Visibility in the SPA

### 4.1 Initializing Indicator

During the one-tick window when a stage is running in establish mode, the SPA displays an **"drift detection initializing"** indicator on that stage's card in the intent overview. The indicator is a passive informational chip, not a blocking state — the user can still interact with the intent normally while establishment runs.

### 4.2 Indicator Lifecycle

| SPA state | Condition |
|---|---|
| Indicator visible | `drift_baseline_established_at` is `null` or absent for the stage |
| Indicator removed | `drift_baseline_established_at` is set (non-null) |

Because establishment completes in a single tick, the indicator is visible for at most the duration between the tick that triggers establishment and the tick's completion. In practice, for most users, the indicator appears briefly and clears before the user notices. For intents where the tracked surface is large (many knowledge files, many design artifacts), the establishment scan may take a few seconds — the indicator provides feedback that the system is doing work.

The indicator is **not** a spinner or a blocking overlay. Chip styling for the establish-mode indicator is intentionally deferred to the development stage's design-system pass; the indicator is a text label in a neutral container with no interactive affordance until then. ARIA semantics and contrast tokens are determined when the chip is implemented, alongside the rest of the SPA's status-chip family.

### 4.3 Multi-Stage Establishment

An intent with multiple stages (e.g., `inception`, `design`, `development`) may have several stages simultaneously lacking `drift_baseline_established_at` on the first tick after upgrade. Each stage establishes independently: the gate runs establish mode for each stage whose marker is absent. The SPA may show the indicator on multiple stage cards simultaneously. Each stage's indicator clears independently when that stage's establishment tick completes.

---

## 5. Per-Stage Establish-Mode Isolation

### 5.1 New Stage on an Existing Intent

When a new stage is added to an existing intent post-upgrade — for example, a studio adds a `qa` stage that did not exist at intent inception — that stage's first tick runs in establish mode for its own tracked paths only. The rule is:

- Establish mode is triggered per stage by the absence of `drift_baseline_established_at` in that stage's `state.json`.
- A new stage starts with no `state.json` (or a `state.json` that lacks the field), so its first tick is always an establishment tick.
- Establishing one stage's baseline does not affect any other stage's `baseline.json`, `drift_baseline_established_at`, or marker state.

### 5.2 Cross-Stage Isolation Contract

The isolation is absolute:

- **Stage A's establishment does not re-establish Stage B.** If Stage B has already established its baseline, Stage A's establishment tick leaves Stage B untouched.
- **Stage A's drift events do not pause Stage B's establishment.** The two gates run sequentially within a single tick but their outputs are independent.
- **A baseline-corrupt condition in Stage A does not force re-establishment in Stage B.** `haiku_repair` targets a specific stage when clearing `drift_baseline_established_at`.

This isolation is what makes the rollout safe. An operator adding a new stage to a running intent — a common pattern when studios evolve — gets establish-mode safety for the new stage without disturbing the already-established baselines of the stages that have been running normally.

---

## 6. Steady-State Metrics

An operator running the drift-detection feature in steady state should observe the following patterns to confirm health:

### 6.1 Baseline File Count

**Healthy:** The number of entries in `baseline.json` for each stage equals the number of files currently in the stage's tracked surface. As files are added (new knowledge artifacts, new design outputs), the baseline grows. As files are deleted and classified as `ignore` (their entries are updated to reflect the deletion), the count may shrink. The key signal is that the counts are not frozen at the establishment-time snapshot — they move with the actual tracked surface.

**Unhealthy signal:** A `baseline.json` whose entry count has not changed across many ticks while the tracked surface visibly grew (new files present on disk, new outputs committed). This suggests the gate is not running or is in a continuous establish loop.

### 6.2 Drift Events Per Tick in Agent-Only Operation

**Healthy:** Near zero. In a normally-operating intent where no human has edited tracked files between ticks, the gate should find no SHA divergences and emit no drift events. The `manual_change_assessment` action should not fire in agent-only operation.

**Expected spike:** When a human edits a tracked file, the next tick produces one or more drift events. The `manual_change_assessment` action fires, the agent classifies, and the baseline is updated. The tick after classification, drift events return to zero for the affected files (assuming the classification was terminal — `ignore` or `inline-fix`; non-terminal outcomes leave the pending-assessment marker in place and suppress re-emission).

**Healthy post-edit pattern:** Spike to N drift events on the tick after the human edit → zero events (or suppressed-by-marker) on subsequent ticks → zero events once the marker clears after downstream resolution.

### 6.3 Classification Distribution

In a well-functioning intent with normal human collaboration, the agent's classification decisions should distribute roughly as follows (this is a qualitative signal, not a hard threshold):

- **`ignore`:** Small fraction. Genuinely ignorable changes (temp files, trivial normalization) should be rare in a tracked surface that excludes `.git/**` and known-noise paths.
- **`inline-fix`:** Most common in design and knowledge-intensive stages. Deliberate human improvements to artifacts or knowledge files are the primary use case.
- **`surface-as-feedback`:** Present but not dominant. Structural concerns, ambiguous binary changes, and unexpected deletions.
- **`trigger-revisit`:** Rare. Revisit should be triggered only for changes that genuinely invalidate prior stage work.

A distribution dominated by `surface-as-feedback` across many ticks may indicate the agent's context for classifying changes is insufficient, or that the tracked surface contains files the operator did not intend to be human-editable.

### 6.4 Telemetry Event Rates

The telemetry events defined in Section 8 provide the raw data for all of the above metrics. Operators should observe:

- `baseline-established` fires exactly once per stage per intent (or again after a `haiku_repair` reset). Repeated `baseline-established` events for the same stage signal a crash-loop in the establish-write pipeline.
- `drift-detected` rate tracks the human-edit frequency for the intent.
- `classification-emitted` rate tracks assessment completions. Should be <= `drift-detected` rate (because some findings may be batched into a single assessment dispatch).
- `baseline-updated` rate tracks how quickly the baseline converges after drift is detected. A gap between `drift-detected` and `baseline-updated` reflects in-flight non-terminal assessments.
- `kill-switch-toggled` should be zero in normal operation. Any occurrence is a signal of an operator incident or a deliberate controlled rollout.

---

## 7. Reset Semantics

### 7.1 `/haiku:reset` and `haiku_intent_reset`

The `/haiku:reset` command and the `haiku_intent_reset` MCP tool perform a destructive reset of an intent — they clear all stage state, unit state, feedback, and accumulated workflow history and recreate the intent from its initial specification. When a reset occurs:

- All per-stage `state.json` files are cleared or recreated, which means `drift_baseline_established_at` is cleared (the field is absent in the new `state.json`).
- All `baseline.json` files for all stages are deleted as part of the state-directory cleanup.
- `drift-markers.json` is deleted.
- `write-audit.jsonl` is deleted (it is part of the intent state, not a permanent audit record).
- All `drift-assessments/DA-*.json` records are deleted.

After reset, the intent is in the same state as a brand-new intent: `drift_baseline_established_at` is absent on every stage, no baselines exist, and the next `haiku_run_next` tick runs establish mode for each stage as it activates. The reset effectively starts the drift-detection lifecycle over from zero.

This is correct behavior. A reset is a destructive operation by design. Users who invoke reset understand they are clearing state. The baseline files, markers, and assessment records are all part of the accumulated state of the intent cycle; they go away with everything else.

### 7.2 Partial Resets

`haiku_repair` may perform targeted resets on individual damaged components without resetting the entire intent. For drift-detection-specific repair:

- If `haiku_repair` detects a corrupt `baseline.json` for a stage, it may delete that file and set `drift_baseline_established_at` to `null` for that stage only. This triggers a single-stage re-establishment on the next tick without disturbing other stages.
- If `haiku_repair` detects a corrupt `drift-markers.json`, it may delete the file. The next tick proceeds without marker suppression (degraded mode per `ARCHITECTURE.md` §8.4).
- `haiku_repair` does not delete `write-audit.jsonl` or `drift-assessments/DA-*.json` — those are append-only audit records and their integrity is independent of the baseline mechanism.

### 7.3 Establishing After Reset

The re-establishment after reset follows the same first-tick-after-upgrade semantics defined in Section 3. No special reset-specific logic is required. The absence of `drift_baseline_established_at` is the sole trigger for establish mode; the reason for its absence (first deploy, post-reset, or post-repair) is irrelevant to the gate.

---

## 8. Kill-Switch: `drift_detection: false`

### 8.1 Purpose

DISCOVERY.md § "Risks: False positives storm" identifies false-positive storms as the top rollout risk. This architecture addresses that risk primarily through the establish-mode protocol (Section 2). However, a second failure mode exists: bugs in the drift-detection gate or baseline-update logic that produce false positives on specific intent shapes, in specific stages, or with specific file combinations. For these post-deployment incidents, a rapid disable path is required that does not require a plugin rollback or manual state surgery on affected intents.

The `drift_detection` plugin-settings flag is that path. `ARCHITECTURE.md` §8.5 specifies the gate's no-op behavior when the flag is set; this section specifies the flag's location, default, operator semantics, and re-enable behavior.

### 8.2 Flag Location

The flag is a boolean field in the plugin-settings object — the same settings surface where harness selection, provider configuration, and other plugin-wide toggles are stored. The field name is `drift_detection`.

```
drift_detection: boolean   // default: true (absent = feature enabled)
```

Setting the flag requires modifying the plugin settings, which is within the `haiku_settings_get` / `haiku_settings_set` MCP tool surface or equivalent operator-accessible configuration path. The flag is not per-intent and not per-stage: it is plugin-wide. When set to `false`, it disables drift detection for every intent in the plugin's scope simultaneously.

### 8.3 Default Value

The default value when the field is absent from plugin settings is `true` — drift detection is **on** by default when the plugin ships. Operators who want to stage the rollout (enabling per-project rather than globally) should set `drift_detection: false` as the initial state in each project's plugin settings and flip it to `true` per project once they are satisfied with the baseline establishment on that project's intents.

### 8.4 Behavior When `drift_detection: false`

When the flag is `false`, the pre-tick drift-detection gate is a **complete no-op**. The gate does not execute. The gate does not:

- Enumerate the tracked surface
- Compute SHA-256 hashes for any file
- Read `baseline.json` or `drift-markers.json`
- Emit any drift events
- Dispatch `manual_change_assessment`
- Block, halt, or gate the tick in any way

The pre-tick gate chain reduces to `tamper-detection → feedback-triage → per-state dispatch`, exactly as it existed before the feature shipped.

In addition, when `drift_detection: false`:

- The `manual_change_assessment` action is **never dispatched**, because the gate that emits it does not run.
- The human-attributed-write MCP tool still writes files to disk but **does not** write an entry to `write-audit.jsonl` and does not participate in the baseline protocol. Its writes are functionally equivalent to normal agent writes.
- SPA upload endpoints still write files to disk (the upload affordance is not removed) but do not stamp the action log with `human-via-mcp` entries and do not expect assessment on the next tick. Uploaded files land silently.

### 8.5 Baseline Files When Disabled

Existing `baseline.json` and `drift-markers.json` files are **left on disk untouched** when the flag is set to `false`. They are not deleted, not migrated, not drained. The disable is a gate-skip, not a state purge.

### 8.6 Re-Enable Behavior (Baselines Persist)

When an operator sets `drift_detection` back to `true` after a period of disabled operation, the gate resumes from the existing baseline state. Specifically:

- **`drift_baseline_established_at` is consulted** on the next tick. If it is present (non-null), the gate runs in normal mode — it compares current on-disk SHAs against the `baseline.json` that was written before the flag was set to `false`.
- **Drift accumulated during the disabled window is visible.** Any files that changed while the feature was disabled will show SHA divergences against the pre-disable baseline. These divergences produce drift events on the first post-re-enable tick. This is correct behavior: the gate observed no changes while disabled, so the entire accumulated delta appears as a single batch of drift events.
- **No automatic re-establishment on re-enable.** The gate does not clear `drift_baseline_established_at` or delete `baseline.json` when re-enabled. If an operator wants to absorb the disabled-window changes silently (to avoid classifying them as human drift), they should set `drift_baseline_established_at` to `null` (or delete `baseline.json`) for the affected stages before re-enabling. This triggers one more establish-mode tick, which absorbs the accumulated changes without firing events.

**Development stage: do not re-establish on re-enable.** The re-establish-on-re-enable behavior would silently discard any human edits that arrived during the disabled window — exactly the kind of silent write loss the feature was designed to prevent. Re-establishing on re-enable is the wrong behavior. The operator should make the explicit choice to absorb or classify the disabled-window delta; the flag toggle itself should not make that choice.

### 8.7 Kill-Switch and Classification Actions

When `drift_detection: false`, the classification actions (`ignore`, `inline-fix`, `surface-as-feedback`, `trigger-revisit`) are also not dispatched, because the gate that emits the findings that trigger classification does not run. The classification step is downstream of the gate; a disabled gate means no classification.

Assessment records (`drift-assessments/DA-*.json`) already written before the flag was set are unaffected. They remain readable via the SPA's drift assessment view as a historical record of what was found and classified before the disable. They are not deleted on disable.

### 8.8 Operator Scenarios

The flag is designed for three specific scenarios:

**Incident response:** A bug in the gate is producing false-positive drift events at scale on a class of intents. The operator sets `drift_detection: false` to stop the bleeding immediately. Existing intents continue operating with the pre-feature gate chain. The bug is investigated and fixed in a patch release. The operator sets `drift_detection: true` once the patch is deployed, expecting one batch of accumulated-delta events per affected intent.

**Controlled rollout:** A cautious operator is deploying to a fleet of intents and wants to establish baselines one project at a time rather than triggering a global establishment wave on the first tick after upgrade. The operator sets `drift_detection: false` globally, then enables per-project by flipping it to `true` project by project. Each project's first tick runs in establish mode. No false-positive flood.

**Diagnostics:** An operator suspects the drift-detection gate is interacting badly with another feature (e.g., the feedback-triage gate, a new hook, a worktree operation). Setting the flag to `false` isolates the variable. Normal operation resumes; if the problem goes away, the gate is the culprit.

The flag is **not** intended for permanent steady-state use with drift detection off. Long-term per-intent suppression is not in scope for v1.

---

## 9. Telemetry

### 9.1 Format

All telemetry events are structured log entries written to the intent's existing structured log channel. There is no separate telemetry pipeline — events write to the same append-only log stream that the workflow engine already uses. Each event is a JSON object on a single line with a fixed envelope and event-specific fields.

**Envelope:**

```json
{
  "event": "<event-name>",
  "intent": "<slug>",
  "stage": "<stage-id>",
  "tick_counter": <number>,
  "timestamp": "<ISO 8601 UTC>",
  ... <event-specific fields>
}
```

The `stage` field is `null` for events that are not stage-scoped (e.g., `kill-switch-toggled`, which is plugin-wide).

### 9.2 Named Events

The following five events are the minimum telemetry set for the drift-detection feature. All five must be implemented by the development stage; no additional telemetry pipeline is required.

#### `baseline-established`

**When:** Emitted once per stage per intent, at the end of the first establish-mode tick that writes `baseline.json` and sets `drift_baseline_established_at`.

**Event-specific fields:**

```json
{
  "event": "baseline-established",
  "intent": "out-of-band-human-file-modifications",
  "stage": "design",
  "tick_counter": 3,
  "timestamp": "2026-05-12T14:23:01Z",
  "file_count": 14,
  "surface_paths": ["stages/design/artifacts/**", "stages/design/knowledge/**", "knowledge/**"]
}
```

`file_count` is the number of files written to the baseline. `surface_paths` is the list of glob patterns that were scanned.

**What it enables:** Operators can verify that every stage in every intent established its baseline exactly once. Repeated `baseline-established` events for the same stage signal a crash-loop or repair loop.

#### `drift-detected`

**When:** Emitted once per drift event emitted by the gate (i.e., once per file that shows SHA divergence or appears/disappears). If the gate emits three drift events in a single tick, three `drift-detected` entries are written.

**Event-specific fields:**

```json
{
  "event": "drift-detected",
  "intent": "out-of-band-human-file-modifications",
  "stage": "design",
  "tick_counter": 7,
  "timestamp": "2026-05-12T15:44:22Z",
  "file_path": "stages/design/artifacts/hero-layout.html",
  "event_type": "modified",
  "author_class": "human-implicit",
  "is_binary": false
}
```

No SHA values or diff payloads are written to telemetry — those are in the assessment record (`drift-assessments/DA-NN.json`). Telemetry is for rate-monitoring, not for diff review.

**What it enables:** Operators can track how frequently humans edit tracked files, identify hotspots (files that drift repeatedly), and correlate drift spikes with workflow events.

#### `classification-emitted`

**When:** Emitted once per finding classification recorded in a `manual_change_assessment` response. If the agent classifies three findings in a single assessment dispatch, three `classification-emitted` entries are written.

**Event-specific fields:**

```json
{
  "event": "classification-emitted",
  "intent": "out-of-band-human-file-modifications",
  "stage": "design",
  "tick_counter": 7,
  "timestamp": "2026-05-12T15:44:35Z",
  "file_path": "stages/design/artifacts/hero-layout.html",
  "finding_id": "DRF-01",
  "outcome": "inline-fix",
  "assessment_id": "DA-03"
}
```

`assessment_id` cross-references the durable assessment record for the full rationale.

**What it enables:** Operators can verify that all detected drift events are classified (no findings left unclassified), track classification outcome distribution, and identify patterns that suggest the classification logic is miscalibrated.

#### `baseline-updated`

**When:** Emitted each time the baseline entry for a file is updated to a new SHA — either at terminal-outcome classification (`ignore` or `inline-fix`) or at downstream-resolution for a non-terminal outcome (`surface-as-feedback` or `trigger-revisit`, when the marker clears).

**Event-specific fields:**

```json
{
  "event": "baseline-updated",
  "intent": "out-of-band-human-file-modifications",
  "stage": "design",
  "tick_counter": 7,
  "timestamp": "2026-05-12T15:44:36Z",
  "file_path": "stages/design/artifacts/hero-layout.html",
  "prior_sha": "abc123ef",
  "new_sha": "def456ab",
  "author_class": "human-implicit",
  "trigger": "classification" 
}
```

`trigger` is either `"classification"` (terminal-outcome update) or `"marker-cleared"` (non-terminal downstream-resolution update).

**What it enables:** Operators can verify that baselines converge after drift is detected. A large gap between `drift-detected` count and `baseline-updated` count indicates in-flight non-terminal assessments that have not yet resolved.

#### `kill-switch-toggled`

**When:** Emitted whenever the `drift_detection` plugin-settings flag changes value — both when it changes from `true` to `false` (disable) and when it changes from `false` to `true` (re-enable).

**Event-specific fields:**

```json
{
  "event": "kill-switch-toggled",
  "intent": null,
  "stage": null,
  "tick_counter": null,
  "timestamp": "2026-05-13T09:01:42Z",
  "prior_value": true,
  "new_value": false,
  "toggled_by": "operator"
}
```

`toggled_by` is `"operator"` for manual settings changes. `intent`, `stage`, and `tick_counter` are `null` because this is a plugin-wide event, not scoped to a specific intent or tick.

**What it enables:** Operators can audit when and how often the kill-switch is used. Zero `kill-switch-toggled` events in production is the healthy steady-state. Any occurrence flags an incident or a deliberate controlled-rollout action that should be correlated with incident reports or rollout logs.

### 9.3 No Separate Telemetry Pipeline

All five events write to the intent's existing append-only log stream. No new log files, no external analytics endpoints, no background reporting agents. The structured-log format ensures the events are machine-parseable for post-hoc operator analysis without requiring a live monitoring infrastructure.

---

## 10. Consistency With ARCHITECTURE.md

This document and `ARCHITECTURE.md` form a consistent pair:

| This document specifies | `ARCHITECTURE.md` specifies |
|---|---|
| The `drift_baseline_established_at` field name, location, and monotonic semantics | The gate algorithm that reads the field and branches on its presence |
| Establish mode: what fires and what does not | The gate computation table (§3.5) that governs per-file outcomes |
| Author-class default during establishment (`agent`) | The baseline data shape (§2.1) that carries `author_class` |
| No migration script required | N/A (implementation-only concern) |
| The kill-switch flag: `drift_detection: false`, location, behavior, re-enable | Gate behavior when flag is set (§8.5): "complete no-op" |
| Re-enable behavior: baselines persist, no re-establish | Gate resumes from existing baseline per §3.4/§8.5 |
| Reset semantics: field and baseline files cleared | `haiku_intent_reset` coverage (§8.1 notes repair coverage) |
| Telemetry event names and shapes | N/A (telemetry is not in ARCHITECTURE.md scope) |
| SPA "initializing" indicator lifecycle | DESIGN-BRIEF / SPA-UI-SPECS own the visual component |

Where this document names the flag (`drift_detection`), its location (plugin settings), and its behavior when set (gate + classification both no-op), `ARCHITECTURE.md` §8.5 cross-references this document as the authoritative source: "The flag is specified in detail in unit-05's `ROLLOUT-AND-BASELINE-ESTABLISHMENT.md`; this section names the contract the architecture honors."

No duplication of content across the two documents. Each cites the other for the portion it does not own.
