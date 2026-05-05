# Risk Inventory with Severity and Detection Signal

_Inception artifact for intent: autonomous-report-to-fix_

Converted from the prose risk discussion in DISCOVERY.md and cross-referenced against the privacy principles (unit-04) and the bounded-loop caps in the success criteria (unit-01).

---

## Risks

### Risk: Scrubber False Negatives

- **Severity**: critical
- **Detection signal**: A post-scrub bundle contains a string matching a known credential prefix (e.g., `ghp_`, `sk-`, `xoxb-`) or a high-entropy unlabeled string that pattern-analysis flags after transmission arrives at the Cloud Run service.
- **Mitigation owner**: development

A credential that the client-side scrubber fails to strip is transmitted to the GigSmart Cloud Run service and potentially forwarded to the Anthropic API as part of the fix-agent prompt context. Once transmitted, the credential is outside the user's control — it cannot be recalled by clearing local state. The failure mode is not theoretical: regex-based scrubbers operating on free-text JSONL cannot enumerate every custom secret format users may have stored in their environment. The conservative-on-uncertainty posture defined in the privacy principles (unit-04, Scrubbing Principles) is the primary design response, but it does not eliminate the residual false-negative window for novel credential formats. This is the highest-severity risk in the inventory because it is the failure mode with the least recovery surface: a missed credential is a user trust breach with no purely technical remediation.

### Risk: Bot Credential Scope Creep

- **Severity**: high
- **Detection signal**: Cloud Run audit logs show issue creation or PR creation events that cannot be traced to a valid `fix_id` in the durable state store, or Secret Manager access logs show the bot token accessed from an unexpected service account or IP range.
- **Mitigation owner**: security

The Cloud Run service holds a GitHub bot token with issue-write and PR-create scope on `gigsmart/haiku-method`. If the token is leaked — through Cloud Run environment variable exposure, log output, error traces, or a compromised service account — an adversary can create arbitrary issues and PRs under the bot identity. Secret Manager rotation and audit logging reduce the blast radius and detection latency but do not prevent the initial exposure. The trust boundary described in DISCOVERY.md (Strategic Considerations, OAuth scope trust boundary) ensures the user's own OAuth token is never used to create PRs, which is correct; but it does not constrain the bot token's surface. The risk is partially self-limiting (the bot can only write to `gigsmart/haiku-method`), but reputational damage from bot-authored spam issues is real even within that scope.

### Risk: Unbounded Fix-Loop Cost

- **Severity**: high
- **Detection signal**: A `fix_id`'s webhook invocation count in the durable state store exceeds the declared iteration cap (proposed default: 5 in unit-01), or the per-`fix_id` Anthropic API token spend (if tracked) crosses a configured alert threshold.
- **Mitigation owner**: operations

Each webhook-triggered agent invocation issues a fresh Anthropic SDK call. A PR that accumulates many review comments, CI failures across multiple check suites, or a fix loop that produces non-converging patches can trigger invocations faster than the iteration cap halts them — particularly if cap enforcement has an off-by-one error or the cap is set on successful commits rather than on total invocations. The success criteria (unit-01, Bounded Loops) propose a default of 5 fix attempts; the exact cap value and the counting unit (invocations? commits? CI runs?) are design decisions. Without an enforced cap, a single adversarial or misconfigured `fix_id` can exhaust Anthropic API quota or produce an unexpectedly large GCP bill.

### Risk: Cold-Start Webhook Timeout

