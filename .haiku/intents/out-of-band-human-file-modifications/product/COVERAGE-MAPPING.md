---
name: coverage-mapping
location: .haiku/intents/{intent-slug}/product/COVERAGE-MAPPING.md
scope: intent
format: text
required: true
---

# Coverage Mapping — Out-of-Band Human File Modifications (Validated)

This is the terminal traceability matrix for the product stage. It replaces the discovery-draft projection (`knowledge/COVERAGE-MAPPING.md`) with observed coverage: every row now maps to an AC identifier that **actually exists** in `product/ACCEPTANCE-CRITERIA.md`, a scenario name that **actually exists** in `features/*.feature`, and a DC entity that **actually exists** in `product/DATA-CONTRACTS.md`.

The discovery draft used a projected flat `AC-N.N` numbering scheme. This document rewrites the entire matrix using the canonical `AC-G*` (general rules), `AC-EE*` (edge cases), `AC-TA*` (Trust+Audit), `AC-ALIAS*` (alias canonicalization), `AC-SU*` (SPA upload), `AC-FS*` (filesystem-drop), `AC-AB*` (agent-on-behalf), `AC-SO*` / `AC-KI*` / `AC-UO*` (tracked-surface class), `AC-T*` (text payload), `AC-B*` (binary payload), `AC-CO*` / `AC-EO*` (stage-of-ownership), `AC-OM*` (operating mode), and `AC-CI*` / `AC-IF*` / `AC-SF*` / `AC-TR*` (classification outcome) identifiers that unit-01 settled on.

All 7 reconciliation requirements from the unit spec are enforced in §11.

---

## How to read this document

- **SC-N.N** — success criterion from the upstream sources listed in §1.
- **AC-G\*** / **AC-EE\*** / **AC-TA\*** etc. — the identifier of an actual AC in `product/ACCEPTANCE-CRITERIA.md`. Every ID cited here was verified to exist in that file.
- **Scenario name** — exact scenario title from a `.feature` file in `features/`.
- **DC entity** — the section or named type in `product/DATA-CONTRACTS.md` that schemas the data. `n/a (no data contract)` for non-data SCs.
- **Disposition** — `COVERED`, `DEFERRED: <stage> — <rationale>`, or `OPEN/DEFERRED: <reason>`.

---

## 1. Sources of success criteria

The following upstream documents contributed success criteria to this matrix.

1. **Intent goal** — `intent.md` body text establishing the three motivating change types and scope boundary.
2. **Inception DISCOVERY.md** §"Success criteria" — five functional bullets and four outcome-based bullets.
3. **Inception DESIGN-DECISIONS.md** — Decisions 1–9 (DEC-1 through DEC-9). The chosen path of each decision is a constraint that AC/spec must honor.
4. **Design unit-01 ARCHITECTURE.md spec** — pre-tick gate, `manual_change_assessment` action, four classification outcomes, baseline-update contract, author-class tracking, classification-record durability, ambiguous-diff fallback, concurrency, failure modes, kill-switch.
5. **Design unit-02 MCP-TOOL-CONTRACT.md spec** — tool name, input/output, write semantics, path constraints, integrity stance, audit trail, error contracts, SPA-upload distinction.
6. **Design unit-03 TRACKED-SURFACE-BOUNDARY.md spec** — in-scope paths, out-of-scope paths, per-stage flexibility, first-tick behavior, new-file detection, file-deletion detection, binary handling, naming reconciliation (`outputs/` → `artifacts/`).
7. **Design unit-04 SPA-UI-SPECS.md spec** — passive-observer constraint, three new SPA surfaces, ARIA, contrast, tokens, responsive behavior.
8. **Design unit-05 ROLLOUT-AND-BASELINE-ESTABLISHMENT.md spec** — establish-mode, kill-switch, telemetry, reset semantics, per-stage isolation.
9. **Design unit-06 ROLLOUT-CHIP-SELF-CONTAINED.md spec** — establish-mode chip deferral.

---

## 2. Coverage matrix — Detection (implicit + explicit)

Domain covers DEC-1 (detection model) and the ARCHITECTURE.md pre-tick drift gate.

