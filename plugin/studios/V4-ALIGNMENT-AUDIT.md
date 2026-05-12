# v4 Alignment Audit

Inventory of code paths that violate v4 architecture invariants. Goal: drive each entry to closure so every skill / tool / function aligns with v4.

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

## Open follow-ups (separate PRs)

- Per-stage `/haiku:reset` (task #25)
- Remove the FM-cache writes after auditing consumers (Invariant 1)
- Fix `close_feedback` cursor emission OR remove the action entirely (Invariant 2 cont.)
- Expand sparse hats per the `software/product/product.md` shape, prioritized by user-visibility: `software/development/{builder,reviewer}`, `software/inception/{researcher,distiller,verifier}`, then the gamedev/hwdev/libdev studio hats
- SPA wire payload audit (task #23) — three known bugs: outputs labeled as discovery, cross-stage artifact leak, .feature files not rendering
