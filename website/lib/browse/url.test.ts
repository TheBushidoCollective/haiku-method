import { describe, expect, it } from "vitest"
import { buildBrowseUrl, parseBrowsePath } from "./url"

// parseBrowsePath takes the Next.js catch-all segment ARRAY (not a pathname);
// buildBrowseUrl returns a trailing-slash keyword path. Coverage focuses on
// the feedback deep links added for the statusline feedback chips, plus the
// pre-existing intent/stage/unit shapes they must not regress.

describe("parseBrowsePath — project / intent / stage / unit", () => {
	it("project-only", () => {
		expect(parseBrowsePath(["github.com", "org", "repo"])).toEqual({
			host: "github.com",
			project: "org/repo",
		})
	})

	it("intent / stage / unit (keyword form)", () => {
		expect(
			parseBrowsePath([
				"github.com",
				"org",
				"repo",
				"intent",
				"my-feature",
				"stage",
				"dev",
				"unit",
				"unit-01",
			]),
		).toEqual({
			host: "github.com",
			project: "org/repo",
			intent: "my-feature",
			stage: "dev",
			unit: "unit-01",
		})
	})
})

describe("parseBrowsePath — feedback deep links", () => {
	it("stage-scoped feedback", () => {
		expect(
			parseBrowsePath([
				"github.com",
				"org",
				"repo",
				"intent",
				"my-feature",
				"stage",
				"dev",
				"feedback",
				"FB-007",
			]),
		).toEqual({
			host: "github.com",
			project: "org/repo",
			intent: "my-feature",
			stage: "dev",
			feedback: "FB-007",
		})
	})

	it("intent-scoped feedback (no stage)", () => {
		expect(
			parseBrowsePath([
				"github.com",
				"org",
				"repo",
				"intent",
				"my-feature",
				"feedback",
				"FB-007",
			]),
		).toEqual({
			host: "github.com",
			project: "org/repo",
			intent: "my-feature",
			feedback: "FB-007",
		})
	})

	it("a feedback id is never mis-parsed as a unit", () => {
		const loc = parseBrowsePath([
			"github.com",
			"org",
			"repo",
			"intent",
			"i",
			"stage",
			"dev",
			"feedback",
			"FB-1",
		])
		expect(loc?.unit).toBeUndefined()
		expect(loc?.feedback).toBe("FB-1")
		expect(loc?.stage).toBe("dev")
	})

	it("GitLab subgroup project path is preserved", () => {
		expect(
			parseBrowsePath([
				"gitlab.com",
				"group",
				"sub",
				"proj",
				"intent",
				"i",
				"feedback",
				"FB-2",
			]),
		).toEqual({
			host: "gitlab.com",
			project: "group/sub/proj",
			intent: "i",
			feedback: "FB-2",
		})
	})
})

describe("buildBrowseUrl — feedback", () => {
	it("round-trips a stage-scoped feedback URL", () => {
		const url = buildBrowseUrl({
			host: "github.com",
			project: "org/repo",
			intent: "my-feature",
			stage: "dev",
			feedback: "FB-007",
		})
		expect(url).toBe(
			"/browse/github.com/org/repo/intent/my-feature/stage/dev/feedback/FB-007/",
		)
		const back = parseBrowsePath(url.replace(/^\/browse\/|\/$/g, "").split("/"))
		expect(back?.feedback).toBe("FB-007")
		expect(back?.stage).toBe("dev")
	})

	it("round-trips an intent-scoped feedback URL", () => {
		const url = buildBrowseUrl({
			host: "github.com",
			project: "org/repo",
			intent: "my-feature",
			feedback: "FB-007",
		})
		expect(url).toBe(
			"/browse/github.com/org/repo/intent/my-feature/feedback/FB-007/",
		)
	})

	it("feedback takes precedence over unit in the builder", () => {
		const url = buildBrowseUrl({
			host: "h",
			project: "p",
			intent: "i",
			stage: "s",
			unit: "unit-01",
			feedback: "FB-1",
		})
		expect(url).toBe("/browse/h/p/intent/i/stage/s/feedback/FB-1/")
	})
})
