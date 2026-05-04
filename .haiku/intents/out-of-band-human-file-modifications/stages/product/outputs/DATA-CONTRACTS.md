# Data Contracts — Out-of-band Human File Modifications

*Product-stage canonical source. This document supersedes the discovery-phase draft at
`.haiku/intents/out-of-band-human-file-modifications/knowledge/DATA-CONTRACTS.md`. When this
unit completes, every downstream stage (development, operations, security) reads from here.
All enum values, field names, and naming conventions in this document are normative —
deviations in code or documentation are reconciliation failures.*

---

## 0. Canonical Enum Pinning (normative)

Three enums are defined once here and referenced from every schema, action payload, MCP tool
contract, HTTP API, and event below. Any document that uses a different spelling for these
values is out of sync and must be updated before development begins.

### 0.1 `change_kind` enum

```
"added" | "modified" | "deleted"
```

*All lowercase. Three values exactly. No aliases.*

| Value | Meaning |
|---|---|
| `added` | File is present on disk but has no prior baseline entry |
| `modified` | File exists in the baseline and on disk; SHAs differ |
| `deleted` | File exists in the baseline but is absent on disk |

**Deprecated / forbidden aliases:** `created`, `updated`, `removed`, `replace`. If any prior document
(including `ARCHITECTURE.md` event-shape sketches, Gherkin `.feature` files, or the discovery draft
`DATA-CONTRACTS.md`) uses those aliases, they are reconciliation failures. The canonical values above
apply everywhere.

### 0.2 `author_class` enum

```
"agent" | "human-via-mcp" | "human-implicit"
```

*All lowercase with hyphens. Three values exactly. No aliases.*

| Value | Meaning |
|---|---|
| `agent` | File was written by the agent through its normal MCP tool pipeline |
| `human-via-mcp` | File was written through a sanctioned human-attributed channel (the `haiku_human_write` tool or the SPA upload endpoint) |
| `human-implicit` | SHA diverged with no intervening agent or tool stamp — inferred as an out-of-band filesystem write |

**Deprecated / forbidden aliases:** `user`, `external`, `manual`. The `Baseline` schema requires
`author_class` as a required, enum-typed field. See §2.1.

### 0.3 `outcome` enum

```
"ignore" | "inline-fix" | "surface-as-feedback" | "trigger-revisit"
```

*All lowercase with hyphens. Four values exactly. No aliases.*

| Value | Meaning |
|---|---|
| `ignore` | Change is not workflow-significant; baseline updated immediately |
| `inline-fix` | Human improvement to fold into the next bolt; baseline updated immediately |
| `surface-as-feedback` | Concern or regression; feedback item created; pending marker written; baseline deferred |
| `trigger-revisit` | Fundamental redirect; `haiku_revisit` invoked; pending marker written; baseline deferred |

**Deprecated / forbidden aliases:** `auto-fix`, `escalate`. The `Classification` and `Assessment`
schemas use this enum's values verbatim for the `outcome` field. The `manual_change_assessment`
action's `legal_outcomes` map uses these values as the allowed-outcome lists.

---

## 1. Naming Conventions

Entity names are pinned identically across all five surfaces: disk, action payloads, MCP tools,
HTTP API, and events. The table below is the single authoritative naming reference.

| Concept | Snake_case (disk, JSON) | PascalCase (TS interface) | Kebab-case (URLs) |
|---|---|---|---|
| Last-acknowledged content hash for a tracked file | `baseline` / `baseline_entry` | `Baseline` | `baselines` |
| A file being monitored by the drift-detection gate | `tracked_file` | `TrackedFile` | `tracked-files` |
| A detected divergence between baseline and on-disk state | `drift_finding` | `DriftFinding` | `drift-findings` |
| An agent-authored classification of a drift finding | `assessment` | `Assessment` | `assessments` |
| The four legal classification outcomes (§0.3) | `classification` (enum discriminant) | — | — |
| An open, unresolved non-terminal classification record | `pending_marker` | `PendingMarker` | `pending-markers` |
| A pending-write origin record bridging a sanctioned-channel write to the next drift gate | `pending_origin_stamp` | `PendingOriginStamp` | `pending-origin-stamps` |

**Cross-surface naming audit:** See §7 for the proof table that every entity uses the same name
across all five surfaces.

---

## 2. Persistent State Schemas

Three new schemas persist to disk as part of the intent's state. The exact storage mechanism
(location, file format, encoding) is a development-stage decision. The field-level shapes are
normative and storage-agnostic.

### 2.1 `Baseline` — one entry per tracked file

The baseline is a map from tracked-file-path to a record with the following fields:

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `path` | string | yes | — | POSIX path relative to the intent directory root (`.haiku/intents/{slug}/`). No leading slash. No `..` segments. Unique per intent. |
| `sha256` | string | yes | — | Lowercase hex SHA-256 digest of the file's full byte content at last acknowledgment. Exactly 64 characters. |
| `bytes` | integer | yes | — | File size in bytes at acknowledgment. Used as a pre-check skip hint before re-hashing; `sha256` is authoritative. |
| `mtime_ns` | integer | yes | — | File mtime in nanoseconds since epoch at acknowledgment. Hashing skip-hint only; `sha256` is authoritative. |
| `is_binary` | boolean | yes | `false` | True when the file fails the text heuristic (null bytes in first 8 KiB or extension in the binary list). Drives diff-payload behavior. |
| `author_class` | `"agent" \| "human-via-mcp" \| "human-implicit"` | yes | — | **Required enum field per reconciliation requirement R2.** The enum from §0.2. Records who/what last caused the workflow engine to acknowledge this baseline entry. Sourced from the upstream `DriftFinding.author_class` (§3.1) when an assessment-driven baseline update happens, or from `acknowledged_via` for direct baseline writes (`baseline-init`, `classification-terminal`). The §3.1.1 algorithm — `PendingOriginStamp` (§2.4) lookup with a fallback to `"human-implicit"` — is the single resolution path; the baseline never holds a value the gate could not have produced. |
| `acknowledged_at` | string (RFC 3339) | yes | — | UTC ISO-8601 timestamp with `Z` suffix. Example: `"2026-04-28T14:32:00Z"`. |
| `acknowledged_via` | `"agent-write" \| "human-write-tool" \| "spa-upload" \| "classification-terminal" \| "baseline-init"` | yes | — | The channel through which the baseline was last written. Distinct from `author_class`: `author_class` records *who* authored; `acknowledged_via` records *how* the write reached the workflow engine. |
| `stage` | string \| null | yes | — | Owning stage slug (e.g. `"product"`, `"design"`). `null` for intent-scope files. |
| `tracking_class` | `"stage-output" \| "knowledge" \| "unit-output" \| "intent-meta"` | yes | — | The category driving which directories are scanned and which UI affordances apply. |

**Note on `stage-output` vs `artifacts/`:** The tracked surface uses `stages/{stage}/artifacts/**`
as the canonical output directory name. `stages/{stage}/outputs/**` is a deprecated alias; the
canonical term used in code and in baseline keys is `artifacts`. See §2.1.1 for the full boundary
note.

#### 2.1.1 Tracked-Surface Boundary Note (normative)

The tracked surface for stage output artifacts uses `stages/{stage}/artifacts/**` as the canonical
path. `stages/{stage}/outputs/**` is a deprecated alias kept for backward compatibility with
documents that predate the TRACKED-SURFACE-BOUNDARY.md decision. In code: the canonical directory
name is **`artifacts/`**. A reference to `outputs/` in any schema, tool contract, or test fixture
should be treated as pointing to `artifacts/`. No separate `outputs/` directory is created at
runtime; both path patterns resolve to the same canonical location. The `tracking_class` value for
files under this path is `"stage-output"` in both the canonical and alias forms.

**Worked example — `Baseline` entry:**

```json
{
  "path": "stages/product/artifacts/DATA-CONTRACTS.md",
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "bytes": 14821,
  "mtime_ns": 1714312320123456789,
  "is_binary": false,
  "author_class": "agent",
  "acknowledged_at": "2026-04-28T14:32:00Z",
  "acknowledged_via": "agent-write",
  "stage": "product",
  "tracking_class": "stage-output"
}
```

**Storage reference (normative):** `Baseline` entries are partitioned by the entry's `stage` field:

- **Stage-scoped entries** (`stage` is a stage slug, e.g. `"product"`) live in
  `.haiku/intents/{slug}/stages/{stage}/baseline.json`. One file per stage. Cross-stage entries
  (a design artifact modified while development is active) are stored in the baseline file of the
  stage that originally produced the file (i.e. the stage recorded in the `stage` field).
- **Intent-scope entries** (`stage === null`) live in a single intent-scoped sidecar at
  `.haiku/intents/{slug}/baseline.json`. This file holds every baseline entry whose `stage` field
  is null — `tracking_class === "knowledge"` files (`knowledge/**`) and
  `tracking_class === "intent-meta"` files (`intent.md`, `intent-state.json`, etc.) live here.
  No `tracking_class` value other than `"knowledge"` or `"intent-meta"` is permitted to have
  `stage === null`; this is enforced at write time (see "Cross-field invariants" below).

**Path → stage derivation (normative).** Given a `Baseline.path`, the owning storage file is
derived deterministically by inspecting the path prefix; the rule is the same one the drift gate
and `haiku_baseline_clear_marker` (§4.4) use to locate the entry without an explicit `stage`
input:

