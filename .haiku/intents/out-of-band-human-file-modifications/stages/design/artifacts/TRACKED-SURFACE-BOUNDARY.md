# Tracked-Surface Boundary Specification

*Design artifact for the `out-of-band-human-file-modifications` intent. This document defines the exact set of paths that the pre-tick drift-detection gate baselines and monitors. The architecture stage (`ARCHITECTURE.md`) and all development-stage units implement against this boundary. Path patterns and contract rules only — no TypeScript file paths, function signatures, or shell commands appear here.*

---

## Purpose

The tracked surface is the set of files inside an intent directory that the workflow engine baselines, hashes on every tick, and compares against prior-acknowledged state to detect out-of-band human writes. Without a precise boundary, drift detection is either too narrow — missing edits a human made to stage outputs or knowledge artifacts — or too broad — generating false positives on workflow-internal churn that has separate integrity guarantees. This document draws that boundary explicitly.

The boundary spec is consumed by two downstream units:

- **Architecture unit** — specifies the storage shape, gate algorithm, and pending-assessment marker contract against this boundary.
- **Development units** — implement the gate, baseline storage, and `manual_change_assessment` workflow action against the path patterns here.

---

## Canonical Directory Name

Throughout this document, `artifacts/` is the canonical name for a stage's output directory. The DESIGN-BRIEF.md and earlier sketches in this intent sometimes reference `outputs/` as a hypothetical output area; for the purposes of this spec and all downstream units, **`artifacts/` is the canonical name**. Wherever prior documents use `outputs/`, the implementation maps to `artifacts/`. The alias is noted explicitly: **`stages/{stage}/outputs/` is an alias for `stages/{stage}/artifacts/`** — do not create a separate `outputs/` directory; treat both references as pointing to `artifacts/`.

---

## 1. In-Scope: Tracked Paths

The following path categories are part of the tracked surface. Every file under these paths is baselined by SHA-256 content hash and monitored for drift on every `haiku_run_next` tick.

### 1.1 Stage Knowledge Artifacts

**Pattern:** `stages/{stage}/knowledge/**`

**Glob examples:**
- `stages/design/knowledge/DESIGN-TOKENS.md`
- `stages/inception/knowledge/MARKET-RESEARCH.md`
- `stages/development/knowledge/API-SPEC.md`
- `stages/design/knowledge/references/color-palette.md`

**What lives here:** Knowledge produced by or provided to a specific stage's hat execution — design-token references, research distillations, API contracts, and any other structured knowledge artifact the agent produces or consumes during that stage's elaboration or execution phases.

**Why tracked:** These files are the ground truth the agent reads to produce stage outputs. If a human modifies a knowledge artifact — adding a new token, correcting a research finding, updating an API spec — the agent must observe the change and decide whether to fold it into the next bolt or surface it as a finding. Silent overwrites of human knowledge updates are a primary failure mode this feature targets.

### 1.2 Intent-Level Knowledge Directory

**Pattern:** `knowledge/**`

**Glob examples:**
- `knowledge/DISCOVERY.md`
- `knowledge/DESIGN-DECISIONS.md`
- `knowledge/IMPLEMENTATION-MAP.md`
- `knowledge/user-research-notes.md`
- `knowledge/competitive-analysis.pdf`

**What lives here:** Knowledge scoped to the full intent rather than any single stage — inception outputs, cross-stage design decisions, uploaded reference documents, and any knowledge artifact that multiple stages need to consume. This is the primary landing zone for the "user uploads reference material into elaborate phase" scenario from DISCOVERY.md.

**Why tracked:** The intent-level knowledge directory is the most common target for human uploads and out-of-band additions. A user dropping a research document, a designer uploading a token file, or the SPA's Knowledge Upload Panel all write to this directory. Tracking it ensures new files (which appear as `added` drift events rather than `modified`) are observed and classified on the next tick.

**Note on new-file detection:** A file that appears under `knowledge/` with no baseline entry is treated as a `human-implicit` author-class write. See Section 4 for new-file behavior details.

### 1.3 Stage Output Artifacts (Canonical: `artifacts/`)

**Pattern:** `stages/{stage}/artifacts/**`

