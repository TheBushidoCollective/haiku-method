# Privacy and Data Handling Principles

## Privacy policy delta

### Existing claim being changed

`website/content/pages/privacy.md` — section "The plugin runs locally", lines 11–14 (as of effective date April 8, 2026):

> The H·AI·K·U plugin runs entirely inside your Claude Code environment. It reads and writes files on your local filesystem — intents, units, iteration state, configuration. **None of that data is sent to GigSmart servers.** We don't have a backend. We don't collect telemetry by default. Your code and project content stay on your machine.

The claim "None of that data is sent to GigSmart servers" and "We don't have a backend" become false the moment `/haiku:report`'s new flow ships: a session bundle (scrubbed JSONL and synthesized description) is POST-ed to a GigSmart-operated Cloud Run service. This is a material change, not a minor clarification.

### Replacement language at the principle level

The updated section must:
1. Acknowledge that the default behavior remains local-only — the plugin does not transmit data during normal workflow execution.
2. Introduce `/haiku:report` as an explicit, user-initiated opt-in action that transmits data.
3. Name what leaves the machine: a scrubbed session bundle (conversation JSONL with sensitive patterns removed) and a synthesized problem description — not raw source code or project intent files.
4. Name who receives it: a GigSmart-operated service (Cloud Run) used to diagnose and fix the reported issue.
5. State that the user's consent is collected before transmission, not after.

The new section must not use the phrase "None of that data is sent to GigSmart servers" in its former unqualified form; it must draw a clear line between passive plugin operation (still local-only) and the active report action (user-initiated, with disclosure).

### Gating relationship

The privacy policy update is a launch gate for the `/haiku:report` loop. The scrubber must pass its own completeness review, the consent UX must be implemented, and the updated policy must be live at `haikumethod.ai/privacy` before the feature is enabled in any production build. Shipping without this update would expose GigSmart to a misrepresentation claim — the existing policy is explicit, not vague.

---

## Consent UX principles

### Timing: consent before data leaves the machine

Consent must be collected **before** the session bundle is POST-ed. The scrubber runs client-side; the user must have the opportunity to see the disclosure and decline before the scrubbed bundle leaves their machine. A "notify after" model is incompatible with the privacy contract for two reasons: (a) it cannot be meaningfully revoked once the POST completes, and (b) it provides no path for the user to exercise the "review what was sent" right described in Retention and Disclosure below.

The practical implementation is: `/haiku:report` presents the disclosure and asks for explicit confirmation (or captures the GitHub OAuth grant as the confirmation signal) before calling the Cloud Run endpoint.

### What the user sees about what is being sent

The disclosure must name three things:
1. **The artifact type**: a scrubbed session transcript (JSONL conversation log), not raw source code, not intent files, not the full filesystem.
2. **What was stripped**: the categories of patterns the scrubber removed (credentials, paths, email addresses — at the class level, not the pattern level).
3. **Where it goes**: a GigSmart-operated service that will use it to open a GitHub issue and attempt an automated fix.

The disclosure does not need to reproduce the full scrubbed bundle for the user to read before submission (that would create friction without proportionate privacy benefit). It needs to be accurate and specific enough that the user can make an informed decision. "We're sending your conversation log" is not sufficient; "We're sending your scrubbed session transcript — credentials, home paths, and email addresses have been removed — to open a bug report on gigsmart/haiku-method" is.

### Behavioral default on incomplete flows

If the user closes the tab or dismisses the report midway — after `/haiku:report` was invoked but before the POST completes — the default is **no transmission**. The bundle is not queued for deferred send. The report is abandoned. If a partial POST already occurred (e.g., the connection dropped mid-upload), the service discards incomplete payloads rather than processing them.

### Tradeoff axis: friction vs informed consent

The friction–consent axis here sits firmly on the consent side. The session transcript contains the full conversation including tool calls, agent subagent chains, and their outputs. Even after scrubbing, this is sensitive material — it reveals the user's workflow, the structure of their project, and the nature of the bug they encountered. The cost of one confirmation step is low; the cost of a user discovering their workflow was transmitted without their explicit understanding is high. The consent step should be designed to be fast (one prompt, one affirmation) but not skippable.

---

## Scrubbing principles

The scrubber operates on the JSONL session bundle client-side, before any data leaves the user's machine. It must be **conservative on uncertainty**: when a pattern might be a credential or sensitive value, strip it. When a path might be a home path, strip it. The risk of a false positive (stripping a benign value) is cosmetic — the diagnostic context is slightly reduced. The risk of a false negative (passing through a credential) is a user trust failure.

The scrubber strips the following data classes at minimum:

- **API tokens / bearer credentials**: Any string matching the structural pattern of a bearer token, API key, or service credential (length thresholds, character class distributions consistent with random key generation, or prefix signals like `sk-`, `ghp_`, `gho_`, `Bearer `, `token:`, `api_key=`). This class covers Claude API keys, GitHub PATs, OpenAI keys, and arbitrary service tokens the user may have in their environment. Detection signal: prefix-pattern rules combined with entropy heuristics for unrecognized credential-shaped strings.

- **Environment variable values**: Any key=value pair where the key appears in a known sensitive-variable namespace (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `OPENAI_API_KEY`, `AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`, `SECRET_*`, `*_TOKEN`, `*_KEY`, `*_SECRET`, `*_PASSWORD`). The value is stripped even when the key is not in the JSONL directly — tool output that echoes env vars must be caught by value-shape detection, not only by key presence. Detection signal: key-pattern matching on known namespaces plus value-shape detection for credential-class patterns.

