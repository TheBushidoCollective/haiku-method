# Implementation Map — Out-of-band Human File Modifications

This document maps the change surface across the three project components — paper, plugin, and website — at the topology level. It records WHO touches WHAT and WHY at the section/concept granularity, so the design stage can plan the actual implementation against a known shape of the work. All surfaces described here are consistent with the decisions recorded in DESIGN-DECISIONS.md. No TypeScript file paths, function signatures, JSON schemas, or shell commands appear here — those are design-stage artifacts.

---

## Prerequisite Check

DESIGN-DECISIONS.md exists at `.haiku/intents/out-of-band-human-file-modifications/knowledge/DESIGN-DECISIONS.md`. The nine design decisions recorded there are the authoritative source for what was settled at inception. This document builds directly on that foundation.

---

## Paper: `website/content/papers/haiku-method.md`

The paper is the methodology specification and the source of truth for H·AI·K·U concepts. This intent introduces a new pre-tick detection step, a new workflow action, and a new class of human-attributed write — all of which need to appear in the paper as first-class methodology concepts before they are implemented. Three sections require extension or revision; a fourth concept (eventual-consistency posture) permeates two of them.

### Paper Surface 1: Quality Enforcement Section — New Pre-Tick Gate

**Change type:** Extended section

The paper's Quality Enforcement section currently describes the feedback-triage pre-tick gate as the mechanism that classifies open feedback before any handler dispatch. This intent introduces a second pre-tick gate — the SHA-baseline drift-detection gate — that runs alongside (or after) the feedback-triage gate on every `haiku_run_next` tick. The paper must describe what a pre-tick gate is as a general concept (it currently covers feedback-triage implicitly), articulate that the drift gate is a parallel member of the same gate family, define the ordering relationship between the two gates, and explain the "baseline establishment on first tick" behavior that prevents a false-positive flood on upgrade. The section should be written so a reader understands that pre-tick gates are a general extensibility point in the workflow engine, not a one-off for feedback triage.

### Paper Surface 2: Operating Modes Section — Autopilot Reaction to Drift

**Change type:** Extended section

The paper's Operating Modes section describes how the three invocation modes (interactive, pickup, autopilot) determine the level of human-in-the-loop control. This intent introduces a new observable workflow moment — drift detection and agent classification — that behaves differently across modes. In interactive mode, the agent can surface the classification decision in chat so the human can confirm or override. In autopilot mode, the agent classifies silently and logs its rationale. The paper must extend this section to describe the mode-specific behavior for `manual_change_assessment`: what the human sees (or doesn't see), what the agent is expected to do autonomously versus with confirmation, and what signal the human has that a classification happened. This is not a new mode — it is a new observable moment within the existing modes.

### Paper Surface 3: Principles Section — Eventual-Consistency Posture for Human Writes

**Change type:** Extended section

The paper's Principles section describes the framework's core behavioral principles. This intent's concurrency model (Decision 4 in DESIGN-DECISIONS.md) is a deliberate eventual-consistency stance: no locking, next-tick reconciliation, human edits may arrive while the agent is mid-bolt. This is a meaningful architectural principle, not just an implementation detail — it defines how the framework reasons about concurrent human and agent authorship. The paper should introduce "eventual consistency for human writes" as a named principle: the framework accepts that a human can edit a file at any time, that the next tick will observe and reconcile the drift, and that the mid-bolt window is an acknowledged and accepted ambiguity. This principle connects to the competitive differentiator identified in DISCOVERY.md: every competing tool either locks out the human or ignores the drift; H·AI·K·U explicitly accepts the ambiguity and classifies it.

### Paper Surface 4: New Section — Manual Change Assessment (Workflow Action)

**Change type:** New section (or prominent subsection within Quality Enforcement / Execution)

The `manual_change_assessment` working label names a genuinely new workflow action — the first in H·AI·K·U's lifecycle that processes a human-authored signal rather than an agent-authored one. The paper needs a named section (or well-anchored subsection) that defines this action: what triggers it (drift detected by the pre-tick gate), what the agent receives (a structured diff payload describing changed files), what the four classification outcomes are (ignore, inline-fix, surface-as-feedback, trigger-revisit), what the agent is expected to reason about (is this a cosmetic tweak or a fundamental redirect?), and what artifact the classification decision produces (an assessment record that survives branch operations and is visible in the SPA's drift view). This section ties the paper's description of the Quality Enforcement pre-tick gate to the specific reaction mechanism the agent uses.

