---
title: "Data Contracts — Out-of-band Human File Modifications"
intent: out-of-band-human-file-modifications
stage: product
---

# Data Contracts

This document defines every field-level contract that crosses a boundary in the out-of-band-human-file-modifications subsystem: the persistent **baseline state** the drift-detection gate reads, the **drift-finding payload** the agent receives in `manual_change_assessment`, the **classification record** the agent writes back, the **MCP tool surfaces** new to this intent (human-attributed write tool, baseline reset, classification submission), the **HTTP API** the browse SPA uses for upload affordances, and the **internal events** the workflow engine emits when drift is detected and classified.

These contracts are the agreement between (a) the workflow engine's tick loop, (b) the agent's tool-use surface, (c) the browse SPA frontend, and (d) the persistent state on disk. Naming, type, and required/optional designations are pinned here so the build stage cannot diverge across surfaces.

> **Scope boundary.** This artifact covers the data shapes only. Where each baseline lives (per-stage vs intent-scope), the SPA component structure that consumes the upload endpoints, and the security stance for the human-attributed write tool are decided in sibling discovery artifacts (DESIGN-DECISIONS, USER-STORIES, INTEGRATION-MAP). Cross-cutting boundaries are flagged inline as *boundary notes*; any field that depends on a sibling decision is marked **DEFERRED-TO-DESIGN**.

---

## 1. Naming Conventions (apply everywhere below)

To meet the "naming is consistent across all contracts" quality signal, the same entity name appears identically wherever it crosses a boundary:

| Concept | Canonical name (snake_case for storage, camelCase for TS, kebab-case for URLs) |
|---|---|
| The SHA-indexed last-known content for a tracked file | `baseline` (DB column / state field), `Baseline` (TS interface), `baselines` (collection / URL segment) |
| One file currently being monitored | `tracked_file` / `TrackedFile` / `tracked-files` |
| One detected divergence between baseline and disk | `drift_finding` / `DriftFinding` / `drift-findings` |
| One agent-authored classification of a drift finding | `assessment` / `Assessment` / `assessments` |
| The four legal classification outcomes | `classification` (string enum); never `decision`, never `verdict` |
| A pending-assessment marker that suppresses re-detection | `pending_marker` / `PendingMarker` / `pending-markers` |
| A write attributed to a human (vs. an agent) | `author_class: "human-via-mcp"` or `"human-implicit"` (canonical field on `Baseline`; `"human-via-mcp"` for agent-mediated writes via `haiku_human_write`, `"human-implicit"` for filesystem drops) |

Status enums and origin enums reuse the existing feedback vocabulary where semantically equivalent, to avoid parallel taxonomies. Where this intent introduces genuinely new vocabulary it is marked **NEW** in the table above (`baseline`, `tracked_file`, `drift_finding`, `assessment`, `classification`, `pending_marker`).

---

## 2. Persistent State Schemas (on-disk + in-memory)

The workflow engine persists three new state shapes. The exact storage mechanism (JSON-on-disk colocated with `state.json`, separate `baseline.json`, sqlite, etc.) is **DEFERRED-TO-DESIGN**; what is fixed here is the field-level shape every storage choice must materialize.

### 2.1 `Baseline` — one record per tracked file

| Field | Type | Required | Default | Constraints / Notes |
|---|---|---|---|---|
| `path` | string | yes | — | Path **relative to the intent root** (`.haiku/intents/{slug}/`). Must be POSIX (`/` separators), no leading slash, no `..` segments. Unique per intent. |
| `sha256` | string | yes | — | Hex-lowercase SHA-256 of the file's raw bytes at last acknowledgment. 64 chars. |
| `bytes` | integer | yes | — | File size in bytes at acknowledgment. Required even when `sha256` is present, for cheap pre-check before re-hashing on tick. |
| `mtime_ns` | integer | yes | — | File mtime in nanoseconds since epoch at acknowledgment. Used as a hashing skip-hint only — `sha256` is authoritative. |
| `is_binary` | boolean | yes | `false` | True if the file fails the UTF-8 / nul-byte heuristic. Affects diff payload (binary signal vs unified diff) downstream. |
| `author_class` | string | yes | — | Enum: `"agent"` \| `"human-via-mcp"` \| `"human-implicit"`. Records who/what last set this baseline. `"human-via-mcp"` = written by agent on explicit user instruction via `haiku_human_write`; `"human-implicit"` = filesystem drop detected at tick time. |
| `acknowledged_at` | string (RFC 3339) | yes | — | UTC ISO-8601 timestamp with `Z` suffix. Example: `"2026-04-28T14:32:00Z"`. |
| `acknowledged_via` | string | yes | — | Enum: `"agent-write"` \| `"human-write-tool"` \| `"spa-upload"` \| `"classification-terminal"` \| `"baseline-init"`. Names the *path* through which the baseline was last written. |
| `stage` | string \| null | yes | — | Owning stage slug (e.g. `"product"`, `"design"`, `"development"`). `null` for intent-scope files (e.g. `intent.md`, `feedback/*.md` at intent root). |
| `tracking_class` | string | yes | — | Enum: `"stage-output"` \| `"knowledge"` \| `"unit-output"` \| `"intent-meta"`. Drives which directories are scanned and which UI affordances apply. |

**Example:**

```json
{
  "path": "stages/product/discovery/USER-STORIES.md",
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "bytes": 4821,
  "mtime_ns": 1714312320123456789,
  "is_binary": false,
  "author_class": "agent",
  "acknowledged_at": "2026-04-28T14:32:00Z",
  "acknowledged_via": "agent-write",
  "stage": "product",
  "tracking_class": "stage-output"
}
```

**Indexes (logical — physical layer is design-stage):** primary `(intent_slug, path)`; secondary `(intent_slug, stage)` for per-stage scans; secondary `(intent_slug, tracking_class)` for SPA filters.

