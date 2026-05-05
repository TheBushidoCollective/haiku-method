# Privacy and Data Handling Principles

_Inception artifact for intent: autonomous-report-to-fix_

---

## Privacy policy delta

**Existing claim being changed:**

`website/content/pages/privacy.md`, paragraph "The plugin runs locally" (lines 11–14):

> The H·AI·K·U plugin runs entirely inside your Claude Code environment. It reads and writes files on your local filesystem — intents, units, iteration state, configuration. **None of that data is sent to GigSmart servers.** We don't have a backend. We don't collect telemetry by default. Your code and project content stay on your machine.

This claim is presently unconditional. The report-to-fix loop breaks the condition the moment a user runs `/haiku:report`: a session bundle — assembled from JSONL files under `~/.claude/projects/<encoded-cwd>/` — leaves the user's machine and is POSTed to a GigSmart-operated Cloud Run service. The existing statement is therefore materially false after the feature ships.

**Replacement language (principle level — not final copy):**

The policy must be updated before the feature ships to reflect that:

1. The plugin ordinarily processes all data locally and sends nothing to GigSmart servers by default.
2. The `/haiku:report` flow is an explicit, user-initiated exception: the user knowingly submits a session bundle to a GigSmart-operated backend for the purpose of creating a GitHub issue and an autonomous fix PR.
3. The bundle is scrubbed client-side before transmission; the post-scrub content is described in the consent step.
4. The backend retains the bundle only as long as the fix loop is active; deletion policy is disclosed at the point of consent.

The updated policy section must distinguish between the ambient (no-transmission) baseline and the user-invoked exception. Language like "unless you run `/haiku:report`, in which case..." is the structural model; the exact copy is a design-stage deliverable.

**Gating relationship:** The policy update is a launch blocker. The `/haiku:report` skill change MUST NOT merge to main until the updated `website/content/pages/privacy.md` is live. CI should enforce this: if the feature flag or route is present and the policy page still contains the unconditional "None of that data is sent" claim, the build fails.

---

## Consent UX principles

**Timing — before or after data leaves the machine:**

Consent must be obtained before any data is transmitted. This is not a regulatory nicety; it is the only model that preserves trust. A "notify after" design treats the user's decision as something the product can make for them. The session bundle contains what the user said to the model, what the model said back, and all tool calls and outputs — its contents are personal and potentially sensitive even after scrubbing. The user must understand what is being sent and choose to send it.

Operationally: the `/haiku:report` skill must display a summary of what will be transmitted, confirm the scrubbing rules that will be applied, and require an explicit user confirmation before the POST happens. The skill's current conversational loop (ask, synthesize, confirm, submit) already has a confirmation step; the transmission description must be part of that confirmation, not a post-submit notice.

**What the user sees about what is being sent:**

At minimum, the consent presentation must describe:

- That a session bundle will be sent to GigSmart's Cloud Run service.
- What the bundle contains in plain terms (conversation turns, tool calls, tool outputs from the current session and any linked subagent sessions).
- Which data classes the scrubber will strip before transmission (the enumerated classes in the Scrubbing Principles section below).
- A note that the scrubber covers known patterns; custom secrets the user has stored in environment variables cannot be detected by the scrubber.

Whether the user sees an inline preview of the bundle before sending (a "preview before send" UX) is an open question for design (see Open Questions). The principle is: the user can make an informed decision without having to trust the scrubber blindly.

**Behavioral default if the user closes mid-flow:**

If the user abandons the consent step — closes the tab, cancels, or does not respond — the default MUST be no transmission. Nothing is sent. The partial flow leaves no residual state on the backend (there is nothing to clean up because nothing was sent). A partially collected session bundle stored transiently in the plugin memory is discarded when the tool exits.

**Tradeoff axis: friction vs. informed consent**

The consent step adds friction to a flow whose value proposition is fire-and-forget simplicity. This tension is real and must be designed explicitly rather than resolved by hiding it. The principle here is that the consent step must be light enough not to undermine the fire-and-forget promise, but substantial enough that the user is not surprised by what happened. A one-screen summary with a single confirm action is the target shape; a multi-page terms scroll is not.

---

## Scrubbing principles

The scrubber runs client-side, inside the plugin, before the bundle POST. Its mandate is conservative: strip anything that matches a known-sensitive pattern, even when it is uncertain whether the matched content is actually sensitive. The cost of a false positive (stripping something harmless) is a slightly degraded diagnostic signal. The cost of a false negative (passing through a credential or personal identifier) is a user trust breach.