### Paper Surface 5: Glossary Section — New Terms

**Change type:** Extended section

The paper's glossary requires at least three new terms that this intent introduces:

- **Out-of-band human write** — a file write that arrives via a human-controlled path (filesystem drop, SPA upload, or agent-writes-on-behalf-of-human tool) rather than through the agent's normal tool-use pipeline. Contrast with in-band agent writes mediated by MCP tools.
- **Tracked surface** — the set of files and directories that the workflow engine baselines and monitors for drift within a stage. The exact boundary is a design-stage decision, but the concept needs a paper-level definition so designers and users share vocabulary.
- **Baseline** — the SHA-indexed record of the state the workflow engine last wrote or acknowledged for each file in the tracked surface. Drift is detected by comparing the current on-disk state against the baseline.

These terms are referenced throughout the new and extended sections above and need glossary anchors so the paper is internally self-referential.

---

## Plugin: The Workflow Engine, MCP Tools, Hooks, and Browse SPA

The plugin surfaces affected by this intent span the full workflow engine stack. Surfaces are described at the conceptual layer level — not the source file level. Design will map these conceptual layers to specific implementation files, modules, and interfaces.

### Plugin Surface 1: State Baseline Storage Layer

**Change type:** New layer

The workflow engine already persists per-stage and per-intent state. This intent requires a new state layer: a per-stage (or per-intent) SHA baseline that records the last-known-good content hash for each file in the tracked surface. This layer must be readable on every tick without additional I/O overhead and must survive branch switches and worktree operations. The conceptual capability — "there exists a durable, per-stage record of which files are agent-acknowledged and at what content state" — is new to the plugin. The storage format and location (whether the baseline lives alongside existing state, in a dedicated record, or some other arrangement) is a design-stage decision. This layer is the foundation on which the drift-detection gate operates.

### Plugin Surface 2: Pre-Tick Gate Registration and Ordering

**Change type:** Extended layer

The workflow engine already runs a pre-tick gate (feedback-triage gate) before dispatching to per-state handlers on every `haiku_run_next` tick. This intent adds a second gate — the drift-detection gate — to that gate sequence. The gate registration layer needs to support multiple ordered gates: feedback-triage and drift-detection both run before dispatch, in a defined sequence, and both have access to the current intent state. The extension must define the gate-ordering contract (which runs first, what happens if both have findings), the gate's interface (what inputs it receives, what outputs it emits), and the fallthrough behavior (if drift-detection finds nothing, the tick proceeds normally with no overhead beyond the file-hash scan). This is an extension to an existing architectural pattern, not a new pattern from scratch.

### Plugin Surface 3: Drift-Detection Gate Implementation

**Change type:** New layer

The drift-detection gate is the specific gate that implements per-tick SHA comparison. Its job: walk the tracked surface for the current stage, hash each file, compare against the baseline, and emit drift findings when the on-disk hash differs from the baseline. For binary files (images, figma exports), it emits a "binary-changed" signal rather than a unified diff. For new files (files present on disk but not in the baseline), it emits a "new-file-detected" signal. For deleted files (files in the baseline but absent on disk), it emits a "file-removed" signal. For text files, it emits the unified diff as part of the finding payload. This gate does not classify the drift — it only detects and describes it. Classification is the `manual_change_assessment` action's job. The gate is also responsible for the "baseline establishment" mode: on the first tick after the feature is enabled for an intent (or on the first tick for a new intent), the gate records the current state as the baseline without emitting any drift findings.

To honor the baseline-update contract in DESIGN-DECISIONS.md Decision 3 for non-terminal classification outcomes, this gate also carries a "skip if pending" check: before emitting a drift finding for a file, it consults the pending-assessment marker store and suppresses the finding if the file has an open marker (i.e., a `surface-as-feedback` or `trigger-revisit` classification outcome whose downstream action has not yet resolved). This suppression is what prevents the steady-state re-detection loop that would otherwise occur for non-terminal outcomes. The marker storage location and lifecycle is a design-stage decision (DESIGN-DECISIONS.md "Pending-assessment marker storage" in Open for Design); this gate's responsibility is to read the marker store on every tick and treat marked files as suppressed for the duration of the marker's lifetime.

