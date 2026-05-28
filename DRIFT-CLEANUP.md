# Drift Model Cleanup — Implementation Prompt

## The problem

Today's drift detection is conceptually inverted. It witnesses *outputs* (the
files a unit produces) and treats their mutation as drift. That gets the
semantics wrong:

- Outputs are downstream of the decision being signed. A reviewer didn't sign
  off ON the output's bytes — they signed off that the SPEC AND ITS INPUTS
  justified producing some output.
- Outputs are allowed to evolve. The agent re-runs an iteration, a fix-hat
  rewrites the file, a formatter reflows on commit. None of these invalidate
  the approval. The work was approved; the work happening is the natural
  consequence.
- Treating output mutation as drift makes the engine fight the agent doing
  its job. We've observed this manifest as permanent drift loops on
  `terraform/environments/ops/fnox.toml` and similar repo-relative outputs.

The current model also bolts on five files of state to track all this:
`baseline.json`, `baseline-content/`, `drift-markers.json`, `.baseline-ack`,
`baseline-thrash.json` — none of which are necessary if the witnesses live on
the right side of the contract.

## The corrected model

A witness is a snapshot of *premises*, not deliverables. The signature says
"given this set of premises (here are their SHAs), I approve." Drift is the
detection that premises changed since the signature.

**Three drift cases qualify:**

1. The unit body changed (the spec itself was rewritten out-of-band)
2. A witnessed input file was edited, added, or deleted
3. A witnessed input directory's inventory changed (file added inside,
   file removed, file content changed)

**Outputs are NOT drift.** When unit A's output is unit B's input, A
re-running and updating its output is normal — B detects the change as
INPUT drift on B's side, not OUTPUT drift on A's side. Producers never
trigger drift on themselves; consumers detect that their premises shifted.

This generalizes to one mechanism for all three cases:
- Consumer (a signed slot) records SHAs of every premise file/dir at sign
  time, in `input_witnesses` on the slot itself
- Sweep walks each signed slot, diffs witnesses against current on-disk
  state, emits events for mismatches/additions/deletions
- Producer-side has no witness, no drift signal — producers can evolve
  freely

## Storage — single source of truth

Witnesses live in the unit/intent frontmatter, per signed slot. No
separate files, no sidecars, no index. Schema extension:

```yaml
# Unit FM
reviews:
  spec:
    at: 2026-05-16T...
    body_sha256: <unit body sha>
    input_witnesses:                       # NEW
      files:
        "intent.md": <sha>
        "knowledge/DISCOVERY.md": <sha>
      dirs:
        "stages/research/discovery/":
          "personas.md": <sha>
          "competitors.md": <sha>
  continuity:
    at: ...
    body_sha256: ...
    input_witnesses: { ... }               # per-slot, not per-unit
approvals:
  spec:
    at: 2026-05-16T...                     # no witnesses field
discovery:
  research-agent:
    at: ...
    output_sha256: <sha>                   # UNCHANGED
    mandate_sha256: <sha>                  # UNCHANGED
```

Intent.md gets the same `input_witnesses` structure on its intent-scope
review slots.

Per-slot (not per-unit) because each reviewer's signature records premises
as of their own sign time. Reviewer A at T1 and reviewer B at T2 may
witness different SHAs if inputs changed between — both are independently
valid, both detect drift from their own sign moment.

## Resolving "input" per consumer

When `buildReviewRecord(unitPath)` runs at sign time, it builds
`input_witnesses` by resolving:

| Consumer slot                              | Witnesses                                                 |
|--------------------------------------------|-----------------------------------------------------------|
| Unit `reviews.<role>` (any reviewer)       | `intent.md`, each path in `fm.inputs[]` (file or dir)     |
| Intent `approvals.<role>`                  | `intent.md` body (existing `body_sha256`); declared inputs at intent scope if any |
| Unit `discovery.<agent>`                   | Existing `mandate_sha256` only — discovery has a single-file input (its mandate); no other inputs |

