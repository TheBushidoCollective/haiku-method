---
intent: autonomous-report-to-fix
unit: unit-06-open-questions-with-defaults
stage: inception
created: 2026-05-05
---

# Open Questions with Proposed Defaults

This artifact collects every open question surfaced across the inception artifacts — DISCOVERY.md, success-criteria-and-acceptance-shape.md (unit-01), capability-and-system-context.md (unit-02), privacy-and-data-handling-principles.md (unit-04), affected-surfaces-and-user-flow.md (unit-03), and risk-inventory.md (unit-05) — and assigns each one of two outcomes: a **proposed default** downstream stages may adopt unless the user vetoes, or a **(needs human escalation)** flag with the reason why the agent cannot reasonably resolve it.

Downstream stages consume this artifact as a single, authoritative starting point. Resolution happens in the product stage (proposed defaults approved or overridden) or the design stage (questions that require a concrete technical choice before they can be answered). No question is resolved here. The `## Resolved-by-default` section is not a decision record — it is a set of bets downstream stages inherit unless they hear otherwise.

---

## Resolved-by-default

### Q: What is the per-fix-id iteration cap before the bot stops and converts the PR to draft?

Each webhook-triggered agent invocation that pushes at least one commit counts as one attempt. When that count reaches the cap, the bot posts a "gave up" comment on the PR, converts it to draft status, and stops consuming webhook events for that `fix_id`.

- **Proposed default**: 5 fix attempts per `fix_id`.
- **Rationale**: Five attempts covers the common class of CI-detectable bugs (type errors, test regressions, import resolution failures) without burning unbounded Anthropic API token budget. A single-attempt cap is too aggressive for multi-stage fix sequences; a double-digit cap exposes the system to runaway cost for pathological bugs. The success criteria (unit-01) treat 5 as the right balance point between coverage and cost.
- **Source**: `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01), "Bounded Loops — Maximum bot iterations" section; DISCOVERY.md § Risks → "Unbounded fix-loop cost" (line 94).

---

### Q: What is the POST bundle size threshold, and what happens when the bundle exceeds it?

The session JSONL for a multi-stage intent can be several megabytes. The plugin must decide whether to compress and POST the full bundle, truncate it to a recent window before POSTing, or block submission and surface an error.

- **Proposed default**: Client-side compressed size cap of 5 MB. If the bundle exceeds 5 MB compressed, the plugin truncates to the N most-recent messages in the JSONL (preserving the latest tool calls and model turns where the failure is most likely to appear) and notifies the user: "Session was large; sent the last N messages." If even the truncated bundle exceeds 5 MB compressed, submission fails with a user-visible error and a link to file a manual GitHub issue.
- **Rationale**: 5 MB compressed gives generous headroom for typical single-intent sessions while staying well within Cloud Functions v2's 32 MB request limit. Truncation-from-the-start (oldest messages dropped first) preserves the diagnostic window closest to the failure. Silent truncation with a user notice preserves the fire-and-forget UX; a hard block is reserved for the edge case where even truncation is insufficient.
- **Source**: `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01), "Bounded Loops — JSONL bundle too large" section; DISCOVERY.md § Open Questions (line 84); `stages/inception/artifacts/risk-inventory.md` (unit-05), "Risk: Large Bundle Exceeding Request Limits".

---

### Q: Should the Sentry event still fire alongside the Cloud Run POST, or does the new flow replace it entirely?

The existing `haiku_report` tool POSTs a `captureFeedback` event to Sentry (when `SENTRY_DSN` is configured). The new loop adds a Cloud Run POST for the same user action. Both are external submissions; each touches a different surface with different data classes (Sentry receives prose; Cloud Run receives the scrubbed JSONL bundle).

