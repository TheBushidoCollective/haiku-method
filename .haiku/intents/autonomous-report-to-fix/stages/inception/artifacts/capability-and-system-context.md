# Capability Needs and System Context

*Distills the capability inventory required for the autonomous report-to-fix loop — at the "what," not "how," level. Each capability names the rationale, the trust boundary it introduces, and a precedent in the existing codebase that demonstrates achievability.*

---

## Capability inventory

### Cloud Run host

**Rationale.** The fix loop must run outside the user's machine. The agent invocations that diagnose the session bundle, open the GitHub issue, open the PR, and respond to webhook events are backend operations — they require bot credentials, network egress to GitHub and Anthropic, and durable state persistence. A Cloud Run (Functions Framework) service provides a stateless, autoscaling execution environment that can receive HTTPS requests from both the plugin (for the initial bundle POST) and GitHub (for webhook deliveries).

**Trust boundary introduced.** User machine → Cloud Run. The session bundle — including scrubbed JSONL content, the user's name/email, and the synthesized problem description — crosses this boundary as an HTTPS POST. Nothing else leaves the user's machine.

**Precedent.** `deploy/auth-proxy/` is a live Google Cloud Functions Framework service deployed to Cloud Run. Its `src/index.ts` handles HTTPS requests, its `package.json` declares the `functions-framework` dependency and start script, and the Terraform module at `deploy/terraform/modules/auth-proxy/main.tf` provisions the Cloud Function v2 resource, the HTTPS Load Balancer, and the GCS source bucket. The report-agent service is a structural sibling using the same pattern.

---

### GitHub bot identity

**Rationale.** Issues and PRs that appear in `gigsmart/haiku-method` attributed to the bot (not the user) require a separate GitHub identity with installation-level or PAT credentials scoped to issue-write and PR-create on that specific repository. The bot identity is what makes fire-and-forget possible: the user can opt out of OAuth entirely and still get an issue opened under the bot account with an attribution note in the body.

