// orchestrator/prompts/gate_review.ts — Stage gate is open and the
// review session has been prepared. The orchestrator returns the
// review URL in `action.review_url`; the agent's job is to surface
// the URL to the user and then call haiku_await_gate to block on the
// decision.
//
// This split lets remote-control, headless, SSH, mobile-chat, and
// web-client setups participate — the URL travels through chat
// regardless of whether the MCP host can launch a browser locally.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug, action }) => {
	const stage = action.stage as string
	const nextStage = action.next_stage as string | null
	const reviewUrl = (action.review_url as string) || ""
	const sessionId = (action.session_id as string) || ""

	return `## Gate: Awaiting Approval

Stage "${stage}" is complete and ready for human review${nextStage ? ` before advancing to "${nextStage}"` : ""}.

### Review URL

\`${reviewUrl}\`

### Instructions

1. **Tell the user the URL** — post the review URL above in chat so the user can open it on whichever device they want (the MCP host's browser may not be reachable: remote sessions, headless hosts, SSH-only, mobile clients, etc.).
2. **Call \`haiku_await_gate { intent: "${slug}" }\`** — this blocks until the user submits the review (Approve / Request Changes / External Review). The tool will also try to launch the URL in the default browser; pass \`auto_open: false\` if you only want the user to use their own device.${sessionId ? `\n3. *Session ID for this review: \`${sessionId}\` — included for diagnostics; haiku_await_gate finds it automatically.*` : ""}

When the user decides, the await tool returns the next orchestrator action (advance_stage, changes_requested, external_review_requested, etc.) along with the instructions to follow next.`
})