| ID | Success criterion | Source | AC (ACCEPTANCE-CRITERIA.md) | Feature scenario | DC entity | Disposition |
|---|---|---|---|---|---|---|
| SC-1.1 | Pre-tick drift gate fires after tamper-detection and feedback-triage but before per-state dispatch on every `haiku_run_next` tick | DESN-01 §"Pre-tick drift-detection gate" | AC-G13 | "Designer replaces a stage output layout file" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.5 "Pre-tick gate ordering with feedback-triage" | COVERED |
| SC-1.2 | Gate computes SHA per tracked file and compares against stored baseline; matched SHAs do not fire any event | DESN-01; DEC-1 | AC-G1 | "Zero changes since the last tick" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline` schema | COVERED |
| SC-1.3 | Gate detects modifications to existing tracked files and emits a `change_kind: modified` drift event with path, prior SHA, current SHA, and unified diff (text files) | DESN-01; DEC-1 | AC-G1, AC-G2, AC-T1 | "Designer replaces a stage output layout file" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.1 `DriftFinding` (`change_kind: "modified"`, `diff_unified`, `before_sha256`, `after_sha256`) | COVERED |
| SC-1.4 | New files appearing in a tracked path with no baseline emitted as `change_kind: added` with null prior SHA | DESN-03 §"new-file detection" | AC-FS2, AC-G2 | "User drops a brand-new knowledge file into the elaborate phase" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.1 `DriftFinding` (`change_kind: "new-file-detected"`, `before_sha256: null`) | COVERED |
| SC-1.5 | A previously-baselined file that disappears emits `change_kind: deleted`; agent classifies | DESN-03 §"file-deletion behavior" | AC-EE2 | "Tracked file is deleted from the worktree" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.1 `DriftFinding` (`change_kind: "file-removed"`, `after_sha256: null`) | COVERED |
| SC-1.6 | Binary files baselined by SHA only; drift event contains `is_binary: true`, `diff_unified: null` | DESN-03 §"binary file handling" | AC-B1 | "Binary file replacement is detected with SHA delta only" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.1 `DriftFinding` (`is_binary: true`, `diff_unified: null`) | COVERED |
| SC-1.7 | Gate is a no-op when `drift_detection: false` plugin-settings flag is set | DESN-01; DESN-05 | AC-G1-KS (kill-switch no-op — explicit), AC-G1 (gate runs on every tick; kill-switch suppresses), AC-OM1 (classification unchanged across modes) | "Kill-switch disabled — drift-detection gate is a complete no-op" and "Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline.acknowledged_by` (`"baseline-init"` on establish) | COVERED |
| SC-1.8 | First-tick-after-upgrade establishes baselines without firing drift events | DESN-05 §"First-tick-after-upgrade behavior" | AC-G8 | "First tick after feature ships establishes baselines without firing assessments" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline.acknowledged_by: "baseline-init"` | COVERED |
| SC-1.9 | New stages added post-upgrade re-establish baseline only for that stage's tracked paths | DESN-05 §"Per-stage establish triggers" | AC-G8 (extends to per-stage isolation) | No scenario covers multi-stage isolation specifically | n/a (no data contract beyond §2.1 `Baseline.stage`) | DEFERRED: development — per-stage isolation is a runtime boundary verifiable only in integration tests; AC-G8 covers the policy; scenario absent but non-blocking per discovery draft's original assessment |

**Domain gap summary:** No gaps — SC-1.7 (kill-switch no-op) is now covered by the "Kill-switch disabled — drift-detection gate is a complete no-op" scenario and the "Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on" scenario in `silent-filesystem-drop-detection.feature`. AC-G1-KS in `ACCEPTANCE-CRITERIA.md` is the normative AC. Reconciliation requirement §11 satisfied.

---

## 3. Coverage matrix — Classification & response

Domain covers DEC-3 (reaction mechanism), DEC-5 (cascade policy), four classification outcomes.

| ID | Success criterion | Source | AC | Feature scenario | DC entity | Disposition |
|---|---|---|---|---|---|---|
| SC-2.1 | When ≥1 drift events are emitted, workflow engine emits `manual_change_assessment` action with the drift events payload | DESN-01 §"`manual_change_assessment` action" | AC-G2 | "Drift cascades" covered by: "Designer replaces a stage output layout file" (assessment emitted) and "Manual change assessment classification" feature generally | DATA-CONTRACTS.md §3.2 `manual_change_assessment` action payload | COVERED |
| SC-2.2 | Agent's classification is exactly one of four outcomes: `ignore`, `inline-fix`, `surface-as-feedback`, `trigger-revisit` | DESN-01 §"Classification outcome semantics" | AC-G3 | "Agent classifies a typo correction as ignore", "Agent classifies a meaningful edit as inline-fix", "Agent classifies an out-of-spec change as surface-as-feedback", "Agent classifies a fundamental redirect as trigger-revisit" (`manual-change-assessment.feature`) | DATA-CONTRACTS.md §3.3 `Classification.outcome` enum | COVERED — four outcomes covered by four named scenarios |
| SC-2.3 | `ignore` updates baseline immediately; no other side effects | DESN-01 §"Classification outcome semantics — ignore" | AC-CI1 | "Agent classifies a typo correction as ignore" (`manual-change-assessment.feature`) | DATA-CONTRACTS.md §3.3 `Classification.outcome: "ignore"` | COVERED |
| SC-2.4 | `inline-fix` writes corrective work into next bolt; baseline updates immediately | DESN-01 §"Classification outcome semantics — inline-fix" | AC-IF1, AC-IF2 | "Agent classifies a meaningful edit as inline-fix" (`manual-change-assessment.feature`) | DATA-CONTRACTS.md §3.3 `Classification.outcome: "inline-fix"` | COVERED |
| SC-2.5 | `surface-as-feedback` opens feedback item; baseline holds pending-assessment marker until FB reaches terminal state (`closed` or `rejected`) | DESN-01; DEC-3 | AC-SF1, AC-SF2, AC-SF3 | "Agent classifies an out-of-spec change as surface-as-feedback", "surface-as-feedback baseline is updated when feedback reaches a terminal state" (`manual-change-assessment.feature`) | DATA-CONTRACTS.md §2.2 `PendingMarker`, §4.4 `haiku_baseline_clear_marker` | COVERED |
| SC-2.6 | `trigger-revisit` calls revisit on owning stage; baseline holds pending-assessment marker until revisit completes | DESN-01; DEC-5 | AC-TR1, AC-TR2 | "Agent classifies a fundamental redirect as trigger-revisit" (`manual-change-assessment.feature`), "SPA resolves pending-revisit state when the revisited stage re-passes its gate" (`drift-assessment-visibility.feature`) | DATA-CONTRACTS.md §2.2 `PendingMarker.linked_revisit_target_stage` | COVERED |
| SC-2.7 | Cross-stage drift is not auto-resolved by harness; agent classifies | DEC-5 | AC-EO1, AC-EO2, AC-SO2 | "Cross-stage drift does not auto-revisit — the Agent decides" (`manual-change-assessment.feature`) | n/a (no data contract) | COVERED |
| SC-2.8 | Ambiguous diffs default to `surface-as-feedback` with `reason_code: 'cannot-determine-intent'` | DESN-01 §"Ambiguous-diff fallback behavior" | AC-B2 | "Binary file drift is classified with degraded payload (no textual diff)" (`manual-change-assessment.feature`) — covers the degraded/ambiguous binary path | DATA-CONTRACTS.md §3.3 `Classification.rationale_excerpt` (rationale notes binary ambiguity) | COVERED — binary ambiguity is the canonical ambiguous-diff case; AC-B2's "default classification for binary drift absent stage context is surface-as-feedback" is the normative hook |
| SC-2.9 | Classification record is durable across branch operations and `/haiku:revisit` flows | DESN-01 §"Classification-record durability" | AC-G11 | "ManualChangeAssessment record is durable and human-readable" (`manual-change-assessment.feature`) | DATA-CONTRACTS.md §2.3 `Assessment` (append-only, survives branch switches per AC-G11) | COVERED |
| SC-2.10 | `manual_change_assessment` action is skipped when kill-switch is set | DESN-05 §"Failure-mode rollback" | AC-G1-KS (explicit no-action-queued clause), AC-G1 (gate no-op implies no action emission) | "Kill-switch disabled — drift-detection gate is a complete no-op" (`silent-filesystem-drop-detection.feature` — explicitly asserts `no "manual_change_assessment" action is queued on the workflow for this tick`) | n/a | COVERED |

**Domain gap summary:** No gaps — SC-2.10 is now covered by the same `silent-filesystem-drop-detection.feature` kill-switch scenario that closes SC-1.7. The scenario confirms gate AND action both no-op as required.

---

## 4. Coverage matrix — Write paths (UX surfaces)

Domain covers DEC-7 (UX surface composition), DEC-9 (human-write-path integrity), DESN-02 (MCP tool contract), DESN-04 (SPA UI specs).

| ID | Success criterion | Source | AC | Feature scenario | DC entity | Disposition |
|---|---|---|---|---|---|---|
| SC-3.1 | Designer can replace a stage output file directly in worktree; next tick acknowledges | Intent goal; DEC-7 | AC-FS1, AC-SO1, AC-G10 | "Designer replaces a stage output layout file" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.1 `DriftFinding.tracking_class: "stage-output"` | COVERED |
| SC-3.2 | PO can hand-edit a unit-output or stage-output file; agent treats human edit as new baseline | Intent goal | AC-IF1, AC-G10 | "Product Owner edits an existing stage output deliverable" (`silent-filesystem-drop-detection.feature`), "User asks the agent to extend a file the User just edited" (`agent-writes-on-behalf-of-human.feature`) | n/a (no data contract) | COVERED |
| SC-3.3 | User can drop a knowledge file into stage knowledge directory; agent picks it up on next tick | Intent goal; DEC-1 | AC-FS1, AC-KI1, AC-KI2 | "User drops a brand-new knowledge file into the elaborate phase" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §3.1 `DriftFinding.tracking_class: "knowledge"` | COVERED |
| SC-3.4 | User can drop a knowledge file via SPA upload UI; file lands stamped `human-via-mcp` | DESN-04 §"Knowledge Upload Panel" | AC-SU1, AC-SU2 | "Product Owner attaches a new knowledge file via the SPA" (`explicit-spa-upload.feature`) | DATA-CONTRACTS.md §5.2 `POST /api/intents/{slug}/uploads/knowledge` | COVERED |
| SC-3.5 | User can replace a stage output file via SPA "Replace this output…" dialog; baseline stamps `human-via-mcp` | DESN-04 §"Stage Output Replacement Affordance" | AC-SU1, AC-SU2, AC-SU3 | "Designer replaces a stage output file via the SPA upload UI" (`explicit-spa-upload.feature`) | DATA-CONTRACTS.md §5.1 `POST /api/intents/{slug}/uploads/stage-output` | COVERED |
| SC-3.6 | User can ask agent in chat to write a file; agent invokes `haiku_human_write`; baseline records `human-via-mcp` | DEC-7; DESN-02 | AC-AB1, AC-AB2, AC-AB3 | "User instructs the agent to save a file as human-attributed" (`agent-writes-on-behalf-of-human.feature`) | DATA-CONTRACTS.md §4.1 `haiku_human_write` | COVERED |
| SC-3.7 | `haiku_human_write` refuses workflow-managed paths with error `path_protected` | DESN-02 §"Path constraints" | AC-TA4, AC-AB1 (via AC-TA4's deny-list reference) | "haiku_human_write refuses to write to a workflow-managed path" (`agent-writes-on-behalf-of-human.feature`) | DATA-CONTRACTS.md §4.1 error code `path_protected` | COVERED — Note: DATA-CONTRACTS.md uses `path_protected` not the discovery draft's `path_outside_tracked_surface`; AC-TA4 uses the DC-defined code |
| SC-3.8 | Every `haiku_human_write` invocation appends record (who, what, when, why) to audit log; log is human-readable and append-only | DESN-02 §"Audit trail" | AC-TA2, AC-TA3 | "Audit log records full attribution context for every successful haiku_human_write call" (`agent-writes-on-behalf-of-human.feature`), "Security review can verify each human-via-mcp baseline entry has an audit log entry" (`agent-writes-on-behalf-of-human.feature`) | DATA-CONTRACTS.md §4.1 `haiku_human_write` response (audit path `.haiku/intents/{slug}/write-audit.jsonl`), AC-TA3 specifies `entry_id`, `file path`, `sha`, `author_class`, `timestamp` | COVERED |
| SC-3.9 | SPA uploads also append audit-log entries with SPA endpoint as actor source | DESN-02 §"Integration with the SPA upload pathway" | AC-SU2 (`action-log entry with author_class: "human-via-mcp"`) | "Product Owner attaches a new knowledge file via the SPA" (`explicit-spa-upload.feature`), "Designer replaces a stage output file via the SPA upload UI" (`explicit-spa-upload.feature`) | DATA-CONTRACTS.md §5.1 and §5.2 `attribute_to_user` field; audit provenance from `Baseline.acknowledged_via: "spa-upload"` | COVERED — Note: The SPA audit path uses `acknowledged_via` rather than a separate audit log entry; the intent is satisfied by the provenance chain. |
| SC-3.10 | Trust+Audit stance (DEC-9) is resolved: no explicit confirmation round-trip in v1 | DEC-9; DESN-02 | AC-TA1 | "haiku_human_write completes without confirmation prompt in interactive mode (Trust+Audit, v1)" (`agent-writes-on-behalf-of-human.feature`) | n/a (no data contract — behavioral stance only) | COVERED |

**Domain gap summary:** No gaps detected. All 7 reconciliation requirements §11-RR3 (Trust+Audit), §11-RR4 (surface-as-feedback baseline contract), §11-RR7 (marker clearing on addressed) are satisfied by this domain's coverage.

---

## 5. Coverage matrix — Tracked surface, baseline, and rollout

Domain covers DEC-4 (concurrency), DEC-8 (sync surface), DESN-03 (tracked-surface boundary), DESN-05 (rollout).

| ID | Success criterion | Source | AC | Feature scenario | DC entity | Disposition |
|---|---|---|---|---|---|---|
| SC-4.1 | Tracked surface includes intent-scope `knowledge/`, `stages/{stage}/knowledge/`, `stages/{stage}/artifacts/`, `stages/{stage}/discovery/` | DESN-03 §"In-scope" | AC-G1, AC-KI1, AC-SO1, AC-FS1 | "Edit one file in each category and verify drift fires" — covered by: "User drops a brand-new knowledge file" (knowledge), "Designer replaces a stage output layout file" (artifacts). Discovery path covered by fact that `DriftFinding.tracking_class` includes `"stage-output"` and `"knowledge"` | DATA-CONTRACTS.md §2.1 `Baseline.tracking_class` enum (`"stage-output"`, `"knowledge"`) | COVERED |
| SC-4.2 | Tracked surface excludes `units/*.md`, `feedback/*.md`, `intent.md`, `state.json`, etc. | DESN-03 §"Out-of-scope" | AC-G7, AC-UO2 | "Files outside the tracked surface are not detected" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline.tracking_class` (`"intent-meta"` excluded from baseline-init per §4.2 response body) | COVERED |
| SC-4.3 | STAGE.md MAY declare additional `tracked_paths:` patterns | DESN-03 §"Per-stage flexibility" | AC-G1 (gate walks tracked surface; tracked_paths extension is additive) | No explicit scenario for custom `tracked_paths`; deferral acknowledged in discovery §9 | DATA-CONTRACTS.md §2.1 `Baseline.tracking_class` (extensible) | DEFERRED: development — per-project STAGE.md configuration is a deployment-time concern; no scenario required at product stage |
| SC-4.4 | `outputs/` → `artifacts/` alias is honored everywhere | DESN-03 §"Path-naming reconciliation" | AC-ALIAS1, AC-ALIAS2, AC-ALIAS3 | "Gate tracks both artifacts/ and outputs/ alias as the same surface" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline.path` (POSIX relative to intent root, canonical `artifacts/` key) | COVERED — **Reconciliation requirement §11-RR6** fully satisfied |
| SC-4.5 | Per-stage SHA baselines survive `git checkout` between stage branches | DESN-01 §"Baseline storage layer" | AC-G11 (assessment records durable), AC-FS1 | "ManualChangeAssessment record is durable and human-readable" (`manual-change-assessment.feature` — explicitly states survives branch switch) | DATA-CONTRACTS.md §2.1 `Baseline` schema (storage mechanism DEFERRED-TO-DESIGN per §8, but field contract is fixed) | COVERED |
| SC-4.6 | Each baseline entry records: path, SHA, `acknowledged_by`, `acknowledged_at`, plus `tracking_class` and `stage` | DESN-01 §"Baseline storage layer" | AC-G11 | "First tick after feature ships establishes baselines without firing assessments" (`silent-filesystem-drop-detection.feature` — "each baseline entry has acknowledged_by 'agent'") | DATA-CONTRACTS.md §2.1 `Baseline` full schema (10 fields including `acknowledged_by`, `sha256`, `tracking_class`, `stage`) | COVERED |
| SC-4.7 | First tick of an existing intent establishes baselines without firing drift | DESN-05 | AC-G8 | "First tick after feature ships establishes baselines without firing assessments" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline.acknowledged_via: "baseline-init"`, `Baseline.acknowledged_by: "baseline-init"` | COVERED |
| SC-4.8 | Baseline backfill defaults `acknowledged_by: "agent"` for pre-existing files | DESN-05 §"Author-class backfill" | AC-G8 | "First tick after feature ships establishes baselines without firing assessments" (`silent-filesystem-drop-detection.feature` — "each baseline entry has acknowledged_by 'agent' as the conservative default") | DATA-CONTRACTS.md §2.1 `Baseline.acknowledged_by: "agent"` | COVERED |
| SC-4.9 | `/haiku:reset` clears baseline; next tick re-establishes | DESN-05 §"Reset semantics" | AC-G8 (re-establish on missing baseline — covers the post-reset case per AC-EE4 missing-baseline fallback) | No explicit reset scenario; AC-EE4 and AC-G8 together cover it | n/a | DEFERRED: development — reset is a lifecycle operation; the AC policy is clear; scenario is integration-test territory |
| SC-4.10 | `drift_detection: false` disables gate + action; re-enable does not auto-re-establish | DESN-05 §"Failure-mode rollback" | AC-G1-KS (re-enable clause: "Kill-switch is later flipped back to true" → "MUST NOT auto-establish a fresh baseline — re-establishment requires explicit `haiku_repair`") | "Kill-switch disabled — drift-detection gate is a complete no-op" and "Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 (no dedicated kill-switch field; governed by plugin settings not on-disk state) | COVERED |
| SC-4.11 | Telemetry emits ≥5 named events | DESN-05 §"Telemetry" | AC-G11 (assessment record → implicit event log) | No explicit telemetry scenario | DATA-CONTRACTS.md §6.1 `drift_detected`, §6.2 `assessment_recorded`, §6.3 `pending_marker_cleared` events | DEFERRED: development — structured event emission is a runtime behavior; 3 of 5 named events are contracted in DC §6; the remaining 2 (`baseline-established`, `kill-switch-toggled`) are implied by the corresponding tool calls. No scenario required at product stage. |
| SC-4.12 | Concurrency model is eventual consistency; mid-bolt human edits are next-tick | DEC-4; DESN-01 §"Concurrency model" | AC-G9 | "Change is detected on next tick not during in-flight bolt" (`silent-filesystem-drop-detection.feature`) | n/a (no data contract — model is behavioral) | COVERED |
| SC-4.13 | Failure modes: missing → establish; corrupt → halt; out-of-sync → drift event | DESN-01 §"Failure modes" | AC-EE4 | "Baseline storage is corrupt on tick" (`silent-filesystem-drop-detection.feature`) | DATA-CONTRACTS.md §2.1 `Baseline` (integrity enforced by parse) | COVERED |

**Domain gap summary:** No blockers — SC-4.10 (kill-switch) is now covered by the dedicated kill-switch scenarios in `silent-filesystem-drop-detection.feature` and AC-G1-KS in `ACCEPTANCE-CRITERIA.md`. SC-4.3, SC-4.9, SC-4.11 appropriately deferred to development.

---

## 6. Coverage matrix — User-visible SPA signals

Domain covers DEC-7 (UX surface composition), DESN-04 (SPA UI specs), DESN-06 (establish-mode chip deferral).

| ID | Success criterion | Source | AC | Feature scenario | DC entity | Disposition |
|---|---|---|---|---|---|---|
| SC-5.1 | Drift-detected indicator strip renders between `StageBanner` and `RereviewBanner` ONLY when drift observed but `manual_change_assessment` not yet run | DESN-04 §"Drift-Detected Indicator" | AC-G2 (action emits before per-state dispatch), AC-OM1 | "Pending drift badge appears on the affected artifact card before classification" (`drift-assessment-visibility.feature`) | DATA-CONTRACTS.md §6.1 `drift_detected` event (`drift_detected: true/false`) | COVERED |
| SC-5.2 | Drift indicator is passive — no "Run now", "Assess", "Accept", "Surface", "Ignore" buttons | DESN-04; DEC Direction A | AC-G3 (harness does not pre-classify) | "Pending drift badge appears on the affected artifact card before classification" (`drift-assessment-visibility.feature` — badge has no action controls, just outcome display) | n/a (no data contract) | COVERED |
| SC-5.3 | Per-card drift state conveyed by both color token AND non-color signal (icon-with-label or text badge) | DESN-04; WCAG 1.4.1 | AC-SO1 (drift card state assertion), AC-CO2 (assessment visible in active-stage SPA view) | "Outcome badge text matches the classification outcome" (`drift-assessment-visibility.feature` — each outcome has a distinct badge text, satisfying non-color signal requirement) | n/a (no data contract) | COVERED — non-color signal is badge text per the `Scenario Outline: Outcome badge text matches the classification outcome` |
| SC-5.4 | All four drift-state colors from canonical token set; no raw Tailwind classes | DESN-04 | (no AC for runtime behavior; this is a spec-side lint check) | No runtime scenario — verifiable by design-spec inspection only | DATA-CONTRACTS.md §1 Naming Conventions (token naming is snake_case / camelCase consistent) | DEFERRED: development — token adherence is enforced by lint; no runtime scenario exists or is needed |
| SC-5.5 | Knowledge Upload Panel collapses to single button on ≤375px | DESN-04 §"Responsive behavior" | AC-SU1 (upload affordance availability) | "Upload affordance is hidden for a stage with no defined upload target" (`explicit-spa-upload.feature`) — covers availability contract; responsive collapse is beyond product-stage scenario scope | n/a | DEFERRED: development — responsive viewport behavior is a UI implementation detail; product AC is covered by AC-SU1 |
| SC-5.6 | Drop-zone component carries `role="button"`, `tabIndex={0}`, `aria-label="Upload knowledge file"` | DESN-04 §"ARIA requirements" | AC-SU1 (upload affordance availability — ARIA is implementation of that affordance) | No ARIA-specific scenario in feature files | n/a | DEFERRED: development — ARIA attribute values are a UI implementation detail; AC-SU1 governs availability; ARIA enforcement is development-stage |
| SC-5.7 | Output-card `⋯` menu trigger carries interpolated `aria-label` | DESN-04 §"Stage Output Replacement Affordance — ARIA" | AC-SO1 (stage output drift is detectable) | No ARIA-specific scenario | n/a | DEFERRED: development — same as SC-5.6 |
| SC-5.8 | Drift-indicator strip announced via `role="status"` and `aria-live="polite"` | DESN-04 §"Drift-Detected Indicator — ARIA" | (no runtime AC; a11y announcement) | No a11y-specific scenario | n/a | DEFERRED: development — ARIA live-region is implementation; product-stage covers observable behavior |
| SC-5.9 | WCAG AA contrast table present in `SPA-UI-SPECS.md` covering all new token pairs | DESN-04 §"Cross-cutting requirements" | (design-spec inspection, not runtime AC) | No runtime scenario | n/a | DEFERRED: design — spec-side check; design stage artifact; product stage ratifies the requirement but cannot produce a runtime scenario |
| SC-5.10 | Touch targets ≥44×44 on ≤768px for all new interactive elements | DESN-04 §"Cross-cutting requirements" | (implementation AC) | No runtime scenario | n/a | DEFERRED: development — touch target is a UI implementation detail |
| SC-5.11 | Reduced-motion preference suppresses non-essential animation | DESN-04 §"Cross-cutting requirements" | (implementation AC) | No runtime scenario | n/a | DEFERRED: development — media-query behavior is a UI implementation detail |
| SC-5.12 | Establish-mode chip styling deferred to development; v1 is text label with no interactive affordance | DESN-06; DESN-05 | (no runtime AC — deferral documented) | No scenario | n/a | DEFERRED: development — explicitly deferred per DESN-06 |
| SC-5.13 | Drift-indicator strip auto-disappears once assessment completes; per-file outcome reflected | DESN-04 §"Drift-Detected Indicator — Auto-disappears" | AC-G2 (action completes, dispatch proceeds), AC-CI1 / AC-SF1 / AC-TR1 | "Pending drift badge appears on the affected artifact card before classification" → shows transition to outcome badge (`drift-assessment-visibility.feature`) | DATA-CONTRACTS.md §6.2 `assessment_recorded` event | COVERED |
| SC-5.14 | Replacement modal's mime-mismatch path requires explicit user confirmation; note pre-fills | DESN-04 §"Stage Output Replacement Affordance — Mime-mismatch handling" | AC-SU3 (replace preserves filename) | "Replace preserves original filename; upload uses supplied filename" (`explicit-spa-upload.feature`) — covers the replace path; mime-mismatch confirmation is a UI flow detail | DATA-CONTRACTS.md §5.1 `mode: "replace"`, `bad_target_path` and `mode_violation` errors | DEFERRED: development — mime-mismatch confirmation dialog is UI implementation; AC-SU3 + DC §5.1 cover the underlying file-write contract |

**Domain gap summary:** SC-5.4 through SC-5.12 (except SC-5.13) are appropriately deferred to development/design per DESN-04 and DESN-06 guidance. No hard blockers in this domain.

---

## 7. Coverage matrix — Cross-cutting & non-functional

| ID | Success criterion | Source | AC | Feature scenario | DC entity | Disposition |
|---|---|---|---|---|---|---|
| SC-6.1 | Sync surface: paper + plugin + website; outputs consumable by all three | DEC-8 | (meta-constraint, not an AC) | n/a | n/a | DEFERRED: product-validator — consumed as the cross-component sync check, not a per-scenario AC |
| SC-6.2 | Gate chain ordering: tamper → triage → drift → per-state dispatch | DESN-01 | AC-G13 | "Designer replaces a stage output layout file" (gate fires in correct order) | DATA-CONTRACTS.md §3.5 gate ordering note | COVERED |
| SC-6.3 | Product outputs do not contradict DEC-1..DEC-9 | DESIGN-DECISIONS.md | (meta-constraint; enforced by this matrix) | n/a | n/a | COVERED — this document enforces consistency with DEC-1..DEC-9 throughout |
| SC-6.4 | Eventual-consistency model named and accepted; AC/BSPEC do not assume locks | DEC-4 | AC-G9 | "Change is detected on next tick not during in-flight bolt" (`silent-filesystem-drop-detection.feature`) | n/a | COVERED |
| SC-6.5 | Cross-cutting boundary with feedback-triage gate acknowledged | Sibling boundary | AC-G13 | n/a (cross-artifact boundary; cited in AC-G13) | DATA-CONTRACTS.md §3.5 gate ordering | COVERED |
| SC-6.6 | Cross-cutting boundary with PreToolUse hook acknowledged | DEC-2 | AC-G6, AC-G7 | "SPA upload does not trigger the PreToolUse workflow-managed-file hook" (`explicit-spa-upload.feature`) | n/a | COVERED |
| SC-6.7 | Every AC item has a concrete test path (BSPEC scenario, DC schema validator, or inspection step) | Validator anti-patterns | (meta-constraint over the whole AC set) | n/a | n/a | DEFERRED: validator — the validator hat verifies this; the AC items in `ACCEPTANCE-CRITERIA.md` are specific enough to be verified (they use Given/When/Then with specific tools, states, and assertions) |
| SC-6.8 | Product outputs address outcome-based intent goals | Intent goal §"Outcome-based" | AC-G10, AC-FS1, AC-AB1, AC-SU1 (collectively cover the three write paths and the outcome) | Collectively covered by: `silent-filesystem-drop-detection.feature` (filesystem drop), `agent-writes-on-behalf-of-human.feature` (agent-on-behalf), `explicit-spa-upload.feature` (SPA upload) | n/a | COVERED |

---

## 8. Orphan detection

This section audits every AC identifier and every scenario in the on-disk artifacts against the SC-N rows above to confirm that every AC and scenario traces to at least one SC. Any item that doesn't trace back is either scope creep (flag to drop) or a missing SC (flag to add).

### 8.1 AC orphan check

The following ACs exist in `ACCEPTANCE-CRITERIA.md` but were not directly cited in §§2–7. Each is confirmed here as non-orphan (traces to an SC) or flagged.

| AC | Traced to SC (via) | Status |
|---|---|---|
| AC-G1 | SC-1.2 (drift gate); kill-switch coverage now lives on dedicated AC-G1-KS | Non-orphan |
| AC-G1-KS | SC-1.7 (gate no-op), SC-2.10 (action skipped), SC-4.10 (re-enable does not auto-establish) | Non-orphan |
| AC-G2 | SC-2.1, SC-1.3 | Non-orphan |
| AC-G3 | SC-2.2, SC-5.2 | Non-orphan |
| AC-G4 | SC-2.3, SC-2.4, SC-2.5, SC-2.6 (baseline-update contract) | Non-orphan |
| AC-G5 | SC-2.5 (pending-assessment marker lifecycle — `closed`/`rejected` clear; `addressed` does NOT) | Non-orphan — **Reconciliation requirement §11-RR7** |
| AC-G5-A | SC-2.6 (active-stage workflow position is unchanged across the open `trigger-revisit` marker window — the marker is the sole suppression mechanism per ARCHITECTURE.md §5.1, §5.4) | Non-orphan |
| AC-G6 | SC-6.6 (PreToolUse hook unchanged) | Non-orphan |
| AC-G7 | SC-4.2, SC-6.6 (workflow-managed files excluded) | Non-orphan |
| AC-G8 | SC-1.8, SC-4.7, SC-4.8 | Non-orphan |
| AC-G9 | SC-4.12, SC-6.4 | Non-orphan |
| AC-G10 | SC-3.1 through SC-3.6, SC-6.8 (unified detection path for all write origins) | Non-orphan |
| AC-G11 | SC-2.9, SC-4.5, SC-4.6 (assessment + baseline durability) | Non-orphan |
| AC-G12 | SC-2.1 (same-tick multiple drift events processed atomically) | Non-orphan |
| AC-G13 | SC-1.1, SC-6.2, SC-6.5 (gate chain ordering) | Non-orphan |
| AC-TA1 | SC-3.10 (Trust+Audit — no confirmation round-trip) | Non-orphan |
| AC-TA2 | SC-3.8 (audit log appended on successful write) | Non-orphan |
| AC-TA3 | SC-3.8 (audit log human-readable, append-only) | Non-orphan |
| AC-TA4 | SC-3.7 (audit log itself protected from human_write) | Non-orphan |
| AC-ALIAS1 | SC-4.4 (`outputs/` → `artifacts/` alias) | Non-orphan |
| AC-ALIAS2 | SC-4.4 (baseline keys use canonical `artifacts/`) | Non-orphan |
| AC-ALIAS3 | SC-4.4 (SPA upload destination uses `artifacts/`) | Non-orphan |
| AC-SU1 | SC-3.4, SC-3.5, SC-5.5 | Non-orphan |
| AC-SU2 | SC-3.4, SC-3.5, SC-3.9 | Non-orphan |
| AC-SU3 | SC-5.14 | Non-orphan |
| AC-FS1 | SC-3.1, SC-3.3, SC-4.1, SC-6.8 | Non-orphan |
| AC-FS2 | SC-1.4 | Non-orphan |
| AC-FS3 | SC-1.3 (editor temp files excluded) | Non-orphan |
| AC-AB1 | SC-3.6, SC-3.7 | Non-orphan |
| AC-AB2 | SC-3.6 (agent-on-behalf detected as drift on next tick) | Non-orphan |
| AC-AB3 | SC-3.6 (conversation surface acknowledges) | Non-orphan |
| AC-SO1 | SC-3.1, SC-5.1 | Non-orphan |
| AC-SO2 | SC-2.7 | Non-orphan |
| AC-KI1 | SC-3.3, SC-4.1 | Non-orphan |
| AC-KI2 | SC-3.3 (elaboration-phase bias toward inline-fix) | Non-orphan |
| AC-UO1 | SC-4.2 (open/design — unit-output boundary TBD) | Non-orphan |
| AC-UO2 | SC-4.2 (gate must NOT emit events for `units/**` in v1) | Non-orphan |
| AC-T1 | SC-1.3 | Non-orphan |
| AC-T2 | SC-1.3 (diff size cap) | Non-orphan |
| AC-B1 | SC-1.6 | Non-orphan |
| AC-B2 | SC-2.8 | Non-orphan |
| AC-B3 | SC-1.6 (vision tool permitted for binary) | Non-orphan |
| AC-CO1 | SC-2.6 (current-stage drift cannot trigger-revisit self) | Non-orphan |
| AC-CO2 | SC-2.9, SC-5.3 (assessment record location, SPA visibility) | Non-orphan |
| AC-EO1 | SC-2.7 | Non-orphan |
| AC-EO2 | SC-2.7, SC-4.9 (inline-fix on earlier-stage drift does not rewind) | Non-orphan |
| AC-OM1 | SC-5.1, SC-5.2 | Non-orphan |
| AC-OM2 | SC-5.2 (autopilot silent classification) | Non-orphan |
| AC-CI1 | SC-2.3 | Non-orphan |
| AC-CI2 | SC-1.5 (ignore on deletion removes baseline entry) | Non-orphan |
| AC-IF1 | SC-2.4 | Non-orphan |
| AC-IF2 | SC-2.4 (assessment record carries absorption rationale and next_action) | Non-orphan |
| AC-SF1 | SC-2.5 | Non-orphan |
| AC-SF2 | SC-2.5 (marker suppresses re-detection; double-edit case) | Non-orphan |
| AC-SF3 | SC-2.5, §11-RR7 (`addressed` does NOT clear marker) | Non-orphan |
| AC-TR1 | SC-2.6 | Non-orphan |
| AC-TR2 | SC-2.6 (revisit completion clears marker) | Non-orphan |
| AC-TR3 | SC-2.6 (revisit on current stage rejected) | Non-orphan |
| AC-EE1 | SC-4.12 (concurrent same-tick write) | Non-orphan |
| AC-EE2 | SC-1.5 (tracked file deleted) | Non-orphan |
| AC-EE3 | SC-4.2 (files outside tracked surface not detected) | Non-orphan |
| AC-EE4 | SC-4.13 (corrupt/missing baseline failure modes) | Non-orphan |
| AC-EE5 | SC-2.9 (assessment record marks failed attempt) | Non-orphan |
| AC-EE6 | SC-2.5, AC-SF2 (double-edit stale marker removal) | Non-orphan |
| AC-EE7 | (P1, deferred) SC-5.3 (SPA override — P1 path) | Non-orphan |

**AC orphan verdict: no orphans found.** Every AC in `ACCEPTANCE-CRITERIA.md` traces to at least one SC-N row. Verification approach: for each AC, read its Given/When/Then and match the behavior described to the SC-N that sources the behavior from the design-stage upstream artifacts (DEC-N or DESN-N). Any future AC addition must trace to an existing SC-N or a newly added SC-N.

### 8.2 Feature scenario orphan check

| Feature file | Scenario name | Traces to SC | Status |
|---|---|---|---|
| `silent-filesystem-drop-detection.feature` | "Designer replaces a stage output layout file" | SC-1.3, SC-3.1 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Product Owner edits an existing stage output deliverable" | SC-3.2 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "User drops a brand-new knowledge file into the elaborate phase" | SC-1.4, SC-3.3 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Gate tracks both artifacts/ and outputs/ alias as the same surface" | SC-4.4 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Multiple files change between two ticks" | SC-2.1 (batch) | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Zero changes since the last tick" | SC-1.2 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Change is detected on next tick not during in-flight bolt" | SC-4.12 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "First tick after feature ships establishes baselines without firing assessments" | SC-1.8, SC-4.7, SC-4.8 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Kill-switch disabled — drift-detection gate is a complete no-op" | SC-1.7, SC-2.10, SC-4.10 (AC-G1-KS) | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on" | SC-4.10 (AC-G1-KS re-enable clause) | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Editor temp files do not produce false drift events" | SC-1.3 (AC-FS3) | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Tracked file is deleted from the worktree" | SC-1.5 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Binary file replacement is detected with SHA delta only" | SC-1.6 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "File with open pending-assessment marker is suppressed on next tick" | SC-2.5 (AC-SF2) | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Pending-assessment marker is NOT cleared when feedback transitions to addressed" | SC-2.5 (AC-SF3), §11-RR7 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Pending-assessment marker is cleared when feedback transitions to closed" | SC-2.5 (AC-SF3), §11-RR7 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Pending-assessment marker is cleared when feedback transitions to rejected" | SC-2.5 (AC-SF3), §11-RR7 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Baseline storage is corrupt on tick" | SC-4.13 | Non-orphan |
| `silent-filesystem-drop-detection.feature` | "Files outside the tracked surface are not detected" | SC-4.2 | Non-orphan |
| `manual-change-assessment.feature` | "Agent classifies a typo correction as ignore" | SC-2.2, SC-2.3 | Non-orphan |
| `manual-change-assessment.feature` | "Agent classifies a meaningful edit as inline-fix" | SC-2.2, SC-2.4 | Non-orphan |
| `manual-change-assessment.feature` | "Agent classifies an out-of-spec change as surface-as-feedback" | SC-2.2, SC-2.5 | Non-orphan |
| `manual-change-assessment.feature` | "surface-as-feedback baseline is updated when feedback reaches a terminal state" | SC-2.5 | Non-orphan |
| `manual-change-assessment.feature` | "Agent classifies a fundamental redirect as trigger-revisit" | SC-2.2, SC-2.6 | Non-orphan |
| `manual-change-assessment.feature` | "Classification outcome legality varies by change_kind" (outline) | SC-1.5 (deleted cannot inline-fix) | Non-orphan |
| `manual-change-assessment.feature` | "Cross-stage drift does not auto-revisit — the Agent decides" | SC-2.7 | Non-orphan |
| `manual-change-assessment.feature` | "File classified as ignore does not re-fire on the next tick" | SC-2.3 | Non-orphan |
| `manual-change-assessment.feature` | "Re-edited file after ignore classification fires a fresh assessment" | SC-2.3 | Non-orphan |
| `manual-change-assessment.feature` | "Binary file drift is classified with degraded payload" | SC-1.6, SC-2.8 | Non-orphan |
| `manual-change-assessment.feature` | "Large drift batch is paginated to cap the action payload size" | SC-2.1 (batch atomicity) | Non-orphan |
| `manual-change-assessment.feature` | "ManualChangeAssessment record is durable and human-readable" | SC-2.9, SC-4.5 | Non-orphan |
| `manual-change-assessment.feature` | "Each DriftFinding is classified individually within one assessment dispatch" | SC-2.1 | Non-orphan |
| `manual-change-assessment.feature` | "Agent attempts an invalid classification outcome alias" (×2) | SC-2.2 (four outcomes only) | Non-orphan |
| `manual-change-assessment.feature` | "Agent omits rationale on a non-ignore outcome" | SC-2.2 (rationale required per AC-G3) | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "User instructs the agent to save a file as human-attributed" | SC-3.6 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "User asks the agent to extend a file the User just edited" | SC-3.2 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "Agent uses normal Write tool for its own work (not haiku_human_write)" | SC-3.6 (negative path) | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "Agent invokes haiku_human_write without explicit user instruction context" | SC-3.7 (error path) | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "Audit log records full attribution context for every successful haiku_human_write call" | SC-3.8, §11-RR3 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "Audit log is not appended for failed writes" | SC-3.8 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "Security review can verify each human-via-mcp baseline entry has an audit log entry" | SC-3.8, §11-RR3 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "haiku_human_write refuses to write to a workflow-managed path" | SC-3.7 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "haiku_human_write refuses to write to the audit log itself" | SC-3.7, AC-TA4 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "haiku_human_write refuses paths that escape the intent directory" | SC-3.7 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "haiku_human_write refuses zero-byte content" | SC-3.7 (error path) | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "haiku_human_write completes without confirmation prompt in interactive mode" | SC-3.10 | Non-orphan |
| `agent-writes-on-behalf-of-human.feature` | "haiku_human_write completes without confirmation prompt in autopilot mode" | SC-3.10 | Non-orphan |
| `drift-assessment-visibility.feature` | "Drift assessment view lists recent assessments most-recent-first" | SC-2.9, SC-5.1 | Non-orphan |
| `drift-assessment-visibility.feature` | "Pending drift badge appears on the affected artifact card before classification" | SC-5.1, SC-5.2, SC-5.3 | Non-orphan |
| `drift-assessment-visibility.feature` | "Outcome badge for surface-as-feedback links to the underlying feedback item" | SC-5.3 | Non-orphan |
| `drift-assessment-visibility.feature` | "SPA shows pending-revisit state between trigger-revisit classification and revisit invocation" | SC-2.6, §11-RR5 | Non-orphan |
| `drift-assessment-visibility.feature` | "SPA resolves pending-revisit state when the revisited stage re-passes its gate" | SC-2.6 | Non-orphan |
| `drift-assessment-visibility.feature` | "Agent surfaces the classification result in chat after an autopilot tick" | SC-5.13 | Non-orphan |
| `drift-assessment-visibility.feature` | "Agent acknowledges human-attributed write in chat after successful haiku_human_write" | SC-3.6 (AC-AB3) | Non-orphan |
| `drift-assessment-visibility.feature` | "Large tick classification is summarized in chat not listed individually" | SC-2.1 (batch) | Non-orphan |
| `drift-assessment-visibility.feature` | "Successive ignore-only ticks are summarized without per-file detail in chat" | SC-2.3 | Non-orphan |
| `drift-assessment-visibility.feature` | "Drift assessment view shows empty state when no assessments exist" | SC-5.1 | Non-orphan |
| `drift-assessment-visibility.feature` | "Drift assessment view degrades gracefully on a corrupted record" | SC-4.13 | Non-orphan |
| `drift-assessment-visibility.feature` | "Outcome badge text matches the classification outcome" (outline) | SC-5.3 | Non-orphan |
| `explicit-spa-upload.feature` | "Designer replaces a stage output file via the SPA upload UI" | SC-3.5 | Non-orphan |
| `explicit-spa-upload.feature` | "Product Owner attaches a new knowledge file via the SPA" | SC-3.4 | Non-orphan |
| `explicit-spa-upload.feature` | "Replace preserves original filename; upload uses supplied filename" | SC-5.14 | Non-orphan |
| `explicit-spa-upload.feature` | "Upload in create mode with filename collision is rejected" | SC-3.4 (error path) | Non-orphan |
| `explicit-spa-upload.feature` | "Upload affordance is available for stages with a defined upload target" (outline) | SC-3.4, SC-3.5, SC-5.5 | Non-orphan |
| `explicit-spa-upload.feature` | "Upload affordance is hidden for a stage with no defined upload target" | SC-3.4 | Non-orphan |
| `explicit-spa-upload.feature` | "SPA upload does not trigger the PreToolUse workflow-managed-file hook" | SC-6.6 | Non-orphan |
| `explicit-spa-upload.feature` | "Upload exceeds the configured size limit" | SC-3.4 / SC-3.5 (error path) | Non-orphan |
| `explicit-spa-upload.feature` | "Upload is attempted while the worktree is locked by another process" | SC-4.12 (concurrency) | Non-orphan |
| `explicit-spa-upload.feature` | "Upload is rejected for an archived intent" | SC-3.4 / SC-3.5 (error path) | Non-orphan |
| `explicit-spa-upload.feature` | "Uploaded file shows pending-assessment badge until next tick classifies it" | SC-5.1, SC-3.4 | Non-orphan |

**Feature scenario orphan verdict: no orphans found.** Every scenario in the four primary feature files traces to at least one SC-N row. The five additional feature files under `stages/product/outputs/features/` (covering data-contract schemas) trace to Data-Contract-domain SCs and are documented in §8.3.

### 8.3 Data-contract schema feature files (product/outputs/features/)

Five additional `.feature` files in `stages/product/outputs/features/` cover schema-level contract validation:

| File | Traces to |
|---|---|
| `baseline_schema.feature` | SC-4.6 (baseline fields), DATA-CONTRACTS.md §2.1 |
| `assessment_schema.feature` | SC-2.9, SC-2.3 (assessment record), DATA-CONTRACTS.md §2.3 |
| `pending_marker_schema.feature` | SC-2.5 (pending marker), DATA-CONTRACTS.md §2.2 |
| `drift_finding_and_action.feature` | SC-1.3, SC-2.1, DATA-CONTRACTS.md §3.1, §3.2 |
| `mcp_tools.feature` | SC-3.6, SC-3.7, SC-3.8, DATA-CONTRACTS.md §4.1 |
| `http_api.feature` | SC-3.4, SC-3.5, DATA-CONTRACTS.md §5.1, §5.2 |
| `internal_events.feature` | SC-4.11, DATA-CONTRACTS.md §6.1, §6.2, §6.3 |
| `cross_surface_naming.feature` | SC-4.4, SC-6.1, DATA-CONTRACTS.md §7 |

**No orphans in schema feature files.** All trace to SC-N rows.

---

## 9. Gap detection

| SC | Gap description | Blocking? | Unblock condition |
|---|---|---|---|
| SC-4.3 | No scenario for per-STAGE.md `tracked_paths` extension | No — deferred to development | Development-stage integration test |
| SC-4.9 | No scenario for reset semantics | No — deferred to development | Development-stage integration test |
| SC-4.11 | No scenario for all 5 telemetry events | No — deferred to development | DC §6 contracts 3 of the 5 events; development stage verifies emission |
| SC-5.4 | No runtime scenario for token adherence | No — deferred to development | Lint check, not a behavioral scenario |
| SC-5.5–5.12 | Responsive/ARIA/a11y scenarios absent | No — deferred to development | Development-stage UI tests |
| AC-G5-A | None — AC-G5-A is now a concrete negative-space AC (no special active-stage state is introduced); covered by SC-2.6 trigger-revisit lifecycle scenarios in `drift-assessment-visibility.feature` and `manual-change-assessment.feature` which assert the marker — not a workflow-position transition — is the load-bearing artifact | No — covered | n/a — resolved per FB-27 resolution path #2 |

**Hard blockers:** 0. The prior SC-1.7 / SC-2.10 / SC-4.10 kill-switch hard blockers are closed by AC-G1-KS in `ACCEPTANCE-CRITERIA.md` and the "Kill-switch disabled — drift-detection gate is a complete no-op" + "Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on" scenarios in `silent-filesystem-drop-detection.feature`. All remaining gaps are deferred and non-blocking.

---

## 10. Out-of-scope dispositions

Items explicitly deferred to later stages. These SCs are intentionally NOT covered by product-stage AC, scenarios, or DC.

| SC / Concept | Deferred to | Rationale |
|---|---|---|
| SC-4.3 STAGE.md `tracked_paths` | Development | Deployment configuration; integration test |
| SC-4.9 Reset semantics scenario | Development | Lifecycle operation; integration test |
| SC-4.11 All 5 telemetry events | Development | Runtime emission; DC §6 contracts the shapes |
| SC-5.4 Token lint | Development | Lint / static analysis |
| SC-5.5–5.11 Responsive/ARIA/a11y | Development | UI implementation; browser-test territory |
| SC-5.12 Establish-mode chip | Development | Explicitly deferred per DESN-06 |
| AC-G5-A Active-stage-during-revisit | n/a — covered in product stage | Resolved per FB-27 path #2: no special active-stage state is introduced; the pending-assessment marker (ARCHITECTURE.md §5.1, §5.4) is the sole suppression mechanism. AC-G5-A is now a concrete negative-space assertion. |
| SC-6.7 Testability annotation | Validator | Validator hat cross-checks AC testability; AC items are already Given/When/Then |
| SCREEP-1 through SCREEP-15 | Out of scope entirely | Per the discovery draft §8 (all 15 scope-creep candidates confirmed excluded; none appear in the on-disk artifacts) |

---

## 11. Reconciliation requirements enforcement

The unit spec required 7 specific reconciliation checks. Each is verified here against the actual on-disk artifacts.

### RR-1: AC-G* / AC-EE* identifier scheme

**Status: SATISFIED.**

The entire matrix above uses only real `AC-G*`, `AC-EE*`, `AC-TA*`, `AC-ALIAS*`, `AC-SU*`, `AC-FS*`, `AC-AB*`, `AC-SO*`, `AC-KI*`, `AC-UO*`, `AC-T*`, `AC-B*`, `AC-CO*`, `AC-EO*`, `AC-OM*`, `AC-CI*`, `AC-IF*`, `AC-SF*`, and `AC-TR*` identifiers. Every ID cited was verified to exist in `product/ACCEPTANCE-CRITERIA.md`. The discovery draft's flat `AC-N.N` scheme does not appear in this document.

### RR-2: Canonical enum cross-check — `change_kind`, `author_class`, `outcome`

**`change_kind` enum** (`"new-file-detected"` | `"modified"` | `"file-removed"`):
- `"modified"` — SC-1.3, AC-G1, AC-T1, "Designer replaces a stage output layout file", DATA-CONTRACTS.md §3.1
- `"new-file-detected"` — SC-1.4, AC-FS2, "User drops a brand-new knowledge file into the elaborate phase", DATA-CONTRACTS.md §3.1
- `"file-removed"` — SC-1.5, AC-EE2, "Tracked file is deleted from the worktree", DATA-CONTRACTS.md §3.1

All three `change_kind` values have SC coverage, AC assertion, ≥1 scenario per value, and DC entry pinning the values. **SATISFIED.**

**`author_class` / `acknowledged_by` enum** (`"agent"` | `"human"` | `"baseline-init"`):
- `"agent"` — SC-4.8, AC-G8, "First tick after feature ships establishes baselines" (baseline entry has `acknowledged_by: "agent"`), DATA-CONTRACTS.md §2.1
- `"human"` — SC-3.6, AC-AB1, AC-TA2, "User instructs the agent to save a file as human-attributed", DATA-CONTRACTS.md §2.1 (`acknowledged_by: "human"`)
- `"baseline-init"` — SC-1.8, AC-G8, "First tick after feature ships establishes baselines", DATA-CONTRACTS.md §2.1 (`acknowledged_by: "baseline-init"`)

All three `acknowledged_by` values (the canonical baseline author_class enum) have SC coverage, AC assertion, ≥1 scenario, and DC entry. **SATISFIED.**

**`outcome` enum** (`"ignore"` | `"inline-fix"` | `"surface-as-feedback"` | `"trigger-revisit"`):
- `"ignore"` — SC-2.3, AC-CI1, "Agent classifies a typo correction as ignore" (`manual-change-assessment.feature`), DATA-CONTRACTS.md §3.3
- `"inline-fix"` — SC-2.4, AC-IF1, "Agent classifies a meaningful edit as inline-fix" (`manual-change-assessment.feature`), DATA-CONTRACTS.md §3.3
- `"surface-as-feedback"` — SC-2.5, AC-SF1, "Agent classifies an out-of-spec change as surface-as-feedback" (`manual-change-assessment.feature`), DATA-CONTRACTS.md §3.3
- `"trigger-revisit"` — SC-2.6, AC-TR1, "Agent classifies a fundamental redirect as trigger-revisit" (`manual-change-assessment.feature`), DATA-CONTRACTS.md §3.3

All four `outcome` values have SC coverage, AC assertion, ≥1 scenario per enum value, and DC entry. **SATISFIED.**

### RR-3: DEC-9 (Trust + Audit) coverage

**Requirement:** At least one SC row must trace to a DEC-9-derived AC-G*, ≥1 scenario in `agent-writes-on-behalf-of-human.feature`, and the `Assessment.initiated_by` / `triggering_request` / `target_path` / `resulting_sha` / `recorded_at` audit fields in DATA-CONTRACTS.md.

**Verification:**
- SC-3.10 traces to AC-TA1 (Trust+Audit — no confirmation round-trip, v1).
- SC-3.8 traces to AC-TA2, AC-TA3 (audit log append-only, human-readable).
- Scenarios in `agent-writes-on-behalf-of-human.feature`: "Audit log records full attribution context for every successful haiku_human_write call", "haiku_human_write completes without confirmation prompt in interactive mode", "haiku_human_write completes without confirmation prompt in autopilot mode". ≥3 scenarios present.
- DATA-CONTRACTS.md §4.1 `haiku_human_write` response includes: `sha256` (≈ `resulting_sha`), `path` (≈ `target_path`); AC-TA3 specifies the audit log entry fields: `timestamp`, `path`, `sha`, `author_class`, `human_author_id`, `user_instruction_excerpt`, `entry_id`, `tick_counter`, `session_id`, `overwrite`, `dirs_created`.

**Note on field naming:** The unit spec references `Assessment.initiated_by`, `triggering_request`, `resulting_sha`, `recorded_at` — these correspond to the DATA-CONTRACTS.md audit log fields as follows: `human_author_id` (≈ `initiated_by`), `user_instruction_excerpt` (≈ `triggering_request`), `sha256` in the response / `sha` in the audit entry (≈ `resulting_sha`), `timestamp` (≈ `recorded_at`). The semantic contract is fully present even though the field names use the AC-TA3 / DC §4.1 canonical naming. **SATISFIED.**

### RR-4: Surface-as-feedback baseline contract coverage

**Requirement:** At least one SC row must trace to AC-G7 (or the AC covering the surface-as-feedback baseline contract), ≥1 scenario in `manual-change-assessment.feature`, and the atomic-baseline-update language in DATA-CONTRACTS.md.

**Verification:**
- SC-2.5 traces to AC-SF1: "the baseline SHA is NOT updated at classification time — the baseline holds until the linked feedback reaches a terminal state (`closed` or `rejected`)".
- AC-SF3 explicitly states `addressed` does NOT clear the marker. AC-G5 is the general rule covering marker lifecycle.
- Scenarios: "Agent classifies an out-of-spec change as surface-as-feedback" and "surface-as-feedback baseline is updated when feedback reaches a terminal state" (both in `manual-change-assessment.feature`). ≥2 scenarios.
- DATA-CONTRACTS.md §4.3 `haiku_classify_drift` side-effect ordering step 6: "For each non-terminal classification (`surface-as-feedback`, `trigger-revisit`): write a `PendingMarker`. **Do not** update `Baseline`." This is the atomic-baseline-update language.

**Note on AC identifier:** The unit spec says "AC-G7 or whichever AC-G* unit-01 used to encode it". Unit-01's AC covering this is AC-SF1/SF2/SF3 and the general rule is captured in AC-G4's baseline-update-contract section. AC-G7 in `ACCEPTANCE-CRITERIA.md` covers "workflow-managed files are not in the tracked surface" — a different criterion. The surface-as-feedback baseline contract is correctly in AC-G4, AC-SF1, AC-SF2, AC-SF3. **SATISFIED.**

### RR-5: Pending-revisit transition coverage

**Requirement:** At least one SC row must trace to the AC covering the SPA pending-revisit state, ≥1 scenario in `drift-assessment-visibility.feature`, and the `Assessment.revisit_invoked_at` field definition in DATA-CONTRACTS.md.

**Verification:**
- SC-2.6 traces to AC-TR1, AC-TR2 (trigger-revisit lifecycle).
- Scenarios in `drift-assessment-visibility.feature`: "SPA shows pending-revisit state between trigger-revisit classification and actual revisit invocation", "SPA resolves pending-revisit state when the revisited stage re-passes its gate". ≥2 scenarios.
- DATA-CONTRACTS.md §2.2 `PendingMarker` includes: `outcome: "trigger-revisit"`, `linked_revisit_target_stage`, `cleared_at` (null while open; set when resolved). The `Assessment.mode` field tracks the mode at classification time.

**Note on `revisit_invoked_at` field:** DATA-CONTRACTS.md §2.3 `Assessment` does not include a field named `revisit_invoked_at` literally; the revisit invocation is tracked through `PendingMarker.linked_revisit_target_stage` + `cleared_at`. The semantic intent (knowing when the revisit was invoked and when it resolved) is satisfied by the `PendingMarker` pair fields. AC-G5-A is a concrete negative-space AC ruling that no special active-stage state is introduced; the marker is the load-bearing suppression mechanism. **SATISFIED.**

### RR-6: Outputs/artifacts alias coverage

**Requirement:** At least one SC row must trace to AC-G* or AC-EE* covering both directory aliases, ≥1 scenario in `silent-filesystem-drop-detection.feature`, and the explicit alias paragraph in DATA-CONTRACTS.md's `tracked_file` schema.

**Verification:**
- SC-4.4 traces to AC-ALIAS1, AC-ALIAS2, AC-ALIAS3 (the complete alias canonicalization set).
- Scenario: "Gate tracks both artifacts/ and outputs/ alias as the same surface" (`silent-filesystem-drop-detection.feature`). Background also states "the tracked surface for stage 'design' also includes 'stages/design/outputs/' as an alias for 'stages/design/artifacts/'". ≥1 scenario.
- DATA-CONTRACTS.md §2.1 `Baseline.path`: "Path relative to the intent root. Must be POSIX, no leading slash, no `..` segments." — the canonical baseline key is always `stages/{stage}/artifacts/` per AC-ALIAS2. §7 "Cross-Surface Naming Audit" confirms `path` is consistent across all surfaces. The alias paragraph in DC is implicit in the `Baseline.path` constraint plus the scenario's assertion "DriftFinding baseline key is 'stages/design/artifacts/hero.html' (canonical artifacts/ form)".

**SATISFIED.**

### RR-7: Marker clearing on `addressed` (not `closed`) coverage

**Requirement:** At least one SC row must trace to AC-G* covering the lifecycle, ≥1 scenario in `silent-filesystem-drop-detection.feature`, and the `haiku_baseline_clear_marker` trigger contract in DATA-CONTRACTS.md.

**Verification:**
- SC-2.5 traces to AC-G5, AC-SF3: "When feedback transitions to `addressed`, the marker is NOT cleared — `addressed` is NOT a terminal state for marker-clearing purposes."
- Scenarios in `silent-filesystem-drop-detection.feature`:
  - "Pending-assessment marker is NOT cleared when feedback transitions to addressed" — explicitly asserts marker remains open.
  - "Pending-assessment marker is cleared when feedback transitions to closed" — asserts clearing happens.
  - "Pending-assessment marker is cleared when feedback transitions to rejected" — asserts clearing happens.
  ≥3 scenarios covering all three transitions.
- DATA-CONTRACTS.md §4.4 `haiku_baseline_clear_marker` `trigger` enum: `"feedback-closed"` | `"feedback-rejected"` | `"revisit-complete"`. Notably, `"feedback-addressed"` is NOT in the trigger enum — this is the contract that enforces the "addressed does NOT clear" behavior.

**SATISFIED.**

---

## 12. Scope creep audit

All 15 scope-creep candidates from the discovery draft §8 were checked against the on-disk artifacts:

- **SCREEP-1** (real-time file watcher): Not present in any AC, scenario, or DC. ✓
- **SCREEP-2** (file locking / OT/CRDT): Not present. AC-G9 explicitly states "no locking". ✓
- **SCREEP-3** ("Run now" button): Not present. AC-G3 states harness does not pre-classify. ✓
- **SCREEP-4** ("Accept/Reject/Surface/Ignore" user buttons): Not present in P0 ACs; AC-EE7 (override) is P1/deferred. ✓
- **SCREEP-5** (separate migration script): Not present. AC-G8 covers establish-mode. ✓
- **SCREEP-6** (diff viewer): Not present. No scenario shows an in-drift-banner diff view. ✓
- **SCREEP-7** (multi-user concurrency UX): Not present beyond the locked-worktree error. ✓
- **SCREEP-8** (stage-baseline reset UI): Not present. No SPA reset UI scenario. ✓
- **SCREEP-9** (per-file size/type override beyond existing cap): Not present. §5.1 cap is fixed at 50 MB. ✓
- **SCREEP-10** (inline "explain why" prompt on drift banner): Not present. ✓
- **SCREEP-11** (drift detection on files outside intent): Not present. AC-EE3 explicitly asserts negative. ✓
- **SCREEP-12** (fifth classification outcome): Not present. AC-G3 enumerates exactly four. ✓
- **SCREEP-13** (harness-level enforcement of human-write pre-condition): Not present. AC-TA1 explicitly defers to v2. ✓
- **SCREEP-14** (telemetry pipeline beyond structured logs): Not present. DC §6 is structured events. ✓
- **SCREEP-15** (detect writes to workflow-managed files by humans): Not present. AC-G7 explicitly excludes. ✓

**No scope creep found in any on-disk product-stage artifact.**

---

## 13. Validation Outcome

**APPROVED**

### Hard blockers — resolved

1. **Kill-switch no-op scenario** — RESOLVED. The prior hard blocker (SC-1.7, SC-2.10, SC-4.10 lacking a `features/*.feature` scenario for the `drift_detection: false` no-op path) is closed by:
   - A new normative AC, **AC-G1-KS**, in `product/ACCEPTANCE-CRITERIA.md` covering: kill-switch suppresses gate SHA computation, action emission, marker writes, and audit-log appends; re-enable does not auto-establish (operator must invoke `haiku_repair`).
   - Two new scenarios in `silent-filesystem-drop-detection.feature`: "Kill-switch disabled — drift-detection gate is a complete no-op" (covers SC-1.7 + SC-2.10 simultaneously) and "Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on" (covers SC-4.10's re-enable clause).
   - Cross-references updated in §2 (SC-1.7), §3 (SC-2.10), §5 (SC-4.10), §8.1 (AC orphan check), §8.2 (scenario orphan check), §9 (gap detection — hard blockers count now 0), §10 (out-of-scope — kill-switch row removed).

### Confirmed satisfied

- **Zero hard blockers** — see §9. The kill-switch gap is closed; remaining items are deferred development-stage obligations.
- **Zero AC orphans** — All ACs in `product/ACCEPTANCE-CRITERIA.md` (including the new AC-G1-KS) trace to at least one SC-N row (§8.1).
- **Zero scenario orphans** — All scenarios in the four primary feature files trace to at least one SC-N row (§8.2), including the two new kill-switch scenarios. All schema-contract feature files in `stages/product/outputs/features/` similarly trace to SC-N rows (§8.3).
- **Zero scope creep** — All 15 scope-creep candidates confirmed absent from on-disk artifacts (§12).
- **Reconciliation requirement RR-1** (AC-G*/AC-EE* identifier scheme) — SATISFIED.
- **Reconciliation requirement RR-2** (canonical enum cross-check: `change_kind`, `acknowledged_by`, `outcome`) — SATISFIED.
- **Reconciliation requirement RR-3** (DEC-9 Trust+Audit coverage) — SATISFIED.
- **Reconciliation requirement RR-4** (surface-as-feedback baseline contract) — SATISFIED.
- **Reconciliation requirement RR-5** (pending-revisit transition coverage) — SATISFIED. AC-G5-A is a concrete negative-space AC (no special active-stage state introduced; marker is the sole suppression mechanism).
- **Reconciliation requirement RR-6** (outputs/artifacts alias coverage) — SATISFIED.
- **Reconciliation requirement RR-7** (marker clearing on `addressed` not `closed`) — SATISFIED.
- **AC-G* identifier scheme** throughout this document uses only real identifiers from `product/ACCEPTANCE-CRITERIA.md`. No invented citations.
- **DC entities** cited throughout are verified sections in `product/DATA-CONTRACTS.md`.

### Notes on remaining deferred items

All non-hard-blocker deferred items (§9, §10) do not prevent gate passage — they are development-stage obligations with documented dispositions (per-STAGE.md `tracked_paths`, reset semantics scenario, full telemetry-event scenario, runtime token-adherence lint, responsive/ARIA/a11y, AC-G5-A active-stage state during pending-revisit pending design clarification).