### 2.2 `PendingMarker` — one record per non-terminal classification

Created by `manual_change_assessment` when the classification is `surface-as-feedback` or `trigger-revisit`; cleared when the downstream action resolves.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `path` | string | yes | — | Same shape as `Baseline.path`. Foreign-key-equivalent to `Baseline`. |
| `created_at` | string (RFC 3339) | yes | — | When the marker was placed. |
| `created_by_assessment_id` | string | yes | — | The `Assessment.id` that created the marker (e.g. `"AS-NN"`). |
| `outcome` | string | yes | — | Enum: `"surface-as-feedback"` \| `"trigger-revisit"`. The non-terminal classification that produced this marker. |
| `linked_feedback_id` | string \| null | yes | — | `"FB-NN"` of the feedback item the marker is waiting on, or `null` if `outcome === "trigger-revisit"`. |
| `linked_revisit_target_stage` | string \| null | yes | — | Stage slug being revisited, or `null` if `outcome === "surface-as-feedback"`. Exactly one of `linked_feedback_id` / `linked_revisit_target_stage` is non-null per marker (mutual exclusion enforced at write time). |
| `cleared_at` | string (RFC 3339) \| null | yes | `null` | Set atomically with `resolved_sha` when the linked downstream action resolves; once non-null the marker is logically deleted (or hard-deleted, design choice). |
| `resolved_sha` | string \| null | yes | `null` | The on-disk SHA-256 of the file at clearance time. `null` while pending. Set atomically with `cleared_at` exactly once — never updated after that point. |

**Mutation contract:** `PendingMarker` is intentionally *not* append-only. `cleared_at` and `resolved_sha` are the only fields ever mutated, and they are set together in a single atomic write at clearance time. After that write the record is logically frozen — no further mutations are permitted.

**Constraints:**
- `(intent_slug, path)` is **NOT** unique here — multiple markers may queue on the same file across separate assessments. Newest open marker (max `created_at` with `cleared_at IS NULL`) is the suppressing one.
- The drift-detection gate's "skip if pending" check is: *exists any row with this `path` and `cleared_at IS NULL`*. Implementation may collapse multiple markers on the same path to one open row at design time — that is a denormalization choice, not a contract change.

**Example (open marker):**

```json
{
  "path": "stages/design/outputs/layout-v2.html",
  "created_at": "2026-04-28T14:35:12Z",
  "created_by_assessment_id": "AS-07",
  "outcome": "surface-as-feedback",
  "linked_feedback_id": "FB-12",
  "linked_revisit_target_stage": null,
  "cleared_at": null,
  "resolved_sha": null
}
```

### 2.3 `Assessment` — one record per agent classification decision

Append-only. The durable record of "what changed, what the agent decided, why." Records are **never modified after writing** — `resulting_sha` is set once at classification time and never updated.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | string | yes | — | `"AS-NN"`, two-digit zero-padded sequential per intent (mirrors `FB-NN` / `unit-NN-` conventions). |
| `created_at` | string (RFC 3339) | yes | — | UTC. |
| `tick_id` | string | yes | — | Identifier of the `haiku_run_next` tick that produced this assessment. May be a tick UUID or `(intent_slug, tick_seq)`; **DEFERRED-TO-DESIGN**. |
| `findings` | array of `DriftFinding` | yes | — | The full set of findings the agent classified in this dispatch. Always at least 1 element. |
| `classifications` | array of `Classification` | yes | — | One classification per finding, parallel-indexed (`classifications[i]` corresponds to `findings[i]`). Length must equal `findings.length`. |
| `agent_rationale` | string | yes | — | Free-form prose, the agent's explanation of *why* it classified each finding the way it did. Used by the SPA's drift assessment view; `>= 1` non-whitespace character. |
| `resulting_sha` | string \| null | yes | — | For terminal outcomes (`ignore`, `inline-fix`): the on-disk SHA-256 of the file at classification time. For non-terminal outcomes (`surface-as-feedback`, `trigger-revisit`): `null` — always. Never updated after the record is written. The post-clearance SHA for non-terminal outcomes lives on `PendingMarker.resolved_sha` and the `pending_marker_cleared` event payload (§ 6.3). |
| `revisit_invoked_at` | string (RFC 3339) \| null | yes | `null` | UTC timestamp when the workflow engine invoked `haiku_revisit` for a `trigger-revisit` outcome in this assessment. `null` at write time; stamped atomically when `haiku_revisit` fires on the next tick. Append-only: never reset once set. `null` for assessments with no `trigger-revisit` classifications. Full timing contract in §3.6. |
| `mode` | string | yes | — | Enum: `"interactive"` \| `"pickup"` \| `"autopilot"` \| `"hybrid"`. Captured at assessment time so the SPA can render mode-aware context (e.g. "this was decided silently in autopilot"). |
| `confirmed_by_user` | boolean | yes | `false` | True only when the user explicitly confirmed the agent's classification in interactive mode. False in autopilot. False when the user hasn't acted on a surfaced classification. |

**Example:**

```json
{
  "id": "AS-07",
  "created_at": "2026-04-28T14:35:12Z",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "findings": [
    {
      "path": "stages/design/outputs/layout-v2.html",
      "change_kind": "modified",
      "is_binary": false,
      "diff_unified": "@@ -12,3 +12,5 @@\n …",
      "before_sha256": "9f86…",
      "after_sha256": "ab12…",
      "before_bytes": 4821,
      "after_bytes": 5104,
      "tracking_class": "stage-output",
      "stage": "design",
      "context_unit": null
    }
  ],
  "classifications": [
    {
      "path": "stages/design/outputs/layout-v2.html",
      "outcome": "surface-as-feedback",
      "rationale_excerpt": "Designer-replaced layout introduces a nav pattern not in the spec — needs a unit revision before extension.",
      "linked_feedback_id": "FB-12",
      "linked_revisit_target_stage": null
    }
  ],
  "agent_rationale": "The diff replaces the entire navigation block with a sidebar variant that is not specified in the design unit. Surfacing as feedback so the design lead can confirm before we re-elaborate.",
  "resulting_sha": null,
  "mode": "autopilot",
  "confirmed_by_user": false
}
```

