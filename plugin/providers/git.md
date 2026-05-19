---
provider_kind: git
category: workflow
always_on: true
splices_into:
  - elaborate
  - execute
  - seal_intent
description: Git workflow provider — branch lifecycle, auto-push, draft-PR lifecycle, external gate signal detection.
---

# Git Provider — Behavior Contract

H·AI·K·U is always git-backed when a `.git/` directory is present. This contract is **always active** in git environments — no settings activation needed.

## What you, the agent, must do

- Never run `git checkout`, `git merge`, `git branch -d`, or create branches manually during workflow operations. The engine owns branch topology, merge semantics, worktree creation, and stage-branch enforcement.
- Commit substantive work (unit body edits, artifact writes, code changes) before calling `haiku_unit_advance_hat`. The engine commits state files (state.json, unit/intent frontmatter) on its own ticks; it does NOT commit your edits to artifact bodies or source files.
- Treat `git push` failures as non-fatal — the engine retries on the next tick. Don't block on a transient remote outage.
- If a stage's review gate is `external`, the engine looks for branch-merge or PR-approval signals. Don't manually flip frontmatter to fake the signal — open the actual PR and let the gate clear.

## Branch architecture (read-only fact you operate against)

- **Intent branch** `haiku/<slug>/main` is the durable record. Engine commits state changes here and pushes after each tick. PR opens against the project's default branch at intent_create.
- **Stage branches** `haiku/<slug>/<stage>` accumulate stage-scope commits. Auto-pushed on state-mutation boundaries.
- **Unit worktree branches** `haiku/<slug>/<unit>` are local-only — never pushed, merged back to the stage branch when the unit completes.

## external_refs handling

When git creates a draft PR at intent-create time, the PR URL is stamped on `intent.md` frontmatter as `external_refs.git_pr` and `draft_pr_status`. The draft flips `ready` automatically at intent completion. You don't write these fields manually — the engine does — but you can read them to surface PR state to the user.

## Non-git environments

When `.git/` is absent the framework falls back to filesystem persistence:
- No commits, no pushes, no worktrees.
- `external` review gates degrade to `ask` (local review UI) because there's no structural signal to enforce them.
- All workflow operations still work; this contract simply doesn't apply.
