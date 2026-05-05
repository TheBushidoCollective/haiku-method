---
unit: unit-01-success-criteria-and-acceptance-shape
stage: inception
intent: autonomous-report-to-fix
---

# Success Criteria and Acceptance Shape

## Fire-and-forget UX contract

The user's interaction with the autonomous report-to-fix loop ends the moment they close the Claude Code conversation. Every action below is a user-observable event in the Claude Code terminal or a browser page — nothing requires internal state inspection.

1. **User runs `/haiku:report` in Claude Code.** Observable: the skill prompt appears in the terminal.
2. **User describes what broke.** Observable: Claude Code echoes back a synthesized summary and asks for confirmation. This is the current behavior of `plugin/skills/report/SKILL.md` (steps 1–3).
3. **User confirms the summary.** Observable: Claude Code acknowledges and begins the bundle-and-submit flow. This is the last required user action.
4. **(Optional) User clicks the `auth_url` returned by the skill and grants GitHub OAuth on `haikumethod.ai/report/:id`.** Observable: the landing page acknowledges the grant and updates the issue attribution. Users who skip this step see the issue attributed by name/email fallback — no error state, no forced retry.
5. **User closes the tab.** Observable: nothing further is required. The issue and PR appear on `gigsmart/haiku-method` without the user polling or re-engaging.

The skill is considered to have fulfilled the fire-and-forget contract when the response from the Cloud Run POST includes a `fix_id` and `auth_url` — that response is what the skill surfaces to the user. All subsequent loop work (fix-agent invocations, CI checks, PR review responses) is invisible to the user unless they visit the GitHub issue or the report status page.

**What the system does, in order, after the user closes the tab:**
- The Cloud Run report-agent service receives the scrubbed JSONL bundle and a synthesized problem description.
- The service opens a GitHub issue on `gigsmart/haiku-method` attributed to the user (by name/email, or bot-identity fallback if no OAuth grant).
- The service opens a bot-authored PR referencing the issue.
- GitHub webhooks (`pull_request_review`, `check_suite`, `issue_comment`) trigger fresh agent invocations until CI is green or the per-fix-id iteration cap is reached.
- The user observes resolution by watching the GitHub issue and PR — no H·AI·K·U-specific dashboard is required.

*Citation: Discovery doc "Feature Goal & Vision" (lines 14–26); `plugin/skills/report/SKILL.md` steps 1–4.*

---

## Acceptance shape — what "done" looks like

Each end state below is observable by the user on the named surface without any special access.

| End state | Observable surface | Observable signal |
|---|---|---|
| Issue created | `github.com/gigsmart/haiku-method/issues` | New issue appears with user name/email in body or "on behalf of" attribution. |
| PR opened | GitHub issue timeline + `github.com/gigsmart/haiku-method/pulls` | "Bot opened a linked PR" event in the issue timeline; PR appears in the pull-requests list. |
| CI green + PR merged | PR page on GitHub | All status checks pass; PR merge event visible in commit history on `main`. |
| Fix loop capped (loop gave up) | GitHub issue + PR | Bot comments "iteration limit reached" on the PR; PR is left in a defined terminal state (see Bounded Loops below). Issue remains open. |
| OAuth declined / skipped | GitHub issue body | Issue body attributes the report by name/email if provided; falls back to bot identity with no error state. |
| Scrubbing warning triggered | Claude Code terminal | Skill emits a warning listing the pattern categories that were stripped before POST (e.g., "Stripped: API keys, absolute home paths"). No bundle preview is shown in V1 — this is an Open Question. |

*Citation: Discovery doc "Success Criteria" (lines 28–32); "UI Impact — Affected Surfaces" (lines 101–109).*

---

## Bounded loops — caps and escape hatches

### (a) Why a per-fix-id iteration cap must exist

Each webhook-triggered agent invocation sends at least one Anthropic API call, which has a direct monetary cost. A PR that attracts many review comments or exhibits flaky CI behavior can trigger unbounded invocations. Beyond cost, unbounded loops erode user trust: a bot that retries indefinitely with no escape hatch looks broken, not persistent. The iteration cap is the mechanism that converts "the bot works autonomously" into "the bot works autonomously within a predictable cost envelope." It is a vendor-cost-discipline requirement (Discovery doc, "Risks — Unbounded fix-loop cost," lines 93–95).