---

## 3. Workflow-Action Payload Schemas

### 3.1 `DriftFinding` — emitted by the drift-detection gate

This is the structured per-file payload the gate produces and the `manual_change_assessment` action receives.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `path` | string | yes | — | Same shape as `Baseline.path`. |
| `change_kind` | string | yes | — | Enum: `"new-file-detected"` \| `"modified"` \| `"file-removed"`. Drives downstream UI labeling and which classification outcomes are legal (a `"file-removed"` cannot be classified `"inline-fix"` against a non-existent file — see § 3.4 legality matrix). |
| `is_binary` | boolean | yes | — | True if either the previous baseline was binary or the new file fails the text heuristic. |
| `diff_unified` | string \| null | yes | — | Standard unified diff (3 lines context). `null` when `is_binary === true` or when `change_kind === "new-file-detected"` and the file is large (> 256 KB — threshold **DEFERRED-TO-DESIGN**). For new files under threshold, the field carries the full content as a `+++`-only diff. |
| `before_sha256` | string \| null | yes | — | Hash of the baseline content. `null` when `change_kind === "new-file-detected"`. |
| `after_sha256` | string \| null | yes | — | Hash of the on-disk content. `null` when `change_kind === "file-removed"`. |
| `before_bytes` | integer \| null | yes | — | Byte size of baseline. `null` for `"new-file-detected"`. |
| `after_bytes` | integer \| null | yes | — | Byte size of on-disk file. `null` for `"file-removed"`. |
| `tracking_class` | string | yes | — | Mirrors `Baseline.tracking_class`. |
| `stage` | string \| null | yes | — | Mirrors `Baseline.stage`. |
| `context_unit` | string \| null | yes | — | Unit slug if the file lives under `units/{unit-slug}/`, else `null`. The agent uses this to scope its classification reasoning. |

**Cross-field invariants (validated by the gate):**

1. `change_kind === "new-file-detected"` ⇒ `before_sha256 === null && before_bytes === null`.
2. `change_kind === "file-removed"` ⇒ `after_sha256 === null && after_bytes === null && diff_unified === null`.
3. `change_kind === "modified"` ⇒ all four (`before_sha256`, `after_sha256`, `before_bytes`, `after_bytes`) non-null AND `before_sha256 !== after_sha256`.
4. `is_binary === true` ⇒ `diff_unified === null`.

### 3.2 `manual_change_assessment` action payload (workflow engine → agent)

The action the workflow engine returns from `haiku_run_next` when the drift-detection gate has open findings and no upstream feedback-triage findings are pending.

| Field | Type | Required | Notes |
|---|---|---|---|
| `action` | string | yes | Always the literal `"manual_change_assessment"`. Discriminator. |
| `intent_slug` | string | yes | Mirrors other actions. |
| `stage` | string | yes | Active stage at tick time. |
| `tick_id` | string | yes | Same shape as `Assessment.tick_id`. |
| `findings` | array of `DriftFinding` | yes | `>= 1` element. The set the agent must classify in this dispatch. |
| `mode` | string | yes | Current invocation mode (interactive / pickup / autopilot / hybrid). |
| `instructions` | string | yes | Agent-facing instructions string (built by the orchestrator), describing how to classify and which MCP tool to call. |
| `legal_outcomes` | object | yes | Map from `findings[i].path` → array of `Classification.outcome` strings the agent may legally pick for that finding. Pre-filtered using the legality matrix in § 3.4. |

**Example (truncated):**

```json
{
  "action": "manual_change_assessment",
  "intent_slug": "out-of-band-human-file-modifications",
  "stage": "product",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "findings": [ /* DriftFinding objects */ ],
  "mode": "autopilot",
  "instructions": "Classify each finding by calling haiku_classify_drift …",
  "legal_outcomes": {
    "stages/design/outputs/layout-v2.html": ["ignore", "inline-fix", "surface-as-feedback", "trigger-revisit"]
  }
}
```

### 3.3 `Classification` — one decision per finding (agent → workflow engine)

The shape the agent submits via the new `haiku_classify_drift` MCP tool (see § 4.3).

| Field | Type | Required | Notes |
|---|---|---|---|
| `path` | string | yes | Must exactly match a `findings[i].path` from the dispatched action. |
| `outcome` | string | yes | Enum: `"ignore"` \| `"inline-fix"` \| `"surface-as-feedback"` \| `"trigger-revisit"`. |
| `rationale_excerpt` | string | yes | Per-finding short rationale. `>= 1` non-whitespace character. The agent's longer prose lives in `Assessment.agent_rationale`; this field is for the SPA's per-row label. |
| `linked_feedback_id` | string \| null | conditional | Required when `outcome === "surface-as-feedback"`. Must be the `FB-NN` of a feedback item created in the same tool call (see § 4.3 for the side-effect ordering). Null for all other outcomes. |
| `linked_revisit_target_stage` | string \| null | conditional | Required when `outcome === "trigger-revisit"`. Must be a stage slug at or before the active stage. Null for all other outcomes. |

### 3.4 Outcome legality matrix (per `change_kind`)

| `change_kind` \ `outcome` | `ignore` | `inline-fix` | `surface-as-feedback` | `trigger-revisit` |
|---|---|---|---|---|
| `new-file-detected` | OK | OK | OK | OK |
| `modified` | OK | OK | OK | OK |
| `file-removed` | OK | rejected | OK | OK |

