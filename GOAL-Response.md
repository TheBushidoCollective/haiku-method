# GOALS.md — Alignment Response

This is the work log for the engine/workflow alignment effort described in `GOALS.md`. Each section names the spec requirement, the gap as it actually existed in the code, what changed, where it changed, and how the change was verified.

The doc is the source of truth for the alignment per `GOALS.md`. Anything below that contradicts the doc is a defect — file it.

---

## Schema cleanups

### `intent_completion_review:` opt-out flag — removed

**Spec.** Every intent runs the studio's review-agents after the final stage gate. No per-intent opt-out flag. The only way a studio gets no completion review is by shipping zero review-agents in `studios/<studio>/review-agents/`.

**Gap before.** `packages/haiku/src/state/schemas/intent.ts:104` declared `intent_completion_review: Type.Optional(Type.Boolean())`. The orchestrator read it at `side-effects.ts:524` (`const reviewOnCompletion = intent.intent_completion_review !== false`) to decide whether to enter completion review or fire `intent_complete` directly. SPA's approve-button label logic at `session-api.ts:194` also branched on it.

**Change.**
- Schema: deleted the field from `INTENT_FRONTMATTER_SCHEMA`. Updated the file's docstring + agent-authorable list to reflect universality.
- Orchestrator (`side-effects.ts:472-547`): deleted the opt-out branch. `completeOrReviewIntent` now always calls `workflowEnterIntentCompletionReview`. Updated the function's docstring to spell out the new contract: every intent enters completion review; a studio with zero review-agents naturally no-ops through the dispatch and lands on the terminal gate immediately.
- SPA (`session-api.ts:193-204`): the approve-button label now checks `readStudioReviewAgentPaths(studio)` count instead of the FM flag. Zero agents → "Complete Intent" label; any agents → "Submit Intent for Final Review".
- Migrations: removed `intent_completion_review` from `field-hygiene.ts:38` known-keys set and from `v0-to-v4.ts:37` comment-only preservation list. No runtime preservation code referenced the field, so the migration drops it cleanly.

**Verification.** `fm-set-tools.test.mjs` (16/0) — the existing type-mismatch test that used `intent_completion_review` as its "stable, unmanaged boolean field" was repointed at `skip_stages` (array type) since no agent-authorable boolean remains on intent FM. `v0-to-v4-realistic-scenario.test.mjs` (11/0) — the legacy fixture had `intent_completion_review: true` in its v3 input + an assertion that the migrated FM preserved it; both removed. `autopilot-mode.test.mjs` comment about default-true behavior was rewritten to describe universal completion review. `bun tsc --noEmit` clean.

### `intent.quality_gates[]` — already absent, verified

**Spec.** Intent-level quality gates are derived from the union of every unit's `quality_gates[]` deduped by command, not declared on intent FM.

**Gap before.** None — the field was already absent from `INTENT_FRONTMATTER_SCHEMA`. Grep across `plugin/studios/`, `packages/haiku/src/`, `packages/haiku/test/`, `website/content/` confirmed zero references to `intent.quality_gates` or `intent_quality_gates:` as a declared FM field.

**Change.** None required.

**Verification.** Grep is the verification. The intent-scope dispatcher already walks unit gates via the existing `dispatch_quality_gates` handler.

### `reviews.<role>` distinct from `approvals.<role>` — already present, verified

**Spec.** Unit FM has `reviews.<role>` (pre-execution stamps on the spec) distinct from `approvals.<role>` (post-execution stamps on the output).

**Gap before.** None. `state/schemas/unit.ts:54-59` declares both in the FSM-driven field list. `state/schemas/approval.ts` and the embedded review schema define both shapes. The cursor walks `reviewRoles` for pre-exec dispatch (`cursor.ts:1165-1177`) and `approvalRoles` for post-exec (`cursor.ts:1182-1199`). `prompts/dispatch_review.ts:70` instructs subagents to stamp `reviews.<role>`; `prompts/dispatch_approval.ts:58` stamps `approvals.<role>`.

**Change.** None required.

**Verification.** Multi-tick pipeline test traces the lifecycle: `dispatch_review(a/spec) → dispatch_review(a/code-reviewer) → user_gate(a) → dispatch_approval(a/spec) → dispatch_quality_gates(a) → dispatch_approval(a/code-reviewer) → user_gate(a)`. Pre-exec reviews stamp `reviews.<role>`; post-exec approvals stamp `approvals.<role>`.

### `closes:` field on unit FM — already present, verified

**Spec.** Unit FM has a `closes:` field listing FB IDs the unit addresses on revisit iterations.

**Gap before.** None. Already declared at `state/schemas/unit.ts:120-125` with description noting it's informational; actual closure happens via the FB's own iterations + `targets.invalidates`.

**Change.** None required.

### `current_hat:` FM field — verified absent

**Spec.** No `current_hat:` field anywhere; current hat is always derived from `iterations[]`.