| Path prefix | `tracking_class` | `stage` | Storage file |
|---|---|---|---|
| `stages/{stage}/artifacts/**` (alias: `stages/{stage}/outputs/**`) | `stage-output` | `{stage}` | `.haiku/intents/{slug}/stages/{stage}/baseline.json` |
| `stages/{stage}/units/{unit-slug}/**` | `unit-output` | `{stage}` | `.haiku/intents/{slug}/stages/{stage}/baseline.json` |
| `knowledge/**` | `knowledge` | `null` | `.haiku/intents/{slug}/baseline.json` |
| `intent.md`, `intent-state.json`, `feedback/**` (root-level intent metadata) | `intent-meta` | `null` | `.haiku/intents/{slug}/baseline.json` |

The `{stage}` capture group from a `stages/{stage}/**` path MUST match a known stage slug for the
intent's studio; a path that begins with `stages/` but whose first path segment after `stages/` is
not a known stage slug is rejected at write time with `error: "path_not_in_tracked_surface"`.

**Cross-field invariants (enforced at write time):**

1. `tracking_class === "stage-output" || tracking_class === "unit-output"` ⇒ `stage` MUST be
   non-null AND `path` MUST begin with `stages/{stage}/` where `{stage}` matches the `stage` field.
2. `tracking_class === "knowledge"` ⇒ `stage === null` AND `path` MUST begin with `knowledge/`.
3. `tracking_class === "intent-meta"` ⇒ `stage === null` AND `path` MUST NOT begin with
   `stages/` or `knowledge/`.

**Logical indexes:** primary `(intent_slug, path)`; secondary `(intent_slug, stage)` for per-stage
scans (treats `stage === null` as a distinct index value for intent-scope entries); secondary
`(intent_slug, tracking_class)` for SPA filters.

---

### 2.2 `PendingMarker` — one record per open non-terminal classification

Created when `haiku_classify_drift` records a classification with outcome `surface-as-feedback` or
`trigger-revisit`. Cleared when the linked downstream action resolves.

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `path` | string | yes | — | Same shape as `Baseline.path`. Logical foreign key to the `Baseline` entry for this file. |
| `created_at` | string (RFC 3339) | yes | — | UTC timestamp when the marker was written. |
| `created_by_assessment_id` | string | yes | — | The `Assessment.id` (e.g. `"AS-07"`) that created this marker. |
| `outcome` | `"surface-as-feedback" \| "trigger-revisit"` | yes | — | The non-terminal outcome that produced this marker. Must be one of the two non-terminal values from §0.3. |
| `linked_feedback_id` | string \| null | yes | — | `"FB-NN"` of the feedback item this marker is waiting on, or `null` if `outcome === "trigger-revisit"`. Exactly one of `linked_feedback_id` / `linked_revisit_target_stage` is non-null (mutual exclusion enforced at write time). |
| `linked_revisit_target_stage` | string \| null | yes | — | Stage slug of the revisit target, or `null` if `outcome === "surface-as-feedback"`. |
| `cleared_at` | string (RFC 3339) \| null | yes | `null` | Set when the downstream action resolves; once non-null the marker is logically resolved. |

**Constraints:**
- `(intent_slug, path)` is **not** unique — multiple markers may queue on the same file across
  separate assessments. The drift gate's "skip if pending" check is: *any row with this `path` and
  `cleared_at IS NULL`*.
- The newest open marker (max `created_at` with `cleared_at IS NULL`) is the suppressing one.

**Storage reference:** Intent-scoped sidecar at `.haiku/intents/{slug}/drift-markers.json`. Not
stage-scoped, because cross-stage markers may be open while a later stage is active.

**Topology reconciliation with `Baseline`:** `PendingMarker` is intent-scoped and `Baseline`
entries are partitioned by `stage` (per-stage files for stage-scoped entries, one intent-scope
sidecar for `stage === null` entries — see §2.1). The two stores are reconciled by `path`: every
`PendingMarker.path` is also a `Baseline.path`, and the §2.1 **Path → stage derivation** rule
is the single normative source for resolving a `path` to its owning baseline file. No tool, gate,
or SPA query parses path prefixes outside that rule. `haiku_baseline_clear_marker` (§4.4) and
the pre-tick drift gate both apply this rule to locate the `Baseline` entry without an explicit
`stage` input.

**Worked example:**

```json
{
  "path": "stages/design/artifacts/hero-layout.html",
  "created_at": "2026-04-28T14:35:12Z",
  "created_by_assessment_id": "AS-07",
  "outcome": "surface-as-feedback",
  "linked_feedback_id": "FB-12",
  "linked_revisit_target_stage": null,
  "cleared_at": null
}
```

---

### 2.3 `Assessment` — one record per classification dispatch

Append-only. The durable record of what changed, what the agent decided, and why. Written by
`haiku_classify_drift` on every `manual_change_assessment` dispatch.

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `id` | string | yes | — | `"AS-NN"`, two-digit zero-padded sequential per intent. Mirrors the `FB-NN` / `unit-NN-*` ID conventions used elsewhere. |
| `created_at` | string (RFC 3339) | yes | — | UTC timestamp. |
| `tick_id` | string | yes | — | Identifier of the `haiku_run_next` tick that produced this assessment. Format is a development-stage decision (tick UUID or `(intent_slug, tick_seq)` tuple). |
| `findings` | array of `DriftFinding` | yes | — | The full set of findings the agent classified in this dispatch. At least one element. |
| `classifications` | array of `Classification` | yes | — | One classification per finding, parallel-indexed (`classifications[i]` corresponds to `findings[i]`). Length must equal `findings.length`. |
| `agent_rationale` | string | yes | — | The agent's prose explanation of why it classified each finding the way it did. At least one non-whitespace character. Surfaced in the SPA drift assessment view. |
| `initiated_by` | string | yes | — | **Required per reconciliation requirement R8 (DEC-9 audit fields).** Agent identity string — the agent or session that submitted the classification. |
| `triggering_request` | string | yes | — | **Required per R8.** Verbatim chat snippet (first 200 chars) or session ID that triggered this assessment dispatch. Provides post-hoc auditability of why the assessment fired. |
| `target_path` | string | yes | — | **Required per R8.** The primary file path targeted by this assessment. For multi-finding assessments, this is the first finding's path; the full list is in `findings`. |
| `resulting_sha` | string \| null | yes | — | **Required per R8 (the field is required; the value is nullable).** The on-disk SHA of `target_path` at the moment the `Assessment` record was written. For terminal outcomes (`ignore`, `inline-fix`), this is the post-classification SHA — the value the `Baseline` was simultaneously updated to in step 5 of §4.3, so the two records agree. For non-terminal outcomes (`surface-as-feedback`, `trigger-revisit`), this is `null`: the file's resolved SHA is not known at write time, the `Baseline` update is deferred to marker clearance (§4.4), and the `Assessment` record is append-only and never modified after writing (per the §2.3 storage reference). The resolved end-state SHA for non-terminal assessments is recovered by joining `Assessment.id` → `PendingMarker.created_by_assessment_id` → (after clearance) `Baseline.sha256` for `target_path`; do not infer it from the `Assessment` record alone. |
| `recorded_at` | string (RFC 3339) | yes | — | **Required per R8.** UTC timestamp when the assessment record was committed to disk. May differ from `created_at` by network or I/O latency. |
| `mode` | `"interactive" \| "pickup" \| "autopilot" \| "hybrid"` | yes | — | The invocation mode captured at assessment time. Enables the SPA to render mode-aware context. |
| `confirmed_by_user` | boolean | yes | `false` | True only when the user explicitly confirmed the agent's classification in interactive mode. False in autopilot. False when the user has not acted on a surfaced classification. |
| `revisit_invoked_at` | string (RFC 3339) \| null | yes | `null` | **Required per reconciliation requirement R7.** Set to the UTC timestamp when `haiku_revisit` is called by the workflow engine on the next tick. `null` until that call happens. Drives the SPA's `pending-revisit` vs. `revisit-invoked` UI state distinction. |

**`pending-revisit` vs. `revisit-invoked` state transition (R7):**

The SPA's `pending-revisit` UI state corresponds to an `Assessment` whose
`outcome === "trigger-revisit"` and whose `revisit_invoked_at IS NULL`. The state transitions
to `revisit-invoked` once the next tick calls `haiku_revisit` and writes a non-null timestamp
into `revisit_invoked_at`. This two-step transition is the only mechanism by which the SPA
distinguishes "the agent decided to revisit" from "the revisit actually started."

**Storage reference:** `stages/{stage}/drift-assessments/DA-{NN}.json` inside the intent directory.
One file per assessment dispatch. Append-only; records are never modified after writing. The `NN`
counter increments per assessment within a stage. Cross-stage findings include the `stage_owner`
field from the `DriftFinding` so the SPA can display correct stage attribution.

**Worked example:**

```json
{
  "id": "AS-07",
  "created_at": "2026-04-28T14:35:12Z",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "initiated_by": "haiku-agent-session-abc123",
  "triggering_request": "User uploaded a new hero layout via SPA Replace dialog",
  "target_path": "stages/design/artifacts/hero-layout.html",
  "resulting_sha": null,
  "recorded_at": "2026-04-28T14:35:14Z",
  "findings": [
    {
      "path": "stages/design/artifacts/hero-layout.html",
      "change_kind": "modified",
      "is_binary": false,
      "diff_unified": "@@ -12,3 +12,5 @@\n ...",
      "before_sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "after_sha256": "ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890",
      "before_bytes": 4821,
      "after_bytes": 5104,
      "tracking_class": "stage-output",
      "stage": "design",
      "context_unit": null
    }
  ],
  "classifications": [
    {
      "path": "stages/design/artifacts/hero-layout.html",
      "outcome": "surface-as-feedback",
      "rationale_excerpt": "Designer replaced nav pattern not in spec — needs unit revision.",
      "linked_feedback_id": "FB-12",
      "linked_revisit_target_stage": null
    }
  ],
  "agent_rationale": "The diff replaces the navigation block with a sidebar variant not specified in the design unit. Surfacing as feedback so the design lead can confirm before we re-elaborate.",
  "mode": "autopilot",
  "confirmed_by_user": false,
  "revisit_invoked_at": null
}
```

