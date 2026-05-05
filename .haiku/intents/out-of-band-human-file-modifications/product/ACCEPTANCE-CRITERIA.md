# Acceptance Criteria — Out-of-band Human File Modifications

> **Scope axis:** acceptance-criteria — what "done" looks like from the user's perspective.
> Sibling artifacts in this stage cover behavioral spec (`.feature` files), data contracts (DATA-CONTRACTS.md), and coverage mapping (COVERAGE-MAPPING.md); their substance is not duplicated here.
> Implementation details (tool signatures, baseline storage format, gate ordering) are out of scope for this artifact — design-stage decisions in ARCHITECTURE.md feed back into AC at refinement time.
>
> **Reconciliation note (unit-01):** Five cross-document gaps surfaced during pre-execute review and are addressed in this revision:
> 1. DEC-9 stance resolved: Trust+Audit (replaces AC-AB4 placeholder).
> 2. `surface-as-feedback` baseline contract corrected: baseline is NOT updated at classification time.
> 3. Active-stage transition during pending `trigger-revisit` marker — resolved as a concrete testable AC (AC-G5-A): no special active-stage state is introduced; the pending-assessment marker (per ARCHITECTURE.md §5.1, §5.4) is the sole suppression mechanism. The active stage's workflow position is unchanged by marker presence.
> 4. `outputs/` → `artifacts/` alias canonicalization added (AC-ALIAS*).
> 5. Terminal-state clarification: `closed` and `rejected` clear markers; `addressed` does NOT.

---

## Variability Brief

The behavior of out-of-band detection and reaction varies along the following dimensions. Each is enumerated here so the General Rules and variant-specific subsections below can be grounded.

