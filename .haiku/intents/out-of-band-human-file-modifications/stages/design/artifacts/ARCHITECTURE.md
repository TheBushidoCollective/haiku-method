# Drift-Detection Architecture Spec

*Load-bearing technical-design document for the `out-of-band-human-file-modifications` intent. The development stage implements against this document. Anything architectural not specified here is a development-stage decision.*

---

## 1. Overview

H·AI·K·U's workflow engine currently treats the agent as the sole legitimate writer of intent-associated files. When a human modifies a tracked file outside the agent's tool-use pipeline — dropping a layout into the stage outputs directory, editing a knowledge document, or uploading a file through the SPA — the next `haiku_run_next` tick proceeds as if the file is unchanged. The change is invisible to the workflow engine, and the agent's next bolt may silently clobber the human's work.

This architecture introduces three coordinated additions to close that gap:

1. **A baseline storage layer** — a per-stage SHA index recording the content hash and author class of every file in the tracked surface at the time the agent last acknowledged it.
2. **A pre-tick drift-detection gate** — a gate in the existing pre-tick gate chain that walks the tracked surface on every tick, computes current SHAs, diffs against the baseline, and emits structured drift events when divergence is found.
3. **A `manual_change_assessment` workflow action** — a new first-class workflow action dispatched when the gate emits drift events. The agent receives the structured diff payload and classifies each finding into one of four outcomes: `ignore`, `inline-fix`, `surface-as-feedback`, or `trigger-revisit`.

The design honors the decisions recorded in `knowledge/DESIGN-DECISIONS.md` throughout. Every decision reference below names the decision by number for traceability. The design also addresses every open design-stage decision listed in DESIGN-DECISIONS.md § "Open for Design."

---

## 2. Baseline Storage Layer

### 2.1 Abstract Data Shape

The baseline is a map keyed by file path (relative to the intent directory) to a record with three fields:

```
tracked-file-path →
  sha:              string       // SHA-256 hex digest of the file's full content at last acknowledgment
  author_class:     "agent" | "human-via-mcp" | "human-implicit"
  last_updated_tick: number      // The tick counter value at the time this entry was written or acknowledged
```

The `sha` field is a content hash computed over the file's full byte content. For binary files the hash is the same algorithm — SHA-256 over raw bytes — so the baseline is format-agnostic.

The `author_class` field carries one of three values:

- **`agent`** — the agent wrote the file via its normal MCP tool pipeline. The baseline was updated by the agent's own write action.
- **`human-via-mcp`** — the file was written by the sanctioned human-attributed-write MCP tool (the tool that lets the agent write a file on explicit user instruction while attributing the result to the human). The tool stamps this class at write time.
- **`human-implicit`** — the file's SHA in the baseline does not match the on-disk SHA, no intervening agent stamp exists for the file in the current tick's action log, and the entry was updated by the drift-detection gate after the gate classified the prior finding as terminal (ignore or inline-fix). This class is inferred — it is not asserted by a tool call. The rule: *any baseline-tracked file whose SHA changed without an intervening agent stamp is treated as human-implicit until the assessment classifies and closes it.*

The three author-class values are the full taxonomy. There is no fourth value. Author class on a given entry reflects the last write that the workflow engine acknowledged for that file, not a history of all writes.

### 2.2 Storage Location

The baseline lives under the intent's existing state directory hierarchy:

```
.haiku/intents/{slug}/stages/{stage}/baseline.json
```

One file per stage, structured as a JSON object whose keys are paths relative to the intent directory (e.g., `stages/design/outputs/hero.html`) and whose values are the record shape above. This placement has three properties that matter:

- It is collocated with `state.json` — the workflow engine already reads from this directory on every tick, so no new I/O path is introduced.
- It survives branch switches and worktree operations because it is committed to git alongside the rest of the intent state.
- It is scoped per stage, which aligns with the fact that tracked surfaces are defined per stage. Cross-stage entries (files produced by an earlier stage but modified while a later stage is active) are stored in the baseline file of the stage that originally produced the file, not the currently-active stage.

The format is deliberately deferred to development (JSON is named as the default because it is consistent with `state.json`, but the contract is the abstract data shape above, not JSON specifically).

### 2.3 Write Triggers

The baseline is written in four situations:

1. **After every agent write to a tracked file.** When the agent writes a file through its MCP tool pipeline (Write, Edit, or equivalent), the baseline entry for that file is updated immediately with the new SHA and `author_class: "agent"`. The tick counter at the time of the write is recorded in `last_updated_tick`.

2. **After the `manual_change_assessment` action classifies a finding originating from a human-attributed-write MCP tool call.** The sanctioned tool for agent-writes-on-behalf-of-human writes the file to disk and stamps an action-log entry marking the write as `human-via-mcp` (mirroring the SPA upload pathway in §7.3). The tool does **not** update `baseline.json` directly. The next pre-tick drift gate observes the SHA divergence, emits a drift event with `author_class: "human-via-mcp"`, and dispatches `manual_change_assessment`. The baseline is updated when the agent classifies the finding (terminal outcomes update immediately; non-terminal outcomes update on resolution). This unifies all three human-mediated write paths (filesystem drop, SPA upload, human-attributed MCP tool) through the same detection-and-classification flow, per Decision 1 in DESIGN-DECISIONS.md.

3. **After the `manual_change_assessment` action classifies a terminal finding (ignore or inline-fix).** When the agent classifies a drift event with either terminal outcome, the baseline entry for the affected file is updated immediately to the current on-disk SHA with `author_class: "human-implicit"` (or the class carried in the pending-assessment marker, if one exists — see §5).

4. **On first-tick baseline establishment.** When the baseline file for a stage does not exist (new stage, or first tick after the feature ships for an existing intent), the gate records every tracked file's current SHA as the baseline without emitting drift events. See §3.4.

### 2.4 Read Triggers

The baseline is read exactly once per tick, during the drift-detection gate's execution (§3). The gate reads the baseline file at the start of its scan, holds it in memory for the duration of the scan, and does not re-read mid-scan. No other component reads the baseline directly — all consumers go through the drift events emitted by the gate.

---

## 3. Pre-Tick Drift-Detection Gate

### 3.1 Position in the Gate Chain