A `"file-removed"` finding cannot be `"inline-fix"`d because there is nothing on disk to extend; the agent must either re-create it (which would be a new-file-detected on the next tick) or pick another outcome. The gate enforces this in `legal_outcomes` (§ 3.2) before dispatch.

### 3.5 Pre-tick gate ordering with feedback-triage

This intent's drift-detection gate runs **after** the existing feedback-triage gate in the pre-tick sequence. The ordering rationale is:

1. Untriaged feedback may relocate files (`haiku_feedback_move` rewrites attachments and moves md files). Letting drift detection run first would emit findings for files that are about to be moved, producing spurious classifications.
2. Feedback triage's no-op confirm operation does not change any tracked-surface file content, so it never invalidates drift-gate baselines.
3. The drift gate's findings are independent of feedback state, so running it second is always safe.

The gate sequence is therefore: tamper-detection → feedback-triage → drift-detection → per-state dispatch. *This is a contract for the workflow-engine sibling artifact; mentioned here only because the action ordering surfaces in the `haiku_run_next` response shape.*

### 3.6 `trigger-revisit` baseline-update timing

When a finding is classified `trigger-revisit`, the baseline for that file is **not** updated at classification time — it is updated at revisit-completion time. This section is the self-contained contract for that timing; no design-stage artifact is required to implement it.

**Atomic-ordering steps:**

1. **Classification** — agent calls `haiku_classify_drift` with `outcome: "trigger-revisit"`. The tool writes a `PendingMarker` (§2.2) with `cleared_at: null` and `resolved_sha: null`. `Baseline` is NOT updated. `Assessment.revisit_invoked_at` is written as `null` (§2.3).
2. **Revisit-invoked** — on the next tick the workflow engine calls `haiku_revisit` targeting `PendingMarker.linked_revisit_target_stage`. At this moment `Assessment.revisit_invoked_at` is stamped with the UTC time of invocation. The `PendingMarker` remains open (`cleared_at: null`).
3. **Revisit-complete** — when the revisited stage's gate passes (stage re-advances after the revisit cycle), the workflow engine calls `haiku_baseline_clear_marker` with `trigger: "revisit-complete"`. In a single atomic write: (a) `PendingMarker.resolved_sha` is set to the on-disk `sha256` of the file at resolution time; (b) `Baseline` is updated with the resolved SHA, `bytes`, `mtime_ns`, `author_class: "agent"`, `acknowledged_via: "classification-terminal"`; (c) `PendingMarker.cleared_at` is stamped with the current UTC time.
4. **Marker-clear** — the marker is logically frozen (`cleared_at` and `resolved_sha` both non-null). The drift gate's "skip if pending" predicate (`cleared_at IS NULL`) will no longer suppress this path on subsequent ticks.

**`Assessment.revisit_invoked_at` semantics:**

| State | Value |
|---|---|
| Written at classification time; `haiku_revisit` not yet called | `null` |
| `haiku_revisit` has fired targeting this assessment's stage | UTC RFC 3339 timestamp, e.g. `"2026-04-29T10:00:00Z"` |

Append-only: transitions from `null` → timestamp exactly once, never reset. An Assessment with non-null `revisit_invoked_at` and open `PendingMarker` rows means the revisit is in progress.

**`PendingMarker.resolved_sha` semantics for `trigger-revisit`:**

| State | Value |
|---|---|
| Marker open (pending or revisit in progress) | `null` |
| Cleared via `revisit-complete` | On-disk SHA-256 at resolution time (64 hex chars) |
| Cleared via `feedback-closed` or `feedback-rejected` | `null` (the feedback path updates Baseline directly; the marker carries no SHA) |

This field records the exact SHA the Baseline was updated to, providing a post-clearance audit trail without requiring a second Baseline read.

---

## 4. MCP Tool Contracts (new tools introduced by this intent)

This section specifies the *interface shape* of new MCP tools. Tool names below are **DEFERRED-TO-DESIGN** but a representative name is given for clarity; the field-level shapes are fixed.

### 4.1 `haiku_human_write` — agent writes on behalf of human

Purpose: when a user instructs the agent in chat to "save this Tailwind config to the design references," the agent uses this tool instead of `Write`. The tool sets `Baseline.author_class = "human-via-mcp"` so the drift gate does not re-flag the write on the next tick.

**Authentication / scope:** Any agent invocation; no user-token required. Audit linkage to the user instruction is established via the surrounding chat context, not a tool argument. *Boundary: the security stance of this tool — trust + audit vs. explicit-confirmation prompt — is decided in the security/hooks sibling artifact (DESIGN-DECISIONS Decision 9).*

**Request:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `intent_slug` | string | yes | Must be the active intent. |
| `path` | string | yes | POSIX, relative to intent root, no `..`, no leading `/`. Must fall under a writable tracking class (`stage-output`, `knowledge`, `unit-output`); writes to `intent-meta` paths (`intent.md`, `state.json`, etc.) are rejected — those remain MCP-tool-only via `haiku_unit_*` and `haiku_intent_*`. |
| `content` | string | yes | UTF-8 file contents. For binary writes, use base64 with `encoding: "base64"`. |
| `encoding` | string | no | `"utf-8"` (default) \| `"base64"`. |
| `user_instruction_excerpt` | string | yes | The user's chat instruction that prompted this write, captured for the audit log. `>= 1` non-whitespace char. |

**Response (success):**

```json
{
  "ok": true,
  "path": "stages/design/knowledge/tailwind-config.json",
  "sha256": "ab12…",
  "bytes": 1432,
  "baseline_updated": true,
  "tracking_class": "knowledge"
}
```

**Error responses:**

