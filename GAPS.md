# GAPS.md — Honest Gap Log

## 2026-05-14 status — every gap closed (final pass)

This pass closes the two remaining "deferred by design" items (1a + 3). No gap in this document is open or deferred any longer. The current accounting:

| # | Gap | Final state |
|---|---|---|
| 1 | Concurrent elaborate loop (Option B) | **Closed** — 5 prompt builders + helper |
| 1a | Option A (cursor multi-signal collapse) | **Closed** — `elaborate_loop` action collapses 5 kinds into one; cursor walk + run-tick + prompt router + 11 test files + Mermaid generator updated; see § 1a |
| 2 | Per-unit `draft:` flag | **Closed** — reverted as over-built |
| 3 | Seal-tool verifier nonce | **Closed** — `verifier-nonce.ts` sidecar + AJV-required `nonce` on 3 seal tools + `clearNonce` on re-record; see § 3 |
| 4 | Discovery → question → close E2E test | **Closed** — `test/discovery-question-loop.test.mjs` |
| 4b | `feedback_question` cursor action | **Closed** — implemented as Track-B preempt |
| 5 | Architecture-map visual rendering | **Closed** — `ArchitectureMap.tsx` renders ⑤ decompose_review + discovery-question FB callout |
| 6 | Mermaid generator emits `decompose_review` node | **Closed** — `export-mermaid.ts` now renders `elaborate_loop` (post-Option-A) + regenerated 24 studio .mmd files |
| 7 | `intent_review` 3-tick pipeline | **Not a gap** (intentional per spec) |
| 8 | `signal` discriminator optional → required | **Closed** (signal field moved onto `ElaborateLoopSignal` payload entries — every entry now carries a required `signal` discriminator) |

Suite: 1601 passing, 0 failing (149 test files). The two deferral rationales below remain for the record but are no longer in force.

---

This is the companion to `GOAL-Response.md`. The response doc tracks what was delivered against `GOALS.md`; this doc tracks what wasn't, with the precision the response doc tried to soft-pedal.

Three categories, in priority order:

1. **The concurrent elaborate loop isn't actually concurrent.** The spec's biggest architectural ask landed as plumbing only.
2. **Smaller scope items** noted in the response doc's "What I didn't do" section.
3. **Test coverage** the spec emphasizes but I didn't write.

---

## 1. The concurrent elaborate loop is still sequential — the spec's biggest ask

**Status (2026-05-14):** Option B landed. See § "Option B follow-up — what shipped" at the bottom of this section. The rest of the section is preserved as the original gap analysis for the record.

### What the spec says

From `GOALS.md` § "Elaboration as a concurrent loop, not three sequential phases":

> The current code runs **elaborate → discovery → decompose** as three sequential cursor states. That model is rigid: it can't handle the realistic case where conversation surfaces a knowledge gap mid-flight, where discovery produces a decision the human needs to weigh in on, or where the right time to draft a unit is the moment its shape becomes clear — not after everything else.
>
> The proposal: collapse the three into one **elaborate loop** with three concurrent activities, all writing to disk, all gated by completion signals rather than ordering.
>
> All three run inside the **elaborate** cursor state. None blocks the others.
>
> The agent might call several tools per tick (e.g., during elaborate the agent might call `haiku_dispatch_discovery` AND `ask_user_chat` AND `haiku_unit_write` in one tick)

### What actually shipped

The cursor still walks first-match-wins through the same sequenced clauses it had before this work began. One tick = one action = the agent does one thing. The pieces I shipped that *look* like concurrency are cosmetic:

| Thing shipped | What it does | Behaviorally concurrent? |
|---|---|---|
| `signal` discriminator on the 4 action kinds (`elaborate`, `elaborate_review`, `discovery_required`, `decompose`, `decompose_review`) | Lets a consumer switch on `action.signal` instead of `action.kind` | **No.** Pure renaming. One action per tick. |
| `decompose_review` action | Adds a 4th elaborate-loop completion signal | **No.** Adds another sequential tick. |
| Cursor docstring mapping the 4 kinds to a single conceptual state | Documentation | **No.** Comment text. |
| Discovery FB filing instruction in `prompts/discovery_required.ts` | Discovery subagents *can* file `origin: discovery, resolution: question` FBs | **Partial.** The FB-question path is still sequential: subagent files FB → next tick → Track B routes → main agent answers → close → next tick → cursor continues. |