The existing pre-tick gate chain runs between the tamper-detection check and the per-state dispatch handler on every `haiku_run_next` tick. The ordering after this architecture ships is:

```
tamper-detection → feedback-triage → drift-detection → per-state dispatch
```

Tamper-detection runs first because it is a hard integrity check — a tampered state signals corruption and must block everything else. Feedback-triage runs second because untriaged feedback may require immediate relocation before the drift gate can determine which stage a file belongs to (cross-stage feedback triage may move files). Drift-detection runs third, after the intent's stage topology is clean. Per-state dispatch runs last and is skipped if either of the two gates emits a blocking action.

If feedback-triage emits a `feedback_triage` action, the drift-detection gate still runs — the two gates are independent and their findings are independent. If both gates have findings, both actions are queued and the agent handles them in sequence (feedback-triage action first, per the ordering above; drift-detection action second).

If tamper-detection fires, the tick halts before either gate runs. Tamper-detection is not this architecture's concern.

### 3.2 Gate Inputs

The gate receives:

- The intent slug and currently active stage identifier.
- The baseline map for the active stage (read from `baseline.json`).
- The baseline maps for all prior stages (read lazily — only if the tracked surface of a prior stage has files on disk under the intent directory).
- The current on-disk state of the tracked surface (computed by the gate itself via file enumeration and SHA computation).
- The pending-assessment marker store for the intent (read from a per-intent sidecar — see §5 for the marker contract).

### 3.3 Tracked Surface Definition

The tracked surface for a stage is the union of:

- The stage's declared output directories: `stages/{stage}/outputs/` and `stages/{stage}/artifacts/`.
- The stage's declared knowledge directories: `stages/{stage}/knowledge/` and `stages/{stage}/discovery/`.
- The intent-level knowledge directory: `knowledge/` (tracked by the inception stage, accessible to all stages, writable by the elaborate-phase knowledge-upload path).

Files **outside** the `.haiku/` intent directory — source code, config files, test fixtures — are explicitly **not** in the tracked surface for v1. The agent's writes to those locations are not baselined and not monitored for human drift. This boundary may expand in a future version; for now the tracked surface is intent-scoped.

Workflow-managed files — `units/*.md`, `feedback/*.md`, `intent.md`, `state.json` — are already guarded by the PreToolUse hook for agent writes and are not part of the drift-detection tracked surface. Humans editing those files directly via the filesystem is an out-of-scope case for this architecture (Decision 2 in DESIGN-DECISIONS.md: the guardrail boundary remains "agents must use MCP; humans can write anything," and the security concern about humans directly editing workflow-managed files is deferred to a separate security/hooks artifact).

### 3.4 Baseline Establishment Mode

On every tick, before emitting any drift events, the gate checks whether a `baseline.json` exists for the active stage. If it does not exist:

- The gate enumerates all files currently on disk in the tracked surface.
- For each file, the gate computes the SHA and writes a baseline entry with `author_class: "agent"` (conservative default — we don't know who wrote these files, so we assume agent-acknowledged state) and `last_updated_tick: 0` (sentinel for "established at initialization, not during normal operation").
- The gate writes the new `baseline.json` to disk.
- The gate emits **no drift events** for this tick. This is the "establish, don't fire" rule that prevents false-positive floods on first tick after the feature ships.

The same establishment behavior applies to any newly-tracked directory that appears after baseline initialization (e.g., a stage's `outputs/` directory is created mid-intent for the first time). New directories are absorbed into the baseline silently on first observation.

### 3.5 Gate Computation

For each file in the tracked surface:

1. Compute the current on-disk SHA-256 of the file's content.
2. Look up the file's entry in the baseline map.
3. Check the pending-assessment marker store for an open marker on this file (§5).
4. Apply the following rules:

| Condition | Outcome |
|---|---|
| File exists in baseline; current SHA == baseline SHA | No event. File is in expected state. |
| File exists in baseline; current SHA != baseline SHA; open pending-assessment marker exists | **Suppressed.** No event emitted. The marker indicates a prior non-terminal classification is in flight. Gate skips this file until the marker closes. |
| File exists in baseline; current SHA != baseline SHA; no open marker | **Emit drift event** (see §3.6). |
| File does not exist in baseline; file is present on disk | **Emit new-file event** (see §3.6). |
| File exists in baseline; file is absent on disk | **Emit file-removed event** (see §3.6). |
| Baseline is corrupt or unreadable | Gate halts; emit `baseline_corrupt` signal; tick does not advance (see §7.3). |

### 3.6 Drift Event Shape

Each emitted drift event carries:

```
{
  event_type:    "modified" | "added" | "deleted"
  file_path:     string   // path relative to the intent directory
  stage_owner:   string   // the stage whose tracked surface contains this path
  author_class:  string   // the author_class from the baseline entry ("agent" | "human-via-mcp" | "human-implicit")
                          // null for "added" events where no baseline entry exists
  baseline_sha:  string   // SHA from the baseline; null for "added" events
  current_sha:   string   // current on-disk SHA; null for "deleted" events
  diff_payload:  string | null
                          // For text files: unified diff (--- baseline / +++ current).
                          // For binary files: null. The event_type field carries the signal; no diff text.
                          // For "added" text files: the full file content as the diff payload.
                          // For "deleted" text files: the prior content from git (if available) or null.
  is_binary:     boolean  // true if the file's mime type or byte content indicates binary format
  tick_counter:  number   // the current tick counter, for audit purposes
}
```

The diff payload for text files is a standard unified diff with three lines of context. For large files (>128KB), the payload is truncated to the first 200 lines of the diff with a trailing note indicating truncation. The agent is expected to classify based on the available diff, with the understanding that large diffs are summarized.

Binary files carry `diff_payload: null` and `is_binary: true`. The agent's default for binary files is specified in §4.5.

### 3.7 Gate Outputs

The gate emits a single structured payload to the workflow engine containing:

- The list of drift events (zero or more).
- A `baseline_established` flag (true if this tick ran in establishment mode).
- The tick counter.

If the drift event list is empty and `baseline_established` is false, the gate emits nothing and the tick proceeds to per-state dispatch normally. If the drift event list is non-empty, the gate signals the workflow engine to dispatch the `manual_change_assessment` action before per-state dispatch.

---

## 4. `manual_change_assessment` Workflow Action

### 4.1 Position in the Workflow-Engine Action Set

`manual_change_assessment` is a new entry in the workflow engine's action enum, alongside the existing actions (`feedback_triage`, `review_fix`, `intent_completion_review`, `intent_completion_fix`, `revisited`, and the per-state dispatch actions). It is dispatched by the pre-tick gate system, not by a user button or a stage gate. It runs before per-state dispatch on any tick where the drift-detection gate emits findings.

The action is autonomous — the agent performs the classification during normal `haiku_run_next` flow. There are no user-facing confirmation buttons or Accept/Reject controls for this action. The user sees the agent's classification after the fact, through the passive drift assessment view in the SPA (§6). This is consistent with Decision 3 in DESIGN-DECISIONS.md: "The agent owns the classification decision, not the harness."

### 4.2 Input Shape

The workflow engine delivers the following payload to the agent when dispatching `manual_change_assessment`:

```json
{
  "action": "manual_change_assessment",
  "intent": "<slug>",
  "active_stage": "<stage-id>",
  "findings": [
    {
      "finding_id": "DRF-01",
      "event_type": "modified",
      "file_path": "stages/design/outputs/hero.html",
      "stage_owner": "design",
      "author_class": "human-implicit",
      "baseline_sha": "abc123",
      "current_sha": "def456",
      "diff_payload": "--- a/stages/design/outputs/hero.html\n+++ b/stages/design/outputs/hero.html\n...",
      "is_binary": false,
      "tick_counter": 42
    }
  ],
  "tick_counter": 42
}
```

Each finding is assigned a stable `finding_id` (format: `DRF-NN`, zero-padded, scoped to the current assessment dispatch). Finding IDs are ephemeral — they exist only for the duration of the classification step and are carried into the assessment record for correlation. They do not persist as first-class identifiers beyond the assessment.

### 4.3 Output Shape

The agent produces a classification for each finding. The output is delivered via an MCP tool call (the tool that records and applies the classification — name deferred to development). The output per finding:

```json
{
  "finding_id": "DRF-01",
  "outcome": "inline-fix" | "ignore" | "surface-as-feedback" | "trigger-revisit",
  "rationale": "<agent's explanation, 1-3 sentences, human-readable>",
  "target_stage": "<stage-id>",   // required for "trigger-revisit" — the stage to revisit
  "feedback_note": "<string>"     // required for "surface-as-feedback" — the note to include in the FB body
}
```

The agent classifies all findings in a single response. Per-finding classification may be batched (all outcomes submitted together) or submitted sequentially; the MCP tool accepts both.

### 4.4 Classification Outcome Semantics

#### 4.4.1 `ignore`

**What the agent does:** The agent determines the change is not meaningful to the current or future workflow. Typical cases: a text editor wrote a backup file; a build tool touched a file incidentally; the change is a formatting-only normalization the agent would have made anyway.

**What happens to the baseline:** The baseline entry for this file is updated immediately to the current on-disk SHA with `author_class: "human-implicit"` (or whatever class the originating drift event carried — `human-via-mcp` for SPA uploads or human-attributed MCP writes). The tick counter in the entry is updated to the current tick. No pending-assessment marker is written. On the next tick, the drift gate sees the new SHA as the expected state and emits no event for this file.

**What the user sees:** No new user-visible chip vocabulary is introduced by this outcome. The disposition is recorded in the assessment record (§4.6) — that record is the durable surface for the SPA's drift assessment view. The DESIGN-BRIEF's existing "manual change pending" chip (the transient indicator that appears when a replacement happens and clears when the assessor publishes its disposition) is the chip lifecycle this architecture honors. After classification, the chip clears; if the user wants to know what was decided, they consult the assessment record via the SPA. No banner, no prompt, no action required from the user.

#### 4.4.2 `inline-fix`

**What the agent does:** The agent determines the change is a human improvement or addition that the current bolt should incorporate. The agent will read the modified file and treat it as the new ground truth in its next bolt. This is equivalent to Aider's "human edit is authoritative; re-read before proceeding" stance, applied within the H·AI·K·U lifecycle.

**What happens to the baseline:** Same as `ignore` — the baseline entry is updated immediately to the current on-disk SHA, preserving the originating author_class. No pending marker.

**What the user sees:** No new chip vocabulary. The assessment record (§4.6) logs the `inline-fix` outcome and the agent's rationale; the SPA's drift assessment view surfaces it. The DESIGN-BRIEF's "manual change pending" chip clears once classification publishes. The agent's next bolt references the human-modified file without overwriting it; that next bolt's outputs are the visible signal that the change was folded in.

#### 4.4.3 `surface-as-feedback`

**What the agent does:** The agent determines the change represents a concern, regression, or finding that warrants formal attention — it should become a feedback item so a human can triage it and the fix loop can process it. The agent creates a new feedback item in the intent's feedback directory (using the existing `haiku_feedback` MCP tool), sets the feedback origin to `agent-detected`, and includes the diff payload and its rationale in the feedback body. The finding_id is included in the feedback item for cross-reference.

**What happens to the baseline:** The baseline is **not** updated at classification time. Instead, a pending-assessment marker is written for this file (§5). The marker records the finding_id, the feedback item path, and the current tick. The drift-detection gate reads the marker on subsequent ticks and suppresses re-emission of a drift event for this file until the marker is cleared. When the feedback item is resolved (closed or rejected), the marker is cleared and the baseline is updated to the file's then-current SHA.

**What the user sees:** The feedback item appears in the SPA's feedback list with origin badge `agent-detected` and a note that it was surfaced from drift detection. No new chip vocabulary is introduced — the feedback item itself is the durable user-visible surface, accessible from the standard feedback list and from the assessment record (§4.6) via cross-reference. The DESIGN-BRIEF's "manual change pending" chip on the affected artifact card clears once classification publishes; from there the user navigates to the feedback list to see the open finding. The drift-detected banner (Screen 3 in DESIGN-BRIEF) clears once the `manual_change_assessment` action completes; the pending feedback item is the durable record of the open finding.

#### 4.4.4 `trigger-revisit`

**What the agent does:** The agent determines the change is sufficiently significant — a fundamental redirect, a design that invalidates prior stage work, or a structural change that makes the current stage's plan incorrect — that the intent must revisit an earlier stage. The agent calls the `haiku_revisit` MCP tool targeting the specified `target_stage`. This is the same revisit mechanism used for cross-stage feedback relocation; it is not a new concept, only a new trigger path.

**What happens to the baseline:** Same as `surface-as-feedback` — the baseline is not updated at classification time. A pending-assessment marker is written referencing the revisit action. When the revisit completes (the revisited stage advances back to its prior position), the marker is cleared and the baseline is updated.

**What the user sees:** The intent transitions to the revisit flow. The assessment record logs `trigger-revisit` with the target stage and rationale. No passive chip remains — the revisit itself is the visible signal. Once the revisit completes, normal processing resumes and the marker is cleared.

### 4.5 Ambiguous-Diff Default

When the agent cannot confidently classify a diff — a binary file changed with no accompanying context, a large restructuring that could be intentional or accidental, or a file outside the agent's domain — the default outcome is `surface-as-feedback` with a standard rationale note: "Unable to determine intent from the available diff. Surfacing as feedback for human review."

This default is conservative. It produces a feedback item rather than ignoring or acting on the change, which means a human reviewer can see it and triage it. The feedback item's origin badge (`agent-detected`) and the attached diff payload give the reviewer the information they need to decide what to do.

Binary file behavior specifically: when `is_binary: true` and `diff_payload: null`, the agent receives only the event type, file path, SHA delta, and author class. The default for binary files is `surface-as-feedback` unless the agent has specific context (from the stage's active hat, the unit spec, or the DESIGN-BRIEF) that the binary change was expected. A designer who just replaced a PNG mockup — if the agent is in the design stage and the file is in the outputs directory — is a context-rich enough signal for an `inline-fix` classification. In the absence of stage context, binary changes default to `surface-as-feedback`.

### 4.6 Assessment Record

Every `manual_change_assessment` dispatch produces an assessment record that is written to a durable location:

```
.haiku/intents/{slug}/stages/{stage}/drift-assessments/DA-{NN}.json
```

The record carries: the tick counter, the timestamp, the full findings list (including diff payloads), the agent's classification per finding, and the rationale strings. This record is the input to the SPA's drift assessment view (§6). It is append-only — records are never modified after writing. The `NN` counter increments per assessment within a stage.

For cross-stage findings (files belonging to a prior stage's tracked surface), the record is written to the active stage's `drift-assessments/` directory but includes the `stage_owner` field from the finding, so the SPA can display the correct stage attribution.

---

## 5. Baseline-Update Contract and Pending-Assessment Markers

### 5.1 The Steady-State Loop Problem

Without a pending-assessment marker, non-terminal classification outcomes (`surface-as-feedback`, `trigger-revisit`) would re-emit a drift event on every subsequent tick until the downstream action resolves. The file's SHA on disk differs from the baseline (which was not updated), so the gate detects drift again, dispatches another `manual_change_assessment`, and the agent classifies the same change a second time. This is the "classification stuck in a loop" risk identified in DISCOVERY.md.

The pending-assessment marker is the mechanism that breaks this loop. It tells the gate "this file has an open non-terminal assessment in flight — skip it."

### 5.2 Marker Storage

Pending-assessment markers live at:

```
.haiku/intents/{slug}/drift-markers.json
```

This is an intent-scoped (not stage-scoped) file because markers may span stage boundaries (a cross-stage drift finding on a design artifact is active while the intent is on the development stage). The format is a JSON object keyed by file path (relative to the intent directory) with values:

```
{
  "finding_id": "DRF-01",
  "outcome": "surface-as-feedback" | "trigger-revisit",
  "downstream_ref": "<feedback item path or revisit stage id>",
  "created_at_tick": 42,
  "baseline_sha_at_creation": "abc123"   // the SHA that triggered the finding; used to verify
                                          // the file hasn't changed again while the marker is open
}
```

### 5.3 Marker Lifecycle

**Written:** When `manual_change_assessment` classifies a finding with a non-terminal outcome (`surface-as-feedback` or `trigger-revisit`), the marker is written before the baseline update is skipped.

**Read:** On every tick, the drift-detection gate reads `drift-markers.json` and suppresses drift events for any file with an open marker, **unless** the file's current SHA differs from the `baseline_sha_at_creation` in the marker. If the SHA has changed again since the marker was written (the human made a second edit on top of the first), the gate treats the marker as stale, removes it, and emits a new drift event. This ensures double-edits are not silently suppressed.

**Cleared:** When the downstream action resolves:
- For `surface-as-feedback`: when the feedback item transitions to a terminal state (`closed` or `rejected`), the marker is cleared and the baseline is updated to the file's then-current on-disk SHA.
- For `trigger-revisit`: when the revisited stage advances back to its pre-revisit position (revisit complete), the marker is cleared and the baseline is updated.

The mechanism for detecting downstream resolution is a hook in the feedback lifecycle (feedback closure triggers marker cleanup for any marker referencing that feedback item's path) and a hook in the revisit lifecycle (revisit completion triggers marker cleanup for any marker referencing that revisit's stage).

### 5.4 Marker and Baseline Consistency

The baseline-update contract in full, per outcome:

| Outcome | Baseline updated at classification? | Pending marker written? | Baseline updated at resolution? |
|---|---|---|---|
| `ignore` | Yes — to current SHA, author_class `human-implicit` | No | N/A |
| `inline-fix` | Yes — to current SHA, author_class `human-implicit` | No | N/A |
| `surface-as-feedback` | No | Yes | Yes — when FB closes/rejects |
| `trigger-revisit` | No | Yes | Yes — when revisit completes |

This table is the single authoritative reference for how the baseline and markers interact. Development must implement it exactly.

---

## 6. Author-Class Tracking

### 6.1 The Three Classes

The author class on a baseline entry reflects the last write that the workflow engine acknowledged for that file:

**`agent`** — the agent wrote the file through the MCP tool pipeline. The write is in-band and was tracked by the workflow engine at write time. This is the default for all files the agent produces during hat execution.

**`human-via-mcp`** — an explicit human-mediated write reached the workflow engine through a sanctioned channel: either the human-attributed-write MCP tool (the agent's "write on behalf of user" path; Decision 7) or the SPA upload affordance (Knowledge Upload Panel, Stage Output Replacement Card). Both channels stamp an action-log entry at write time marking the write as `human-via-mcp`; neither updates `baseline.json` directly. The pre-tick drift gate consults the action log on its next scan, attaches the `human-via-mcp` class to the emitted drift event, and dispatches `manual_change_assessment` so the agent classifies the change. The class survives into the baseline entry only after the assessment publishes — terminal outcomes propagate the class via §2.3 item 2; non-terminal outcomes propagate it on marker resolution. The class distinguishes mediated human writes (where the user took an explicit, observable action through a sanctioned surface) from `human-implicit` writes (where no sanctioned channel was used).

**`human-implicit`** — the file's SHA changed without an intervening agent stamp in the current tick's action log. No tool mediated the write. The change arrived via filesystem drop, SPA upload, or some other out-of-band path. The drift-detection gate infers this class and applies it to the baseline entry after a terminal assessment closes the finding.

### 6.2 Inference Rule for `human-implicit`

The inference is deterministic: a file is `human-implicit` if and only if:

1. The file has a baseline entry.
2. The current on-disk SHA differs from the baseline SHA.
3. The current tick's action log does not contain an agent write (via Write, Edit, or human-attributed-write MCP tool) to this file path.
4. No open pending-assessment marker exists for this file.

Conditions 1–4 together mean: the file changed, the agent didn't change it, and no prior assessment is already tracking this change. The only remaining explanation is an out-of-band human write.

The inference is applied at assessment record time (when the `manual_change_assessment` action records its output), not at gate scan time. The gate emits the event with the prior `author_class` from the baseline; the assessment action updates the class in the baseline when the finding is resolved.

### 6.3 Human-Write-Path Integrity

Decision 9 in DESIGN-DECISIONS.md was left open at inception with two candidate stances (trust + audit vs. explicit human confirmation). This architecture resolves it:

**Chosen stance: trust + audit.**

The human-attributed-write MCP tool writes the file, stamps a `human-via-mcp` entry in the current tick's action log (so the next pre-tick drift gate emits the drift event with the correct author class — see §2.3 item 2 and §7.3 for the unified flow), and writes an audit entry to `drift-markers.json`'s sibling audit log at `.haiku/intents/{slug}/write-audit.jsonl` (one JSON record per line, append-only). Each audit entry carries: timestamp, tool invocation context, user instruction excerpt (truncated to 200 chars), file path, SHA written, and session identifier. The tool deliberately does **not** update `baseline.json` directly; the baseline update happens when the next tick's `manual_change_assessment` classifies the resulting drift event, exactly as it does for SPA uploads and filesystem drops. The audit log is the immediate-write side-effect that records human attribution; the assessment record (§4.6) is the post-classification durable surface.

This stance is chosen because:
- The primary use case is interactive — the user is in the chat and explicitly instructs the agent. The human is present and their intent is unambiguous.
- Adding a confirmation round-trip for every "write this file for me" instruction would feel like ceremony for a routine action (DESIGN-DECISIONS.md §9: "confirmation is opt-in for 'hey claude just write this config file'").
- The audit log provides post-hoc accountability. A security review can verify that every `human-via-mcp` entry in the baseline has a corresponding audit log entry with user instruction context.
- The security risk (an adversarial agent using the tool to misattribute its own writes) is mitigated by the audit log. A baseline audit comparing agent-session timing against audit log entries would surface anomalies.

The trust + audit stance does not weaken the existing workflow-managed-file guardrail. The human-attributed-write MCP tool is constrained to the tracked surface (stage outputs, stage knowledge, intent knowledge). It cannot write workflow-managed files (units, feedback, intent.md, state.json) — those remain MCP-only for agents and are outside the tool's allowed path scope.

---

## 7. Concurrency Model

### 7.1 Eventual Consistency

The concurrency model is eventual consistency with no file locking (Decision 4 in DESIGN-DECISIONS.md). The system accepts the following as documented behavior, not bugs:

- A human may edit a file while the agent is mid-bolt. Both writes may land in the same working-tree state before the next tick.
- The agent's mid-bolt work may be partially based on the pre-edit version of the file. Outputs produced during a bolt that started before the human's edit may reflect the pre-edit state.
- The human's edit is visible to the workflow engine only on the next `haiku_run_next` tick. There is no real-time notification path from filesystem to agent.

The tick is the reconciliation unit. Every `haiku_run_next` invocation is a clean observation point: the drift-detection gate sees the full working-tree state at tick start and emits findings based on the baseline snapshot from the previous acknowledged state.

### 7.2 Mid-Bolt Partial-State Risk

The partial-state risk is explicitly acknowledged: if the agent is writing a set of related files across multiple tool calls in a single bolt, and a human edit arrives midway through, the next tick may see a baseline divergence on only some of those files. The agent's classification in `manual_change_assessment` may or may not have enough context to understand that the human's edit was intended to interact with a half-written agent output.

This is accepted. The agent's classification rationale field exists precisely to surface this ambiguity — the agent can note "human edit appears to target the pre-bolt version; the current bolt has partially rewritten this section" in its rationale. The four-outcome taxonomy covers this case: if the partial-state context makes the classification ambiguous, `surface-as-feedback` is the default.

No locking, no optimistic concurrency, no retry-on-conflict. The eventual-consistency model is the model.

### 7.3 SPA Upload Timing

When a user uploads a file through the SPA's upload affordance (Knowledge Upload Panel or Stage Output Replacement Card per DESIGN-BRIEF Screens 1 and 2), the SPA performs a multipart POST to a write endpoint. The endpoint:

1. Writes the file to disk in the destination directory (intent `knowledge/`, stage `outputs/`, etc., per the destination selector).
2. Stamps an entry in the current tick's action log marking the upload's author class as `human-via-mcp`. This entry is what the drift-detection gate consults at scan time to attach the correct author class to the emitted drift event.
3. Does **not** update `baseline.json` directly. The endpoint deliberately leaves the file's baseline entry stale so that the next pre-tick drift-detection gate observes the SHA divergence, emits a drift event with `author_class: "human-via-mcp"`, and dispatches `manual_change_assessment` exactly the way it would for any other tracked-surface change.

This means every SPA upload flows through the unified detection-and-classification path. The agent receives the drift event in its `manual_change_assessment` payload, observes that the change came from an explicit human-mediated write (the `human-via-mcp` author class is the signal), and classifies — typically `inline-fix` for a deliberate Replace dialog submission, since the user's intent is unambiguous from the upload action; typically `inline-fix` or `ignore` for an additive Knowledge Upload, depending on whether the new file is referenced from the current bolt. The classification's effect on the baseline is governed by §5.4 and §2.3 — exactly the same contract that governs filesystem drops and human-attributed MCP writes.

This unified path honors the "next workflow tick will assess this change" UX promise made in DESIGN-BRIEF Screen 2's Replace dialog reassurance copy and Screen 3's Drift-Detected Banner — a promise that is only meaningful if the assessment actually fires. It also honors Decision 1 in DESIGN-DECISIONS.md, which requires that all three write paths (filesystem drop, SPA upload, human-attributed MCP write) flow through the same detection mechanism. There is no fast-path special case for SPA uploads.

**SPA-side UX during the assessment window.** Because the assessment runs on the next tick rather than at upload time, the SPA shows the DESIGN-BRIEF's "manual change pending" chip on the affected artifact card from upload acknowledgment until classification publishes. The Drift-Detected Banner (SPA-UI-SPECS.md §4 Surface 3) appears whenever `drift_detected === true` for the active stage and disappears automatically when `manual_change_assessment` completes on the next scheduled `haiku_run_next` tick. There is no user-facing button or control to trigger the tick early — per the Direction A passive-observer constraint locked in SPA-UI-SPECS.md §0 and §4.6, the three new SPA surfaces are read-only indicators with no assessment-trigger affordance. The user's only role during the assessment window is to observe; classification is autonomous.

**Storage-location reconciliation.** DESIGN-BRIEF line 284's mention of "updates baseline SHA in `state.json`" is a known cross-document mismatch with this architecture's §2.2 (baseline lives at `stages/{stage}/baseline.json`, not `state.json`). The architecture is the binding contract; the DESIGN-BRIEF reference will be reconciled by a sibling brief amendment so the development stage implements against `baseline.json` rather than `state.json`. The behavior described above (endpoint does NOT update baseline at upload time) supersedes the brief's wording — the endpoint's only state mutation at upload time is the action-log entry, not a baseline write.

---

## 8. Failure Modes

### 8.1 Missing Baseline (First Tick After Deploy)

**Condition:** The `baseline.json` file for the active stage does not exist. This happens on the first tick for any new intent, on the first tick after the feature ships for an existing intent, or after a git operation that removes the file.

**Behavior:** The gate runs in establishment mode (§3.4). It enumerates the tracked surface, writes a new `baseline.json` with the current state, sets `author_class: "agent"` for all entries (conservative default), and emits no drift events. The tick proceeds to per-state dispatch normally.

**Rationale:** The "establish, don't fire" rule prevents the false-positive flood described in DISCOVERY.md § "Risks: False positives storm." The cost is that any pre-existing human edits at the time of first tick are absorbed into the baseline silently. This is correct behavior: the first tick is a snapshot of the world at that moment, not an audit of everything that happened before the feature existed.

### 8.2 Corrupt Baseline

**Condition:** The `baseline.json` file exists but cannot be parsed as valid JSON, or its structure violates the schema (missing required fields, invalid SHA format, unrecognized author_class value).

**Behavior:** The gate halts. It emits a `baseline_corrupt` signal to the workflow engine. The tick does not advance to per-state dispatch. The workflow engine surfaces an error to the agent: "Baseline file for stage `{stage}` is corrupt. Run `haiku_repair` to re-establish the baseline." The `haiku_repair` tool already handles state consistency issues; this is a new case it should cover.

**Rationale:** A corrupt baseline cannot reliably detect drift. Proceeding on a corrupt baseline risks silently ignoring real human edits (false negatives) or flooding with false positives. Halting is safer than proceeding.

### 8.3 Out-of-Sync Baseline

**Condition:** The `baseline.json` file exists and is parseable, but its entries are inconsistent with the intent's actual state — for example, after a manual git reset, a branch switch that restored earlier file versions, or a rebase that rewrote history. This is distinct from corruption: the file is structurally valid JSON but its SHA values don't reflect any coherent known state.

**Detection:** The gate detects this indirectly — a large number of drift events (threshold: more than 50% of tracked files show drift in a single tick) triggers an out-of-sync heuristic. A single tick with that many drift events is more likely to reflect a git operation than genuine human edits.

**Behavior:** When the out-of-sync heuristic fires:
1. The gate classifies the entire drift payload as a single synthetic drift event with `event_type: "baseline-oom"` (out-of-sync marker).
2. The `manual_change_assessment` action receives this synthetic event. The default outcome for a `baseline-oom` event is `trigger-revisit` targeting the active stage (re-running from the current stage's start is the safe recovery path).
3. The baseline is re-established (new SHA snapshot) after the revisit completes.

This is a heuristic, not a guarantee. The threshold (50%) and the default outcome (`trigger-revisit`) are conservative by design. Development may tune the threshold based on empirical data from real intent sizes.

### 8.4 Pending-Marker Store Unavailable

**Condition:** `drift-markers.json` cannot be read (file missing or corrupt).

**Behavior:** The gate proceeds without marker suppression — it treats all files as having no open markers. This may cause re-emission of drift events for files with in-flight non-terminal assessments. The `manual_change_assessment` action will classify those findings again; if the downstream feedback items still exist, the agent should recognize the duplication and classify as `ignore` with a note referencing the existing open feedback.

**Rationale:** The marker store is a suppression optimization, not an integrity guarantee. Degraded behavior (re-emission without suppression) is preferable to halting. The drift findings are idempotent in the limit — an agent that sees the same finding twice and correctly identifies the existing open feedback items will produce the right outcome.

### 8.5 Kill-Switch — `drift_detection: false`

**Purpose.** Drift detection is a load-bearing addition to the pre-tick gate chain. If the new gate misbehaves in production — false-positive storms on a class of intent we didn't anticipate, performance regressions on large tracked surfaces, or interaction bugs with the marker store — operators need a way to disable the gate without rolling back the plugin or hand-editing baselines. The plugin-settings flag `drift_detection` is that escape hatch. The flag is specified in detail in unit-05's `ROLLOUT-AND-BASELINE-ESTABLISHMENT.md`; this section names the contract the architecture honors.

**Flag location.** A boolean field at the plugin-settings level (the same settings surface where harness selection, provider configuration, and similar plugin-wide toggles live). The default value when the field is absent is `true` (drift detection on). Setting it to `false` disables the feature.

**Gate behavior when `drift_detection: false`:** the pre-tick drift-detection gate becomes a complete no-op:

- The gate **does not** enumerate the tracked surface.
- The gate **does not** compute SHA-256 hashes for any file.
- The gate **does not** read `baseline.json` or `drift-markers.json`.
- The gate **does not** emit any drift events.
- The gate **does not** dispatch `manual_change_assessment`.
- The gate **does not** block, halt, or otherwise gate the tick.

The pre-tick gate chain shortens to `tamper-detection → feedback-triage → per-state dispatch` — exactly the chain that exists today before this feature ships. The `manual_change_assessment` action is never dispatched because the drift gate never emits findings.

**Baseline files when disabled.** Existing `baseline.json` and `drift-markers.json` files are left on disk untouched. They are not deleted, not migrated, not "drained." If the operator later flips the flag back to `true`, the gate resumes from the existing baseline (treating any drift accumulated during the disabled window as a normal first-tick observation through the rules in §3.5). This means re-enabling on an intent that drifted while disabled will produce one large drift event batch on the next tick — operators should expect this and may choose to delete the baseline before re-enabling to force re-establishment via §3.4.

**Human-attributed-write MCP tool when disabled.** The tool itself remains callable — the agent can still use it to write a file on user instruction. When `drift_detection: false`, the tool writes the file but **does not** update `baseline.json` (since baselines are not consulted) and **does not** write an audit-log entry to `write-audit.jsonl`. In disabled mode, the tool is functionally equivalent to the agent's normal Write tool. The audit log gap during disabled windows is an accepted trade-off; if audit fidelity is required, the operator should not disable the flag.

**SPA upload paths when disabled.** SPA upload endpoints continue to write files to disk (the user-facing affordance is not removed) but skip the baseline-protocol participation described in §7.3. Uploaded files land on disk; the next tick does not produce a drift event because the gate is a no-op; the agent only learns about the upload through whatever surface the upload affordance itself notifies (e.g., a websocket frame to the SPA, or a chat acknowledgment). The lack of automatic agent reaction during disabled windows is the explicit consequence of disabling the feature.

**Operator scenarios that motivate the flag:**

- *Roll-out staging.* The plugin ships with `drift_detection: true` as the default, but a cautious operator deploying to a fleet of intents may want to roll out per-project, flipping the flag from `false` to `true` once per project to control the baseline-establishment moment manually.
- *Incident response.* A bug in the gate produces false-positive storms, baseline corruption, or a performance regression. The operator flips `drift_detection: false` to stop the bleeding while a fix is prepared. Existing intents continue working with the pre-feature gate chain.
- *Diagnostics.* An operator suspects the gate is interacting badly with another feature. Flipping the flag isolates the variable.

The flag is **not** intended for steady-state production use with the feature off — it is a roll-out and incident-response tool. Long-term per-intent suppression of drift detection (e.g., "this intent is too noisy, never run the gate") is not in scope for v1; it would require a per-intent setting rather than a plugin-wide flag.

**Pairing with `ROLLOUT-AND-BASELINE-ESTABLISHMENT.md`.** The rollout document (unit-05) names the flag, defines its default, defines the migration story for existing intents, and documents the establish-then-enable sequence. The two documents form a consistent pair: the architecture document specifies the gate's no-op behavior when the flag is set; the rollout document specifies how the flag is exposed in plugin settings and how operators interact with it. Neither document duplicates the other's content.

---

## 9. Open Design Decisions Resolved by This Architecture

The following decisions were listed as "Open for Design" in DESIGN-DECISIONS.md. Each is resolved here.

**Tracked-surface boundary:** Stage output directories (`outputs/`, `artifacts/`), stage knowledge directories (`knowledge/`, `discovery/`), and the intent-level `knowledge/` directory constitute the tracked surface. Files outside `.haiku/` are out of scope for v1. Workflow-managed files are excluded. See §3.3.

**Baseline storage location:** `stages/{stage}/baseline.json` inside the intent state directory hierarchy. One file per stage. The format is JSON (default); the contract is the abstract data shape. See §2.2.

**Baseline establishment on upgrade:** First-tick "establish, don't fire" mode. Any tick where `baseline.json` is absent triggers establishment without emitting drift events. See §3.4 and §8.1.

**Ambiguous-diff default:** `surface-as-feedback` with a standard rationale note. Binary files also default to `surface-as-feedback` absent specific stage context. See §4.5.

**Human-write-path integrity:** Trust + audit. The human-attributed-write MCP tool writes an audit log entry alongside every write. No confirmation round-trip required. See §6.3.

**SPA upload availability per stage:** SPA uploads are available for any stage that has a `knowledge/` or `outputs/` directory in its tracked surface. The upload affordance's destination selector enumerates available targets dynamically based on the intent's stage structure. See §3.3 (tracked surface defines what's available) and DESIGN-BRIEF.md §1 (destination selector implementation).

**Assessment record durability and location:** `stages/{stage}/drift-assessments/DA-{NN}.json`, append-only. One record per assessment dispatch. See §4.6.

**Binary file degraded-mode behavior:** `surface-as-feedback` as the default with stage-context exceptions. The agent receives event type, path, SHA delta, and author class; no diff payload. See §4.5 and §3.6.

---

## 10. Internal Consistency with DESIGN-DECISIONS.md

This architecture is consistent with all nine recorded decisions in DESIGN-DECISIONS.md. The traceability is:

| Decision | Where this architecture implements it |
|---|---|
| Decision 1: Both explicit and implicit detection | Implicit: SHA baseline + drift gate (§3). Explicit: SPA upload (§7.3) and human-attributed-write MCP tool (§2.3 item 2) both stamp the action log with `author_class: "human-via-mcp"` at write time without touching `baseline.json`; the next tick's drift gate emits a drift event with that class and dispatches `manual_change_assessment`. All three paths (filesystem drop, SPA upload, MCP tool) flow through the unified detection-and-classification pipeline — no fast-path special cases. |
| Decision 2: Agent guardrail boundary unchanged | Workflow-managed files excluded from tracked surface (§3.3). Gate does not guard against human edits to those files. |
| Decision 3: New `manual_change_assessment` action, agent-owned classification | §4 in full. Four outcomes. Agent dispatched autonomously via `haiku_run_next`. |
| Decision 4: Eventual consistency | §7 in full. No locking. Mid-bolt partial-state acknowledged. |
| Decision 5: Cross-stage drift classification agent-owned, no automatic revisit | Agent receives cross-stage findings in the assessment payload; `trigger-revisit` is one of the four outcomes the agent chooses, not a harness-automatic action (§4.4.4). |
| Decision 6: All three change types covered by one mechanism | Single drift-detection gate covers filesystem drops, SPA uploads, and human-attributed writes. Single `manual_change_assessment` action classifies all of them. |
| Decision 7: Three write paths, unified by implicit baseline gate | SPA upload (§7.3), filesystem drop (§3.5), human-attributed MCP write (§2.3, §6.1). |
| Decision 8: Full three-component sync | This document is the architecture artifact. Paper, plugin, and website sync surfaces remain as documented in IMPLEMENTATION-MAP.md. |
| Decision 9: Trust + audit for human-write-path integrity | §6.3 resolves this explicitly. |

---

## 11. Non-Goals (Explicit Exclusions)

The following are out of scope for this architecture and the development stage that implements against it:

- TypeScript file paths, function signatures, module names, or shell commands. Those belong in development-stage units.
- The SPA's component tree (React components, prop types, styling). That belongs in the design-stage DESIGN-BRIEF.md and development.
- The diff viewer component for "view diff →" rows in the drift banner (deferred per DESIGN-BRIEF.md § Design Gaps).
- Real-time presence indicators or multi-user conflict resolution beyond the dialog-level concurrency banner.
- Tracking human edits to files outside `.haiku/` (source code, configs, test fixtures).
- Tracking human edits to workflow-managed files (units, feedback, intent.md, state.json).
- Auto-throttling of drift events (coalescing rapid edits into a single assessment).
- A SPA affordance for manually resetting the baseline ("accept current state as baseline").

---

## 12. Annex: Co-Located Upstream-Reconciliation Gate (Not Designed by This Intent)

§3.1 specifies the post-this-intent pre-tick gate chain as `tamper-detection → feedback-triage → drift-detection → per-state dispatch`. A second new pre-tick gate — **upstream-artifact reconciliation** — also exists on this intent's branch (entered via the 2026-05-01 main-merge from repo PR #283 "feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged 2026-04-30). This annex documents its presence so the design-stage cross-stage trace is unbroken without re-attributing it to this intent's elaboration.

**Effective gate chain on the branch:**

```
tamper-detection → feedback-triage → drift-detection → upstream-reconciliation → per-state dispatch
```

**Distinction from the drift-detection gate this architecture specifies:**

| Concern | drift-detection (§3, this intent) | upstream-reconciliation (annexed) |
|---|---|---|
| Detects | Per-file SHA mismatch vs `baseline.json` (human-vs-agent author drift) | Cross-document divergence between agent-authored upstream artifacts (tool-name, http-status, field-name) |
| Inputs | `baseline.json` (per-stage), tracked surface, pending-marker store | Corpus walk of `stages/<prior>/artifacts/`, `discovery/`, `outputs/`, `<intent>/knowledge/`, `product/`, `features/` |
| Persisted state | `baseline.json` per stage; `drift-markers.json` intent-scoped | `corpus_fingerprint` value in per-stage `state.json` |
| Action emitted | `manual_change_assessment` (§4) | `upstream_reconciliation_required` |
| Resolution path | Agent classifies (4 outcomes), `haiku_human_write` is the sanctioned write tool | Agent reconciles upstream artifacts and re-ticks, OR calls `haiku_reconciliation_acknowledge` |
| Telemetry | `haiku.drift.*` (this intent) | `haiku.reconciliation.*` (annexed) |
| Tests | `drift-detection-gate.test.mjs`, `drift-baseline.test.mjs`, `drift-markers.test.mjs` | `upstream-reconciliation.test.mjs` |
| Designed by | This intent | PR #283 |

**Action enumeration update for §4.1:** §4.1 lists `manual_change_assessment` as a NEW entry alongside existing actions. The action enum on the branch as of this architecture's ship date also contains `upstream_reconciliation_required` (annexed). It dispatches under the same pre-tick model as `manual_change_assessment` (autonomous; no user-facing button) but on the basis of corpus-fingerprint divergence rather than per-file SHA drift.

**MCP tool list update for sibling MCP-TOOL-CONTRACT.md:** The sibling MCP-TOOL-CONTRACT.md specifies `haiku_human_write` as the sole new tool authored by this intent's design. The branch also contains `haiku_reconciliation_acknowledge` (annexed). Its contract is NOT specified here — see PR #283 for the source.

**Why this gate is annexed rather than incorporated:** Incorporating reconciliation into §3 (Pre-Tick Drift-Detection Gate), §4 (`manual_change_assessment` Workflow Action), and §6 (Author-Class Tracking) would require this intent's design stage to assume ownership of a subsystem its product-stage acceptance criteria do not cover and its inception-stage decisions did not consider. The reconciler-style honest path is to acknowledge the gate's presence and disjoint scope without claiming design authorship.

**Future ownership path:** A future intent scoped to upstream-reconciliation should produce its own ARCHITECTURE.md sections specifying the reconciliation gate's position in the gate chain, its inputs and computation, the `upstream_reconciliation_required` action's input/output shape, the `haiku_reconciliation_acknowledge` MCP tool's contract, and its failure-mode catalog. Those sections do not belong here.

**Cross-references:** See `knowledge/DISCOVERY.md` § "Annexed Subsystem", `knowledge/DESIGN-DECISIONS.md` Annex A, `knowledge/IMPLEMENTATION-MAP.md` § "Annex: Out-of-Scope Subsystem", `knowledge/ARCHITECTURE.md` § "Annex: Upstream-Reconciliation Pre-Tick Gate".