- **Proposed default**: Sentry fires as a fallback only — if the Cloud Run POST fails (network error, 5xx, timeout), the plugin falls back to the existing Sentry path and notifies the user that the autonomous fix loop is unavailable but their feedback was still recorded. If Cloud Run succeeds, Sentry does not fire. This avoids dual-submission of user data to two external services for the same event.
- **Rationale**: Two simultaneous external submissions for one user action creates a privacy surface the consent step must describe in full. Restricting Sentry to fallback-only keeps the primary path simple (one submission, one consent statement) while preserving the existing error-reporting safety net for infrastructure failures. The design stage must confirm that the privacy policy update covers both surfaces in the fallback case.
- **Source**: DISCOVERY.md § Strategic Considerations → "Sentry coexistence" (line 68); `stages/inception/artifacts/capability-and-system-context.md` (unit-02), "Adjacent systems — Sentry" section; `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01), Open Questions table row "Does the Sentry event still fire".

---

### Q: Does the `report/:id` status page need its own subdomain, or does it live at a path under `haikumethod.ai`?

The website uses `output: "export"` in production (`website/next.config.ts`), which means no server-rendered dynamic routes. The page that accepts the OAuth callback and shows fix-loop status must be a client-rendered SPA regardless of where it lives.

- **Proposed default**: No separate subdomain. The page lives at `haikumethod.ai/report/<fix_id>` as a client-rendered SPA under the existing Next.js export. The `fix_id` is read from `window.location` at runtime, following the same pattern as the `/browse` page and the `CallbackClient` in `website/app/auth/[provider]/callback/CallbackClient.tsx`. The trailing-slash and 404-fallback configuration in `website/next.config.ts` is updated by the design stage to handle the `[id]` segment without `generateStaticParams`.
- **Rationale**: A separate subdomain (e.g., `report.haikumethod.ai`) adds a new DNS entry, a new load balancer rule, and a separate TLS certificate to the Terraform surface — none of which are justified for a single-page SPA that can be statically served from the same export. The `/browse` page demonstrates the pattern is viable under the export constraint. Simpler deployment reduces blast radius.
- **Source**: DISCOVERY.md § Open Questions (line 87); `stages/inception/artifacts/affected-surfaces-and-user-flow.md` (unit-03), "`haikumethod.ai/report/<fix_id>` — Static-export constraint" section; `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01), Open Questions table row "Does the `report/:id` page need its own subdomain".

---

### Q: Should the pre-send consent step include a full preview of the scrubbed JSONL bundle, or a structural summary only?

The consent step must give the user enough information to make an informed decision about transmission, but a full JSONL dump would overwhelm the terminal UI and undermine the fire-and-forget UX contract.