The existing `sanitizeAttributes` function in `packages/haiku/src/telemetry.ts` and the `PII_DENY_KEYS` set (lines 344–381) establish the attribute-key scrubbing precedent for OTEL events. The JSONL bundle scrubber operates on free-text content rather than structured key-value pairs, so the techniques differ — but the conservative-on-uncertainty principle carries directly.

The scrubber MUST strip the following data classes from tool call inputs, tool call outputs, model message content, and any file content embedded in the session JSONL:

- **API tokens and bearer credentials** — Strings matching the structural shape of known credential formats issued by well-known providers: bearer tokens, OAuth access tokens, refresh tokens, and provider-issued API keys. Detection signal family: provider-prefix pattern matching for credential formats with conventional prefixes, combined with entropy scoring for unlabeled high-entropy strings. The scrubber must also strip values that follow standard authorization-label conventions (header-style and key-style labels for bearer tokens, authorization headers, and API keys, case-insensitive, in both JSON strings and plain text). The specific provider list and the exact prefix conventions are a development-stage scrubber-design concern; inception fixes the principle that this class is in scope.

- **Environment variable values** — Values of environment variables that appear in tool output. The signal is the `KEY=VALUE` pattern (shell assignment form) or JSON-serialized env maps. Environment variable _names_ need not be stripped — it is the values that carry the secret. Shell output from `env`, `printenv`, or `export` commands is a common vector.

- **Absolute home-directory paths** — Strings matching `/Users/<name>/...` (macOS) and `/home/<name>/...` (Linux). These paths are personally identifying — they encode the OS username — and may appear in stack traces, file read/write tool calls, and model-generated content. The scrubber replaces the user-specific prefix with a normalized placeholder (e.g., `~` or `[HOME]`). The principle is normalization, not deletion, so the diagnostic signal (relative path after the home) is preserved.