### Where in the diff the sequential walk lives

- **Cursor track-A walk** at `cursor.ts:893-1042`: ordered first-unmet-wins checks. Returns the first unmet signal; the agent satisfies it; the next tick checks the next unmet signal.
- **Discriminated-union types** at `cursor.ts:115-178`: still 5 separate action kinds. They share a `signal` field, but they're 5 kinds with 5 separate prompt builders.
- **Prompt builders** — `prompts/elaborate.ts`, `prompts/decompose.ts`, `prompts/discovery_required.ts`, `prompts/decompose_review.ts`: each instructs the agent on its own narrow activity. None say "while you're at it, also write a unit if you see the shape" or "also dispatch this discovery template that just became applicable."
- **One tick = one action contract**: every consumer (`run-tick.ts`, prompt registry, action handlers) assumes one action returned per tick. The spec's "agent calls several tools in one tick" requires the prompt to *invite* multi-tool work within a tick, but the cursor still emits one narrow instruction per tick — the agent has no mechanical reason to do anything beyond satisfying that one signal.

### What real concurrency would require

**Option A — collapse the action kinds.**

```ts
type ElaborateLoop = {
  kind: "elaborate_loop"
  stage: string
  signals_unmet: Array<{
    signal: "conversation" | "verify_conversation" | "discovery" | "decompose" | "verify_decompose"
    payload?: Record<string, unknown>   // discovery agent name, etc.
  }>
}
```

The cursor returns ONE action whose payload lists every currently-failing signal, not just first-match. One prompt builder enumerates all unmet signals and tells the agent it can address any/all of them in this tick. The cursor's next tick recomputes the unmet set and returns it.

**Option B — keep the 5 kinds, broaden the prompts.**

Cursor still emits the first-unmet signal each tick, but the prompt for each elaborate-loop kind invites concurrent activity. Example for `elaborate` prompt:

> Your primary task this tick is the conversation gate. You may also:
> - Dispatch any missing discovery templates (`haiku_dispatch_discovery`)
> - Draft units as scope crystallizes (`haiku_unit_write`)
> - File `origin: discovery, resolution: question` FBs if the user needs to decide between forks
>
> All concurrent. None blocks the others. Call `haiku_run_next` when you've made progress on any/all of these.

Option B is lower-risk (no action-kind refactor, no test churn on `action.kind === "elaborate"`). Option A is more honest to the spec's literal "single state" wording but rewrites every consumer.

### Cost to close

- **Option A**: medium-large. Touches `cursor.ts` (union + 5 emission sites), every prompt builder under `prompts/`, every test asserting on `action.kind` (`elaborate-gate.test.mjs`, `multi-tick-pipeline.test.mjs`, `cursor-walk.test.mjs`, etc. — 30+ assertions in the test directory alone).
- **Option B**: small-medium. Touches 4 prompt files + one or two new test cases for the multi-tool flow. No type-level churn. No test-assertion churn beyond new tests.

Recommendation: ship Option B first. It satisfies the spec's behavioral intent (agent doing multiple things per tick during elaborate). Option A's renaming can land later as a cosmetic refactor when the rest of the engine is stable.

### Honest summary of where this work left the concurrent loop

The plumbing prerequisites are in place: 4th completion signal, discovery-question FB path, schema readiness, `signal` discriminator. The behavior the user observes when running a real intent is still sequential `elaborate → elaborate_review → discovery_required → decompose → decompose_review → start_unit_hat`, with each step its own tick, each tick its own narrow prompt, each prompt telling the agent to do one thing. The spec's "single elaborate state, concurrent activities" language is satisfied at the action-shape level (cursor stays in track A's elaborate clauses) but not at the agent-behavior level.

