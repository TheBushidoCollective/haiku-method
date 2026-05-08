---
category: git
description: Git storage provider — sync H·AI·K·U intent state to remote via intent branches
---

# Git Provider — Default Instructions

When running in a git repository, the MCP automatically commits and pushes state changes. This behavior is environment-detected, not studio-configured — if git is available, it is used.

## Branch Architecture

H·AI·K·U uses two branch types with fundamentally different lifecycle rules:

### Intent Branch (`haiku/{slug}/main`) — PUSHED
- **This is where state lives.** Every orchestrator state change commits and pushes here.
- Kept in sync with the remote at all times.
- Push failures are non-fatal — commit is preserved locally, pushes on next attempt.
- PR/MR created from this branch at intent completion (if `auto_pr` is enabled).

### Unit Branches (`haiku/{slug}/{unit}`) — LOCAL ONLY
- Created as worktrees for parallel unit execution.
- **Never pushed. Never have PRs opened.**
- Merged back to the intent branch when the unit completes.
- Worktree cleaned up after merge.

## Inbound: Provider → H·AI·K·U

On session start, check git state:

- **Branch detection** — verify current branch matches `haiku/{slug}/main`
- **Remote sync** — check if intent branch is ahead/behind remote; pull if behind
- **PR/MR status** — if a PR exists for the intent branch, surface its review state
- **Merge conflicts** — detect conflicts with the default branch; surface before delivery

### Translation (Provider → H·AI·K·U)

| Provider Concept | H·AI·K·U Concept | Translation |
|---|---|---|
| Intent branch | Intent | `haiku/{slug}/main` maps to the active intent |
| Pull Request / Merge Request | Delivery gate / external review signal | PR review decision (APPROVED) or merge state (MERGED) maps to external gate resolution |
| PR review comments | Review feedback | Surface as context for review agents |
| Merge conflict | Blocker | Flag intent as needing conflict resolution |
| Remote ahead/behind | Sync state | Behind = pull needed; ahead = push needed |
| Default branch (main/master) | Base branch | Target for PR creation |

## Outbound: H·AI·K·U → Provider

### Commit & Push (Intent Branch Only)

Every orchestrator state change triggers:
1. `git add .haiku/` — stage state changes
2. `git commit` — atomic state snapshot
3. `git push` — sync to remote (intent branch only)

State changes that trigger commit + push:
- Stage start / complete
- Unit start / complete / reject
- Hat advance
- Intent create / complete
- Go back (stage or phase)

### PR/MR Creation (At Intent Completion)

When `auto_pr` is enabled:
- **Intent completion** → create PR from `haiku/{slug}/main` to the default branch
- PR title: intent title from intent.md
- PR body: summary of stages, units, and review outcomes

### What Does NOT Get Pushed

- Unit worktree branches (`haiku/{slug}/{unit}`) — strictly local
- Temporary state files — only committed state goes to remote
- In-progress unit work — only merged results via the intent branch

## External Gate Signal Detection

For stages with `external` review gates, the orchestrator checks approval using two tiers:

### Tier 1: Branch Merge Detection (Primary)

The primary signal is whether the stage branch (`haiku/{slug}/{stage}`) was merged back into the intent main branch (`haiku/{slug}/main`). The orchestrator checks this locally using `git merge-base --is-ancestor` and falls back to checking for merged PRs via `gh`/`glab` (which handles squash merges where the branch commit is not a direct ancestor). This is structural verification — the agent cannot fake a branch merge.

### Tier 2: URL-Based CLI Probing (Fallback)

If a `external_review_url` was recorded in the stage state, the orchestrator also checks PR/MR approval status via CLI tools:

- **GitHub** — `gh pr view <url> --json state,reviewDecision` → advances on `MERGED` or `reviewDecision === "APPROVED"`
- **GitLab** — `glab mr view <url> --output json` → advances on `merged` state or `approved === true`

This complements Tier 1 by detecting approval before the branch is actually merged. Runs automatically on every `/haiku:pickup`.

## Intent Draft PR Lifecycle

Every intent that runs in a git repo with a provider CLI on PATH (`gh` or `glab`) gets a draft PR opened automatically at intent-create time:

- **At intent_create** — the engine pushes `haiku/{slug}/main` to origin and runs `gh pr create --draft --base <mainline> --head haiku/{slug}/main` (or the `glab mr create --draft` equivalent). The PR URL is stamped on `intent.md` frontmatter as `draft_pr_url`, with `draft_pr_status: "draft"`. The PR is the single place where the intent's work accumulates as stages land.
- **During the intent** — every stage's commits land on its own branch, then merge into `haiku/{slug}/main`. The draft PR's diff grows as the team progresses through stages.
- **At intent completion** — just before the agent's merge action, the engine flips draft → ready via `gh pr ready <url>` (or `glab mr update <iid> --ready`). Status moves to `draft_pr_status: "ready"` with `draft_pr_ready_at` stamped.
- **Failure handling** — if the draft can't be opened (no CLI, push failure, fresh repo with no remote) the engine stamps `draft_pr_status: "failed"` and surfaces a manual `compareUrl` in the tool result. Intent creation never blocks on the PR. Same for the ready-flip — failures log and the user's merge proceeds.

## Stage-Branch Auto-Push

The engine pushes the active stage branch (`haiku/{slug}/{stage}`) to origin automatically on every state-mutation boundary (stage start / stage complete / pre-stage cleanup) and at the end of every `haiku_run_next` tick where the local HEAD has advanced past origin's tip. This catches both engine commits and agent code commits between ticks.

The push is best-effort and never blocks the workflow. Set `HAIKU_NO_AUTO_PUSH=1` to disable for offline development.

## Pickup Auto-Fetch

`/haiku:pickup` (which calls `haiku_run_next { pickup: true }`) fetches origin and materializes the active stage branch as a local ref so a fresh user can `git switch` into in-flight work. The user's working tree isn't auto-checked-out — the engine drives the workflow from intent main; the fetched branch is just there for inspection.

## Non-Git Environments

When not running in a git repository, the MCP operates in filesystem mode:
- State is stored as files on disk in `.haiku/`
- No commits, no pushes, no branches, no worktrees
- Units work in-place rather than in worktree isolation
- All lifecycle operations still function — just without version control
- **External gates fall back to `ask`** — there is no structural signal (branch merge) to enforce external review, so the framework opens the local review UI for human approval instead of blocking indefinitely

## Provider Config

Configuration lives under `providers.git.config` in `.haiku/settings.yml`.
Schema: `${CLAUDE_PLUGIN_ROOT}/schemas/providers/github-git.schema.json`

Config fields:
- `auto_push` → push intent branch after every commit (default: true)
- `auto_pr` → create PR at intent completion (default: true)
- `default_branch` → base branch for PRs (default: "main")
- `remote` → git remote name (default: "origin")