**Glob examples:**
- `stages/design/artifacts/hero-layout.html`
- `stages/design/artifacts/component-states.svg`
- `stages/inception/artifacts/DISCOVERY.md`
- `stages/development/artifacts/generated-schema.json`
- `stages/design/artifacts/design-tokens.css`

**Alias note:** `stages/{stage}/outputs/**` is treated as equivalent to `stages/{stage}/artifacts/**`. If any prior document references `stages/design/outputs/hero.html`, the implementation path is `stages/design/artifacts/hero.html`. The canonical directory name is `artifacts/`; no `outputs/` directories are created.

**Additional output paths from STAGE.md:** Each stage's `STAGE.md` file declares its output paths via the `outputs:` frontmatter field. Any path declared there beyond the default `artifacts/` is also part of the tracked surface for that stage. At gate initialization time, the gate reads each stage's `STAGE.md` `outputs:` field and includes any declared paths in the tracking scope for that stage. The tracked_paths extension mechanism (Section 2.1) handles this dynamically.

**What lives here:** Production-ready design artifacts, generated files, stage deliverables — figma exports, HTML mockups, SVG wireframes, generated schemas, screenshots, design-token files, and any other file that represents the stage's completed output. This is the primary target for the "designer replaces a layout" and "PO edits a deliverable" scenarios from DISCOVERY.md.

**Why tracked:** Stage output artifacts are the files humans are most likely to replace, refine, or annotate outside the agent's normal write pipeline. A designer replacing a Figma export, a developer uploading a new schema version, or a product owner swapping a screenshot — all are writes to this directory that the next tick must observe. These are exactly the files where silent agent overwrites would cause the most damage to human collaboration.

### 1.4 Stage Discovery Artifacts

**Pattern:** `stages/{stage}/discovery/**`

**Glob examples:**
- `stages/inception/discovery/MARKET-ANALYSIS.md`
- `stages/design/discovery/COMPONENT-AUDIT.md`
- `stages/development/discovery/DEPENDENCY-GRAPH.md`
- `stages/inception/discovery/competitive-screenshots/`

**What lives here:** Artifacts produced by discovery fan-out subagents during the elaboration phase — research artifacts, competitive analyses, dependency graphs, component audits, and any other structured discovery output. These are produced by the agent but may be supplemented or corrected by humans.

**Why tracked:** Discovery artifacts feed elaboration and are occasionally hand-supplemented by domain experts. A researcher correcting a competitive analysis, a designer annotating a component audit, or a PO adding context to a market analysis are all out-of-band edits that the classification step should observe and route appropriately.

### 1.5 Replaceable Artifacts (Figma Exports, Generated HTML, Screenshots, Design Tokens)

These are a sub-category of Stage Output Artifacts (Section 1.3) that warrant explicit mention because of their binary format handling and their role in the primary design-handoff scenarios.

**Pattern:** `stages/{stage}/artifacts/**` (same as 1.3)

**Specific glob examples:**
- `stages/design/artifacts/*.html` — generated HTML mockups
- `stages/design/artifacts/*.svg` — SVG wireframes and component diagrams
- `stages/design/artifacts/*.png` — screenshot-class images
- `stages/design/artifacts/*.jpg` — photograph-class images
- `stages/design/artifacts/*.pdf` — document exports
- `stages/design/artifacts/*.figma` — Figma file exports
- `stages/design/artifacts/*.pen` — OpenPencil file exports
- `stages/design/artifacts/*.css` — generated design-token stylesheets
- `stages/design/artifacts/*.json` — token manifests or schema exports

**Why explicitly named:** The "designer replaces a layout" scenario — the first and most prominent motivating use case from DISCOVERY.md — always involves one of these file types. Naming them explicitly ensures the gate's binary-file handling path (SHA + size + mime, no content diff) is clearly scoped to known replaceable artifact formats. See Section 5 for binary file handling.

---

## 2. Extension Points: Per-Stage `tracked_paths`

### 2.1 Mechanism

A stage's `STAGE.md` file MAY declare additional tracked path patterns beyond the defaults above via a `tracked_paths:` frontmatter field. This field accepts a list of glob patterns relative to the intent directory. Any path matching a declared pattern is added to that stage's tracked surface, alongside the defaults.

**Example STAGE.md frontmatter:**
```
tracked_paths:
  - stages/custom-stage/generated/**
  - stages/custom-stage/exports/*.csv
```

