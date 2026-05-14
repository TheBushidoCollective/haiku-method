# Prompts directory layout — placement rule

This directory holds every per-action prompt builder the orchestrator
dispatches. Each builder is a folder containing `index.ts` (data prep
+ ETA render) and `template.eta.md` (the prose). Static prose blocks
that are too small to template live as plain `.md` siblings under
`blocks/` (or in `_shared/` when reused across builders).

The folder layout is for human navigation — the registry at
`index.ts` flat-maps cursor action name → builder, and the engine
sees a flat name → builder map. Folder depth has no runtime meaning.

## Scope / phase taxonomy

```
prompts/
  stage/
    start_stage/                  lifecycle init
    elaborate/                    elaborate-loop signals (single cursor state)
      elaborate_loop/             the router (the registered action)
      elaborate/                  conversation signal sub-builder
      decompose/                  unit-spec writing sub-builder
      decompose_review/           coverage-verifier sub-builder
      discovery_required/         per-template discovery sub-builder
      elaborate_review/           substance-verifier sub-builder
    execute/                      hat dispatch
      start_unit/, start_unit_hat/
    review/                       pre-execution sign-offs
      dispatch_review/, review/
    approve/                      post-execution sign-offs
      dispatch_approval/, dispatch_quality_gates/
    gate/                         user gates (both pre and post)
      user_gate/
    complete/                     stage merge / advance
      complete_stage/, advance_stage/, advance_phase/
    error/                        engine-refused-to-advance surfaces
      escalate/, blocked/, gate_blocked/, save_wip/,
      <validator-error>/  (unit_inputs_missing, unit_naming_invalid,
                           unresolved_dependencies, dag_cycle_detected,
                           coverage_review_required, etc.)

  intent/
    setup/                        select_studio, migrated
    review/                       intent_review, intent_completion_review
    seal/                         seal_intent, intent_complete, intent_approved
    repair/                       safe_intent_repair, revise_unit_specs,
                                  external_review_requested

  feedback/                       Track B (single track per GOALS § "Two loop primitives")
    feedback_question/, start_feedback_hat/, close_feedback/
    review_fix/, fix_quality_gates/, intent_completion_fix/,
    changes_requested/

  drift/                          Track C (filesystem reconciliation)
    drift_detected/

  global/                         scope-agnostic — keep small
    error/, complete/

  _shared/                        cross-builder static blocks (workflow contracts, error recovery)
  _load-template.ts               runtime fs helper for dev/test
  define.ts                       PromptBuilder identity helper
  types.ts                        PromptBuilderContext + PromptBuilder type
  index.ts                        action name → builder registry (flat)
```

## Where does a new prompt go?

1. **Identify the cursor scope.** Read `plugin/studios/ARCHITECTURE.md`
   §5.2 ("The cursor model — three tracks"). Every action belongs to
   one of:
   - **stage** (Track A per-stage walk)
   - **intent** (Track A intent walk: pre-stage verifier, post-stage
     review/seal)
   - **feedback** (Track B — FB classification routing AND every fix
     loop, because per GOALS § "Two loop primitives" the fix loops
     are the feedback handler with different FB origins)
   - **drift** (Track C — content-hash sweep)
   - **global** (scope-agnostic surface like `error` / `complete`)

2. **For stage and intent, identify the phase** using the
   six-phase model from architecture §2.1:

   ```
   elaborate → execute → review → approve → complete
                                  + gate (user gates branch off review and approve)
                                  + error (engine-refused-to-advance surfaces)
   ```

   Use the cursor's emit clause as the source of truth. If your
   action is emitted in `cursor.ts` under "All hat sequences done;
   some review role unsigned", you're in `review`. Match the wording
   in the cursor walk, not your intuition.

3. **Engine-refused-to-advance surfaces** (validator errors,
   transient blocks, escalations) live in `stage/error/`, not in
   the phase they would have unblocked. Same shape: pre-tick check,
   return action instead of phase work.

4. **One action, one prompt.** When a single action emits at two
   scopes (e.g. `escalate` at both stage and intent scope, or
   `dispatch_quality_gates` at both stage and intent), keep ONE
   prompt with internal branching on the discriminator field. Do
   not duplicate — the registry maps action name → one builder,
   period.

5. **Fix loops are feedback.** Per GOALS § "There is no separate
   'fix handler' for spec vs adversarial vs user gate vs quality
   gates" — they're all the feedback loop with different FB
   origins. So `review_fix`, `fix_quality_gates`,
   `intent_completion_fix`, `changes_requested` all live in
   `feedback/`, not in their originating phase folder.

6. **Truly scope-agnostic surfaces** (`error`, `complete`) live in
   `global/`. Keep this folder small — most prompts have a scope.

## Adding a new prompt: checklist

1. Create the folder at the correct scope/phase per the rules above.
2. Add `index.ts` with the `definePromptBuilder` export and the
   `loadTemplate(import.meta.url)` call at module top-level.
3. Add `template.eta.md` (or for very short prose, a plain `.md`
   sibling under `blocks/`).
4. For long static prose blocks shared across builders, add to
   `_shared/<name>.md` and import via `loadTemplate(import.meta.url,
   "<name>.md")` from `_shared/index.ts`.
5. Register in `prompts/index.ts` under the matching scope section
   (the registry is grouped by scope to make the layout visible at a
   glance).
6. If the cursor emits the action, ensure the cursor's `CursorAction`
   union covers the shape and the cursor walk has the corresponding
   emit clause.
7. Test the prompt renders correctly (most prompts have a touching
   integration test under `test/`; if not, add one).

## Why this layout

- **Scope is the cursor's contract.** Every cursor track
  (A/B/C/intent walk) is a different decision surface. Folder layout
  reflects that decision surface so reading `prompts/feedback/`
  shows everything the FB classification routes to, in one place.
- **Phase is the cursor's per-track walk.** Within Track A, the
  phases are the cursor's stage-state machine. Folder layout
  reflects how the cursor moves through the stage lifecycle.
- **One prompt per action, not per emit site.** Several actions
  (escalate, dispatch_quality_gates) emit at multiple scopes. The
  prompt branches internally. Two folders for one action would
  duplicate the prose and let the two copies drift.
- **No special-casing.** The registry stays flat (action name →
  builder); only the file layout changes. The esbuild plugin
  (`scripts/inline-prompt-templates.mjs`) walks the whole prompts
  subtree by regex, so depth doesn't affect inlining.
