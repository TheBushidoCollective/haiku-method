#!/usr/bin/env npx tsx
// Smoke tests for the four prompt builders that were reinstated to
// close the engine-emit-but-no-prompt gap surfaced by the v4 prompts
// audit (2026-05-14): coverage_review_required,
// output_liveness_review_required, external_review_requested,
// revise_unit_specs.
//
// Each is a thin <%= message %> wrapper around the action's
// pre-composed `message` field. These tests assert the registry
// resolves each action name AND the builder renders without throwing,
// produces a markdown heading, and embeds the message verbatim.

import assert from "node:assert/strict"
import { test } from "node:test"

const { actionPromptBuilders } = await import(
	"../src/orchestrator/prompts/index.ts"
)

const cases = [
	{
		action: "coverage_review_required",
		heading: "## Coverage Review Required",
		// Sample message shape from validators.ts.
		message:
			"Cannot advance past elaborate: 2 prior-stage output(s) are not referenced by any unit's `inputs:` in stage 'design'.",
	},
	{
		action: "output_liveness_review_required",
		heading: "## Output Liveness Review Required",
		message:
			"Cannot advance to intent-completion review: 1 code-output(s) shipped by units across this intent's stages have NO referencers anywhere in the repo.",
	},
	{
		action: "external_review_requested",
		heading: "## External Review Requested",
		message:
			"The user routed stage 'design' to external review. Submit the work for review through your project's review process.",
	},
	{
		action: "revise_unit_specs",
		heading: "## Revise Unit Specs",
		message:
			"The user requested changes on stage 'design' unit specs: tighten the scope on unit-001.",
	},
]

for (const c of cases) {
	test(`${c.action} prompt is registered + renders the message`, () => {
		const builder = actionPromptBuilders.get(c.action)
		assert.ok(builder, `registry missing builder for action: ${c.action}`)
		const body = builder({
			slug: "test-intent",
			studio: "software",
			dir: "/tmp/test-intent",
			action: { action: c.action, message: c.message },
		})
		assert.ok(body, `${c.action} returned null/undefined`)
		assert.ok(
			body.includes(c.heading),
			`${c.action} body missing heading "${c.heading}". Got:\n${body}`,
		)
		assert.ok(
			body.includes(c.message),
			`${c.action} body missing message. Got:\n${body}`,
		)
	})
}
