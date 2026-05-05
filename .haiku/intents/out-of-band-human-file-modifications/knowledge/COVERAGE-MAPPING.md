---
name: coverage-mapping
location: .haiku/intents/{intent-slug}/product/COVERAGE-MAPPING.md
scope: intent
format: text
required: true
---

# Coverage Mapping — Out-of-Band Human File Modifications

This is the validator-hat traceability matrix for the product stage. It enumerates every success criterion this intent must hit, anchors each criterion to its source (intent goal, design-stage unit completion criteria, or recorded design decision), and projects which acceptance-criteria (AC) item and behavioral-spec / data-contract item the sibling product artifacts MUST cover to close it. It also flags scope creep — i.e., AC/spec dimensions the design stage did not authorize but which a sibling discovery artifact might add — and documents the validation outcome.

The matrix below is intentionally exhaustive on the criterion side and intentionally projected (not yet observed) on the AC/spec side: this artifact is authored in parallel with `ACCEPTANCE-CRITERIA.md`, `BEHAVIORAL-SPEC.md`, and `DATA-CONTRACTS.md`. The product validator will compare this matrix against the actual sibling content on the next workflow tick (the merge-back tick) and convert any "PROJECTED" entry that has no corresponding sibling content into a hard gap.

## How to read this document

- **SC-N** rows = success criteria. Each row is a numbered, atomic, individually testable statement of what "done" looks like for the intent.
- **AC-N** identifiers = acceptance-criteria items the sibling `ACCEPTANCE-CRITERIA.md` MUST contain. The validator-hat tick after parallel-discovery merge cross-checks these projections against the sibling's actual contents.
- **BSPEC-N** identifiers = behavioral-spec scenarios (`.feature` file scenarios) the sibling `BEHAVIORAL-SPEC.md` MUST contain.
- **DC-N** identifiers = data-contract entries the sibling `DATA-CONTRACTS.md` MUST contain.
- **DEC-N** = recorded design decision from `knowledge/DESIGN-DECISIONS.md` (numbered to match Decision 1–9 there).
- **DESN-N** = a design-stage unit completion criterion (from `unit-01..unit-06` design unit specs).
- **Source** column cites the upstream document and section that authorizes the criterion.
- **Responsible hat** column indicates which product-stage hat (`product`, `specification`, or `validator`) is accountable for closing the gap if no sibling AC or spec item maps to the criterion.

The matrix is grouped by capability domain so reviewers and downstream hats can scan a coherent slice rather than a flat 60-row table.

---

## 1. Sources of success criteria

The following upstream documents contributed success criteria to this matrix. If a future validator-tick sees a criterion in the wild that does not derive from one of these sources, it is scope creep and gets flagged in §6.

1. **Intent goal** — `.haiku/intents/out-of-band-human-file-modifications/intent.md` (the body text of the intent, which establishes the three motivating change types and the scope boundary).
2. **Inception DISCOVERY.md** §"Success criteria" — five functional bullets and four outcome-based bullets.
3. **Inception DESIGN-DECISIONS.md** — Decisions 1–9, plus the "Open for Design" list. The chosen path of each decision becomes a constraint that downstream AC/spec must honor.
4. **Design unit-01 ARCHITECTURE.md spec** — completion criteria covering baseline storage contract, pre-tick gate, `manual_change_assessment` action, four classification outcomes, baseline-update contract, author-class tracking, classification-record durability, ambiguous-diff fallback, concurrency, failure modes, kill-switch.
5. **Design unit-02 MCP-TOOL-CONTRACT.md spec** — completion criteria covering tool name, input/output, write semantics, path constraints, integrity stance, audit trail, error contracts, SPA-upload distinction.
6. **Design unit-03 TRACKED-SURFACE-BOUNDARY.md spec** — completion criteria covering in-scope paths, out-of-scope paths, per-stage flexibility, first-tick behavior, new-file detection, file-deletion detection, binary handling, naming reconciliation (`outputs/` vs `artifacts/`).
7. **Design unit-04 SPA-UI-SPECS.md spec** — completion criteria covering passive-observer constraint, three new SPA surfaces, ARIA, contrast, tokens, responsive behavior.
8. **Design unit-05 ROLLOUT-AND-BASELINE-ESTABLISHMENT.md spec** — completion criteria covering establish-mode, kill-switch, telemetry, reset semantics, per-stage isolation.
9. **Design unit-06 ROLLOUT-CHIP-SELF-CONTAINED.md spec** — establish-mode chip deferral; affects AC scope (no SPA-UI dependency for the chip in v1).
10. **Sibling boundary**: cross-cutting integration with the existing pre-tick feedback-triage gate is bounded to the workflow-engine artifact (sibling) and is referenced here only in coverage rows that depend on the gate ordering.

---

## 2. Coverage matrix — Detection (implicit + explicit)

This domain covers Decision 1 (detection model) and the architecture's pre-tick drift gate.

