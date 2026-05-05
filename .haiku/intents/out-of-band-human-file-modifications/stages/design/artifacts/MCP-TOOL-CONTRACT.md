# MCP Tool Contract — `haiku_human_write`

*Design-stage-final contract. The development stage implements directly against this document. No aspects of the tool name, input shape, output shape, path constraints, audit trail, or error codes are left open for development-stage refinement — unless a concrete implementation blocker is discovered, in which case the development stage MUST update this document before landing a deviation.*

---

## 1. Purpose and Scope

This document specifies the `haiku_human_write` MCP tool — the sanctioned pathway for the agent to write a file to the intent's tracked surface as a **human-attributed write**. The tool is invoked when a user says something like "hey Claude, write this config file for me" or "save this content to the design references." The resulting write is attributed to the human, not the agent, which means the next pre-tick drift-detection gate treats the file as already-assessed rather than as an unexamined divergence.

`haiku_human_write` is NOT:
- A general-purpose write tool. The agent's normal Write/Edit tool pipeline handles agent-authored writes.
- An escape hatch for bypassing the PreToolUse hook on workflow-managed files. The tool refuses those paths explicitly.
- Related to the SPA upload pathway, which is a separate API surface (see §9).

The tool covers exclusively the **agent-conversation pathway**: a human is in the chat, gives an explicit instruction to write a specific file with specific content, and the agent carries that instruction out using this tool rather than the normal Write tool. The key distinction is intent attribution — the human is the author, the agent is the instrument.

---

## 2. Tool Name

**Working name: `haiku_human_write`**

This name is design-stage-final and development-stage-implementable. It follows the `haiku_*` namespace convention used by all other H·AI·K·U MCP tools (`haiku_feedback`, `haiku_unit_read`, `haiku_revisit`, etc.). The name is intentionally specific: "human" signals attribution, "write" signals file-write semantics. The name distinguishes this from `haiku_feedback_write` (which writes a feedback item body) and from any hypothetical `haiku_write` (which would be ambiguous about attribution).

If a naming conflict is discovered at implementation time (e.g., a future tool was already registered under this name), the development stage must update this contract document AND the ARCHITECTURE.md before registering under a different name, so all downstream references stay consistent.

---

## 3. Input Shape

The tool accepts the following input fields. All fields are named; the tool does NOT accept positional arguments.

### 3.1 Required Fields

**`path`** (`string`)
The destination file path. Two formats are accepted:
- **Intent-relative** — a path relative to the intent directory root (e.g., `knowledge/brand-guide.md`, `stages/design/outputs/hero.html`). Preferred format.
- **Absolute** — a path inside the intent directory. The tool resolves both forms to the intent-relative canonical path before any validation.

The path must fall within the intent's tracked surface (see §5). The tool validates the path before performing any write. If the path resolves outside the tracked surface, the write is refused with `path_outside_tracked_surface` (see §7.1).

**`content`** (`string`)
The file content. One of two encodings:
- **UTF-8 string** — used for text files (markdown, HTML, CSS, JSON, YAML, plain text, etc.). The tool writes the content directly as UTF-8.
- **Base64-encoded binary** — used for image, PDF, and other binary formats. The caller signals base64 encoding by setting `content_encoding: "base64"` (see optional fields below). If `content_encoding` is absent, the tool treats content as a UTF-8 string.

There is no length limit on `content` beyond what the MCP transport supports. For large files, callers should prefer the SPA upload path (§9) rather than embedding large base64 blobs in a tool call.

### 3.2 Optional Fields

**`content_encoding`** (`"utf-8" | "base64"`, default: `"utf-8"`)
Signals the encoding of the `content` field. Callers writing binary files MUST pass `"base64"`. Callers writing text files SHOULD omit this field or pass `"utf-8"`. An unrecognized value returns `invalid_content_encoding`.

