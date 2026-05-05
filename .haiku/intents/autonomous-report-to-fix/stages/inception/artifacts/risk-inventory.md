# Risk Inventory with Severity and Detection Signal

_Inception artifact for intent: autonomous-report-to-fix_

_Sources: DISCOVERY.md (Risks §, Strategic Considerations §), success-criteria-and-acceptance-shape.md (Bounded Loops), privacy-and-data-handling-principles.md (Scrubbing Principles)_

---

## Risks

### Risk: Scrubber False Negatives

- **Severity**: high
- **Detection signal**: A post-submission audit (manual or automated scan of stored bundles) detects a credential pattern in the raw bundle that the scrubber passed through; alternatively, a user notices their token appearing in a GitHub issue or PR body
- **Mitigation owner**: security

The scrubber operates on free-text JSONL content using prefix and entropy-based pattern matching. Any credential format not represented in the scrubber's rule set — custom internal API keys, tokens without recognizable prefixes, or novel service-specific formats — will pass through to the Cloud Run service and subsequently to the Anthropic API as part of the prompt context. Because the bundle is transmitted to two external services (Cloud Run and the model provider), a single false negative exposes the credential to both. The consequences are asymmetric: a false positive degrades diagnostic signal but is recoverable; a false negative produces an irreversible exposure of user credentials. (Source: DISCOVERY.md § Risks lines 91–93; privacy-and-data-handling-principles.md § Conservative-on-uncertainty)

### Risk: Bot Credential Scope Creep

- **Severity**: high
- **Detection signal**: Unexpected issues or PRs appearing on `gigsmart/haiku-method` not traceable to a user-initiated `/haiku:report` invocation; GitHub audit log showing bot token activity outside expected fix-loop patterns; Secret Manager access log anomalies
- **Mitigation owner**: security

The Cloud Run service holds a bot token with issue-write and PR-create scope on `gigsmart/haiku-method`. If this token is leaked — via Cloud Run execution logs, error responses, or a dependency vulnerability — it grants the holder the ability to create arbitrary issues and PRs on the repository. The token's blast radius is bounded to that single repository and those two operations, but the trust model (bot speaks with authority on behalf of H·AI·K·U) means fabricated issues would be difficult to distinguish from legitimate reports without out-of-band verification. Secret Manager rotation and audit logging reduce the probability of undetected misuse but do not eliminate the exposure. (Source: DISCOVERY.md § Risks lines 93–94; DISCOVERY.md § Strategic Considerations → OAuth scope trust boundary)

### Risk: Unbounded Fix-Loop Cost

- **Severity**: high
- **Detection signal**: Anthropic API billing dashboard showing a spike correlated with a specific `fix_id`; a single PR accumulating more than five bot commits in a short window; Cloud Run invocation count for a single `fix_id` exceeding the expected cap
- **Mitigation owner**: operations

Each webhook-triggered invocation of the fix agent makes a fresh Anthropic SDK call against the full session bundle plus accumulated fix context. A PR that attracts many review comments, triggers repeated CI failures, or receives a high volume of `@claude` mentions can drive unbounded token consumption under a single `fix_id`. Without a hard per-`fix_id` iteration cap enforced at the Cloud Run layer, a single pathological report could consume a disproportionate share of API budget. The success-criteria artifact proposes five attempts as a default cap; the actual enforcement mechanism belongs to the operations stage. (Source: DISCOVERY.md § Risks lines 94–95; success-criteria-and-acceptance-shape.md § Bounded loops)

### Risk: Cold-Start Webhook Timeout

- **Severity**: med
- **Detection signal**: GitHub webhook delivery log showing repeated `5xx` or timeout responses from the Cloud Run endpoint; GitHub's built-in webhook delivery UI marking deliveries as failed; Cloud Run execution logs showing functions that began real work and ran past the 10-second mark before returning
- **Mitigation owner**: design

GitHub expects webhook acknowledgment within 10 seconds and will mark the delivery as failed and potentially stop retrying if the endpoint does not respond in time. Cloud Run instances that have scaled to zero incur a cold-start penalty of several seconds before the handler begins executing. If the function attempts to do meaningful work (session retrieval, agent invocation setup, state-store reads) in the synchronous handler path, the combination of cold-start latency and handler work time can exceed the acknowledgment window. The user-observable failure mode is silent: the webhook is not re-triggered, the fix loop stalls, and the PR stays in whatever state it was in when the timeout occurred. (Source: DISCOVERY.md § Risks lines 95–96)

### Risk: JSONL Traversal Incompleteness

- **Severity**: med
- **Detection signal**: Fix agent produces a fix targeting a code path that does not match the actual failure location; the GitHub issue description omits tool call context from nested subagent sessions; post-fix CI still fails on the same assertion that the session JSONL would have explained; manual inspection of the submitted bundle reveals missing `parent_uuid` chains
- **Mitigation owner**: design

The session bundle must include all JSONL files reachable via `parent_uuid` from the root session — the current session's file plus any subagent sessions it spawned, recursively. If the traversal misses a nesting level (e.g., it follows only one level of `parent_uuid` rather than the full chain), the diagnostic context presented to the fix agent will be partial. The fix agent, operating on incomplete evidence, may identify the wrong call site, produce a fix that addresses a symptom rather than the cause, or generate a description that does not match what the user actually experienced. The traversal correctness is a client-side pre-POST responsibility; the backend cannot compensate for an incomplete bundle. (Source: DISCOVERY.md § Risks lines 96–97)

### Risk: Large Bundle Exceeding Request Limits

- **Severity**: med
- **Detection signal**: Plugin surfaces a POST failure or size-cap error to the user in the conversation; Cloud Run returns a `413 Payload Too Large`; the JSONL bundle for a multi-stage intent visibly exceeds the threshold displayed by the plugin's pre-flight check
- **Mitigation owner**: design