Resolution rule for `fm.inputs[]` entries:
- If the path resolves to a regular file → witness as `files[path]: sha`
- If the path resolves to a directory → witness as `dirs[path]: {filename: sha, ...}` (full inventory, excluding dotfiles and engine-internal files)
- If the path doesn't exist at sign time → omit from witnesses (the next sweep treats it as an addition if it appears, which is correct)

`intent.md` is an IMPLICIT input on every unit's reviews — always included,
not declared. The intent body is every unit's orientation.

## Sweep logic

```
for each unit in intent:
  for each slot in unit.reviews:
    if slot.body_sha256 differs from bodySha256(unit.md) → mutation drift on unit body
    for each (path, sha) in slot.input_witnesses.files:
      if !exists(path)        → deletion drift on path
      elif sha256(path) != sha → mutation drift on path
    for each (dir, inventory) in slot.input_witnesses.dirs:
      for each (filename, sha) in inventory:
        if !exists(dir+filename) → deletion drift on dir+filename
        elif sha256(dir+filename) != sha → mutation drift on dir+filename
      for each file currently in dir not in inventory:
        → addition drift on dir+file
  for each slot in unit.discovery:
    [existing output_sha256 + mandate_sha256 checks — unchanged]

for intent.md approvals: same logic as unit.reviews
```

Drop all `approvals.<role>.witnesses` reading from the sweep entirely.

## Resolution flow

**Cosmetic close** (`target_invalidates: []` on a drift FB):

Find each slot whose `input_witnesses` covers the drift event's path.
For each:
- mutation: `input_witnesses.files[path] = current_sha` (or update the
  dir inventory entry)
- addition: add `path: current_sha` to the dir inventory
- deletion: delete the entry from `input_witnesses.files` or the dir
  inventory

One `setFrontmatterField` call per affected unit. Next sweep sees clean.

**Material close** (`target_invalidates: [role]`):

Same as today's flow — delete the named slot from `reviews`, cursor
re-emits `dispatch_review`, `drainPendingDispatches` calls the extended
`buildReviewRecord` which builds fresh `input_witnesses` from current
SHAs.

Both flows are local to one unit, idempotent, and reuse existing FM-mutation
primitives. No `reset_drift`, no marker store updates, no baseline file
sync.

## What to delete

- `stages/<stage>/baseline.json` — never read or written
- `stages/<stage>/baseline-content/` — never read or written
- `<intentDir>/baseline-content/` — kept ONLY in filesystem-only mode (no git
  available) for content recovery; in git mode the dir is never created
- `<intentDir>/drift-markers.json` — replaced entirely by the open-FB walk
  in `collectOpenDriftFbDedup`
- `stages/<stage>/.baseline-ack` — V-11 ack flow goes away
- `stages/<stage>/baseline-thrash.json` — V-11 thrash counter goes away
- `approvals.<role>.witnesses` field — kept readable for one migration
  cycle (so v8 intents don't break), then dropped from new writes
- `state.json` classification in `guard-workflow-fields.ts:118` — stale v3
  vestige, hook entry for a file that doesn't exist
- `/haiku:haiku-repair --confirm-baseline-reset` flow + `--diff-shown` /
  `--confirm-diff-hash` flags
- Almost all of `drift-baseline.ts` — shrinks to ~50 lines for FS-only
  content sidecar storage (optional)
- `drift-markers.ts` — fully deleted
- `baseline-clear-marker.ts` — shrinks to nothing (markers are gone)
- `haiku_debug({op: "reset_drift"})` — no longer needed; consider removing
  the op entirely

## What to add

- `input_witnesses` schema extension in unit FM validator + intent FM
  validator
- `resolveInputWitnesses(intentDir, unitInputs): InputWitnesses` helper in
  sign-slot.ts — reads each input path, classifies file vs dir, builds the
  witnesses block
- Extended `buildReviewRecord(unitPath, intentDir, unitInputs)` signature
  in sign-slot.ts — adds `input_witnesses` to the returned record
- Sweep extension in drift-sweep.ts — new branches for input_witnesses.files
  and input_witnesses.dirs walks
- `applyDriftResolution({slug, fbId, driftEvent, mode})` helper in
  dispatch-stamps.ts (or a new drift-resolve.ts) — handles both cosmetic
  and material close
- FB close handler in state-tools.ts already calls
  `applyFeedbackInvalidations`; extend it to dispatch to
  `applyDriftResolution` when the closing FB has `origin: "drift"`

## Migration (v8 → v9)

Per intent:
1. For every signed `reviews.<role>` slot on every unit, build
   `input_witnesses` from the unit's current `inputs:` field by hashing
   each path now. Treat the current SHAs as the new baseline. Add the
   block to the slot's FM.
2. Drop `approvals.<role>.witnesses` from every unit's FM. (Or leave for
   one cycle as a no-op legacy field; remove in v10.)