**`human_author_id`** (`string`, optional)
The identifier of the human who gave the instruction. This field is captured in the audit log entry (§8) for attribution and accountability. In practice, this is the session or user identifier available to the agent from the conversation context (e.g., a username, a UUID, or a display name). The tool does NOT validate or authenticate this value — it is self-reported by the agent on behalf of the human in the conversation. If absent, the audit log records `human_author_id: null` and the write is still performed.

**`rationale`** (`string`, optional but strongly recommended)
A short free-text explanation of why the human requested this write. Captured in the audit log for accountability and surfaced to the assessor in the next tick's `manual_change_assessment` payload alongside the diff. Examples:
- `"User asked me to write their brand guide excerpt into intent knowledge so it's available during elaboration."`
- `"Designer provided a revised hero layout; writing it to outputs per their instruction."`

If the plugin's settings include `human_write_require_rationale: true` (an operator-configurable flag), the tool returns `rationale_required` when this field is absent (see §7.2). The default plugin behavior does NOT require rationale — it is strongly recommended but not enforced.

**`overwrite`** (`boolean`, default: `true`)
Controls behavior when the path already exists on disk. Default `true` means the tool overwrites the existing file (the human's intent to replace is the common case). Pass `false` to make the write a create-only operation — if the path already exists, the tool returns `path_already_exists` instead of overwriting.

The `overwrite: false` mode is useful when the caller wants to guarantee they are not silently clobbering an existing file that the agent or another human wrote previously. In interactive conversation, the agent should generally leave `overwrite` at its default (true), since the user's instruction implicitly assumes the write should land.

**`create_dirs`** (`boolean`, default: `true`)
Controls whether the tool creates intermediate directories if the path's parent directory does not exist. Default `true`: the tool creates any missing parent directories (depth-first, same as `mkdir -p`). Pass `false` to require the parent directory to already exist; if it does not, the tool returns `parent_dir_missing`.

---

## 4. Output Shape

On a successful write, the tool returns a confirmation record with the following fields:

### 4.1 Confirmation Fields

**`ok`** (`boolean`, always `true` on success)
Indicates the write completed without error.

**`path`** (`string`)
The canonical intent-relative path that was written. This is the normalized form of the input `path` — absolute inputs are converted to intent-relative form in the output.

**`sha`** (`string`)
The SHA-256 hex digest of the content written to disk. Computed over the raw bytes actually written (i.e., after base64 decoding if `content_encoding: "base64"`). Matches the SHA that the drift-detection gate will compute on the next tick when it reads the file.

**`author_class`** (`string`, always `"human-via-mcp"` on success)
The author class stamped in the action-log entry. Included in the output so the caller can confirm the attribution was applied. Per ARCHITECTURE.md §6.1, `"human-via-mcp"` indicates an explicit human-mediated write through a sanctioned channel — in this case the MCP tool — as distinct from `"agent"` (written by the agent's normal pipeline) or `"human-implicit"` (inferred from a filesystem drop with no tool mediation).

**`timestamp`** (`string`)
ISO-8601 UTC timestamp of the write (e.g., `"2026-04-28T15:42:07.123Z"`). Recorded in both the action-log entry and the audit log.

**`human_author_id`** (`string | null`)
Echo of the `human_author_id` input field. `null` if the field was not provided.

**`dirs_created`** (`string[]`)
Array of intermediate directories created as a side effect, if any. Empty array if no directories were created (either they already existed or `create_dirs: false`). Intent-relative paths.

**`action_log_entry_id`** (`string`)
The identifier of the action-log entry written to the current tick's action log (format: `HWM-{tick_counter}-{sequential_number}`, e.g., `HWM-42-01`). Included so the caller can cross-reference the write event in the action log. The drift-detection gate reads this entry on the next tick to attach the correct `author_class` to the emitted drift event (per ARCHITECTURE.md §6.1 — the gate consults the action log to distinguish `human-via-mcp` from `human-implicit`).

**`audit_log_appended`** (`boolean`)
`true` if the audit log entry was successfully appended to `write-audit.jsonl` (see §8). `false` if the append failed for any reason (e.g., disk full, permission error). A `false` value does NOT cause the overall tool call to fail — the write still completed. The caller may wish to retry the audit log append or surface the failure to the user; the tool surfaces it here rather than silently swallowing it.

### 4.2 Example Response

```json
{
  "ok": true,
  "path": "knowledge/brand-guide.md",
  "sha": "a3f7c82e1d4b9f0517e6c2a84b3d5e9f1c7a2b4d6e8f0a2c4e6b8d0f2a4c6e8",
  "author_class": "human-via-mcp",
  "timestamp": "2026-04-28T15:42:07.123Z",
  "human_author_id": "jwaldrip@gigsmart.com",
  "dirs_created": [],
  "action_log_entry_id": "HWM-42-01",
  "audit_log_appended": true
}
```

---

## 5. Path Constraints

The tool enforces a path allow-list and a path deny-list. The deny-list takes precedence — a path that matches any deny-list pattern is refused regardless of whether it would also match an allow-list pattern.

### 5.1 Allow-List (Writable Paths)

The tool permits writes to the following locations within the intent directory:

| Pattern | Examples | Rationale |
|---|---|---|
| `knowledge/**` | `knowledge/brand-guide.md`, `knowledge/tokens.json` | Intent-scoped reference material; the elaboration phase's primary drop zone for human-supplied knowledge artifacts. |
| `stages/{stage}/knowledge/**` | `stages/design/knowledge/notes.md` | Per-stage knowledge addendum. Only stages that have a `knowledge/` directory in their tracked surface are valid targets; the tool validates that the stage exists in the intent's studio configuration. |
| `stages/{stage}/discovery/**` | `stages/inception/discovery/competitor.pdf` | Research and discovery artifacts for a stage. |
| `stages/{stage}/outputs/**` | `stages/design/outputs/hero.html`, `stages/design/outputs/hero.png` | Stage-produced deliverables that a human may legitimately replace (e.g., a designer swapping an agent-generated HTML mock for their own). |
| `stages/{stage}/artifacts/**` | `stages/design/artifacts/DESIGN-BRIEF.md` | Stage-scoped architecture and contract documents. |

All paths above are intent-relative. The tool resolves absolute paths to intent-relative before applying allow-list matching.

New directories within allowed patterns are created implicitly when `create_dirs: true` (the default). The tool will not create directories outside the allow-list patterns even if `create_dirs: true`.

### 5.2 Deny-List (Explicitly Forbidden Paths)

The following paths are ALWAYS refused, regardless of allow-list match. This list is verifiable by inspection — every entry corresponds to a workflow-managed file category that the existing PreToolUse hook also protects for agent writes.

| Pattern | Error Returned | Rationale |
|---|---|---|
| `stages/{stage}/units/*.md` | `path_outside_tracked_surface` | Unit files are lifecycle-managed by the workflow engine. Their frontmatter drives stage progression, hat dispatch, and completion invariants. Only MCP tools (`haiku_unit_write`, `haiku_unit_set`, etc.) may write them. |
| `stages/{stage}/feedback/*.md` | `path_outside_tracked_surface` | Feedback files are lifecycle-managed. Status transitions are enforced by the workflow engine; direct writes bypass integrity sealing. |
| `intent.md` | `path_outside_tracked_surface` | The intent root file is workflow-engine-managed. It owns active-stage position, mode, and intent-level metadata. |
| `stages/{stage}/state.json` | `path_outside_tracked_surface` | Per-stage state is the workflow engine's internal record. Direct writes would corrupt the stage-position invariants described in ARCHITECTURE.md §2.2. |
| `drift-markers.json` | `path_outside_tracked_surface` | The pending-assessment marker store is an internal workflow-engine artifact. |
| `write-audit.jsonl` | `path_outside_tracked_surface` | The audit log is append-only and written only by the tool itself. External writes would corrupt the audit trail. |
| `stages/{stage}/baseline.json` | `path_outside_tracked_surface` | The baseline is written only by the drift-detection gate and the workflow engine. Direct writes would desync the SHA baseline and cause false positives or missed detections. |
| Any path escaping the intent directory | `path_outside_tracked_surface` | Paths containing `..` sequences, symlinks that resolve outside the intent directory, or absolute paths outside the intent root are refused. |

The error code for all deny-list matches is `path_outside_tracked_surface` (§7.1), which includes a `reason` field describing which deny-list pattern was triggered.

---

## 6. Write Semantics

### 6.1 Disk Write

The file is written to disk atomically: the content is written to a temporary file in the same directory, then renamed to the destination path. Atomic rename prevents a partially-written file from being visible to the drift-detection gate during a concurrent tick.

If the destination file already exists and `overwrite: true` (default), the rename replaces the existing file. The prior content is not preserved — this is a replacement, not an append. If the caller needs the prior content, they should read it first using the standard Read tool before invoking `haiku_human_write`.

If the destination does not exist and `create_dirs: true` (default), parent directories are created before the write. The tool records created directories in the `dirs_created` field of the response.

### 6.2 Action-Log Entry

Immediately after the disk write, the tool appends an entry to the current tick's action log. This entry is what the pre-tick drift-detection gate reads on the next tick to distinguish `human-via-mcp` writes from silent filesystem drops (`human-implicit`). The entry carries:

- **Entry type:** `human_write`
- **Path:** the intent-relative path written
- **SHA:** the SHA-256 hex digest of the content written
- **Author class:** `"human-via-mcp"` (always)
- **Timestamp:** ISO-8601 UTC
- **Human author ID:** the `human_author_id` input (may be null)
- **Action log entry ID:** the `HWM-{tick}-{n}` identifier echoed in the response

The action log entry is the authoritative signal that the drift gate uses to classify the next tick's drift event as `human-via-mcp` rather than `human-implicit`. Without this entry, the gate would still detect the SHA divergence but would infer `human-implicit` (because no agent stamp or tool call for this path appears in the action log). The action log is the mechanism that lifts the write from implicit to explicit attribution.

### 6.3 Baseline-Update Intentional Non-Update

The tool does NOT update `baseline.json` directly. This is intentional and load-bearing. The unified detection-and-classification flow requires that:

1. The tool writes the file to disk.
2. The tool stamps an action-log entry with `author_class: "human-via-mcp"`.
3. The **next** `haiku_run_next` tick's drift-detection gate observes the SHA divergence.
4. The gate emits a drift event with `author_class: "human-via-mcp"` (read from the action log).
5. The workflow engine dispatches `manual_change_assessment`.
6. The agent classifies the finding; terminal outcomes update `baseline.json` per ARCHITECTURE.md §5.4.

Skipping step 3 by updating the baseline directly would prevent the drift event from firing, which means the agent would never classify the write. Classification is not optional — the `manual_change_assessment` action is what creates the durable assessment record (ARCHITECTURE.md §4.6) and what the SPA's drift assessment view displays. Bypassing it would leave the write without a classification record and would break the audit trail.

This mirrors the SPA upload pathway exactly: SPA uploads also write the file and stamp the action log but do not update the baseline (ARCHITECTURE.md §7.3). The two paths are symmetric by design so the drift gate handles them identically.

---

## 7. Error Contracts

All errors follow the same envelope shape:

```json
{
  "ok": false,
  "error": "<error_code>",
  "message": "<human-readable explanation>",
  <additional fields per error code>
}
```

The `error` field is machine-readable and stable. The `message` field is human-readable and may change across plugin versions. Callers should branch on `error`, not on `message`.

### 7.1 `path_outside_tracked_surface`

**Conditions:** The resolved path falls outside the allow-list, matches a deny-list pattern, escapes the intent directory via `..` or symlink traversal, or resolves to a path the tool has no authority to write.

**Additional fields:**

```json
{
  "error": "path_outside_tracked_surface",
  "path": "stages/design/units/unit-02.md",
  "reason": "deny_list_match",
  "deny_rule": "stages/{stage}/units/*.md",
  "message": "Cannot write to 'stages/design/units/unit-02.md': unit files are workflow-managed. Use haiku_unit_write or haiku_unit_set to author unit content."
}
```

The `reason` sub-field is one of:
- `"deny_list_match"` — path matched a deny-list pattern (includes `deny_rule` field naming the matched rule).
- `"no_allow_match"` — path did not match any allow-list pattern.
- `"path_escape"` — path escapes the intent directory boundary.
- `"invalid_stage"` — a stage-scoped path references a stage that does not exist in the intent's studio configuration.

**Recovery:** The caller should not retry with the same path. Either use the correct tool for workflow-managed files, or adjust the path to a tracked-surface location.

### 7.2 `rationale_required`

**Conditions:** The `human_write_require_rationale` plugin setting is `true` and the `rationale` field was not provided.

**Additional fields:**

```json
{
  "error": "rationale_required",
  "message": "Plugin settings require a rationale for human-attributed writes. Provide a short explanation of why the human requested this write in the 'rationale' field.",
  "config_key": "human_write_require_rationale"
}
```

**Recovery:** Retry the tool call with a non-empty `rationale` string. The rationale does not need to be long — a single sentence describing the user's intent is sufficient. Example: `"User requested saving their revised hero copy to the design outputs for the agent to extend."`.

### 7.3 `baseline_conflict`

**Conditions:** Between the time the tool began executing and the time it was ready to commit the disk write, the drift-detection gate (running in a concurrent tick) wrote an updated entry to `baseline.json` for the same path. This is the concurrency edge case where a tick fires in the narrow window between the tool's path-validation step and its disk-write step.

**Additional fields:**

```json
{
  "error": "baseline_conflict",
  "path": "knowledge/brand-guide.md",
  "message": "A concurrent workflow tick updated the baseline for 'knowledge/brand-guide.md' between validation and write. Retry the tool call; the conflict is transient.",
  "conflict_tick": 43
}
```

**Recovery:** Retry the tool call. The conflict is inherently transient — it can only occur during the narrow window when a tick is processing, and ticks complete quickly. A second call will succeed unless a new tick begins during the retry window. In practice, this error should be extremely rare because ticks are driven by explicit `haiku_run_next` invocations, not background processes. If the caller observes more than three consecutive `baseline_conflict` errors on the same path, it is a signal of a deeper workflow engine issue that warrants halting and surfacing to the user.

### 7.4 `path_already_exists`

**Conditions:** `overwrite: false` was set and the destination path already exists on disk.

**Additional fields:**

```json
{
  "error": "path_already_exists",
  "path": "knowledge/brand-guide.md",
  "existing_sha": "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  "message": "Path 'knowledge/brand-guide.md' already exists and overwrite is false. Set overwrite: true to replace it."
}
```

**Recovery:** Set `overwrite: true` to overwrite, or choose a different path.

### 7.5 `parent_dir_missing`

**Conditions:** `create_dirs: false` was set and the destination path's parent directory does not exist.

**Additional fields:**

```json
{
  "error": "parent_dir_missing",
  "path": "stages/design/outputs/new-section/hero.html",
  "missing_dir": "stages/design/outputs/new-section",
  "message": "Parent directory 'stages/design/outputs/new-section' does not exist and create_dirs is false."
}
```

**Recovery:** Set `create_dirs: true` (the default) to allow directory creation, or create the parent directory first via a separate operation.

### 7.6 `invalid_content_encoding`

**Conditions:** `content_encoding` was provided with an unrecognized value (not `"utf-8"` or `"base64"`).

**Recovery:** Pass a valid `content_encoding` value.

---

## 8. Audit Trail

Every successful invocation of `haiku_human_write` appends a record to the intent-scoped audit log at:

```
.haiku/intents/{slug}/write-audit.jsonl
```

This is a newline-delimited JSON log (one JSON object per line, one object per invocation). The file is **append-only** — no record is ever modified or deleted. Writes that fail before completing (e.g., `path_outside_tracked_surface` errors) do NOT append to the audit log; only successful writes are logged.

### 8.1 Audit Log Record Shape

Each record carries:

```json
{
  "timestamp": "2026-04-28T15:42:07.123Z",
  "entry_id": "HWM-42-01",
  "path": "knowledge/brand-guide.md",
  "sha": "a3f7c82e1d4b9f0517e6c2a84b3d5e9f1c7a2b4d6e8f0a2c4e6b8d0f2a4c6e8",
  "author_class": "human-via-mcp",
  "human_author_id": "jwaldrip@gigsmart.com",
  "rationale": "User asked me to save the brand guide excerpt they pasted into the conversation.",
  "user_instruction_excerpt": "can you write this to the knowledge dir for me?",
  "tick_counter": 42,
  "session_id": "sess-abc123",
  "overwrite": true,
  "dirs_created": [],
  "audit_log_appended": true
}
```

### 8.2 Field Definitions

**`timestamp`** — ISO-8601 UTC timestamp of the write, matching the tool's response timestamp.

**`entry_id`** — The `HWM-{tick}-{n}` identifier, matching the tool's response `action_log_entry_id`.

**`path`** — Intent-relative path written.

**`sha`** — SHA-256 hex digest of written content.

**`author_class`** — Always `"human-via-mcp"` for records in this log.

**`human_author_id`** — The caller-supplied identifier. `null` if not provided.

**`rationale`** — The caller-supplied rationale. `null` if not provided.

**`user_instruction_excerpt`** — The first 200 characters of the user's instruction as extracted from the conversation context by the agent, if available. This field is self-reported by the agent and is not validated. Its purpose is to give a security reviewer a quick-read of what the human actually said, without requiring them to pull the full conversation log. `null` if the agent did not supply this context.

**`tick_counter`** — The current tick counter at the time of the write. Used by auditors to correlate the write with workflow engine state at that moment.

**`session_id`** — The MCP session identifier, if available from the server context. Used to correlate writes with a specific conversation session. `null` if the session ID is not accessible.

**`overwrite`** — Echo of the `overwrite` input field.

**`dirs_created`** — Array of intermediate directories created, matching the tool's response field.

**`audit_log_appended`** — Always `true` in the audit log itself (the record would not exist if the append failed). The `audit_log_appended: false` case can only appear in the tool's response, never in the log.

### 8.3 Audit Log Properties

**Human-readable.** The JSONL format is directly inspectable with any text viewer or standard shell tools. Each line is a complete, self-contained JSON object. No proprietary reader is required.

**Append-only.** The file is opened in append mode; no record is ever overwritten or deleted. The log grows indefinitely. For large intents with many human writes, log rotation is a future concern — not in scope for v1.

**Security posture.** The audit log is the primary evidence trail for the trust-plus-audit stance adopted in ARCHITECTURE.md §6.3 and resolved from Decision 9 in DESIGN-DECISIONS.md. A security review can verify that every `human-via-mcp` entry in any `baseline.json` has a corresponding audit log entry with user instruction context, confirming that the write was accompanied by an explicit human turn in the conversation.

---

## 9. Integration with the SPA Upload Pathway

The SPA upload pathway (the Knowledge Upload Panel and Stage Output Replacement Card specified in DESIGN-BRIEF.md Screens 1 and 2) and this MCP tool are **two distinct entry points** that produce the **same baseline-protocol outcome**. They are NOT the same tool. Their relationship is:

| Attribute | `haiku_human_write` (this tool) | SPA Upload Endpoint |
|---|---|---|
| Entry point | Agent-conversation (the user instructs the agent in chat) | SPA browser UI (user drags/drops or picks a file in the review app) |
| Who initiates | Human in chat → agent executes the tool call | Human in the SPA browser → SPA posts to the API endpoint |
| Content delivery | Tool call `content` field (string or base64) | Multipart POST (browser file upload) |
| Action-log stamp | `haiku_human_write` writes the action-log entry as part of its execution | SPA upload endpoint writes the action-log entry (ARCHITECTURE.md §7.3) |
| Baseline update | NOT updated directly — deferred to `manual_change_assessment` | NOT updated directly — same deferral (ARCHITECTURE.md §7.3) |
| Audit log | Appends to `write-audit.jsonl` | SPA upload endpoint also appends to `write-audit.jsonl` (same log, same format) |
| `author_class` stamped | `"human-via-mcp"` | `"human-via-mcp"` |
| Drift-detection path | Next tick emits drift event with `author_class: "human-via-mcp"` | Next tick emits drift event with `author_class: "human-via-mcp"` |

Both paths stamp `human-via-mcp` baselines; both defer the baseline update to `manual_change_assessment`; both write to the same audit log. The behavioral outcome is identical from the workflow engine's perspective. The distinction is purely at the entry-point layer: chat versus browser UI.

This separation is important because:
- The SPA upload path is specified in the SPA UI units (unit-04-spa-ui-specs); this document does not specify it.
- Development teams implementing these two entry points may be separate; neither should depend on the other's internal implementation.
- The audit log is the integration point: both append to the same `write-audit.jsonl`, so a unified audit trail exists regardless of which path was used.

---

## 10. Integrity Stance — Decision 9 (Human-Write Path Integrity)

DESIGN-DECISIONS.md §9 left open the question of whether the tool should require an explicit human confirmation step before completing, or rely on trust plus audit trail. ARCHITECTURE.md §6.3 resolved this as **trust plus audit**. This section records the rationale in contract terms.

The tool does NOT require a confirmation round-trip. When the agent invokes `haiku_human_write`, the write proceeds if the path is valid and all inputs meet their constraints. No `ask_user_visual_question` prompt, no ambient approval token, no harness-level gate on the agent's ability to invoke the tool.

**Rationale.** The primary use case is interactive: a human is present in the conversation and has explicitly asked the agent to write a specific file. The human's intent is unambiguous — they gave a direct instruction and the agent is carrying it out. Adding a confirmation step ("are you sure you want to write this file?") would be friction on an action the user already authorized, which would make the tool feel like ceremony rather than a natural assistant behavior. DESIGN-DECISIONS.md §9 puts this clearly: the confirmation is "opt-in for 'hey claude just write this config file.'"

**Why the trust model is adequate here.** The core security risk identified in DISCOVERY.md's "Hook bypass becomes a liability" section is that an adversarial or misconfigured agent could use the tool to stamp its own writes as `human-via-mcp`, evading the drift-detection gate. The trust-plus-audit stance addresses this risk through three mechanisms:

1. **Audit log with `user_instruction_excerpt`.** Every write records what the human said (first 200 chars). A security reviewer can spot anomalies: a `human-via-mcp` entry with a `user_instruction_excerpt` that does not match any human conversational turn in the session log is evidence of misuse.

2. **Path deny-list.** The tool refuses workflow-managed files unconditionally. Even if an adversarial agent invokes the tool, it cannot write `units/*.md`, `intent.md`, `state.json`, or `baseline.json` — the files where misattribution would have the most severe structural consequences.

3. **Classification still fires.** The tool does NOT update `baseline.json` directly. Even a write that bypasses conversational discipline still goes through `manual_change_assessment` on the next tick, where the agent must produce a classification and rationale that become part of the durable assessment record. A silent abuse would leave a paper trail in the assessment record that a human reviewer could inspect.

**Harness-level enforcement deferred to v2.** For v1, the boundary is conversational discipline: the agent SHOULD echo the user's instruction and the rationale in the tool call's `rationale` field so the audit log is populated. Harness-level enforcement (e.g., a hook that checks that a human turn precedes the tool invocation in the conversation context) is architecturally possible but not required for v1. If the team later observes misuse patterns in production audit logs, harness-level enforcement is the natural v2 mitigation.

---

## 11. Relationship to ARCHITECTURE.md Baseline-Update Contract

This tool's write semantics (§6) and the baseline-update behavior specified in ARCHITECTURE.md §2.3 and §5.4 are designed as a consistent pair. The cross-references:

| This document | ARCHITECTURE.md reference |
|---|---|
| §6.2 — action-log entry stamped at write time | §6.1 — `human-via-mcp` class: "explicit human-mediated write reached the workflow engine through a sanctioned channel…stamps an action-log entry at write time marking the write as `human-via-mcp`" |
| §6.3 — baseline NOT updated at write time | §2.3 item 2 — "The tool does NOT update `baseline.json` directly." (identical language, intentional) |
| §7.1 deny-list matches `baseline.json` | §2.2 — baseline lives at `stages/{stage}/baseline.json`; the deny-list protects this path |
| §9 — both `haiku_human_write` and SPA upload produce the same downstream flow | §7.3 — "This means every SPA upload flows through the unified detection-and-classification path." |
| §10 — trust + audit stance | §6.3 — "Chosen stance: trust + audit." |
| `"human-via-mcp"` author class | §6.1 — the three author classes defined in full |

Any discrepancy between this document and ARCHITECTURE.md should be resolved by treating ARCHITECTURE.md as authoritative (it is the structural reference produced by unit-01-architecture-spec) and updating this contract to align. The development stage should flag any discrepancy it discovers rather than silently implementing the one that appears easier.

---

## Annex: Co-Located MCP Tool Not Specified by This Contract

`haiku_human_write` is the only MCP tool authored by this intent's design and the only tool whose contract this document specifies in full. A second MCP tool — **`haiku_reconciliation_acknowledge`** — also exists on this intent's branch, sourced from repo PR #283 ("feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged 2026-04-30, entered this intent's branch via the 2026-05-01 main-merge). It is **not** specified here.

**Tool purpose (informational only — see implementation for the binding contract):** `haiku_reconciliation_acknowledge` is the proceed-without-fix escape hatch for the upstream-reconciliation pre-tick gate. When the gate detects cross-document divergence between agent-authored upstream artifacts (tool-name divergence, http-status divergence, field-name divergence) and the divergence is intentional (the artifacts describe different surfaces that genuinely need different names), the agent calls this tool to record the acknowledgment and unblock subsequent ticks for the affected stage.

**Why this contract does NOT specify it:**

1. The tool's input shape, output shape, error model, idempotency, and persistence semantics are not derivable from this intent's design decisions or product acceptance criteria.
2. Specifying it here would imply this intent's design owns it, which would falsify the cross-stage trace the verifier hat checks.
3. The tool is referenced only by the operations runbook (`stages/operations/units/unit-01-operational-runbook.md` scenarios 5 and 11) and tests authored under PR #283.

**Implementation references (not contracts):**

- Source: `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts` and the wire-up in `packages/haiku/src/orchestrator/workflow/run-tick.ts` (search for `haiku_reconciliation_acknowledge`).
- Tests: `packages/haiku/test/upstream-reconciliation.test.mjs`.
- Operations references: `stages/operations/units/unit-01-operational-runbook.md` scenarios 5 and 11; `stages/operations/units/unit-04-migration-safety-tests.md` scenario G.

A future intent that takes ownership of upstream-reconciliation should author a sibling MCP-TOOL-CONTRACT for `haiku_reconciliation_acknowledge` with the same rigor this contract applies to `haiku_human_write` (input/output shape, validation, error model, idempotency, audit, security, baseline-update interaction, etc.).

**Cross-references:** See `knowledge/DISCOVERY.md` § "Annexed Subsystem", `stages/design/artifacts/ARCHITECTURE.md` § "Annex: Co-Located Upstream-Reconciliation Gate".