**Semantics:**
- Patterns are additive. They extend, never replace, the default tracked surface.
- Patterns follow the same glob rules as the defaults: `**` matches any depth of subdirectory.
- Patterns are relative to the intent directory root (the `.haiku/intents/{slug}/` directory).
- Patterns may only reference paths within the intent directory. Patterns that resolve outside the intent directory are rejected at gate initialization.

### 2.2 Use Cases for Non-Software Studios

The `tracked_paths` extension point exists primarily to support non-software studios that operate outside the `stages/{stage}/artifacts/` + `stages/{stage}/knowledge/` structure assumed by the software studio defaults. Examples:

- A **research studio** might produce `stages/literature-review/citations/**` as a distinct output that warrants tracking.
- A **content studio** might produce `stages/copywriting/drafts/**` and `stages/copywriting/approved/**` as separate tracked surfaces.
- A **data studio** might produce `stages/analysis/notebooks/**` and `stages/analysis/outputs/*.csv`.

In these cases, the studio's stage authors declare the additional paths via `tracked_paths:` and the gate picks them up automatically. No gate code changes are needed per studio — the tracked surface is entirely data-driven from `STAGE.md`.

### 2.3 Non-Overridable Defaults

The defaults in Section 1 cannot be removed or narrowed by a `tracked_paths:` declaration. A stage that declares `tracked_paths: []` still tracks `stages/{stage}/artifacts/**`, `stages/{stage}/knowledge/**`, `stages/{stage}/discovery/**`, and `knowledge/**`. The tracked_paths field is append-only at the stage level. This ensures the core collaboration scenarios (design replacement, knowledge upload, discovery annotation) always receive drift detection regardless of studio configuration.

---

## 3. Out-of-Scope: Explicitly Excluded Paths

The following categories are deliberately outside the tracked surface. Each exclusion carries a one-line rationale.

### 3.1 Workflow-Managed Files

**Patterns:**
- `stages/{stage}/units/*.md` — unit specifications, lifecycle state encoded in frontmatter
- `stages/{stage}/feedback/*.md` — feedback items authored by the review pipeline
- `intent.md` — the intent's top-level metadata and status
- `stages/{stage}/state.json` — the stage's workflow state machine record

**Rationale:** Workflow-managed files are already policed by the existing PreToolUse hook, which forces all agent writes through MCP tools and enforces structural invariants via schema validation. These files carry embedded integrity checksums and are validated by the tamper-detection gate on every tick. Adding drift detection would create double-coverage that conflicts with the tamper-detection logic — two systems making independent claims about the authoritative state of the same file. If a human edits these files directly via the filesystem, that is handled by the existing security boundary (Decision 2 in DESIGN-DECISIONS.md) and is out of scope for drift detection.

### 3.2 Audit Logs and Lifecycle Records

