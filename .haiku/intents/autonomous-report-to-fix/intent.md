---
title: Autonomous report-to-fix loop
studio: software
mode: continuous
created_at: '2026-05-05'
stages:
  - inception
  - design
  - product
  - development
  - operations
  - security
plugin_version: 4.0.0
approvals: {}
started_at: null
sealed_at: null
---

# Autonomous report-to-fix loop

Extend `/haiku:report` from a feedback submission into a fire-and-forget self-healing loop. The plugin bundles the user's session JSONL plus every subagent JSONL traced via `parent_uuid` under `~/.claude/projects/<encoded-cwd>/`, scrubs secrets and `/Users/...` paths locally to reduce liability, then POSTs the sanitized bundle to a new Cloud Run service at `deploy/report-agent/` (sibling to `deploy/auth-proxy/`, same Functions Framework shape). The service returns `{fix_id, auth_url}`; the plugin opens `haikumethod.ai/report/:id` so the user can grant GitHub issue-write OAuth, after which the agent opens an issue attributed to them on `gigsmart/haiku-method`, drafts a bot-authored PR referencing the issue, and wakes on webhooks (review comments, CI status) to push fixes until CI is GREEN. The loop is event-driven — no daemons, each wake reads accumulated state, acts, exits.

Decisions from the design conversation: (1) `/haiku:report` stays as the single entry point — fire-and-forget, user checks status via the PR/issue links themselves. (2) New service lives at `deploy/report-agent/` as a sibling to existing `deploy/auth-proxy/` (Google Cloud Functions Framework, single `index.ts`). (3) Session bundle includes the main session JSONL plus every subagent JSONL under `~/.claude/projects/<encoded-cwd>/` whose `parent_uuid` chain traces back to the current session, plus the relevant `.haiku/intents/{slug}/` tree. (4) Scrubbing happens client-side before POST — tokens, env vars, common secret patterns, `/Users/...` paths — so artifacts that leave the user's machine are already sanitized. (5) Target repo is hardcoded to `gigsmart/haiku-method`; Cloud Run holds bot credentials. The user's GitHub OAuth scope is issue-write only, so the issue is attributed to them ("opened on their behalf"); the PR is bot-authored and references the issue. (6) Agent runtime is event-driven via GH webhooks — initial fix, review-comment, CI-status — each invocation a fresh Anthropic SDK call with accumulated state, no long-running process. Spans plugin (skill rewrite + new MCP tool for bundle/scrub/POST), website (`/report/[id]` auth landing page), and a new Cloud Run service.
