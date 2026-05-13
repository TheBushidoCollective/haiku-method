/**
 * Tests for `composeWalkthroughItems` — the pure function that picks
 * the relevant set of items for the StageReview walkthrough based on
 * which gate fired.
 *
 * The mapping is load-bearing for the user-facing review flow
 * (2026-05-13 contract — "only review what's relevant"):
 *   - pre-exec gates (`elaborate_to_execute`, `intent_review`) → units only
 *   - post-exec gates (`stage_gate`, `intent_completion`) → outputs only
 *   - ad-hoc / undefined / unknown gate context → outputs when any
 *     exist (post-execute review), else units (pre-execute review).
 *   - knowledge is never in the walkthrough — it's informational, not
 *     gate-relevant. Reachable through the Knowledge tab, not via
 *     prev/next.
 */

import { describe, expect, it } from "vitest"
import {
	composeWalkthroughItems,
	resolveWalkthroughForDetail,
} from "../walkthrough"

const inputs = {
	units: [{ slug: "unit-01-acceptance" }, { slug: "unit-02-design" }],
	knowledgeVMs: [{ name: "DISCOVERY" }, { name: "knowledge/UPLOAD-FLOW" }],
	outputVMs: [{ name: "ARCHITECTURE" }, { name: "wireframes/foo" }],
}

describe("composeWalkthroughItems", () => {
	it("elaborate_to_execute → units only", () => {
		const items = composeWalkthroughItems("elaborate_to_execute", inputs)
		expect(items.map((i) => i.tab)).toEqual(["units", "units"])
		expect(items.map((i) => i.name)).toEqual([
			"unit-01-acceptance",
			"unit-02-design",
		])
	})

	it("stage_gate → outputs only", () => {
		const items = composeWalkthroughItems("stage_gate", inputs)
		expect(items.map((i) => i.tab)).toEqual(["outputs", "outputs"])
		expect(items.map((i) => i.name)).toEqual(["ARCHITECTURE", "wireframes/foo"])
	})

	it("intent_completion → outputs only", () => {
		const items = composeWalkthroughItems("intent_completion", inputs)
		expect(items.map((i) => i.tab)).toEqual(["outputs", "outputs"])
		expect(items.map((i) => i.name)).toEqual(["ARCHITECTURE", "wireframes/foo"])
	})

	it("intent_review → units only (pre-execute)", () => {
		const items = composeWalkthroughItems("intent_review", inputs)
		expect(items.map((i) => i.tab)).toEqual(["units", "units"])
		expect(items.map((i) => i.name)).toEqual([
			"unit-01-acceptance",
			"unit-02-design",
		])
	})

	it("undefined gate context with outputs present → outputs only (ad-hoc post-execute review)", () => {
		const items = composeWalkthroughItems(undefined, inputs)
		expect(items.map((i) => i.tab)).toEqual(["outputs", "outputs"])
		expect(items.map((i) => i.name)).toEqual(["ARCHITECTURE", "wireframes/foo"])
	})

	it("undefined gate context with no outputs → units only (ad-hoc pre-execute review)", () => {
		const items = composeWalkthroughItems(undefined, {
			...inputs,
			outputVMs: [],
		})
		expect(items.map((i) => i.tab)).toEqual(["units", "units"])
	})

	it("unknown gate context with outputs → outputs only (same shape as ad-hoc post-execute)", () => {
		const items = composeWalkthroughItems(
			"future_gate_we_dont_know_about",
			inputs,
		)
		expect(items.map((i) => i.tab)).toEqual(["outputs", "outputs"])
	})

	it("knowledge is never in the walkthrough regardless of gate context", () => {
		for (const ctx of [
			undefined,
			"elaborate_to_execute",
			"intent_review",
			"stage_gate",
			"intent_completion",
			"future_unknown",
		]) {
			const items = composeWalkthroughItems(ctx, inputs)
			expect(items.every((i) => i.tab !== "knowledge")).toBe(true)
		}
	})

	it("empty inputs produce empty output regardless of gate context", () => {
		const empty = { units: [], knowledgeVMs: [], outputVMs: [] }
		expect(composeWalkthroughItems("elaborate_to_execute", empty)).toEqual([])
		expect(composeWalkthroughItems("stage_gate", empty)).toEqual([])
		expect(composeWalkthroughItems(undefined, empty)).toEqual([])
	})
})

describe("resolveWalkthroughForDetail (UX fallback for off-tab browsing)", () => {
	const gateUnits = composeWalkthroughItems("elaborate_to_execute", inputs)
	const gateOutputs = composeWalkthroughItems("stage_gate", inputs)

	it("returns gate items when no detail is open", () => {
		expect(resolveWalkthroughForDetail(gateUnits, null, inputs)).toEqual(
			gateUnits,
		)
	})

	it("returns gate items when current detail IS in the gate set", () => {
		const out = resolveWalkthroughForDetail(
			gateUnits,
			{ tab: "units", name: "unit-01-acceptance" },
			inputs,
		)
		expect(out).toEqual(gateUnits)
	})

	it("falls back to tab-scoped knowledge walk when reviewer browses Knowledge during a units-only gate", () => {
		const out = resolveWalkthroughForDetail(
			gateUnits,
			{ tab: "knowledge", name: "DISCOVERY" },
			inputs,
		)
		expect(out.map((i) => i.tab)).toEqual(["knowledge", "knowledge"])
		expect(out.map((i) => i.name)).toEqual([
			"DISCOVERY",
			"knowledge/UPLOAD-FLOW",
		])
	})

	it("falls back to tab-scoped outputs walk when reviewer browses Outputs during a units-only gate", () => {
		const out = resolveWalkthroughForDetail(
			gateUnits,
			{ tab: "outputs", name: "ARCHITECTURE" },
			inputs,
		)
		expect(out.map((i) => i.tab)).toEqual(["outputs", "outputs"])
		expect(out.map((i) => i.name)).toEqual(["ARCHITECTURE", "wireframes/foo"])
	})

	it("falls back to tab-scoped units walk when reviewer browses Units during an outputs-only gate", () => {
		const out = resolveWalkthroughForDetail(
			gateOutputs,
			{ tab: "units", name: "unit-02-design" },
			inputs,
		)
		expect(out.map((i) => i.tab)).toEqual(["units", "units"])
		expect(out.map((i) => i.name)).toEqual([
			"unit-01-acceptance",
			"unit-02-design",
		])
	})

	it("returns empty fallback when current tab has no items", () => {
		const out = resolveWalkthroughForDetail(
			gateUnits,
			{ tab: "knowledge", name: "missing" },
			{ ...inputs, knowledgeVMs: [] },
		)
		expect(out).toEqual([])
	})
})
