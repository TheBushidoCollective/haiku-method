# Affected Surfaces and User Flow

<!-- Sources: DISCOVERY.md (UI Impact §§98–108, Open Questions §§81–88), website/next.config.ts, website/app/auth/[provider]/callback/CallbackClient.tsx -->

## End-to-end user flow

**Step 1 — Invocation (skill)**
The user types `/haiku:report` in their Claude Code session. The skill greets them, asks what broke, and listens. This is the conversational intake that already exists in `plugin/skills/report/SKILL.md`.

**Step 2 — Bundle collection and scrubbing (skill / plugin)**
After the user describes the issue and confirms, the plugin locates the JSONL session files under `~/.claude/projects/<encoded-cwd>/`, traverses the `parent_uuid` chain to gather the full subagent tree, scrubs credentials, API keys, env vars, and absolute home paths client-side, and packages the result into a bundle. No user action is required.

**Step 3 — POST to Cloud Run (skill / plugin)**
The plugin POSTs the scrubbed bundle to the report-agent Cloud Run service. The service responds synchronously with `{fix_id, auth_url}`. The skill surfaces both to the user: the `auth_url` is offered as a link the user can open if they want to attribute the report to their GitHub account; declining is fine and changes nothing about the fix loop.

**Step 4 — OAuth grant (web page — optional branch point)**
If the user opens `auth_url`, they land on `haikumethod.ai/report/<fix_id>`. The page prompts them to connect their GitHub account (issue-write scope only). The user clicks "Connect GitHub", is redirected to GitHub's OAuth consent screen, approves, and is redirected back to the callback URL. The page reads the callback result and confirms that attribution is linked. If the user closes the tab or clicks "Skip", the fix loop continues without attribution — the issue and PR are opened under the bot account with the user's name/email in the body if they provided it during intake.

**Step 5 — Issue opened (GitHub issue)**
The Cloud Run service opens a new GitHub issue on `gigsmart/haiku-method`. The issue body contains the synthesized problem description, attribution, and a link back to `haikumethod.ai/report/<fix_id>`. At this point the user has no required action — the loop is running autonomously.

**Step 6 — PR opened (GitHub PR)**
The Cloud Run service (or a subsequent webhook invocation) opens a PR against `main` referencing the issue. The PR description is bot-authored. If the user has a GitHub account, they receive a GitHub notification; they can watch the PR but do not need to act.

**Step 7 — Fix iterations (GitHub PR + CI, no user surface)**
CI runs against the PR. `check_suite` events and `pull_request_review` events from the GitHub Actions Claude bot wake the fix loop via webhooks. Each wake triggers a fresh agent invocation on Cloud Run. The agent reads the current PR state, applies fixes, and pushes commits. The `report/<fix_id>` web page reflects the current iteration state (issue open, PR open, CI running, CI failed, fix in progress, etc.) but requires no user action.

**Step 8 — PR merged (GitHub PR)**
When CI is green and any required reviews pass, the PR is merged. The `report/<fix_id>` page shows the loop as closed. The user receives a GitHub notification if they are subscribed. The loop ends.

---

## Affected surfaces

### Skill (`/haiku:report`)

**What changes:** The submission step changes from a direct Sentry POST (via the `haiku_report` MCP tool) to a multi-step flow: bundle collection, client-side scrubbing, POST to Cloud Run, and surface of `{fix_id, auth_url}` to the user.

**What the user sees:** A conversational exchange that ends with a confirmation message containing the `fix_id` and an optional link to the `report/<fix_id>` web page for OAuth attribution. The user is told their report is in and the loop is running.

**Events emitted:** The POST to Cloud Run returns `{fix_id, auth_url}`. The skill emits the `auth_url` as a clickable link.

**Events consumed:** None from external systems — this surface initiates the flow.

---

### `haikumethod.ai/report/<fix_id>` (web page)

**What changes:** This is a new page that does not currently exist. It is a client-rendered SPA (no server-side `[id]` segment due to `output: "export"` in `website/next.config.ts` — the same static-export constraint that shapes the `/browse` page). The `fix_id` is read from the URL at runtime by client-side JavaScript.

**What the user sees:** A status page showing the current state of the report — received, issue opened, PR opened, CI running, fix in progress, merged, or cap-hit (bot gave up). During the OAuth step, the page shows a GitHub Connect prompt. After the user connects or skips, the page shows the issue and PR links when they are available.

**Events emitted:** OAuth initiation (redirect to GitHub consent screen). Polling calls (or webhook-push via SSE/long-poll, TBD by design stage) to the report-agent service to get current status.

**Events consumed:** OAuth callback (reads `code` and `state` params from the URL after GitHub redirects back). Status updates from the report-agent service.

**Static-export constraint:** Because `output: "export"` is set in production (`website/next.config.ts` line 7), this route cannot use `generateStaticParams`. It must use the same client-rendering approach as `/browse` — the `fix_id` is read from `window.location` or a query param at runtime. The `/report/[id]` page.tsx must be a client component or a thin server wrapper around a client component that reads the ID at runtime, following the `CallbackClient` pattern in `website/app/auth/[provider]/callback/CallbackClient.tsx`.