3. Delete `baseline.json`, `baseline-content/`, `drift-markers.json`,
   `.baseline-ack`, `baseline-thrash.json` from every intent/stage.
4. Stamp `plugin_version: 9.0.0` on intent.md.

Migration file: `packages/haiku/src/orchestrator/migrations/v8-to-v9.ts`.
Follow the v7-to-v8.ts pattern.

## Prompt update

`packages/haiku/src/orchestrator/prompts/drift/drift_detected/template.eta.md`
needs to be updated to:
- List the three drift kinds (`mutation`, `addition`, `deletion`)
- Reframe the FB instructions: cosmetic close re-stamps the witness,
  material close invalidates the slot
- Drop any reference to output drift

## Implementation order

1. Schema: extend unit FM validator with `input_witnesses` (allow but
   don't require — backward compatible)
2. `resolveInputWitnesses` + extended `buildReviewRecord` — sign-time
   produces the block on new signs
3. Sweep extension — read the block when present, fall back to body-only
   sweep when absent
4. `applyDriftResolution` helper + FB-close integration
5. Stop writing `approvals.<role>.witnesses` — `buildApprovalRecord`
   returns `{at}` only
6. Drop sweep's output-witness check (no more `approvals.<role>.witnesses`
   reads)
7. v8-to-v9 migration: backfill `input_witnesses` on signed slots, delete
   the dead files
8. Delete dead code: drift-baseline.ts shrinks, drift-markers.ts deleted,
   baseline-clear-marker.ts deleted, guard-workflow-fields.ts loses
   stale classifications, debug-ops loses `reset_drift`
9. Update drift_detected prompt
10. Test coverage:
    - new drift kinds (addition, deletion, dir-inventory mismatch)
    - cosmetic-close re-stamp (witness updated, no re-fire next sweep)
    - material-close re-sign (witness rebuilt with current SHAs)
    - input-on-symlinked-intent-dir (validate `deriveRepoRootFromIntentDir`
      is the resolution path everywhere)
    - migration backfill on v8 intents

## Out of scope for this PR

- The `HAIKU_DEBUG_AUTO_CONFIRM` env var (carry from prior stranded commit
  as-is, unrelated)
- The v7→v8 `backfillUnitIterations` (carry from prior stranded commit
  as-is, unrelated)
- Any change to the FB lifecycle, fix_hats sequence, or assessor mandate

## Definition of done

- No drift fires on output mutation, ever
- Drift fires on input mutation/addition/deletion against any signed slot's
  premises
- Cosmetic close re-stamps the witness; next sweep is clean
- Material close re-dispatches and re-signs; next sweep is clean
- `reset_drift` is unnecessary in normal operation
- The intent directory holds: intent.md, action-log.jsonl,
  feedback/, stages/<stage>/{units/, feedback/, discovery/}, and
  (FS-only mode) baseline-content/. Nothing else from the drift subsystem.
- A re-stamp loop has provably terminated when (a) every drift FB closed
  AND (b) the next sweep emits no events
