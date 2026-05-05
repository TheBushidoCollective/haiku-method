# Open Questions with Proposed Defaults

_Inception artifact for intent: autonomous-report-to-fix_

This artifact collects every open question surfaced across the inception artifacts and assigns each one of two outcomes: a proposed default that downstream stages can adopt unless the user vetoes, or a `(needs human escalation)` flag with a reason explaining why the agent cannot reasonably resolve it. Every ambiguity is named once here, with a path forward, so downstream stages don't make these calls quietly and inconsistently.

---

## Resolved-by-default

### Q: What is the per-fix-id iteration cap?

The system needs a hard ceiling on how many webhook-triggered agent invocations it will make for a single `fix_id` before converting the PR to a draft and posting a "bot stopped" comment. Without this, a PR that accumulates many CI failures or review comments can exhaust Anthropic API quota indefinitely.

- **Proposed default**: 5 fix attempts per `fix_id`, where one "attempt" is counted as one webhook-triggered agent invocation that pushes at least one commit.
- **Rationale**: Five attempts is enough for the common class of deterministic bugs (missing import, wrong variable reference, type error) while capping the token cost of pathological cases. The count unit (successful commits, not total invocations) means the cap does not fire on invocations that discover the bug is already fixed or that the CI failure is flaky — only on invocations that actually produce code changes. The cap must be enforced in the durable state store, not in the Cloud Run instance, so cold-start restarts don't reset it.
- **Source**: DISCOVERY.md § Risks → unbounded fix-loop cost (lines 94–95); `success-criteria-and-acceptance-shape.md` § Bounded Loops

---

### Q: What is the POST bundle size cap, and how does truncation work?

The JSONL bundle assembled from the user's session files can be several megabytes for multi-stage intents. The POST to Cloud Run has a practical payload limit, and a hard rejection is worse UX than graceful truncation.

- **Proposed default**: 5 MB compressed (gzip) as the client-side threshold. If the bundle exceeds this, the plugin truncates to the N most-recent top-level session messages (preserving the full `parent_uuid` subagent chain for those messages), surfaces a one-sentence notice to the user ("Session was large; sent the last N messages"), and proceeds. If even the truncated bundle exceeds 5 MB compressed, the submission fails with a user-visible error and a link to file a manual GitHub issue.
- **Rationale**: Cloud Run Cloud Functions v2 supports up to 32 MB uncompressed request bodies; 5 MB compressed is conservative enough to give the fix agent substantial context while keeping cold-start I/O overhead manageable. Truncating from the tail of the session (most-recent messages) preserves the failure context, which is typically in the last few turns. The notice to the user maintains transparency without blocking the fire-and-forget flow.
- **Source**: DISCOVERY.md § Open Questions (line 85); `success-criteria-and-acceptance-shape.md` § Bounded Loops; `capability-and-system-context.md` § Open Questions (JSONL bundle size under `output: "export"` constraints)

---

### Q: Does the Sentry event still fire alongside the Cloud Run POST?

The current `haiku_report` MCP tool posts to Sentry when `SENTRY_DSN` is configured. The new flow adds a Cloud Run POST. Both touch external surfaces; the relationship between them needs to be defined.

- **Proposed default**: Sentry fires as a fallback only — if the Cloud Run POST fails or returns a non-2xx response, the tool falls back to the existing Sentry `captureFeedback` call. Under a successful Cloud Run POST, Sentry is not invoked. This avoids the user's problem description going to two external surfaces under normal operation while preserving the error path.
- **Rationale**: Under the privacy principles (unit-04), each external surface that receives user data requires disclosure at the consent step. If Sentry fires in parallel by default, the consent screen must disclose two transmission targets, which complicates the UX and the privacy policy. Fallback-only is the simplest model that preserves the existing error signal without expanding the normal-path disclosure surface.
- **Source**: `success-criteria-and-acceptance-shape.md` § Open Questions; `capability-and-system-context.md` § Adjacent Systems → Sentry; DISCOVERY.md § Strategic Considerations → Sentry coexistence (lines 68–69)

---

### Q: Does the `/report/<fix_id>` page need its own subdomain?

The Cloud Run report-agent service needs an addressable endpoint for the `auth_url` returned to the user and for GitHub webhook delivery. Whether this is a subdomain (`report.haikumethod.ai`) or a path on the existing domain (`haikumethod.ai/report/<fix_id>`) affects infrastructure complexity and the static-export constraint on the website.