### (b) User-observable behavior when the cap is reached

When the per-fix-id iteration limit is reached:
- The bot posts a comment on the PR: "I've reached the iteration limit for this fix session. The changes I've made are preserved. A human reviewer can continue from here." (Exact copy is a product/design decision — this is the semantic contract.)
- The PR is left in a defined terminal state: either draft, open-but-stale, or closed. Which state, and whether the label signals "human-needed," is an Open Question for product/design — inception names the behavior category, not the specific state.
- The GitHub issue remains open. It is not automatically closed when the cap is reached.
- No notification is sent to the user's email or Claude Code session (the user has already closed the tab). The only observable signal is the bot comment on GitHub.

### (c) User-observable behavior when the user declines OAuth

If the user dismisses the OAuth grant on `haikumethod.ai/report/:id`, or never clicks the `auth_url` at all:
- The GitHub issue is opened under the bot identity.
- The issue body includes the user's name and email if they were collected by the skill (`haiku_report`'s optional `name` / `contact_email` fields per `plugin/skills/report/SKILL.md` step 4). If neither was provided, attribution is "Anonymous reporter."
- The PR is bot-authored in all cases — the user's OAuth grant only affects issue attribution, not PR creation.
- No error is surfaced to the user; the report proceeds identically from the user's perspective.

*Citation: Discovery doc "OAuth scope trust boundary" (lines 63–65); "Success Criteria" (lines 32–33).*

### (d) The cap value is an Open Question for product/design

Inception establishes that a cap must exist and defines what hitting it looks like. The actual numeric cap (e.g., 5, 10, 20 invocations per fix_id) is deferred to the product/design stage. Relevant constraints product/design must resolve:
- The cap must be high enough that the loop has a realistic chance of closing a straightforward bug.
- The cap must be low enough that a pathological PR (flaky CI, large diff, many review comments) doesn't incur runaway cost.
- The cap must be configurable at the service level, not hard-coded, so it can be tuned post-launch without a redeploy.

*Open Question status: See Open Questions section below.*

---

## Competitive differentiation

### GitHub Copilot Workspace