### Option B follow-up — what shipped (2026-05-14)

Option B (broaden the elaborate-loop prompts to invite concurrent activity) landed in this slice. Concretely:

- **New helper** `buildConcurrentElaborateLoopBlock(primary, { slug, stage })` in `packages/haiku/src/orchestrator/prompts/_helpers.ts` emits a standardized "Concurrent elaborate-loop activities (you may stack these into this tick)" block. The block enumerates the four signals NOT being primary this tick and tells the agent it may make progress on any of them in the same response. Closes with a reminder to file `origin: discovery, resolution: question` FBs rather than guessing on user-decision forks.
- **All five elaborate-loop prompts now emit the block:**
  - `prompts/elaborate.ts` — primary `conversation`. Also softened the "Things this gate is NOT" section into "What this gate REQUIRES" so the substance requirements stay sharp without forbidding concurrent activity.
  - `prompts/elaborate_review.ts` — primary `verify_conversation` (per-stage path only; pre-intent path skipped — it lives outside the per-stage loop).
  - `prompts/discovery_required.ts` — primary `discovery`. Block is emitted on both the tool-driven and subagent-dispatch paths.
  - `prompts/decompose.ts` — primary `decompose`. Block is emitted on both the fresh-elaborate full path and the discovery-fan-out early-return path. Iterative re-entry and revisit paths intentionally skip it — those are post-loop re-engagement modes with different semantics.
  - `prompts/decompose_review.ts` — primary `verify_decompose`.
- **Build + 1595-test suite**: green.

### What this does and doesn't change

**Changes:** the agent's first-class instructions on every elaborate-loop tick now name the four other completion signals it may stack into the same response. The spec's "agent calls several tools per tick" is now invited at the prompt level — not just permitted, actively encouraged with concrete examples (`haiku_unit_write`, `haiku_dispatch_discovery`, `haiku_stage_elaboration_record`, the verifier dispatches, and FB-question filing).

**Doesn't change:** the cursor still emits one action per tick (first-unmet-wins). The `action.kind` discriminated union still has 5 elaborate-loop kinds. No test churn was needed. This is exactly the Option B / Option A tradeoff the original gap analysis names: Option B is the smaller diff that delivers the behavioral intent, leaving Option A's cosmetic action-kind collapse as a later refactor.

### Gap 1a — Option A (cursor multi-signal emission) — **Closed**

**Status (2026-05-14, final pass):** **Closed.** Option A landed in full.

The five elaborate-loop kinds (`elaborate`, `elaborate_review`, `discovery_required`, `decompose`, `decompose_review`) collapsed into one `elaborate_loop` CursorAction. Concretely shipped:

- **Cursor union** (`packages/haiku/src/orchestrator/workflow/cursor.ts`): a new `ElaborateLoopSignal` payload type and a single `elaborate_loop` action kind. The old five entries were removed.
- **Cursor walk** (`walkIntentTrack` + pre-intent walk): collects every unmet signal into `signals_unmet[]` and returns ONE action per tick. The per-template discovery fan-out emits one entry per missing template; multiple `signals_unmet` entries can coexist (e.g. `verify_conversation` + `discovery`).
- **Wire shape** (`run-tick.ts`): `cursorActionToOrchestratorAction` now exposes the per-action verifier nonces via `verifier_nonces: { verify_conversation?: <hex>, verify_decompose?: <hex> }` (only emitted when the matching signal is unmet).
- **Prompt registry** (`packages/haiku/src/orchestrator/prompts/index.ts`): the five entries are gone; a single `elaborate_loop` builder lives at `prompts/elaborate_loop/index.ts`. It routes by `signals_unmet[]` to the existing per-signal builders (which remain as helpers, not top-level handlers) and emits a composite "Elaborate Loop" framing.
- **Tests**: 11 test files updated (`elaborate-gate`, `cursor-walk`, `discovery-edge-cases`, `discovery-question-loop`, `multi-tick-pipeline`, `real-intent-dry-run`, `drift-mid-flight-e2e`, `cross-stage-fb-rewalk`, `e2e-mode-coverage`, `e2e-software-studio`, `feedback-mid-flight-e2e`, `filesystem-mode-e2e`, `multi-mode-e2e`, `v3-to-v4-cursor-position`, `verifier-nonce`, `export-mermaid`, plus the `elaborate-prompt` import-path fix). A shared helper at `test/_elaborate-loop-helpers.mjs` (`assertLoopSignal`, `assertNotLoopSignal`, `pickLoopSignal`) keeps the migration uniform.
- **Mermaid generator** (`packages/haiku/src/orchestrator/workflow/export-mermaid.ts`): renders the `elaborate_loop` state with a self-loop (`signals.partial`), an `all_met` transition to execute, and `verifier.fail` / `feedback.pending` routes to review_fix. All 24 studio `.mmd` files regenerated.