- **Proposed default**: Structural summary only. The consent step displays: session turn count, tool call count, subagent chain depth, and a count of each scrubbed data class (e.g., "3 credential-shaped strings removed, 1 home path normalized"). No raw JSONL preview is shown by default. A "show me what's being sent" option (an expandable in the web status page, not the plugin terminal) is out of scope for V1.
- **Rationale**: A structural summary gives the user a calibration signal (how much was stripped, how complex the session was) without requiring them to read raw JSONL. The fire-and-forget promise is preserved because the consent step remains a single-screen interaction. The privacy principles (unit-04) explicitly flag that "full preview risks overwhelming the user with JSONL noise" while calling a structural summary sufficient for informed consent.
- **Source**: `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04), "Open Questions — Pre-send preview UX" section; `stages/inception/artifacts/risk-inventory.md` (unit-05), "Open Questions — Scrubbing Coverage Completeness".

---

### Q: How long should the Cloud Run service retain the raw session bundle after submission?

The bundle is diagnostic material — it is needed during the fix loop but not afterward. Indefinite retention is inconsistent with the privacy principles; too-short retention risks the fix agent losing context if a webhook arrives after the bundle has been deleted.

- **Proposed default**: 30 days from submission, auto-deleted. The derived fix-loop state (PR number, iteration count, CI results, bot comments) can be retained on a separate, longer schedule (90 days) since it contains no user-originated raw session content. Deletion requests from the user are honored within 7 days via the `report/:id` status page deletion link or the `oss@gigsmart.com` email fallback.
- **Rationale**: Most fix loops close within minutes to hours; 30 days covers the long tail of issues that require human pickup after the iteration cap is hit. The 30-day window aligns with common industry practice for diagnostic artifact retention (e.g., Sentry's default event retention). The privacy principles (unit-04) name 30 days as the proposed default explicitly and provide the rationale for separating raw-bundle retention from derived-state retention.
- **Source**: `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04), "Open Questions — Retention duration" section; `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04), "Retention and disclosure — Deletion-request mechanism" section.

---

### Q: Should the auth proxy be extended to handle the report OAuth flow, or should a second auth proxy instance be deployed?

The existing auth proxy at `auth.haikumethod.ai` handles GitHub and GitLab OAuth code-exchange for `/browse`. The report flow needs OAuth for user attribution using a different scope (`issues:write` vs `repo`). Sharing vs. splitting the infrastructure is a cost-versus-blast-radius tradeoff.

- **Proposed default**: Extend the existing auth proxy with a new `/github/report-token` endpoint that handles the narrower `issues:write` scope. No new service deployment, no new Cloud Function resource, no new Terraform module — just a new route in `deploy/auth-proxy/src/index.ts` with its own OAuth client credentials stored in Secret Manager under a distinct secret name.
- **Rationale**: A separate deployment doubles the operational surface (two Cloud Functions to monitor, two IAM bindings to maintain, two sets of secrets to rotate) without providing meaningful isolation — both services share the same GCP project and the same `haikumethod.ai` domain. The blast radius argument (a compromised report OAuth client affects only the report flow) is real but modest given that the `issues:write` scope is far narrower than the existing `repo` scope the `/browse` OAuth uses. If the security analysis in the design stage finds the shared surface unacceptable, splitting is the fallback.
- **Source**: `stages/inception/artifacts/capability-and-system-context.md` (unit-02), "Adjacent systems — Auth proxy" section; DISCOVERY.md § Capability Needs (line 73).

---

### Q: What is the webhook acknowledgment strategy to prevent GitHub delivery failures under Cloud Run cold-start latency?

GitHub expects webhook acknowledgment within 10 seconds. Cloud Run cold starts add 2–6 seconds of latency before application code runs. If the webhook handler attempts substantive work (Anthropic SDK call) synchronously, the total latency may exceed 10 seconds.

- **Proposed default**: Immediate 200 acknowledgment followed by async work handoff. The webhook handler acknowledges with HTTP 200 immediately upon signature verification, then enqueues the fix-loop work via Cloud Tasks (or equivalent async dispatch) for deferred execution. The handler itself does no agent work. This ensures the 10-second deadline is met regardless of what the agent does downstream.
- **Rationale**: The risk inventory (unit-05) rates cold-start webhook timeout as high severity with a clear detection signal (delivery marked "failed" in GitHub logs). The async-handoff mitigation is well-established and the Google Cloud Tasks client library is compatible with the Node.js Functions Framework already in use. The codebase currently has no Cloud Tasks precedent (noted in unit-02), so this is a new infrastructure dependency — but a narrowly scoped one. The design stage must confirm whether Cloud Tasks or an alternative async dispatch (e.g., Pub/Sub) is the right choice.
- **Source**: `stages/inception/artifacts/risk-inventory.md` (unit-05), "Risk: Cold-Start Webhook Timeout"; `stages/inception/artifacts/capability-and-system-context.md` (unit-02), "Open questions — Webhook acknowledgment under cold start".

---

## Needs human decision

### Q: Should the consent UX pause for explicit user confirmation before POST (Option B), or scrub-and-notify after (Option A)?

The scrubbing UX question is the central privacy-versus-friction tradeoff in the feature. Option A (scrub aggressively, then send, then show a notice) preserves the fire-and-forget UX but places the user in the position of learning about the transmission after it happened. Option B (surface unclassifiable patterns, let the user approve or abort before POST) maximizes user control but breaks the fire-and-forget promise at the moment of highest intent.

The agent can reason about this (and the success criteria lean toward Option B for V1 given the "consent UX is load-bearing" framing in the privacy principles), but this is ultimately a product and legal position. The answer affects the privacy policy language, the skills conversational flow, and whether the CI gate on the unconditional "None of that data is sent" claim is sufficient or needs to be paired with a UX-review gate as well. A call in the wrong direction — especially for a first ship — creates regulatory exposure.

- **Needs human escalation**: This is a product and legal decision, not an engineering one. The agent proposes Option B as the V1 default (pause-and-confirm), but the user or legal counsel must explicitly sign off before the design stage commits the consent UX to one path.
- **Decision deadline**: Product stage — this decision shapes the skill's conversational flow, the privacy policy update language, and the consent-step UI in the web status page. The design stage cannot finalize the report-agent POST flow without it.
- **Source**: `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01), "Bounded Loops — scrubbing uncertainty" section, Options A and B; `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04), "Consent UX principles — Timing — before or after data leaves the machine"; DISCOVERY.md § Open Questions (line 82).

---

### Q: Is there a regulatory or legal review required before the privacy policy is updated and the feature ships?

The current privacy policy is a public, unconditional commitment: "None of that data is sent to GigSmart servers." Changing this claim — even with a carefully worded exception and a robust consent UX — is a material policy revision. Whether this revision requires legal review before publication depends on GigSmart's legal posture, the jurisdictions in which H·AI·K·U users operate (GDPR if any EU users; CCPA if California users are covered), and whether the existing policy language was reviewed by counsel.

The agent cannot determine the legal review requirement from the codebase or discovery context alone. Shipping the feature without legal sign-off on the policy change risks exposure that no technical scrubber or consent UI can remediate.

- **Needs human escalation**: Legal/policy decision. The agent cannot determine whether a formal legal review is required, who owns the GigSmart privacy policy, or whether the current policy was attorney-reviewed. This question must be resolved by the appropriate stakeholder before the privacy policy update is drafted.
- **Decision deadline**: Before the product stage finalizes the privacy policy update language. The CI gate (blocking merge if the unconditional claim is still present in `website/content/pages/privacy.md`) cannot be implemented until the replacement language is approved and the gate's pass condition is defined.
- **Source**: `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04), "Privacy policy delta — Gating relationship"; `stages/inception/artifacts/risk-inventory.md` (unit-05), "Risk: Privacy Policy Compliance Gap"; DISCOVERY.md § Strategic Considerations → "Privacy policy gap" (line 62).