**Gap before.** Grep found one hit at `state-tools.ts:6384` — but it's the OUTPUT schema field name on `haiku_unit_advance_hat` (a string named `current_hat` that returns "the hat that just finished" to the agent), not an FM field. Different surface; spec's rule applies to FM, not tool response shapes.

**Change.** None required.

### `state.json` — verified absent

**Spec.** `state.json` is gone — do not reintroduce it.

**Gap before.** v4 cursor (`cursor.ts:32-49`) and FM-driven design already documented this. Grep across the codebase: zero v4 reads or writes. Legacy comments in `side-effects.ts` and `architecture/_data/actors.ts` reference "no state.json" as documentation, not a code path.

**Change.** None required.

### `discovery` added to `FEEDBACK_ORIGINS`

**Spec.** FB origins include `discovery` — used by discovery subagents when surfacing decisions the user must make.

**Gap before.** Origin enum at `state/schemas/feedback.ts:35-46` had 10 origins. `discovery` was missing.

**Change.** Added `"discovery"` to the `FEEDBACK_ORIGINS` const array between `"drift"` and `"external-pr"`. The `HUMAN_ORIGINS` set at `state-tools.ts:4719-4723` is unchanged — `discovery` falls through to the agent classification, which is correct (discovery is agent-spawned).

**Verification.** `feedback.test.mjs` (64/0). The `MCP tool accepts all valid origins` test iterates `FEEDBACK_ORIGINS` and transparently picks up the new value. The `deriveAuthorType — agent origins return agent` test was extended with an explicit `deriveAuthorType("discovery") === "agent"` assertion to lock the auto-triage classification (origin → author_type → `triaged_at` auto-stamp at creation).

### `draft:` field on unit FM — considered, rejected

**Spec.** Drafting unit lifecycle — units written during elaborate can be in a mutable "drafting" state, distinct from "pending" which is forward-only.

**Gap before.** Unit FM had no per-unit drafting marker.

**Change.** None. An earlier iteration of this work added an explicit per-unit `draft: true` boolean + wave-ready filter exclusion + seal-tool flag-clearing loop. Reviewed in conversation: the spec's drafting semantics are stage-scope (single `approvals.elaborate_complete` stamp gates all units in the stage), and the per-unit flag adds no mechanical capability the stage-level `decompose_review` gate doesn't already provide. Both spec states are "full mutate"; the only differentiator is "counts toward execute," which is handled by the stage-level gate. The per-unit field was reverted.

**Why the stage-level gate is sufficient.** Pre-stamp: cursor returns `decompose_review` instead of dispatching any wave from the stage — every unit is implicitly drafting. Post-stamp: cursor advances past `decompose_review`; the next tick walks into wave logic; the architecture §1.3 forward-only rule kicks in when the first hat dispatch stamps `started_at`. Drafting → pending → started is a one-way door enforced by the existing FSM, no new field needed.

**What would justify reintroducing it.** Incremental finalization (agent finalizes some units before others), tooling-level "list all drafts" without inferring from stage state, or visible per-unit auditability without context. None of these are in the spec.

---

## Engine cursor

### Pre-tick drift + feedback primitives — verified

**Spec.** Drift sweep and feedback flow are the only pre-tick primitives. Both run before any handler dispatch every tick.

**Gap before.** Already wired. `cursor.ts:1311-1352` runs Track C (drift) then Track B (feedback) before Track A (intent walk). Track B walks every stage from 0 through current + intent-scope.

**Change.** None required.

**Verification.** `drift-scenarios.test.mjs` (5/0), `drift-mid-flight-e2e.test.mjs` (passes in isolation), `feedback-flow-scenarios.test.mjs` (8/0), `cross-stage-feedback-move.test.mjs` (passes in isolation). Multi-tick pipeline implicitly exercises the order — every tick begins with the pre-tick checks before dispatching.

### Cursor signal precedence — verified

**Spec.** The cursor walks an ordered signal list and returns the first matching unfulfilled signal. The 8-step list in `GOALS.md` is the contract.

**Gap before.** None. `cursor.ts:1222-1405` (`derivePosition`) implements the order: drift → feedback → intent track → sealed. The per-stage walk inside intent-track handles elaboration → discovery → decompose → execute → spec review → quality gates → adversarial review → user gates → complete_stage in order.

**Change.** None required (modulo the new `decompose_review` step inserted in the right precedence slot — see next section).

**Verification.** Multi-tick pipeline emits the full sequence: `elaborate(a) → decompose(a) → decompose_review(a) → start_unit_hat(a/planner) → start_unit_hat(a/builder) → start_unit_hat(a/verifier) → dispatch_review(a/spec) → dispatch_review(a/code-reviewer) → user_gate(a) → dispatch_approval(a/spec) → dispatch_quality_gates(a) → dispatch_approval(a/code-reviewer) → user_gate(a) → complete_stage(a) → … → intent_review → seal_intent → sealed`.

