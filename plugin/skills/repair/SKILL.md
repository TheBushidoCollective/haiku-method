---
name: repair
description: Rebuild a corrupted drift baseline, relocate misplaced worktrees, or open PRs against mainline for already-merged intent branches
---

# Repair

Call `haiku_repair` for one of the three remaining v4 recovery paths.

## When to use this skill

`haiku_repair` under v4 is narrow. Use it for:

1. **Drift baseline corruption** — the drift sweep reports the baseline can't be read or parsed. The repair tool rebuilds the baseline from the unit's current outputs.
2. **Worktree relocation** — older H·AI·K·U builds (pre-2026-04) rooted `.haiku/worktrees/` at the agent's cwd instead of the primary repo root. After upgrading, the misplaced worktrees still exist and confuse the engine. Repair migrates them via `git worktree move` for clean trees; dirty ones are reported for manual resolution.
3. **Mainline PR/MR generation** — when an intent branch is already merged into mainline but a fixable issue is found, repair pushes a fix commit and opens a PR against mainline.

## When NOT to use this skill

Do not run `/haiku:repair` to "fix a wedge" on a v4 intent that won't advance. The fixes it once did under v3 — synthesizing `state.json`, validating `active_stage`, enforcing `status: completed`/`active` on units — are **no-ops on v4 intents**. v4 derives stage position from disk (unit FM + branch topology), has no `state.json`, and uses iterations + approval stamps instead of unit-level `status` enums. The v0→v4 migrator runs in-band at `haiku_run_next` time and handles every schema-shape concern.

If a v4 intent won't advance, the right diagnostic is the loop-guard diagnostic in `haiku_run_next`'s response (writes to `$TMPDIR/haiku-prompts/{session_id}/loop-guards.log` and surfaces a `diagnostic:` line in the error body). Paste that into a bug report — don't run `/haiku:repair` hoping it'll patch something.

## Default behavior (git repo)

In a git repository, `haiku_repair` (no args) scans every intent branch via temp worktrees, applies the narrow fixes above, pushes, and opens PRs when applicable. The loop is sequential because some fixes need user input.

## Args

- `intent: <slug>` — repair a single intent in the current working directory only (skips multi-branch mode)
- `apply: false` — scan without applying fixes (returns the report only)
- `skip_branches: true` — force cwd-only mode even in a git repo

## Workflow

1. Call `haiku_repair` with the specific concern (drift baseline / worktree / mainline-PR) — passing `intent: <slug>` if scoped to one intent.
2. Read the report.
3. For anything that needs manual attention, follow the report's per-issue instructions.

If the report is empty on a v4 intent, that's the expected outcome. Repair has nothing to do — the engine handles state in-band.