- **Proposed default**: The status page lives at `haikumethod.ai/report/<fix_id>` as a client-rendered SPA — no subdomain required. The Cloud Run service endpoint is separate and internal (a `run.app` URL or a path on `auth.haikumethod.ai`); it is not the user-facing `report/<fix_id>` address. The SPA reads the `fix_id` from `window.location` at runtime, following the same pattern as the `/browse` page.
- **Rationale**: A new subdomain requires a new managed TLS certificate, a new Terraform module, and DNS propagation delay. The path-prefix approach reuses the existing `haikumethod.ai` certificate and CDN configuration. The static-export constraint on the website (`website/next.config.ts`, `output: "export"`) is already handled by the `/browse` SPA pattern — `/report/<fix_id>` is the same shape.
- **Source**: DISCOVERY.md § Open Questions (line 87); `affected-surfaces-and-user-flow.md` § `haikumethod.ai/report/<fix_id>` (static-export constraint); `success-criteria-and-acceptance-shape.md` § Open Questions

---

### Q: What is the scrubbing-uncertainty UX: warn-and-proceed or pause-and-confirm?

When the client-side scrubber detects patterns it cannot confidently classify, it has two options: strip them and proceed with a notice (Option A), or halt and ask the user to review before sending (Option B).

- **Proposed default**: Option B (pause-and-confirm) for V1. The scrubber strips known-pattern items automatically, but surfaces any unclassified high-entropy strings to the user with a "review before sending" step. The user can approve the stripped version, remove additional items, or abort the submission.
- **Rationale**: The privacy principles (unit-04, Consent UX Principles) state that consent must be obtained before data leaves the machine and that the user must be able to make an informed decision without trusting the scrubber blindly. Option A (warn-and-proceed) assumes the scrubber is correct; Option B gives the user the last word on novel patterns the scrubber cannot classify. The fire-and-forget UX promise is preserved for the common case — most sessions will have no unclassified items, so the pause step never triggers. The pause-and-confirm path fires only when the scrubber genuinely cannot classify something.
- **Source**: DISCOVERY.md § Open Questions (line 82); `success-criteria-and-acceptance-shape.md` § Bounded Loops → behavior on bundle scrubbing uncertainty; `privacy-and-data-handling-principles.md` § Consent UX Principles

---

### Q: What happens when the GitHub bot token is rate-limited during issue creation?

If the GitHub API rate-limits the bot token at the moment the Cloud Run service tries to open the initial issue, the POST response to the plugin will either hang or fail. The plugin needs a defined behavior for this edge case.

- **Proposed default**: The Cloud Run service returns a `202 Accepted` with `{fix_id, auth_url, status: "queued"}` when it cannot immediately create the GitHub issue due to rate limiting. The service enqueues the issue-creation work (via Cloud Tasks or an internal retry loop with exponential backoff up to 60 seconds). The plugin surfaces "Your report is filed. The GitHub issue will open shortly." to the user — the fire-and-forget contract is preserved. The `report/<fix_id>` page reflects `received` state until the issue opens.
- **Rationale**: A synchronous failure ("Could not open issue — try again") breaks the fire-and-forget UX contract and makes the user responsible for retrying. Returning immediately with a `fix_id` and an `auth_url` preserves the contract; the issue opening is an async side effect that the user can observe on the status page. The plugin does not need to know whether the issue opened synchronously or asynchronously — it only needs the `fix_id` to construct the `auth_url`.
- **Source**: `success-criteria-and-acceptance-shape.md` § Open Questions (GitHub rate-limit row)

---

### Q: How should webhook event redelivery be handled to prevent duplicate fix attempts?

GitHub redelivers webhook payloads if the initial delivery times out or receives a non-2xx response. A redelivered event processed without deduplication would trigger a second fix attempt counted against the same cap budget.

- **Proposed default**: The Cloud Run service stores the GitHub webhook delivery ID (available in the `X-GitHub-Delivery` header) in the durable state store alongside the fix-loop state. Before processing any webhook event, the handler checks whether the delivery ID is already present. If it is, the handler returns HTTP 200 immediately without dispatching a new agent invocation. If not, the handler records the delivery ID and proceeds. This is the standard idempotency pattern for webhook receivers.
- **Rationale**: Deduplication is cheaper than the alternative — a duplicate fix attempt consumes cap budget, Anthropic API tokens, and potentially pushes a redundant commit to the PR. Storing the delivery ID in the state store (Firestore or GCS) adds one read per webhook event, which is well within the latency budget if the state store is Firestore (median read ~10ms). GCS object reads have higher and more variable latency; if GCS is the state store, the design stage should evaluate whether the deduplication read is on the critical path for the webhook acknowledgment window.
- **Source**: `risk-inventory.md` § Open Questions → Webhook Delivery Deduplication

---

## Needs human decision

### Q: Is the privacy policy update a launch blocker, and who owns the updated copy?

The current `website/content/pages/privacy.md` unconditionally states "None of that data is sent to GigSmart servers." This claim is materially false the moment the report-to-fix loop ships. The privacy principles (unit-04) state the policy update is a launch blocker and that the `/haiku:report` skill change MUST NOT merge to main until the updated policy is live. The agent can draft the replacement language, but the legal and regulatory determination of whether the proposed language is sufficient — and the decision to ship under it — cannot be made by the agent.