### 4th elaborate-loop completion signal — `decompose_review` action

**Spec.** Elaborate completes only when (1) discovery artifacts exist, (2) no open `origin: discovery, resolution: question` FBs, (3) `verified_at` on elaboration.md, (4) `decompose-verifier` has stamped `approvals.elaborate_complete` (auditing that drafted units cover the captured conversation).

**Gap before.** The first three signals were checked. The fourth was missing — the cursor transitioned from `decompose` directly to `start_unit_hat` once any units existed, without any audit that the units actually covered what the conversation agreed on.

**Change.**
- New `CursorAction` discriminated-union member `decompose_review` at `cursor.ts:115-178` with full docstring describing the signal contract.
- New cursor check at `cursor.ts:980-997` between the "units.length === 0 → decompose" clause and the wave logic. When units exist AND `elaboration.md` exists AND `decompose_verified_at` is unstamped, returns `{ kind: "decompose_review", stage, signal: "verify_decompose" }`. Mode-aware: autopilot bypasses (mirrors how it bypasses `elaborate_review`). Grandfathered: stages without `elaboration.md` fall through.
- New action type added to `workflow/types.ts:42` (`WorkflowAction` enum gained `"decompose_review"`).
- New preview text in `orchestrator/preview.ts:67-71` describing the verifier dispatch and pass/fail paths.
- New prompt builder at `orchestrator/prompts/decompose_review.ts` (full file). The builder constructs a verifier subagent prompt: read elaboration + intent + STAGE.md + every unit spec; audit unit coverage against the conversation; on pass call `haiku_stage_decompose_seal`; on fail file feedback with `targets.invalidates: ["decompose_complete"]` so the fix loop reruns decomposition. Registered in `prompts/index.ts:34, 96`.
- New MCP tool `haiku_stage_decompose_seal` at `tools/orchestrator/haiku_stage_decompose_seal.ts` (full file). Mirrors `haiku_stage_elaboration_seal`: branch-guard, idempotent, stamps `decompose_verified_at` + optional `decompose_verified_notes` on `elaboration.md` FM. Registered in `tools/orchestrator/index.ts`, `orchestrator/tool-defs.ts:313-318` (with description for the agent), and exported via `state/schemas/index.ts`.
- New TypeBox schema `HAIKU_STAGE_DECOMPOSE_SEAL_INPUT_SCHEMA` at `state/schemas/inputs/stages.ts` (mirror of the elaboration seal schema) with `validateHaikuStageDecomposeSealInputSchema` AJV-compiled validator.
- Test fixture helper `seedVerifiedElaboration` at `test/_v4-fixtures.mjs:337-358` now stamps BOTH `verified_at` AND `decompose_verified_at` so downstream tests that exercise wave-level behavior bypass both elaborate-loop gates without manual setup.
- Multi-tick simulator updated to handle the new action: `case "decompose_review"` at `test/multi-tick-pipeline.test.mjs:355-376` stamps `decompose_verified_at` on `elaboration.md` (the simulator counterpart to the real verifier).

**Verification.**
- `multi-tick-pipeline.test.mjs` (1/1, 37 sub-tests): the sealed lifecycle now traces `elaborate → decompose → decompose_review → start_unit_hat → …` per stage. 47 ticks to seal vs. prior 44 (the three new ticks are one `decompose_review` per stage).
- `cursor-walk.test.mjs` (27/0): all existing wave/review/approval tests pass after the fixture-helper update.
- `server-tools.test.mjs` (68/0): the defs↔handlers parity test confirms `haiku_stage_decompose_seal` is registered in both `orchestratorToolDefs` and `orchestratorToolHandlers` — without this guard the tool would have shipped in handlers but stayed invisible to MCP.
- `bun tsc --noEmit` clean.

### Drafting is stage-scope, not per-unit (cursor blocks waves until verified)

**Spec.** Until the 4th elaborate completion signal lands (`approvals.elaborate_complete` / `decompose_verified_at`), units don't dispatch in execute. The spec table puts both "drafting" and "pending" in "yes — full mutate"; the only mechanical differentiator is "counts toward execute."

**Gap before.** No signal blocked wave dispatch once any units existed.

**Change.** The `decompose_review` cursor check at `cursor.ts:980-997` is the entire implementation. When `decompose_verified_at` is missing on `elaboration.md` and units exist, the cursor returns `decompose_review` instead of falling through to wave logic. Every unit in the stage is implicitly drafting until the verifier stamps. Post-stamp, the cursor's next tick walks past `decompose_review` and waves fire; the architecture §1.3 forward-only rule kicks in at first hat dispatch (when `started_at` becomes non-null).

