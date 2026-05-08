---
title: Cowork Mode
description: Use H·AI·K·U on repositories you don't have checked out locally
order: 13
---

Cowork mode lets you use H·AI·K·U when you're not inside a git repository — for example, when an orchestrator is coordinating work across multiple repos, or when you're working from a team/cowork Claude session.

## How It Works

When you run `/haiku:start` outside of a git repo, H·AI·K·U detects this and enters cowork mode:

1. **Get the repo URL** — H·AI·K·U asks which repository the work targets. If VCS MCP tools (e.g., GitHub MCP) are available, it offers discovered repos as options.
2. **Clone the repo** — The repository is cloned to a temporary workspace.
3. **Proceed normally** — Once cloned, everything works identically to being in a local repo. Settings, providers, hooks, and all other features operate as expected.

The key principle: **cloning eliminates the cowork problem surface**. There are no special cowork code paths after the initial clone.

## Artifact Delivery

In cowork mode, after elaboration writes `.haiku/` artifacts and creates tickets:

- Artifacts are committed on the intent branch (same as normal)
- The intent branch is pushed to the remote automatically
- Builders can pull the branch or clone independently

## Execution in Cowork

The `/haiku:pickup` skill handles cowork transparently:

- Ensures remote tracking is configured for the intent branch
- Pulls latest changes before starting each unit
- Fetches the active stage branch from origin and materializes it as a local ref. The pickup hint at the top of the response names the branch — run `git switch <branch>` if you want to inspect in-flight unit work directly. The engine drives the workflow from intent main; you don't need to be on the stage branch.
- When spawning builder teammates, includes the repo URL so they can clone independently

## Draft PR for the Intent

Every intent that runs in a git repo with a provider CLI (`gh` or `glab`) on PATH gets a draft PR/MR opened automatically at intent-create time, off `haiku/<slug>/main` against the repo mainline. The team has one place to watch the work happen as stages land. The engine flips the draft to ready when the intent completes — just before the agent's merge action.

The PR URL is stamped on the intent's `intent.md` frontmatter as `draft_pr_url`, and the lifecycle status (`draft` / `ready` / `failed`) on `draft_pr_status`. Both are engine-managed; agent writes are rejected with `intent_field_engine_only`.

## When to Use Cowork

- **Team orchestration** — A lead coordinates work across multiple repos from a single session
- **Remote planning** — Elaborate on a repo you haven't cloned yet
- **CI/CD integration** — Automated systems that need to run H·AI·K·U workflows

## Next Steps

- **[Providers](/docs/providers/)** — Connect to Jira, Notion, Figma, and Slack
- **[Workflows](/docs/workflows/)** — Understand the hat-based workflow system