---

### 2.4 `PendingOriginStamp` — one record per pending sanctioned-channel write

The bridge record that lets the next-tick drift-detection gate populate
`DriftFinding.author_class` with `"human-via-mcp"` instead of falling back to `"human-implicit"`.
Without this record, the gate sees only on-disk SHA divergence and cannot tell which channel
authored the file. The `write-audit.jsonl` log (§4.1) is append-only and outside the gate's read
scope (matched by the `**/write-audit.jsonl` deny entry in §4.1.2 and not part of the gate's
defined data inputs); the `PendingOriginStamp` is the gate's authoritative origin signal.

**Producers:**
- `haiku_human_write` writes one stamp per successful invocation (atomically with the file write).
- The SPA upload endpoints (`POST /api/intents/{slug}/uploads/stage-output` and
  `POST /api/intents/{slug}/uploads/knowledge`) write one stamp per successful upload (atomically
  with the file write).

**Consumer:** The pre-tick drift-detection gate. For every divergent file, the gate looks up an
open stamp by `(intent_slug, path)`; on a hit, it sets `DriftFinding.author_class` to the stamp's
`author_class` and atomically clears the stamp. On a miss, the gate emits the finding with
`author_class: "human-implicit"`.

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `path` | string | yes | — | Same shape as `Baseline.path`. The canonical (post-§4.1.1-normalization) intent-relative POSIX path. Logical key together with `intent_slug`. |
| `author_class` | `"human-via-mcp"` | yes | — | The §0.2 enum, restricted to `"human-via-mcp"` for stamps. (Agent writes do not produce stamps; the gate's default for an unstamped, unbaselined divergence is `"human-implicit"`.) Future channels that want first-class attribution must also write a stamp; this field reserves room for that without changing the gate. |
| `expected_sha256` | string | yes | — | Lowercase hex SHA-256 of the file content as written by the producer. The gate matches this against the on-disk SHA when consuming the stamp; a mismatch (the file was overwritten between write and tick) downgrades the finding to `"human-implicit"` and the stamp is still cleared. Exactly 64 characters. |
| `created_at` | string (RFC 3339) | yes | — | UTC timestamp. Stamps older than the kill-switch sweep window (a development-stage decision) are GC'd as stale by the gate even if no matching divergence is found. |
| `created_by` | `"haiku_human_write" \| "spa-upload-stage-output" \| "spa-upload-knowledge"` | yes | — | Which producer wrote the stamp. Used in telemetry; does NOT change `author_class` (all three are `"human-via-mcp"`). |
| `human_author_id` | string \| null | yes | — | Mirrors the `human_author_id` recorded in the audit log (§4.1). `null` if not supplied by the producer. Carried so the `Assessment` record can attribute without re-reading `write-audit.jsonl`. |
| `audit_log_entry_id` | string | yes | — | The `entry_id` of the matching `write-audit.jsonl` record (§4.1). Lets auditors join the stamp to its append-only audit-log row without granting the gate read access to the JSONL file itself. |

**Constraints:**
- `(intent_slug, path)` is **not** unique across the lifetime of the file: a stamp is written, consumed,
  and a new stamp may be written later. At any moment there must be at most one open stamp per
  `(intent_slug, path)` — a producer that finds an existing open stamp for the same path overwrites
  it (last-write-wins; the audit log retains the prior entry).
- The stamp is consumed (deleted) atomically with the gate's `DriftFinding` emission. A crash
  between emission and deletion is recovered by the gate's idempotent re-scan: a divergence with
  no remaining stamp is `"human-implicit"`. This is acceptable because the audit log preserves
  the original attribution if a forensic join is needed.
- Stale stamps (older than the GC window AND no matching divergence on disk) are deleted on the
  next tick without emitting a `DriftFinding`.

**Storage reference:** Intent-scoped sidecar at `.haiku/intents/{slug}/pending-origin-stamps.json`.
Not stage-scoped, because writes via `haiku_human_write` and SPA uploads target paths under any
stage (and intent-scope `knowledge/` paths). The exact on-disk format (single JSON file vs. one
file per stamp) is a development-stage decision; the field-level shape is normative.

**Deny-list entry:** `**/pending-origin-stamps.json` is added to §4.1.2 — workflow-engine-only,
mutated exclusively by `haiku_human_write`, the SPA upload endpoints, and the drift-detection
gate.

**Worked example:**

```json
{
  "path": "knowledge/brand-guide.md",
  "author_class": "human-via-mcp",
  "expected_sha256": "a3f7c82e1d4b9f0517e6c2a84b3d5e9f1c7a2b4d6e8f0a2c4e6b8d0f2a4c6e8f",
  "created_at": "2026-04-28T15:42:07Z",
  "created_by": "haiku_human_write",
  "human_author_id": "jwaldrip@gigsmart.com",
  "audit_log_entry_id": "HWM-42-01"
}
```

**Cross-references that must agree with this schema:**
- §2.1 `Baseline.author_class` — populated from `DriftFinding.author_class` when the gate-emitted
  finding is acknowledged into the baseline; the stamp is the upstream origin of `"human-via-mcp"`.
- §3.1 `DriftFinding.author_class` — sourced from the matching `PendingOriginStamp` if present;
  otherwise `"human-implicit"`.
- §4.1 `haiku_human_write` — writes the stamp atomically with the file write (request envelope
  is unchanged; the stamp is an internal side-effect).
- §4.1.2 deny-list — adds `**/pending-origin-stamps.json`.
- §5.1 / §5.2 SPA upload endpoints — write the stamp atomically with the file write (same
  contract as `haiku_human_write`).
- §6.1 `drift_detected` — `author_class` field is populated from the stamp (or `"human-implicit"`
  fallback).

---

## 3. Workflow-Action Payload Schemas

### 3.1 `DriftFinding` — emitted by the pre-tick drift-detection gate

This is the per-file payload the gate produces. It is embedded in the
`manual_change_assessment` action (§3.2) and in the `Assessment` record (§2.3).

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `path` | string | yes | — | Same POSIX-relative shape as `Baseline.path`. |
| `change_kind` | `"added" \| "modified" \| "deleted"` | yes | — | **Canonical enum from §0.1.** No aliases. |
| `is_binary` | boolean | yes | — | True if either the prior baseline was binary or the current file fails the text heuristic. |
| `diff_unified` | string \| null | yes | — | Standard unified diff (3 lines context) for text files. `null` when `is_binary === true`, when `change_kind === "deleted"` and content is unavailable, or when `change_kind === "added"` and file exceeds the large-file threshold (a development-stage decision). For new text files under the threshold, carries the full content as a `+++`-only diff. |
| `before_sha256` | string \| null | yes | — | Baseline SHA. `null` when `change_kind === "added"`. |
| `after_sha256` | string \| null | yes | — | On-disk SHA. `null` when `change_kind === "deleted"`. |
| `before_bytes` | integer \| null | yes | — | Baseline file size. `null` for `"added"`. |
| `after_bytes` | integer \| null | yes | — | On-disk file size. `null` for `"deleted"`. |
| `tracking_class` | `"stage-output" \| "knowledge" \| "unit-output" \| "intent-meta"` | yes | — | Mirrors `Baseline.tracking_class`. |
| `stage` | string \| null | yes | — | Mirrors `Baseline.stage`. |
| `context_unit` | string \| null | yes | — | Unit slug if the file lives under `units/{unit-slug}/`; `null` otherwise. Provides classification context. |
| `author_class` | `"agent" \| "human-via-mcp" \| "human-implicit"` | yes | — | **Canonical enum from §0.2.** Populated by the gate using the algorithm in §3.1.1 (stamp lookup against `PendingOriginStamp` §2.4, falling back to `"human-implicit"`). Carries through to `Baseline.author_class` (§2.1) and `drift_detected.author_class` (§6.1). |

**Cross-field invariants (enforced by the gate before dispatch):**

1. `change_kind === "added"` ⇒ `before_sha256 === null && before_bytes === null`.
2. `change_kind === "deleted"` ⇒ `after_sha256 === null && after_bytes === null && diff_unified === null`.
3. `change_kind === "modified"` ⇒ all four SHA/byte fields non-null AND `before_sha256 !== after_sha256`.
4. `is_binary === true` ⇒ `diff_unified === null`.
5. `author_class === "human-via-mcp"` ⇒ a `PendingOriginStamp` (§2.4) was matched and consumed for `(intent_slug, path)` in this same gate pass. The gate MUST NOT emit `"human-via-mcp"` without a matching stamp.
6. `author_class === "human-implicit"` ⇒ no matching `PendingOriginStamp` was found (or the stamp's `expected_sha256` did not match `after_sha256`). This is the default for unsanctioned filesystem drops.
7. `author_class === "agent"` ⇒ the gate observed an agent-tool write (recorded in the workflow engine's tool-call log) for this path since the last baseline acknowledgment. Out of scope for the human-write flow but listed for completeness; the gate's stamp lookup is bypassed when an agent-tool write is recorded.

#### 3.1.1 `author_class` resolution algorithm (normative)

For every divergent file the gate finds, it sets `DriftFinding.author_class` exactly once, before
dispatching the `manual_change_assessment` action, using this algorithm:

1. If the workflow engine's tool-call log recorded an agent-tool write to `path` since the last
   baseline acknowledgment, set `author_class = "agent"`. Skip steps 2–4.
2. Otherwise, look up an open `PendingOriginStamp` (§2.4) by `(intent_slug, path)`.
3. If a stamp is found AND `stamp.expected_sha256 === after_sha256`, set
   `author_class = stamp.author_class` (currently always `"human-via-mcp"`). Atomically delete
   the stamp.
4. If no stamp is found, OR the stamp's `expected_sha256` does not match the on-disk SHA, set
   `author_class = "human-implicit"`. If a non-matching stamp existed, delete it (it is stale).

The deletion in steps 3 and 4 happens in the same atomic batch as the gate's `DriftFinding`
emission and `drift_detected` event publication. Crash recovery is described in §2.4.

**Worked example:**

```json
{
  "path": "stages/design/artifacts/hero-layout.html",
  "change_kind": "modified",
  "is_binary": false,
  "diff_unified": "@@ -10,5 +10,7 @@\n   <nav>\n-    <ul>...</ul>\n+    <aside class=\"sidebar\">...</aside>\n+    <div class=\"overlay\">...</div>\n   </nav>",
  "before_sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "after_sha256": "ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890",
  "before_bytes": 4821,
  "after_bytes": 5104,
  "tracking_class": "stage-output",
  "stage": "design",
  "context_unit": null,
  "author_class": "human-via-mcp"
}
```

---

### 3.2 `manual_change_assessment` action payload (workflow engine → agent)

The `haiku_run_next` response dispatched when the pre-tick drift-detection gate has open findings
and no upstream feedback-triage findings are still pending.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `action` | string | yes | Always the literal `"manual_change_assessment"`. Discriminator field. |
| `intent_slug` | string | yes | Active intent identifier. |
| `stage` | string | yes | Active stage at tick time. |
| `tick_id` | string | yes | Same shape as `Assessment.tick_id`. Must be echoed back in `haiku_classify_drift`. |
| `findings` | array of `DriftFinding` | yes | At least one element. The full set of findings the agent must classify. |
| `mode` | `"interactive" \| "pickup" \| "autopilot" \| "hybrid"` | yes | Current invocation mode. |
| `instructions` | string | yes | Agent-facing instructions string built by the orchestrator. Describes the classification taxonomy, tool to call, and any context hints. |
| `legal_outcomes` | object | yes | Map from `findings[i].path` → array of `outcome` strings (§0.3) the agent may legally pick for that finding. Pre-filtered using the legality matrix in §3.4. |

**Worked example (truncated):**

```json
{
  "action": "manual_change_assessment",
  "intent_slug": "out-of-band-human-file-modifications",
  "stage": "design",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "findings": [
    { "path": "stages/design/artifacts/hero-layout.html", "change_kind": "modified", "..." }
  ],
  "mode": "autopilot",
  "instructions": "Classify each finding by calling haiku_classify_drift. Review the diff carefully. Use 'inline-fix' for deliberate human improvements, 'surface-as-feedback' for concerns, 'trigger-revisit' for fundamental redirects, 'ignore' for incidental changes.",
  "legal_outcomes": {
    "stages/design/artifacts/hero-layout.html": ["ignore", "inline-fix", "surface-as-feedback", "trigger-revisit"]
  }
}
```

---

### 3.3 `Classification` — one decision per finding (agent → workflow engine)

The shape the agent submits for each finding via `haiku_classify_drift` (§4.3).

| Field | Type | Required | Constraints |
|---|---|---|---|
| `path` | string | yes | Must exactly match a `findings[i].path` from the dispatched action. |
| `outcome` | `"ignore" \| "inline-fix" \| "surface-as-feedback" \| "trigger-revisit"` | yes | **Canonical enum from §0.3.** Must be in the `legal_outcomes[path]` array for this finding. |
| `rationale_excerpt` | string | yes | Per-finding short rationale for the SPA's per-row label. At least one non-whitespace character. The agent's longer prose lives in `Assessment.agent_rationale`. |
| `linked_feedback_id` | string \| null | conditional | **Required when `outcome === "surface-as-feedback"`.** The `FB-NN` of a feedback item created in the same `haiku_classify_drift` call. `null` for all other outcomes. |
| `linked_revisit_target_stage` | string \| null | conditional | **Required when `outcome === "trigger-revisit"`.** A stage slug at or before the active stage. `null` for all other outcomes. |

---

### 3.4 Outcome legality matrix (per `change_kind`)

| `change_kind` \ `outcome` | `ignore` | `inline-fix` | `surface-as-feedback` | `trigger-revisit` |
|---|---|---|---|---|
| `added` | OK | OK | OK | OK |
| `modified` | OK | OK | OK | OK |
| `deleted` | OK | **rejected** | OK | OK |

A `deleted` finding cannot be classified `inline-fix` because there is nothing on disk to extend.
The agent must either re-create the file (which becomes an `added` finding on the next tick) or
pick another outcome. The gate enforces this in `legal_outcomes` before dispatch.

---

### 3.5 Pre-tick gate ordering and `surface-as-feedback` baseline-update contract

**Gate ordering (normative):**

```
tamper-detection → feedback-triage → drift-detection → per-state dispatch
```

Feedback-triage runs before drift-detection because untriaged feedback may trigger
`haiku_feedback_move`, which relocates files and would produce spurious drift events if drift-
detection ran first. The drift gate's findings are independent of feedback state so running second
is always safe.

**`surface-as-feedback` baseline-update contract (reconciliation requirement R6):**

When `Assessment.outcome === "surface-as-feedback"` (specifically: when the `haiku_classify_drift`
tool writes the `Classification` with that outcome), the `Baseline` row for the affected file is
**NOT updated at classification time**. Instead, a `PendingMarker` (§2.2) is written atomically
with the `Assessment` record. The `Assessment` and `PendingMarker` writes are committed together,
or neither is committed (rollback on failure). The `Baseline` is left unchanged.

Re-detection suppression is handled entirely by the `PendingMarker`: while an open marker
(`cleared_at IS NULL`) exists for a file, the drift-detection gate skips that file regardless of
on-disk SHA divergence. The baseline update is deferred until marker clearance (§4.4 —
`haiku_baseline_clear_marker`), which fires when the linked feedback transitions to a terminal
state (`closed` or `rejected`). At that point the baseline is updated to the file's then-current
on-disk SHA — which may differ from the SHA observed at classification time, since the file may
have been edited further while the feedback was open. This is the correct semantic: the workflow
engine acknowledges the resolved end-state, not an intermediate snapshot.

Cross-references that must agree with this contract:
- §0.3 outcome table — `surface-as-feedback` says "baseline deferred"
- §2.3 `Assessment.resulting_sha` — written at classification time only; nullable for non-terminal outcomes. The post-resolution SHA is read from `Baseline.sha256` after `haiku_baseline_clear_marker` runs (§4.4); the `Assessment` record itself is immutable and is never patched at marker-clearance time
- §4.3 atomic side-effect ordering, step 6 — pending marker only, no baseline write
- §4.4 `haiku_baseline_clear_marker` — the tool that performs the deferred baseline update
- ARCHITECTURE.md §4.4.3 (design stage upstream) — the originating spec

**Re-detection of subsequent edits while a marker is open:** Suppression is per-file, not per-SHA.
If the human edits the file again while the marker is open, no new drift event fires (the marker
still suppresses). When the marker clears, the baseline is updated to the *then-current* SHA in
one step; any intermediate edits are folded into that single acknowledgment. The pending marker
is the sole suppression mechanism — there is no separate "expected SHA" tracked while the marker
is open.

---

## 4. MCP Tool Contracts

This section specifies the interface shapes for the four new MCP tools. Tool names match
`MCP-TOOL-CONTRACT.md` exactly and are finalized; the development stage does not rename them.

### 4.1 `haiku_human_write` — agent writes on behalf of human

**Purpose:** When a user instructs the agent in chat to write a file, the agent uses this tool
instead of `Write`. The write is attributed as `author_class: "human-via-mcp"` in the action log.
The baseline is **not** updated directly — the next tick's drift gate observes the SHA divergence,
emits a `DriftFinding` with `author_class: "human-via-mcp"`, and dispatches
`manual_change_assessment` to classify the write. This unified path applies to all three write
channels: filesystem drop, SPA upload, and `haiku_human_write`. The two sanctioned channels
(`haiku_human_write` and SPA upload) are distinguished from filesystem drops at tick time by the
`PendingOriginStamp` record (§2.4), which the producer writes atomically with the file and the
gate consumes. A filesystem drop produces no stamp, so the gate's default is
`author_class: "human-implicit"` — preserving the attribution chain promised in §2.1, §3.1,
and §6.1.

**Side-effects (all atomic with the file write — either all succeed or none do):**

1. The destination file is written to disk at the canonical path from §4.1.1.
2. A `PendingOriginStamp` record (§2.4) is written to `pending-origin-stamps.json` with
   `author_class: "human-via-mcp"`, `created_by: "haiku_human_write"`, `expected_sha256` set to
   the freshly-computed SHA, and `audit_log_entry_id` set to the `entry_id` of step 3.
3. An audit log entry is appended to `write-audit.jsonl` (append-only JSONL, one record
   per invocation) recording: `timestamp`, `entry_id`, `path`, `sha256`,
   `author_class: "human-via-mcp"`, `human_author_id`, `rationale`,
   `user_instruction_excerpt` (first 200 chars), `tick_counter`, `session_id`, `overwrite`,
   `dirs_created`.

If any step fails, all completed steps are rolled back. The drift gate consults
`pending-origin-stamps.json` (NOT `write-audit.jsonl`) at tick time, so the JSONL log can remain
strictly append-only and outside the gate's read scope.

**Request:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `path` | string | yes | Intent-relative or absolute (resolved to intent-relative — see §4.1.1 *Path normalization*). Must fall within the tracked surface allow-list (§5 of `MCP-TOOL-CONTRACT.md`) and must NOT match any deny-list pattern (§4.1.2). |
| `content` | string | yes | UTF-8 string or base64-encoded binary (when `content_encoding: "base64"`). |
| `content_encoding` | `"utf-8" \| "base64"` | no | Default: `"utf-8"`. |
| `human_author_id` | string | no | Human user's identifier. Captured in audit log. Self-reported; not validated. |
| `rationale` | string | no | Short free-text explanation of why the human requested the write. Captured in audit log and surfaced in the next tick's `manual_change_assessment` payload. |
| `overwrite` | boolean | no | Default: `true`. Pass `false` for create-only semantics. |
| `create_dirs` | boolean | no | Default: `true`. Creates intermediate directories if needed. |

#### 4.1.1 Path normalization (normative)

Every `path` value submitted to `haiku_human_write` is normalized to a single canonical form
**before** allow-list and deny-list matching. Both the allow-list (§5 of `MCP-TOOL-CONTRACT.md`)
and the deny-list (§4.1.2) match against this canonical form only — never against the raw input.

**Canonical form:** A POSIX-style relative path **rooted at the intent directory**
(`.haiku/intents/{slug}/`). Forward slashes only. No leading slash. No `.` or `..` segments. No
trailing slash. Lowercase as supplied (path-segment casing is preserved).

**Algorithm (apply in order):**

1. **Reject NUL bytes** (any ` ` in the input) → `path_outside_tracked_surface` /
   `reason: "path_escape"`.
2. **Convert separators** — replace any `\\` (Windows separator) with `/`.
3. **Resolve absolute inputs** — if the input begins with `/`:
   a. If the input begins with the absolute path of the active intent directory
      (`<repo-root>/.haiku/intents/{slug}/`), strip that prefix.
   b. Otherwise → `path_outside_tracked_surface` / `reason: "path_escape"`.
4. **Resolve `~` and environment expansions** — not supported; if the input contains a leading
   `~` or `$`, treat as literal and continue (no expansion). The result either passes step 6 or is
   rejected there.
5. **Lexical normalization** — collapse runs of `/`, drop `.` segments, and resolve `..` segments
   purely lexically (no filesystem calls). If any `..` segment would escape the intent root (the
   running depth ever goes negative) → `path_outside_tracked_surface` /
   `reason: "path_escape"`.
6. **Reject leading `/`** — if step 5's output still begins with `/` → `path_outside_tracked_surface` /
   `reason: "path_escape"`. (Defense in depth; should not occur after steps 3 and 5.)
7. **Reject empty** — if the result is the empty string or `.` → `path_outside_tracked_surface` /
   `reason: "no_allow_match"`.

**Resulting invariants** (all true of every normalized path):
- Does not start with `/`, `./`, or `../`.
- Does not contain `//`, `/./`, `/../`, or trailing `/`.
- Is interpreted relative to the intent root only.

**Worked normalization examples:**

| Input | Canonical form | Notes |
|---|---|---|
| `knowledge/brand-guide.md` | `knowledge/brand-guide.md` | Already canonical. |
| `./knowledge/brand-guide.md` | `knowledge/brand-guide.md` | Leading `./` dropped. |
| `knowledge//brand-guide.md` | `knowledge/brand-guide.md` | Doubled separator collapsed. |
| `stages/design/artifacts/../artifacts/hero.html` | `stages/design/artifacts/hero.html` | `..` resolved lexically. |
| `/abs/repo/.haiku/intents/out-of-band-human-file-modifications/knowledge/brand-guide.md` | `knowledge/brand-guide.md` | Absolute input stripped of intent-root prefix. |
| `stages\design\artifacts\hero.html` | `stages/design/artifacts/hero.html` | Windows separators converted. |
| `../other-intent/secret.md` | (rejected) | Escapes intent root → `path_escape`. |
| `/etc/passwd` | (rejected) | Absolute, not under intent root → `path_escape`. |
| `write-audit.jsonl` | `write-audit.jsonl` | Resolves to intent-root path; matches deny-list (§4.1.2). |
| `stages/design/write-audit.jsonl` | `stages/design/write-audit.jsonl` | Resolves to a stage-scoped path; **does NOT match** the intent-root `write-audit.jsonl` deny entry. Whether this is denied is governed by §4.1.2 — see deny-list pattern `**/write-audit.jsonl`. |

#### 4.1.2 Deny-list (normative)

The deny-list is matched against the **canonical form** from §4.1.1 using
**git-style pathspec glob semantics** (the same semantics as `.gitignore`):

- A pattern with no `/` (e.g. `intent.md`) matches the basename only at any depth — equivalent to
  `**/intent.md`.
- A pattern beginning with `/` is anchored at the intent root.
- `**` matches any number of path segments (including zero).
- `*` matches any run of characters within a single segment (does not cross `/`).
- A trailing `/` denotes a directory; the pattern matches any path *inside* that directory at any
  depth.
- Match is case-sensitive.

A `path` is denied iff at least one deny pattern matches the canonical form. The first matching
pattern's name is returned in the error envelope's `deny_rule` field for diagnostic clarity.

**Canonical deny patterns:**

| Pattern | What it denies | Rationale |
|---|---|---|
| `/intent.md` | The intent's root metadata file. | Workflow-managed (FM is workflow-engine territory). |
| `/state.json` | The legacy intent-scope state file (if present). | Workflow-managed. |
| `stages/*/state.json` | Per-stage state files. | Workflow-managed. |
| `stages/*/units/` | Every file under any stage's `units/` directory. | Unit specs are workflow-managed; agents go through `haiku_unit_*` MCP tools. |
| `stages/*/feedback/` | Every file under any stage's `feedback/` directory. | Feedback is workflow-managed; agents go through `haiku_feedback_*` MCP tools. |
| `feedback/` | Intent-scope feedback directory (studio-review findings). | Workflow-managed. |
| `**/baseline.json` | The drift-detection baseline file at any depth (intent root or per-stage). | Workflow-engine-only; mutated exclusively by `haiku_baseline_init` and `haiku_baseline_clear_marker`. |
| `**/drift-markers.json` | The pending-marker sidecar at any depth. | Workflow-engine-only; mutated exclusively by `haiku_classify_drift` and `haiku_baseline_clear_marker`. |
| `**/pending-origin-stamps.json` | The pending-origin-stamp sidecar at any depth (§2.4). | Workflow-engine-only; mutated exclusively by `haiku_human_write`, the SPA upload endpoints, and the drift-detection gate. The `**/` prefix denies stage-scoped copies in addition to the intent-root canonical location. |
| `**/write-audit.jsonl` | The human-write audit log at any depth. | Tool-managed; appended only by `haiku_human_write` itself. The `**/` prefix denies stage-scoped copies (`stages/{stage}/write-audit.jsonl`) in addition to the intent-root canonical location, matching the audit-log invariant that no agent or human path may write to it directly. |

**Notes:**
- Allow-list (§5 of `MCP-TOOL-CONTRACT.md`) is consulted **after** the deny-list. A path that
  matches both is denied — deny wins.
- The deny-list does not depend on whether a file currently exists on disk. A deny pattern denies
  the *target path*; create-vs-overwrite semantics are independent.
- The deny pattern returned in `deny_rule` is the literal pattern string from this table (e.g.
  `stages/*/units/`, `**/write-audit.jsonl`), not a regex or expanded form.

**Worked deny-list examples:**

| Canonical path | Matched deny pattern | Result |
|---|---|---|
| `intent.md` | `/intent.md` | Denied. |
| `stages/product/units/unit-01-spec.md` | `stages/*/units/` | Denied. |
| `stages/design/feedback/FB-01.md` | `stages/*/feedback/` | Denied. |
| `feedback/FB-04.md` | `feedback/` | Denied (intent-scope feedback). |
| `baseline.json` | `**/baseline.json` | Denied. |
| `stages/design/baseline.json` | `**/baseline.json` | Denied. |
| `drift-markers.json` | `**/drift-markers.json` | Denied. |
| `pending-origin-stamps.json` | `**/pending-origin-stamps.json` | Denied. |
| `stages/product/pending-origin-stamps.json` | `**/pending-origin-stamps.json` | Denied. |
| `write-audit.jsonl` | `**/write-audit.jsonl` | Denied. |
| `stages/design/write-audit.jsonl` | `**/write-audit.jsonl` | Denied. |
| `knowledge/brand-guide.md` | (none) | Allowed (subject to allow-list match). |
| `stages/design/artifacts/hero.html` | (none) | Allowed (subject to allow-list match). |

**Response (success):**

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

**Error responses:**

| `error` (code) | HTTP-equivalent | When |
|---|---|---|
| `path_outside_tracked_surface` | 400/403 | Path escapes the intent directory (per §4.1.1 normalization), matches a deny-list pattern (per §4.1.2), or matches no allow-list pattern. Includes `reason` sub-field: `deny_list_match` (pattern from §4.1.2 hit) / `no_allow_match` (no allow-list pattern hit) / `path_escape` (normalization rejected the input) / `invalid_stage` (the path's `stages/{stage}/...` segment names a stage that does not exist for this intent). On `deny_list_match`, the response also includes `deny_rule` set to the literal deny pattern that matched (e.g. `**/write-audit.jsonl`). |
| `rationale_required` | 400 | `human_write_require_rationale` plugin setting is `true` and `rationale` was absent. |
| `baseline_conflict` | 409 | A concurrent workflow tick updated the baseline for this path between validation and write. Transient — retry. |
| `path_already_exists` | 409 | `overwrite: false` and destination file already exists. Includes `existing_sha`. |
| `parent_dir_missing` | 400 | `create_dirs: false` and parent directory does not exist. |
| `invalid_content_encoding` | 400 | `content_encoding` is not `"utf-8"` or `"base64"`. |

**Error envelope:**
```json
{ "ok": false, "error": "path_outside_tracked_surface", "message": "Cannot write to 'stages/design/units/unit-02.md': unit files are workflow-managed.", "reason": "deny_list_match", "deny_rule": "stages/*/units/" }
```

The `deny_rule` value is the literal pattern from §4.1.2's deny-list table, matched after the
input was normalized per §4.1.1.

---

### 4.2 `haiku_baseline_init` — bootstrap on upgrade

**Purpose:** First-tick baseline establishment without firing drift events. The drift-detection
gate runs this internally on any tick where `drift_baseline_established_at` is absent for a stage.
This tool is exposed for operator use (e.g., `haiku_repair` scenarios). Subsequent calls are no-ops
for already-baselined files.

**Request:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `intent_slug` | string | yes | Active intent identifier. |
| `mode` | `"establish-all" \| "establish-paths"` | yes | `establish-all`: scan the full tracked surface; `establish-paths`: baseline only the listed paths. |
| `paths` | array of string | conditional | Required when `mode === "establish-paths"`. Intent-relative POSIX paths. |

**Response (success):**

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
  },
  "drift_baseline_established_at": "2026-04-28T14:32:00Z"
}
```

**Error responses:**

| `error` | HTTP-equivalent | When |
|---|---|---|
| `intent_not_found` | 404 | `intent_slug` does not match any intent on disk. |
| `intent_not_active` | 409 | The slug exists but the intent is archived. |
| `tracked_surface_empty` | 200 (with `ok: true, warning: "tracked_surface_empty"`) | No files found in the tracked surface. Not an error — caller may want to know. |

**Worked example — `establish-paths` mode:**

```json
{
  "intent_slug": "out-of-band-human-file-modifications",
  "mode": "establish-paths",
  "paths": [
    "stages/design/artifacts/hero-layout.html",
    "knowledge/brand-guide.md"
  ]
}
```

---

### 4.3 `haiku_classify_drift` — submit classifications for a `manual_change_assessment` dispatch

**Purpose:** The agent's response to a `manual_change_assessment` action. Submits one
`Classification` per dispatched `DriftFinding`. Applies all side effects atomically.

**Request:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `intent_slug` | string | yes | Active intent. |
| `tick_id` | string | yes | Must match the `tick_id` from the dispatched `manual_change_assessment` action. Stale tick IDs are rejected. |
| `classifications` | array of `Classification` | yes | One per dispatched finding, parallel-indexed. |
| `agent_rationale` | string | yes | The longer prose explanation. At least one non-whitespace character. |
| `feedback_creates` | array of `FeedbackCreateInline` | conditional | Required if any `classification.outcome === "surface-as-feedback"` and `linked_feedback_id` is not yet set. The tool atomically creates the feedback items and links them. |

**`FeedbackCreateInline` shape:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `for_classification_path` | string | yes | The `path` of the `Classification` this feedback links to. |
| `title` | string | yes | Same constraints as existing `haiku_feedback` title field. |
| `body` | string | yes | Same constraints as existing `haiku_feedback` body field. |
| `origin` | string | yes | Must be `"agent"`. Other origins are rejected. |
| `resolution` | string \| null | no | `"question" \| "inline_fix" \| "stage_revisit" \| null`. Defaults to `"stage_revisit"`. |

**Atomic side-effect ordering (all-or-rollback):**

1. Write feedback files (from `feedback_creates`, if any).
2. Resolve `linked_feedback_id` for any classifications that omitted it.
3. Validate every classification against `legal_outcomes` for the dispatched tick.
4. Write the `Assessment` record (§2.3) including all DEC-9 audit fields. Populate `resulting_sha`
   with the on-disk SHA of `target_path` only when every classification in this dispatch has a
   terminal outcome (`ignore` or `inline-fix`); otherwise write `resulting_sha: null`. The record
   is append-only — no later step in this list, and no later tool call, ever rewrites
   `resulting_sha` after step 4.
5. For terminal outcomes (`ignore`, `inline-fix`): update `Baseline` to current on-disk SHA
   with `author_class` carried from the finding; set `acknowledged_via: "classification-terminal"`.
   The `Baseline.sha256` written here equals the `Assessment.resulting_sha` written in step 4.
6. For `surface-as-feedback`: write a `PendingMarker` (§2.2) atomically with the `Assessment`
   record. The `Baseline` is **not** updated at classification time per R6 contract (§3.5);
   the deferred baseline update happens on marker clearance via `haiku_baseline_clear_marker`
   (§4.4) when the linked feedback transitions to `closed` or `rejected`.
7. For `trigger-revisit`: write a `PendingMarker` atomically with the `Assessment` record.
   `Baseline` is **not** updated at classification time — updated on revisit completion via
   `haiku_baseline_clear_marker`, per §5.4 of ARCHITECTURE.md.
8. Return the response.

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

*Note: `baselines_updated` is 0 here because `surface-as-feedback` defers the baseline update to
marker clearance (§3.5 R6, §4.4). The count reflects only baselines updated by this call —
terminal outcomes (`ignore`, `inline-fix`) and `haiku_baseline_clear_marker` invocations are the
only paths that increment it.*

**Error responses:**

| `error` | When |
|---|---|
| `tick_id_stale` | `tick_id` does not match the active drift dispatch (gate may have re-fired). |
| `classifications_count_mismatch` | `classifications.length !== findings.length` for the dispatched tick. |
| `illegal_outcome` | A classification has an outcome not in `legal_outcomes[path]`. |
| `missing_link` | `outcome === "surface-as-feedback"` but `linked_feedback_id` is null and no matching `feedback_creates` entry exists. |
| `path_unknown` | A classification's `path` is not in the dispatched findings. |
| `revisit_target_invalid` | `linked_revisit_target_stage` is not at-or-before the active stage. |

**Worked example — single finding classified as `surface-as-feedback`:**

```json
{
  "intent_slug": "out-of-band-human-file-modifications",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "classifications": [
    {
      "path": "stages/design/artifacts/hero-layout.html",
      "outcome": "surface-as-feedback",
      "rationale_excerpt": "Designer replaced nav pattern not in spec — needs unit revision.",
      "linked_feedback_id": null,
      "linked_revisit_target_stage": null
    }
  ],
  "agent_rationale": "The diff replaces the navigation block with a sidebar variant not specified in the design unit. Surfacing as feedback so the design lead can confirm before we re-elaborate.",
  "feedback_creates": [
    {
      "for_classification_path": "stages/design/artifacts/hero-layout.html",
      "title": "Hero layout replaced with unspecified sidebar pattern",
      "body": "Designer replaced `<ul>` nav with a sidebar pattern not in the unit spec. The diff shows the full navigation block rewritten. Please confirm this is the intended direction before development extends this artifact.",
      "origin": "agent",
      "resolution": "stage_revisit"
    }
  ]
}
```

---

### 4.4 `haiku_baseline_clear_marker` — clear a pending marker when downstream action resolves

**Purpose:** Invoked by the workflow engine (not the agent directly) when:
- A feedback item linked to a `surface-as-feedback` marker transitions to a terminal state
  (`closed` or `rejected`), OR
- A revisit linked to a `trigger-revisit` marker completes.

**Reconciliation requirement R5 — trigger contract:**
The tool fires only when the linked feedback transitions to a **terminal** state (`closed` or
`rejected`) or the linked revisit completes. The mid-lifecycle `addressed` state is **not** a
clearance trigger: `addressed` feedback can be reopened, so it does not provide the immutability
guarantee required to safely update the baseline. While feedback is `addressed` but not yet
terminal, the `PendingMarker` continues to suppress re-detection on the file (per §3.5 R6); any
intermediate edits made while the feedback is open are folded into a single baseline acknowledgment
at clearance time. This keeps the suppression window aligned with the immutability boundary
(AC-G5/AC-SF3 in unit-01; `pending_marker_schema.feature` clearance scenarios; `mcp_tools.feature`
R5-contract scenarios).

**Reconciliation requirement R5 — scope:**
This tool clears the `PendingMarker` for a **single tracked file path** per invocation. It is not
a batch-clear operation. Multiple markers (one per file) require multiple invocations.

**Request:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `intent_slug` | string | yes | Active intent. |
| `path` | string | yes | The `PendingMarker.path` to clear. Clears the newest open marker for this path (max `created_at` with `cleared_at IS NULL`). |
| `trigger` | `"feedback-closed" \| "feedback-rejected" \| "revisit-complete"` | yes | The event that caused the clearance. `"feedback-closed"` and `"feedback-rejected"` are the only valid triggers for `surface-as-feedback` markers; `"revisit-complete"` is the only valid trigger for `trigger-revisit` markers. The mid-lifecycle `addressed` state is **not** a valid trigger value — invocations with `"trigger" = "feedback-addressed"` return `error: "invalid_trigger"` (see error table below). |

**Note: no `stage` input.** The owning baseline file is derived from `path` using the normative
**Path → stage derivation** rule documented in §2.1. Because `drift-markers.json` is intent-scoped
while `Baseline` entries are partitioned per-stage, this tool reconciles the two topologies by:

1. Looking up the open `PendingMarker` for `(intent_slug, path)` in the intent-scoped
   `.haiku/intents/{intent_slug}/drift-markers.json`.
2. Applying the §2.1 path-prefix rule to determine the owning baseline file:
   - `stages/{stage}/...` paths → `.haiku/intents/{intent_slug}/stages/{stage}/baseline.json`.
     The `{stage}` capture must match a known stage slug for the intent's studio.
   - `knowledge/**` paths and root-level intent-meta paths (`intent.md`, `intent-state.json`,
     `feedback/**`) → `.haiku/intents/{intent_slug}/baseline.json` (the intent-scope sidecar).
3. Updating the resolved baseline file's entry for `path` (re-hash the on-disk file, update
   `sha256`, `bytes`, `mtime_ns`, `acknowledged_at`, `acknowledged_via = "classification-terminal"`)
   atomically with marking the marker `cleared_at`.

If the `path` does not match any of the prefixes in the §2.1 derivation table, the tool returns
`error: "path_not_in_tracked_surface"` (see error table below). No path-parsing logic exists
outside the §2.1 rule.

**Response (success):**

```json
{ "ok": true, "marker_cleared": true, "baseline_updated": true, "path": "stages/design/artifacts/hero-layout.html" }
```

**Response (no open marker):**

```json
{ "ok": true, "marker_cleared": false, "reason": "no_open_marker", "path": "stages/design/artifacts/hero-layout.html" }
```

**Error responses:**

| `error` | When |
|---|---|
| `intent_not_found` | `intent_slug` unknown. |
| `path_not_in_tracked_surface` | `path` is not a known tracked-surface path for this intent. |
| `invalid_trigger` | `trigger` is not one of the three valid values. Notably, `"feedback-addressed"` is rejected here — the mid-lifecycle `addressed` state does not clear pending markers (R5). |

---

## 5. HTTP API Surface

The browse SPA communicates with the workflow engine over HTTP. Four endpoints support upload
affordances and the drift assessment view. Which process hosts these endpoints (current review-
server vs. a new MCP-app server) is a development-stage decision; the endpoint shapes are stable
regardless of host.

**Authentication:** All endpoints use session cookie authentication from the existing review-server
auth flow (same pattern as `/api/feedback`).

---

### 5.1 `POST /api/intents/{intent-slug}/uploads/stage-output`

Replace or attach a file in a stage's artifacts directory.

**Request (multipart/form-data):**

| Form field | Type | Required | Constraints |
|---|---|---|---|
| `stage` | string | yes | Stage slug. Must be a valid stage for the intent. |
| `target_path` | string | yes | Path **relative to the stage artifacts directory** (e.g., `artifacts/hero-layout.html`). Full intent-relative path is `stages/{stage}/{target_path}`. Escapes rejected. |
| `file` | file | yes | The uploaded content. Max 50 MB (operator-configurable). |
| `mode` | `"replace" \| "create" \| "upsert"` | yes | `replace`: target must exist. `create`: target must NOT exist. `upsert`: either. |
| `attribute_to_user` | string | yes | Authenticated user's display name. Written to audit log and to baseline provenance. |

**Response (200):**

```json
{
  "ok": true,
  "path": "stages/design/artifacts/hero-layout.html",
  "sha256": "ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890ab12cd34ef567890",
  "bytes": 5104,
  "baseline_updated": false,
  "tick_will_observe": true
}
```

Note: `baseline_updated: false` because SPA uploads do NOT update `baseline.json` directly. The
next tick's drift gate observes the SHA divergence and dispatches `manual_change_assessment`.
`tick_will_observe: true` is the confirmation to the SPA that assessment will fire on the next tick.

**Side-effects (atomic with the file write):** A `PendingOriginStamp` record (§2.4) is written
with `author_class: "human-via-mcp"`, `created_by: "spa-upload-stage-output"`, and
`expected_sha256` set to `sha256` from the response. This stamp is what the next tick's drift
gate uses to set `DriftFinding.author_class` to `"human-via-mcp"` (per §3.1.1) instead of the
`"human-implicit"` fallback. An audit log entry is also appended to `write-audit.jsonl`.

**Error table:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `bad_target_path` | `target_path` escapes the stage artifacts directory or contains `..`. |
| 400 | `mode_violation` | `mode === "replace"` but file does not exist, or `mode === "create"` but file already exists. |
| 401 | `unauthorized` | Session cookie absent or expired. |
| 403 | `stage_not_writable` | Stage's artifacts are sealed (completed and merged). |
| 404 | `intent_not_found` | `{intent-slug}` unknown. |
| 409 | `intent_locked` | Intent in a state that disallows uploads. |
| 413 | `payload_too_large` | File exceeds the configured size cap. |
| 415 | `unsupported_mime` | MIME type explicitly rejected (default: allow all). |
| 500 | `write_failed` | Disk write or action-log stamp failed. Baseline is NOT updated. |

**Error envelope:**
```json
{ "ok": false, "error": "stage_not_writable", "message": "Stage 'design' outputs are sealed — the stage has completed and its branch is merged." }
```

---

### 5.2 `POST /api/intents/{intent-slug}/uploads/knowledge`

Add a file to the intent's knowledge directory.

**Request (multipart/form-data):**

| Form field | Type | Required | Constraints |
|---|---|---|---|
| `file` | file | yes | The uploaded content. Max 50 MB. |
| `target_filename` | string | yes | Basename only; no path separators. Lands at `knowledge/{target_filename}` (intent-scope) or `stages/{stage}/knowledge/{target_filename}` (stage-scope). |
| `stage` | string \| null | conditional | Required when knowledge is per-stage; `null` for intent-scope. |
| `description` | string | no | Free-form note attached to the upload audit record. |
| `attribute_to_user` | string | yes | Authenticated user's display name. |

**Response:** Same shape as §5.1.

**Side-effects (atomic with the file write):** Same as §5.1, with `created_by: "spa-upload-knowledge"`
on the `PendingOriginStamp` record (§2.4) instead of `"spa-upload-stage-output"`.

**Error table:** All errors from §5.1, plus:

| HTTP | `error` | When |
|---|---|---|
| 400 | `bad_target_filename` | `target_filename` contains path separators or invalid characters. |
| 409 | `filename_collision` | `target_filename` already exists at the target scope. The SPA should prompt the user to rename or confirm overwrite before retrying. |

**Worked example request body (multipart):**
```
--boundary
Content-Disposition: form-data; name="target_filename"
brand-guide-v2.pdf
--boundary
Content-Disposition: form-data; name="stage"
(empty — intent-scope upload)
--boundary
Content-Disposition: form-data; name="attribute_to_user"
jwaldrip
--boundary
Content-Disposition: form-data; name="file"; filename="brand-guide-v2.pdf"
Content-Type: application/pdf
[binary content]
--boundary--
```

---

### 5.3 `GET /api/intents/{intent-slug}/assessments`

List drift assessments for the SPA's drift assessment view.

**Query parameters:**

| Param | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `limit` | integer | no | 50 | Max 200. |
| `since` | string (RFC 3339) | no | — | Only assessments with `created_at > since`. |
| `stage` | string | no | — | Filter by `findings[*].stage`. |
| `outcome` | `"ignore" \| "inline-fix" \| "surface-as-feedback" \| "trigger-revisit"` | no | — | Filter by classification outcome (§0.3). |

**Response (200):**

```json
{
  "ok": true,
  "assessments": [
    {
      "id": "AS-07",
      "created_at": "2026-04-28T14:35:12Z",
      "stage": "design",
      "findings_count": 1,
      "outcomes_summary": { "inline-fix": 0, "ignore": 0, "surface-as-feedback": 1, "trigger-revisit": 0 },
      "mode": "autopilot"
    }
  ],
  "total": 1,
  "has_more": false
}
```

**Error table:**

| HTTP | `error` | When |
|---|---|---|
| 400 | `bad_param` | A query parameter has an invalid format (e.g. malformed RFC 3339, invalid outcome value). |
| 401 | `unauthorized` | Session cookie absent or expired. |
| 404 | `intent_not_found` | `{intent-slug}` unknown. |

---

### 5.4 `GET /api/intents/{intent-slug}/assessments/{assessment-id}`

Fetch a single assessment for drill-in view.

**Path params:**

| Param | Type | Constraints |
|---|---|---|
| `intent-slug` | string | Active intent identifier. |
| `assessment-id` | string | `AS-NN` format. |

**Response (200):**

```json
{
  "ok": true,
  "assessment": { /* Full Assessment object as defined in §2.3 */ }
}
```

**Error table:**

| HTTP | `error` | When |
|---|---|---|
| 401 | `unauthorized` | Session cookie absent or expired. |
| 404 | `intent_not_found` | `{intent-slug}` unknown. |
| 404 | `assessment_not_found` | `{assessment-id}` does not exist for this intent. |

---

## 6. Internal Events

The workflow engine emits these events to the append-only structured log channel shared with
existing events (`feedback_triage_completed`, `unit_advanced`, etc.). Events are never modified
after writing. Consumers must treat them as immutable.

### 6.1 `drift_detected`

**Emitted by:** The drift-detection gate in the pre-tick pipeline, once per drift event (once per
diverging file per tick).

**Producer:** Workflow engine (drift-detection gate internal).

**Consumers:**
- Orchestrator — uses payload to construct the `manual_change_assessment` action.
- Telemetry / log sink.
- Future: SPA live-update WebSocket channel for real-time drift badges (out of scope for v1).

**Payload:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_type` | string | yes | Always `"drift_detected"`. |
| `event_at` | string (RFC 3339) | yes | UTC. |
| `intent_slug` | string | yes | Active intent. |
| `stage` | string | yes | Active stage at tick time. |
| `tick_id` | string | yes | Same shape as `Assessment.tick_id`. |
| `file_path` | string | yes | The specific file that drifted. Intent-relative POSIX path. |
| `change_kind` | `"added" \| "modified" \| "deleted"` | yes | **Canonical enum from §0.1.** |
| `author_class` | `"agent" \| "human-via-mcp" \| "human-implicit" \| null` | yes | Mirrors `DriftFinding.author_class` for this file (resolved by the algorithm in §3.1.1: stamp lookup against `PendingOriginStamp` §2.4, falling back to `"human-implicit"`). `null` only for `"added"` events when no baseline entry existed AND no stamp was matched (in which case `"human-implicit"` is also acceptable; emitters MUST pick one and be consistent — the canonical choice is `"human-implicit"` because the file was nonetheless authored by some channel). |
| `is_binary` | boolean | yes | Binary-file signal. |

