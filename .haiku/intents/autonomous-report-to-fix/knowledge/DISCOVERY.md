---
intent: autonomous-report-to-fix
created: 2026-05-05
updated: 2026-05-08
status: active
---

# Discovery: Autonomous Report-to-Fix Loop

## Business Context

### Feature Goal & Vision

`/haiku:report` currently does one thing: it asks the user what went wrong, synthesizes their words into a structured message, and POSTs it to Sentry. Sentry swallows the event. Nothing else happens. The user never knows if the issue was seen, triaged, or fixed.

The desired outcome is a closed-loop experience: the user runs `/haiku:report`, describes what broke, and then watches a GitHub issue appear attributed to them and a PR open against it — without any further action on their part. When the PR is ready, CI is green, and the fix is merged, the loop closes. The user's only job was firing the shot.

This matters now because H·AI·K·U is hitting a class of bugs that are hard to reproduce from a plain text description but straightforward to diagnose from the session transcript. The JSONL files under `~/.claude/projects/<encoded-cwd>/` already contain everything — the full conversation including tool calls, subagent invocations, and their outputs, linked via `parent_uuid`. Shipping that context to a backend that can run a fresh Anthropic SDK call against it turns a hard-to-reproduce bug report into a directly actionable fix candidate.

The strategic alignment is self-serving in the best sense: faster fix cycles for H·AI·K·U users produce better methodology evidence, and the fix loop itself is a demonstration of the H·AI·K·U methodology applied to H·AI·K·U.

### Origin & Context

The request emerged directly from observed friction: users filing Sentry issues with "something went wrong" messages that provide no enough context to reproduce the problem. The JSONL transcript sitting on the user's machine contains everything needed to reproduce it, but there's no path from that file to a fix without the user manually exporting and describing what they saw.

The design conversation landed on fire-and-forget as the UX contract: the user fires `/haiku:report`, optionally grants GitHub OAuth, and is done. Status lives in the issue/PR itself — no H·AI·K·U-specific status dashboard to build or maintain.

### Success Criteria

The following are stated in user-observable terms. A user watching from their terminal and their GitHub notifications can verify each one without inspecting internal state.