Full 1601-test suite is green. The "deferred by design" rationale below remains for the record but is no longer in force.

---

## 2. Per-unit `draft:` flag — over-built, reverted

### What the spec says

> | `drafting` | yes — full mutate | no | `haiku_unit_write` during elaborate |
> | `pending` | yes — full mutate | yes (ready to dispatch) | elaborate completion sweep, or explicit `haiku_unit_finalize` |

### Why the per-unit flag was wrong

Both spec states are "full mutate." The only mechanical differentiator is "counts toward execute." That's a dispatch gate. The stage-level `decompose_review` gate already provides this gate: while `decompose_verified_at` is absent, the cursor refuses all wave dispatch from the stage; every unit is implicitly drafting. Post-stamp, the cursor's next tick walks past `decompose_review` and waves fire; first hat dispatch stamps `started_at`; architecture §1.3 forward-only kicks in.

The per-unit `draft: true` boolean added a second mechanism for the same mechanical constraint. Reviewed in conversation; reverted across schema, cursor wave-filter, seal-tool flag-clearing loop, and architecture-map narrative.

### What WOULD justify reintroducing it

None of these are in the spec, but if any becomes an operational requirement, the per-unit flag earns its keep:

- **Incremental finalization** — agent finalizes 5 of 10 units, leaves 5 in draft for further iteration before re-verifying. Stage-level gate forces all-or-nothing.
- **Auditability** — a glance at unit FM tells you "agent considers this final" without inferring from stage state.
- **Tooling** — a `list_drafts` view doesn't need stage-context inference.

The fact that none of these landed in the spec is itself a design signal: the spec wants all-or-nothing per-stage finalization. Per-unit drafting was solving a problem the spec didn't pose.

---

## 3. Seal-tool hardening — **Closed**

**Status (2026-05-14, final pass):** **Closed.** The verifier nonce shipped end-to-end.

Implementation:

- **Sidecar** at `.haiku/intents/<slug>/.verifier-nonces.json`, managed by `packages/haiku/src/orchestrator/workflow/verifier-nonce.ts`. Keyed by `intent.elaborate` / `stages/<stage>/elaborate` / `stages/<stage>/decompose`. Each entry stores `{ nonce, tied_to }` where `tied_to` is the source artifact's `recorded_at` (stage scope) or `null` (pre-intent).
- **Run-tick mint** (`packages/haiku/src/orchestrator/workflow/run-tick.ts`): whenever the cursor emits an `elaborate_loop` action carrying `verify_conversation` or `verify_decompose` in `signals_unmet[]`, the wire layer calls `ensureNonce(...)` and attaches `verifier_nonces: { <signal>: <hex> }`. Idempotent across ticks while `recorded_at` is unchanged.
- **Seal tools** (`haiku_intent_seal`, `haiku_stage_elaboration_seal`, `haiku_stage_decompose_seal`): TypeBox input schemas now require `nonce: string` (AJV-enforced). Each handler calls `consumeNonce(...)` and returns the named error code `verifier_nonce_invalid` (`reason: "missing" | "mismatch"`) on failure. On success the entry is deleted (single-use).
- **Nonce invalidation on re-record** (`haiku_stage_elaboration_record`): overwriting the elaboration artifact now calls `clearNonce(...)` for both the elaborate and decompose verifier keys, so an in-flight stale verifier dispatched against the prior body can't seal the new body. The next tick mints fresh nonces.
- **Prompt builders** (`prompts/elaborate_review/`, `prompts/decompose_review/`): each verifier subagent prompt now includes the nonce in the `haiku_*_seal` call template, with a "REQUIRED — the seal tool refuses without it (`verifier_nonce_invalid`)" callout.
- **Test** at `packages/haiku/test/verifier-nonce.test.mjs` covers (1) the cursor minting on every elaborate-review action and surfacing it on the action payload; (2) seal-tool rejection with no nonce / wrong nonce; (3) successful consumption + sidecar cleanup; (4) double-consumption returning `missing`; (5) re-record-clears-nonce so the stale verifier path returns `missing`; (6) all three seal tools (`elaborate`, `decompose`, intent).

