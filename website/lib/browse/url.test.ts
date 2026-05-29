import { describe, expect, it } from "vitest"
import { buildBrowseUrl, parseBrowsePath } from "./url"

describe("parseBrowsePath", () => {
	it("parses project-only", () => {
		expect(parseBrowsePath("/browse/github.com/acme/widgets")).toEqual({
			host: "github.com",
			project: "acme/widgets",
		})
	})

	it("parses intent / stage / unit", () => {
		expect(
			parseBrowsePath(
				"/browse/github.com/acme/widgets/intent/my-feature/design/unit-01-foo",
			),
		).toEqual({
			host: "github.com",
			project: "acme/widgets",
			intent: "my-feature",
			stage: "design",
			unit: "unit-01-foo",
		})
	})

	it("parses a stage-scoped feedback deep link", () => {
		expect(
			parseBrowsePath(
				"/browse/github.com/acme/widgets/intent/my-feature/design/feedback/FB-007",
			),
		).toEqual({
			host: "github.com",
			project: "acme/widgets",
			intent: "my-feature",
			stage: "design",
			feedback: "FB-007",
		})
	})

	it("parses an intent-scoped feedback deep link (no stage)", () => {
		expect(
			parseBrowsePath(
				"/browse/github.com/acme/widgets/intent/my-feature/feedback/FB-007",
			),
		).toEqual({
			host: "github.com",
			project: "acme/widgets",
			intent: "my-feature",
			feedback: "FB-007",
		})
	})

	it("a feedback id is never mistaken for a unit", () => {
		const loc = parseBrowsePath(
			"/browse/github.com/acme/widgets/intent/i/dev/feedback/FB-1",
		)
		expect(loc?.unit).toBeUndefined()
		expect(loc?.feedback).toBe("FB-1")
		expect(loc?.stage).toBe("dev")
	})
})

describe("buildBrowseUrl", () => {
	it("round-trips a stage-scoped feedback URL", () => {
		const url = buildBrowseUrl({
			host: "github.com",
			project: "acme/widgets",
			intent: "my-feature",
			stage: "design",
			feedback: "FB-007",
		})
		expect(url).toBe(
			"/browse/github.com/acme/widgets/intent/my-feature/design/feedback/FB-007",
		)
		expect(parseBrowsePath(url)?.feedback).toBe("FB-007")
	})

	it("round-trips an intent-scoped feedback URL", () => {
		const url = buildBrowseUrl({
			host: "github.com",
			project: "acme/widgets",
			intent: "my-feature",
			feedback: "FB-007",
		})
		expect(url).toBe(
			"/browse/github.com/acme/widgets/intent/my-feature/feedback/FB-007",
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
		expect(url).toBe("/browse/h/p/intent/i/s/feedback/FB-1")
	})
})