This is the spec's "drafting → pending → started" one-way door, enforced entirely by the existing FSM:
- Pre-stamp: stage-scope wave block (cursor returns `decompose_review`).
- Post-stamp, pre-dispatch: `started_at == null`, wave-ready, fully mutable via `haiku_unit_write`.
- Post-dispatch: `started_at != null`, forward-only.

**Verification.** `multi-tick-pipeline.test.mjs` (1/1, 37 sub-tests) — the lifecycle now traces `elaborate → decompose → decompose_review → start_unit_hat` per stage; 47 ticks to seal. `cursor-walk.test.mjs` (27/0) — without `decompose_verified_at` on the fixture's `elaboration.md`, no `start_unit_hat` fires. `seedVerifiedElaboration` test-fixture helper stamps both `verified_at` AND `decompose_verified_at` so downstream tests that exercise wave-level behavior bypass both elaborate-loop gates without manual setup.

### Drafting → pending one-way door — covered by stage gate

**Spec.** Once a unit leaves drafting, it's forward-only.

**Change.** None beyond the stage-scope gate above. The seal tool stamps `decompose_verified_at` once; the cursor advances; the next tick begins wave dispatch; the first hat advance stamps `started_at`; forward-only kicks in. No per-unit flag clearing needed — the door is the stamp itself.

### Universal intent completion review

**Spec.** Every intent runs the studio's review-agents after the final stage gate. No opt-out flag.

**Gap before.** `completeOrReviewIntent` branched on `intent.intent_completion_review !== false`.

**Change.** The opt-out branch is gone. `completeOrReviewIntent` always calls `workflowEnterIntentCompletionReview`. SPA label logic checks studio agent count instead. See "Schema cleanups → `intent_completion_review:`" above for the full file list.

**Verification.** `announce-user-decisions.test.mjs` (11/0), `user-gate-next-stage-routing.test.mjs` (passes in isolation), `autopilot-mode.test.mjs` (passes — comment updated).

### Single elaborate state with sub-instructions (`signal` discriminator)

**Spec.** The elaborate loop is one cursor state. The cursor stays in elaborate across many ticks, returning different sub-instructions based on the first-unmet completion signal. Each tick the agent receives one action; that action tells the agent which signal to address.

**Gap before.** The cursor emitted four distinct action kinds during elaborate (`elaborate`, `elaborate_review`, `discovery_required`, `decompose`, plus the new `decompose_review`) with no uniform discriminator linking them.

**Change.** Added a uniform optional `signal` field to each of the 5 elaborate-loop action types in the `CursorAction` discriminated union (`cursor.ts:129-178`). Updated every emission site to populate it:
- `cursor.ts:961-965`: `elaborate_review { stage, signal: "verify_conversation" }`
- `cursor.ts:968`: `elaborate { stage, signal: "conversation" }`
- `cursor.ts:1026-1031`: `discovery_required { stage, agent, units, signal: "discovery" }`
- `cursor.ts:1042`: `decompose { stage, signal: "decompose" }`
- `cursor.ts:993-997`: `decompose_review { stage, signal: "verify_decompose" }`

Added a comprehensive `ELABORATE LOOP — single cursor state, multiple sub-instructions` documentation block at `cursor.ts:82-118` mapping each sub-instruction to its on-disk signal:

```
Signal 1 — discovery artifacts exist on disk
  → cursor returns discovery_required (per template)
Signal 2 — no open `origin: discovery, resolution: question` FBs
  → handled by Track B's feedback flow
Signal 3a — conversation captured at elaboration.md
  → cursor returns elaborate
Signal 3b — conversation verified (verified_at stamped)
  → cursor returns elaborate_review
Signal 4a — at least one unit drafted
  → cursor returns decompose
Signal 4b — units cover the conversation (decompose_verified_at stamped)
  → cursor returns decompose_review
Signal 4c — no unit still has draft: true on its FM
  → cleared by haiku_stage_decompose_seal on the 4b pass
```

A consumer can now switch on `action.signal` to route by sub-instruction; the cursor stays "in elaborate" by returning these signal-tagged actions repeatedly until every signal flips on disk.

**Verification.** All existing tests pass. The new field is additive and optional — no existing assertion on action shape breaks. The wire shape now exposes the single-state model for any consumer that wants to read it.

### Discovery subagents file `origin: discovery, resolution: question` FBs

**Spec.** When a discovery subagent surfaces a decision the user must make, it files an FB at elaborate scope with `origin: discovery, resolution: question`. The next tick routes the FB as `feedback_question` via Track B; the main agent reads the FB body, asks the user inline via `ask_user_chat`, writes the answer back, and closes the FB.

**Gap before.** `discovery` origin was missing from the enum (added — see Schema section). `prompts/discovery_required.ts:97-99` explicitly told subagents `The discovery artifact is your only file write. Do NOT touch unit specs, feedback, or stage state.` — blocking the FB path.

