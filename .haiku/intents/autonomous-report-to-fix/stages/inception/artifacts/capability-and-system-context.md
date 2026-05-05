---
intent: autonomous-report-to-fix
unit: unit-02-capability-and-system-context
stage: inception
created: 2026-05-05
---

# Capability Needs and System Context

This artifact enumerates what the report-to-fix loop must be able to do — at the *what*, not *how*, level — and maps each capability to a precedent already established in the codebase. Downstream stages inherit this view rather than re-discovering it.

## Capability inventory

### Cloud Run host

**Rationale.** The report-to-fix loop requires a persistent, internet-addressable service that receives the POST from `/haiku:report`, runs the initial agent synthesis, and stays alive to handle subsequent webhook events from GitHub. This is stateless invocation territory — the service wakes on demand, does work, persists state externally, and sleeps. Cloud Run's consumption model fits and the project already has the Terraform vocabulary for it.

**Trust boundary introduced.** User machine → Cloud Run service. The user's JSONL bundle, scrubbed before transmission, crosses the public internet and lands inside the GCP project `gigsmart-oss`. Once inside Cloud Run, the bundle is handled by code running under the service's IAM identity — not the user's identity.

**Precedent.** `deploy/auth-proxy/` is a Cloud Functions Framework service (`@google-cloud/functions-framework ^3.0.0`, `package.json`) deployed as a Cloud Function v2 via `deploy/terraform/modules/auth-proxy/main.tf` (`google_cloudfunctions2_function.auth_proxy`, `build_config.runtime = "nodejs22"`). The infra module — GCS source bucket, serverless NEG, regional HTTPS LB, managed cert, Secret Manager wiring — is the exact structural template the new service will follow.

---

### GitHub bot identity

**Rationale.** The loop needs to open issues and PRs on `gigsmart/haiku-method` without using any user token. A dedicated bot account with a fine-grained PAT scoped to contents-write and issues-write on that repo is the right boundary — it keeps user credentials off the Cloud Run service entirely and lets the issue body attribute the report to a human without that human having write access.

**Trust boundary introduced.** Cloud Run service ↔ GitHub. The bot PAT lives in Secret Manager and is injected into the Cloud Run environment. A credential leak in Cloud Run logs would expose PAT scope limited to `gigsmart/haiku-method`.

**Precedent.** The Terraform module `deploy/terraform/modules/auth-proxy/main.tf` demonstrates the Secret Manager pattern: `google_secret_manager_secret` + `google_secret_manager_secret_version` + `secret_environment_variables` block inside `service_config`. The `HAIKU_GITHUB_OAUTH_CLIENT_ID` and `HAIKU_GITHUB_OAUTH_CLIENT_SECRET` secrets injected into the auth proxy follow exactly this pattern. The bot PAT will use the same mechanism.

---

### GitHub OAuth for users

**Rationale.** Users who want the GitHub issue attributed to their account (appearing in their activity feed, notified when the PR closes) need to grant a short-lived read-only identity token. The scope needed is issue-write only — enough for the bot to stamp the issue with the user's login, not enough to create PRs or push code under their identity. Users who decline OAuth still get the fix; they just lose the attribution link.

**Trust boundary introduced.** User browser → Cloud Run auth landing page → GitHub OAuth. The user's GitHub identity (login, email if public) flows from GitHub's OAuth response to the Cloud Run service. The user's GitHub token never leaves their browser; only the attribution metadata is forwarded.

**Precedent.** `website/lib/browse/auth.ts` implements `startOAuthFlow()`, `handleOAuthCallback()`, and token storage via `localStorage`. The `AUTH_PROXY_URL = "https://auth.haikumethod.ai"` pattern and the `POST /{provider}/token` code-exchange call are already live. `deploy/auth-proxy/src/index.ts` handles the `/github/token` endpoint with `HAIKU_GITHUB_OAUTH_CLIENT_ID`/`HAIKU_GITHUB_OAUTH_CLIENT_SECRET` from Secret Manager. The new report flow needs a narrower OAuth scope (`issues:write` read-only) and a different callback destination (`/report/:id`), but the infrastructure exists.

---

### GitHub webhook receiver

**Rationale.** The fix loop is event-driven. After the bot opens a PR, GitHub sends `pull_request_review`, `pull_request_review_comment`, and `check_suite` events to wake the next agent invocation. Without a webhook receiver, the loop would require polling — which is fragile, expensive, and slower. The receiver must verify the HMAC-SHA256 signature on each payload before processing.