- **Absolute home paths (`/Users/<name>/...` and `/home/<name>/...`)**: Any filesystem path that begins with `/Users/` or `/home/` and includes a username segment. These paths are present throughout Claude Code session JSONLs — tool call inputs (`file_path` arguments), tool outputs (error messages), and assistant text all reference absolute paths. The path may reveal the username and the directory structure of the user's machine. Detection signal: prefix matching on `/Users/` and `/home/` followed by a non-empty path segment. The replacement is a normalized placeholder (e.g., `~`-prefixed relative form or a fixed sentinel). Paths beginning with `/tmp/` or the project's own working directory (resolved at report time) are treated differently — see Conservative-on-uncertainty below.

- **IP addresses**: IPv4 addresses in dotted-decimal form (`N.N.N.N`) and IPv6 addresses in standard notation. These appear in error messages from network tool calls, server logs echoed in tool output, and debug traces. Detection signal: decimal-dotted quad pattern for IPv4; colon-hex groups for IPv6. Loopback addresses (`127.0.0.1`, `::1`, `localhost`) are retained as they carry no identifying information, but private-range addresses (RFC 1918) and public addresses are stripped.

- **Email addresses**: Any string matching standard email address form (`local-part@domain.tld`). Email addresses appear in git commit metadata, error messages, tool outputs referencing user configuration, and synthesized descriptions. Detection signal: regex matching on the RFC 5321-compatible shape. The user's email provided during the report flow is handled separately (it is explicit attribution data, not scraped from the bundle).

### Conservative-on-uncertainty

The trust-risk dimension from DISCOVERY.md (Risks, lines 91–97) establishes the principle directly: "A scrubber that misses a credential ships it to GCP. This is a user trust risk, not just a policy risk." The scrubber must strip on ambiguous matches rather than passing them through for three reasons:

1. **False negatives are unrecoverable.** Once a credential leaves the user's machine in cleartext, it cannot be un-sent. A false positive (stripping a non-credential) reduces diagnostic context at worst — the fix agent may produce a lower-quality diagnosis. That is recoverable (the user can file another report). A false negative is not.

2. **Custom secrets are invisible to pattern matching.** The scrubber can enumerate known structural patterns (token prefixes, email shape, home path prefixes). It cannot know that `my-internal-api-key-value-123abc` is a secret when it appears in a tool output. Entropy-based heuristics lower the false-negative rate but do not eliminate it. The "strip on uncertainty" rule is the safety net for what pattern matching cannot reach.

3. **The diagnostic artifact remains useful after conservative stripping.** The fix agent needs the structure of the conversation — the sequence of tool calls, the error messages, the model responses — not the literal credential values. A session where `ANTHROPIC_API_KEY=sk-ant-...` has been replaced with `ANTHROPIC_API_KEY=[REDACTED]` is diagnostically equivalent to the original for the purposes of identifying a workflow-engine bug.

---

## Retention and disclosure

### Retention duration

The Cloud Run service must not retain the session bundle beyond the active fix lifecycle for the associated `fix_id`. Once the issue is closed (bot-merged PR, or fix loop exhausted), the bundle is eligible for deletion. The retention principle: store only as long as the diagnostic artifact is needed for active work, and no longer.

The specific retention duration (number of days after fix closure before deletion, the mechanism that triggers deletion) is an open question deferred to the design stage — it depends on the state store choice and the deletion-trigger implementation. The principle constraint is that retention must be bounded and communicated to the user at consent time.

### Who can access it

Access to a submitted bundle is restricted to:
- The Cloud Run service's own service account (for the fix-agent invocations)
- GigSmart engineering staff with Secret Manager + storage access (for incident investigation)
- No third parties

The bundle is not shared with Anthropic beyond the API call the fix agent makes (which is subject to Anthropic's standard API data handling policy, not GigSmart's). The Sentry coexistence question (DISCOVERY.md, Strategic Considerations, lines 67–68) — whether the existing Sentry event still fires alongside the Cloud Run POST — must be resolved in the design stage; if Sentry continues to receive events, that is a second external surface and must be disclosed in the consent UX.

### What the user can request

Users must be able to request:
- **Deletion of their submitted bundle** — identified by `fix_id`, which the user receives when `/haiku:report` completes. The deletion mechanism (API endpoint, email to oss@gigsmart.com, or self-service on the report status page) is an open question for the design stage.
- **A copy of what was submitted** — the scrubbed bundle as it was received by the Cloud Run service. The user should be able to verify what was actually sent, not just what the client claimed to have stripped.

Both rights must be named in the updated privacy policy and in the consent disclosure presented by `/haiku:report`.

---

## Open Questions

These are not decisions deferred indefinitely — they are proposed defaults requiring product and design confirmation before the design stage begins.

**Pre-send preview UX** — Proposed default: no full bundle preview before send, but a plain-language summary of what categories were scrubbed (e.g., "We removed 3 credential patterns and 14 home path references"). A full preview would require the user to read potentially thousands of lines of JSONL before confirming, which defeats the fire-and-forget UX contract. The summary approach preserves informed consent without blocking the flow. Open: is a "show me what was scrubbed" optional expansion sufficient, or does the user need the ability to inspect and edit the bundle before send?

**Retention duration** — Proposed default: 90 days from fix closure (PR merged or fix loop exhausted), then automated deletion. This gives GigSmart engineering enough time to reference the bundle for post-fix analysis without indefinite retention. Open: should the retention clock start from submission or from fix closure? Should users be able to shorten their own retention window?

**Deletion-request mechanism** — Proposed default: email to oss@gigsmart.com with the `fix_id` in the subject. This is low-tech but immediately implementable without additional service surface. Open: should the report status page (`haikumethod.ai/report/:id`) include a self-service deletion button backed by an authenticated API endpoint? If so, authentication (the same GitHub OAuth flow) must be wired for that action.