**Trust boundary introduced.** Cloud Run service → GitHub API. The bot token (not the user's token) is used for all write operations against the repository. The token is never exposed to the user's machine or to the plugin.

**Precedent.** `deploy/terraform/modules/auth-proxy/main.tf` (lines 33–82) provisions GitHub OAuth credentials in Secret Manager (`google_secret_manager_secret` resources for `github_client_id` and `github_client_secret`). The Secret Manager + Cloud Function credential injection pattern is the reference for holding the bot PAT/app private key in the report-agent service. The existing `.github/workflows/claude.yml` bot identity (the `@claude` responder) demonstrates that a bot credential can be issued, stored in GitHub Actions secrets, and used to open PRs from workflow runs.

---

### GitHub OAuth for users

**Rationale.** The user's attributable GitHub identity (username, avatar, profile URL) is needed to write an `Opened on behalf of @user` attribution into the issue body. This requires a brief OAuth flow — issue-write scope — so the backend can call the GitHub user endpoint and retrieve the identity. The user's token is used only for identity resolution; all write operations are performed by the bot.

**Trust boundary introduced.** User browser → auth landing page → Cloud Run. The OAuth authorization code exchange happens server-side on Cloud Run; the resulting token is short-lived and scoped to identity resolution only. The user's GitHub token is not persisted beyond the identity lookup.

**Precedent.** `deploy/auth-proxy/src/index.ts` implements a complete GitHub OAuth code-to-token exchange (`POST /github/token`). The existing auth flow in `website/lib/browse/auth.ts` (`startOAuthFlow()`, `handleOAuthCallback()`) and the callback client component at `website/app/auth/[provider]/callback/CallbackClient.tsx` demonstrate the full browser-side OAuth state machine that the `/report/:id` page will adapt. The auth proxy is already deployed at `auth.haikumethod.ai`.

---

### GitHub webhook receiver

**Rationale.** The fix loop is event-driven: CI status changes (`check_suite` / `check_run`), PR review comments, and issue comments each signal that the fix agent should wake up and take the next action. The Cloud Run service must expose a public HTTPS endpoint that GitHub can POST these events to, verify the HMAC-SHA256 signature against a shared secret, and dispatch the appropriate agent invocation without blocking the webhook acknowledgment.

**Trust boundary introduced.** GitHub → Cloud Run. Inbound: GitHub webhook payloads carrying PR metadata, review comment bodies, and CI check results. The HMAC signature check is the boundary guard — unauthenticated payloads are rejected before any processing.

**Precedent.** `.github/workflows/claude.yml` already listens on `issue_comment`, `pull_request_review_comment`, and `pull_request_review` events and dispatches an agent invocation in response. This demonstrates that the event types and trigger conditions the fix loop needs are real and well-understood. The Cloud Run webhook receiver replicates this dispatch pattern outside GitHub Actions, so it can handle check-suite events (which Actions cannot self-trigger on its own PRs).

---

### Anthropic SDK invocation

**Rationale.** The agent that diagnoses the session bundle, synthesizes the issue body, authors the PR description, and responds to review feedback is an AI agent. The Cloud Run service must be able to make calls to the Anthropic API (or the Claude Code Agent SDK) from a server-side context, without a local Claude Code installation. Each webhook event triggers a bounded agent invocation with the accumulated fix-loop state as context.

**Trust boundary introduced.** Cloud Run service ↔ Anthropic API. The session bundle content (scrubbed) and accumulated fix-loop context are sent to Anthropic for inference. No user credentials or unrelated data cross this boundary — only the diagnostic content scoped to the specific fix-id.

**Precedent.** `packages/haiku/src/repair-agent.ts` (line 43 and 66) imports `@anthropic-ai/claude-agent-sdk` and drives an agent loop with `query()`. This is the live, working reference for an SDK-based agent invocation within this codebase. The same `query()` pattern applies directly on Cloud Run — the SDK is a Node package, not a local binary.

---

### Durable per-fix state

**Rationale.** Cloud Run instances are stateless and may be cold-started for each webhook delivery. The fix loop must persist the accumulated state across invocations: the fix-id, the PR number, the iteration count, previous fix attempt summaries, and CI results. Without a durable store, each webhook delivery would start blind and either repeat completed work or fail to make progress.

**Trust boundary introduced.** Cloud Run service ↔ durable state store. State written and read by the service includes: fix-id metadata, PR and issue numbers, iteration counter, and previous agent outputs. This data stays within GCP and does not cross to external parties.

**Precedent.** `deploy/terraform/modules/auth-proxy/main.tf` provisions GCS resources (source bucket) and the Terraform root at `deploy/terraform/main.tf` wires them together — the GCS object pattern is already used for function source bundles and is a known, low-latency read/write surface within the same GCP project. The choice of specific store type (document DB vs. object storage) is a design-stage question; the capability is established by the existing GCP infrastructure footprint.

---

### Client-side secret scrubber

**Rationale.** The session JSONL bundle contains the full conversation including tool call inputs and outputs. These may include tokens, API keys, environment variable values, and absolute home paths. The scrubber must run on the user's machine, before the bundle is POSTed, so that credentials never leave the user's environment. Scrubbing after transmission defeats the purpose — the user's trust depends on "we never saw it," not "we deleted it after receiving it."

**Trust boundary introduced.** This capability lives entirely within the user machine boundary — it reduces what crosses the user machine → Cloud Run boundary. The scrubber is the enforcement point for the privacy commitment.

**Precedent.** `packages/haiku/src/telemetry.ts` (lines 344–390) defines `PII_DENY_KEYS` (a `ReadonlySet<string>` of credential-shaped key names) and `sanitizeAttributes()` (a function that strips matching key-value pairs from OTEL event attributes). This is the live, working key-based scrubbing pattern in the codebase. The JSONL scrubber extends the same logic to cover value-pattern scrubbing (regex for token shapes, absolute home paths) in addition to key-based stripping.

---

## Adjacent systems

### Sentry (`haiku_report` backend)

The existing `haiku_report` MCP tool (`packages/haiku/src/server.ts` line 193; handler at `packages/haiku/src/server/tool-call.ts` lines 313–344) submits a structured Sentry event via `reportFeedback()` in `packages/haiku/src/sentry.ts`. The report-to-fix loop adds a Cloud Run POST alongside (or instead of) the Sentry event.

**Integration question.** Does the Sentry event still fire when the new loop is active? If yes, the same report touches two external surfaces, which the privacy policy must disclose. If no, existing Sentry-based triage workflows break. The design stage must decide: replace, augment, or gate on config.

---

### GitHub Actions (`claude.yml`)

`.github/workflows/claude.yml` already handles `issue_comment`, `pull_request_review_comment`, and `pull_request_review` events and dispatches a Claude Code agent. This bot uses `@claude` mentions as its trigger.

**Integration question.** The report-agent bot is a separate identity using a different trigger model (HMAC-verified webhook, not `@claude` mention). Do these two bots coexist on the same PR, or does the report-agent bot suppress the `@claude` bot for fix-loop PRs? Uncoordinated dual-bot activity on the same PR creates a confusing comment stream.

---

### Auth proxy (`deploy/auth-proxy/`)

The existing auth proxy at `auth.haikumethod.ai` handles GitHub and GitLab OAuth code-to-token exchanges for the browse feature. Its Terraform module, Functions Framework pattern, and OAuth callback flow are the structural template for the report-agent service.

**Integration question.** Should the report OAuth flow reuse the existing auth proxy endpoint (adding a `/report/:id/token` path) or deploy a separate Cloud Function? Reuse avoids a second cold-start surface; a separate function isolates failure domains and credential scopes. The design stage chooses.

---

### Website static export pipeline (`website/next.config.ts`)

`website/next.config.ts` sets `output: "export"` in production. This means no server-rendered dynamic routes — the `/report/:id` page must be a client-rendered SPA that reads `fix_id` from the URL at runtime, the same pattern used by the existing `/browse` page.

**Integration question.** The `/browse` page already demonstrates this SPA-within-static-export pattern. The `/report/:id` page follows it. The question for the design stage is whether `/report/:id` reuses any browse auth infrastructure (token storage, `startOAuthFlow()`) or builds a parallel path.

---

## Trust boundaries

### User machine → Cloud Run

**Data class:** Scrubbed session JSONL bundle (tool calls, model responses, subagent chains with `parent_uuid` resolved), user-provided problem description, optional user name/email for attribution. The scrubber runs before POST; credentials, tokens, env var values, and absolute home paths are stripped on the user's machine.

**Crossing mechanism:** HTTPS POST from the plugin to the report-agent Cloud Run endpoint. The endpoint returns `{fix_id, auth_url}`.

---

### Cloud Run service ↔ Anthropic API

**Data class:** The diagnostic context sent for each agent invocation — a bounded excerpt of the scrubbed bundle plus accumulated fix-loop state (PR number, previous fix summaries, current CI status, open review comments). No user credentials cross this boundary.

**Crossing mechanism:** HTTPS calls from the Cloud Run service to the Anthropic API endpoint, authenticated with a server-side Anthropic API key stored in Secret Manager. Each invocation is bounded by the per-fix-id iteration cap.

---

### Cloud Run service ↔ GitHub

**Outbound (bot writes):** Issue creation payload (attribution text, synthesized problem description), PR creation payload (fix description, linked issue), push of fix commits, response comments to review feedback. Authenticated with the bot credential stored in Secret Manager.

**Inbound (webhook deliveries):** `pull_request_review`, `issue_comment`, `check_suite`, `check_run` payloads from GitHub to the report-agent's public HTTPS endpoint. Verified via HMAC-SHA256 against a webhook secret stored in Secret Manager.

---

### User browser → auth landing page

**Data class:** GitHub OAuth authorization code (transient, one-time-use). The code-to-token exchange is brokered by the auth proxy on Cloud Run; the resulting token is used once for identity resolution and is not persisted in the browser or on disk.

**Crossing mechanism:** HTTPS redirect through GitHub's OAuth flow, landing at `/report/:id` with the authorization code as a URL parameter. The browser POSTs the code to the auth proxy, which exchanges it server-side.

---

## Open questions

1. **Cold-start webhook acknowledgment.** GitHub expects a webhook acknowledgment within 10 seconds. A Cloud Run cold start can add several seconds before the handler even begins processing. If the handler does real agent work synchronously, it risks timing out. The question is whether the capability is achievable as designed — acknowledging immediately and deferring work (e.g., via Cloud Tasks) — or whether the cold-start window makes synchronous handling unreliable. The existing auth proxy is optimized for fast token exchange, not deferred work, so this pattern has no direct precedent in the codebase.

2. **JSONL subagent chain traversal completeness.** The `session-id.ts` module provides session ID encoding for locating the correct `~/.claude/projects/<encoded-cwd>/` directory. However, building a complete session bundle requires traversing `parent_uuid` links across multiple JSONL files, potentially spanning nested subagent levels. There is no existing traversal utility in the codebase — the capability is achievable in principle (the data structure is documented), but the traversal implementation is new ground.

3. **Scrubbing coverage for custom secrets.** `telemetry.ts` demonstrates key-based scrubbing for known PII key names. The JSONL scrubber needs value-pattern scrubbing (regex for token shapes, `ghp_*`, `sk-ant-*`, absolute home paths). The gap is that custom secrets the user has injected into their environment (e.g., a `MY_API_KEY=abc123` that doesn't match any known pattern) cannot be detected by either key-name or pattern matching. Whether the disclosure model (bundle preview before POST) is sufficient to close this gap is a design-stage question.