1. **Write-path origin** — Three sanctioned origins produce the same downstream detection signal but differ at the entry point:
   - `spa-upload` — file authored via the browse/review SPA upload affordance.
   - `filesystem-drop` — file written directly into the worktree (designer's local tool, IDE save, drag-and-drop, `cp`, etc.) with no SPA involvement.
   - `agent-on-behalf` — agent writes via the sanctioned human-attributed MCP tool in response to a user instruction in chat ("hey claude write this file").
2. **Tracked-surface class** — The file under drift detection falls into one of three classes:
   - `stage-output` — a deliverable file produced by a stage hat. Canonical directory: `stages/{stage}/artifacts/`. Alias: `stages/{stage}/outputs/` maps to `artifacts/` — see AC-ALIAS1.
   - `knowledge-input` — a reference / context file in a stage's knowledge directory (research notes, design tokens, market data).
   - `unit-output` — a file produced by a hat during execution within a unit's working surface (v1 boundary set by design stage; see AC-UO1).
3. **File payload type** — Diff payload available to the agent at classification time:
   - `text` — full unified diff is meaningful and shown.
   - `binary` — only file-changed signal + size delta + mime hint; no textual diff.
4. **Stage-of-ownership vs. active stage** — The drifted file may be owned by:
   - `current` — the stage currently active on this intent.
   - `earlier` — a stage upstream of the active stage (already-passed gate).
   The harness does not branch on this dimension; the agent's classification step decides whether earlier-stage drift triggers revisit.
5. **Operating mode** — At drift-detection time the intent is in one of:
   - `interactive` (HITL) — agent is in conversation with a human.
   - `pickup` (OHOTL) — `/haiku:pickup` resumed; one human is on call but not actively chatting.
   - `autopilot` (AHOTL) — `/haiku:autopilot` is driving without human-in-loop.
   Mode does not change the detection path; it changes how the assessment outcome is surfaced to the human (silent log vs. confirmation prompt). v1 default behavior is consistent across all three modes (silent classification, surfaced via the SPA's drift assessment view and the chat surface on the next turn).
6. **First-tick-after-upgrade vs. steady-state** — On the first tick after the feature ships for any existing intent, the gate must establish baselines without firing assessments. After that, steady-state detection applies.
7. **Classification outcome** — One of four:
   - `ignore` — change observed, no further action; baseline updates immediately.
   - `inline-fix` — agent absorbs the change into the current bolt; baseline updates immediately.
   - `surface-as-feedback` — open feedback item created; baseline does NOT update at classification time (pending-assessment marker written); baseline updates when feedback reaches a terminal state (`closed` or `rejected`).
   - `trigger-revisit` — earlier stage revisited; baseline does NOT update at classification time (pending-assessment marker written); baseline updates when revisit completes.

---

## User Stories

### US-01: Designer Replaces a Stage Output File

**As** a designer collaborating on an active intent,
**I want to** replace a stage output file (layout HTML, figma export, screenshot) by saving over it in the worktree,
**so that** my updated design lands in the lifecycle without me having to invoke MCP tools or fight the framework.

**Priority:** P0

### US-02: Product Owner Edits a Deliverable and Asks the Agent to Extend

**As** a product owner reviewing a deliverable mid-flight,
**I want to** make a small edit to a file the agent produced and then ask the agent in chat to "extend this,"
**so that** the agent treats my edit as the new baseline and builds on it instead of regenerating from its prior state.

**Priority:** P0

### US-03: User Drops Knowledge Into the Elaborate Phase

**As** a user with reference material relevant to inception/elaboration,
**I want to** drop a knowledge file (research notes, design tokens, market data) into the intent's knowledge directory or upload it via the SPA,
**so that** the agent picks it up on the next workflow tick and integrates it into the elaboration phase without me having to paste it into chat.

**Priority:** P0

### US-04: User Asks the Agent to Write a Knowledge File on Their Behalf

**As** a user in conversation with the agent,
**I want to** say "hey claude, save this Tailwind config to the design references" and have the resulting file land as a human-attributed write,
**so that** the file is tracked as out-of-band human content (subject to drift detection on subsequent ticks) rather than as an agent-generated artifact.

**Priority:** P0

### US-05: User Reviews a Drift Assessment Decision in the SPA

**As** a user (designer, PO, or anyone reviewing the intent),
**I want to** see what files changed out-of-band, what the agent classified each change as, and the rationale,
**so that** I can verify the agent's response to my edits and understand how my change was handled.

**Priority:** P0

### US-06: User Catches a Misclassification and Overrides

**As** a user reviewing a drift assessment in the SPA,
**I want to** override the agent's classification (e.g., elevate an "ignore" to "trigger-revisit", or downgrade a "trigger-revisit" to "inline-fix") with a reason,
**so that** misclassifications don't silently waste a stage or silently drop my intent.

**Priority:** P1

### US-07: User Drops a Binary Stage Output (Image, Figma Export)

**As** a designer replacing a screenshot or exporting a new figma asset over the prior version,
**I want to** the system to treat the file as changed (even though no textual diff is available) and let the agent acknowledge the change without ceremony,
**so that** binary handoffs are not blocked by "I can't read this diff" failures.

**Priority:** P0

### US-08: User Operates an Existing Intent After Feature Upgrade

**As** a user with an active intent that pre-dates this feature shipping,
**I want to** the first tick after upgrade to silently establish baselines without firing a flood of `manual_change_assessment` actions for files that have drifted for unrelated reasons (cleanup, rebases, prior manual edits),
**so that** the upgrade is non-disruptive.

**Priority:** P0

### US-09: User Watches a Cross-Stage Drift Get Surfaced as Feedback or Revisit

**As** a user editing a file owned by an earlier stage (e.g., touching a product-stage spec while the intent is mid-development),
**I want to** the agent to classify the drift and route it appropriately (small typo → ignore or inline-fix; semantic redirect → trigger-revisit; ambiguous → surface-as-feedback),
**so that** earlier-stage edits don't silently corrupt downstream work and don't gratuitously restart the intent for cosmetic changes.

**Priority:** P0

### US-10: User Uses the SPA Upload Affordance Per Stage

**As** a user wanting an explicit upload UI rather than a filesystem drop,
**I want to** upload files through the SPA at the appropriate per-stage target (knowledge for elaborate-class stages, outputs/artifacts for output-producing stages),
**so that** I have a sanctioned, discoverable path that doesn't require me to know the worktree layout.

**Priority:** P1 (filesystem drop covers the base case; SPA upload is a UX upgrade)

### US-11: User Resolves a Pending Drift Assessment by Closing the Underlying Feedback

**As** a user (or agent) closing a feedback item that was opened by `surface-as-feedback`,
**I want to** the pending-assessment marker to clear and the baseline to update to the file's then-current state,
**so that** the same drift doesn't re-fire on the next tick.

**Priority:** P0

### US-12: User Edits a File While the Agent Is Mid-Bolt

**As** a user who realizes mid-bolt they need to tweak a file,
**I want to** edit the file even though the agent is still running, and have the agent see my edit on the next tick (not blocked, not lost),
**so that** I'm never locked out of my own work product.

**Priority:** P0

---

## Acceptance Criteria

### General Rules

#### AC-G1: Drift detection runs on every workflow tick — DEC-1

- **Given** an active intent with at least one tracked file
- **When** `haiku_run_next` is called
- **Then** before any per-state dispatch, a drift-detection gate walks the tracked surface and compares each file's current SHA against its recorded baseline SHA
- **And** any file whose current SHA does not match its baseline is recorded as a drift event for this tick
- *Cites: Decision 1 (DEC-1) — both explicit and implicit detection required.*

#### AC-G1-KS: Kill-switch makes the drift-detection gate a complete no-op — DESN-05

- **Given** the plugin-settings flag `drift_detection: false` is set for the active intent
- **When** `haiku_run_next` is called
- **Then** the drift-detection gate performs zero SHA computations against tracked-surface files
- **And** the gate enumerates zero baseline entries (no `baseline.json` reads, no walk of `artifacts/` / `outputs/` / `knowledge/`)
- **And** zero drift events are emitted for this tick
- **And** no `manual_change_assessment` action is queued on the workflow
- **And** the tick proceeds to per-state dispatch (or to the next gate in the chain) exactly as it would on a tick with zero drift events
- **And** no pending-assessment markers are written, modified, or read
- **And** no entries are appended to `drift-assessments/DA-{NN}.json` or any audit log on account of this gate
- **When** `drift_detection` is later flipped back to `true`
- **Then** the next tick MUST NOT auto-establish a fresh baseline — re-establishment requires an explicit `haiku_repair` invocation by the operator (the existing baseline, if present, is reused; if absent, the gate falls through per AC-EE4's establish-mode fallback)
- **And** no drift events are retroactively emitted for changes that occurred while the kill-switch was off
- **Rationale:** DESN-05 names fail-safe / rollback as a hardened design requirement. The kill-switch must be a complete circuit-breaker — gate, action emission, marker writes, and baseline mutations all suppressed — so an operator can disable the feature mid-incident and rely on framework-pre-feature behavior. Auto-re-establishment on toggle-on would silently re-arm the feature against a now-stale baseline; requiring `haiku_repair` keeps the operator in control of the re-arming step.
- *Cites: DESN-05 (failure-mode rollback). DISCOVERY.md §9 (operator-disables-mid-incident projected scenario). Closes COVERAGE-MAPPING.md §13 hard blockers SC-1.7, SC-2.10, SC-4.10.*

#### AC-G2: Drift events emit a single workflow action per tick — DEC-3

- **Given** one or more drift events recorded on a tick
- **When** the drift-detection gate completes
- **Then** the workflow emits a single `manual_change_assessment` action carrying the full set of drift events for that tick
- **And** the action payload includes, per event: file path, owning stage, file class (`stage-output` / `knowledge-input` / `unit-output`), payload type (`text` / `binary`), unified diff (if text) or change signal (if binary), prior baseline SHA, observed SHA
- **And** no `manual_change_assessment` action is emitted on a tick with zero drift events
- *Cites: DEC-3 — new first-class workflow action, distinct from feedback-triage.*

#### AC-G3: Classification is agent-driven, not harness-driven — DEC-3

- **Given** a `manual_change_assessment` action has been emitted
- **When** the agent processes the action
- **Then** the agent classifies each drift event into exactly one of four outcomes: `ignore`, `inline-fix`, `surface-as-feedback`, `trigger-revisit`
- **And** the harness does not pre-classify based on heuristics (file extension, size delta, file class, payload type)
- **And** the agent's classification rationale is recorded alongside each outcome in the assessment record
- *Cites: DEC-3 — agent owns the classification decision, not the harness.*

#### AC-G4: Baseline-update contract by outcome — ARCHITECTURE.md §5.4

- **Given** an agent classification of a drift event
- **When** the classification is `ignore`
- **Then** the baseline SHA for that file updates immediately to the observed SHA
- **And** no further action is recorded
- **When** the classification is `inline-fix`
- **Then** the baseline SHA for that file updates immediately to the observed SHA
- **And** the agent treats the human's edit as the new input for the current bolt
- **When** the classification is `surface-as-feedback`
- **Then** an open feedback item is created describing the drift
- **And** a pending-assessment marker is recorded for this file
- **And** the baseline SHA is **NOT** updated at classification time — the baseline holds until the linked feedback reaches a terminal state (`closed` or `rejected`)
- **And** the drift-detection gate skips this file on subsequent ticks while the marker is open
- **When** the classification is `trigger-revisit`
- **Then** a revisit is dispatched targeting the stage that owns the drifted file
- **And** a pending-assessment marker is recorded for this file
- **And** the baseline SHA is **NOT** updated at classification time — the baseline holds until the revisit completes
- **And** the drift-detection gate skips this file on subsequent ticks while the marker is open
- *Cites: ARCHITECTURE.md §5.4 (baseline-update contract table — the authoritative reference). Any AC that says "baseline updated immediately on surface-as-feedback" is incorrect; this is the correct contract.*

#### AC-G5: Pending-assessment marker lifecycle — terminal states — ARCHITECTURE.md §5.3

- **Given** a pending-assessment marker is open for a file (from `surface-as-feedback` or `trigger-revisit`)
- **When** the underlying feedback item transitions to `closed`
- **Then** the marker is cleared
- **And** the baseline SHA updates to the file's SHA at marker-clearing time
- **When** the underlying feedback item transitions to `rejected`
- **Then** the marker is cleared
- **And** the baseline SHA updates to the file's SHA at marker-clearing time
- **When** the underlying feedback item transitions to `addressed`
- **Then** the marker is **NOT** cleared — `addressed` is NOT a terminal state for marker-clearing purposes
- **And** the drift-detection gate continues to skip this file while the marker remains open
- **Rationale:** The `addressed` status is not terminal because addressed feedback items can still be reopened. The conservative path is: only `closed` and `rejected` — statuses that cannot be undone — clear the marker and update the baseline.
- **When** the underlying revisit completes (the targeted stage re-passes its gate)
- **Then** the marker is cleared
- **And** the baseline SHA updates to the file's SHA at marker-clearing time
- *Cites: ARCHITECTURE.md §5.3 (marker lifecycle). DEC-4 (eventual consistency).*

#### AC-G5-A: Active-stage workflow position during pending `trigger-revisit` marker — no special state introduced — ARCHITECTURE.md §5.1, §5.4

- **Given** a `trigger-revisit` classification has been recorded for a drifted file owned by a stage earlier than the active stage
- **And** a pending-assessment marker is open for that file (per AC-TR1)
- **And** the targeted upstream-stage revisit has been dispatched but has not yet completed
- **When** the next `haiku_run_next` tick runs against the active stage
- **Then** the active stage's workflow position is **NOT** altered by the open marker — no `awaiting-revisit-resolution` (or equivalently named) workflow state is introduced; the active stage's `state.json` `phase`/`hat`/`bolt` fields are unchanged by marker presence
- **And** the active stage continues whatever phase it was in (elaborate / execute / review / gate) according to its existing tick semantics
- **And** the drift-detection gate skips re-emitting drift events for the marked file (the marker is the sole suppression mechanism per ARCHITECTURE.md §5.1)
- **And** the SPA renders the active stage's workflow position from the active stage's `state.json` exactly as it would absent the marker; the open `trigger-revisit` assessment is rendered separately as an assessment-row badge on the SPA's drift surface, not as a workflow-position transition
- **And** when the revisit completes (per AC-TR2) and the marker clears, the active stage's workflow position remains whatever it was during the open-marker window — clearing the marker triggers a baseline update only, not an active-stage state transition
- **Rationale:** ARCHITECTURE.md §5.1 names the pending-assessment marker as "the mechanism that breaks [the steady-state] loop" — singular. ARCHITECTURE.md §5.4's baseline-update contract table treats the marker as the load-bearing artifact for `trigger-revisit`; the table contains no active-stage state field. Introducing a parallel active-stage workflow state would double-count the suppression mechanism and create a second source of truth for "is this file under pending revisit?" that the marker already answers. The ruling: the marker is necessary and sufficient.
- **Testability:** This AC is verified by the absence of an active-stage state transition in two places: (a) the per-stage `state.json` shows no marker-driven phase/hat changes across the open-marker window, and (b) the SPA's workflow-position rendering for the active stage is identical with and without the marker present. The `drift-assessment-visibility.feature` `pending-revisit` → `revisit-invoked` scenario covers the assessment-row badge transition; this AC asserts the absence of a parallel workflow-position transition.
- *Cites: ARCHITECTURE.md §5.1 (marker is the loop-break mechanism — singular). ARCHITECTURE.md §5.4 (baseline-update contract table — marker is load-bearing artifact, no state field). AC-TR1 (marker recorded at classification, baseline not updated). AC-TR2 (marker cleared and baseline updated when revisit completes). Unit-01 spec, completion criterion #7 (active-stage transition during pending-revisit) — resolved per resolution path #2 from FB-27 (no special state introduced).*

#### AC-G6: Existing PreToolUse hook on workflow-managed files is unchanged — DEC-2

- **Given** an agent attempts to write directly to a workflow-managed file (`units/*.md`, `feedback/*.md`, `intent.md`, `stages/*/state.json`) via `Write` or `Edit`
- **When** the PreToolUse hook fires
- **Then** the write is blocked with the existing redirect message naming the correct MCP tool
- **And** this behavior is identical before and after this feature ships
- *Cites: DEC-2 — agent guardrail boundary is unchanged.*

#### AC-G7: Workflow-managed files are not in the tracked surface — DEC-2, TRACKED-SURFACE-BOUNDARY.md §3.1

- **Given** the drift-detection gate walks the tracked surface
- **When** it encounters a workflow-managed file (`units/*.md`, `feedback/*.md`, `intent.md`, `stages/*/state.json`)
- **Then** the file is excluded from baselining and from drift detection
- **Note:** Workflow-managed files are agent-only by contract. Human writes to them via the filesystem are out of scope for v1; they are treated as the user violating the framework contract, not as a sanctioned out-of-band write.
- *Cites: DEC-2, TRACKED-SURFACE-BOUNDARY.md §3.1.*

#### AC-G8: First-tick-after-upgrade silently establishes baselines — DEC-1, ROLLOUT-AND-BASELINE-ESTABLISHMENT.md §3

- **Given** an intent that existed before the feature shipped, and the feature has now shipped
- **When** the first `haiku_run_next` tick after upgrade runs
- **Then** the gate records a baseline SHA for every file in the tracked surface
- **And** zero `manual_change_assessment` actions are emitted on this first tick, regardless of how many files differ from any prior agent-written state
- **And** the gate records `drift_baseline_established_at` in the per-stage `state.json` so subsequent ticks know to fire assessments
- **And** every pre-existing file is written to the baseline with `author_class: "agent"` (conservative default — no provenance signal available for files that predate the feature)
- *Cites: ROLLOUT-AND-BASELINE-ESTABLISHMENT.md §3.1 (first-tick behavior). DEC-1.*

#### AC-G9: Concurrency model — eventual consistency, no locking — DEC-4

- **Given** the agent is mid-bolt
- **When** a human writes to a tracked file (filesystem, SPA, or via the human-write MCP tool)
- **Then** the write is not blocked
- **And** the agent's mid-bolt work continues without interruption
- **And** the next `haiku_run_next` tick observes the drift via the gate
- **And** the agent's mid-bolt result may be partially based on the pre-edit version of the file; this is accepted behavior, not a bug
- *Cites: DEC-4 (eventual consistency model).*

#### AC-G10: All three write-path origins produce the same downstream detection signal — DEC-1, DEC-7

- **Given** a file is written via `spa-upload`, `filesystem-drop`, or `agent-on-behalf`
- **When** the next workflow tick runs
- **Then** the drift-detection gate observes the SHA mismatch identically in all three cases
- **And** the resulting `manual_change_assessment` action payload does not differ structurally based on origin (the gate only sees SHAs and file content; the origin signal is recorded separately in the assessment record where available, but is not required for classification)
- *Cites: DEC-1 (both explicit and implicit detection), DEC-7 (three write paths, unified by implicit baseline gate).*

#### AC-G11: Drift assessment record is durable and human-readable — ARCHITECTURE.md §4.6

- **Given** an agent classifies a drift event
- **When** the classification is recorded
- **Then** an assessment record is persisted at `stages/{stage}/drift-assessments/DA-{NN}.json` that survives branch switches, worktree operations, and session restarts
- **And** the record contains: timestamp, file path, owning stage, payload type, prior baseline SHA, observed SHA, write-path origin (if known), classification outcome, agent rationale
- **And** the record is visible in the SPA's drift assessment view (US-05)
- **And** records are append-only — no record is modified after writing
- *Cites: ARCHITECTURE.md §4.6.*

#### AC-G12: Same-tick multiple drift events are processed atomically — ARCHITECTURE.md §4.3

- **Given** multiple files have drifted since the last tick
- **When** the gate emits `manual_change_assessment`
- **Then** all drift events are presented to the agent in a single action payload
- **And** the agent's classification of each event is recorded as a single batch
- **And** baselines for all `ignore` / `inline-fix` outcomes update together
- **And** pending-assessment markers for all `surface-as-feedback` / `trigger-revisit` outcomes are recorded together
- *Cites: ARCHITECTURE.md §4.3 (output shape — per-finding classification in single response).*

#### AC-G13: Gate chain ordering — ARCHITECTURE.md §3.1

- **Given** a `haiku_run_next` tick runs
- **When** the pre-tick gate chain executes
- **Then** the ordering is: tamper-detection → feedback-triage → drift-detection → per-state dispatch
- **And** if feedback-triage emits a `feedback_triage` action, the drift-detection gate still runs (the two are independent)
- **And** if tamper-detection fires, the tick halts before either gate runs
- **And** if drift-detection emits findings, per-state dispatch is blocked until `manual_change_assessment` completes
- *Cites: ARCHITECTURE.md §3.1.*

---

### Trust+Audit: DEC-9 Resolved — AC-AB4 Replacement

> **Context:** DEC-9 in DESIGN-DECISIONS.md was deliberately left open at inception with two candidate stances (trust + audit vs. explicit human confirmation). ARCHITECTURE.md §6.3 resolves this decision: **v1 ships Trust+Audit**. The original AC-AB4 placeholder ("stance deferred to design") is removed and replaced by the following concrete criteria.

#### AC-TA1: Human-write MCP tool fires without interrupt-driven human confirmation in v1 — DEC-9, ARCHITECTURE.md §6.3

- **Given** a user instructs the agent in chat to write a specific file (e.g., "save this content to the design references")
- **When** the agent invokes the sanctioned `haiku_human_write` MCP tool
- **Then** the tool completes the disk write without requiring an intermediate `ask_user_visual_question` prompt, UI confirmation, or ambient approval token from the human
- **And** the write proceeds if the path is valid and all inputs meet their constraints
- **Rationale:** The human is present in the conversation and has explicitly given the instruction. Adding a confirmation step to an action the user already authorized is friction, not safety. The audit log is the safety mechanism. (ARCHITECTURE.md §6.3: "The primary use case is interactive — the user is in the chat and their intent is unambiguous.")
- **Note:** Harness-level enforcement (e.g., a hook that checks a human turn precedes the tool invocation) is architecturally possible and deferred to v2. This criterion only governs v1 behavior.
- *Cites: DEC-9 resolved as Trust+Audit. ARCHITECTURE.md §6.3.*

#### AC-TA2: Every `haiku_human_write` invocation appends to a per-intent audit log — DEC-9, MCP-TOOL-CONTRACT.md §8

- **Given** the agent successfully invokes the `haiku_human_write` tool (path valid, inputs accepted)
- **When** the disk write completes
- **Then** a record is appended to the intent-scoped audit log at `.haiku/intents/{slug}/write-audit.jsonl`
- **And** failed writes (e.g., `path_outside_tracked_surface` errors) do NOT append to the audit log — only successful writes are logged
- **And** the audit log is opened in append mode; no prior record is overwritten or deleted
- *Cites: DEC-9 Trust+Audit. MCP-TOOL-CONTRACT.md §8.*

#### AC-TA3: Audit log is human-readable and append-only — DEC-9, MCP-TOOL-CONTRACT.md §8.3

- **Given** the `write-audit.jsonl` file exists for an intent
- **When** a user or security reviewer inspects it
- **Then** the file is directly inspectable with any text viewer or standard shell tools (no proprietary reader required)
- **And** each line is a complete, self-contained JSON object
- **And** each record carries: timestamp (ISO-8601 UTC), entry_id, file path, SHA-256 of content written, `author_class: "human-via-mcp"`, human_author_id (may be null), rationale (may be null), user_instruction_excerpt (first 200 chars of user's message, may be null), tick_counter, session_id (may be null), overwrite flag, dirs_created array
- **And** a security review can verify that every `human-via-mcp` entry in any `baseline.json` has a corresponding audit log entry with user instruction context, confirming the write was accompanied by an explicit human turn
- *Cites: DEC-9 Trust+Audit. MCP-TOOL-CONTRACT.md §8.3 (audit log properties: human-readable, append-only, security posture).*

#### AC-TA4: Audit log path is protected against direct writes — MCP-TOOL-CONTRACT.md §5.2

- **Given** the agent attempts to invoke `haiku_human_write` with path `write-audit.jsonl` or any sub-path resolving to the audit log
- **When** path validation runs
- **Then** the write is refused with `path_outside_tracked_surface` and `reason: "deny_list_match"`
- **And** the audit log is only appended to by the tool itself, never externally writable
- *Cites: MCP-TOOL-CONTRACT.md §5.2 deny-list (write-audit.jsonl explicitly listed).*

---

### Alias Canonicalization: `outputs/` → `artifacts/`

> **Context:** TRACKED-SURFACE-BOUNDARY.md §0 declares `artifacts/` canonical and `outputs/` an alias. Design artifacts (ARCHITECTURE.md, SPA-UI-SPECS.md) sometimes used `outputs/` in examples. This section canonicalizes the naming in acceptance-criteria terms.

#### AC-ALIAS1: `stages/{stage}/outputs/` is implementation-equivalent to `stages/{stage}/artifacts/` — TRACKED-SURFACE-BOUNDARY.md §0

- **Given** any AC, scenario, or implementation that references `stages/{stage}/outputs/` as an output directory
- **When** the path is evaluated by the drift-detection gate, the `haiku_human_write` tool, the SPA upload endpoint, or any other component of this feature
- **Then** `stages/{stage}/outputs/` is treated as an alias for `stages/{stage}/artifacts/`; the behavior is identical
- **And** new code MUST write to `stages/{stage}/artifacts/` and MUST NOT create a separate `outputs/` directory
- **And** if a `stages/{stage}/outputs/` directory exists on disk from a prior artifact (pre-rename), its contents are tracked under the canonical `stages/{stage}/artifacts/` key in `baseline.json`
- *Cites: TRACKED-SURFACE-BOUNDARY.md §0 (canonical directory name declaration).*

#### AC-ALIAS2: Baseline keys use canonical `artifacts/` paths — TRACKED-SURFACE-BOUNDARY.md §6

- **Given** a file located at `stages/{stage}/artifacts/hero.html` (canonical) or discovered via an `outputs/` alias
- **When** the drift-detection gate writes or reads the baseline entry
- **Then** the key in `baseline.json` is `stages/{stage}/artifacts/hero.html` (canonical form)
- **And** no `baseline.json` contains entries with `outputs/` in the key
- *Cites: TRACKED-SURFACE-BOUNDARY.md §6 (baseline storage contract table).*

#### AC-ALIAS3: SPA upload destination selector uses canonical `artifacts/` label — SPA-UI-SPECS.md §2.1

- **Given** the Stage Output Replacement affordance is displayed in the SPA
- **When** a user selects a target directory for their upload
- **Then** the UI labels and API destination parameters use `artifacts/` not `outputs/`
- *Cites: TRACKED-SURFACE-BOUNDARY.md §0, SPA-UI-SPECS.md §2.1.*

---

### Variant: Write-Path Origin — `spa-upload`

#### AC-SU1: SPA upload affordance is available per stage where a target exists

- **Given** the SPA is rendering an intent's stage view
- **When** the stage has a defined upload target (knowledge directory for elaborate-class stages, artifacts directory for output-producing stages)
- **Then** an upload affordance is visible in that stage's view
- **When** the stage has no defined upload target
- **Then** no upload affordance is rendered in that stage's view

#### AC-SU2: SPA upload writes to the worktree and flows through unified detection path

- **Given** a user uploads a file via the SPA upload affordance
- **When** the upload completes
- **Then** the file is written to the appropriate target directory in the worktree (knowledge or artifacts)
- **And** the upload endpoint stamps an action-log entry with `author_class: "human-via-mcp"` but does NOT update `baseline.json` directly
- **And** the next `haiku_run_next` tick's drift-detection gate observes the new or changed file via SHA comparison
- **And** the gate emits a drift event with `author_class: "human-via-mcp"` (read from the action log)
- **And** `manual_change_assessment` fires on that tick exactly as it would for any filesystem-drop or agent-on-behalf write
- **Note:** No fast-path special case for SPA uploads. All three write-path origins flow through the same detection-and-classification pipeline (DEC-1, DEC-7).

#### AC-SU3: SPA upload preserves the file name unless the user renames

- **Given** a user uploads `figma-export-v2.png` via the SPA
- **When** the upload completes
- **Then** the file is written under the original name `figma-export-v2.png`
- **When** a file with the same name already exists at the target path
- **Then** the upload replaces the existing file (the resulting drift is detected and classified by the agent)

---

### Variant: Write-Path Origin — `filesystem-drop`

#### AC-FS1: Manual filesystem writes require zero tooling knowledge — DEC-1

- **Given** a user writes a file directly into the worktree using any local tool (editor save, `cp`, drag-and-drop, IDE)
- **When** the next `haiku_run_next` tick runs
- **Then** the drift-detection gate observes the file as drifted (or new)
- **And** the user did not invoke any MCP tool, skill, or SPA action
- **And** no announcement step is required from the user
- *Cites: DEC-1 (implicit detection is required; system can't rely on human announcing themselves).*

#### AC-FS2: New files are detected as drift events

- **Given** a file at a path inside the tracked surface that has no recorded baseline
- **When** the gate runs
- **Then** the file is recorded as a drift event with a "new file" signal (prior baseline SHA is null)
- **And** the agent's classification covers new files identically to changed files (four outcomes apply)

#### AC-FS3: Editor temp files do not produce false positives

- **Given** a user's editor writes via tempfile-then-rename (e.g., `.foo.txt.swp` then rename to `foo.txt`)
- **When** the gate runs
- **Then** transient temp files matching common editor patterns (e.g., `.*\.swp$`, `.*~$`, `\.#.*`, `4913`, etc.) are excluded from baselining and drift detection
- **And** the post-rename final file is detected normally

---

### Variant: Write-Path Origin — `agent-on-behalf`

#### AC-AB1: Sanctioned MCP tool exists for human-attributed writes — DEC-7, DEC-9

- **Given** a user instructs the agent in chat: "hey claude, save this content to `<path>`"
- **When** the agent decides to honor the instruction
- **Then** the agent invokes the sanctioned MCP tool `haiku_human_write` that writes the file with human attribution
- **And** the agent does NOT use its normal `Write` tool for this purpose
- **And** the resulting file is attributed as `human-via-mcp`, distinct from `agent` (agent's normal writes) and `human-implicit` (inferred filesystem drop)
- *Cites: DEC-7 (three write paths including agent-on-behalf), DEC-9 (trust+audit resolved).*

#### AC-AB2: Agent-on-behalf writes are detected as drift on the next tick — ARCHITECTURE.md §2.3

- **Given** the agent invoked `haiku_human_write` successfully
- **When** the next `haiku_run_next` tick runs
- **Then** the drift-detection gate observes the file as drifted (or new) — identically to any other write-path origin — because `haiku_human_write` does NOT update `baseline.json` at write time
- **And** the resulting `manual_change_assessment` action surfaces with `author_class: "human-via-mcp"`
- **And** the agent classifies this finding as `inline-fix` or `ignore` in the typical case; the classification record is the audit trail that links the human instruction to the write
- **Note:** The agent's own classification step fires on a write the agent itself performed. This is intentional — classification is what binds the human-attributed write into the lifecycle and produces the durable assessment record. See ARCHITECTURE.md §6.3 (third mechanism in trust+audit rationale).
- *Cites: ARCHITECTURE.md §2.3 item 2, §6.3. MCP-TOOL-CONTRACT.md §6.3.*

#### AC-AB3: Conversation surface acknowledges the human-attributed write

- **Given** the agent has invoked `haiku_human_write`
- **When** the agent's response in chat completes
- **Then** the chat surface includes an acknowledgment of the form "saved as a human-attributed file at `<path>` in stage `<stage>`"
- **And** the user understands the write was tracked, not regenerated

---

### Variant: Tracked-Surface Class — `stage-output`

#### AC-SO1: Stage output replacement is detected and classifiable

- **Given** a file in a stage's artifacts directory (e.g., `stages/design/artifacts/layout.html`)
- **When** the file is replaced by a human via any write-path origin
- **Then** the drift-detection gate emits a drift event with `file_class: "stage-output"` and `stage_owner: "design"`
- **And** the agent's classification is dispatched with that context

#### AC-SO2: Stage output drift on a non-active (earlier) stage is classified, not auto-revisited — DEC-5

- **Given** the active stage is `development` and the drifted file is owned by `design`
- **When** the agent classifies the drift event
- **Then** the harness does not automatically dispatch a revisit
- **And** the agent's classification outcome (any of the four) is what determines whether revisit is triggered
- **And** if the classification outcome is `trigger-revisit`, the revisit targets the stage that owns the file (`design`)
- *Cites: DEC-5 (cross-stage drift classification agent-owned, no automatic revisit).*

---

### Variant: Tracked-Surface Class — `knowledge-input`

#### AC-KI1: Knowledge directory drops are detected as new-file drift events

- **Given** a user drops a new file into a stage's knowledge directory (e.g., `stages/inception/knowledge/research-notes.md`) or the intent-level knowledge directory (`knowledge/`)
- **When** the gate runs
- **Then** the file is recorded as a drift event with `file_class: "knowledge-input"`, `stage_owner` set to the owning stage, and "new file" signal (no baseline SHA)
- **And** the agent's classification is dispatched

#### AC-KI2: Knowledge integration during elaborate-class phases biases toward `inline-fix`

- **Given** the active stage is in an elaborate-class phase and a knowledge-input drift event is presented
- **When** the agent classifies the event
- **Then** the agent should classify as `inline-fix` in the typical case (incorporate into elaboration)
- **And** `surface-as-feedback` is appropriate when the upload appears to be intended as a finding rather than a context input
- **And** `ignore` is appropriate when the upload is a duplicate or supersedes a prior knowledge file
- **Note:** This is an agent-judgment guideline, not a harness rule. The harness does not enforce it.

---

### Variant: Tracked-Surface Class — `unit-output`

#### AC-UO1: Unit-output tracking boundary is design-stage decision

- **Open in design (TRACKED-SURFACE-BOUNDARY.md §2):** Whether files inside `units/{unit-slug}/` working directories are part of the tracked surface in v1 is a design-stage decision. The default tracked surface as defined in ARCHITECTURE.md §3.3 does not include unit working directories. AC for this class will be added at design-refinement time if the boundary is extended.
- **What this AC asserts in the meantime:** Until the boundary is extended, the gate MUST NOT enumerate, baseline, or emit drift events for paths under `stages/{stage}/units/{unit-slug}/` working directories. Any drift event the gate produces with `file_class: "unit-output"` in v1 is an implementation bug — the variant exists in the variability brief for forward compatibility, not as a live enforcement target.
- *Cites: TRACKED-SURFACE-BOUNDARY.md §3.1 (workflow-managed files excluded — `units/*.md` is the relevant pattern); ARCHITECTURE.md §3.3 (tracked surface definition).*

#### AC-UO2: v1 unit-output drift is invisible to the gate (negative AC) — TRACKED-SURFACE-BOUNDARY.md §3.1

- **Given** a human writes a file directly into a unit working directory (e.g., `stages/{stage}/units/unit-NN-foo/working-notes.md`) during v1
- **When** the next `haiku_run_next` tick runs
- **Then** the gate does NOT emit a drift event for that file
- **And** no `manual_change_assessment` action is dispatched on account of that file
- **And** no baseline entry is written for `stages/{stage}/units/**` paths
- **And** the framework's behavior is identical to pre-feature behavior for that path
- **Rationale:** This is the negative-space companion to AC-UO1 — it specifies what the gate MUST NOT do for the unit-output variant in v1. It exists so that a contributor reading the spec understands the variant is declared in the variability brief but is intentionally excluded from v1 enforcement, and so that a development-stage test can assert the negative behavior (no events emitted on unit-working-directory writes).
- **Note:** When the design stage extends the boundary to cover a unit-output sub-class (e.g., `stages/{stage}/units/{slug}/artifacts/`), this AC will be revised. The spec should be re-read after any TRACKED-SURFACE-BOUNDARY.md §2 amendment.
- *Cites: TRACKED-SURFACE-BOUNDARY.md §3.1, ARCHITECTURE.md §3.3.*

---

### Variant: File Payload Type — `text`

#### AC-T1: Text-file diff is presented to the agent

- **Given** a drifted file is text (mime detection or extension-based heuristic per TRACKED-SURFACE-BOUNDARY.md §5.1)
- **When** `manual_change_assessment` is emitted
- **Then** the action payload includes a standard unified diff (three lines of context) between the prior baseline content and the observed content
- **And** the diff is suitable for the agent to read and reason about

#### AC-T2: Diff size has a reasonable cap — ARCHITECTURE.md §3.6

- **Given** a drifted file's unified diff exceeds the configured size cap (ARCHITECTURE.md §3.6: first 200 lines)
- **When** the action payload is constructed
- **Then** the diff is truncated with a trailing note indicating truncation
- **And** the file's full path is included so the agent can inspect via `haiku_knowledge_read` or equivalent if classification requires it

---

### Variant: File Payload Type — `binary`

#### AC-B1: Binary drift presents a degraded payload — ARCHITECTURE.md §3.6, TRACKED-SURFACE-BOUNDARY.md §5.4

- **Given** a drifted file is binary (extension matches TRACKED-SURFACE-BOUNDARY.md §5.2 list, or byte content contains null bytes in first 8,192 bytes)
- **When** `manual_change_assessment` is emitted
- **Then** the action payload includes: file path, owning stage, file class, "binary" payload type, prior baseline SHA, observed SHA, `is_binary: true`, `diff_payload: null`
- **And** no textual diff is included

#### AC-B2: Default classification for binary drift is `surface-as-feedback` absent stage context — ARCHITECTURE.md §4.5, TRACKED-SURFACE-BOUNDARY.md §5.5

- **Given** a binary drift event with no contradicting stage context
- **When** the agent classifies the event
- **Then** the default classification is `surface-as-feedback` with rationale "Binary file changed; content diff unavailable. Surfacing for human review."
- **When** the intent is in the `design` stage and the changed file is under `stages/design/artifacts/` and the active hat involves design artifact production
- **Then** the agent MAY classify as `inline-fix` based on the unambiguous context (designer replacement)
- **When** the file is under `knowledge/` and the event type is `added`
- **Then** the agent SHOULD classify as `inline-fix` (fold the reference into the next elaboration bolt)
- **Note:** Agent-judgment guidelines. Harness does not enforce specific outcomes for binary events.

#### AC-B3: Vision tool invocation is permitted but not required

- **Given** the agent receives a binary drift event for an image file
- **When** the agent's classification rationale would benefit from visual inspection
- **Then** the agent may invoke a vision tool (e.g., `Read` on the image, `ask_user_visual_question`) to inform classification
- **And** the agent is not required to do so for any specific case

---

### Variant: Stage-of-Ownership — `current`

#### AC-CO1: Current-stage drift cannot trigger revisit

- **Given** a drift event whose owning stage equals the active stage
- **When** the agent classifies the event
- **Then** the valid classification options are `ignore`, `inline-fix`, or `surface-as-feedback`
- **And** `trigger-revisit` is not a valid outcome for current-stage drift (revisit-of-self is a no-op)
- **And** if the agent attempts to classify as `trigger-revisit` for a current-stage finding, the harness rejects it with a redirect to one of the three valid current-stage outcomes

#### AC-CO2: Current-stage drift assessment record carries `stage_owner: <active>` and surfaces in the active-stage SPA view

- **Given** a drift event whose `stage_owner` equals the active stage
- **When** the agent records its classification (any of the three valid outcomes per AC-CO1)
- **Then** the persisted assessment record at `stages/{active-stage}/drift-assessments/DA-{NN}.json` carries `stage_owner` set to the active stage's name
- **And** the assessment is visible in the active-stage drift assessment view in the SPA (US-05)
- **And** the assessment is NOT cross-listed under any earlier stage's drift assessment view (the file lives only under the owning stage)
- **And** the agent's rationale field references the active hat's working context where applicable (e.g., "current bolt's input file replaced by user — folding into next iteration") rather than cross-stage rationale
- **Note:** This AC distinguishes the current-stage path from AC-EO1 (earlier-stage drift) by record location and rationale framing; the harness uses the same drift-assessment infrastructure for both.

---

### Variant: Stage-of-Ownership — `earlier`

#### AC-EO1: Earlier-stage drift may classify to any of the four outcomes — DEC-5

- **Given** a drift event whose owning stage is earlier than the active stage
- **When** the agent classifies the event
- **Then** all four classification outcomes are valid (`ignore`, `inline-fix`, `surface-as-feedback`, `trigger-revisit`)
- **And** the rationale should reflect the cross-stage nature of the change
- *Cites: DEC-5.*

#### AC-EO2: `inline-fix` on earlier-stage drift does not advance or rewind the workflow — DEC-5

- **Given** an `inline-fix` classification on earlier-stage drift
- **When** the classification is recorded
- **Then** the baseline updates immediately
- **And** the workflow stays on the active stage (no revisit, no re-run of the earlier stage's gate)
- **And** the agent's notion of the earlier stage's outputs is updated for downstream reference but the workflow does not re-validate
- *Cites: DEC-5.*

---

### Variant: Operating Mode — `interactive` / `pickup` / `autopilot`

#### AC-OM1: Detection and classification behave identically across modes — DEC-6

- **Given** any operating mode
- **When** drift is detected and classified
- **Then** the gate, the action emission, the four-outcome classification, and the baseline-update contract are identical
- **And** the assessment record is durable across all modes (visible in SPA, persisted on disk)
- *Cites: DEC-6 (all three change types covered by one mechanism; same action regardless of mode).*

#### AC-OM2: v1 default in autopilot mode is silent classification

- **Given** the intent is in autopilot mode
- **When** drift is detected and classified
- **Then** the agent classifies without pausing for human confirmation
- **And** the classification is surfaced via the SPA drift assessment view (US-05) and via the chat surface on the next interactive turn (US-06 override path)
- **Note:** A future enhancement may add per-mode confirmation policies; v1 is silent across all modes.

---

### Variant: Classification Outcome — `ignore`

#### AC-CI1: `ignore` updates baseline and produces no further action

- **Given** an `ignore` classification
- **When** the classification is recorded
- **Then** the baseline SHA updates to the observed SHA immediately
- **And** no feedback item is created
- **And** no revisit is dispatched
- **And** no pending-assessment marker is written
- **And** the assessment record is the only durable artifact of the event
- **And** on the next tick, the drift gate sees the new SHA as the expected state and emits no event for this file

#### AC-CI2: `ignore` semantics on a deletion preserve the deleted state — extends AC-EE2

- **Given** a drift event with `event_type: "deleted"` (file removed from worktree, `current_sha: null`)
- **When** the agent classifies the event as `ignore`
- **Then** the baseline entry for that file is removed from `baseline.json` (the file is no longer tracked)
- **And** no further drift events are emitted for that path on subsequent ticks (the file is "expected to be gone")
- **And** if a new file is later created at the same path, the gate treats it as a new-file drift event per AC-FS2 (no baseline retained from the deletion)
- **And** the assessment record captures the deletion + ignore decision for audit purposes
- **Rationale:** `ignore` on a deletion means "the deletion stands"; the baseline must reflect that, otherwise the gate would re-emit a deletion event every tick. This contrasts with `ignore` on a content change, which simply updates the baseline SHA per AC-CI1.

---

### Variant: Classification Outcome — `inline-fix`

#### AC-IF1: `inline-fix` updates baseline and feeds the current bolt

- **Given** an `inline-fix` classification on the active stage's current unit
- **When** the classification is recorded
- **Then** the baseline SHA updates to the observed SHA immediately
- **And** the agent's next action in the bolt treats the human's edit as the input baseline (e.g., "extend this" works against the post-edit content)
- **And** no feedback item is created
- **And** no revisit is dispatched
- **And** no pending-assessment marker is written

#### AC-IF2: `inline-fix` assessment record captures the absorption rationale and downstream impact

- **Given** an `inline-fix` classification recorded for any drift event (current-stage or earlier-stage per AC-EO2)
- **When** the assessment record (`DA-{NN}.json`) is persisted
- **Then** the record's `outcome` field is `inline-fix`
- **And** the record's `rationale` field describes how the human's edit is being absorbed (e.g., "designer replaced hero.html with refined layout — folding into design-stage refinement bolt", "user added research note — integrating into elaboration phase")
- **And** the record's `next_action` field names the immediate downstream effect (e.g., `bolt_continues_with_new_input`, `elaboration_re_runs_with_added_context`, `none`) so downstream tooling and the SPA can show the linkage
- **And** the assessment record is queryable from the SPA drift assessment view (US-05) and is durable across branch switches per AC-G11
- **Note:** The distinction from AC-EO2 is record-content-focused: AC-EO2 governs workflow position (no revisit, no rewind), AC-IF2 governs what the assessment record tells the human reviewer about the absorption.

---

### Variant: Classification Outcome — `surface-as-feedback`

#### AC-SF1: `surface-as-feedback` creates a normal feedback item and does NOT update the baseline — ARCHITECTURE.md §4.4.3

- **Given** a `surface-as-feedback` classification
- **When** the classification is recorded
- **Then** a feedback item is created via the existing feedback mechanism (`haiku_feedback`) on the owning stage
- **And** the feedback's `origin` is set to a value that identifies it as drift-derived (working name: `agent-detected`)
- **And** the feedback's body cites the file path, the diff (truncated if necessary), and the agent's rationale
- **And** the baseline SHA is **NOT** updated at this time — the baseline holds at the pre-edit SHA
- **And** a pending-assessment marker is written linking the file path to the feedback item
- *Cites: ARCHITECTURE.md §4.4.3: "What happens to the baseline: The baseline is not updated at classification time. Instead, a pending-assessment marker is written..."*

#### AC-SF2: Pending-assessment marker is keyed to the feedback item and suppresses re-detection

- **Given** a `surface-as-feedback` classification and pending-assessment marker written
- **When** subsequent ticks run
- **Then** the drift-detection gate reads the marker and suppresses drift events for this file
- **And** if the file's SHA changes again while the marker is open (human made a second edit), the gate detects the SHA change against the marker's `baseline_sha_at_creation`, removes the stale marker, and emits a new drift event
- *Cites: ARCHITECTURE.md §5.2 (marker storage), §5.3 (marker read behavior — double-edit case).*

#### AC-SF3: Only `closed` and `rejected` feedback transitions clear the marker — ARCHITECTURE.md §5.3

- **Given** an open pending-assessment marker linked to feedback item FB-NN
- **When** FB-NN's status transitions to `closed`
- **Then** the marker is cleared
- **And** the baseline SHA updates to the file's SHA at marker-clearing time
- **When** FB-NN's status transitions to `rejected`
- **Then** the marker is cleared
- **And** the baseline SHA updates to the file's SHA at marker-clearing time
- **When** FB-NN's status transitions to `addressed`
- **Then** the marker is **NOT** cleared — `addressed` is not a terminal state for marker clearing
- **And** the drift-detection gate continues to suppress re-emission for this file
- **Rationale:** `addressed` FBs can be reopened; only truly terminal states (`closed`, `rejected`) provide the certainty needed to update the baseline and stop suppression. This is the conservative path. (ARCHITECTURE.md §5.3)
- **And** the next tick after marker clearing observes no drift on this file (assuming no further human edit since marker-clearing time)
- *Cites: ARCHITECTURE.md §5.3 (marker lifecycle — "when the feedback item transitions to a terminal state (closed or rejected)").*

---

### Variant: Classification Outcome — `trigger-revisit`

#### AC-TR1: `trigger-revisit` invokes revisit on the owning stage and does NOT update the baseline — ARCHITECTURE.md §4.4.4

- **Given** a `trigger-revisit` classification on a drift event whose owning stage is earlier than the active stage
- **When** the classification is recorded
- **Then** a revisit is dispatched targeting the owning stage (existing `haiku_revisit` mechanism)
- **And** a pending-assessment marker is recorded linking the file path to the revisit dispatch
- **And** the baseline SHA does **NOT** update at classification time
- **And** the active-stage workflow position during the open-marker window is governed by AC-G5-A (no special state introduced; the marker is the sole suppression mechanism)
- *Cites: ARCHITECTURE.md §4.4.4: "What happens to the baseline: Same as surface-as-feedback — the baseline is not updated at classification time."*

#### AC-TR2: Revisit completion clears the marker and updates the baseline — ARCHITECTURE.md §5.3

- **Given** an open pending-assessment marker linked to a revisit dispatch
- **When** the targeted stage re-passes its gate (revisit completes)
- **Then** the marker is cleared
- **And** the baseline SHA updates to the file's SHA at marker-clearing time
- **And** no active-stage workflow-position transition is introduced or cleared by the marker lifecycle — per AC-G5-A, the marker is the sole suppression mechanism and clearing it triggers a baseline update only

#### AC-TR3: Revisit on the same stage as a drifted file is not allowed for current-stage drift

- **Given** a drift event whose owning stage equals the active stage (covered by AC-CO1)
- **When** the agent attempts to classify as `trigger-revisit`
- **Then** the classification is rejected by the harness with a redirect to one of the three valid current-stage outcomes
- **Note:** This protects against revisit-of-self loops.

---

## Edge Cases & Error Paths

#### AC-EE1: Concurrent same-tick drift on the same file (rare race)

- **Given** the agent's mid-bolt write and the human's filesystem write both land between two ticks
- **When** the next tick's gate runs
- **Then** the gate observes the file's final SHA (whichever write landed last) and records a single drift event
- **And** the agent classification proceeds normally
- **Note:** The gate cannot reconstruct the order of writes within the tick window. The agent's classification rationale should account for the ambiguity if visible in the diff content.

#### AC-EE2: Tracked file deleted by human

- **Given** a tracked file is deleted from the worktree (e.g., `rm`)
- **When** the gate runs
- **Then** a drift event is recorded with `event_type: "deleted"` and `current_sha: null`
- **And** the agent's classification covers deletions (the four outcomes apply, with semantics: `ignore` = the deletion stands and baseline drops; `inline-fix` = the agent re-creates the file from its last-known content; `surface-as-feedback` = open feedback that the file was deleted unexpectedly; `trigger-revisit` = revisit the owning stage because the deleted file was foundational)
- **And** the agent does NOT automatically restore the deleted file — restoration is a classification outcome the agent may choose to implement as `inline-fix`

#### AC-EE3: Tracked-surface boundary violation — file written outside watched paths

- **Given** a human writes a file outside the tracked-surface boundary (e.g., to a project source directory the gate does not watch)
- **When** subsequent ticks run
- **Then** the gate does not detect the file
- **And** no drift event is emitted
- **And** the framework's behavior is unchanged from pre-feature behavior for that file
- **Note:** This is an accepted v1 limitation. Out-of-band writes outside the tracked surface are invisible to detection (DISCOVERY.md § "Implicit detection misses non-tracked files").

#### AC-EE4: Baseline file storage corrupted or missing — ARCHITECTURE.md §8.2, §8.1

- **Given** the per-stage `baseline.json` is corrupted (parse error or invalid structure)
- **When** the gate attempts to read it
- **Then** the gate emits a `baseline_corrupt` signal; the tick does not advance to per-state dispatch
- **And** the workflow engine surfaces an error to the agent: "Baseline file for stage `{stage}` is corrupt. Run `haiku_repair` to re-establish the baseline."
- **Given** the per-stage `baseline.json` is absent on a non-first-tick scenario (e.g., after a git operation that removed it)
- **When** the gate runs
- **Then** the gate falls back to establish mode (re-enumerates tracked surface, writes new baseline, emits zero drift events for this tick)

#### AC-EE5: Agent classification times out or fails

- **Given** the agent receives a `manual_change_assessment` action and fails to produce a classification (timeout, error)
- **When** the next tick runs
- **Then** the drift event is re-presented to the agent (the unresolved drift is still observable on the gate because the baseline was not updated and no marker was written)
- **And** the assessment record marks the prior attempt as failed for audit purposes
- **And** no baseline update occurs from the failed attempt

#### AC-EE6: Same file drifts a second time while a pending-assessment marker is open — ARCHITECTURE.md §5.3

- **Given** an open pending-assessment marker on file F (from a `surface-as-feedback` outcome)
- **And** the file F is edited again before the marker clears, such that F's current SHA now differs from the marker's `baseline_sha_at_creation`
- **When** the gate runs
- **Then** the gate detects the SHA mismatch against `baseline_sha_at_creation`, treats the marker as stale, removes it, and emits a new drift event for F
- **And** the new drift event is presented to the agent for fresh classification
- **Note:** This ensures double-edits are not silently suppressed. The second edit is treated as a new finding, not bundled into the original.

#### AC-EE7: User overrides classification via SPA (US-06)

- **Given** an assessment record with classification outcome `ignore`
- **When** the user opens the assessment in the SPA and selects an override (e.g., "elevate to trigger-revisit") with a reason
- **Then** the assessment record is updated with `override.outcome`, `override.reason`, and `override.author` (human user)
- **And** the corresponding side effects fire (revisit dispatched in this case, baseline rolled back if the original classification had updated it, pending-assessment marker recorded if applicable)
- **Note:** Override mechanics are P1 (US-06). v1 may ship without override and rely on the user creating manual feedback to correct misclassifications. AC-EE7 is specified here even at P1 priority so the data model is correct from the start.

---

## Prioritization Summary

### P0 (must-have for completion)

- US-01, US-02, US-03, US-04, US-05, US-07, US-08, US-09, US-11, US-12
- All General Rules AC-G1 through AC-G13, including AC-G1-KS (kill-switch no-op) and AC-G5-A (no special active-stage state introduced — concrete, testable per resolution path #2)
- All Trust+Audit ACs: AC-TA1, AC-TA2, AC-TA3, AC-TA4
- All Alias Canonicalization ACs: AC-ALIAS1, AC-ALIAS2, AC-ALIAS3
- AC-FS1, AC-FS2, AC-FS3 (filesystem-drop variant)
- AC-AB1, AC-AB2, AC-AB3 (agent-on-behalf variant — AC-AB4 is replaced by AC-TA1 through AC-TA4)
- AC-SO1, AC-SO2 (stage-output variant)
- AC-KI1, AC-KI2 (knowledge-input variant)
- AC-UO2 (unit-output negative AC: gate must NOT emit drift events under `stages/{stage}/units/**` in v1)
- AC-T1, AC-T2 (text payload variant)
- AC-B1, AC-B2, AC-B3 (binary payload variant)
- AC-CO1, AC-CO2 (current stage-of-ownership)
- AC-EO1, AC-EO2 (earlier stage-of-ownership)
- AC-OM1, AC-OM2 (operating mode variant)
- AC-CI1, AC-CI2, AC-IF1, AC-IF2, AC-SF1, AC-SF2, AC-SF3, AC-TR1, AC-TR2, AC-TR3 (classification outcome variants)
- AC-EE1 through AC-EE6 (edge cases)

### P1 (follow-up)

- US-06 (SPA override of classification)
- US-10 (SPA upload affordance per stage — filesystem drop covers base case)
- AC-SU1, AC-SU2, AC-SU3 (SPA upload variant ACs)
- AC-EE7 (SPA classification override — specified at P1 for data-model completeness)

### Open / Deferred

- AC-UO1 (Tracked-surface boundary on `units/` — design-stage decision, not resolved in v1 default; AC-UO2 captures the negative-space behavior in v1)
- AC-T2 size cap value — ARCHITECTURE.md §3.6 specifies first 200 lines; exact KB threshold is development-stage tunable
- AC-FS3 specific temp-file pattern set — TRACKED-SURFACE-BOUNDARY.md defers exact list to development

---

## Internal Consistency Notes

This document is internally consistent with the following design-stage artifacts:

| AC or section | Consistent with |
|---|---|
| AC-G4 (baseline NOT updated on surface-as-feedback) | ARCHITECTURE.md §4.4.3, §5.4 (the baseline-update contract table) |
| AC-G5 (closed/rejected clear; addressed does not) | ARCHITECTURE.md §5.3 ("when the feedback item transitions to a terminal state (closed or rejected)") |
| AC-G5-A (active-stage state during pending-revisit) | ARCHITECTURE.md §5.1 (marker is the loop-break mechanism — singular), §5.4 (baseline-update contract table — marker is the load-bearing artifact for `trigger-revisit`, no state field). The ruling "no special active-stage state is introduced" follows from §5.1's singular naming of the marker as the suppression mechanism. |
| AC-G8 (establish, don't fire) | ROLLOUT-AND-BASELINE-ESTABLISHMENT.md §3.1, ARCHITECTURE.md §3.4 |
| AC-G10 (unified detection path for all three write origins) | ARCHITECTURE.md §10 (Decision 1 traceability row) |
| AC-TA1 (no interrupt confirmation in v1) | ARCHITECTURE.md §6.3, MCP-TOOL-CONTRACT.md §10 |
| AC-TA2/TA3 (audit log append-only, human-readable) | MCP-TOOL-CONTRACT.md §8.3 |
| AC-ALIAS1/ALIAS2/ALIAS3 (artifacts/ canonical) | TRACKED-SURFACE-BOUNDARY.md §0, §6 |
| AC-SF3 (`addressed` does NOT clear marker) | ARCHITECTURE.md §5.3 (terminal states for marker clearing) |
| AC-TR1 (baseline not updated at trigger-revisit time) | ARCHITECTURE.md §4.4.4, §5.4 |

No AC in this document contradicts ARCHITECTURE.md gate ordering, MCP-TOOL-CONTRACT.md tool semantics, or TRACKED-SURFACE-BOUNDARY.md path rules. Every structural claim references the authoritative design artifact where the detail originates.

---

## Context Boundaries (Cross-Cutting Notes)

These are observations that surfaced while drafting acceptance criteria but whose substance belongs in sibling product-stage artifacts.

- **Behavioral spec dependency** — The `manual_change_assessment` action's exact payload shape, ordering relative to existing pre-tick gates, and lifecycle inside the workflow engine are behavioral-spec territory. AC-G2 and AC-G13 reference these at the user-observable level; the wire-level spec belongs in BEHAVIORAL-SPEC.md and in `.feature` files.
- **Data contracts dependency** — The on-disk shape of `baseline.json`, `drift-markers.json`, `write-audit.jsonl`, and the assessment record (DA-NN.json) are data-contract territory. AC-G4, AC-G5, AC-G11 reference these at the user-observable level (durability, survival across operations); the schema belongs in DATA-CONTRACTS.md.
- **Coverage mapping dependency** — Mapping each AC above to specific test layers (unit, integration, e2e) is COVERAGE-MAPPING.md territory.
- **Security boundary** — AC-TA1 through AC-TA4 close DEC-9. The broader hook-bypass-as-liability risk (DISCOVERY.md §Risks) that might produce v2 harness-level enforcement lives outside this artifact.
- **Migration / upgrade story** — AC-G8 covers the user-facing first-tick-after-upgrade behavior; the operations and rollout story (feature flag, staged rollout, telemetry on the first-tick storm) is ROLLOUT-AND-BASELINE-ESTABLISHMENT.md territory.

---

## Annex: Co-Located Subsystem Excluded from These Acceptance Criteria

A separate subsystem — **upstream-artifact reconciliation** — exists on this intent's branch (entered via the 2026-05-01 main-merge from repo PR #283 "feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged 2026-04-30). It detects cross-document divergence between agent-authored upstream artifacts and is orthogonal to this intent's human-file-modification scope.

**No acceptance criteria above cover the reconciliation subsystem.** AC-G1 through AC-G13, AC-DR1 through AC-DR9, AC-RF1 through AC-RF6, AC-TA1 through AC-TA4, AC-OS1 through AC-OS4, and AC-NF1 through AC-NF6 all pertain exclusively to drift-detection of human writes, the `manual_change_assessment` action, the `haiku_human_write` MCP tool, the SPA upload paths, and related human-file-modification behavior.

The reconciliation subsystem's own user-observable behaviors — emission of the `upstream_reconciliation_required` action, semantics of the `haiku_reconciliation_acknowledge` MCP tool, fingerprint-mismatch latency budgets — are **not** under acceptance test in this intent. They are:

1. Inherited by the operations stage as an operational surface to monitor (alerts in `deploy/operations/drift-detection-alerts.yaml` and runbook scenarios in `stages/operations/units/unit-01-operational-runbook.md` scenarios 5 and 11).
2. Validated by the implementation's own test file (`packages/haiku/test/upstream-reconciliation.test.mjs`) authored under PR #283.
3. Out of scope for the product validation deliverable this artifact represents.

A future intent that takes ownership of upstream-reconciliation should author its own ACCEPTANCE-CRITERIA.md with criteria covering: divergence-detection behavior across the three classes (tool-name, http-status, field-name), `haiku_reconciliation_acknowledge` semantics, false-positive prevention (fingerprint mismatch only when corpus actually changed), and operator-observable telemetry. This intent does not and cannot author those criteria — its product elaboration was scoped to human writes.

**Cross-references:** See `knowledge/DISCOVERY.md` § "Annexed Subsystem", `knowledge/DESIGN-DECISIONS.md` Annex A, `knowledge/IMPLEMENTATION-MAP.md` § "Annex: Out-of-Scope Subsystem".