### Plugin Surface 4: Manual Change Assessment Workflow Action

**Change type:** New layer

The `manual_change_assessment` action is the workflow engine's response when the drift-detection gate emits findings. It is a new first-class workflow action alongside existing actions (`review_fix`, `feedback_triage`, `intent_completion_review`, etc.). When dispatched, it presents the agent with the structured drift payload (file paths relative to the intent directory, change type, unified diff or binary signal, and the context of which stage and hat the file belongs to). The agent classifies each finding into one of four outcomes: ignore, inline-fix, surface-as-feedback, or trigger-revisit. The action is responsible for recording the classification decision in a durable assessment record and applying the baseline-update contract recorded in DESIGN-DECISIONS.md Decision 3.

The baseline-update contract (per Decision 3) governs this action's effect on the baseline storage layer:

- **ignore / inline-fix** — terminal outcomes; the action updates the baseline immediately to the observed file state, and no pending-assessment marker is recorded.
- **surface-as-feedback / trigger-revisit** — non-terminal outcomes; the action records a pending-assessment marker keyed to the affected file alongside the feedback item or revisit dispatch, and does NOT update the baseline at classification time. The drift-detection gate (Plugin Surface 3) honors the marker and skips files with an open marker on subsequent ticks. When the downstream action resolves (feedback closes, revisit completes), the marker is cleared and the baseline is updated to the file's then-current state.

The exact storage location and lifecycle contract for the pending-assessment marker is a design-stage decision (DESIGN-DECISIONS.md "Pending-assessment marker storage" in Open for Design). Plugin Surface 3 (drift-detection gate) carries the "skip if pending" check; this action carries the marker write on classification and the marker clear on downstream resolution. This action's addition requires a new case in the workflow engine's action dispatch table, new orchestrator logic for constructing the drift payload, and integration points with the feedback-closure and revisit-completion paths so the marker lifecycle is wired to the events that should clear it.

### Plugin Surface 5: Human-Attributed Write MCP Tool

**Change type:** New layer

The plugin currently has no MCP tool for writing a file as a human-class write. The agent's normal `Write` and `Edit` tools mark their outputs as agent-class writes, which the baseline tracks as agent-acknowledged state. When a user says "hey claude, write this config file for me," the agent needs a sanctioned tool that marks the resulting write as human-attributed, so the baseline records it as a human write and the drift-detection gate does not re-surface it as drift on the next tick. This new MCP tool is the "agent writes on behalf of human" capability identified in DESIGN-DECISIONS.md (Decision 7) and DISCOVERY.md (§ "Capability needs: Sanctioned 'agent writes on behalf of human' tool"). Its exact name, parameter contract, and integrity stance (trust + audit vs. explicit confirmation — Decision 9 in DESIGN-DECISIONS.md) are design-stage decisions. The conceptual requirement is clear: a tool that writes a file, records the write as human-attributed in the baseline, and produces an audit entry linking the write to the user's instruction.

### Plugin Surface 6: Browse SPA — Stage Output Upload Affordance

**Change type:** New layer in existing SPA component surface

The browse/review SPA currently displays stage outputs for each stage of an intent. This intent adds an upload affordance to the stage output area: a control that lets a human attach or replace a file in the stage's outputs directory without using the filesystem directly. The affordance is per-stage and respects the stage's notion of "outputs" — it is not a generic file browser. Conceptually, the affordance performs a write to the stage's output directory, and the resulting file is immediately discoverable by the drift-detection gate on the next tick (or, if the SPA integrates directly with the workflow engine, it could trigger a tick). The design stage will need to resolve whether SPA uploads talk to a backend write endpoint (which then hits disk) or write directly to the worktree via an API. The overlap with the `origin/haiku/remote-review-spa/main` branch (noted in DISCOVERY.md § "Overlap Awareness") is a direct concern: the SPA components for stage output display are actively in motion on that branch. Design must account for the in-flight component structure before speccing the upload affordance.

### Plugin Surface 7: Browse SPA — Knowledge Upload Affordance

**Change type:** New layer in existing SPA component surface

