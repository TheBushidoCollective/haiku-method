#!/usr/bin/env npx tsx
// review-open-gate-kind-schema.test.mjs — Coverage for the
// `gate_kind` + `units` fields on haiku_review_open.
//
// The v4 user_gate cursor action's prompt instructs the agent to call
// `haiku_review_open { intent, stage, gate_kind: "spec" | "approval" }`
// — but the original schema set `additionalProperties: false` without
// declaring gate_kind, so every workflow user_gate call AJV-rejected
// before the handler ran. That's the schema half of Bug C ("user_gate
// closes immediately without user input").
//
// This test pins the schema:
//   1. Accepts gate_kind ∈ {spec, approval} + units array.
//   2. Rejects unknown gate_kind values.
//   3. Continues to accept the bare ad-hoc shape (no gate_kind).

import assert from "node:assert"
import { test } from "node:test"

import { validateHaikuReviewOpenInputSchema } from "../src/state/schemas/index.ts"

test("haiku_review_open accepts gate_kind=spec + units", () => {
	const ok = validateHaikuReviewOpenInputSchema({
		intent: "my-intent",
		stage: "design",
		gate_kind: "spec",
		units: ["unit-01", "unit-02"],
	})
	assert.strictEqual(
		ok,
		true,
		`expected schema to accept user-gate spec call, got errors: ${JSON.stringify(validateHaikuReviewOpenInputSchema.errors)}`,
	)
})

test("haiku_review_open accepts gate_kind=approval + units", () => {
	const ok = validateHaikuReviewOpenInputSchema({
		intent: "my-intent",
		stage: "design",
		gate_kind: "approval",
		units: ["unit-01"],
	})
	assert.strictEqual(
		ok,
		true,
		`expected schema to accept user-gate approval call, got errors: ${JSON.stringify(validateHaikuReviewOpenInputSchema.errors)}`,
	)
})

test("haiku_review_open rejects gate_kind=user (not a valid value)", () => {
	const ok = validateHaikuReviewOpenInputSchema({
		intent: "my-intent",
		gate_kind: "user",
	})
	assert.strictEqual(
		ok,
		false,
		"expected schema to reject gate_kind='user' — only spec/approval are valid",
	)
})

test("haiku_review_open still accepts the bare ad-hoc shape (no gate_kind)", () => {
	const ok = validateHaikuReviewOpenInputSchema({
		intent: "my-intent",
		stage: "design",
	})
	assert.strictEqual(
		ok,
		true,
		`expected schema to accept ad-hoc call, got errors: ${JSON.stringify(validateHaikuReviewOpenInputSchema.errors)}`,
	)
})

test("haiku_review_open accepts gate_kind without units (optional)", () => {
	const ok = validateHaikuReviewOpenInputSchema({
		intent: "my-intent",
		gate_kind: "spec",
	})
	assert.strictEqual(
		ok,
		true,
		"units is optional — agents that don't pass units should still validate",
	)
})

test("haiku_review_open still rejects unknown top-level fields (additionalProperties: false)", () => {
	const ok = validateHaikuReviewOpenInputSchema({
		intent: "my-intent",
		gate_kind: "spec",
		// not in schema:
		bogus: "yes",
	})
	assert.strictEqual(
		ok,
		false,
		"strict typespec: unknown fields must still be rejected",
	)
})
