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
- **Never pair a VCS issue-closing keyword with a feedback ID.** GitHub and GitLab parse `Closes`/`Fixes`/`Resolves`/`Implements` followed by an `ABC-123`-shaped token as an external-issue closing reference. H·AI·K·U feedback IDs (`FB-07`) match that shape, so `Fixes FB-07` in a commit message or PR/MR description makes the host render a phantom "Closes issues FB-07" link for a finding that is not a ticket — and queues a non-existent issue for closure on merge. Describe the change itself; the feedback linkage already lives in the unit's `closes:` frontmatter. If you must name the finding for traceability use a neutral phrasing — `addresses FB-07`, `per FB-07` — never a closing verb.
- Treat `git push` failures as non-fatal — the engine retries on the next tick. Don't block on a transient remote outage.
- If a stage's review gate is `external`, the engine looks for branch-merge or PR-approval signals. Don't manually flip frontmatter to fake the signal — open the actual PR and let the gate clear.

## Branch architecture (read-only fact you operate against)

- **Intent branch** `haiku/<slug>/main` is the durable record. Engine commits state changes here and pushes after each tick. PR opens against the project's default branch at intent_create.
- **Stage branches** `haiku/<slug>/<stage>` accumulate stage-scope commits. Auto-pushed on state-mutation boundaries.
- **Unit worktree branches** `haiku/<slug>/<unit>` are local-only — never pushed, merged back to the stage branch when the unit completes.

## external_refs handling

When git creates a draft PR at intent-create time, the PR URL is stamped on `intent.md` frontmatter as `external_refs.git_pr` and `draft_pr_status`. The draft flips `ready` automatically at intent completion. You don't write these fields manually — the engine does — but you can read them to surface PR state to the user.

In **discrete / discrete-hybrid** mode the engine also opens a per-stage draft PR at stage start (base = `haiku/<slug>/main`) and records it in the `stage_prs` map on `intent.md` FM; the stage gate flips that draft to ready (merging it is the approval). That stage PR is where the stage's runtime-verification proof gets uploaded. Continuous / autopilot / quick keep everything on the single intent-main draft PR.

## Proof asset uploads (runtime-verification evidence)

Runtime-verification proof (screenshots, video) is **gitignored** — it's regenerated every run and committing it bloats history. It does not travel on a branch merge, so a runtime-verifier uploads it to the relevant PR/MR to make it durable and reviewable. The two hosts differ:

- **GitLab** — first-class: `glab` / `POST /projects/:id/uploads` returns a markdown snippet to embed in the MR description or a note. Access-controlled by project visibility.
- **GitHub** — no inline-attachment API. Attach captures as **release assets** (`gh release upload`) or push to an artifact bucket, then link them from the PR body. (Inline image paste is web-UI-only; a bot can't drive it. Note: GitHub's `user-attachments` CDN URLs are anonymized — anyone with the link can view, even for a private repo.)

Keep uploads idempotent — replace the PR's "Proof" section on re-run rather than stacking duplicates.

## Non-git environments

When `.git/` is absent the framework falls back to filesystem persistence:
- No commits, no pushes, no worktrees.
- `external` review gates degrade to `ask` (local review UI) because there's no structural signal to enforce them.
- All workflow operations still work; this contract simply doesn't apply.