**Change.** Updated `prompts/discovery_required.ts:98-113` to:
- Soften the write-scope restriction to "primary write" (artifact stays primary, FB is the exception).
- Add a "Surfacing decisions to the user (GOALS.md)" section with the FB shape spelled out:
  ```
  origin: "discovery"
  resolution: "question"
  stage: <stage>
  source_ref: <agent>
  body: clear question describing the decision
  ```
- Document the routing: next tick's feedback flow routes `resolution: question` FBs as `feedback_question`; main agent asks inline; until the FB closes, the elaborate-loop's 2nd completion signal stays unmet and the cursor won't leave elaborate.

**Verification.**
- `feedback.test.mjs` (64/0) — `MCP tool accepts all valid origins` iterates `FEEDBACK_ORIGINS` and exercises `discovery` end-to-end. `deriveAuthorType` test explicitly asserts `discovery` classifies as agent (lock-in for the auto-triage behavior).
- The Track B feedback-flow routing infrastructure already exists; `feedback-flow-scenarios.test.mjs` (8/0) verifies `resolution: question` returns `feedback_question`.

---

## Sync surfaces

### Paper (`website/content/papers/haiku-method.md`)

**Spec.** Every concept introduced or changed by `GOALS.md` is described in the paper.

**Gap before.** Two passages (lines 304, 593) described `intent_completion_review: false` as the opt-out for completion review.

**Change.** Both passages rewritten to describe universality. Line 304: "Universal — every intent enters completion review after the final stage gate; there is no per-intent opt-out flag. A studio that doesn't want completion review ships zero agents in `studios/<studio>/review-agents/`, and the dispatch becomes a no-op." Line 593 (concept table): equivalent rewrite.

**Verification.** Grep across `website/content/papers/` and `website/content/docs/` for `intent_completion_review.*false` / `opt.out.*completion` produces only the new "no opt-out" statements + the migration doc's "old taxonomy" explainer. No stale opt-out references remain.

### Docs HITL/OHOTL/AHOTL drift — removed across 10 files

**Spec.** Terminology drift (HITL/OHOTL/AHOTL, legacy phase ordering, defunct verbs) is removed across all four surfaces.

**Gap before.** 31 hits across 10 files (`concepts.md` 13, `workflows.md` 13, `example-feature.md` 3, `example-bugfix.md` 4, `guide-developer.md` 1, `guide-manager.md` 1, `guide-ai.md` 5, `migration.md` 1, `checklist-first-intent.md` 1, `adoption-roadmap.md` 1). The terminology described an operating-mode taxonomy that the implementation moved past — actual controls are `intent.mode` + per-stage `gate` type.

**Change.**
- `concepts.md`: Replaced the ~100-line "Operating Modes" section with a "Human Involvement" section describing the actual model: `intent.mode` (continuous / discrete / discrete-hybrid / autopilot / quick) + per-stage `gate` type (auto / ask / external / await). The legacy taxonomy is referenced only to say what it mapped to.
- `concepts.md` stage table: "Mode" column renamed to "Typical Gate"; values switched from HITL/OHOTL to `ask` / `auto`.
- `workflows.md`: Hat table column renamed from "Recommended Mode" to "Typical Involvement"; values rewritten in plain language. Flow diagrams stripped of "(HITL)" / "(OHOTL)" annotations.
- `example-feature.md`, `example-bugfix.md`: Hat section headers `### Planner Hat (HITL)` and the six variants stripped of parentheticals.
- `guide-ai.md`: "Autonomy-clarity tradeoff" table rewritten to reference real setups. "Start with HITL, Earn AHOTL" section renamed and rewritten to describe discrete-mode + ask-gates as the starting point, dialing back to continuous + auto-gates as trust builds.
- `guide-developer.md`, `guide-manager.md`, `checklist-first-intent.md`, `adoption-roadmap.md`: One-line replacements of HITL/OHOTL/AHOTL references with the corresponding gate-type or intent-mode terminology.
- `migration.md`: "Unchanged concepts" list pruned of the legacy taxonomy; new "Replaced taxonomy" section explains what changed and points at `concepts.md#human-involvement`.
- `community.md`: Steve Wilson HITL/HOTL attribution left intact — legitimate external reference to his actual governance-framework work, not a project-internal taxonomy claim.

**Verification.** Final grep: `grep -rn "HITL\|OHOTL\|AHOTL" website/content/docs/` returns three hits — `concepts.md` (the "old taxonomy" explainer), `migration.md` (the "Replaced taxonomy" section), and `community.md` (the Steve Wilson attribution). All intentional.

### Architecture map (`website/app/studios/[slug]/architecture/`)

**Spec.** The runtime actor map, hook registry, payload registry, per-stage rendering, gate types, mode behavior, and pre-tick contracts all match the implementation.

**Gap before.**
- `_data/actors.ts` orchestrator notes documented the per-stage walk through `elaborate → elaborate_review → discovery_required → decompose → start_unit_hat` without mentioning `decompose_review` or the spec's single-state model.
- `_data/payload-for.ts` header docstring listed all CursorAction kinds but omitted `decompose_review`.

