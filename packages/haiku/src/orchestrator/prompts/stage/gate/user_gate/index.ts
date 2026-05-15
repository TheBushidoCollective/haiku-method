// orchestrator/prompts/user_gate/index.ts — v4 user-gate prompt.
//
// Cursor returns `user_gate { stage, gate_kind: "spec" | "approval", units }`
// when the human's `reviews.user` (spec gate, pre-execute) or
// `approvals.user` (output gate, post-execute) is the next missing
// signature on one or more units. The agent opens the review server
// session and blocks on the user's decision via haiku_await_gate.
//
// Mode-shaping happens upstream — autopilot intents skip the user
// role entirely and never see this action.
//
// Discrete vs continuous: in discrete mode the user_gate's await_gate
// flow opens a real GitHub MR for the stage branch and waits for the
// merge into intent main as the approval signal. In continuous mode
// the local review server is the approval surface. The discrete-mode
// branch lives inside haiku_await_gate's existing logic.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""
	const gateKind = (action.gate_kind as "spec" | "approval") || "approval"
	const units = (action.units as string[]) || []
	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		gateKind,
		units,
		unitCount: units.length,
		unitsJson: JSON.stringify(units),
	})
})
