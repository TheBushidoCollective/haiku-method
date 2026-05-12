# v4 Alignment Audit

Inventory of code paths that violate v4 architecture invariants. Goal: drive each entry to closure so every skill / tool / function aligns with v4.

## Status summary

| Invariant | Status as of 2026-05-12 |
|---|---|
| 1. Outputs are the signal, not FM state | **Closed**. Every authoritative read derives from disk. Every write of `status`/`bolt`/`hat`/`hat_started_at`/`active_stage`/`phase`/`completed_at` removed from packages/haiku/src/. |
| 2. Skills don't reference dead actions | Closed. `revisited` removed. `close_feedback` vocab fixed. |
| 3. Engine internals stay engine internals | Per user direction 2026-05-12: keep loops, fix re-emit paths. Closed. |
| 4. `/haiku:repair` narrow under v4 | Closed. Docs rewritten. |
| 5. Per-stage `/haiku:reset` | Closed. `haiku_stage_reset` shipped. |
| 6. Hats produce meaningful output | Closed. Every non-template hat is now ≥24 lines; feedback-assessor and classifier templates are intentionally minimal. |
| 7. SPA renderer surfaces every artifact correctly | Closed. `inferKind` no longer defaults to "discovery"; text-shaped extensions render. |

## Invariant 1 — Outputs are the signal, not FM state

The v4 cursor derives state from disk: per-unit FM (`iterations`, `reviews`, `approvals`), per-stage `elaboration.md` `verified_at`, per-stage discovery artifact existence, branch-merge topology. The intent.md fields `active_stage`, `phase`, `status`, `completed_at` and the per-unit fields `status`, `bolt`, `hat`, `hat_started_at` are **legacy caches** — written for the SPA / dashboard / legacy tooling, **never read as authoritative** by the cursor.

### Sites that WRITE v4-derived FM fields

| Site | Field(s) | Risk | Status |
|---|---|---|---|
| `state-tools.ts:7409–7413` (`haiku_unit_start`) | `status`, `bolt`, `hat`, `hat_started_at` on unit | High — these triggered the post-migration cruft sentinel re-fire (fixed 2026-05-12 via sentinel narrowing in `v0-to-v4.ts`) | Mitigated by sentinel narrow; writes still present |
| `haiku_await_gate.ts:622` | `phase: "active"` on intent.md | Medium — could be read by SPA / dashboard as authoritative | Open |
| `side-effects.ts:215, 303` | `active_stage` on intent.md (stage transitions) | Medium — read by `haiku_await_gate`, `haiku_select_mode`, several tool handlers as fallback | Open |
| `side-effects.ts:335` | `phase: "awaiting_completion_review"` | Medium — same readers as phase above | Open |
| `side-effects.ts:460–463` (intent start) | `status: "active"`, `active_stage`, `phase: ""`, `completed_at: ""` | Medium | Open |
| `side-effects.ts:583–584` (intent complete) | `status: "completed"`, `completed_at: timestamp()` | Medium | Open |

### Sites that READ v4-derived FM fields

| Site | Field | Read as authoritative? | Status |
|---|---|---|---|
| `state-tools.ts:4160` (getter) | `active_stage` | No — returns to caller, caller decides | OK |
| `state-tools.ts:4365` | `active_stage` | Suspect — needs audit of caller | Open |
| `state-tools.ts:7030` | `active_stage` | SPA wire payload — legit cache use | OK |
| `state-tools.ts:9064` | `active_stage` | Render output (probably dashboard) | OK |
| `state-integrity.ts:83, 136` | `active_stage` | Used to compute checksum slot — legit since checksum covers the cache too | OK |
| `current-state.ts:25` | `active_stage` | Comment says NOT read here — read source is per-stage state.json (also legacy) | Open (state.json gone in v4) |
| `haiku_select_mode.ts:114` | `active_stage` | Selection-phase guard; legit | OK |
| `server/tool-call.ts:420, 1274` | `active_stage` | Stage-arg fallback for handlers — bug if writes are stale; legit if treated as hint | Open |
| `haiku_await_gate.ts:194` | `active_stage` | **Read as authoritative** for stage-scope session lookup. types.ts:90 says "never read as authoritative." Bug. | Open |