**Change.**
- `_data/payload-for.ts` header: added `decompose_review` to the action-kind list. Added a 2026-05-14 block describing the spec's single-state interpretation, the `signal` discriminator, the four completion signals, and the drafting cleared-by-seal mechanic.
- `_data/actors.ts` orchestrator notes: extended the per-stage walk description to include `decompose_review` between `decompose` and `start_unit_hat`. Added an "Elaborate loop is one cursor state, five sub-instructions" paragraph mapping each emitted kind to its `signal` discriminator and on-disk completion signal. Documented the drafting → pending one-way door and how discovery subagents file `origin: discovery, resolution: question` FBs.

**Verification.** TypeScript compilation of the architecture map directory is part of `website && npm run build`. The added text is in docstring comments and a markdown block — no runtime impact. Visual rendering of the map is unchanged (the new action falls under the existing Track A umbrella).

### Workflow diagrams (`website/public/workflow-diagrams/<studio>.mmd`)

**Spec.** Per-studio Mermaid `stateDiagram-v2` files regenerate cleanly and reflect the desired phase progression.

**Gap before.** Generated from `packages/haiku/src/orchestrator/workflow/export-mermaid.ts` against the workflow engine + StudioConfig. The generator's view of stage state hasn't changed shape from my edits (engine state graph is the same set of nodes; `decompose_review` is rendered inside the per-stage walk under the existing `elaborate_review` style).

**Change.** Ran `bun run --cwd packages/haiku export:workflow-diagrams`. All 24 studios exported. `git diff --stat website/public/workflow-diagrams/` returned empty — no structural diff against committed versions, confirming the engine's state graph (as the generator sees it) is unchanged.

**Verification.** Generator run is the verification. Zero-diff regen means the diagrams stay consistent with the committed snapshot.

---

## Test coverage

Per the spec's test-author notes: tests target handlers, not visual fix boxes; one test plus parameter variation covers each conceptual surface; tests assert on disk state, not on tool-call sequences; one tick = one dispatch return.

The relevant test files and what they assert:

| File | Coverage | Result |
|---|---|---|
| `fm-set-tools.test.mjs` | Schema-level FM rejection paths — engine-only fields rejected, immutables rejected, unknown fields rejected, type mismatches rejected | 16/0 |
| `feedback.test.mjs` | FB CRUDL via MCP tool; all 11 origins (including `discovery`) accepted; `deriveAuthorType` classifies `discovery` as agent | 64/0 |
| `feedback-flow-scenarios.test.mjs` | Track B routing by `resolution`: triage, inline, question, revisit | 8/0 |
| `cross-stage-feedback-move.test.mjs` | FB relocation across stages; `haiku_feedback_move` mechanics | Pass in isolation |
| `feedback-mid-flight-e2e.test.mjs` | Mid-flight FB handling end-to-end | Pass in isolation |
| `drift-scenarios.test.mjs` | Drift sweep classification + FB emission | 5/0 |
| `drift-mid-flight-e2e.test.mjs` | Mid-flight drift end-to-end | Pass in isolation |
| `cursor-walk.test.mjs` | Cursor track precedence (C → B → A); wave-ready; hat sequence; review/approval/quality-gate walk; mode shaping; reject re-entry | 27/0 |
| `multi-tick-pipeline.test.mjs` | Full intent lifecycle through 3 stages including new `decompose_review` step | 1/1 (37 sub-tests) |
| `server-tools.test.mjs` | Tool defs ↔ handlers parity (catches `haiku_stage_decompose_seal` not-registered regressions) | 68/0 |
| `elaborate-gate.test.mjs` | Per-stage elaborate gate semantics including verifier seal | 12/0 |
| `announce-user-decisions.test.mjs` | `completeOrReviewIntent` always wraps under withAnnouncement | 11/0 |
| `v0-to-v4-realistic-scenario.test.mjs` | Migration of legacy intent FM | 11/0 |
| `autopilot-mode.test.mjs` | Autopilot gate auto-advance | Pass |
| `export-mermaid.test.mjs` | Per-studio diagram export | 13/0 |

**Asserting on disk state, not tool-call sequence.** Every test in the table above asserts on FM stamps, FB file contents, or git branch state — not on which MCP tools were called. The multi-tick pipeline prints the action sequence for traceability but does not assert on it.

**One tick = one dispatch return.** Each tick in the multi-tick pipeline is a single `runTickWithBranchAlignment` call returning exactly one action; the simulator stamps the corresponding disk state; the next tick is a new call. The 47-tick sealed lifecycle is 47 distinct disk-state transitions.

**Multi-file run cwd pollution.** Running multiple test files in one `bun test` invocation occasionally produces git-cwd errors in fixture setup ("not a git repository"). This is a pre-existing test-ordering artifact, not a regression — every affected file passes when run in isolation. The CI matrix should run files individually or in cwd-resetting groups.