---

### Q: What prominence and copy should the attribution mismatch disclosure use at the OAuth grant prompt?

Users who grant GitHub OAuth for attribution expect that the issue will appear in their personal activity feed. It will not — the issue is bot-authored. The success criteria (unit-01) flag this as "must be disclosed to users before OAuth grant prompt; product stage owns the copy," but the content, placement, and prominence of that disclosure are not specified. Under-disclosure risks a class of support tickets and a trust erosion; over-disclosure (prominent warnings at OAuth prompt time) may suppress OAuth adoption and reduce attribution quality.

The agent can identify the gap but cannot make the product call on how prominently to surface it or what the exact copy should say. The language must be calibrated to the user population, the product's tone, and GigSmart's assessment of the support and trust risk.

- **Needs human escalation**: Product decision. The agent cannot determine the right prominence, placement, or exact copy for the attribution mismatch disclosure without product direction on tone and risk tolerance.
- **Decision deadline**: Product stage — this copy is part of the OAuth grant prompt on the `report/:id` status page. The design stage cannot finalize the web page layout without knowing the size and placement of this disclosure.
- **Source**: `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01), Open Questions table row "Does the issue appear in the user's GitHub 'created issues' list"; `stages/inception/artifacts/risk-inventory.md` (unit-05), "Risk: OAuth Attribution Mismatch".

---

## Citations

- DISCOVERY.md § Open Questions (lines 81–88) — primary question list; all seven questions from this section are represented above, plus additional questions surfaced by other artifacts.
- DISCOVERY.md § Risks (lines 91–97) — source for iteration cap, bundle size, cold-start, and scrubber false-negative questions.
- DISCOVERY.md § Strategic Considerations (lines 62–68) — source for privacy policy gap, Sentry coexistence, and OAuth trust boundary questions.
- `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01) — source for iteration cap default (5 attempts), bundle size threshold (5 MB), scrubbing UX options A/B, Sentry fallback, subdomain default, and attribution mismatch disclosure requirement.
- `stages/inception/artifacts/capability-and-system-context.md` (unit-02) — source for auth proxy extension vs. split question and webhook cold-start acknowledgment strategy.
- `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04) — source for consent UX timing principle (before transmission), pre-send preview UX default (structural summary), retention duration default (30 days), and deletion mechanism (status-page link + email fallback).
- `stages/inception/artifacts/affected-surfaces-and-user-flow.md` (unit-03) — source for the static-export constraint on the `report/:id` page and the `CallbackClient` precedent pattern.
- `stages/inception/artifacts/risk-inventory.md` (unit-05) — source for severity ratings on scrubber false negatives (critical), privacy compliance gap (critical), cold-start webhook timeout (high), and bot credential scope creep (high); also source for open questions on iteration cap counting semantics and scrubbing coverage completeness.
