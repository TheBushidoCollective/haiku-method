// orchestrator/prompts/gate_review.ts — A gate (stage-scope or
// intent-scope) is open and the review session has been prepared. The
// orchestrator returns the review URL in `action.review_url`; the
// agent's job is to surface the URL to the user (when needed) and
// then IMMEDIATELY call haiku_await_gate to block on the decision.
//
// Same-turn requirement (load-bearing): the agent must call
// haiku_await_gate in the same turn as posting the URL, not end the
// turn after the post. If the agent stops after announcing the URL,
// the user clicks Approve in the SPA and the await call never fires —
// the workflow stalls until the user prompts the agent again, which
// looks broken. Phrase the instructions as a single combined action,
// not a numbered list the agent can interrupt halfway through.
//
// Three render paths:
//   - intent_review (stage is null) — pre-stage gate, no stage to name
//   - browser_attached=true — user already on the SPA, skip URL post
//   - default — first gate or SPA tab closed, post URL then await

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string | null) ?? ""
	const nextStage = action.next_stage as string | null
	const reviewUrl = (action.review_url as string) || ""
	const sessionId = (action.session_id as string) || ""
	const gateContext = (action.gate_context as string) || ""
	const browserAttached = action.browser_attached === true
	const isIntentReview = gateContext === "intent_review" || stage === ""

	const subject = isIntentReview
		? `Intent "${slug}" is ready for your review before any stage starts.`
		: `Stage "${stage}" is complete and ready for human review${nextStage ? ` before advancing to "${nextStage}"` : ""}.`

	const sessionLine = sessionId
		? `\n\n*(Session ID: \`${sessionId}\` — included for diagnostics; haiku_await_gate finds it automatically.)*`
		: ""

	if (browserAttached) {
		return `## Gate: Awaiting Approval

${subject}

### Browser Already Attached

The user is already watching the SPA on this intent (\`browser_attached: true\` — the live-session broadcaster fired a \`gate_prepared\` event into their open tab). **Do NOT re-post the review URL.** It hasn't changed: \`${reviewUrl}\`.

### Required Next Step (same turn — do not stop here)

**Call \`haiku_await_gate { intent: "${slug}", auto_open: false }\` right now.** Do not end your turn, do not summarize, do not ask the user anything — just make the tool call. The tool blocks until the user submits the review and then returns the next orchestrator action (advance_stage, changes_requested, external_review_requested, etc.) along with the instructions to follow next. \`auto_open: false\` keeps the MCP host from popping a duplicate browser tab.${sessionLine}`
	}

	return `## Gate: Awaiting Approval

${subject}

### Review URL

\`${reviewUrl}\`

### Required Next Steps (same turn — do not stop after posting the URL)

Do BOTH of the following in the same turn. Posting the URL alone is not enough — if you stop here, the user clicks Approve and nothing happens because no tool call is waiting for their decision.

1. **Post the review URL above in chat** so the user can open it on whichever device they want (the MCP host's browser may not be reachable: remote sessions, headless hosts, SSH-only, mobile clients, etc.).
2. **Immediately call \`haiku_await_gate { intent: "${slug}" }\`** in the SAME turn. This blocks until the user submits the review (Approve / Request Changes / External Review). Pass \`auto_open: false\` only if you do NOT want the MCP host to also try to launch a local browser; the default behavior is to launch best-effort.

When the user decides, the await tool returns the next orchestrator action along with the instructions to follow next.${sessionLine}`
})