**Note:** SHA values and diff payloads are NOT written to the event — those are in the assessment
record (`drift-assessments/DA-NN.json`). Telemetry events are for rate-monitoring, not diff review.

**Worked example:**

```json
{
  "event_type": "drift_detected",
  "event_at": "2026-04-28T14:35:00Z",
  "intent_slug": "out-of-band-human-file-modifications",
  "stage": "design",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "file_path": "stages/design/artifacts/hero-layout.html",
  "change_kind": "modified",
  "author_class": "human-implicit",
  "is_binary": false
}
```

---

### 6.2 `assessment_recorded`

**Emitted by:** `haiku_classify_drift` MCP tool handler, once per `manual_change_assessment`
dispatch (one event per classification batch, not one per finding).

**Producer:** `haiku_classify_drift` tool handler.

**Consumers:**
- Orchestrator — decides next-tick action (fix loop, revisit, etc.).
- Telemetry.
- SPA drift assessment view (polls `/api/intents/{slug}/assessments` after observing this event).

**Payload:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_type` | string | yes | Always `"assessment_recorded"`. |
| `event_at` | string (RFC 3339) | yes | UTC. |
| `intent_slug` | string | yes | Active intent. |
| `assessment_id` | string | yes | `"AS-NN"`. |
| `stage` | string | yes | Active stage. |
| `tick_id` | string | yes | The tick that triggered the assessment. |
| `outcomes_count` | object | yes | `{ "ignore": N, "inline-fix": N, "surface-as-feedback": N, "trigger-revisit": N }`. Uses canonical enum values from §0.3. |
| `feedback_ids_created` | array of string | yes | `["FB-12", ...]`. May be empty. |
| `baselines_updated` | integer | yes | Count of `Baseline` rows updated in this submission. |
| `pending_markers_created` | integer | yes | Count of new `PendingMarker` rows written. |
| `mode` | string | yes | Mirrors `Assessment.mode`. |

**Worked example:**

```json
{
  "event_type": "assessment_recorded",
  "event_at": "2026-04-28T14:35:14Z",
  "intent_slug": "out-of-band-human-file-modifications",
  "assessment_id": "AS-07",
  "stage": "design",
  "tick_id": "tick-2026-04-28T14-35-00Z-7f2",
  "outcomes_count": { "ignore": 0, "inline-fix": 0, "surface-as-feedback": 1, "trigger-revisit": 0 },
  "feedback_ids_created": ["FB-12"],
  "baselines_updated": 1,
  "pending_markers_created": 1,
  "mode": "autopilot"
}
```

---

### 6.3 `pending_marker_cleared`

**Emitted by:** `haiku_baseline_clear_marker` (the workflow engine's internal lifecycle handler).

**Producer:** Workflow engine.

**Consumers:**
- Orchestrator — updates downstream tick state.
- Telemetry.
- SPA — refreshes the corresponding assessment row's status pill from `pending` to `resolved`.

**Payload:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_type` | string | yes | Always `"pending_marker_cleared"`. |
| `event_at` | string (RFC 3339) | yes | UTC. |
| `intent_slug` | string | yes | Active intent. |
| `path` | string | yes | The marker's `path` (same as `PendingMarker.path`). |
| `assessment_id` | string | yes | The originating `Assessment.id`. |
| `trigger` | `"feedback-closed" \| "feedback-rejected" \| "revisit-complete"` | yes | The event that caused the clearance. Mirrors `haiku_baseline_clear_marker.trigger` (§4.4). `"feedback-addressed"` is intentionally not a valid value — see R5 in §4.4. |
| `linked_feedback_id` | string \| null | yes | The `PendingMarker.linked_feedback_id`. |
| `linked_revisit_target_stage` | string \| null | yes | The `PendingMarker.linked_revisit_target_stage`. |