Multi-stage H·AI·K·U intents produce JSONL session files that can reach several megabytes, particularly when subagent chains with large tool outputs are involved. A bundle that exceeds the POST size cap (whether set by the Cloud Run HTTP request limit or by an application-level threshold) fails to submit, stranding the user with an error and no automatic fallback. The success-criteria artifact proposes client-side truncation to the N most-recent messages as a degraded-mode fallback, with a user-visible notice; the exact thresholds and truncation strategy are design decisions. The risk is that truncation removes the diagnostic context needed to identify the root cause, producing a fix attempt that targets the wrong location. (Source: DISCOVERY.md § Open Questions lines 85–86; success-criteria-and-acceptance-shape.md § Behavior on JSONL bundle too large)

### Risk: OAuth Attribution Mismatch

- **Severity**: low
- **Detection signal**: A user who granted GitHub OAuth expects to find the issue in their GitHub profile's "Created" issues list and cannot; user feedback or support contact expressing surprise that the issue was attributed differently than expected; the issue body displays attribution text rather than GitHub's native attribution metadata
- **Mitigation owner**: product

GitHub's issue-creation API attributes an issue to the authenticated caller. Because the bot account makes the API call (not the user), the issue appears in the bot's created-issues list, not the user's. The user's GitHub OAuth grant provides an identity signal that the bot uses to write attribution text in the issue body ("Reported by @username"), but this is a convention the bot enforces, not a platform guarantee. Users who expect the issue to appear in their personal GitHub activity feed or in their "created issues" list will experience a mismatch between their expectation and the system's behavior. The mitigation is disclosure, not a technical change — the consent step must explain this limitation before the user grants OAuth. (Source: DISCOVERY.md § Strategic Considerations → OAuth scope trust boundary; success-criteria-and-acceptance-shape.md § Behavior on user OAuth decline)

### Risk: Privacy Policy Material Misrepresentation

- **Severity**: critical
- **Detection signal**: The `/haiku:report` skill is merged to main while `website/content/pages/privacy.md` still contains the unconditional "None of that data is sent to GigSmart servers" statement; CI policy check (if implemented) fails; user discovers the discrepancy after data transmission has already occurred
- **Mitigation owner**: product

The current privacy policy makes an unconditional claim that no user data is sent to GigSmart servers. The report-to-fix loop transmits session bundle data to a GigSmart-operated Cloud Run service. Shipping the feature without updating the policy renders the published policy materially false at the moment of first user interaction. This is not a documentation gap — it is a trust and regulatory exposure. The privacy-and-data-handling-principles artifact classifies the policy update as a launch blocker. The risk is highest in the window between the feature merging to main and the policy update going live; even a short window creates exposure because users may run `/haiku:report` during that window without informed consent. (Source: privacy-and-data-handling-principles.md § Privacy policy delta; DISCOVERY.md § Strategic Considerations → Privacy policy gap)

### Risk: Anthropic API Single-Vendor Dependency

- **Severity**: high
- **Detection signal**: Anthropic API status page showing degraded or unavailable service; Cloud Run invocations returning errors from the Anthropic SDK client; fix loop stalls silently with no PR commits appearing after a webhook event; billing alerts triggered by rate-limit retry storms
- **Mitigation owner**: operations

The fix loop has no fallback when the Anthropic API is unavailable, rate-limited, deprecated, or repriced. Every fresh invocation of the fix agent — triggered by a GitHub webhook — requires a live Anthropic API call against the session bundle. There is no degraded mode: if the API is down or the account is rate-limited, the webhook event is processed but no fix is produced, the PR receives no new commit, and the user sees no visible progress. A sustained API outage during an active fix loop means the iteration cap may be consumed by failed invocations, leaving fewer effective attempts for when the API recovers. Additionally, the Anthropic API is the single point of pricing control: a repricing event changes the per-report cost model without any user-facing signal. (Source: unit spec § Completion criteria item 8)

---

## Open Questions

The following risks carry unresolved severity or detection signal uncertainty. These are flagged for design- and operations-stage review.

**Scrubber false-negative severity calibration** — Severity is rated `high` based on the trust-breach consequence of a leaked credential. If the scrubber's rule set achieves high recall against a representative sample of H·AI·K·U session content (empirically verified), severity could be reclassified to `med`. The classification depends on evidence the security stage will produce during rule set development. Until that evidence exists, `high` is the conservative assignment.

**Cold-start webhook timeout — severity and remediation options** — Severity is rated `med` because the fix loop can self-recover if GitHub retries the webhook (which it does, with backoff). However, if the function is in a consistent cold-start-then-timeout loop (e.g., the instance is being recycled between every webhook), the effective severity escalates to `high`. The detection signal for this escalation is GitHub's webhook delivery log showing the same event being retried multiple times with consistent failure. The design stage should determine whether minimum-instance configuration (keeping at least one Cloud Run instance warm) is warranted given the latency constraint.

**JSONL traversal incompleteness — detection difficulty** — The detection signal for this risk is partly retrospective: the fix agent produces a wrong fix, and the reviewer notices the mismatch. There is no pre-POST validation that confirms the bundle is complete. The security and design stages should evaluate whether a completeness check (e.g., asserting that all `parent_uuid` references in the bundle resolve to a record in the same bundle) is feasible before transmission.

**Anthropic API dependency — rate-limit vs. outage distinction** — A rate-limited account and an unavailable API are both classified under this risk, but they have different detection signals and different mitigations. Rate limits are self-correcting over time (retry with backoff); a full outage is not. The operations stage should determine whether these warrant separate entries in the operational runbook even if they share a single risk register entry here.