| ID | Success criterion | Source | Projected AC | Projected BSPEC | Projected DC | Responsible hat |
|---|---|---|---|---|---|---|
| SC-1.1 | The pre-tick drift gate fires after tamper-detection and feedback-triage but before per-state dispatch on every `haiku_run_next` tick. | DESN-01 (architecture spec) §"Pre-tick drift-detection gate" | AC-1.1 ("On any `haiku_run_next` tick, drift detection runs after tamper-detection and feedback-triage and before per-state dispatch") | BSPEC-1.1 ("Tick gate ordering" feature; scenario: agent makes no changes → tamper, triage, drift gates all execute in declared order) | DC-1.1 (gate-order entry naming the four gates and their ordering as a documented contract) | product, specification |
| SC-1.2 | The gate computes a SHA per tracked file and compares it against the stored baseline; matched SHAs do not fire any event. | DESN-01 §"Pre-tick drift-detection gate"; DEC-1 | AC-1.2 ("If no tracked file has changed SHA since the last baseline write, the gate emits zero drift events and the tick proceeds normally") | BSPEC-1.2 ("Steady-state tick" scenario: zero drift events; tick handler runs the next workflow action) | — | specification |
| SC-1.3 | The gate detects modifications to existing tracked files and emits a `change_type: modified` drift event with the file path, prior SHA, current SHA, author-class hint, and (for text files) a unified diff. | DESN-01 §"Pre-tick drift-detection gate"; DESN-03 §"new-file/deletion behavior"; DEC-1 | AC-1.3 ("When a tracked text file's SHA changes between ticks, the next tick observes a drift event with `change_type: modified`, the path, prior SHA, current SHA, author-class, and a unified diff") | BSPEC-1.3 ("Designer replaces hero-mockup.html via filesystem cp" scenario from intent's three motivating examples) | DC-1.2 (drift-event schema: `path`, `change_type`, `prior_sha`, `current_sha`, `author_class`, `diff`, `mime`, `size_bytes`) | specification |
| SC-1.4 | New files appearing in a tracked path that have no baseline are emitted as `change_type: added`, classified as `human-implicit` author-class, and routed to `manual_change_assessment`. | DESN-03 §"new-file detection" | AC-1.4 ("A previously-unseen file appearing in a tracked path triggers a drift event with `change_type: added` and the agent classifies whether to integrate it") | BSPEC-1.4 ("User drops `brand-guide.pdf` into `knowledge/` between ticks" scenario from intent's third motivating example) | DC-1.3 (drift-event variant for `change_type: added`: `prior_sha` is null, `diff` is null, `mime` and `size_bytes` are populated) | specification |
| SC-1.5 | A previously-baselined file that disappears emits `change_type: deleted`, and the agent's classification step decides whether to restore from baseline or accept the deletion. | DESN-03 §"file-deletion behavior" | AC-1.5 ("When a baselined file is deleted, the next tick observes a drift event with `change_type: deleted` and the agent classifies the outcome") | BSPEC-1.5 ("PO accidentally deletes a feedback-rejected screenshot" scenario; agent classification surfaces as feedback) | DC-1.4 (drift-event variant for `change_type: deleted`: `current_sha` is null, `diff` is null, `prior_sha` is populated) | specification |
| SC-1.6 | Binary files (extensions matching the studio binary list — `.png`, `.jpg`, `.figma`, `.pdf`, etc.) are baselined by SHA only, and the drift event payload contains `size_bytes` + `mime` + SHA but no diff. | DESN-03 §"binary file handling" | AC-1.6 ("For binary files, the drift event contains size and mime but no diff payload; the agent classifies based on author-class + size delta + mime change") | BSPEC-1.6 ("Designer replaces a 4MB figma export with a 6MB figma export" scenario; agent receives size delta and mime, not diff) | DC-1.5 (drift-event for binary files: explicit `diff: null` + `is_binary: true` discriminator field) | specification |
| SC-1.7 | The gate is a no-op (does not compute SHAs, does not emit drift events) when the plugin-settings flag `drift_detection: false` is set. | DESN-01 §"Kill-switch integration"; DESN-05 §"Failure-mode rollback" | AC-1.7 ("When `drift_detection: false` is set in plugin settings, the gate is a no-op and the tick proceeds without drift work") | BSPEC-1.7 ("Operator disables drift detection mid-incident" scenario; gate no-ops, ticks resume) | DC-1.6 (plugin-settings field `drift_detection: boolean` with default `true`) | specification |
| SC-1.8 | First-tick-after-upgrade behavior establishes baselines without firing drift events; subsequent ticks fire drift events normally. | DESN-05 §"First-tick-after-upgrade behavior"; DEC §"Baseline establishment on upgrade" | AC-1.8 ("On the first tick of an intent that pre-dates the feature, the gate writes baselines and emits zero drift events") | BSPEC-1.8 ("Existing intent on first tick after upgrade" scenario; baselines written, no `manual_change_assessment` queued) | DC-1.7 (per-stage state field `drift_baseline_established_at: timestamp \| null`) | specification |
| SC-1.9 | New stages added to an existing intent post-upgrade re-establish baseline only for that stage's tracked paths; cross-stage isolation. | DESN-05 §"Per-stage establish triggers" | AC-1.9 ("When a new stage joins an active intent, that stage's first tick establishes its own baseline without affecting other stages' baselines") | BSPEC-1.9 ("Composite intent gains a new design stage mid-flight" scenario) | — | specification |

**Domain coverage gaps flagged in §6:** none expected (every detection-domain criterion has a projected AC and BSPEC). Validator confirms during merge tick.

---

## 3. Coverage matrix — Classification & response

This domain covers Decision 3 (reaction mechanism), Decision 5 (cascade policy), and the four classification outcomes from architecture.

| ID | Success criterion | Source | Projected AC | Projected BSPEC | Projected DC | Responsible hat |
|---|---|---|---|---|---|---|
| SC-2.1 | When ≥ 1 drift events are emitted on a tick, the workflow engine emits a `manual_change_assessment` action whose payload is the list of drift events. | DESN-01 §"`manual_change_assessment` workflow action" | AC-2.1 ("When the gate emits one or more drift events, the next tick handler is `manual_change_assessment` with the events in payload") | BSPEC-2.1 ("Drift cascades into `manual_change_assessment`" scenario; chained from BSPEC-1.3 / 1.4 / 1.5 / 1.6) | DC-2.1 (`manual_change_assessment` action shape: input `{ drift_events: DriftEvent[] }`, output `{ classifications: Classification[] }`) | product, specification |
| SC-2.2 | The agent's classification of a drift event is one of `ignore`, `inline-fix`, `surface-as-feedback`, `trigger-revisit`. | DESN-01 §"Classification outcome semantics" | AC-2.2 ("The agent's classification of every drift event is exactly one of the four named outcomes") | BSPEC-2.2 ("Classification of a typo correction" → `inline-fix`; "Classification of a hostile redirect" → `trigger-revisit`; "Classification of a noise file" → `ignore`; "Classification of an ambiguous binary swap" → `surface-as-feedback`) | DC-2.2 (`Classification` type: `{ event_id: string, outcome: 'ignore' \| 'inline-fix' \| 'surface-as-feedback' \| 'trigger-revisit', rationale: string, baseline_action: 'update' \| 'pending' }`) | product, specification |
| SC-2.3 | Outcome `ignore` updates the baseline immediately to the current SHA and produces no other side effects. | DESN-01 §"Classification outcome semantics" — `ignore` row | AC-2.3 ("`ignore` classification updates baseline to current SHA and writes no feedback or unit") | BSPEC-2.3 ("PO renames a draft screenshot to lowercase; agent classifies as `ignore`; baseline updated, no FB raised") | — | product, specification |
| SC-2.4 | Outcome `inline-fix` writes corrective work into the next bolt of the active stage's current unit; baseline updates immediately. | DESN-01 §"Classification outcome semantics" — `inline-fix` row | AC-2.4 ("`inline-fix` classification spawns corrective bolt work on the active unit; baseline updates to current SHA") | BSPEC-2.4 ("PO edits a sentence in the unit's current artifact; agent classifies as `inline-fix`; next bolt extends the human's edit") | — | product, specification |
| SC-2.5 | Outcome `surface-as-feedback` opens a feedback file in the active stage's `feedback/` directory with the drift summary, the diff, the responsible hat hint, and a link to the changed file; baseline writes a "pending-assessment" marker until the FB closes. | DESN-01 §"Classification outcome semantics" — `surface-as-feedback` row + §"Baseline-update contract"; DEC-3 | AC-2.5 ("`surface-as-feedback` opens a feedback item; baseline holds `pending-assessment` until the FB closes; on FB close the baseline updates to the resolved SHA") | BSPEC-2.5 ("Designer replaces a layout the agent doesn't understand; agent classifies as `surface-as-feedback`; FB created with diff in body; baseline pending until FB closes") | DC-2.3 (feedback file frontmatter extension: `origin: 'manual-change-assessment'`, `drift_event_id: string`) | product, specification |
| SC-2.6 | Outcome `trigger-revisit` calls `revisit()` against the upstream stage that owns the changed file; baseline holds `pending-assessment` until the revisit completes. | DESN-01 §"Classification outcome semantics" — `trigger-revisit` row + DEC-5 | AC-2.6 ("`trigger-revisit` invokes the existing `haiku_revisit` mechanism on the upstream stage; the active stage transitions to `awaiting-revisit-resolution` until the revisit completes") | BSPEC-2.6 ("Designer drops a complete redesign onto a design-stage artifact while product stage is active; agent classifies as `trigger-revisit`; product stage pauses; design re-enters") | — | product, specification |
| SC-2.7 | Cross-stage drift (file owned by an earlier stage than active) is not auto-resolved by the harness; the agent classifies and decides whether to revisit. | DEC-5 | AC-2.7 ("Drift on a file owned by a stage earlier than the active stage routes through the same four-outcome classifier; the harness does not auto-trigger revisit") | BSPEC-2.7 ("Cross-stage drift on inception knowledge while design is active" scenario; agent picks one of four outcomes) | — | product, specification |
| SC-2.8 | Ambiguous diffs default to `surface-as-feedback` with a `cannot-determine-intent` reason code; this is not a fifth outcome but a labeled fallback within `surface-as-feedback`. | DESN-01 §"Ambiguous-diff fallback behavior" | AC-2.8 ("When the agent cannot confidently classify a diff (binary swap, large-scale restructure), the outcome is `surface-as-feedback` with `reason_code: 'cannot-determine-intent'`") | BSPEC-2.8 ("Binary swap of the same mime and similar size; agent classifies as `surface-as-feedback` with the `cannot-determine-intent` code") | DC-2.4 (FB frontmatter extension: `reason_code?: 'cannot-determine-intent' \| ...`) | specification |
| SC-2.9 | The agent's classification record is durable across branch operations and `/haiku:revisit` flows. | DESN-01 §"Classification-record durability and location" | AC-2.9 ("After `git checkout` between stage branches, the classification record for any prior drift event is still readable") | BSPEC-2.9 ("Branch switch then re-read classification" scenario) | DC-2.5 (classification-record location chosen by ARCHITECTURE.md; product stage records the contract reference, not the specific path) | specification |
| SC-2.10 | The `manual_change_assessment` action is skipped (alongside the gate) when the kill-switch is set. | DESN-05 §"Failure-mode rollback" | AC-2.10 ("When `drift_detection: false`, no `manual_change_assessment` actions are queued or processed") | BSPEC-2.10 (covered by BSPEC-1.7 — single scenario asserts both gate and action no-op) | — | specification |

**Domain coverage gaps flagged in §6:** none expected; the four-outcome model + ambiguous-diff fallback + cross-stage cascade are fully represented.

---

## 4. Coverage matrix — Write paths (UX surfaces)

This domain covers Decision 7 (UX surface composition), Decision 9 (human-write-path integrity), and the design-stage unit-02 (MCP tool contract) and unit-04 (SPA UI specs).

| ID | Success criterion | Source | Projected AC | Projected BSPEC | Projected DC | Responsible hat |
|---|---|---|---|---|---|---|
| SC-3.1 | A designer can replace a stage output file directly in the worktree filesystem and the next tick acknowledges the change rather than silently regenerating over it. | Intent goal §"Functional"; DEC-7 | AC-3.1 ("When a stage-output file is replaced via filesystem write, the next tick observes drift, classifies it, and acknowledges via the chosen outcome") | BSPEC-3.1 ("Designer replaces a layout via `cp`" — chains BSPEC-1.3 → BSPEC-2.4) | — | product |
| SC-3.2 | A PO can hand-edit a unit-output file or stage-output file and ask the agent to extend or refine it; the agent treats the human's edit as the new baseline. | Intent goal §"Functional" | AC-3.2 ("After a human-attributed edit, agent invocations that build on the file consume the post-edit content, not the pre-edit content") | BSPEC-3.2 ("PO edits a paragraph in a stage-output html, asks 'extend this'") | — | product, specification |
| SC-3.3 | A user can drop a knowledge file into a stage's knowledge directory (filesystem) without touching chat, and the agent picks it up on the next tick and integrates it. | Intent goal §"Functional"; DEC-1 | AC-3.3 ("Files dropped into `stages/{stage}/knowledge/` between ticks are observed as drift, classified as `inline-fix` (or `surface-as-feedback` if integration is non-obvious), and incorporated into the next bolt") | BSPEC-3.3 ("User drops `competitor-screenshot.png` into `stages/inception/knowledge/`") | — | product |
| SC-3.4 | A user can drop a knowledge file via the SPA upload UI and the file lands at the selected destination, stamped `human-via-mcp` author-class. | DESN-04 §"Knowledge Upload Panel" | AC-3.4 ("Files uploaded via the SPA `KnowledgeUploadPanel` are written to disk at the selected destination and the resulting baseline-stamp records `author-class: human-via-mcp`") | BSPEC-3.4 ("User clicks `Upload N files` in the SPA panel; files land at `knowledge/`; baseline stamps `human-via-mcp`") | DC-3.1 (`POST /api/knowledge-upload` endpoint: multipart form-data, `destination: 'intent' \| 'stage:{slug}'`, returns `{ baseline_stamps: BaselineStamp[] }`) | product, specification |
| SC-3.5 | A user can replace a stage output file via the SPA's "Replace this output…" dialog; the file lands at the original artifact path with mime-matching enforcement; the resulting baseline stamps `human-via-mcp`. | DESN-04 §"Stage Output Replacement Affordance" | AC-3.5 ("The Replace dialog accepts a file matching the original mime (with explicit override), writes it at the original path, stamps `human-via-mcp`, and emits the WS frame `output_replaced`") | BSPEC-3.5 ("Designer opens output card menu, picks `Replace this output…`, drops new HTML, clicks Replace; baseline stamps `human-via-mcp`; card refreshes") | DC-3.2 (`POST /api/stage-output-replace` endpoint: multipart, `intent`, `stage`, `artifact_path`, `note?`, `override_mime?: boolean`, returns `{ baseline_stamp: BaselineStamp, output_path: string }`) | product, specification |
| SC-3.6 | A user can ask the agent in chat ("hey claude, write this file") and the agent invokes the human-attributed-write MCP tool; the resulting baseline records `author-class: human-via-mcp`. | DEC-7; DESN-02 | AC-3.6 ("When the agent invokes the human-write MCP tool with a path inside the tracked surface and a content payload, the file is written and the baseline stamps `human-via-mcp`; the next tick's gate sees no drift on this file") | BSPEC-3.6 ("User says 'save this Tailwind config to design references'; agent invokes human-write tool; tick observes no drift") | DC-3.3 (MCP tool input: `{ path: string, content: string \| { base64: string }, human_author_id?: string, rationale?: string }`; output: `{ baseline_stamp: BaselineStamp, created_dirs: string[] }`) | specification |
| SC-3.7 | The human-write MCP tool refuses to write into workflow-managed-file zones (`units/*.md`, `feedback/*.md`, `intent.md`, `state.json`) with error `path_outside_tracked_surface`. | DESN-02 §"Path constraints" | AC-3.7 ("Calls to the human-write tool targeting `intent.md`, any `units/*.md`, any `feedback/*.md`, or any `state.json` return error code `path_outside_tracked_surface`") | BSPEC-3.7 (deny-list test scenarios — one per workflow-managed-file zone, ≥4 scenarios) | DC-3.4 (error contract enum: `path_outside_tracked_surface`, `rationale_required`, `baseline_conflict`) | specification |
| SC-3.8 | Every invocation of the human-write MCP tool appends a record (who, what, when, why) to the per-intent audit log; the audit log is human-readable and append-only. | DESN-02 §"Audit trail" | AC-3.8 ("After a successful or denied human-write call, the audit log gains exactly one new entry with `actor`, `path`, `timestamp`, `rationale`, and `outcome`") | BSPEC-3.8 ("Five sequential human-writes produce five audit-log entries in chronological order with no gaps") | DC-3.5 (audit log entry: `{ actor: string, path: string, timestamp: string, rationale: string \| null, outcome: 'written' \| 'denied:{code}' }`) | specification |
| SC-3.9 | SPA uploads (knowledge or output replacement) also append audit-log entries with the SPA endpoint as the actor source. | DESN-02 §"Integration with the SPA upload pathway" | AC-3.9 ("Audit-log entries from SPA uploads carry `actor: 'spa:{user_id}'` (or `spa:anonymous` if no auth)") | BSPEC-3.9 ("SPA upload + filesystem drop both appear in the same audit log with distinct actor prefixes") | DC-3.6 (audit-log `actor` discriminator: `mcp:{conversation_id}`, `spa:{user_id}`, `filesystem:implicit`) | specification |
| SC-3.10 | The decision between integrity stances (Trust+Audit vs. Explicit Confirmation, per Decision 9) is recorded in MCP-TOOL-CONTRACT.md and inherited by AC. (Per design unit-02 the chosen stance is **Trust+Audit** in v1.) | DEC-9; DESN-02 §"Integrity stance" | AC-3.10 ("The human-write MCP tool requires no explicit confirmation round-trip in v1; integrity is enforced via audit trail and conversational discipline") | BSPEC-3.10 ("Agent invokes the tool without a separate confirmation round-trip; the call succeeds and the audit log is the only record of human attribution") | — | product |

**Domain coverage gaps flagged in §6:** none expected; all three motivating change types and both UI surfaces are covered. The integrity stance from Decision 9 is captured (SC-3.10) so AC writers know which side of the open question they're implementing.

---

## 5. Coverage matrix — Tracked surface, baseline, and rollout

This domain covers Decisions 4, 8, and design units 03 (tracked-surface boundary) and 05 (rollout).

| ID | Success criterion | Source | Projected AC | Projected BSPEC | Projected DC | Responsible hat |
|---|---|---|---|---|---|---|
| SC-4.1 | The tracked surface includes intent-scope `knowledge/`, every `stages/{stage}/knowledge/`, every `stages/{stage}/artifacts/`, and every `stages/{stage}/discovery/`. | DESN-03 §"In-scope" | AC-4.1 ("Files in any of the four in-scope path categories are baselined and drift-checked") | BSPEC-4.1 ("Edit one file in each category and verify drift fires") | DC-4.1 (in-scope path glob list: `knowledge/**`, `stages/{stage}/knowledge/**`, `stages/{stage}/artifacts/**`, `stages/{stage}/discovery/**`) | specification |
| SC-4.2 | The tracked surface excludes `units/*.md`, `feedback/*.md`, `intent.md`, `stages/{stage}/state.json`, `decision_log.json`, `audit/**`, `.git/**`, `.haiku/worktrees/**`, and any path outside `.haiku/intents/{slug}/`. | DESN-03 §"Out-of-scope" | AC-4.2 ("Files in any of the out-of-scope path categories are NOT baselined and edits to them do not fire drift events") | BSPEC-4.2 ("Edit a file in each excluded category and verify no drift fires") | DC-4.2 (out-of-scope path glob list with rationale tags: `workflow-managed`, `audit-only`, `infrastructure`, `outside-intent`) | specification |
| SC-4.3 | A studio's STAGE.md MAY declare additional `tracked_paths:` patterns to extend the default tracked surface for that stage. | DESN-03 §"Per-stage flexibility" | AC-4.3 ("If a STAGE.md frontmatter declares additional `tracked_paths:` glob patterns, those files are added to the tracked surface for that stage") | BSPEC-4.3 ("Custom studio adds `stages/foo/figma-files/**`; verify drift fires on file there") | DC-4.3 (STAGE.md frontmatter field `tracked_paths?: string[]`) | specification |
| SC-4.4 | The naming alias `outputs/` → `artifacts/` is honored: any reference to `stages/{stage}/outputs/` in upstream design docs maps to `stages/{stage}/artifacts/` in implementation. | DESN-03 §"Path-naming reconciliation" | AC-4.4 ("Anywhere upstream docs say `outputs/`, the tracked surface and the SPA UI both use `artifacts/`; no `outputs/` directory is created on disk") | BSPEC-4.4 ("UI references in `outputs/` mode are equivalent to `artifacts/` paths in disk operations") | — | product |
| SC-4.5 | Per-stage SHA baselines are stored at a location that survives `git checkout` between stage branches and `/haiku:revisit`-driven branch reuse. | DESN-01 §"Baseline storage layer" | AC-4.5 ("After `git checkout {other-stage-branch}` and back, the baseline for the original stage is still readable and consistent") | BSPEC-4.5 ("Branch-switch round-trip preserves baselines") | DC-4.4 (baseline storage location chosen by ARCHITECTURE.md; product stage ratifies the contract: `BaselineStore` interface with `read(stage)`, `write(stage, path, sha, author_class, tick)`, `prune(stage)`) | specification |
| SC-4.6 | Each baseline entry records: tracked-file-path, content-hash (SHA), author-class (`agent` \| `human-via-mcp` \| `human-implicit`), last-updated-tick. | DESN-01 §"Baseline storage layer" | AC-4.6 ("Every baseline entry has all four fields populated; missing or empty fields are treated as integrity violations") | BSPEC-4.6 ("Read baseline for any tracked file; verify all four fields present") | DC-4.5 (`BaselineStamp` shape: `{ path: string, sha: string, author_class: 'agent' \| 'human-via-mcp' \| 'human-implicit', last_updated_tick: number }`) | specification |
| SC-4.7 | The first tick of an intent that pre-dates the feature establishes baselines without firing drift; subsequent ticks fire drift normally. | DESN-05 §"First-tick-after-upgrade behavior" | AC-4.7 ("On a brand-new tick where `drift_baseline_established_at` is null for the active stage, the gate writes baselines and emits zero drift events; on the next tick `drift_baseline_established_at` is populated and drift fires normally") | BSPEC-4.7 (covered by BSPEC-1.8) | DC-4.6 (per-stage state.json field `drift_baseline_established_at: string \| null`) | specification |
| SC-4.8 | Baseline backfill defaults `author-class: agent` for files that pre-date the feature (false-negative acceptable, false-positive not). | DESN-05 §"Author-class backfill" | AC-4.8 ("In establish mode, every file's baseline is written with `author_class: 'agent'`; subsequent edits flip to `human-implicit` if there's no human-via-mcp stamp") | BSPEC-4.8 ("Existing intent on first tick — every baseline says `agent`; second tick after an edit — flips to `human-implicit`") | — | specification |
| SC-4.9 | `/haiku:reset` and similar destructive operations clear the baseline along with everything else; the next tick re-establishes. | DESN-05 §"Reset semantics" | AC-4.9 ("After `/haiku:reset`, the next tick re-runs establish mode and emits zero drift events") | BSPEC-4.9 ("Reset → next tick → establish mode → no drift") | — | specification |
| SC-4.10 | A `drift_detection: false` plugin-settings flag disables both the gate and the `manual_change_assessment` action; re-enabling does NOT auto-re-establish (post-disable edits become drift). | DESN-05 §"Failure-mode rollback" | AC-4.10 ("Toggling the flag false disables drift work; toggling back true does not re-establish baselines; edits during the disabled window become drift events on the next tick after re-enable") | BSPEC-4.10 ("Disable → edit while disabled → re-enable → next tick fires drift on the edit") | DC-4.7 (covered by DC-1.6) | specification |
| SC-4.11 | Telemetry emits ≥5 named events: `baseline-established`, `drift-detected`, `classification-emitted`, `baseline-updated`, `kill-switch-toggled`. Format: structured log entries; no separate telemetry pipeline. | DESN-05 §"Telemetry" | AC-4.11 ("Each named event appears in the structured log on the relevant tick; entries include event name, timestamp, intent slug, stage, and event-specific payload") | BSPEC-4.11 ("All 5 telemetry events fire across a designed sequence of ticks") | DC-4.8 (telemetry event-name enum + per-event payload schema) | specification |
| SC-4.12 | Concurrency model is eventual consistency: no locks, no version tokens, no real-time merging. Mid-bolt human edits result in next-tick reconciliation; mid-bolt agent work may be partially based on the pre-edit version (acknowledged condition). | DEC-4; DESN-01 §"Concurrency model" | AC-4.12 ("Concurrent agent + human writes do not block; the next tick observes the resulting state and the agent's classification handles the reconciliation") | BSPEC-4.12 ("Mid-bolt human edit during agent work — the agent's bolt completes, the next tick observes the human edit as drift, the classification routes appropriately") | — | product |
| SC-4.13 | Failure modes: missing baseline → first-tick establish; corrupt baseline → refuse to advance, escalate; out-of-sync baseline → re-baseline as `drift-detected` event with `trigger-revisit` default. | DESN-01 §"Failure modes" | AC-4.13 ("Each failure mode is detected and handled per the documented stance — missing → establish; corrupt → halt + escalate; out-of-sync → drift event with `trigger-revisit` default") | BSPEC-4.13 ("Three failure-mode scenarios with the documented response") | DC-4.9 (`BaselineIntegrity` enum: `ok`, `missing`, `corrupt`, `out-of-sync`) | specification |

**Domain coverage gaps flagged in §6:** none expected; the tracked-surface, baseline-storage, and rollout-mechanics criteria are fully covered.

---

## 6. Coverage matrix — User-visible signals (SPA UI)

This domain covers Decision 7 (UX surface composition) and design unit-04 (SPA UI specs), plus design unit-06 (establish-mode chip self-contained deferral).

| ID | Success criterion | Source | Projected AC | Projected BSPEC | Projected DC | Responsible hat |
|---|---|---|---|---|---|---|
| SC-5.1 | The drift-detected indicator strip renders between `StageBanner` and `RereviewBanner` ONLY when the pre-tick gate has observed drift but `manual_change_assessment` has not yet run on the next tick. | DESN-04 §"Drift-Detected Indicator" | AC-5.1 ("When the WS feed sets `drift_detected: true` on the active stage's state and the next tick is pending, the strip is visible; once the tick fires, the strip unmounts") | BSPEC-5.1 ("WS frame `drift_detected:true` arrives — strip mounts; WS frame `tick_complete` arrives — strip unmounts") | DC-5.1 (WS frame `drift_state`: `{ stage: string, drift_detected: boolean, drift_count: number, files: string[] }`) | product, specification |
| SC-5.2 | The drift-detected indicator is passive — it carries NO "Run now", "Assess", "Accept", "Surface", or "Ignore" buttons. The agent classifies on the next tick. | DESN-04 §"Drift-Detected Indicator" + §"Conflict-resolution precedence #1"; DEC §"Direction A" | AC-5.2 ("The drift indicator strip contains no controls that trigger classification; the only controls are an information disclosure and the artifact-card links") | BSPEC-5.2 ("UI test: indicator visible, no buttons present beyond information links") | — | product |
| SC-5.3 | Per-card drift state is conveyed by both color (token-based border) AND a non-color signal (icon-with-label or text badge) on every artifact card affected by drift. WCAG 1.4.1. | DESN-04 §"Stage Output Replacement Affordance — States on the card itself" | AC-5.3 ("For every drift state — `drift-detected`, `drift-acknowledged`, `drift-surfaced`, `drift-revisit` — the card has both a colored left-border accent and a labelled icon or text badge announcing the state") | BSPEC-5.3 ("Visual + a11y test for each of the four drift-state cards") | — | product |
| SC-5.4 | All four drift-state colors come from the canonical token set in `DESIGN-TOKENS.md`: `--color-drift-detected-fg/bg`, `--color-drift-acknowledged-fg/bg`, `--color-drift-surfaced-fg/bg`, `--color-drift-revisit-fg/bg`. NO raw Tailwind palette classes (`bg-amber-N`, etc.) appear in semantic surfaces. | DESN-04 §"Conflict-resolution precedence #2 and #3" + Cross-cutting requirements | AC-5.4 ("Drift surfaces reference only canonical drift-state tokens; raw palette classes are absent") | — (verifiable by lint, not by behavior) | DC-5.2 (canonical drift-state token names; reference to `DESIGN-TOKENS.md` four-state taxonomy) | product |
| SC-5.5 | The Knowledge Upload Panel collapses to a single button on `≤375px` that opens the existing `FeedbackSheet`; drag-drop is not present on touch devices; click-to-browse is the universal path. | DESN-04 §"Responsive behavior" | AC-5.5 ("On `≤375px` viewport, the panel renders as a single full-width button and no drag-drop affordance exists; tapping opens the file picker") | BSPEC-5.5 ("375px viewport simulation: drag-drop absent, button present, file picker opens on tap") | — | product |
| SC-5.6 | The drop-zone component carries `role="button"`, `tabIndex={0}`, and `aria-label="Upload knowledge file"` (exact string per design spec authoritative). | DESN-04 §"ARIA requirements" | AC-5.6 ("The knowledge upload drop zone exposes the exact ARIA contract specified by SPA-UI-SPECS.md §1.4") | BSPEC-5.6 ("Screen-reader test: drop zone announces 'Upload knowledge file, button'") | — | product |
| SC-5.7 | The output-card `⋯` menu trigger carries `aria-label="More options for {artifact-name}"` interpolated per card. | DESN-04 §"Stage Output Replacement Affordance — ARIA" | AC-5.7 ("The output-card menu trigger announces with the per-card artifact name interpolated into the ARIA label") | BSPEC-5.7 ("Screen-reader test: each output card menu announces with the file name") | — | product |
| SC-5.8 | The drift-indicator strip is announced via `role="status"` and `aria-live="polite"` and persists an empty live region when it disappears (no abrupt focus loss). | DESN-04 §"Drift-Detected Indicator — ARIA" | AC-5.8 ("Drift strip mount is announced; unmount leaves an empty `role=status` region in the DOM") | BSPEC-5.8 ("Screen-reader test: drift announcement appears on mount, unmount does not steal focus") | — | product |
| SC-5.9 | A WCAG AA contrast table is present in `SPA-UI-SPECS.md` covering every new token pair used in the new surfaces (foreground / background / ratio / pass-vs-AA-threshold) — minimum one row per drift state × text color, plus the upload affordance. | DESN-04 §"Cross-cutting requirements — WCAG AA contrast verification" | AC-5.9 ("The product stage's user-visible-state acceptance verifies the spec table is present and every row passes AA") | — (verifiable by inspection of the design spec, not by runtime behavior) | — | validator |
| SC-5.10 | Touch targets are ≥ 44×44 on `≤768px` for every new interactive element (drop zone, staged-row remove, destination select, output-card `⋯`, dialog buttons, drift-indicator disclosure). | DESN-04 §"Cross-cutting requirements — Touch targets" | AC-5.10 ("Each new interactive element has a hit area ≥44px×44px on a 375px viewport") | BSPEC-5.10 ("Touch-target lint per element on mobile breakpoint") | — | specification |
| SC-5.11 | Reduced-motion preference suppresses non-essential animation: drag-over scale, banner mount/unmount fade, modal slide-up, and "Run now" spinner (where applicable). Progress bars still render (state, not decoration). | DESN-04 §"Cross-cutting requirements — Reduced-motion" | AC-5.11 ("With `prefers-reduced-motion: reduce`, decorative animations are absent; state-conveying indicators (progress) still render") | BSPEC-5.11 ("`prefers-reduced-motion` media-query test for each animated affordance") | — | specification |
| SC-5.12 | The establish-mode chip styling is intentionally deferred to the development stage's design-system pass; the indicator is a text label in a neutral container with no interactive affordance. ARIA and contrast are determined when the chip is implemented. | DESN-06 (establish-mode chip self-contained deferral); DESN-05 §"Establish-mode visibility" | AC-5.12 ("In v1 the establish-mode indicator is a text label with no interactive controls; full styling and ARIA are out of scope for product-stage AC") | — (no runtime AC; deferral is documented contract) | — | product |
| SC-5.13 | The drift-indicator strip auto-disappears once the assessment completes; the per-file outcome is reflected in the artifact-card border accent + non-color badge. | DESN-04 §"Drift-Detected Indicator — Auto-disappears" | AC-5.13 ("After a tick that classifies all open drift events, the strip unmounts and the affected cards reflect their new drift state") | BSPEC-5.13 (covered by BSPEC-5.1) | — | product |
| SC-5.14 | The replacement modal's mime-mismatch path requires explicit user confirmation (no silent override); on confirm, the note pre-fills with "Type changed: {old-mime} → {new-mime}" so the agent has explicit context. | DESN-04 §"Stage Output Replacement Affordance — Mime-mismatch handling" | AC-5.14 ("Mime mismatch shows a one-line warning with a confirm checkbox or override dropdown; on confirm, the note textarea pre-fills with the type-change context") | BSPEC-5.14 ("Drop a `.png` into a `.html` slot; verify warning, confirmation, and pre-fill") | — | product, specification |

**Domain coverage gaps flagged in §6:**

- **Pre-flagged (informational, not blocking):** SC-5.4 and SC-5.9 are mostly spec-side checks (no runtime BSPEC). They are still tracked in AC because the AC author MUST encode the constraint as a deliverable check (e.g., "the design spec contains a contrast table"). The validator hat will confirm during merge tick.
- **Pre-flagged (informational, not blocking):** SC-5.12 has no runtime BSPEC because the establish-mode chip is deferred. AC ratifies the deferral; nothing else to test.

---

## 7. Coverage matrix — Cross-cutting & non-functional

| ID | Success criterion | Source | Projected AC | Projected BSPEC | Projected DC | Responsible hat |
|---|---|---|---|---|---|---|
| SC-6.1 | Sync surface is paper + plugin + website. The product stage's outputs MUST be implementable across all three components per the project sync discipline. | DEC-8 | AC-6.1 ("Every product-stage output (AC, BSPEC, DC) is consumable by paper updates, plugin code changes, and website docs without rework") | — | — | product, validator |
| SC-6.2 | The pre-tick drift gate is the third gate in the gate chain (after tamper, after triage, before per-state dispatch). The product stage acknowledges and does not contradict this ordering. | DESN-01 §"Pre-tick drift-detection gate"; covered by SC-1.1 | (covered by SC-1.1) | (covered by BSPEC-1.1) | (covered by DC-1.1) | specification |
| SC-6.3 | The product stage's outputs do not contradict any recorded design decision (DEC-1..DEC-9) and do not re-litigate them. | DESN §"This document records the architectural decisions reached…" header in DESIGN-DECISIONS.md | AC-6.3 ("Every AC is consistent with DEC-1..DEC-9; conflicts are escalated, not silently overridden") | — | — | validator |
| SC-6.4 | Eventual-consistency model is named and accepted in product-stage outputs; AC and BSPEC do not assume locks, version tokens, or real-time merging. | DEC-4 | AC-6.4 ("Concurrency expectations in AC do not require any locking or coordination primitives beyond the on-tick reconciliation") | (covered by BSPEC-4.12) | — | product |
| SC-6.5 | The cross-cutting boundary with the existing pre-tick feedback-triage gate is acknowledged but the substance lives in the workflow-engine sibling artifact (out of scope here). | Sibling boundary statement above | AC-6.5 ("Where AC depends on the gate ordering or feedback-triage interaction, it cites the workflow-engine sibling artifact as the source of substance") | — | — | product |
| SC-6.6 | The cross-cutting boundary with the workflow-managed-file PreToolUse hook is acknowledged: the hook continues to apply to agents only; humans are out-of-band by design (DEC-2). AC does not propose tightening the hook. | DEC-2 | AC-6.6 ("AC does not modify the existing PreToolUse hook contract; human-write paths are guarded by audit + author-class, not by the hook") | — | — | product |
| SC-6.7 | The product stage's outputs are testable. Every AC item has a concrete test path described (BSPEC scenario, DC schema validator, or visual/a11y inspection). No "best-effort" or "should approximately" language is used. | Validator hat anti-patterns + DESN-04 §"Quality Signals" | AC-6.7 ("Every AC carries a `test-path` annotation pointing to the BSPEC scenario, DC schema, or inspection step that proves it") | — | — | validator |
| SC-6.8 | The product stage covers the **outcome-based** intent goals: humans stop circumventing the framework; silent edit loss drops to zero on the tracked surface; non-technical collaborators (designers, POs) can work inside an active intent without learning MCP / hooks. | Intent goal §"Outcome-based" | AC-6.8 ("The product stage's outputs collectively address each of the three named outcomes; explicit AC traces back to each outcome bullet") | — | — | product |

---

## 8. Scope creep flags

The following items were considered and are explicitly **not authorized** for the product stage. If a sibling AC, BSPEC, or DC artifact contains them, the validator MUST surface them in §10 as scope creep (informational, not blocking — but they should be moved or deferred).

| ID | Scope-creep candidate | Rationale for exclusion | Where it belongs |
|---|---|---|---|
| SCREEP-1 | Real-time file watching / persistent file-watcher daemon | Decision 1 explicitly rejected real-time detection in favor of on-tick. | A future v2 only if the eventual-consistency window proves too long in practice. |
| SCREEP-2 | File locking, optimistic concurrency tokens, OT/CRDT merging | Decision 4 explicitly rejected all three; eventual consistency is canonical. | Out of scope. Any AC asserting locking/CAS/OT is a regression. |
| SCREEP-3 | "Run now ↻" or any classification-trigger button on the SPA drift indicator | Design unit-04 §"Conflict-resolution precedence #1" explicitly removes this from DESIGN-BRIEF.md. | The agent classifies on the next tick automatically. |
| SCREEP-4 | "Accept" / "Reject" / "Surface" / "Ignore" buttons that let the user override classification | Direction A (recorded design decision) is "discrete + autonomous classification — passive UI." | Out of scope; user can still author feedback through the existing FB channel if they disagree. |
| SCREEP-5 | A separate one-time migration script for existing intents | Design unit-05 §"Existing-intent migration" explicitly says no separate migration; establish-mode handles it. | Out of scope. AC asserting a migration script is a regression. |
| SCREEP-6 | Diff viewer / side-by-side preview inside the drift indicator | Design DESIGN-BRIEF.md §"Design Gaps" labels this Deferred. | Future v2 once a diff component lands. |
| SCREEP-7 | Multi-user concurrency UX beyond the dialog-level "someone else replaced this" banner | Design DESIGN-BRIEF.md §"Design Gaps" labels this Out of scope. | Future v2 if H·AI·K·U pivots to multi-user simultaneous workflows. |
| SCREEP-8 | Stage-baseline reset UI in the SPA | Design DESIGN-BRIEF.md §"Design Gaps" labels this Out of scope; CLI-only is acceptable for MVP. | Future v2; v1 is `/haiku:reset` only. |
| SCREEP-9 | Per-file size / type override beyond the existing 10 MB cap and mime override-on-confirm | Design DESIGN-BRIEF.md §"Design Gaps" labels this Deferred. | Future v2. |
| SCREEP-10 | Inline "explain why this changed" prompt for the agent on the drift banner | Design DESIGN-BRIEF.md §"Design Gaps" labels this Out of scope; the optional note in the Replace dialog covers this. | Out of scope. |
| SCREEP-11 | Drift detection on files outside `.haiku/intents/{slug}/` (source code, configs) | Design unit-03 §"Out-of-scope" excludes this; the framework boundary is the intent. | Out of scope. |
| SCREEP-12 | A fifth classification outcome (beyond ignore / inline-fix / surface-as-feedback / trigger-revisit) | Architecture explicitly enumerates four outcomes. The "ambiguous" path is a labelled fallback within `surface-as-feedback`, not a fifth path. | Out of scope. |
| SCREEP-13 | Hardening of the agent-impersonation attack vector beyond audit + conversational discipline (e.g., harness-level enforcement of "agent only invokes human-write when the human turn explicitly asks for it") | Decision 9 chose Trust+Audit for v1; harness-level enforcement is deferred. | Future v2; tracked in the Decision 9 follow-up. |
| SCREEP-14 | Telemetry pipeline beyond structured log entries | Design unit-05 §"Telemetry" explicitly says structured logs only — no separate pipeline. | Out of scope. |
| SCREEP-15 | Detection of writes to workflow-managed files (units, feedback, intent.md, state.json) by humans | Design unit-03 §"Out-of-scope" defers this to the existing tamper-detection gate; double-coverage is explicitly avoided. | Tamper-detection gate, not the drift gate. |

---

## 9. Gap flags (preliminary)

This section enumerates gaps the validator hat **expects** to find when comparing this matrix against the sibling AC / BSPEC / DC artifacts after their merge-tick. These are projections — the actual validation runs on the next tick. Each row is a checkpoint for the validator's elaborate-phase pass.

| Projected gap | Risk | Trigger condition | Responsible hat |
|---|---|---|---|
| BSPEC missing for SC-1.7 (kill-switch no-op) | Operator-rollback path lacks behavior verification | If `BEHAVIORAL-SPEC.md` does not include a feature/scenario for the disabled-flag path | specification |
| BSPEC missing for SC-2.2's four-outcome enumeration as four separate scenarios | Agent classification taxonomy under-specified | If `BEHAVIORAL-SPEC.md` includes only one composite "classification" feature instead of four named outcomes | specification |
| AC silent on SC-3.10 (Decision 9 stance) | Integrity stance not surfaced in v1 acceptance — risk that a future dev reads the AC and thinks confirmation is required | If `ACCEPTANCE-CRITERIA.md` does not include an explicit AC ratifying the Trust+Audit choice from Decision 9 | product |
| AC silent on SC-4.4 (outputs/artifacts naming alias) | Implementation drift — code might create `outputs/` directories anyway | If `ACCEPTANCE-CRITERIA.md` does not mention the alias rule and nail down `artifacts/` as canonical | product |
| DC missing the drift-event schema as a first-class type (SC-1.3, SC-1.4, SC-1.5, SC-1.6) | API contract under-specified — frontend and backend can drift on event shape | If `DATA-CONTRACTS.md` describes the action shape but not the per-event shape with all required fields | specification |
| DC missing the audit-log schema (SC-3.8, SC-3.9) | Audit format under-specified — humans + machines may not agree on log shape | If `DATA-CONTRACTS.md` describes the human-write tool but not the audit-log entry contract | specification |
| AC underspecifies SC-5.3 (non-color signal for drift state) | WCAG 1.4.1 risk — accessibility regression | If `ACCEPTANCE-CRITERIA.md` mentions border colors only without explicitly requiring a non-color signal per drift state | product |
| AC missing SC-2.10 (kill-switch and `manual_change_assessment` skip) | Coverage gap — operator could re-enable the gate but find action processing still skipping | If `ACCEPTANCE-CRITERIA.md` covers the gate kill-switch but not the action-processing kill-switch | specification |
| BSPEC missing SC-3.7 (deny-list test scenarios per workflow-managed-file zone) | Security risk — deny-list under-tested | If `BEHAVIORAL-SPEC.md` has fewer than four deny-list scenarios (one per zone) | specification |
| AC silent on SC-6.7 (testability annotation) | Verification gap — AC items may be unprovable | If `ACCEPTANCE-CRITERIA.md` items lack `test-path:` annotations or equivalent | validator |

---

## 10. Validation decision

**Decision: GAPS FOUND (provisional — pending sibling merge).**

This decision is provisional because the sibling AC / BSPEC / DC artifacts are being authored in parallel and have not yet merged back. The validator hat will re-run on the next tick (after merge) and convert the provisional `GAPS FOUND` into a definitive `APPROVED` or `GAPS FOUND` based on observed sibling content.

**Why provisional GAPS FOUND now (not provisional APPROVED):**

- This matrix projects 60+ AC / BSPEC / DC obligations across six domains. Sibling artifacts have not yet been authored, so by definition NO sibling content yet maps to any criterion. The provisional state is therefore "all rows are pending coverage" until siblings exist.
- §9 enumerates 10 specific projected gaps that are most likely to slip even with diligent sibling authoring. The validator's next tick MUST close each before approving.

**What "provisional GAPS FOUND" means for downstream:**

- The product stage's gate is **not** passable until siblings exist AND the validator's next pass converts this matrix to `APPROVED`. The validator hat MUST re-run after siblings merge.
- The execution stage MAY begin reading this matrix as a forward-looking testability index — every SC-N row is an executable obligation that the development units will need to prove.
- Any sibling AC / BSPEC / DC item that this matrix does not project AND that does not appear in §8's scope-creep list is a candidate for a §6 scope-creep flag at re-validation time.

**What unblocks `APPROVED`:**

1. Every SC-N row finds at least one matching AC item (or matching BSPEC scenario, where AC is N/A — e.g., for tooling-side criteria like SC-5.9).
2. Every projected gap in §9 is closed (either the gap is filled in the sibling artifact, or the gap is explicitly accepted with a documented rationale).
3. No scope creep beyond §8's allowlist exists in the sibling artifacts.
4. Every AC item in the sibling artifact is testable (has a concrete BSPEC scenario, DC validator, or inspection step).
5. The matrix is internally consistent with `DESIGN-DECISIONS.md` Decisions 1–9 (no contradictions).
6. The matrix is internally consistent with the design-stage units (DESN-01..DESN-06) — every completion criterion in those units appears as an SC row.

**What blocks `APPROVED` (unconditional):**

- Any SC-N row in domains 1–5 (Detection, Classification, Write Paths, Tracked Surface, Rollout) without a matching AC item in `ACCEPTANCE-CRITERIA.md` is a hard gap.
- Any sibling AC / BSPEC / DC item that asserts a behavior contradicting DEC-1..DEC-9 (e.g., AC asserting a Run-Now button, AC asserting locks, AC asserting a fifth classification outcome) is a hard gap.
- Missing `manual_change_assessment` action shape in `DATA-CONTRACTS.md` is a hard gap.
- Missing drift-event schema in `DATA-CONTRACTS.md` is a hard gap.
- Missing four-outcome enumeration in `BEHAVIORAL-SPEC.md` is a hard gap.

---

## 11. Boundary acknowledgements (cross-cutting)

These items are **not** in scope for this artifact (the coverage-mapping discovery axis) but are noted here so they're not lost when sibling artifacts are read in isolation:

- **Workflow-engine sibling boundary** — The pre-tick gate ordering (tamper → triage → drift → per-state dispatch) is part of the workflow-engine artifact's substance, not the product stage's. This artifact references the ordering as a constraint (SC-1.1, SC-6.2) but does not specify the gate's internal implementation.
- **Security/hooks sibling boundary** — The PreToolUse hook contract for agent writes is bounded in DEC-2 and is owned by the security/hooks sibling artifact, not the product stage. This artifact references the hook only as a constraint (SC-6.6).
- **Auth model sibling boundary** — SC-3.9's audit-log `actor` field discriminates `mcp:`, `spa:`, `filesystem:` paths. The SPA's authenticated-user identifier shape (`spa:{user_id}`) depends on the auth model and is owned by the SPA artifact. This artifact references the discriminator (DC-3.6) but does not specify the user-id format.

---

## 12. Quality-signal self-check

Per the discovery template's Quality Signals:

| Quality signal | Self-check | Status |
|---|---|---|
| Every success criterion maps to at least one AC or spec item | All 60+ SC-N rows have at least one projected AC (or BSPEC where AC is N/A). Some rows project both AC + BSPEC + DC for full coverage. | Met (provisional pending sibling merge). |
| Every AC item is testable | Every projected AC-N row in §2–7 has either a paired BSPEC scenario, a paired DC schema, or a documented inspection step (e.g., "design spec contains a contrast table"). No AC is "best-effort" or "should approximately." | Met (projection). |
| No gaps remain unflagged | §9 enumerates 10 projected gaps. Domain matrix sections call out per-domain gap expectations. | Met. |
| Scope creep items are identified but do not block approval | §8 enumerates 15 scope-creep candidates with rationale and disposition. None block APPROVED. | Met. |

---

## 13. Out-of-scope notes for downstream readers

- This artifact is a **forward-looking projection** authored in parallel with sibling AC / BSPEC / DC. The validator hat's next tick converts projection to confirmed coverage.
- This artifact does NOT author AC, BSPEC, or DC content. Anything that looks like a draft AC is a projection of what the sibling MUST author. The validator hat does not write into sibling artifacts (per the discovery scope rules).
- This artifact does NOT modify the upstream design decisions or units. Any apparent contradiction between this matrix and `DESIGN-DECISIONS.md` is a bug to fix in this matrix — not in DESIGN-DECISIONS.md.
- This artifact does NOT specify implementation. SC-N rows reference baseline storage, gate ordering, and tool contracts at the contract level — not at the file-path or function-signature level. Implementation is the development stage's domain.