**Worked example:**

```json
{
  "event_type": "pending_marker_cleared",
  "event_at": "2026-04-29T10:14:33Z",
  "intent_slug": "out-of-band-human-file-modifications",
  "path": "stages/design/artifacts/hero-layout.html",
  "assessment_id": "AS-07",
  "trigger": "feedback-closed",
  "linked_feedback_id": "FB-12",
  "linked_revisit_target_stage": null
}
```

---

## 7. Cross-Surface Naming Audit

Every entity below must appear with the same name across all five surfaces. Any variance is a
reconciliation failure. The single intentional exception is documented with its conversion rule.

| Entity | On disk (§2) | In action payload (§3) | In MCP tool (§4) | In HTTP API (§5) | In events (§6) |
|---|---|---|---|---|---|
| Intent identifier | `intent_slug` | `intent_slug` | `intent_slug` | `{intent-slug}` (URL) / `intent_slug` (body) | `intent_slug` |
| Tracked file path | `path` (baseline key) | `path` (DriftFinding field) | `path` (request + response) | `path` (response) / `target_path` (upload request — intentional; see note below) | `file_path` (events) |
| `change_kind` enum | — | `change_kind` | — | — | `change_kind` |
| `author_class` enum | `author_class` (Baseline) | `author_class` (DriftFinding) | `author_class` (response) | — | `author_class` |
| `outcome` enum | `outcome` (Classification/Assessment) | `outcome` (Classification) | `outcome` (Classification request) | `outcome` (query param) | `outcomes_count` keys |
| Assessment ID | `id` (Assessment) | — | `assessment_id` (response) | `{assessment-id}` (URL) / `assessment_id` (list response) | `assessment_id` |
| Feedback ID | `linked_feedback_id` (PendingMarker, Classification, Assessment) | `linked_feedback_id` (Classification) | `linked_feedback_id` + `feedback_created` (response) | — | `feedback_ids_created` (assessment_recorded), `linked_feedback_id` (marker_cleared) |
| Stage | `stage` (Baseline, Assessment) | `stage` (action payload) | — (implicit in `path`) | `stage` (form field + query param) | `stage` |
| Tick identifier | `tick_id` (Assessment) | `tick_id` (action payload) | `tick_id` (request + assessment response) | — | `tick_id` |
| Pending marker path | `path` (PendingMarker) | — | `path` (haiku_baseline_clear_marker request) | — | `path` (pending_marker_cleared) |
| Pending-origin stamp | `path` + `author_class` (PendingOriginStamp §2.4) | `author_class` (DriftFinding §3.1, sourced from stamp) | `path` + `audit_log_entry_id` (haiku_human_write side-effect) / SPA upload side-effect | — (stamp is workflow-engine-only; never serialized to HTTP) | `author_class` (drift_detected §6.1, sourced from stamp) |