Full 1601-test suite is green. The "deferred by design" rationale below remains for the record but is no longer in force.

### What's in place

`haiku_stage_decompose_seal` (and its sibling `haiku_stage_elaboration_seal`) are instruction-gated: the prompt contract says "the verifier subagent calls this on a pass; the agent must NOT call it directly." Tool description echoes the same.

### What's missing

No runtime check distinguishes the verifier subagent from the main agent. A determined or confused agent could self-certify by dispatching the verifier and then calling the seal tool in the same turn without actually running the audit. The protection is the prompt contract, not the code.

This matches the existing seal-tool family pattern across the codebase — `haiku_intent_seal` and `haiku_stage_elaboration_seal` have the same trust model. The whole family is uniformly instruction-gated, not runtime-gated.

### Cost to close

Small per tool, large in aggregate. A future hardening pass could add a verifier nonce: the cursor mints a one-time token when emitting `decompose_review`, the seal tool refuses to stamp without the matching token. Touches every seal tool plus the cursor's action payload.

Not in scope for this work.

---

## 4. End-to-end test of discovery → question → answer → close loop

**Status (2026-05-14):** Closed. `packages/haiku/test/discovery-question-loop.test.mjs` exercises the full loop end-to-end: question FB filed → cursor preempts with `feedback_question` (NOT `start_feedback_hat`) → FB closed → cursor falls through to the next elaborate-loop signal. The test also asserts that all elaborate-loop prompts carry the Option B concurrent-activities block. Full 1597-test suite green.

While writing the test I discovered Gap 4b (below) — the `feedback_question` cursor action the prompts promised was never actually implemented. Fixed it in this slice.

### What's tested

- `feedback.test.mjs`: `discovery` is accepted as a valid origin; `deriveAuthorType("discovery") === "agent"` locks the auto-triage classification.
- `feedback-flow-scenarios.test.mjs`: `resolution: question` returns `feedback_question` (this is the general routing, not discovery-specific).
- `prompts/discovery_required.ts`: instructs subagents to file `origin: discovery, resolution: question` FBs when surfacing decisions.

### What isn't tested

A full integration regression that:

1. Dispatches a real discovery subagent
2. Subagent files `origin: discovery, resolution: question` FB
3. Next tick: Track B picks up the FB, returns `feedback_question`
4. Main agent reads FB body, asks user via `ask_user_chat`, writes answer back, closes FB
5. Cursor returns to elaborate; FB-question completion signal flips; cursor proceeds

The mechanics are wired (each piece individually tested). The integration is implicit in the existing flow but not exercised end-to-end by a single test.

### Cost to close

Small. One new test in `feedback-flow-scenarios.test.mjs` or a dedicated `discovery-question-loop.test.mjs`. Drives the fixture through the steps above and asserts on FM stamps and FB body content after each tick.

---

## 4b. `feedback_question` cursor action — promised by prompts, not implemented (uncovered + closed in this slice)