- **Severity**: high
- **Detection signal**: Cloud Run request logs show webhook handler response times exceeding 8 seconds (2-second buffer before GitHub's 10-second acknowledgment deadline), or GitHub delivery logs show webhook deliveries marked "failed" with no corresponding Cloud Run request log entry (implying a cold-start abort before the handler returned).
- **Mitigation owner**: operations

GitHub delivers webhook payloads (`pull_request_review`, `issue_comment`, `check_suite`) and expects an HTTP 200 acknowledgment within 10 seconds. Cloud Run functions with no warm instances can take 2–6 seconds to cold-start before the handler begins executing. If the handler attempts to do substantive work (e.g., calling the Anthropic SDK) synchronously within the webhook request, the total latency can exceed 10 seconds and GitHub marks the delivery failed — meaning the fix loop misses the triggering event and stalls until a manual retry or the next event arrives. The mitigation shape (respond immediately with 200 and defer real work to Cloud Tasks or an async invocation) is well-established but must be explicitly designed; the risk is that an expedient first implementation skips the async handoff.

### Risk: JSONL Traversal Incompleteness

- **Severity**: med
- **Detection signal**: The fix agent produces a PR that addresses symptoms visible in the top-level session JSONL but does not reference tool calls or subagent outputs that are only present in nested JSONL files — i.e., the fix targets the surface effect rather than the root cause. A code reviewer or CI run can detect this when the fix reverts cleanly but the underlying orchestrator behavior is unchanged.
- **Mitigation owner**: development

The session bundle must include all subagent JSONL files reachable via `parent_uuid` from the current session ID. If the traversal algorithm is depth-limited, misses a nested subagent level, or fails to locate JSONL files for subagents that ran in a different working directory, the diagnostic context presented to the fix agent is partial. The risk is not that the bundle is empty — the top-level session JSONL always exists — but that the fix agent diagnoses a symptom rather than the cause, producing a patch that satisfies CI checks without addressing the actual defect. DISCOVERY.md (Risks, JSONL subagent chain traversal correctness) identifies this as a correctness risk with engineering consequences; unit-04 privacy principles do not scope this risk but the scrubber must traverse the same `parent_uuid` graph the bundler does.

### Risk: Large Bundle Exceeding Request Limits

- **Severity**: med
- **Detection signal**: The client-side size check before POST (proposed in unit-01, Bounded Loops) fires and notifies the user that the bundle exceeds the configured threshold; or the POST to Cloud Run returns a 413 or equivalent error if the client-side check is absent or mis-configured.
- **Mitigation owner**: development

Multi-stage H·AI·K·U intents generate JSONL files that can reach several megabytes when subagent chains are included. The Cloud Run Functions Framework has a default HTTP request size limit (32 MB for Cloud Functions v2 uncompressed); compressed JSONL can be significantly smaller, but the relationship between session complexity and compressed size is non-linear. The failure mode is a clean error (POST rejected) rather than silent data loss, which makes it detectable — but the user experience is a hard block on submission rather than a graceful degradation. The success criteria (unit-01, Bounded Loops) propose a 5 MB compressed threshold with client-side truncation as the fallback; the threshold value and truncation strategy are design decisions.

### Risk: OAuth Attribution Mismatch

- **Severity**: low
- **Detection signal**: A user who granted OAuth reports that the GitHub issue does not appear in their personal "created issues" list (`github.com/issues`), or a support request arrives indicating the attribution in the issue body names the wrong GitHub account (e.g., because the OAuth token resolved to a different identity than the user expected).
- **Mitigation owner**: product

The bot opens the GitHub issue under the bot account regardless of whether the user grants OAuth. The user's OAuth scope is issue-write only; the PR is always bot-authored. Attribution is a convention enforced in the issue body text ("Reported by @github-username") — it is not a GitHub platform guarantee. Users who expect the issue to appear in their personal activity feed or "created issues" list will not see it there. DISCOVERY.md (Strategic Considerations, OAuth scope trust boundary) identifies this as a user expectation gap that must be disclosed at the point of the OAuth grant prompt. The severity is low because no data is lost and no security boundary is crossed; the impact is a usability surprise and a support volume risk.

### Risk: Anthropic API Single-Vendor Dependency

- **Severity**: high
- **Detection signal**: The Cloud Run service logs show Anthropic API calls returning 429 (rate limit), 503 (service unavailable), or connection timeout errors; or the fix loop stalls on a `fix_id` with no new commits after a webhook delivery was successfully acknowledged — indicating the agent invocation was attempted but the API call failed.
- **Mitigation owner**: operations

The fix loop has no fallback when the Anthropic API is unavailable, rate-limited, deprecated, or repriced. Every webhook-triggered agent invocation requires a live Anthropic API call to make progress; there is no degraded mode in which the loop continues with reduced capability, and there is no alternative model provider the service can route to. A sustained Anthropic outage stalls all active fix loops simultaneously — each pending `fix_id` accumulates webhook events that it cannot process until the API recovers. Beyond availability, the vendor dependency creates a cost-model risk: if Anthropic reprices the models used by the fix agent (particularly toward higher per-token costs for longer context windows, which the session bundle requires), the per-fix economics can change without any code change. The lack of a fallback path means the system offers no SLA on fix-loop completion time beyond "depends on Anthropic."

### Risk: State Store Unavailability Causing Fix-Loop Data Loss

- **Severity**: med
- **Detection signal**: Cloud Run error logs show failures reading or writing the durable state store (Firestore document or GCS object) during a webhook-triggered invocation; or a `fix_id` that was previously active produces no further activity after a Cloud Run or state-store service disruption, with no "bot stopped" comment on the corresponding PR.
- **Mitigation owner**: operations

The fix loop's durable state — PR number, iteration count, previous fix attempts, CI results — must survive Cloud Run cold starts. If the state store (Firestore or GCS; design-stage decision per DISCOVERY.md Open Questions) becomes temporarily unavailable during a webhook invocation, the handler cannot safely resume the fix loop: it cannot read how many iterations have been attempted, cannot write the outcome of the current invocation, and risks either re-running a fix attempt it already ran (if it proceeds without the state read) or silently dropping the event (if it aborts the handler). The failure mode is a stalled fix loop with no user-visible signal — the PR stays open, no new commits appear, and no "bot stopped" comment is posted. Detection depends entirely on the Cloud Run and state-store observability stack.

### Risk: Privacy Policy Compliance Gap

- **Severity**: critical
- **Detection signal**: The feature ships to main while `website/content/pages/privacy.md` still contains the unconditional claim "None of that data is sent to GigSmart servers" (detectable by the CI check described in unit-04, Privacy Policy Delta, Gating Relationship section).
- **Mitigation owner**: product

The current privacy policy is materially false the moment the report-to-fix loop lands in production. The policy change is a launch blocker — unit-04 (privacy-and-data-handling-principles.md) is explicit: the `/haiku:report` skill change MUST NOT merge to main until the updated policy is live. The risk is not merely reputational: transmitting user data under a privacy policy that affirmatively denies any transmission creates a disclosure compliance exposure. The detection signal (CI check on the unconditional claim string) is described in unit-04 but not yet implemented; until that check exists, the risk is that a merge to main happens through a path that bypasses the gating check — for example, a direct merge without the CI check running.

---

## Open Questions

The following risks carry uncertain severity ratings or currently unknown detection signals. They are flagged here for design-stage resolution.

**Scrubbing Coverage Completeness** — The scrubber targets known credential formats and data classes (enumerated in unit-04). However, the false-negative rate for novel or custom secret formats is unknown and cannot be tested exhaustively before ship. The severity of scrubber false negatives is rated critical above, but whether the actual false-negative rate is negligible or material depends on how diverse the user base's tooling is. Design stage should consider whether a "scrubbed item count" disclosure in the consent step (showing the user how many items were stripped) provides a useful calibration signal.

**Iteration Cap Counting Unit Ambiguity** — The unbounded fix-loop cost risk (above) is rated high, but the exact severity depends on what is counted as an "attempt" for cap purposes. If the cap counts successful commits (not total invocations), a fix agent that makes many API calls without producing a commit does not consume cap budget — but can still burn significant token cost. The counting semantics are a design decision; the risk severity may need to be revisited after the design stage resolves this.

**State Store Choice and Cold-Start Latency Interaction** — The state store unavailability risk and the cold-start webhook timeout risk are partially coupled: the state store read happens during the cold-started handler, adding to the total response latency. If the state store is Firestore with standard read latency (~10ms median, but spiky under contention), it may not push the total over 10 seconds. If GCS object storage is used, read latency is higher and more variable. The combined latency budget for cold start + state read + 200 acknowledgment is not characterized until the design stage selects the state store.

**Webhook Delivery Deduplication** — GitHub may redeliver webhook events if the initial delivery times out or returns a non-2xx response. If the fix agent processes a redelivered event without recognizing it as a duplicate, it may run a second fix attempt against the same CI state and consume two cap slots for one logical event. The detection signal for deduplication failures is not yet defined. Design stage should specify whether webhook event IDs are stored in the state store for idempotency.

---

## Citations

- DISCOVERY.md § Risks (lines 91–97) — primary source for risks 1–5 above; descriptions expanded with failure-mode analysis
- DISCOVERY.md § Strategic Considerations (lines 60–69) — source for privacy policy gap risk, OAuth attribution mismatch risk, and Sentry coexistence context
- `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (unit-01) — source for bounded-loop caps (5 fix attempts), bundle size threshold (5 MB), and failure end-state descriptions (fix loop gave up, bundle too large)
- `stages/inception/artifacts/privacy-and-data-handling-principles.md` (unit-04) — source for scrubbing false-negative severity classification, privacy policy compliance gap risk, and the conservative-on-uncertainty principle that bounds the scrubber's design space
- DISCOVERY.md § Open Questions (lines 81–88) — source for state store design question, subdomain question, and webhook secret verification question (informing state-store unavailability and cold-start risks)
- DISCOVERY.md § Capability Needs (lines 71–79) — source for confirming the durable state store requirement and the webhook receiver as a load-bearing architectural dependency
