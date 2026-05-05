// tools/orchestrator/_announce.ts — Shared helper for post-decision
// announcements.
//
// Whenever a user makes a decision via elicitation, visual question,
// or gate review, the agent should announce that decision back in
// the chat thread before driving to the next workflow step. Without
// an explicit instruction, agents tend to silently consume the
// decision and immediately call the next tool — leaving the user
// staring at a "thinking" indicator with no indication that their
// input was registered.
//
// The contract is deliberately simple: we prepend a single imperative
// line ("**ANNOUNCE TO USER**: …") to the existing tool response
// message. Stable named field for tests / agents to match on, no
// schema churn — every existing message string keeps working, just
// gets prefixed.
//
// Pairs with the post-decision return paths in haiku_select_studio,
// haiku_select_mode, haiku_select_stage, haiku_await_gate, and the
// visual-question / design-direction handlers in server/tool-call.ts.

const PREFIX = "**ANNOUNCE TO USER (post in chat now):**"

// Returns a message that leads with the stable ANNOUNCE directive +
// `announcement`, then `nextStep`. Agents and tests match on the
// token; the structural split lets callers keep user-facing prose
// and next-action instructions separate at the call site.
export function withAnnouncement(
	announcement: string,
	nextStep: string,
): string {
	return `${PREFIX} ${announcement}\n\n${nextStep}`
}