**Trust boundary introduced.** GitHub → Cloud Run webhook endpoint. GitHub makes outbound HTTPS POST requests to the service URL. The shared webhook secret (stored in Secret Manager) is the only trust anchor. An attacker who knows the endpoint URL but not the secret cannot inject fake events.

**Precedent.** `.github/workflows/claude.yml` shows the event types the existing Claude bot already receives: `issue_comment.created`, `pull_request_review_comment.created`, `pull_request_review.submitted`, `issues.opened/assigned`. These are the same event shapes the report-agent webhook receiver will consume. The Actions workflow processes them via `anthropics/claude-code-action@v1`; the new service handles them directly via the Anthropic SDK. The GitHub webhook delivery model and event schema are established.

---

### Anthropic SDK invocation

**Rationale.** The Cloud Run service needs to run a Claude agent — synthesizing the session bundle into a diagnosis, opening the issue, writing the initial PR — and then re-run it on each webhook event that signals a CI failure or review comment requiring a fix. The invocation must be stateless from the SDK's perspective: each event starts a fresh `query()` call with accumulated context injected as the system prompt.

**Trust boundary introduced.** Cloud Run service ↔ Anthropic API. The session bundle (scrubbed) and accumulated fix context cross to Anthropic's inference endpoints. The Anthropic API key lives in Secret Manager.

**Precedent.** `packages/haiku/src/repair-agent.ts` demonstrates the exact pattern: dynamic `import("@anthropic-ai/claude-agent-sdk")`, `sdk.query()` call with a system prompt constructed from context, graceful fallback if the SDK is unavailable. This is the reference implementation for the Cloud Run event-driven agent invocations.

---

### Durable per-fix state

**Rationale.** Cloud Run instances are stateless — they can be torn down between webhook events. The loop must persist state across invocations: the `fix_id`, the GitHub issue number and PR number opened in phase 1, the iteration count, previous fix attempt summaries, and the accumulated CI results. The state must be readable by any Cloud Run instance that handles the next webhook for the same `fix_id`.

**Trust boundary introduced.** Cloud Run service ↔ GCP managed storage backend. Fix state (which includes the scrubbed session bundle and fix history) is written to a GCP-managed service. The data class is sensitive enough to require encryption at rest (GCP default) and access control scoped to the report-agent service account.

**Precedent.** `deploy/terraform/modules/auth-proxy/main.tf` already provisions a `google_storage_bucket` for function source artifacts. The GCS write pattern is established in the project's Terraform vocabulary. Whether fix state lands in GCS objects or Firestore documents is a design-stage decision; the capability (durable GCP-managed storage accessible from Cloud Run) is proven.

---

### Client-side secret scrubber

**Rationale.** The JSONL bundle leaving the user's machine must not contain tokens, API keys, environment variable values, or absolute home paths (e.g., `/Users/jwaldrip/...`). Scrubbing must happen in the plugin process, before POST, so the Cloud Run service never receives raw secrets. The scrubber must be conservative — strip on uncertainty — because a scrubbing false negative ships a credential to GCP.

**Trust boundary introduced.** User machine → plugin process (scrubbing boundary) → public internet. The scrubber is the last line of defense before the bundle leaves the user's control. Post-scrubbing, the bundle is considered safe for transmission to an external service.

**Precedent.** `packages/haiku/src/telemetry.ts` implements `PII_DENY_KEYS` (a 30-entry deny set covering credential-shaped and body-shaped keys, lines 344–381) and `sanitizeAttributes()` (lines 390–412), which case-folds keys and strips matched entries before emitting OTEL events. The pattern — deny-list + case-fold match + per-key warning — is the direct ancestor of the JSONL scrubber. Extension to value-pattern matching (regex on token shapes, path patterns like `/Users/[^/]+/`) is the design-stage question.

---

## Adjacent systems

### Sentry (`packages/haiku/src/sentry.ts`, `packages/haiku/src/server/tool-call.ts` L313–L344)

The existing `haiku_report` MCP tool submits user feedback as a Sentry `captureFeedback` event via `reportFeedback()`. The new loop replaces the destination (Cloud Run instead of Sentry) but the trigger (user runs `/haiku:report`) is the same. **Integration question:** does the Sentry event still fire in parallel with the Cloud Run POST, or does the new flow replace it entirely? Privacy implications differ: Sentry receives the user's prose description; Cloud Run receives the scrubbed JSONL bundle. Both touch external surfaces.