**Intentional naming variance — `path` vs. `target_path` in HTTP upload requests:**

HTTP upload request bodies use `target_path` (stage-relative path, e.g. `artifacts/hero-layout.html`)
where all other surfaces use `path` (intent-relative, e.g. `stages/design/artifacts/hero-layout.html`).
This is the only naming variance, and it is intentional: SPA upload requests are always scoped to a
single stage, so the `stage` form field provides the prefix. The conversion rule is:

```
intent_relative_path = "stages/" + stage + "/" + target_path
```

The HTTP response body uses `path` (intent-relative), consistent with all other surfaces.

---

## 8. Boundary Notes (deferred to development stage)

The following decisions are NOT owned by this product-stage document. They are named here so
development has the framing.

- **Tracked-surface boundary specifics** — which exact paths the gate scans is documented in
  `stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md`. The product-stage contract is surface-
  agnostic with respect to path enumeration details.
- **Baseline storage format / location** — on-disk specifics (JSON file at `stages/{stage}/baseline.json`)
  are documented in `stages/design/artifacts/ARCHITECTURE.md` §2.2. This document specifies the
  field-level shape; storage location is the architecture artifact's domain.
- **Tick ID format** — UUID, monotonic counter, or `(intent, seq)` tuple. Owned by ARCHITECTURE.md.
- **Diff cap for `added` events** — the threshold above which `diff_unified` is `null` for new files.
  Owned by development.
- **SPA upload host process** — which server exposes the HTTP endpoints (§5). Owned by development.
- **`haiku_baseline_clear_marker` exposure level** — whether this tool is MCP-callable by the agent
  or is workflow-engine-internal-only. Owned by development.
- **Knowledge upload scope** — intent-scope vs. per-stage for the `POST /uploads/knowledge` endpoint
  is partially deferred (the endpoint supports both via the `stage` field, but the SPA's default is
  a development decision).

None of these affect the field-level shapes above. They affect where data lives and how it is
computed, not what it looks like at the boundary.

---

*Document version: product-stage-final. Supersedes `knowledge/DATA-CONTRACTS.md`.*
