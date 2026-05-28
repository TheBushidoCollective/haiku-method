# Worktree Isolation Plan — units & fix-chains branch off until terminal

Status: **in progress** (planning + Phase 1). Owner: statusline/engine session.

## Why

v4 (#323, `f977488ac`) removed per-unit worktree isolation and moved units
**in-place on the stage branch**. `createUnitWorktree` / `createFixChainWorktree`
+ their `merge*` counterparts are fully built but have **zero production
callers** (only `merge-correctness.test.mjs` calls `createUnitWorktree`).
ARCHITECTURE.md documents the in-place model as canonical.

The in-place model has a real hazard: a parallel wave of unit subagents all
edit one shared working tree on one stage branch, and `gitCommitAll`'s
`git add -A` (state-tools.ts `gitCommitAll`) sweeps **every** dirty path —
so unit A's `advance_hat` commits sibling B's in-progress edits under A's
message. Disjoint output paths prevent data loss; attribution + premature
commits are still wrong.

**Decision (2026-05-21):** re-wire per-unit and per-fix-chain worktree
isolation. Each unit/fix-chain branches off the stage branch, the loop runs
in its own worktree, and the branch merges into the stage branch **only at
the terminal hat** (atomic). This reverses the v4 in-place model on purpose.

## The model

- `start_unit_hat` first-hat dispatch → unit gets a worktree on
  `haiku/<slug>/<unit>` forked from the stage branch.
- The unit's **code AND full `iterations[]`** commit to the **unit branch**
  each advance (internal to the loop).
- Terminal advance merges the unit branch → stage branch atomically
  (`mergeUnitWorktree` under `withStageLock`), then cleans up the worktree +
  branch.
- Same shape for feedback fix-chains (`createFixChainWorktree` /
  `mergeFixChainWorktree`, branch `haiku/<slug>/<scope>/fix-<FB>`-ish).

### CONVERGED DESIGN (2026-05-21): code-only isolation, iterations on the stage branch

After working the cursor/durability constraints, the model is **code-only
isolation** — it satisfies isolation + atomic merge + statusline + restart
survival with no cursor redesign and no in-flight-signal reinvention:

- **`iterations[]` stay on the STAGE branch** (the durable, cursor-read,
  restart-surviving signal — v4's "filesystem is the only signal"). The
  cursor and statusline are **unchanged**.
- **Only iterations commit to the stage branch — never the work.**
  `advance_hat` writes the iteration to the main-tree stage-branch unit.md
  (no code; the subagent's code lives in the worktree, excluded by the
  `.haiku/worktrees/**` glob).
- **Code/outputs run in the per-unit worktree on the unit branch**, and the
  unit branch is **pushed on each advance** so the work survives a CC restart
  / cross-machine pickup.
- **Terminal advance** merges the unit branch (code) → stage branch
  (`mergeUnitWorktree`, already wired), then **deletes the unit branch local
  AND remote** + the worktree.
- **Pickup recovery:** if the unit branch is gone (local + remote) but
  iterations show a later hat, the referenced code is lost → **reset the
  unit's `iterations[]` and re-dispatch the first hat**. Push-on-advance makes
  this the rare fallback. (No-remote projects: local branch survives a
  single-machine restart; cross-machine pickup degrades to reset-and-restart.)
- **The subagent reads unit body + prior-hat handoffs from the main tree**
  (iterations are on the stage branch), and does its **code work in the
  worktree** (dispatch remaps output paths, mirroring discovery's
  `expectedArtifactPath`). `advance_hat`'s output-existence + scope checks
  resolve against the worktree.

Why not iterations-on-the-unit-branch: it takes the workflow's source of truth
off the durable stage branch, forcing a cursor in-flight-signal reinvention
that can't be made both durable (survive restart) and Rule-1-safe, plus an
orphan-recovery hole. Code-only isolation avoids all of it and still kills the
real hazard (the `git add -A` sibling-code sweep was never about iterations).

### The metadata split (load-bearing) — superseded by the converged design above

The cursor (`run_next`) reads per-unit FM **off the stage branch** to manage
the wave: which units are in-flight (don't re-dispatch), wave-ready, deps
satisfied. If `started_at` + `iterations[]` live only on the unit branch, the
cursor sees an in-flight unit as un-started → **re-dispatches it** (double
dispatch). So:

- **Stage branch keeps a minimal in-flight stamp** per dispatched unit
  (`started_at` + a dispatch marker) so the cursor's in-flight detection +
  wave-ready logic stay correct. Completion arrives via the terminal merge.
- **Unit branch holds the full `iterations[]`** (hat-by-hat detail). The
  cursor never needs hat detail mid-loop — only the relay does, and the relay
  reads the unit branch.

### Statusline active-hat — home-dir runtime channel

Detailed iterations move off the stage branch, so `hatSegments` can no longer
read them there. The engine writes per-unit/per-FB hat status to the home-dir
runtime tree (`intentRuntimeStatePath(slug, "hat-status.json")` — same tree as
the position snapshot + deadlock history) on each `advance_hat`/`reject_hat`.
The statusline reads hat status from there, branch-agnostic, live per advance.
Falls back to the stage-branch read when the channel is absent (cold start /
pre-migration intents).

### Live template: discovery worktrees (already wired in v4)

Discovery is the proven v4 pattern to mirror — it isolates each discovery
subagent in its own worktree and merges back:

- **Create at dispatch:** `decompose/index.ts:560` calls
  `createDiscoveryWorktree(slug, stage, name)`, then **remaps the output path
  into the worktree** (`join(wt, ".haiku/intents/<slug>/…")`) and renders that
  worktree-relative path into the subagent prompt — that's how the subagent
  ends up writing inside its worktree.
- **Merge at completion:** `haiku_discovery_complete.ts:210` does
  `withStageLock(slug, stage, () => mergeDiscoveryWorktree(...))`.

**`mergeUnitWorktree` is ALREADY wired at terminal advance**
(`state-tools.ts:9238`, under `withStageLock`) — it just no-ops today because
no worktree exists. So Phase 3 is largely done; the real gap is creating the
worktree + routing the unit's work (and per-hat `advance_hat` git ops) into it.
Units extend discovery's single-shot pattern to a **multi-hat** loop: every
hat's subagent works in the SAME unit worktree; mid-hat `advance_hat` commits
to the unit branch via `git -C <wt>`; the terminal advance merges + cleans up.

### Subagent works in the worktree (the foundational mechanism)

Pre-v4 (`handlers/execute.ts`) created the worktree at dispatch and passed the
path in the action payload; the subagent worked there. The cursor in v4 must
NOT shell to git (ARCHITECTURE Rule 1), so the worktree is created in
`haiku_unit_start` (the subagent's first call, once per unit). The dispatch
prompt (`buildUnitHatDispatchBlock`) carries the worktree path; the subagent
`cd`s in and does its Edit/Write + commit there. `advance_hat`/`reject_hat`
route their reads/writes/commits to the unit worktree, not the main tree.

**Implication:** unit outputs become worktree-relative during the loop;
`advance_hat`'s output-existence check resolves against the worktree; outputs
land on the stage branch at the terminal merge.

## Touch points

| File | Change |
|---|---|
| `git-worktree.ts` | `createUnitWorktree` / `mergeUnitWorktree` (exist) — wire callers; same for `createFixChainWorktree` / `mergeFixChainWorktree` |
| `state-tools.ts` `haiku_unit_start` | create the unit worktree; return its path |
| `state-tools.ts` `haiku_unit_advance_hat` / `_reject_hat` | operate in the unit worktree; iterations → unit branch; in-flight stamp → stage branch; terminal → `mergeUnitWorktree`; write hat-status channel |
| `unit-dispatch-builder.ts` + `subagent.eta.md` | carry the worktree path; instruct the subagent to work there |
| `computeUnitRelayBlock` (state-tools.ts) | compute next hat from the unit branch FM |
| `cursor.ts` | in-flight detection from the stage-branch stamp (not full iterations); confirm no double-dispatch across all `run_next` paths |
| `statusline/state.ts` `hatSegments`/`unitBars`/`feedbackBars` | read hat status from the home-dir channel (fallback to stage-branch) |
| `statusline/snapshot.ts` | add `hat-status.json` read/write helpers |
| feedback `advance_hat`/`reject_hat` + fix-chain dispatch | mirror the unit model |
| `plugin/studios/ARCHITECTURE.md` | realign — units/fix-chains branch + merge at terminal; the §5.4 walk + Rule 1 wording |

## Phases (each green before the next)

1. **Worktree creation + subagent-in-worktree contract.** `haiku_unit_start`
   creates the worktree; dispatch carries the path; subagent works there.
   No iteration-location change yet (still committed to stage via the existing
   path, redundant) — proves create/cwd/cleanup. Tests: worktree created,
   filesystem-mode fallback, idempotent, cleaned up.
2. **Iterations → unit branch + stage in-flight stamp.** Route advance/reject
   writes/commits to the unit branch; stamp in-flight on the stage branch.
   Cursor in-flight detection off the stamp. **Riskiest** — exhaustive
   double-dispatch + wave-ready tests across every `run_next` path.
3. **Atomic terminal merge.** Terminal advance → `mergeUnitWorktree`; conflict
   handling; worktree+branch cleanup.
4. **Relay reads the unit branch.** `computeUnitRelayBlock` authors the next
   hat from the unit branch; no double-dispatch with `run_next`.
5. **Statusline hat-status channel.** Engine writes per-advance; statusline
   reads it (fallback to stage-branch).
6. **Fix-chains.** Same model for feedback fix-hat loops.
7. **ARCHITECTURE.md realignment + migration + full suite.** In-flight in-place
   intents finish in-place; new units fork. Regenerate workflow diagrams.

## Open risks

- **Crash recovery:** a unit worktree exists but the subagent died. The cursor
  must re-dispatch into the existing worktree (idempotent) — Phase 2 must
  handle the orphan-open-iteration case against the worktree.
- **Concurrent session churn:** the prompt-snapshot refactor session is
  committing these same files; expect rebases. Land phases as small tested
  commits.
- **`run_next` mid-loop reads:** confirm the relay fully owns mid-loop hat
  transitions and the cursor only sees in-flight stamps + merged completion.
