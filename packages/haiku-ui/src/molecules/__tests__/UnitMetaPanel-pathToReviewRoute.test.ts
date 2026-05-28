/**
 * Unit tests for `pathToReviewRoute` — the path-shape parser that
 * powers the clickable-links upgrade in `UnitMetaPanel`. Pre-fix the
 * paths were inert text; the regex branches need their own coverage
 * because the bigger SPA test suite only exercises the happy path.
 */

import { describe, expect, it } from "vitest"
import { type ArtifactIndex, pathToReviewRoute } from "../UnitMetaPanel"

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

describe("pathToReviewRoute — artifact-index resolution (Fix 5)", () => {
	// Mirrors the index StageReview builds from the session's
	// output_artifacts / stage_artifacts / other_files. The KEY is the
	// artifact's intent-dir-relative path (== its `name`); the value is the
	// producing stage + route kind. These are the paths that used to fall
	// through to inert gray text — `product/*` discovery artifacts and
	// repo-relative outputs whose string carries no stage segment.
	const index: ArtifactIndex = new Map([
		[
			"product/ACCEPTANCE-CRITERIA.md",
			{ stage: "product", kind: "outputs", name: "product/ACCEPTANCE-CRITERIA.md" },
		],
		[
			"product/DATA-CONTRACTS.md",
			{ stage: "product", kind: "outputs", name: "product/DATA-CONTRACTS.md" },
		],
		[
			"features/worker_new_badge.feature",
			{
				stage: "development",
				kind: "outputs",
				name: "features/worker_new_badge.feature",
			},
		],
	])

	it("resolves an intent-relative discovery artifact to its producing stage", () => {
		// `product/` is NOT a `stages/` path and NOT `knowledge/`; the shape
		// rules can't claim it. The index says product-stage produced it.
		expect(
			pathToReviewRoute("product/ACCEPTANCE-CRITERIA.md", "development", index),
		).toEqual({
			stage: "product",
			kind: "outputs",
			name: "product/ACCEPTANCE-CRITERIA.md",
		})
	})

	it("resolves a repo-relative .feature output to its producing stage", () => {
		expect(
			pathToReviewRoute("features/worker_new_badge.feature", "development", index),
		).toEqual({
			stage: "development",
			kind: "outputs",
			name: "features/worker_new_badge.feature",
		})
	})

	it("tolerates a workspace-relative .haiku/intents/<slug>/ prefix", () => {
		expect(
			pathToReviewRoute(
				".haiku/intents/my-intent/product/DATA-CONTRACTS.md",
				"development",
				index,
			),
		).toEqual({
			stage: "product",
			kind: "outputs",
			name: "product/DATA-CONTRACTS.md",
		})
	})

	it("shape rules still win over the index for stages/-rooted paths", () => {
		// Even with an index present, a `stages/<stage>/artifacts/...` path
		// resolves via the shape rule (its stage is in the string).
		expect(
			pathToReviewRoute("stages/design/artifacts/spec.md", "development", index),
		).toEqual({ stage: "design", kind: "outputs", name: "spec.md" })
	})

	it("a path not in the index (and not shape-routable) → null", () => {
		// No backing artifact and no recognizable shape → plain text fallback.
		expect(
			pathToReviewRoute("features/never-produced.feature", "development", index),
		).toBeNull()
	})

	it("no index → unresolvable intent-relative path stays null", () => {
		expect(
			pathToReviewRoute("product/ACCEPTANCE-CRITERIA.md", "development"),
		).toBeNull()
	})
})