- A user can run `/haiku:report`, describe what broke, and see a GitHub issue opened on `gigsmart/haiku-method` attributed to their GitHub account (or by name/email if OAuth was declined), with a linked bot-authored PR, without any additional manual steps beyond the optional OAuth grant.
- The bot-authored PR reaches CI-green state autonomously — review comments and CI failures trigger fresh agent invocations that push fixes until the checks pass or the per-fix-id iteration cap is reached.
- The session bundle that leaves the user's machine contains no credentials, API keys, environment variables, absolute home paths (`/Users/…`), or other sensitive patterns. Scrubbing happens client-side before POST, not at rest.
- Users who decline OAuth (or don't have a GitHub account) still get the benefit: the issue and PR are opened under the bot account, and the issue body attributes the report to them by name/email if they provided it.
- When the iteration cap is reached, the user receives a user-observable signal (bot comment on the PR or issue, PR left in draft or as-is) — the loop stops cleanly, and the user is not left wondering if something is still running.

## Competitive Landscape

### Who Offers Something Similar

**GitHub Copilot Workspace** — [GitHub Copilot Workspace](https://githubnext.com/projects/copilot-workspace) lets a developer describe a task and generates a PR. It operates on a task description the user writes, not on a diagnostic session bundle. It does not have an autonomous fix-until-green loop driven by webhooks; it requires human iteration at each step. The user must stay engaged to drive progress.

**Devin (Cognition AI)** — [Devin](https://www.cognition.ai/) is a fully autonomous software engineer that can fix bugs end-to-end. It operates as a persistent long-running session (daemonized) and requires explicit task delegation through a separate product interface. It is not an embedded capability inside a developer's existing workflow; the user must context-switch to Devin's environment.

**Sweep AI** — [Sweep](https://sweep.dev) turns GitHub issues into PRs automatically when a user files a `Sweep:`-labeled issue. It does not capture session context, does not do client-side scrubbing, and does not have a fire-and-forget mode from inside the developer's editor. The user must already have a GitHub issue and must label it manually.

**Cursor's bug reporter** — Cursor includes a built-in feedback mechanism that captures editor state and submits it. It does not open issues or PRs, does not run a fix loop, and does not scrub the bundle client-side before transmission. The feedback goes to Cursor, not to the user's own repo.

**OpenHands (formerly OpenDevin)** — [OpenHands](https://github.com/All-Hands-AI/OpenHands) is an open-source autonomous agent framework that can resolve GitHub issues. It operates as a standalone Docker-based environment rather than being embedded in the developer's existing workflow. The user must run and manage the environment themselves.

### What They Do Well

Copilot Workspace has a good UX for the "describe the task, get a PR" flow and integrates natively into GitHub's UI. Sweep has a simple trigger model (label an issue) that requires minimal user education. Devin handles genuinely complex multi-step engineering tasks without requiring the user to understand the approach. OpenHands provides full transparency into agent actions.

### Gaps and Opportunities

None of the above capture the session transcript as the diagnostic artifact. The session JSONL already contains the full context — tool calls, model responses, subagent chains — which is exactly what's needed to reproduce a workflow-engine bug. The opportunity is to make that context the first-class input to the fix loop, rather than asking the user to describe what happened in natural language after the fact.

The fire-and-forget UX contract is also differentiated: none of the above run autonomously until CI is green without requiring the user to stay engaged. The webhook-driven, stateless invocation model means no daemon to manage, no session to babysit. The user fires `/haiku:report` and closes their terminal. The fix loop runs in the background via Cloud Run webhooks.

No competitor combines: (a) in-workflow session capture, (b) client-side scrubbing before the bundle leaves the machine, and (c) webhook-driven autonomous fix-until-green targeting the user's own issue tracker.

## Considerations & Risks

### Strategic Considerations

**Privacy policy gap** — The current `website/content/pages/privacy.md` states "None of that data is sent to GigSmart servers." The report-to-fix loop, by design, sends session bundle data to a Cloud Run service. This is a material change to the privacy model and requires an explicit policy update before shipping. Users need informed consent before their session transcripts leave their machine, even with client-side scrubbing in place.

**OAuth scope trust boundary** — The user's GitHub OAuth scope is issue-write only; the PR is bot-authored. This is the right boundary — the user's token should not be able to create PRs on their behalf. But it means the issue attribution ("opened on behalf of $user") is a convention the bot enforces in the issue body text, not a GitHub platform guarantee. Users who expect the issue to appear in their "created issues" list will be surprised.

**Hardcoded target repo** — The bot opens issues and PRs against `gigsmart/haiku-method` specifically. This is scoped to H·AI·K·U self-reports, not a general-purpose fix-loop for user projects. The design is correct for V1, but it should be documented clearly so users don't expect the loop to fix issues in their own repos.

**Sentry coexistence** — The existing `haiku_report` tool currently POSTs to Sentry (when `SENTRY_DSN` is configured). The new flow replaces or augments this. Whether the Sentry event still fires alongside the Cloud Run POST is a design question for the downstream stages; the privacy implications are that the same report now touches two external surfaces.

**Bounded loops are required** — Each webhook invocation triggers a fresh Anthropic SDK call. A PR that triggers many review comments or CI failures could burn significant tokens. A per-fix-id iteration cap is necessary for cost control and user trust. The specific cap value and the PR state on cap-hit are product/design decisions. Inception names that a cap must exist and what reaching it looks like; design picks the number.

### Capability Needs

- Needs a Cloud Run (Functions Framework) deployment target — the new service is a sibling to `deploy/auth-proxy/` and follows the same GCP Cloud Function v2 + Terraform pattern.
- Needs access to the GitHub API with bot credentials (not user credentials) for issue and PR creation — Cloud Run holds the bot token in Secret Manager.
- Needs GitHub OAuth (issue-write scope) for the user's attributable identity — the existing auth-proxy pattern covers this, but the callback and token exchange must be plumbed for the new `report/:id` flow.
- Needs a webhook receiver — GitHub sends `pull_request_review`, `issue_comment`, and `check_suite` events; the report-agent service must handle these to wake the fix loop.
- Needs the Anthropic SDK (or Claude Code Agent SDK, as used in `packages/haiku/src/repair-agent.ts`) for the event-driven agent invocations on the Cloud Run service.
- Needs a durable state store — each `fix_id` must persist accumulated state across stateless Cloud Run invocations (PR number, iteration count, previous fix attempts, CI results). The state store must survive cold starts.
- Needs client-side secret scrubbing — the plugin must strip tokens, env vars, secret patterns, and absolute home paths from the JSONL bundle before POST.

### Open Questions

- **What is the consent UX?** Does `/haiku:report` explain what data will be sent before collecting it, or does it send first and notify after? The privacy policy change makes this question load-bearing. Proposed default: show a one-line summary of what will be sent before the POST, with an explicit "yes, send" confirmation. `(needs human escalation)` if the legal/privacy bar is higher.
- **What scrubbing patterns are "good enough"?** Regex-based scrubbing (tokens, API keys, `/Users/...` paths) catches known patterns; it cannot catch custom secrets the user has in their environment. Is there a disclosure model (e.g., "we stripped these patterns; please review the bundle preview") or is it fire-and-forget with a warning? Proposed default: strip on uncertainty (conservative), warn the user which pattern categories were removed, no line-by-line preview in V1.
- **What is the per-fix-id iteration cap value?** How many webhook-triggered invocations are allowed before the loop gives up? Proposed default: defer to product/design. Inception only names that a cap must exist.
- **What PR state does the bot leave on cap-hit?** Draft? Closed? Left open with a "bot gave up" comment? Proposed default: defer to product/design. Inception names that the user receives a visible, observable signal.
- **How does the system handle JSONL files that are too large to POST in a single request?** The session JSONL for a multi-stage intent can be several MB. Proposed default: chunking or truncation strategy is a design-stage decision.
- **Is the durable state store a Cloud Firestore document, a GCS object, or something else?** The choice affects cold-start latency and the cost model. Defer to design.
- **Does the report-agent service need its own subdomain** (e.g., `report.haikumethod.ai`), or does it share the `auth.haikumethod.ai` subdomain under a path prefix? Defer to design.
- **What is the webhook secret verification model?** GitHub webhook payloads must be verified with HMAC-SHA256 against a shared secret stored in Secret Manager. The model is clear; the implementation path is a design question.

### Risks

- **Scrubbing false negatives** — A scrubber that misses a credential ships it to GCP. This is a user trust risk, not just a policy risk. The scrubber needs to be conservative (strip on uncertainty) rather than permissive.
- **Bot credential scope creep** — The Cloud Run service holds a bot token with issue-write and PR-create scope on `gigsmart/haiku-method`. If that token is leaked (e.g., in Cloud Run logs), it can create arbitrary issues and PRs. Secret Manager rotation and audit logging are mitigations, not guarantees.
- **Unbounded fix-loop cost** — Each webhook invocation triggers a fresh Anthropic SDK call. A per-fix-id iteration cap is necessary; without it, a flaky CI suite could burn unbounded tokens.
- **Cold-start latency for webhooks** — Cloud Run cold starts can add several seconds to the webhook response time. GitHub expects webhook acknowledgment within 10 seconds; if the function cold-starts and does real work in the handler, it may time out. The fix loop work should be acknowledged immediately and deferred (e.g., via a Cloud Tasks enqueue or by returning 200 and doing the work asynchronously).
- **JSONL subagent chain traversal correctness** — The bundle must include all subagent JSONLs reachable via `parent_uuid` from the current session ID. If the traversal is incomplete (e.g., it misses a nested subagent level), the diagnostic context will be partial and the fix may target the wrong code path.
- **User expectation gap on attribution** — Users who grant OAuth expect the issue to appear in their "created issues" list. It won't — it's bot-authored with their name in the body. This is a communication/UX risk, not a technical risk. The skill's confirmation step should set this expectation explicitly.

## UI Impact

### Affected Surfaces

**`/haiku:report` skill** — The entry point changes from "summarize feedback, call `haiku_report`, done" to a multi-step fire-and-forget flow: bundle collection, scrubbing, POST to Cloud Run, return `{fix_id, auth_url}` to the user. The skill's conversational pattern (ask, summarize, confirm, submit) is preserved, but the submission step is now a POST rather than a Sentry event.

**`haikumethod.ai/report/:id`** — A new page (or SPA route) on the website where users land after `/haiku:report` returns an `auth_url`. The page shows the report status and prompts for the GitHub OAuth grant. Since the website uses `output: "export"` in production, this page cannot be a true dynamic route with a server-rendered `[id]` segment; it must be a client-rendered SPA that reads the `fix_id` from the URL at runtime (the same pattern the `/browse` page uses for remote segments).

**GitHub issue on `gigsmart/haiku-method`** — The bot opens a new issue in the repository. The issue body contains the attribution (user name/email if provided), a description of the problem synthesized by the agent from the session bundle, and a link to the report status page.

**GitHub PR on `gigsmart/haiku-method`** — The bot opens a PR against `main` referencing the issue. The PR description is bot-authored and includes the fix context. Review comments on the PR and CI status events wake the fix loop.

## Existing Code Structure

- `plugin/skills/report/SKILL.md` (active) — current `/haiku:report` entry point; collects feedback via conversation, calls `haiku_report` MCP tool
- `packages/haiku/src/server.ts` (active) — defines `haiku_report` MCP tool (L193); handler in `packages/haiku/src/server/tool-call.ts` (L313)
- `packages/haiku/src/server/tool-call.ts` (active) — `haiku_report` handler (L313–L344): validates Sentry config, calls `reportFeedback`, returns "Feedback submitted"
- `packages/haiku/src/sentry.ts` (active) — `reportFeedback()` and `isSentryConfigured()` helpers; Sentry is the current (and only) submission backend
- `packages/haiku/src/telemetry.ts` (active) — `sanitizeAttributes()` (L390) and `PII_DENY_KEYS` (L344 area) — existing attribute-level scrubbing logic for OTEL events; the pattern to extend for JSONL bundle scrubbing
- `packages/haiku/src/session-id.ts` (active) — session ID generation and encoding helpers; relevant for locating the correct project directory under `~/.claude/projects/<encoded-cwd>/`
- `packages/haiku/src/repair-agent.ts` (active) — Claude Agent SDK integration pattern used for the embedded repair agent; the same `@anthropic-ai/claude-agent-sdk` + `query()` loop is the reference for the Cloud Run event-driven agent invocations
- `deploy/auth-proxy/` (active) — Google Cloud Functions Framework service (single `src/index.ts`); the structural template for the new `deploy/report-agent/` service
- `deploy/auth-proxy/package.json` (active) — Functions Framework dependency and `functions-framework --target=authProxy` start pattern
- `deploy/terraform/modules/auth-proxy/main.tf` (active) — Cloud Function v2 + Secret Manager + GCS source bucket + HTTPS Load Balancer Terraform module; the infrastructure template for the new service
- `deploy/terraform/main.tf` (active) — wires `module.auth_proxy` into the root module; the `module.report_agent` block will follow the same pattern
- `deploy/terraform/variables.tf` (active) — GCP project ID (`gigsmart-oss`), region (`us-central1`), and domain (`haikumethod.ai`) variables; the report-agent module will inherit these
- `website/app/auth/[provider]/callback/CallbackClient.tsx` (active) — OAuth callback client component; the `/report/[id]` page will follow a similar client-side state-machine pattern for the auth grant step
- `website/lib/browse/auth.ts` (active) — `startOAuthFlow()`, `handleOAuthCallback()`, and token storage helpers; the report auth flow will reuse or adapt the same `auth.haikumethod.ai` proxy endpoint
- `website/next.config.ts` (active) — `output: "export"` in production; the `/report/[id]` route must be a client-rendered SPA (no `generateStaticParams`), following the same pattern as `/browse`
- `.github/workflows/claude.yml` (active) — existing GitHub Actions Claude bot that responds to `@claude` mentions in issues and PRs; the report-agent bot is a separate identity but the same comment/review event triggers apply
- `.github/workflows/deploy-auth-proxy.yml` (active) — Terraform-based deploy workflow for the auth proxy; a parallel `deploy-report-agent.yml` will follow the same structure
- `website/content/pages/privacy.md` (active) — current privacy policy; explicitly states "None of that data is sent to GigSmart servers" — **must be updated before ship**