Distinct from stage output replacement, the knowledge upload affordance is additive: it lets a human attach reference material (research documents, design tokens, market data, screenshots) to the intent's knowledge directory without touching the filesystem. This affordance lives in the elaborate-phase view of the SPA, tied to the inception/elaborate phase's knowledge directory. Conceptually, the uploaded file lands in the intent's knowledge directory and the drift-detection gate observes it on the next tick as a "new-file-detected" finding, which the agent classifies (most likely as "inline-fix" — fold this knowledge into the next elaboration bolt). The affordance is distinct from stage output replacement because it is additive rather than replacement-oriented and is scoped to the knowledge directory rather than stage outputs.

### Plugin Surface 8: Browse SPA — Drift Assessment View

**Change type:** New view in existing SPA

When `manual_change_assessment` fires on a tick, the human looking at the intent in the SPA needs to see what changed, what the agent decided, and why. This is a new view (or a new section in the existing intent overview) that surfaces recent drift events: file path, change summary, classification outcome, agent rationale, and timestamp. This view draws from the assessment record produced by the `manual_change_assessment` action (Plugin Surface 4). It is read-only for the human — they can see the record but the classification is already done. In a future enhancement (out of scope for v1) the human could override a classification; for now, the view is transparency-only. The SPA overlap with `origin/haiku/remote-review-spa/main` applies here as well — the intent overview layout is actively in motion on that branch.

---

## Website: `website/content/docs/`

The website's user-facing docs explain H·AI·K·U to practitioners — designers, product owners, engineers, and non-technical stakeholders. This intent introduces a new collaboration workflow that these audiences need to understand. Docs changes should be written for the practitioner audience, not the plugin implementer.

### Website Surface 1: New Doc — Out-of-band Human Edits

**Change type:** New doc

A new standalone doc explaining the out-of-band human edit workflow from a user's perspective. Audience: anyone using H·AI·K·U on a team where multiple people touch the same intent's files. The doc covers: what the three write paths are (filesystem drop, SPA upload, chat instruction), what "detected on the next tick" means in practice (eventual consistency — the agent will notice, but not necessarily instantly), what the four classification outcomes are and what the user experiences for each, how to see what was found and decided (the drift assessment view in the SPA), and how to nudge the agent to pick up a recent change (trigger a tick manually). This doc is the entry point for the "designer replaced a layout" and "PO made a small edit" user stories. It should be written without jargon where possible — designers and POs are the primary audience, not plugin developers.

### Website Surface 2: Updated Doc — Concepts

**Change type:** Extended doc

The Concepts doc introduces H·AI·K·U's core vocabulary to new users. It needs three additions corresponding to the new glossary terms in the paper: out-of-band human write, tracked surface, and baseline. These should be brief (one paragraph each), written for a practitioner audience, and linked to the new "Out-of-band Human Edits" doc for the full workflow explanation. The Concepts doc update is a thin extension — it adds vocabulary, not workflow.

### Website Surface 3: Updated Doc — Workflows

**Change type:** Extended doc

The Workflows doc describes common H·AI·K·U usage patterns. The out-of-band human edit cycle is a new pattern worth a dedicated section: "Updating a stage output as a human." This section describes the end-to-end loop — human makes a change, agent detects drift on the next tick, agent classifies, human can see the decision in the SPA. It connects the three concrete user stories (designer scenario, PO scenario, knowledge upload scenario) to the mechanism and the observable outcome. The section should be concrete and example-driven: "Here is what happens when you replace a layout file and then continue working with the agent."

### Website Surface 4: Updated Doc — Operating Modes

**Change type:** Extended doc

The Operating Modes doc describes how H·AI·K·U behaves differently depending on the mode used. This doc needs a new subsection addressing "How drift detection behaves in each mode": in interactive mode, the agent surfaces classification decisions in chat; in autopilot mode, the agent classifies silently and the decision is visible in the SPA after the fact. This is a practitioner-facing version of the paper's Operating Modes extension. It answers the question: "If I'm running in autopilot and a designer drops a file, what happens?" The answer depends on the mode, and the doc should be explicit about each path.

### Website Surface 5: Updated Doc — Quality Enforcement or New Section

**Change type:** Extended doc (or new section within existing quality doc)