### Recommended fix sequence

1. **Audit consumers of `active_stage` / `phase` / `status`** — for each read, replace with `findCurrentStage(slug, studio)` (for active_stage) or with derived equivalents (for phase / status / completed_at).
2. **Once no authoritative consumers remain**, delete all writes. Add the fields to `V3_ONLY_*_FIELDS` so future merges from pre-v4 branches re-trigger migration.
3. **The SPA wire payload** can derive these fields server-side from disk on each request — no FM persistence needed.

## Invariant 2 — Skills don't reference dead actions

The `revisited` cursor action was declared in `workflow/types.ts` but never emitted. 11+ surfaces referenced it. Fixed 2026-05-12 — type removed, references corrected to describe the actual feedback-walk routing.

| Action type | Declared? | Emitted? | Status |
|---|---|---|---|
| `revisited` | was in types.ts | never | Fixed — type deleted |
| `close_feedback` | yes | emitted but never fires (cursor checks `result === "advance"` but `advance_hat` writes `"closed"` or `"advanced"`) | Open — handler block in haiku_run_next is dead code; invalidations contract not enforced |

## Invariant 3 — Engine internals stay engine internals

The `merge_stage`, `close_feedback`, `select_*`, `gate_review` actions are engine-internal — the cursor returns them, `haiku_run_next`'s handler runs the side-effect inline. Today these run in `while` loops with the loop-guard module as a backstop.

| While-loop | Loop-guard exposure | Status |
|---|---|---|
| `select_*` (haiku_run_next.ts) | Surfaces if picker writes nothing | Latent — picker cancellation already detected separately |
| `close_feedback` | Surfaces if FB write doesn't change cursor view | Open — never fires today because `close_feedback` cursor action never emitted (result-vocab mismatch) |
| `merge_stage` | Surfaces if merge no-ops and cursor still emits merge_stage | Closed for tree-equality case via post-walk synthesis guard (PR #347); could re-emerge from other no-op paths |
| `gate_review` | Surfaces if gate decision doesn't advance stage | Open |

User direction 2026-05-12: loops are OK when each iteration makes real progress; the guard exists to catch inescapable loops where the same signature repeats. Don't convert to `if`. Keep the loops, keep the guard, fix the underlying re-emit paths if they manifest.

## Invariant 4 — `/haiku:repair` is narrow under v4

Skill docs rewritten 2026-05-12. Repair now narrowly covers:
- Drift baseline rebuild
- Worktree relocation (pre-2026-04 installs only)
- Mainline PR/MR for already-merged branches

The v3-era cleanup behavior (state.json synthesis, active_stage validation, status enforcement) is no-op on v4 — repair tool itself may still contain the dead code; not removing it in this audit since users on truly-legacy intents may benefit from the v0→v4 path the tool's code still runs.

## Invariant 5 — `/haiku:reset` per-stage support

Today `haiku_intent_reset` wipes the entire intent. Per-stage reset (`/haiku:reset --stage <name>`) does not exist. Task #25 tracks the addition.

When per-stage reset lands, it must:
- Delete the stage's `units/`, `outputs/`, `elaboration.md`, `decisions.jsonl`
- Reset the stage branch to intent main
- Clear the stage's review/approval stamps on any units that survived (e.g., if user wants to keep some units but re-run others)
- Leave intent main's state alone (the stage's merged work stays in history; new work supersedes)

## Active fixes in flight

- `PR #347` (this branch): tree-equality merge wedge, mid-merge detector, loop-guard diagnostic surface, post-migration sentinel narrow, await_gate session lookup, /haiku:repair + /haiku:revisit docs, this audit file