| `code` (string) | HTTP-equivalent | When |
|---|---|---|
| `path_outside_intent` | 400 | `path` resolves outside `.haiku/intents/{slug}/`. |
| `path_protected` | 403 | `path` falls under `intent-meta` tracking class (e.g. `intent.md`, `state.json`, `units/*.md`, `feedback/*.md`). Mirrors the existing `guard-workflow-fields` hook policy. |
| `intent_not_found` | 404 | `intent_slug` does not match any intent on disk. |
| `intent_not_active` | 409 | The slug exists but is archived. |
| `bad_encoding` | 400 | `content` is not valid for the declared `encoding`. |
| `internal_write_failed` | 500 | Disk write failed; baseline NOT updated. |

**Error body shape (consistent with existing MCP tool errors):**

```json
{ "ok": false, "code": "path_protected", "message": "Cannot write to intent.md via human-write tool; use haiku_intent_* tools." }
```

### 4.2 `haiku_baseline_init` — bootstrap on upgrade

Purpose: the first observation of a file in an intent that pre-dates the feature MUST establish a baseline without firing `manual_change_assessment`. This tool is invoked once-per-intent by an upgrade migration; subsequent calls are no-ops for already-baselined files.

**Request:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `intent_slug` | string | yes | — |
| `mode` | string | yes | Enum: `"establish-all"` (scan tracked surface, baseline every file) \| `"establish-paths"` (baseline only the listed paths). |
| `paths` | array of string | conditional | Required when `mode === "establish-paths"`. |

**Response:**

```json
{
  "ok": true,
  "intent_slug": "out-of-band-human-file-modifications",
  "baselines_created": 47,
  "baselines_skipped_existing": 3,
  "tracking_classes": {
    "stage-output": 18,
    "knowledge": 12,
    "unit-output": 17,
    "intent-meta": 0
  }
}
```

**Errors:** same `intent_not_found` / `intent_not_active` as § 4.1, plus `tracked_surface_empty` (200 with warning, not an error — caller may want to know).

### 4.3 `haiku_classify_drift` — submit classifications

Purpose: the agent's response to a `manual_change_assessment` action.

**Request:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `intent_slug` | string | yes | — |
| `tick_id` | string | yes | Must match the `tick_id` from the dispatched action. Stale tick IDs are rejected (the gate may have re-fired). |
| `classifications` | array of `Classification` | yes | One per dispatched finding, parallel-indexed to the original findings array. |
| `agent_rationale` | string | yes | The longer prose explanation. `>= 1` non-whitespace char. |
| `feedback_creates` | array of `FeedbackCreateInline` | conditional | Required if any classification has `outcome === "surface-as-feedback"` and `linked_feedback_id` is `null` — in that case, the tool atomically creates the feedback items and links them. If `linked_feedback_id` is already set, no inline creates are needed. |

**`FeedbackCreateInline` shape (mirrors existing `haiku_feedback` create):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `for_classification_path` | string | yes | The `path` of the classification this feedback links to. |
| `title` | string | yes | Same constraints as existing feedback `title`. |
| `body` | string | yes | Same constraints as existing feedback `body`. |
| `origin` | string | yes | Must be `"agent"` (agent is acting on its own classification, not a human reply). Other origins rejected. |
| `resolution` | string \| null | no | `"question"` \| `"inline_fix"` \| `"stage_revisit"` \| null. Defaults to `"stage_revisit"`. |

**Response (success):**

```json
{
  "ok": true,
  "assessment_id": "AS-07",
  "feedback_created": ["FB-12"],
  "pending_markers_created": 1,
  "baselines_updated": 0,
  "next_tick_will": "dispatch_review_fix_for_FB-12"
}
```

**Side-effect ordering (atomic — the tool either does all or rolls back):**

1. Write feedback files (if any in `feedback_creates`).
2. Resolve `linked_feedback_id` for any classifications that omitted it.
3. Validate every classification against `legal_outcomes` for the dispatched tick.
4. Write the `Assessment` record. For terminal outcomes (`ignore`, `inline-fix`), `Assessment.resulting_sha` is set to the current on-disk SHA-256 of the file. For non-terminal outcomes (`surface-as-feedback`, `trigger-revisit`), `Assessment.resulting_sha` is `null`. The `Assessment` record is **never** modified after this write.
5. For each terminal classification (`ignore`, `inline-fix`): update `Baseline` to the on-disk `(sha256, bytes, mtime_ns, is_binary)` with `author_class = "agent"`, `acknowledged_via = "classification-terminal"`.
6. For each non-terminal classification (`surface-as-feedback`, `trigger-revisit`): write a `PendingMarker` with `resolved_sha = null` and `cleared_at = null`. **Do not** update `Baseline`. The full baseline-update timing contract is in §3.6; the clearance mechanism is in §4.4.
7. Return.

**Errors:**

| `code` | When |
|---|---|
| `tick_id_stale` | The `tick_id` does not match the active drift dispatch. |
| `classifications_count_mismatch` | `classifications.length !== findings.length` for the dispatched tick. |
| `illegal_outcome` | A classification has an outcome not in `legal_outcomes[path]`. |
| `missing_link` | `surface-as-feedback` without `linked_feedback_id` and no matching `feedback_creates` entry. |
| `path_unknown` | A classification's `path` is not in the dispatched findings. |
| `revisit_target_invalid` | `linked_revisit_target_stage` is not at-or-before the active stage. |

### 4.4 `haiku_baseline_clear_marker` — internal lifecycle

Purpose: invoked by the workflow engine itself (not the agent) when a linked feedback reaches a **terminal state** (`closed` or `rejected`) or a revisit completes, clearing the pending marker and updating the baseline. Specified here for completeness; tool name and exposure (internal-only vs MCP-callable) are **DEFERRED-TO-DESIGN**.