[GitHub Copilot Workspace](https://githubnext.com/projects/copilot-workspace) lets a developer describe a task in natural language and generates a step-by-step plan and PR. The input is a task description the developer writes; there is no session-transcript capture, no diagnostic artifact shipped from the developer's local environment. The loop is interactive: the developer reviews and iterates on the plan before any code is written or committed. CI failures do not autonomously trigger fresh agent runs — the developer must re-engage. Copilot Workspace does not have a fire-and-forget mode; it is a human-in-the-loop planning tool that terminates at PR open.

*Citation: Discovery doc "Competitive Landscape — GitHub Copilot Workspace" (line 39).*

### Devin (Cognition AI)

[Devin](https://www.cognition.ai/) is the closest analog to the fix loop in terms of autonomous, end-to-end bug resolution. Devin can receive a task, write code, run tests, and iterate until done. The key differences: Devin is a standalone, persistent, daemonized service — not an embedded capability inside the developer's existing workflow. The developer delegates to Devin explicitly and waits for an async result. There is no session-transcript input — Devin reasons from the task description, not from a diagnostic JSONL bundle. Devin is a separate paid product; H·AI·K·U's fix loop is a native capability of the tool the developer is already using, triggered from inside the same session that produced the bug.

*Citation: Discovery doc "Competitive Landscape — Devin (Cognition AI)" (lines 41–42).*

### Sweep AI

[Sweep](https://sweep.dev) converts GitHub issue labels into automated PRs. The trigger is a `Sweep:` label on an issue the developer filed manually. There is no session-bundle capture, no client-side scrubbing, and no fire-and-forget flow embedded in the developer's editor. Sweep's fix loop is stateless in the sense that it does not accumulate context across retries — each retry starts from the issue description. The attribution model is straightforward (issue author is the reporter), but because the reporter must manually file the issue with the right label, the friction is higher than `/haiku:report`'s conversational flow.

*Citation: Discovery doc "Competitive Landscape — Sweep AI" (lines 43–44).*

### Cursor

Cursor includes a built-in bug reporter that captures editor state (the active file, cursor position, selected text, and recent terminal output). It does not open GitHub issues or PRs. It does not run a fix loop. The submitted bundle is not scrubbed client-side before transmission. Cursor's model is unidirectional: the report goes to Cursor's team, not back to the developer's own repository. There is no fire-and-forget autonomous resolution — the report enters a queue, and resolution is a human engineering process on Cursor's side, not an agent-driven loop in the developer's repo.

*Citation: Discovery doc "Competitive Landscape — Cursor's bug reporter" (lines 37–38).*

### OpenHands (formerly OpenDevin)

[OpenHands](https://github.com/All-Hands-AI/OpenHands) is an open-source autonomous agent framework that can resolve GitHub issues end-to-end. It is architecturally the closest analog: given an issue, OpenHands can clone the repo, write a fix, and open a PR. The key difference is deployment: OpenHands runs as a standalone Docker-based environment and requires the developer to set it up, configure it against their repo, and point it at an issue. It is not embedded in the developer's workflow and does not have a fire-and-forget path from a conversational bug report. There is no client-side session-transcript capture.

*Citation: Discovery doc "Competitive Landscape — OpenHands" (lines 45–46).*

### Differentiation claim (downstream product/design must preserve)

The autonomous report-to-fix loop's differentiator is the combination of three properties that no competitor currently offers together: (1) the diagnostic input is the session transcript — the actual JSONL conversation including tool calls and subagent chains — not a natural-language description written after the fact; (2) the UX is fire-and-forget from inside the developer's existing workflow, with no daemon to manage, no separate product to log into, and no manual issue-filing step; (3) the fix loop runs autonomously until CI is green or the cap is reached, driven by GitHub webhooks, without requiring the developer to stay engaged. Downstream product and design stages must ensure that any scope reduction or phasing decision preserves all three properties in V1 — removing any one of them collapses the differentiation claim to something a competitor already ships.

*Citation: Discovery doc "Gaps and Opportunities" (lines 53–57).*

---

## Open Questions

| Question | Proposed default | Notes |
|---|---|---|
| What is the per-fix-id iteration cap? | (needs human escalation) | Product/design picks the number. Inception only mandates that a cap must exist. See Bounded Loops §(d). |
| What is the terminal PR state when the cap is reached? | Leave PR open as a draft, add "human-needed" label | Alternatives: close PR with "bot-gave-up" label, or leave open-but-stale. Product/design decides. |
| Does the scrubbing flow include a user-visible bundle preview before POST? | No preview in V1; emit a warning listing stripped pattern categories | If a disclosure model is required (e.g., GDPR obligations), this becomes a blocker before ship. |
| What is the consent UX — does `/haiku:report` explain what data will be sent before collecting it? | Explain data sent before first bundle POST; one-time acknowledgment stored client-side | Privacy policy change (Discovery doc, lines 62–63) makes this load-bearing. |
| Does the Sentry event still fire alongside the Cloud Run POST? | Yes, both fire in V1 (additive) | Removing Sentry is a separate decision; design stage resolves whether two-surface privacy implications are acceptable. |
| How are JSONL files larger than the POST limit handled? | Truncate from the oldest messages; preserve the most recent N turns | Design stage picks the truncation strategy and size limit. |
| Is the durable state store Cloud Firestore, GCS, or another option? | (needs human escalation) | Affects cold-start latency and cost model. Design stage resolves. |
| What is the retention duration for the scrubbed bundle and fix state? | (needs human escalation) | Privacy policy requires a stated retention period. Inception does not pick a number. |
| Does the report-agent service need its own subdomain? | `report.haikumethod.ai` | Consistent with `auth.haikumethod.ai` naming convention. Design stage confirms. |