- **Needs human escalation**: This is a legal/policy decision. The agent can produce draft policy language (see unit-04, Privacy Policy Delta, Replacement Language section for the principle-level draft), but a human owner (product lead, legal counsel, or both) must review and approve the final copy. The agent cannot assess regulatory exposure, determine the applicable disclosure standard, or authorize the privacy policy change on behalf of GigSmart.
- **Decision deadline**: Product stage — the product stage must either confirm the policy update is in progress (with an owner and a timeline) or flag it as a blocker before any further downstream stages begin work. If the policy update is not confirmed in the product stage, the design and development stages should not begin work on the submission endpoint.
- **Source**: `privacy-and-data-handling-principles.md` § Privacy Policy Delta → Gating Relationship; DISCOVERY.md § Strategic Considerations → Privacy policy gap (lines 60–63); `risk-inventory.md` § Risk: Privacy Policy Compliance Gap

---

### Q: Should the user see an inline preview of the scrubbed bundle before transmission?

The consent step (unit-04, Consent UX Principles) describes a one-screen summary with a single confirm action as the target shape. The open question is whether "one screen" includes a "show me what's being sent" expandable with the full scrubbed JSONL, a structural summary only (session turn count, tool call count, scrubbed class counts), or no preview at all. The agent cannot determine the right trade-off without knowing the product team's position on the friction-vs-informed-consent axis.

- **Needs human escalation**: This is a product UX decision that sits at the intersection of trust, friction, and the fire-and-forget UX contract. The privacy principles (unit-04) acknowledge the tension explicitly ("a one-screen summary with a single confirm action is the target shape; a multi-page terms scroll is not"), but the exact form of the summary — structural counts only vs. expandable inline preview — is a design-stage product call. Implementation cost differs substantially: a structural summary (turn count, tool call count, scrubbed class counts) is a few lines; an expandable JSONL preview requires a streaming or paginated viewer. The human decision determines whether the implementation is a label or a document viewer.
- **Decision deadline**: Product stage — the product stage defines the consent UX shape. The design stage cannot spec the consent step without knowing whether an expandable preview is in scope. This decision must land in the product stage before the design stage begins work on the plugin-side consent flow.
- **Source**: `privacy-and-data-handling-principles.md` § Consent UX Principles → Tradeoff axis; `privacy-and-data-handling-principles.md` § Open Questions → Pre-send preview UX; `success-criteria-and-acceptance-shape.md` § Bounded Loops → behavior on bundle scrubbing uncertainty

---

### Q: Is the existing auth proxy extended for the report OAuth scope, or is a separate auth proxy deployed?

The `/haiku:report` OAuth flow needs a `report/token` endpoint that exchanges an authorization code for a GitHub token scoped to `issues:write` (narrower than the existing `/browse` OAuth scope, which uses `repo`). The integration question is whether this endpoint is added to the existing `deploy/auth-proxy/` service or deployed as a new Cloud Function instance. The agent cannot make this call because it depends on the organization's risk tolerance for shared-vs-separate blast radius.

- **Needs human escalation**: This is an infrastructure architecture decision with security implications. Sharing the existing auth proxy (simpler, less infra) means a compromise of the report OAuth client also exposes the browse OAuth client credentials. A separate deployment increases infra surface but limits blast radius. The trade-off is security posture vs. operational complexity, which is a human call that belongs to the security or infrastructure owner.
- **Decision deadline**: Design stage — the design stage must choose one of the two paths before specifying the Cloud Run infrastructure. The Terraform module and the Cloud Function source both differ depending on the choice; the design stage cannot produce an infrastructure spec without it.
- **Source**: `capability-and-system-context.md` § Adjacent Systems → Auth proxy; DISCOVERY.md § Capability Needs (lines 71–79); `risk-inventory.md` § Risk: Bot Credential Scope Creep

---

## Citations

- DISCOVERY.md § Open Questions (lines 81–88) — primary source for the question inventory; all seven questions named there are addressed above (three directly, four folded into expanded questions that cover the same ground more precisely)
- `success-criteria-and-acceptance-shape.md` § Open Questions and § Bounded Loops — source for the iteration cap, bundle size cap, scrubbing UX options, Sentry coexistence default, and subdomain question
- `privacy-and-data-handling-principles.md` § Consent UX Principles, § Scrubbing Principles, § Privacy Policy Delta, § Open Questions — source for the pre-send preview question, the pause-and-confirm scrubbing default, and the privacy policy escalation
- `capability-and-system-context.md` § Open Questions and § Adjacent Systems — source for the cold-start question (folded into webhook deduplication), the JSONL size constraint, and the auth-proxy split question
- `affected-surfaces-and-user-flow.md` § `haikumethod.ai/report/<fix_id>` — confirms the static-export constraint and the client-rendered SPA pattern that informs the subdomain default
- `risk-inventory.md` § Open Questions — source for the webhook deduplication question, the iteration cap counting unit ambiguity (addressed under the cap default), and the state-store cold-start latency interaction