If the website has a doc describing quality gates and the review process, it needs a section on pre-tick gates as a class of mechanism — specifically noting that drift detection is a second member of the pre-tick gate family alongside feedback triage. If no such doc exists yet, this content belongs in the new "Out-of-band Human Edits" doc or in a sidebar callout within the Workflows doc. The goal: a practitioner reading about quality enforcement understands that the framework runs multiple pre-tick checks, not just one.

---

## Cross-Component Sync Table

The following table maps major concepts across the three components, so the design stage can verify that each concept is covered in all three places and that terminology is consistent.

| Concept | Paper Section | Plugin Layer | Website Doc |
|---|---|---|---|
| Drift reaction (manual_change_assessment) | New section: Manual Change Assessment Workflow Action + Quality Enforcement extension | New layer: Manual Change Assessment Workflow Action (Plugin Surface 4) + Pre-Tick Gate Registration (Plugin Surface 2) | New doc: Out-of-band Human Edits; Workflows doc extension |
| Tracked surface | Glossary: "tracked surface" | New layer: State Baseline Storage (Plugin Surface 1) + Drift-Detection Gate (Plugin Surface 3) | Concepts doc extension; Out-of-band Human Edits doc |
| Baseline | Glossary: "baseline" | New layer: State Baseline Storage (Plugin Surface 1) | Concepts doc extension; Out-of-band Human Edits doc |
| Out-of-band human write (classification) | Quality Enforcement extension; new Manual Change Assessment section | Drift-Detection Gate (Plugin Surface 3) + Manual Change Assessment Action (Plugin Surface 4) | New doc: Out-of-band Human Edits; Concepts doc |
| Human-attributed write capability | Principles: eventual-consistency posture | Human-Attributed Write MCP Tool (Plugin Surface 5) | Out-of-band Human Edits doc (chat instruction path) |
| Pre-tick gate ordering | Quality Enforcement extension | Pre-Tick Gate Registration (Plugin Surface 2) | Quality Enforcement section / Out-of-band Human Edits sidebar |
| SPA upload (stage outputs) | — (implementation detail, not methodology) | SPA Stage Output Upload (Plugin Surface 6) | Out-of-band Human Edits doc (SPA upload path) |
| SPA upload (knowledge) | — (implementation detail, not methodology) | SPA Knowledge Upload (Plugin Surface 7) | Out-of-band Human Edits doc (knowledge upload path); Workflows doc |
| Drift assessment visibility | Manual Change Assessment section | SPA Drift Assessment View (Plugin Surface 8) | Out-of-band Human Edits doc; Workflows doc |
| Eventual consistency | Principles: new subsection | Concurrency model (implicit in pre-tick detection design) | Operating Modes doc extension; Out-of-band Human Edits doc |
| Autopilot drift behavior | Operating Modes extension | Manual Change Assessment Action dispatch (Plugin Surface 4) | Operating Modes doc extension |

---

## Component Summary

**Paper:** 5 surfaces — 1 new section (Manual Change Assessment), 3 extended sections (Quality Enforcement / pre-tick gate, Operating Modes / autopilot behavior, Principles / eventual-consistency posture), 1 extended glossary (three new terms). The paper changes are foundational — design and execution cannot proceed without paper concepts being locked, because the paper is the methodology specification.

**Plugin:** 8 surfaces — 1 new baseline storage layer, 1 extended pre-tick gate registration layer, 1 new drift-detection gate, 1 new workflow action, 1 new MCP tool, and 3 new SPA surfaces (stage output upload, knowledge upload, drift assessment view). The plugin changes are the core implementation surface. Decision 9 (human-write-path integrity) and the tracked-surface boundary are the two design decisions that will most constrain how Plugin Surfaces 3, 4, and 5 are specced.

**Website:** 5 surfaces — 1 new doc (out-of-band human edits), 3 extended docs (Concepts, Workflows, Operating Modes), 1 extended or new quality doc section. Website changes are a sync requirement per DESIGN-DECISIONS.md Decision 8 and the project's sync discipline. The audience is practitioners, not implementers — the docs should be written at the level of "what you experience" rather than "how it works internally."

---

## Consistency Notes

This map is internally consistent with DISCOVERY.md and DESIGN-DECISIONS.md:

