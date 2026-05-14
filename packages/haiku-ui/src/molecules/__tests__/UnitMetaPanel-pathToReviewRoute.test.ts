/**
 * Unit tests for `pathToReviewRoute` — the path-shape parser that
 * powers the clickable-links upgrade in `UnitMetaPanel`. Pre-fix the
 * paths were inert text; the regex branches need their own coverage
 * because the bigger SPA test suite only exercises the happy path.
 */

import { describe, expect, it } from "vitest"
import { pathToReviewRoute } from "../UnitMetaPanel"

describe("pathToReviewRoute", () => {
	it("bare unit name → units kind at current stage", () => {
		expect(pathToReviewRoute("unit-01-foo", "design")).toEqual({
			stage: "design",
			kind: "units",
			name: "unit-01-foo",
		})
	})

	it("knowledge/<NAME>.md → knowledge kind", () => {
		expect(pathToReviewRoute("knowledge/DISCOVERY.md", "design")).toEqual({
			stage: "design",
			kind: "knowledge",
			name: "DISCOVERY.md",
		})
	})

	it("stages/<stage>/units/<unit>.md → units kind at the source stage", () => {
		expect(
			pathToReviewRoute("stages/inception/units/unit-01-personas.md", "design"),
		).toEqual({
			stage: "inception",
			kind: "units",
			name: "unit-01-personas",
		})
	})

	it("stages/<stage>/units/<unit> without .md still routes", () => {
		expect(
			pathToReviewRoute("stages/inception/units/unit-01-foo", "design"),
		).toEqual({
			stage: "inception",
			kind: "units",
			name: "unit-01-foo",
		})
	})

	it("stages/<stage>/artifacts/<file> → outputs kind", () => {
		expect(
			pathToReviewRoute("stages/design/artifacts/02-spec.md", "design"),
		).toEqual({
			stage: "design",
			kind: "outputs",
			name: "02-spec.md",
		})
	})

	it("stages/<stage>/<file> (root-level stage file) → other kind", () => {
		expect(
			pathToReviewRoute("stages/design/DESIGN-BRIEF.md", "design"),
		).toEqual({
			stage: "design",
			kind: "other",
			name: "DESIGN-BRIEF.md",
		})
	})

	it("non-routable path → null (caller falls back to plain text)", () => {
		expect(pathToReviewRoute("/absolute/garbage", "design")).toBeNull()
		expect(pathToReviewRoute("../escape", "design")).toBeNull()
		expect(pathToReviewRoute("random-name-no-prefix", "design")).toBeNull()
	})

	it("bare non-unit name → null", () => {
		// Only `unit-*` bare names route; anything else is too ambiguous.
		expect(pathToReviewRoute("DISCOVERY.md", "design")).toBeNull()
	})

	it("stages/<stage> with no trailing path → null", () => {
		expect(pathToReviewRoute("stages/design", "design")).toBeNull()
	})

	it("stages/<stage>/ (trailing slash, no file) → null", () => {
		expect(pathToReviewRoute("stages/design/", "design")).toBeNull()
	})

	it("currentStage only used when the path doesn't carry its own", () => {
		// Path is fully qualified — currentStage is irrelevant.
		expect(
			pathToReviewRoute("stages/inception/artifacts/foo.md", "design"),
		).toEqual({ stage: "inception", kind: "outputs", name: "foo.md" })
		// Path is a bare unit name — currentStage IS used.
		expect(pathToReviewRoute("unit-99-bar", "operations")).toEqual({
			stage: "operations",
			kind: "units",
			name: "unit-99-bar",
		})
	})
})