| Field | Type | Required | Notes |
|---|---|---|---|
| `intent_slug` | string | yes | — |
| `path` | string | yes | The marker's `path`. |
| `trigger` | string | yes | Enum: `"feedback-closed"` \| `"feedback-rejected"` \| `"revisit-complete"`. |

> **Normative constraint:** `"feedback-addressed"` is **not** a valid trigger and does **not** clear a `PendingMarker`. The `addressed` status is a mid-state — addressed feedback can be reopened, so it does not provide the immutability guarantee required to safely update the baseline and lift re-detection suppression. Only terminal states (`closed`, `rejected`) and `revisit-complete` provide that guarantee. This aligns with unit-01 AC-G5 and AC-SF3.

**Side effects (atomic):**

1. Read the current on-disk SHA-256 for `path`.
2. Set `PendingMarker.cleared_at` to the current UTC timestamp and `PendingMarker.resolved_sha` to the on-disk SHA-256 in a single atomic write. These two fields are always set together and never updated after this point.
3. Update `Baseline` to the same SHA-256 value (plus current `bytes`, `mtime_ns`, `is_binary`), with `acknowledged_via = "classification-terminal"`.
4. Emit a `pending_marker_cleared` event (§ 6.3) that includes `resolved_sha` in its payload.

**The `Assessment` record is never modified by this tool.** `Assessment.resulting_sha` remains `null` for non-terminal outcomes; the post-clearance SHA is carried exclusively by `PendingMarker.resolved_sha` and the event payload.

**`(outcome, trigger)` legality matrix** — which trigger values are valid for each `PendingMarker.outcome`:

| `PendingMarker.outcome` | `"feedback-closed"` | `"feedback-rejected"` | `"revisit-complete"` |
|---|---|---|---|
| `surface-as-feedback` | OK | OK | rejected |
| `trigger-revisit` | rejected | rejected | OK |

A `trigger_outcome_mismatch` error is returned when the `trigger` value does not match the marker's `outcome` (e.g. calling with `trigger: "revisit-complete"` on a `surface-as-feedback` marker, or `trigger: "feedback-closed"` on a `trigger-revisit` marker). This prevents the baseline-update path from applying the wrong clearance semantics.

**Errors:**

| `code` | When |
|---|---|
| `no_open_marker` | No open `PendingMarker` exists for the given `path`. Returns `{ ok: true, marker_cleared: false }` rather than an error, since idempotent retry is safe. |
| `trigger_outcome_mismatch` | `trigger` does not match the open marker's `outcome` per the legality matrix above. |

Response: `{ ok: true, marker_cleared: true, baseline_updated: true, resolved_sha: "<sha>" }` or `{ ok: true, marker_cleared: false, reason: "no_open_marker" }`.

---

## 5. HTTP API (Browse SPA ↔ workflow engine)

The browse SPA is a separate process that talks to the workflow engine over HTTP. Three new endpoints support the upload affordances and drift assessment view.

> *Boundary: which process hosts these endpoints (current review-server vs a new MCP-app server) is decided in the integration-map sibling artifact. The endpoint shapes here are stable regardless of host.*

### 5.1 `POST /api/intents/{intent-slug}/uploads/stage-output`

Replace or attach a file in a stage's outputs directory.

**Authentication:** session cookie from the existing review-server auth flow (mirrors `/api/feedback` auth).

**Request (multipart/form-data):**

| Form field | Type | Required | Notes |
|---|---|---|---|
| `stage` | string | yes | Stage slug. |
| `target_path` | string | yes | Path **relative to the stage outputs directory** (e.g. `outputs/layout-v2.html`). The full intent-relative path is `stages/{stage}/{target_path}`. |
| `file` | file | yes | The uploaded content. Max 50 MB (configurable). |
| `mode` | string | yes | Enum: `"replace"` (target must exist) \| `"create"` (target must NOT exist) \| `"upsert"` (either). |
| `attribute_to_user` | string | yes | The authenticated user's display name; written to the audit log and to `Baseline.author_class` provenance. |

**Response (200):**

```json
{
  "ok": true,
  "path": "stages/design/outputs/layout-v2.html",
  "sha256": "ab12…",
  "bytes": 5104,
  "baseline_updated": true,
  "tick_will_observe": true
}
```

**Errors:**

| HTTP | `code` | When |
|---|---|---|
| 400 | `bad_target_path` | Target escapes the stage outputs dir. |
| 400 | `mode_violation` | `mode === "replace"` but file does not exist (or vice versa). |
| 403 | `stage_not_writable` | Stage's outputs are sealed (e.g. completed and merged). |
| 404 | `intent_not_found` | Slug unknown. |
| 413 | `payload_too_large` | File exceeds size cap. |
| 415 | `unsupported_mime` | MIME type rejected (rare; default-allow). |
| 423 | `intent_locked` | Intent in a state that disallows uploads. |
| 500 | `write_failed` | Disk or baseline write failed. |

### 5.2 `POST /api/intents/{intent-slug}/uploads/knowledge`

Add a knowledge file to the intent.

**Request (multipart/form-data):**

| Form field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | yes | — |
| `target_filename` | string | yes | Basename only — no path segments. Lands at `knowledge/{target_filename}` (intent-scope) or — if the SPA scopes by stage — at `stages/{stage}/knowledge/{target_filename}`. **DEFERRED-TO-DESIGN: which scope.** |
| `stage` | string \| null | conditional | Required if knowledge is per-stage; null for intent-scope. |
| `description` | string | no | Free-form note attached to the upload audit record. |
| `attribute_to_user` | string | yes | Same as § 5.1. |

**Response:** same shape as § 5.1.

**Errors:** same as § 5.1, plus:

| HTTP | `code` | When |
|---|---|---|
| 409 | `filename_collision` | `target_filename` already exists and `mode` is implicit-create. The SPA SHOULD prompt the user to disambiguate before retrying. |

### 5.3 `GET /api/intents/{intent-slug}/assessments`