---

### GitHub issue on `gigsmart/haiku-method`

**What changes:** A new issue is programmatically opened by the bot on every `/haiku:report` submission that reaches the Cloud Run service. This is a net-new automated actor in the `gigsmart/haiku-method` issue tracker.

**What the user sees:** A GitHub issue attributed to the bot account (with user name/email in the body if provided, or the user's GitHub account listed as a collaborator if OAuth was granted). The issue body contains the synthesized problem description and a link to the status page.

**Events emitted:** `issues.opened` GitHub webhook event. This event is observable by other GitHub integrations on the repo.

**Events consumed:** `issue_comment` events (review comments posted on the PR thread back-reference the issue; the fix loop reads them via webhook).

---

### GitHub PR on `gigsmart/haiku-method`

**What changes:** A new PR is programmatically opened by the bot, referencing the issue. The PR is bot-authored. It is the primary artifact through which the fix loop pushes commits.

**What the user sees:** A PR against `main` with a bot-authored description, linked to the report issue. If the user has OAuth attribution, they appear in the issue body. The PR shows CI status, review comments, and successive fix commits as they are pushed.

**Events emitted:** `pull_request.opened`, `pull_request.synchronize` (on each fix push), `pull_request.closed` (on merge). These events are consumed by the fix loop service.

**Events consumed:** `pull_request_review` events (review comments wake the fix loop). `check_suite.completed` events (CI results wake the fix loop). Merge event closes the loop.

---

## State transitions

The fix-id state machine tracks the lifecycle of a single report from intake to resolution. The following events transition it:

| Event | From state(s) | To state | Surfaces reflecting the change |
|---|---|---|---|
| Cloud Run POST succeeds | — | `received` | Skill (confirmation message), `report/<fix_id>` page |
| OAuth granted | `received` | `attributed` | `report/<fix_id>` page (shows GitHub user) |
| OAuth declined / tab closed | `received` | `received` (unattributed) | `report/<fix_id>` page (no GitHub user shown) |
| Issue opened on GitHub | `received` / `attributed` | `issue_open` | `report/<fix_id>` page (issue link appears), GitHub issue |
| PR opened on GitHub | `issue_open` | `pr_open` | `report/<fix_id>` page (PR link appears), GitHub PR |
| Review comment received | `pr_open` / `fix_in_progress` | `fix_in_progress` | GitHub PR (new comment visible), `report/<fix_id>` page |
| CI status received (failed) | `pr_open` / `fix_in_progress` | `fix_in_progress` | GitHub PR (CI badge), `report/<fix_id>` page |
| CI status received (passed) | `fix_in_progress` | `ci_green` | GitHub PR (CI badge), `report/<fix_id>` page |
| Fix iteration cap hit | `fix_in_progress` | `cap_hit` | GitHub PR (bot comment: "gave up"), `report/<fix_id>` page |
| PR merged | `ci_green` | `merged` | GitHub PR (merged state), `report/<fix_id>` page (loop closed) |

### Branch points

**OAuth decline / tab close:** When the user opens the `auth_url` and closes the tab before completing OAuth, or explicitly clicks "Skip", the fix loop continues unattributed. The issue and PR are still opened; the issue body attributes the report to the user's provided name/email (from intake), not their GitHub account. The `report/<fix_id>` page, if reopened later, shows the issue and PR links without a GitHub user profile.

**No `auth_url` opened at all:** If the user does not open the `auth_url` returned by the skill (the link is optional and the skill makes that clear), the flow is identical to the OAuth decline path. The loop runs, the issue and PR are opened, and the page is accessible at `haikumethod.ai/report/<fix_id>` whenever the user decides to visit.

**Fix loop cap hit:** When the configured per-fix-id iteration cap is reached without CI passing, the bot posts a "gave up" comment on the PR, transitions the state machine to `cap_hit`, and stops consuming webhook events for that `fix_id`. The PR remains open for human pickup. The `report/<fix_id>` page reflects the `cap_hit` state. No user action is required — this is a terminal state for the autonomous loop, not the overall issue.

---

## Citations

- Discovery doc, UI Impact section (lines 98–108): names the four surfaces (skill, web page, GitHub issue, GitHub PR) and identifies the static-export constraint and the auth-proxy precedent.
- Discovery doc, Open Questions section (lines 81–88): consent UX, scrubbing adequacy, cap behavior, JSONL size, state store choice, subdomain vs path, webhook secret verification — all open questions for downstream stages.
- `website/next.config.ts` lines 6–8: `output: "export"` is applied outside `isDev`, which means the production build is fully static. The `/report/<fix_id>` route cannot use server-side `[id]` segment rendering.
- `website/app/auth/[provider]/callback/CallbackClient.tsx`: the `CallbackClient` component (client-only, reads OAuth callback params via `handleOAuthCallback`, drives a three-state UI: processing → success → error) is the precedent for the `report/<fix_id>` page's auth step component.