### GitHub Actions — existing Claude bot (`.github/workflows/claude.yml`)

The existing workflow triggers on `@claude` mentions in issues and PRs and runs `anthropics/claude-code-action@v1`. The report-agent bot is a separate identity (a dedicated bot account, not the `@claude` GitHub App) and a separate invocation path (webhook → Cloud Run → Anthropic SDK, not Actions runner → Claude Code CLI). **Integration question:** can the two bots coexist on the same repository without collision? The fix-loop bot must not respond to `@claude` mentions intended for the Actions bot and vice versa. Bot identity separation is the design question.

### Auth proxy (`deploy/auth-proxy/`, `auth.haikumethod.ai`)

The existing auth proxy handles GitHub and GitLab OAuth code-exchange for the `/browse` feature at `auth.haikumethod.ai`. The report-agent flow needs OAuth for user attribution using a different scope (`issues:write` vs `repo`). **Integration question:** extend the existing auth proxy to handle a new `/github/report-token` endpoint with the narrower scope, or deploy a second auth proxy instance for the report flow? Sharing the infrastructure is simpler; separate deployment reduces blast radius if the report OAuth client is compromised.

### Website static export pipeline (`website/next.config.ts`)

The website uses `output: "export"` in production — no server-rendered dynamic routes. The `/report/[id]` status page must be a client-rendered SPA that reads `fix_id` from the URL at runtime. **Integration question:** the same constraint applies to the `/browse` page (`website/app/auth/[provider]/callback/CallbackClient.tsx` is the precedent for a client-side state machine in a statically exported site). The `/report/[id]` page follows the same pattern; the integration question is routing configuration in `next.config.ts` (trailing slash behavior, 404 fallback for the `[id]` segment).

---

## Trust boundaries

### User machine → Cloud Run service

**Data class flowing across:** scrubbed JSONL bundle (session transcript with secrets stripped), user-provided problem description text, optional user name/email for attribution. This is the highest-sensitivity boundary in the loop. The user has not consented to this transmission under the current privacy policy — the policy update is a prerequisite to ship.

### Cloud Run service ↔ Anthropic API

**Data class flowing across:** the scrubbed session bundle (as context in the system prompt), accumulated fix history, agent-authored PR description and commit messages. Anthropic's data processing terms apply. The scrubbed bundle is the only user-originated data; fix history is bot-generated.

### Cloud Run service ↔ GitHub

**Outbound (bot-initiated):** issue body, PR description, commit content, review comment responses. These are bot-authored and contain no user credentials. The bot PAT is the credential; it lives in Secret Manager and is injected as an environment variable — never written to Cloud Run logs if the service handles it correctly.

**Inbound (GitHub-initiated):** webhook payloads for `pull_request_review`, `pull_request_review_comment`, `check_suite.completed`. Verified via HMAC-SHA256 before processing. The payload includes GitHub user metadata (commenter logins, CI check names) but no credentials.

### User browser → auth landing page

**Data class flowing across:** GitHub OAuth authorization code (short-lived, single-use), returned GitHub access token (scoped to `issues:write`). The access token is used once to stamp the issue attribution and then discarded — it is not stored server-side. This boundary is the same trust model as the existing `/browse` OAuth flow.

---

## Open questions

- **Webhook acknowledgment under cold start.** GitHub expects webhook acknowledgment within 10 seconds. A Cloud Run cold start adds latency before any application code runs. If the service cold-starts and immediately does real agent work (Anthropic SDK call) in the webhook handler, the 10-second window may close before acknowledgment is sent. The standard mitigation — return HTTP 200 immediately and enqueue the work (e.g., Cloud Tasks) — is well-established, but the codebase has no Cloud Tasks precedent. Whether this capability is fully established (a fast `ack + enqueue` handler) or requires new infrastructure is a design-stage question the current precedents don't fully resolve.

- **JSONL bundle size under `output: "export"` constraints.** A multi-stage intent JSONL can be several MB. The plugin POST path must handle chunking or streaming if the bundle exceeds a practical HTTP payload limit. No existing code in the plugin demonstrates large-payload POST with retry/resume semantics.

- **Webhook secret rotation.** The HMAC-SHA256 webhook secret must be stored in Secret Manager and rotated without downtime. The auth-proxy Terraform module shows how to inject a Secret Manager value as an environment variable, but it does not demonstrate zero-downtime rotation (which requires dual-secret verification during the overlap window). This is a feasibility gap for the webhook receiver capability.