List recent drift assessments for the SPA's drift assessment view.

**Query params:**

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `limit` | integer | no | 50 | Max 200. |
| `since` | string (RFC 3339) | no | — | Only assessments with `created_at > since`. |
| `stage` | string | no | — | Filter by `findings[*].stage`. |
| `outcome` | string | no | — | Filter by classification outcome. |

**Response (200):**

```json
{
  "ok": true,
  "assessments": [ /* Assessment objects, newest first */ ],
  "total": 3,
  "has_more": false
}
```

**Errors:** standard 400 (`bad_param`), 404 (`intent_not_found`).

### 5.4 `GET /api/intents/{intent-slug}/assessments/{assessment-id}`

Fetch a single assessment for the per-row drill-in.

**Response:** `{ ok: true, assessment: Assessment }`.

**Errors:** `assessment_not_found` (404).

---

## 6. Internal Workflow Events

The workflow engine emits these events for logging, the SPA's live-update channel (if/when websocket), and the existing telemetry stream. Events are append-only; no consumer mutates them.

### 6.1 `drift_detected`

Emitted by the drift-detection gate when one or more findings are produced on a tick.

**Topic / channel:** `workflow.events` (same channel as existing `feedback_triage_completed`, `unit_advanced`, etc.).

**Payload:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_type` | string | yes | Always `"drift_detected"`. |
| `event_at` | string (RFC 3339) | yes | UTC. |
| `intent_slug` | string | yes | — |
| `stage` | string | yes | — |
| `tick_id` | string | yes | — |
| `findings_count` | integer | yes | — |
| `findings_by_change_kind` | object | yes | `{ "new-file-detected": N, "modified": N, "file-removed": N }`. |
| `findings_by_tracking_class` | object | yes | `{ "stage-output": N, "knowledge": N, "unit-output": N, "intent-meta": N }`. |

**Producer:** the drift-detection gate in the pre-tick pipeline (workflow engine internal).

**Consumers:**

- The orchestrator (uses payload to construct the `manual_change_assessment` action).
- The telemetry / log sink (existing).
- Future: SPA live-update channel for real-time drift badges (out of scope for v1).

### 6.2 `assessment_recorded`

Emitted when the agent submits classifications via `haiku_classify_drift`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_type` | string | yes | Always `"assessment_recorded"`. |
| `event_at` | string (RFC 3339) | yes | — |
| `intent_slug` | string | yes | — |
| `assessment_id` | string | yes | `"AS-NN"`. |
| `outcomes_count` | object | yes | `{ "ignore": N, "inline-fix": N, "surface-as-feedback": N, "trigger-revisit": N }`. |
| `feedback_ids_created` | array of string | yes | `["FB-12", "FB-13", …]`. May be empty. |
| `baselines_updated` | integer | yes | Count of `Baseline` rows updated this submission. |
| `pending_markers_created` | integer | yes | Count of new `PendingMarker` rows. |
| `mode` | string | yes | Mirrors `Assessment.mode`. |

**Producer:** `haiku_classify_drift` MCP tool handler.

**Consumers:** orchestrator (decides next-tick action — fix loop, revisit, etc.); telemetry; SPA drift assessment view (polls `/api/intents/{slug}/assessments` after seeing this event).

### 6.3 `pending_marker_cleared`