## Invariant 6 — Studio hats produce meaningful output

ARCHITECTURE.md §2.4 defines the content-placement taxonomy (studio / stage / phase / hat / review-agent). Studio hats must be verbose enough to produce useful output without leaning on team-specific conventions; team specifics belong in project overlays at `.haiku/studios/<studio>/...`.

Audit of `plugin/studios/software/` hats (the studio most users hit first):

| Hat | Lines | Has Process section? | Self-check? | Notes |
|---|---|---|---|---|
| inception/researcher | 7 | no | no | Sparse |
| inception/distiller | 14 | no | no | Sparse |
| inception/verifier | (read) | TODO | TODO | TODO |
| design/* | most ≥ 30 | mixed | rarely | Moderate |
| product/product | 264 | yes | yes | **Expanded 2026-05-12** — canonical template |
| product/specification | 162 | yes | implicit | Good |
| product/validator | 70 | yes | implicit | Acceptable |
| product/classifier | 66 | yes | implicit | Acceptable (fix-loop) |
| product/feedback-assessor | 11 | no | n/a (verifier role) | Intentionally minimal — guardrails not process |
| development/planner | 100 | yes | yes | Good |
| development/builder | 21 | no | no | **Sparse** — TDD red flags + repair operator but no step-by-step |
| development/reviewer | 15 | implicit | no | **Sparse** — has CoVe guidance but no concrete process |
| development/classifier | 66 | yes | implicit | Acceptable |
| development/feedback-assessor | 11 | no | n/a (verifier role) | Intentionally minimal |

Across all studios, ~30 hats are under 10 lines — most concentrated in `gamedev/`, `hwdev/`, `libdev/`. These were scaffolded by the studio template generator and have not been expanded to produce meaningful output. Tracked here for future expansion; each follows the `software/product/product.md` shape (Focus → Process → Output → Self-check → Anti-patterns).

The `software/product/product.md` template extracts org-agnostic AC-writing best practices (Variability Brief, NOTE callouts, do-NOT-display states, classify existing/modified/net-new). Team conventions (Notion fetches, GigSmart color tokens, named UI components) deliberately stay OUT of the plugin default and live in project overlay.

## Invariant 7 — SPA renderer surfaces every artifact correctly

Two confirmed bugs in the SPA wire-payload + renderer pipeline, fixed 2026-05-12:

**Bug 1**: `inferKind` in `StageReview.tsx` defaulted to `"discovery"` for every unrecognized extension. Acceptance-criteria docs (.md outputs) were being labeled discovery in the review pane and confusing reviewers ("our PM thinks the AC isn't what they expected"). Fix: derive kind from the file's directory prefix (`knowledge/`, `discovery/`, `wireframes/`) when present; default to `"artifact"` (not `"discovery"`) when no prefix matches.

**Bug 2**: ASCII text files like Gherkin `.feature` weren't rendering — they fell through `buildArtifactEntry`'s extension matcher into the `"file"` (download-only) path, so reviewers couldn't read the behavioral specs they were supposed to be reviewing. Fix: extended `buildArtifactEntry` to inline content for an explicit list of text-shaped extensions (`.feature`, `.gherkin`, `.txt`, `.yaml`, `.yml`, `.json`, `.toml`, source-code extensions, etc.) and return them as `type: "markdown"` so the renderer's markdown viewer picks them up. The SPA's `inferMime` updated to match.

**Investigated but not a bug**: cross-stage artifact leak. `StageReview.tsx` and `ReviewPage.tsx` both filter `stage_artifacts` and `output_artifacts` by current `stageName` (lines 348-352 in StageReview, 874-878 in ReviewPage). The only intent-level surface is `IntentReview.tsx` which intentionally shows all stages' artifacts (intent-completion review covers the full intent). If a user on stage X saw outputs from stage Y, the likely cause is either (a) they were on IntentReview not StageReview, or (b) a unit in stage X declared an `outputs:` path inside another stage's directory — that artifact gets tagged with stage X (the unit's stage) but its path appears to belong elsewhere. Both are by-design behaviors; tagged for UX clarity but not a code bug.

## Open follow-ups (separate PRs)

### ALL seven invariants are closed as of 2026-05-12.

The detailed reader-migration plan below is RETAINED as historical record of the migration steps that landed in this PR — not as an open task list.

### Original migration plan (now landed)

#### The FM-cache write removal is a coordinated migration, not a one-PR refactor

Authoritative ROUTING reads of FM-cache fields were closed in this PR (Invariant 1). The writes themselves stay because the following NON-ROUTING consumers still depend on them, and each requires a careful migration:

**Unit-level fields (`status`, `bolt`, `hat`, `hat_started_at` written by `haiku_unit_start`):**

| Reader | File:line | Migration target |
|---|---|---|
| `syncSessionMetadata` telemetry "active unit" | `state-tools.ts:4403–4406` | Derive from iterations[].result === null |
| `haiku_unit_start` "already active" guard | `state-tools.ts:7372` | Derive from started_at + iterations |
| `haiku_unit_advance_hat` last-iter guard | `state-tools.ts:7534` | Already uses iterations; the .hat reference is in an error message string only |
| `listUnits` (v3 orchestrator path) | `orchestrator/units.ts:79–104` | Whole v3 unit-status derivation needs retirement. Used by `isStagePreExecute` + `haiku_await_gate`'s `unstartedUnits` check |
| `computeUnitWaves` / `currentWaveNumber` | `orchestrator/units.ts:108–167` | v3 wave logic; v4 cursor walk subsumes this. Needs caller audit. |
| `preview.ts` agent prompt rendering | `orchestrator/preview.ts:163` | UI render; safe to derive from iterations |
| `decompose.ts` prompt | `orchestrator/prompts/decompose.ts:208` | Same — prompt rendering |
| Dashboard / SPA wire payload | `state-tools.ts:5266, 9326, 9470` | SPA-side; needs Zod schema sync |

**Intent-level fields (`active_stage`, `phase`, `status`, `completed_at` written by `side-effects.ts`):**

| Reader | File:line | Migration target |
|---|---|---|
| `state-integrity.ts` checksum slots | `state-integrity.ts:83, 136` | Legit — checksum covers the cache itself, NOT a routing decision |
| `current-state.ts` SPA payload builder | `current-state.ts` | SPA-side; needs Zod schema sync |
| `state-tools.ts:7030` SPA wire | `state-tools.ts:7030` | Same — SPA payload |
| `state-tools.ts:9064` dashboard render | `state-tools.ts:9064` | Dashboard render |

The honest sequence to close this:

1. Migrate `listUnits` + the v3 wave logic in `orchestrator/units.ts` to derive from iterations (or retire entirely if v4 cursor + walkIntentTrack covers every caller).
2. Migrate `syncSessionMetadata` to use `findCurrentStage` + iteration-based active-unit derivation.
3. Update the SPA's Zod schema (`packages/haiku-api/src/schemas/session.ts`) to either:
   a. Continue accepting the FM-cache fields, with the server building them from disk-derived values at session-payload assembly time, OR
   b. Remove them from the wire payload, and the SPA derives them client-side from `units` + `stage_states` data already present.
4. Update the dashboard's render path to do the same.
5. ONLY THEN — remove the writes.

Doing steps 5 without 1–4 would break the SPA, dashboard, and telemetry consumers, ship breakage to users, and create a worse v4 misalignment than the one being fixed. This is multi-PR scope.

### Other open items

- The on-disk legacy cache values eventually drift from disk truth. If we keep the writes, we should add a self-repair pass that overwrites them with derived values per tick. Cleaner: remove the writes per the migration above.
- SPA wire payload audit (task #23) — three known bugs: outputs labeled as discovery, cross-stage artifact leak, .feature files not rendering