**Patterns:**
- `stages/{stage}/decision_log.json` — append-only record of structural decisions
- `stages/{stage}/audit/**` — audit trail files produced by the workflow engine
- `stages/{stage}/drift-assessments/DA-*.json` — assessment records produced by `manual_change_assessment` (this spec's own output)
- `.haiku/intents/{slug}/drift-markers.json` — pending-assessment marker store
- `.haiku/intents/{slug}/write-audit.jsonl` — the human-write audit log produced by the human-attributed-write MCP tool

**Rationale:** Audit logs and lifecycle records are append-only by design. They accumulate state over time and are never rewritten by either agents or humans in normal operation. Drift detection on append-only files would produce a drift event on every tick after any write, because the file grows with each tick. This would be pure noise. The integrity of these files is guaranteed by their append-only contract, not by SHA baselining.

### 3.3 Infrastructure Paths

**Patterns:**
- `.git/**` — the intent worktree's git metadata and object store
- `.haiku/worktrees/**` — the worktree management layer used by the H·AI·K·U orchestrator
- `.haiku/intents/{slug}/stages/{stage}/baseline.json` — the drift baseline file itself

**Rationale:** Infrastructure paths are managed by the runtime environment, not by the workflow's content model. `.git/**` changes on every commit, fetch, and rebase — tracking it would generate constant false positives from normal git operations. `.haiku/worktrees/**` is the worktree management layer that the orchestrator uses to coordinate concurrent work; it is not content-bearing. The `baseline.json` file itself cannot be tracked by the mechanism that reads it — that would create a circular dependency where the gate's own writes trigger the gate on the next tick.

### 3.4 Files Outside the Intent Directory

**Patterns:**
- Any path not under `.haiku/intents/{slug}/` — source code, configuration files, test fixtures, scripts, documentation outside the intent, build artifacts

**Rationale:** The drift-detection gate is intent-scoped. The intent directory is the unit of collaboration for a single H·AI·K·U workflow; out-of-band human writes to source code, application configs, or test fixtures during an intent cycle are normal development activity and do not constitute "drift" in the intent's lifecycle. Tracking files outside the intent directory would require the gate to enumerate potentially the entire repository on every tick, creating unacceptable I/O overhead. The v1 tracked surface is intentionally narrow: intent-scoped content only. This boundary may expand in a future version.

---

## 4. Special Behaviors

### 4.1 First-Tick-After-Deploy: Establish, Don't Fire

When the `baseline.json` file for a stage does not exist — either because this is a new intent, or because this is the first tick after the feature ships for an existing intent — the drift-detection gate runs in **baseline establishment mode**:

1. The gate enumerates all files currently on disk in the tracked surface for that stage.
2. For each file, the gate computes the SHA-256 content hash and writes a baseline entry with `author_class: "agent"` (conservative default — any pre-existing file is assumed to be in an agent-acknowledged state).
3. The gate writes the new `baseline.json` to disk.
4. The gate emits **no drift events** for this tick.

The critical property of this mode is the absence of drift events. Files that have drifted from any prior agent-written state for any reason — manual cleanup, git rebases, incidental filesystem operations — are absorbed into the baseline silently. This is the "establish, don't fire" rule.

**How baseline establishment differs from drift detection:**

| Aspect | Establishment mode | Drift detection mode |
|---|---|---|
| Trigger | `baseline.json` absent | `baseline.json` present |
| Gate action | Write baseline, emit nothing | Compare against baseline, emit drift events for divergences |
| Drift events emitted | Zero | Zero or more |
| Baseline written | Yes (full tracked surface snapshot) | Only for files classified with terminal outcomes |
| Tick continues | Yes, to per-state dispatch | Yes if no drift events; blocked by `manual_change_assessment` if drift events exist |

**Implication for existing intents on upgrade:** When the feature ships, every running intent on its next tick runs establishment mode for every stage that lacks a `baseline.json`. Pre-existing human edits to tracked files are silently absorbed. This is correct behavior — the first tick is a snapshot of the current state of the world, not a retroactive audit of everything that happened before the feature existed.

**New directories mid-intent:** If a tracked directory (e.g., `stages/design/artifacts/`) is created mid-intent for the first time during normal hat execution, the gate absorbs it on the same tick via the same establishment logic. The newly-created directory's files are written to the baseline without emitting drift events. From the next tick forward, the directory is part of the normal drift-detection scan.

### 4.2 New-File Detection

A file that appears under a tracked path with no baseline entry is treated as a **human-implicit author-class write**, not as drift. The distinction matters: there is nothing to diff against, so the gate cannot determine whether the file's current content diverges from a prior state.

**Behavior:**
- The gate emits a drift event with `event_type: "added"`.
- The `author_class` in the event is `null` (no baseline entry exists to carry a prior class).
- The `baseline_sha` in the event is `null`.
- For text files, the `diff_payload` carries the file's full current content (the entire file is "new").
- For binary files, the `diff_payload` is `null`; `is_binary: true`; `current_sha` carries the SHA of the new file.

**Classification:** The `manual_change_assessment` action classifies the new-file event through the same four-outcome taxonomy as modified-file events. The most common outcomes:
- `inline-fix` — the new file is reference material or a replacement artifact the agent should incorporate into the next bolt.
- `ignore` — the new file is a temporary artifact (editor temp files, OS metadata) that has no workflow significance.
- `surface-as-feedback` — the new file is ambiguous or potentially problematic (an unexpected file appearing in an outputs directory mid-development).

New-file detection is the mechanism that makes the "user drops a reference document into the knowledge directory" scenario work. The file has no baseline entry, so it appears as an `added` event, which triggers classification, which routes it as new knowledge to fold into the next elaboration bolt.

### 4.3 File-Deletion Detection

A file that was previously baselined but is no longer present on disk fires a drift event with `event_type: "deleted"`.

**Behavior:**
- The gate emits a drift event with `event_type: "deleted"`.
- The `author_class` carries the class from the last baseline entry.
- The `current_sha` is `null`.
- The `diff_payload` carries the prior file content if it is recoverable from git history; otherwise `null`.

**Classification:** The `manual_change_assessment` action classifies the deletion event. Possible outcomes:
- `ignore` — the file was a temporary output that has been cleaned up; the deletion was intentional.
- `surface-as-feedback` — the file appears to have been deleted accidentally or without full context; the agent creates a feedback item noting the deletion for human triage.
- `trigger-revisit` — the deleted file was a foundational artifact whose absence invalidates prior stage work (e.g., deleting a design-token file that downstream stages depend on).

The agent does **not** automatically restore the deleted file from the baseline. Restoration is a classification outcome the agent may choose to implement as an `inline-fix` (re-creating the file from the baseline SHA using the prior content), but it is not automatic.

---

## 5. Binary File Handling

### 5.1 Binary Detection

A file is classified as binary when either of the following is true:

- Its extension matches the binary extensions list (see Section 5.2).
- Its byte content contains null bytes (`\x00`) in the first 8,192 bytes scanned (heuristic consistent with git's binary detection).

Binary detection is applied at gate scan time, before the diff computation step. Binary files are never passed through the unified-diff generator.

### 5.2 Binary Extensions List

The following extensions are always treated as binary regardless of byte content:

**Image formats:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.ico`, `.heic`, `.heif`

**Design tool exports:** `.figma`, `.pen`, `.sketch`, `.xd`, `.psd`, `.ai`

**Document exports:** `.pdf`, `.epub`

**Archive formats:** `.zip`, `.tar`, `.gz`, `.bz2`, `.xz`, `.7z`

**Font files:** `.ttf`, `.otf`, `.woff`, `.woff2`, `.eot`

**Video and audio:** `.mp4`, `.mov`, `.avi`, `.webm`, `.mp3`, `.wav`, `.ogg`

**Compiled and bundled artifacts:** `.wasm`, `.exe`, `.dylib`, `.so`, `.dll`

This list is the default binary extension set. A stage MAY extend it via the `binary_extensions:` frontmatter field in `STAGE.md` using the same additive-only rule as `tracked_paths:`.

### 5.3 Baseline Entry for Binary Files

Binary files are baselined by SHA-256 content hash only. The baseline entry shape for a binary file is identical to a text file:

```
tracked-file-path →
  sha:              string       // SHA-256 hex digest of the full file content
  author_class:     "agent" | "human-via-mcp" | "human-implicit"
  last_updated_tick: number
```

No additional size or mime fields are stored in the baseline. The gate computes the mime type at scan time from the file extension and byte-content heuristic; this is a scan-time computation, not a stored field.

### 5.4 Drift Event Shape for Binary Files

When a binary file's SHA diverges from its baseline entry, the gate emits a drift event with:

- `is_binary: true`
- `diff_payload: null` (no content diff is possible)
- `event_type: "modified"` (or `"added"` / `"deleted"` as applicable)
- `current_sha`: the new SHA-256 of the file
- `baseline_sha`: the prior SHA-256 from the baseline

The agent receives the file path, change type, author class, SHA delta, and a computed mime type (derived from extension at dispatch time). There is no content to examine directly.

### 5.5 Default Classification for Binary Files

The default classification for a binary `modified` event is `surface-as-feedback` with a standard rationale note: "Binary file changed; content diff unavailable. Surfacing for human review."

This default is overridden when the agent has specific stage context that makes the change unambiguous:

- If the intent is in the `design` stage, the active hat involves design artifact production, and the changed file is under `stages/design/artifacts/` — the change is very likely a deliberate designer replacement. The agent MAY classify this as `inline-fix` based on this context.
- If the file is under `knowledge/` and the change is an `added` event — a human uploaded a reference image or PDF. The agent SHOULD classify this as `inline-fix` (fold the reference into the next elaboration bolt).

In the absence of stage context or when the context is ambiguous, `surface-as-feedback` is the required default. The conservative default ensures binary changes are never silently ignored at the cost of a feedback item, which a human reviewer can triage and close if the change was benign.

---

## 6. Baseline Storage Contract

The following table maps each tracked path category to the storage shape the baseline uses for entries from that category. This ensures the architecture unit's baseline data shape is consistent with the boundary definition here.

| Tracked path category | Pattern | Baseline entry key format | Notes |
|---|---|---|---|
| Stage knowledge | `stages/{stage}/knowledge/**` | `stages/{stage}/knowledge/{relative-path}` | Relative to intent directory |
| Intent knowledge | `knowledge/**` | `knowledge/{relative-path}` | Relative to intent directory |
| Stage artifacts (canonical) | `stages/{stage}/artifacts/**` | `stages/{stage}/artifacts/{relative-path}` | Canonical name; `outputs/` alias maps here |
| Stage discovery | `stages/{stage}/discovery/**` | `stages/{stage}/discovery/{relative-path}` | Relative to intent directory |
| Additional via `tracked_paths:` | Declared in STAGE.md | As declared | Must be intent-relative |

All keys in `baseline.json` are paths relative to the intent directory root (`.haiku/intents/{slug}/`). Absolute paths and `..` escapes are not valid baseline keys; the gate rejects any path that resolves outside the intent directory.

---

## 7. Interaction with Workflow-Managed-File Guardrail

The existing PreToolUse hook guards workflow-managed files (`units/*.md`, `feedback/*.md`, `intent.md`, `state.json`) against direct agent writes by intercepting all Read/Write/Edit tool calls on those paths and requiring agents to use MCP tools instead. The tamper-detection gate independently validates the integrity of those same files on every tick.

The drift-detection gate is **parallel to**, not part of, these two mechanisms. The three mechanisms operate on non-overlapping file sets:

- **PreToolUse hook** — governs agent writes to workflow-managed files only.
- **Tamper-detection gate** — validates the structural integrity of workflow-managed files on every tick.
- **Drift-detection gate** — monitors the tracked surface (knowledge, artifacts, discovery) for human writes.

Placing workflow-managed files in the tracked surface would create a conflict: the tamper-detection gate would fire on the same file the drift-detection gate is trying to classify, and the two systems would produce contradictory instructions to the agent about what to do. The exclusion in Section 3.1 is not an oversight — it is the boundary that keeps the two systems coherent.

If a human edits a workflow-managed file directly via the filesystem (bypassing MCP tools), that case is outside the scope of this feature (Decision 2 in DESIGN-DECISIONS.md). The agent guardrail boundary is: "agents must use MCP; humans can write anything." Drift detection on workflow-managed files is deferred to a separate security/hooks artifact that would tighten the boundary specifically for that file class.

---

## 8. Boundary Summary

| Category | In scope | Pattern | Rationale |
|---|---|---|---|
| Stage knowledge artifacts | Yes | `stages/{stage}/knowledge/**` | Human-supplementable knowledge the agent reads for decisions |
| Intent-level knowledge | Yes | `knowledge/**` | Primary landing zone for knowledge uploads |
| Stage output artifacts (canonical `artifacts/`) | Yes | `stages/{stage}/artifacts/**` | Primary target for designer/PO replacements |
| `outputs/` alias | Yes (maps to `artifacts/`) | `stages/{stage}/outputs/**` → `stages/{stage}/artifacts/**` | Legacy alias; treated as canonical path |
| Stage discovery artifacts | Yes | `stages/{stage}/discovery/**` | Fan-out subagent research, human-annotatable |
| Additional via STAGE.md `tracked_paths:` | Yes | Stage-declared | Extension point for non-software studios |
| Workflow-managed files | **No** | `units/*.md`, `feedback/*.md`, `intent.md`, `state.json` | Double-coverage with tamper-detection gate; separate integrity model |
| Audit logs and lifecycle records | **No** | `decision_log.json`, `audit/**`, `drift-assessments/**`, `drift-markers.json`, `write-audit.jsonl` | Append-only by contract; tracking would produce noise on every write |
| Infrastructure paths | **No** | `.git/**`, `.haiku/worktrees/**`, `baseline.json` | Runtime environment, not content; circular dependency for baseline |
| Files outside intent directory | **No** | Anything outside `.haiku/intents/{slug}/` | Out of intent scope; I/O overhead; normal development activity |