Emitted when a non-terminal classification's downstream action resolves (feedback reaches a terminal state `closed` or `rejected`, or a revisit completes) and the marker is cleared + baseline updated.

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_type` | string | yes | Always `"pending_marker_cleared"`. |
| `event_at` | string (RFC 3339) | yes | — |
| `intent_slug` | string | yes | — |
| `path` | string | yes | The marker's `path`. |
| `assessment_id` | string | yes | The originating `Assessment.id`. |
| `trigger` | string | yes | Enum: `"feedback-closed"` \| `"feedback-rejected"` \| `"revisit-complete"`. |
| `linked_feedback_id` | string \| null | yes | — |
| `linked_revisit_target_stage` | string \| null | yes | — |
| `resolved_sha` | string | yes | The on-disk SHA-256 of the file at clearance time. Mirrors `PendingMarker.resolved_sha`. This is the canonical post-resolution SHA for non-terminal-outcome assessments; `Assessment.resulting_sha` remains `null`. |

> **Normative constraint:** This event is never emitted on `feedback-addressed`. The `addressed` status is a mid-state that does not guarantee finality. Only `feedback-closed`, `feedback-rejected`, and `revisit-complete` produce this event. See §4.4 for rationale.

**Producer:** `haiku_baseline_clear_marker` (the workflow engine's internal lifecycle handler).

**Consumers:** orchestrator (updates downstream tick state); telemetry; SPA (refreshes the corresponding assessment row's "status" pill from `pending` to `resolved`).

---

## 7. Cross-Surface Naming Audit

Quick consistency check that the same entity appears identically wherever it crosses a boundary:

| Entity | On disk (§ 2) | In action payload (§ 3) | In MCP tool (§ 4) | In HTTP API (§ 5) | In events (§ 6) |
|---|---|---|---|---|---|
| Intent identifier | `intent_slug` | `intent_slug` | `intent_slug` | `{intent-slug}` (URL) / `intent_slug` (body) | `intent_slug` |
| Tracked file path | `path` | `path` | `path` | `path` (response) / `target_path` (request — distinct intentionally because requests are stage-scoped) | `path` |
| Drift outcome | `outcome` | `outcome` | `outcome` | n/a | n/a |
| Assessment ID | `id` | n/a | `assessment_id` (response) | `{assessment-id}` (URL) | `assessment_id` |
| Feedback ID | n/a (links via `linked_feedback_id`) | `linked_feedback_id` | `linked_feedback_id` / `feedback_created` | n/a | `linked_feedback_id` / `feedback_ids_created` |
| Stage | `stage` | `stage` | n/a (implicit in `path`) | `stage` (form / query) | `stage` |
| Tick identifier | n/a (only in `Assessment`) | `tick_id` | `tick_id` | n/a | `tick_id` |
| Post-clearance SHA | `PendingMarker.resolved_sha` | n/a | `resolved_sha` (§ 4.4 response) | n/a | `resolved_sha` (§ 6.3 event) |

The intentional asymmetry — HTTP request bodies use `target_path` (stage-relative) where the rest of the system uses `path` (intent-relative) — is the only naming variance, and it is documented inline in § 5.1 with the conversion rule (`path = "stages/" + stage + "/" + target_path`).

---

## Appendix A — outputs/features/ catalog

Appendix A — outputs/features/ catalog. The 8 .feature files at `stages/product/outputs/features/` are supplementary contract-verification scenarios that exercise the schemas, action payloads, MCP tools, HTTP API, and internal events defined in this document. They are NOT canonical user-behavior features — those live at the intent root in `features/` and are bound by the development stage's step-definition layer. The contract-verification scenarios in `outputs/features/` are bound separately by the contract-test layer.

| File | DATA-CONTRACTS.md Section(s) | Verifies |
|---|---|---|
| `assessment_schema.feature` | §2.3 Assessment | Assessment record schema, append-only invariant, per-outcome resulting_sha semantics |
| `pending_marker_schema.feature` | §2.2 PendingMarker | PendingMarker schema, resolved_sha lifecycle, terminal-only clearance trigger |
| `baseline_schema.feature` | §2.1 Baseline | Baseline record schema (path, sha, author_class) |
| `drift_finding_and_action.feature` | §3.1, §3.2 | DriftFinding shape, manual_change_assessment action payload |
| `internal_events.feature` | §6 | drift_detected, assessment_recorded, pending_marker_cleared event payloads |
| `mcp_tools.feature` | §4 | haiku_human_write, haiku_baseline_init, haiku_classify_drift, haiku_baseline_clear_marker contracts |
| `http_api.feature` | §5 | POST /uploads/stage-output, POST /uploads/knowledge, GET /assessments[/{id}] |
| `cross_surface_naming.feature` | §7 | Cross-surface naming audit (entity names match across disk/action/MCP/HTTP/events) |

---

## 8. Boundary Notes (deferred to siblings)

These contracts are written to be implementable, but the following choices are owned by sibling discovery artifacts and should be confirmed at design time:

- **Tracked-surface boundary** — which directories the gate scans by `tracking_class`. Owned by USER-STORIES / INTEGRATION-MAP.
- **Baseline storage location** — colocated JSON, separate file, or SQLite. Owned by INTEGRATION-MAP.
- **Pending-marker storage location** — same question, separate row. Owned by INTEGRATION-MAP.
- **Tick ID format** — UUID, monotonic counter, or `(intent, seq)` tuple. Owned by INTEGRATION-MAP.
- **Diff size cap for `new-file-detected`** — the threshold above which `diff_unified` is null and the agent must reach for the file. Owned by USER-STORIES (UX impact on the agent's classification quality).
- **SPA upload host process** — current review-server vs a new MCP-app server. Owned by INTEGRATION-MAP.
- **Knowledge upload scope** — intent-scope or per-stage. Owned by USER-STORIES.
- **Human-write tool security stance** — trust + audit vs explicit confirmation. Owned by DESIGN-DECISIONS Decision 9; contract here assumes trust + audit (no `confirm` argument), but a follow-up addendum can add a `requires_confirmation: boolean` request field without breaking shape.

None of these affect the field-level shapes above. They affect *where* the data lives, not *what* it looks like.

---

## 9. Annex: Co-Located Subsystem with Independent Data Shapes

A separate subsystem — **upstream-artifact reconciliation** — exists on this intent's branch (entered via the 2026-05-01 main-merge from repo PR #283 "feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged 2026-04-30). It has its own data shapes that are **not** specified in this contract:

- **`corpus_fingerprint`** — SHA-256 hex digest persisted in per-stage `state.json`, computed over (sorted relPath, file content sha) pairs across the upstream-artifact corpus (`stages/<prior>/artifacts/`, `stages/<prior>/discovery/`, `stages/<prior>/outputs/`, `<intent>/knowledge/`, `<intent>/product/`, `<intent>/features/`).
- **`ReconciliationFinding`** — finding shape with discriminator `kind: "tool_name" | "http_status" | "field_name"`, plus `concept`, `occurrences[]` (with `name`, `file`, `line`, `excerpt`), and `message`. Defined in `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts`.
- **`upstream_reconciliation_required` action payload** — the agent-facing payload for the reconciliation gate's findings. Wire shape lives in `run-tick.ts` lines 428-472.
- **`haiku_reconciliation_acknowledge` MCP tool input/output** — the proceed-without-fix tool's contract; defined alongside the implementation, not here.

These shapes are **out of scope** for this product-stage data contracts deliverable because the reconciliation subsystem was not derived from this intent's product elaboration. The shapes that ARE in scope (sections 1-7 above) cover only baseline.json, drift-markers.json, write-audit.jsonl, drift-assessments/DA-NN.json, the `manual_change_assessment` payload, and the `haiku_human_write` MCP tool input/output. The author-class enumeration in §6.1 (`agent | human-via-mcp | human-implicit`) is about WRITE attribution, not about reconciliation findings.

A future intent that takes ownership of upstream-reconciliation should author its own DATA-CONTRACTS.md formalizing the four shapes above and any corresponding telemetry-event shapes.

**Cross-references:** See `knowledge/DISCOVERY.md` § "Annexed Subsystem", `knowledge/IMPLEMENTATION-MAP.md` § "Annex: Out-of-Scope Subsystem".
