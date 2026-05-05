# Success Criteria and Acceptance Shape

*Artifact for unit-01-success-criteria-and-acceptance-shape, inception stage, intent autonomous-report-to-fix*

---

## Fire-and-forget UX contract

The contract is defined by the sequence of user actions and the system responses that follow each — all observable in the UI, not in internal state.

**Step 1 — User runs `/haiku:report`**
The skill activates inside Claude Code. The system asks the user what went wrong, what they expected, and how to reproduce it. No data leaves the machine at this point. *(Source: `plugin/skills/report/SKILL.md`, steps 1–2)*

**Step 2 — User confirms the synthesized summary**
The agent presents a structured summary. The user confirms (or corrects). Still no data leaves the machine. *(Source: `plugin/skills/report/SKILL.md`, step 3)*

**Step 3 — User submits**
The user says yes (or equivalent). The system collects the JSONL session bundle, scrubs it client-side, and POSTs to the Cloud Run report-agent endpoint. The skill returns a `fix_id` and an `auth_url` — both visible to the user in the conversation. The user's job is done at this moment. The conversation displays: "Your report is filed. A GitHub issue will open shortly. If you want it attributed to your GitHub account, visit [auth_url]." *(Source: DISCOVERY.md § Success Criteria, § UI Impact → `/haiku:report` skill)*

**Step 4 — User optionally grants OAuth (optional)**
The user opens `auth_url` in a browser. The page (`haikumethod.ai/report/:id`) shows report status and a "Connect GitHub" button. If the user clicks it, the standard OAuth flow redirects to GitHub, the user grants issue-write scope, and the callback updates the report record. The page confirms: "Your GitHub account is now linked. The issue will be attributed to you." If the user closes the tab without acting, nothing breaks — the issue opens under the bot identity. *(Source: DISCOVERY.md § UI Impact → `haikumethod.ai/report/:id`, § Open Questions → consent UX)*

**Step 5 — System takes over (no user involvement)**
After submission, all visible progress lives in GitHub: the issue body (created within seconds of POST), the bot-authored PR (created once the agent produces a candidate fix), CI status checks on the PR, and any bot comments when the fix loop hits a decision point. The user can monitor by watching the GitHub issue. No H·AI·K·U-specific status page is required.

---

## Acceptance shape — what "done" looks like

The following end states are user-observable. Each names the surface where the user sees it.

| End state | Observable surface | Trigger |
|---|---|---|
| **Issue opened** | GitHub issue on `gigsmart/haiku-method` | Cloud Run POSTs to GitHub API within seconds of receiving the bundle. The issue body names the reporter (by attribution from the report or by GitHub login if OAuth was granted). |
| **PR opened** | GitHub PR on `gigsmart/haiku-method`, linked to the issue | The report-agent produces a candidate fix and opens the PR. The PR description references the issue number and the fix context. CI checks begin automatically. |
| **CI green + PR merged** | GitHub PR status (all checks pass), PR shows "Merged" badge | The fix loop continues pushing commits until all required CI checks pass. Once green, the PR is merged by the bot. The issue is automatically closed by the merge (via `Closes #N` in the PR body). |

Failure end states are also user-observable:

| Failure end state | Observable surface | Trigger |
|---|---|---|
| **Fix loop gave up** | Bot comment on the open PR + PR converted to draft | The iteration cap was reached (see Bounded Loops below). The user sees a comment explaining the cap was hit, with a summary of what was attempted. The PR stays open as a draft for human pickup. |
| **OAuth declined** | No change visible to user (issue still opens under bot) | The user skipped `auth_url` or declined on GitHub. The issue body attributes the report to the name/email the user provided in the conversation, or to "anonymous" if none was provided. |
| **Scrubbing concern** | Plugin conversation displays a warning before POST | The scrubber detected patterns it cannot confidently classify. It surfaces them to the user before submission with a "review and confirm" step. *(Open question — see below)* |
| **Bundle too large** | Plugin conversation displays an error | The JSONL bundle exceeds the POST size cap. The user is told to try again with a shorter session, or to file a manual issue. *(Open question — see below)* |

*(Source: DISCOVERY.md § Success Criteria; DISCOVERY.md § Open Questions lines 81–88)*

---

## Bounded loops — caps and escape hatches

**Maximum bot iterations per fix-id before escalation**

Proposed default: **5 fix attempts** per `fix_id`. Each "attempt" is one webhook-triggered agent invocation that pushes at least one commit. After 5 attempts without all CI checks passing:

- The bot posts a comment on the PR: "I've made N fix attempts and CI is still failing on [list of failing checks]. I'm stopping here so a human can take over."
- The PR is converted from regular to draft status.
- No further webhook invocations are made for this `fix_id` unless a human manually re-triggers (e.g., by posting a `@haiku retry` comment — a future capability, not V1 scope).