- The four classification outcomes (ignore, inline-fix, surface-as-feedback, trigger-revisit) appear identically in DESIGN-DECISIONS.md Decision 3 and in Plugin Surface 4 / Paper Surface 4 / Website Surface 1 above.
- The baseline-update contract in DESIGN-DECISIONS.md Decision 3 (immediate update for terminal outcomes; pending-assessment marker plus deferred update for non-terminal outcomes) is reflected in Plugin Surface 3 (the gate's "skip if pending" check) and Plugin Surface 4 (the action's marker write on classification and clear on downstream resolution). The marker storage location is preserved as an open design-stage decision and is not pre-decided here.
- The three write paths (SPA upload, filesystem drop, agent-writes-on-behalf-of-human) appear identically in DESIGN-DECISIONS.md Decision 7 and in Plugin Surfaces 6, 7, 5 respectively.
- The pre-tick gate framing (drift-detection gate alongside feedback-triage gate) is consistent with DESIGN-DECISIONS.md Decision 1 and the paper's existing description of the feedback-triage gate.
- The eventual-consistency stance (no locking, next-tick reconciliation) maps directly to DESIGN-DECISIONS.md Decision 4 and appears in Paper Surface 3 and Website Surface 4.
- Design decisions left open at inception (tracked-surface boundary, baseline storage location, baseline establishment on upgrade, ambiguous-diff default, human-write-path integrity, SPA availability per stage, assessment record location, binary file behavior) are preserved as open items in the relevant plugin surfaces above and are not pre-decided by this map.
- No surface maps to a concept that contradicts a recorded decision in DESIGN-DECISIONS.md.

---

## Annex: Out-of-Scope Subsystem on the Same Branch — Upstream-Reconciliation Pre-Tick Gate

The 5 paper / 8 plugin / 5 website surfaces above describe **only** the out-of-band human-file-modification feature. A second subsystem — **upstream-artifact reconciliation** — also lives on this intent's branch but is NOT covered by the surfaces above. This annex declares that omission explicitly so the implementation map does not claim more than it owns.

**Why it is excluded from the surfaces table:** The reconciliation subsystem entered this branch transitively (repo PR #283 "feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged into repo main 2026-04-30, then into this intent's main on 2026-05-01). It was not derived from this intent's discovery or design decisions. Including it in the Paper / Plugin / Website Surfaces tables above would falsify the implementation map by attributing surfaces to this intent that this intent did not commission.

**What lives on the branch but is not mapped above:**

| Subsystem Surface | Implementation Location | Mapped Above? |
|---|---|---|
| Reconciliation pre-tick gate (corpus fingerprinting, divergence detection) | `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts` | NO |
| `upstream_reconciliation_required` workflow action | `packages/haiku/src/orchestrator/workflow/run-tick.ts` | NO |
| `haiku_reconciliation_acknowledge` MCP tool | (referenced in operations runbook; sourced in PR #283) | NO |
| Reconciliation telemetry metrics | `packages/haiku/src/telemetry.ts` (`haiku.reconciliation.*`) | NO |
| Reconciliation alert rules | `deploy/operations/drift-detection-alerts.yaml` (reconciliation-* rules) | NO |
| Reconciliation tests | `packages/haiku/test/upstream-reconciliation.test.mjs` | NO |
| Reconciliation operations runbook scenarios | `stages/operations/units/unit-01-operational-runbook.md` (scenarios 5, 11) | NO (operations stage adopted reconciliation as inherited surface, not as derived from this map) |

**Pre-tick gate ordering note:** The Cross-Component Sync Table row for "Pre-tick gate ordering" describes ordering between the existing **feedback-triage gate** and the new **drift-detection gate** introduced by this intent. The reconciliation gate is a **third pre-tick gate** that lives in the implementation but whose ordering, error model, and gate-chain interaction were not mapped here. If a future intent takes ownership of reconciliation, that intent's IMPLEMENTATION-MAP should add the reconciliation gate to the gate-chain ordering row and re-document the surfaces above.

**Cross-references:** See DISCOVERY.md § "Annexed Subsystem: Upstream-Reconciliation Pre-Tick Gate" for full provenance and scope-orthogonality justification; DESIGN-DECISIONS.md Annex A for the explicit "decisions not made" record.