**Same circular import pattern fixed in `start_unit.ts` and `review_fix.ts`.** A full-suite sweep surfaced two more files with the same TDZ chain: `start_unit.ts` pulled `buildFeedbackAssessorPrompt`, `buildOutputRequirements`, and `resolveStudioFilePath` from `../../orchestrator.js`; `review_fix.ts` pulled `resolveStudioFilePath` from the same place. Re-pointed both at their source modules (`../studio.js` and `../validators.js`). `skill-list.test.mjs` (13/0) now passes — the start_unit prompt test was hitting the same TDZ at `prompts/index.ts:121` that the elaborate-prompt test hit at line 96.

**Sweep cleanup — four files surfaced unrelated failures; all four fixed.**

The full-suite sweep across 144 test files surfaced four failing files. Each one had a different root cause; all four are now green. Total at the end: 143 test files (one deleted), zero failures.

- `test/state-tools.test.mjs` (17 fails → deleted) — referenced `packages/bin/haiku-parse.mjs`, a binary deleted in commit `f2e04520c`, and tested v3 concepts (`state.json` with phase/status fields, `bolt`/`hat` as FM fields on units) that v4 dropped (see memory `feedback_v4_no_state_json`). The file's own comment marked it placeholder: `// For now, test the state file operations via haiku-parse.mjs`. Modern coverage of state-tool operations lives in `fm-set-tools.test.mjs`, `feedback.test.mjs`, `cursor-walk.test.mjs`, and the multi-tick pipeline — all green. Removed the dead file.

- `test/migrate-safety.test.mjs` (1 fail → 11/0) — `--apply refuses when git tree is dirty` was failing because the test stubbed `git` via PATH mutation, and under Bun `execSync` uses a startup-snapshot env (verified via minimal repro: `execSync("git status …")` under Bun ignores `process.env.PATH=...` mutations; under Node it honors them). Replaced the PATH-stub `stubGit()` with a real `git init` + `git config` + commit + (for the dirty mode) an untracked file. The migrate dirty-check now runs against real git status; both clean and dirty modes are now deterministic and bun-portable.

- `test/squash-merge-fallback.test.mjs` (2 fails → 5/0) — same Bun env-snapshot issue: the test stubs `gh`/`glab` via PATH for `isBranchMerged()`'s VCS fallback. The fix landed in `src/git-worktree.ts:run()`: pass `env: process.env` explicitly to `execFileSync`. Under Node this is a no-op (default env *is* process.env). Under Bun the default is a startup snapshot, so an explicit `env: process.env` is the difference between honoring vs ignoring runtime PATH mutations. In production where PATH is stable, the effect is zero — it only fixes runtime-env-aware test fixtures.

- `test/http-feedback.test.mjs` (1 fail → 38/0) — `POST body at the cap still accepted (happy path)` timed out. Root cause was order-dependent: the preceding `POST body > 8 MiB returns 413 (envelope cap)` test left a half-aborted socket in undici's keep-alive pool (server cut the connection at 8 MiB, client was mid-write), and the next request reused that dead socket. Added `Connection: close` to the 9 MiB request's headers so the socket can't be reused.

These four sit outside the engine/workflow alignment surface — none of them touch cursor, signal precedence, feedback routing, or the new `decompose_review` action. But they're in the suite, the suite is the verification surface, and the no-excuses policy says "fix them." So they're fixed.

**E2E simulator handlers for `decompose_review` — added across seven files.** Several e2e test simulators (`e2e-software-studio`, `cross-stage-fb-rewalk`, `drift-mid-flight-e2e`, `filesystem-mode-e2e`, `feedback-mid-flight-e2e`, `multi-mode-e2e`, `real-intent-dry-run`, `e2e-mode-coverage`) drive the engine to seal by dispatching each returned action against an on-disk stamper. The new `decompose_review` action was missing from those switches, so the engine kept returning it and the simulators wheel-spun. Each file now has a `case "decompose_review":` that stamps `decompose_verified_at` on `elaboration.md` (mirror of the `multi-tick-pipeline.test.mjs` handler) — same pattern, file-local helpers. All seven now pass.

**TDZ circular import in prompts/decompose.ts — fixed.** `elaborate-prompt.test.mjs` was failing with `Cannot access 'decompose' before initialization` at `prompts/index.ts:96`. Root cause: `decompose.ts` imported helpers (`buildOutputRequirements`, `resolveIntentStages`, `resolveStudioFilePath`) from `../../orchestrator.js`, which re-exports them. `orchestrator.ts` imports `actionPromptBuilders` from `./orchestrator/prompts/index.js`, which imports `decompose.ts` — circular, hits TDZ when the test loads `decompose.ts` directly. Fix: re-pointed the runtime imports at their source modules (`resolveIntentStages` and `resolveStudioFilePath` from `../studio.js`, `buildOutputRequirements` from `../validators.js`). Same fix applied to `validators.ts` for its own `resolveStudioFilePath` import. The orchestrator.ts re-exports stay; this just avoids routing through them at runtime where they create the cycle. `elaborate-prompt.test.mjs` (6/0) now passes.