The cap protects against unbounded Anthropic SDK token consumption. 5 is a proposed default; the actual value is a design decision. *(Source: DISCOVERY.md § Risks → unbounded fix-loop cost)*

**Behavior on irrecoverable fix failure (PR stays open as draft)**

If the fix loop exits (cap reached, or agent returns an unrecoverable error), the PR stays open as a draft — not closed. Rationale: a draft PR with partial work and a "bot stopped here" comment is more useful to a human investigator than a closed PR with no artifact. The issue remains open.

**Behavior on user OAuth decline**

The issue is opened under the bot account regardless of whether the user grants OAuth. If the user grants OAuth, the issue body contains a line: "Reported by @github-username." If they do not, it contains: "Reported by [name/email from conversation]" or "Reported anonymously." The PR is always bot-authored — the user's OAuth scope is issue-write only and is never used to create PRs on their behalf. *(Source: DISCOVERY.md § Strategic Considerations → OAuth scope trust boundary)*

**Behavior on JSONL bundle too large**

Proposed: a client-side size check before POST. If the bundle exceeds a threshold (exact value is a design decision for the downstream stage — e.g., 5 MB compressed), the plugin truncates to the N most-recent messages, surfaces a notice to the user ("Session was large; sent the last N messages"), and proceeds. If even the truncated bundle exceeds the limit, the submission fails with a user-visible error and a link to file a manual GitHub issue. *(Source: DISCOVERY.md § Open Questions)*

**Behavior on bundle scrubbing uncertainty**

Two proposed options — pick one at design stage:
- **Option A (warn-and-proceed):** Scrub aggressively, then show the user a one-sentence notice before POST: "Removed N patterns that looked like secrets. Review the full stripped list at [link]." Fire-and-forget is preserved; the notice is informational.
- **Option B (pause-and-confirm):** Surface the unclassified patterns, let the user approve or abort before POST. Breaks fire-and-forget but maximizes user control.

The discovery's privacy framing ("consent UX is load-bearing") suggests Option B for the first ship. *(Source: DISCOVERY.md § Open Questions → consent UX)*

---

## Competitive differentiation

The autonomous report-to-fix loop is evaluated against five competitors through three load-bearing lenses: **(L1)** the session bundle as the first-class diagnostic artifact, **(L2)** the fire-and-forget UX contract (user fires the shot and is done), and **(L3)** the autonomous-until-green fix loop (driven by webhooks, not by human iteration). Each entry below names what the competitor delivers across those lenses and what it does not. Downstream stages must preserve every "does not" — that's the moat.