- **IP addresses** — IPv4 dotted-quad addresses and IPv6 full and abbreviated forms. These appear in server logs, error messages, and network diagnostic tool outputs embedded in the session. Private-range addresses (RFC 1918: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`) are particularly sensitive because they can reveal internal network topology. The scrubber replaces detected IPs with a placeholder (`[IP]`).

- **Email addresses** — RFC 5321 email addresses (`user@domain.tld`). These appear in error messages, model-generated content, git commit metadata embedded in diffs, and environment variables. Email addresses are directly personally identifying. The scrubber replaces them with a placeholder (`[EMAIL]`).

- **Passwords and connection strings** — Values following password-label conventions (key-style and assignment-style labels naming a password, secret, or passphrase) and connection strings in URI authority form where the authority section carries a password component. The password component in the authority section is the primary target; the host and database name need not be stripped (they describe topology, not a credential). The specific label list and the specific URI scheme list are a development-stage scrubber-design concern.

- **Private keys and certificates** — PEM-encoded blocks delimited by standard `BEGIN`/`END` markers naming a key or certificate, including the body between the markers. These appear in tool output when the user has run commands that print key material to stdout. The specific marker variants the scrubber recognizes are a development-stage scrubber-design concern.

- **Service tokens from well-known SaaS platforms** — Credentials issued by well-known SaaS platforms (collaboration, payments, messaging, deliverability, and similar categories) that the user is likely to have authenticated against from the same machine. Detection signal family: service-specific prefix conventions where they exist, falling back to entropy scoring inside known-vendor contexts. The specific platform list and the specific prefix conventions are a development-stage scrubber-design concern; inception fixes the principle that third-party-SaaS credentials are in scope alongside provider-API credentials.

### Conservative-on-uncertainty

When the scrubber cannot determine whether a matched string is sensitive, it strips it. This is not the most diagnostic-friendly posture — stripped content degrades the signal available to the fix agent — but it is the only posture that honors the trust-risk dimension identified in DISCOVERY.md (Risks, lines 91–93): "A scrubber that misses a credential ships it to GCP. This is a user trust risk, not just a policy risk."

The reasoning is asymmetric consequences: a false negative exposes a user's credential to a third-party service they may not have intended to authorize; a false positive removes a string that was probably harmless from a diagnostic bundle. The diagnostic degradation from false positives is recoverable (the fix agent can ask a follow-up question or work with reduced context); a leaked credential is not.

This principle also governs the priority ordering when multiple rules overlap a span of text: the most aggressive applicable rule wins. If a string is simultaneously shaped like a path and like a high-entropy token, the credential rule takes precedence.

---

## Retention and disclosure

**How long the Cloud Run service retains the bundle:**

The retention policy is a design-stage decision (see Open Questions for the proposed default range), but the principles are:

1. The bundle must not be retained indefinitely. It is diagnostic material, not a product asset. A fixed retention window after which the bundle is automatically deleted satisfies the user's reasonable expectation that their session content is not permanently archived.
2. The retention window must be disclosed at the point of consent, not buried in the privacy policy.
3. The fix loop's durable state store (tracking PR number, iteration count, CI results) does not require the original bundle after the agent has processed it once. The state store can retain derived state (fix metadata) while the raw bundle is deleted on a shorter schedule.

**Who can access the bundle:**

- The Cloud Run service account, scoped to reading bundles for active fix IDs. No human read access to raw bundles as a default; access requires an explicit audit-logged break-glass procedure.
- The Anthropic SDK call made by the fix agent on Cloud Run. The bundle is transmitted to the Anthropic API as part of the prompt context; this transmission falls under Anthropic's API data handling policy. This fact must be disclosed to the user at the point of consent: sending a session bundle for autonomous fixing means it is also sent to the model provider. The disclosure must name Anthropic explicitly as a secondary recipient — not as a generic "third-party model provider" — so the user can evaluate the recipient against Anthropic's published API terms.

**Irreversibility of the Anthropic transmission.** The transmission to Anthropic is a strategic, user-facing risk that the consent step must name plainly (it is also captured as a named entry in `risk-inventory.md` so downstream stages inherit it). GigSmart can honor a user's deletion request for the bundle stored on its own Cloud Run service within a defined SLA. GigSmart cannot extend that fulfillment to Anthropic's inference infrastructure: once the bundle has been consumed as Anthropic API input, GigSmart has no controllable mechanism to compel or confirm corresponding deletion from Anthropic's side. The consent step must communicate this in user terms — "GigSmart will delete your bundle from our servers within the disclosed window, but the copy that was sent to Anthropic during processing is governed by Anthropic's API terms and is not something GigSmart can delete on your behalf" — so the user can make the submission decision with the asymmetry visible. The privacy policy update inherits the same constraint: any right-to-erasure response GigSmart provides must explicitly carve out the Anthropic-side data the user must pursue under Anthropic's own terms.

**What the user is told they can request:**

- **Deletion** — The user can request deletion of their bundle and associated fix-loop state at any time by submitting a deletion request to the fix-id endpoint or to `oss@gigsmart.com`. The backend must honor this within a defined SLA (design stage picks the number; the principle is "promptly").
- **Copy** — The user can request a copy of the bundle that was submitted under their fix ID. This is the standard data portability expectation; the backend must be able to reconstruct or return the stored bundle before it is deleted.
- **Audit trail** — The user should be able to see what was transmitted: which fix ID, when, and under which scrubbing version. This audit log is the minimum disclosure that backs the consent claim.

---

## Open Questions

These questions have proposed defaults. The design stage should resolve them with explicit decisions; the proposed defaults are the principle-level anchors.

**Pre-send preview UX** — Should the user see the scrubbed bundle before it is transmitted? _Proposed default: no full preview, but a structural summary (session turn count, tool call count, scrubbed class counts) is shown in the confirmation step._ Full preview risks overwhelming the user with JSONL noise; a structural summary gives enough information to make an informed choice without derailing the fire-and-forget UX contract. Design should evaluate whether a "show me what's being sent" expandable is worth the implementation cost.

**Retention duration** — How long should the Cloud Run service retain the raw bundle? _Proposed default: 30 days from submission, auto-deleted._ This is long enough for the fix loop to complete (most fix loops will close in minutes to hours; an open issue lingering for 30 days is likely abandoned) and short enough that users are not surprised by months-long retention. The derived fix-loop state (PR number, iteration log) can be retained longer under a separate, lower-sensitivity schedule.

**Deletion-request mechanism** — How does the user request deletion of their bundle? _Proposed default: a deletion link embedded in the `/report/:id` status page, plus the `oss@gigsmart.com` email fallback._ The self-service deletion link is the primary path; the email fallback ensures users without an active browser session can still invoke their right to deletion. The design stage should specify the authentication model for the deletion link (is it authenticated by the fix ID alone, or does it require the GitHub OAuth token used at submission?).
