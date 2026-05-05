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

Proposed default: **5 fix attempts** per `fix_id`. After 5 attempts without all CI checks passing:

- The bot posts a comment on the PR: "I've made N fix attempts and CI is still failing on [list of failing checks]. I'm stopping here so a human can take over."
- The PR is converted from regular to draft status.
- No further webhook invocations are made for this `fix_id` unless a human manually re-triggers (e.g., by posting a `@haiku retry` comment — a future capability, not V1 scope).

The cap protects against unbounded Anthropic SDK token consumption. Both the cap value (5) and the counting unit (what qualifies as an "attempt" — e.g., any webhook-triggered invocation, only invocations that push a commit, only invocations that produce a passing CI run) are design-stage decisions; inception flags both as open questions. See unit-05 (`risk-inventory.md`) Open Questions → "Iteration Cap Counting Unit Ambiguity" for the severity-revisitation note. *(Source: DISCOVERY.md § Risks → unbounded fix-loop cost)*

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
- `plugin/skills/report/SKILL.md` — current behavior (ask → summarize → confirm → `haiku_report`) is preserved through step 3; the new behavior diverges at step 4 (POST to Cloud Run instead of Sentry-only)