**GitHub Copilot Workspace.** [Copilot Workspace](https://githubnext.com/projects/copilot-workspace) lets a developer write a task description in GitHub's UI and generates a plan, an implementation, and a PR. **Does:** native GitHub integration, PR-first output. **Does NOT:** treat a session transcript as input (L1 — it operates on a human-authored task description, not a diagnostic bundle); preserve a fire-and-forget contract (L2 — the user iterates on the plan, the implementation, and the PR); run autonomously until CI green (L3 — review and CI failures require human intervention to advance). *(Source: DISCOVERY.md § Competitive Landscape → Copilot Workspace)*

**Devin (Cognition AI).** [Devin](https://www.cognition.ai/) is a fully autonomous software engineer that handles multi-step engineering tasks end-to-end. **Does:** persistent autonomous execution across long-horizon tasks; can produce PRs without per-step human steering. **Does NOT:** ingest the user's existing session transcript as the diagnostic seed (L1 — input is a delegated task, not a captured bug context); operate inside the developer's existing editor without leaving for a separate paid product (L2 — fire-and-forget here means leaving the workflow, not a single-shot inside it); webhook-trigger fresh stateless invocations from the user's repo (L3 — Devin's loop is a daemonized session, not a reactive event-driven cycle on the GitHub events the user already cares about). *(Source: DISCOVERY.md § Competitive Landscape → Devin)*

**Sweep AI.** [Sweep](https://sweep.dev) turns labeled GitHub issues into PRs automatically. **Does:** simple trigger model (label an issue), produces PRs without human intermediary planning. **Does NOT:** capture the user's session transcript as input (L1 — Sweep starts from issue text, so the bug context that lives in the JSONL never reaches the agent); run from inside the developer's editor — fire-and-forget means filing an issue and waiting (L2 — the user is not inside `/haiku:report` when they describe the bug, they are inside GitHub's issue form); push fixes until CI green via reactive webhook handling (L3 — Sweep's loop is single-shot per issue, not a webhook-driven cycle that responds to review and check-suite events). *(Source: DISCOVERY.md § Competitive Landscape → Sweep AI)*

**Cursor's bug reporter.** Cursor includes a built-in feedback mechanism that captures editor state and submits it to Cursor's backend. **Does:** in-editor capture of context. **Does NOT:** ship the captured bundle anywhere the user can act on it as a diagnostic artifact (L1 — capture goes to Cursor's vendor backend, not to a public issue tracker the user owns); produce an issue, a PR, or a fix from the captured bundle (L2 — fire-and-forget here means filing telemetry, not closing a loop); run any fix loop at all (L3 — Cursor's report path stops at telemetry submission). *(Source: DISCOVERY.md § Competitive Landscape → Cursor)*

**OpenHands (formerly OpenDevin).** [OpenHands](https://github.com/All-Hands-AI/OpenHands) is an open-source autonomous agent framework that can resolve GitHub issues. **Does:** open-source autonomous resolution loop; can iterate until tests pass within its sandbox. **Does NOT:** start from the user's session JSONL — it starts from a GitHub issue or a task prompt (L1); embed inside the developer's existing tool — the user must spin up and operate a Docker-based environment to use it (L2 — fire-and-forget collapses if the user is provisioning infrastructure to fire the shot); reach into the user's repo via a hosted webhook receiver that handles `pull_request_review`, `issue_comment`, and `check_suite` events without the user managing a daemon (L3 — the autonomous loop runs in the user's environment, not as a reactive service). *(Source: DISCOVERY.md § Competitive Landscape → OpenHands)*

**The differentiation claim — preserve in design and product.** What none of the five do — and what this intent must protect through every downstream stage — is **treat the session transcript as the first-class diagnostic input, accept it through a single-shot user action that ends the user's involvement, and run a stateless webhook-driven fix loop that pushes commits autonomously until CI is green**. Each competitor relaxes at least one of those three lenses. A design choice that quietly converges on any of them — asking the user to write a task description instead of submitting a bundle, requiring them to stay engaged with the PR, or replacing the webhook-driven loop with a daemonized session — collapses the differentiator. Downstream stages may refine *how* each lens is delivered; they may not weaken *what* the lens guarantees. *(Source: DISCOVERY.md § Competitive Landscape → Gaps and Opportunities; § Business Context → Feature Goal & Vision)*

---

## Open Questions

The following questions are not answered by the discovery document or the existing `/haiku:report` skill behavior. Each carries a proposed default or an explicit escalation flag.

| Question | Proposed default | Escalation? |
|---|---|---|
| What is the per-fix-id iteration cap? | 5 attempts | Design stage to confirm |
| What is the POST bundle size cap (pre-scrub)? | 5 MB compressed | Design stage to spec; plugin handles truncation |
| Scrubbing UX: warn-and-proceed vs. pause-and-confirm? | Option B (pause-and-confirm) for V1 | Product stage to decide based on consent policy |
| Does the Sentry event still fire alongside the Cloud Run POST? | Sentry fires as a fallback only if Cloud Run POST fails | Design stage to confirm; privacy policy must cover both surfaces |
| Does the issue appear in the user's GitHub "created issues" list? | No — it is bot-authored; attribution is convention, not a GitHub platform guarantee | Must be disclosed to users before OAuth grant prompt; product stage owns the copy |
| What happens if the GitHub bot token is rate-limited during issue creation? | POST returns an error; plugin surfaces "submission queued — will retry" (needs retry mechanism in Cloud Run) | Design stage to spec retry logic |
| Does the `report/:id` page need its own subdomain? | No — shares `haikumethod.ai` under `/report/[id]` path, client-rendered SPA | Design stage to confirm; no static `generateStaticParams` *(Source: DISCOVERY.md § UI Impact → `haikumethod.ai/report/:id`)* |
| Privacy policy update — required before ship? | Yes — the current policy explicitly states no data is sent to GigSmart servers. This must change before the first user sees the new flow. | (needs human escalation) — legal/policy decision |

---

## Citations

- DISCOVERY.md § Success Criteria (lines 27–32) — functional success outcomes (issue opened, PR opened, CI green, attribution, scrubbing)
- DISCOVERY.md § Open Questions (lines 81–88) — source for all open questions carried forward here
- DISCOVERY.md § Strategic Considerations → OAuth scope trust boundary — source for the OAuth-decline acceptance shape
- DISCOVERY.md § Strategic Considerations → Privacy policy gap — source for the privacy escalation flag in open questions
- DISCOVERY.md § Risks → unbounded fix-loop cost — source for the iteration cap requirement
- DISCOVERY.md § UI Impact → `/haiku:report` skill — source for the multi-step fire-and-forget conversational flow
- DISCOVERY.md § UI Impact → `haikumethod.ai/report/:id` — source for the auth_url landing page shape and client-rendered SPA requirement
- DISCOVERY.md § Competitive Landscape (lines 34–56) — source for the per-competitor analysis and the gap-and-opportunity framing carried forward into the Competitive differentiation section
- `plugin/skills/report/SKILL.md` — current behavior (ask → summarize → confirm → `haiku_report`) is preserved through step 3; the new behavior diverges at step 4 (POST to Cloud Run instead of Sentry-only)