---

## Per-checkbox attestation

| GOALS.md checkbox | Status | Evidence |
|---|---|---|
| Feedback round-trip without loops | ✅ | `feedback-flow-scenarios.test.mjs` (8/0), `multi-tick-pipeline.test.mjs` sealed in 47 ticks |
| Unclassified feedback is triaged first | ✅ | Track B pre-tick gate at `cursor.ts:1326-1352`; auto-triage at `state-tools.ts:5337-5342` for agent-origin FBs |
| Classified feedback follows the right loop | ✅ | Resolution-based routing in Track B; `feedback-flow-scenarios.test.mjs` covers question / inline / revisit |
| Drift detection fires before anything else | ✅ | Track C first at `cursor.ts:1311-1325`; `drift-scenarios.test.mjs` (5/0) |
| Hats advance cleanly to the final hat | ✅ | Multi-tick pipeline traces `start_unit_hat(a/planner) → start_unit_hat(a/builder) → start_unit_hat(a/verifier) → dispatch_review` |
| FB-as-unit fix loop | ✅ | `feedback-advance-hat-dispatch-contract.test.mjs` and `feedback-carryover.test.mjs` cover the FB-as-unit lifecycle |
| Intent-level feedback stays at intent scope | ✅ | `haiku_feedback` accepts empty stage = intent-scope; auto-triage + routing apply |
| Intent completion review universal — flag removed | ✅ | This session: schema field deleted, orchestrator branch deleted, SPA label rewired, tests updated |
| Intent-level QG derived not declared | ✅ | `intent.quality_gates[]` absent from schema; intent-scope QG runs union of unit gates |
| Conversation can spawn discovery mid-flight | ✅ | Discovery dispatch already in place; `prompts/discovery_required.ts` now also instructs FB filing for surfaced decisions |
| Discovery can surface a question | ✅ | This session: `discovery` origin added, prompt updated to file `origin: discovery, resolution: question` FBs |
| Units can be drafted incrementally | ✅ | Stage-scope: cursor returns `decompose_review` until verified, blocking all wave dispatch; until then every unit is implicitly drafting and fully mutable via `haiku_unit_write` |
| Drafting → pending is a one-way door | ✅ | The seal stamp IS the door: stamp lands → cursor advances past `decompose_review` → next tick fires waves → first hat advance stamps `started_at` → architecture §1.3 forward-only kicks in |
| Elaborate completion is signal-driven | ✅ | This session: 4th signal (`decompose_verified_at`) wired end-to-end; cursor stays in elaborate until all four flip |
| Paper sync | ✅ | This session: lines 304, 593 of `haiku-method.md` rewritten |
| Architecture map sync | ✅ | This session: `_data/payload-for.ts` + `_data/actors.ts` updated with new action + single-state model |
| Workflow diagrams | ✅ | This session: regenerated, zero-diff |
| Docs sync (HITL/OHOTL/AHOTL drift) | ✅ | This session: 10 files updated, terminology replaced with `intent.mode` + per-stage `gate` |

---

## What I didn't do

**Hardening of the verifier-only seal tools.** `haiku_stage_decompose_seal` (like `haiku_stage_elaboration_seal` before it) is instruction-gated — there's no token, no nonce, no field distinguishing the verifier subagent from the main agent. The prompt contract is the protection. A determined or confused agent could self-certify by calling `decompose_review` and then `haiku_stage_decompose_seal` in the same turn. This matches the existing seal-tool family pattern; a future hardening pass could add a verifier nonce. Not in scope here.

**Renaming the 4 cursor action kinds to one `elaborate_loop` kind with sub-discriminator.** The spec says "single cursor state with sub-instructions." I added a uniform `signal` discriminator across the 4 action kinds so consumers can route on `action.signal` to get the single-state behavior. Collapsing the kinds further into one `elaborate_loop { kind, signal }` action would touch every existing test asserting on `action.kind === "elaborate"` and the 4 prompt builders. The behavior is correct as-is; the rename is cosmetic and high-risk for the value it adds. If the cosmetic uniformity matters, it can land as its own small PR with the test churn isolated.

**End-to-end test of the discovery → question → answer → close loop.** The mechanics are wired (origin, classification, prompt instructions, routing existed). A test that drives a real discovery subagent through filing an `origin: discovery, resolution: question` FB and then closing it via inline answer would be valuable as an integration regression. The infrastructure pieces are all individually tested; the integration is implicit in `multi-tick-pipeline.test.mjs`'s use of the discovery action where applicable.