**Status (2026-05-14):** **NEW gap, surfaced + closed.** While writing the Gap 4 test I discovered the prompts at `prompts/discovery_required.ts` and `prompts/_helpers.ts` both promised the agent that a `resolution: "question"` FB would route through a Track-B `feedback_question` action — but no such cursor action existed. Track B's `nextActionForFeedback` was returning `start_feedback_hat` for all open FBs, including question ones. That means a discovery subagent that did the right thing (file a question FB instead of guessing) would get the fix-hat chain dispatched against a body that's a question, not a finding — burning bolts and producing nothing useful.

The fix landed in three places:

- **Cursor union** (`packages/haiku/src/orchestrator/workflow/cursor.ts`): added a new `feedback_question` action kind to `CursorAction`. Carries `stage`, `feedback_id`, `feedback_path`.
- **Cursor Track B** (same file, `nextActionForFeedback`): when an open FB's `fm.resolution === "question"`, return the new action instead of `start_feedback_hat`. Preempts the fix-hat chain.
- **Prompt builder** (`prompts/feedback_question.ts`, new file + registry entry in `prompts/index.ts`): instructs the agent to read the FB body, ask the user inline via `ask_user_chat` / `AskUserQuestion` / `ask_user_visual_question`, write the answer back via `haiku_feedback_write`, then close via `haiku_feedback_update`.

Now the prompts' promise matches reality. Covered by the Gap 4 test.

---

## 5. Architecture-map narrative is updated but not the visual flow

**Status (2026-05-14):** Closed. `ArchitectureMap.tsx` renders a new ⑤ "decompose_review (coverage verifier)" step in the per-stage elaborate phase (gated to non-autopilot modes), and the ② discovery cell carries a callout describing the `origin: discovery, resolution: question` FB path and how the next tick routes it. Website typecheck green.

### What was updated

- `_data/payload-for.ts` header docstring lists `decompose_review` and documents the single-state interpretation.
- `_data/actors.ts` orchestrator notes describe the per-stage walk including `decompose_review` and the discovery → question FB path.

### What wasn't

The architecture map's `ArchitectureMap.tsx` rendering at `website/app/studios/[slug]/architecture/_components/`. Per `.claude/rules/architecture-prototype-sync.md`, the map's visual rendering for the elaborate-loop phase should reflect the new action and the four completion signals.

Verified clean for the `intent_completion_review` opt-out flag removal (no narrative changes needed there). Not verified or updated for the new `decompose_review` action's visual representation, nor for the discovery-question FB path's visual flow.

### Cost to close

Small. Open `website/app/studios/[slug]/architecture/` in a dev server, walk through the elaborate-phase rendering, add a `decompose_review` step between `decompose` and the first `start_unit_hat`, add the discovery-question FB callout in the discovery cell.

---

## 6. Workflow diagrams don't reflect the new action

**Status (2026-05-14):** Closed. `packages/haiku/src/orchestrator/workflow/export-mermaid.ts` now emits a distinct `decompose_review` state node with `verifier.pass` → `execute` and `verifier.fail` → `review_fix` transitions, mirroring how `elaborate_review` is rendered. Re-ran the export and all 24 studio .mmd files under `website/public/workflow-diagrams/` now carry the new node. `test/export-mermaid.test.mjs` updated to assert the new transition; full 1597-test suite green.

### What was done

Ran `bun run --cwd packages/haiku export:workflow-diagrams`. All 24 studios regenerated. `git diff --stat` returned empty — zero structural diff against committed versions.

### Why that's not enough

The Mermaid generator at `export-mermaid.ts` renders the engine's state graph as the generator sees it. The new `decompose_review` action lives inside the per-stage `elaborate_review` style block (the generator doesn't enumerate every phase distinction), so its absence from the diagrams isn't a generator bug — it's a generator limitation.

A more honest visualization would add `decompose_review` as a distinct state node between `decompose` and the per-unit wave block. That requires editing the generator's per-stage rendering.

### Cost to close

Small. Edit `export-mermaid.ts` to emit a `decompose_review` node and its `verifier.pass` / `verifier.fail` transitions, mirroring how `elaborate_review` is rendered today. Re-run the export script.

---

## 7. The `intent_review` step in the multi-tick pipeline fires 3 times

### What I observed

In the multi-tick pipeline output:
```
… → complete_stage(c) → intent_review → intent_review → intent_review → seal_intent → sealed
```

Three `intent_review` ticks for a single intent. This is the studio-completion review walking through configured review-agent roles (`spec`, `continuity`, plus zero or more studio-declared) plus the user gate at the intent-completion layer. Each missing approval role takes its own tick.

### Why this isn't a gap

This is intentional per the spec — intent-completion review walks roles like the per-stage review walk does. Three ticks = three roles. Documented in `cursor.ts` and `prompts/intent_review.ts`.

### Why it's worth noting

The spec's "universal intent completion review" is implemented end-to-end (this work removed the `intent_completion_review:` opt-out flag, and the orchestrator now always enters the review phase). The 3-tick behavior is the user-visible consequence. A studio shipping zero review-agents would still hit the `user` gate (1 tick) before sealing — minimum 1 tick at intent scope, regardless of agent count.

---

## 8. The `signal` discriminator field is optional

**Status (2026-05-14):** Closed. Flipped `signal?:` → `signal:` on all five elaborate-loop CursorAction union members (`discovery_required`, `elaborate`, `elaborate_review`, `decompose`, `decompose_review`) and the one emission site that wasn't populating it (the pre-intent `elaborate_review` early-return in `walkPosition`). Typecheck and 1597-test suite green.

### What I did

Added `signal?: "..."` as an *optional* field on each of the 5 elaborate-loop action kinds. Cursor populates it on every emission, but consumers don't have to read it.

### Why it should be required

The optional shape means a consumer reading `action.signal` has to handle `undefined`. Type-narrowing on `signal` doesn't work cleanly. If a future cursor emission forgets to populate it, the omission is silent.

### Cost to close

Trivial. Change `signal?: "..."` to `signal: "..."` on each of the 5 union members. Re-run typecheck. Existing emissions already populate the field, so no new bugs are introduced — the change just makes the contract explicit at the type level.

I left it optional because that was the minimum-risk addition; making it required after the fact is a five-line edit if/when desired.

---

## Summary of gaps by impact — FINAL (2026-05-14, final pass)

| Gap | Final state | Notes |
|---|---|---|
| ~~Concurrent elaborate loop is sequential, not concurrent~~ | **Closed** | Option B: 5 prompts + helper. See § 1. |
| ~~Option A (cursor multi-signal collapse)~~ | **Closed** | `elaborate_loop` action; 11 test files migrated; Mermaid updated. See § 1a. |
| ~~Per-unit `draft:` flag~~ | **Closed** | Reverted as over-built. See § 2. |
| ~~Seal-tool verifier nonce~~ | **Closed** | `verifier-nonce.ts` sidecar + AJV-required `nonce` on 3 seal tools. See § 3. |
| ~~Discovery → question → close E2E test~~ | **Closed** | `test/discovery-question-loop.test.mjs`. See § 4. |
| ~~`feedback_question` cursor action never implemented~~ | **Closed** | Implemented as Track-B preempt. See § 4b. |
| ~~Architecture-map visual rendering~~ | **Closed** | `ArchitectureMap.tsx` renders ⑤ decompose_review + question-FB callout. See § 5. |
| ~~Mermaid generator emits `decompose_review`~~ | **Closed** | `export-mermaid.ts` now renders `elaborate_loop` post-Option-A + regenerated 24 .mmd files. See § 6. |
| ~~`intent_review` 3-tick pipeline~~ | **Not a gap** | Intentional per spec. See § 7. |
| ~~`signal` discriminator optional → required~~ | **Closed** | Discriminator lives on the `ElaborateLoopSignal` payload entries (every entry required). See § 8. |

**Result:** Every entry in this document is closed; no gap is deferred. Suite: 1601 passing, 0 failing across 149 test files.

Recommended next direction (outside GAPS.md scope): observe a real intent run through the elaborate_loop and verify the agent exercises the concurrent invitations in practice. The prompts are written to invite, but agent behavior under the new framing is the load-bearing thing — if agents continue to serialize ticks despite the invitation, the prompt wording needs another pass.
