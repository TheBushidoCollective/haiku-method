// statusline-links.test.mjs — the haikumethod.ai deep-link builders + the
// OSC 8 hyperlink wrapping in the renderer.
//
// URL formats mirror the website's real routes (keyword-delimited browse
// paths with trailing slashes; see website/lib/browse/url.ts). DEFINITION
// links (studio, stage) are repo-independent; INSTANCE links (intent, unit,
// feedback) need the repo's origin coords and return null without them.

import assert from "node:assert/strict"
import { test } from "node:test"

const links = await import("../src/statusline/links.ts")
const { renderStatusline } = await import("../src/statusline/render.ts")

const REPO = { host: "github.com", owner: "gigsmart", repo: "haiku-method" }
const B = "https://haikumethod.ai"

test("studioDefUrl → static studios route", () => {
	assert.equal(links.studioDefUrl("software"), `${B}/studios/software/`)
	assert.equal(links.studioDefUrl(""), null)
})

test("stageDefUrl → stage def within the studio", () => {
	assert.equal(
		links.stageDefUrl("software", "development"),
		`${B}/studios/software/stages/development/`,
	)
	assert.equal(links.stageDefUrl("software", ""), null)
	assert.equal(links.stageDefUrl("", "development"), null)
})

test("intentBrowseUrl → browse SPA path keyed on origin", () => {
	assert.equal(
		links.intentBrowseUrl(REPO, "my-intent"),
		`${B}/browse/github.com/gigsmart/haiku-method/intent/my-intent/`,
	)
})

test("unitBrowseUrl uses keyword-delimited stage/unit segments", () => {
	assert.equal(
		links.unitBrowseUrl(REPO, "my-intent", "development", "unit-03-foo"),
		`${B}/browse/github.com/gigsmart/haiku-method/intent/my-intent/stage/development/unit/unit-03-foo/`,
	)
})

test("feedbackBrowseUrl — stage-scoped vs intent-scoped", () => {
	assert.equal(
		links.feedbackBrowseUrl(REPO, "my-intent", "development", "FB-007"),
		`${B}/browse/github.com/gigsmart/haiku-method/intent/my-intent/stage/development/feedback/FB-007/`,
	)
	assert.equal(
		links.feedbackBrowseUrl(REPO, "my-intent", "", "FB-007"),
		`${B}/browse/github.com/gigsmart/haiku-method/intent/my-intent/feedback/FB-007/`,
	)
})

test("instance links are null with no repo coords (local-only repo)", () => {
	assert.equal(links.intentBrowseUrl(null, "my-intent"), null)
	assert.equal(links.unitBrowseUrl(null, "my-intent", "dev", "u-01"), null)
	assert.equal(links.feedbackBrowseUrl(null, "my-intent", "dev", "FB-1"), null)
})

test("GitLab subgroup repo path is preserved", () => {
	const gl = { host: "gitlab.com", owner: "group", repo: "sub/proj" }
	assert.equal(
		links.intentBrowseUrl(gl, "i"),
		`${B}/browse/gitlab.com/group/sub/proj/intent/i/`,
	)
})

test("HAIKU_WEB_BASE overrides the host (trailing slash stripped)", () => {
	const prev = process.env.HAIKU_WEB_BASE
	process.env.HAIKU_WEB_BASE = "http://localhost:3000/"
	try {
		assert.equal(
			links.studioDefUrl("software"),
			"http://localhost:3000/studios/software/",
		)
		assert.equal(
			links.intentBrowseUrl(REPO, "i"),
			"http://localhost:3000/browse/github.com/gigsmart/haiku-method/intent/i/",
		)
	} finally {
		if (prev === undefined) delete process.env.HAIKU_WEB_BASE
		else process.env.HAIKU_WEB_BASE = prev
	}
})

// ── renderer OSC 8 wrapping ──

const OSC8_OPEN = "\x1b]8;;"
const BEL = "\x07"

function baseState(over = {}) {
	return {
		intent: "my-intent",
		studio: "software",
		stages: [],
		activeStage: "",
		phaseLabel: "execute",
		phaseKind: "execute",
		gated: false,
		aggregate: "",
		phaseTrack: null,
		...over,
	}
}

test("renderer wraps intent + studio in OSC 8 when URLs present", () => {
	const out = renderStatusline(
		baseState({
			intentUrl: `${B}/browse/github.com/o/r/intent/my-intent/`,
			studioUrl: `${B}/studios/software/`,
		}),
		{ color: false },
	)
	assert.ok(
		out.includes(`${OSC8_OPEN}${B}/studios/software/${BEL}`),
		"studio tag should be an OSC 8 link",
	)
	assert.ok(
		out.includes(
			`${OSC8_OPEN}${B}/browse/github.com/o/r/intent/my-intent/${BEL}`,
		),
		"intent word should be an OSC 8 link",
	)
})

test("renderer emits no OSC 8 when URLs absent (local-only repo)", () => {
	const out = renderStatusline(baseState(), { color: false })
	assert.ok(!out.includes(OSC8_OPEN), "no link wrappers without URLs")
	assert.ok(out.includes("my-intent"))
	assert.ok(out.includes("software"))
})

test("stage hexagons + active stage word link to stage defs", () => {
	const stageUrl = `${B}/studios/software/stages/development/`
	const out = renderStatusline(
		baseState({
			stages: [
				{
					name: "inception",
					status: "done",
					url: `${B}/studios/software/stages/inception/`,
				},
				{ name: "development", status: "active", url: stageUrl },
			],
			activeStage: "development",
		}),
		{ color: false },
	)
	assert.ok(
		out.includes(`${OSC8_OPEN}${B}/studios/software/stages/inception/${BEL}`),
		"done stage hexagon should link",
	)
	const devLinks = out.split(`${OSC8_OPEN}${stageUrl}${BEL}`).length - 1
	assert.ok(
		devLinks >= 2,
		`active stage hexagon + word should both link (saw ${devLinks})`,
	)
})

test("unit/feedback chips link via itemBars url", () => {
	const url = `${B}/browse/github.com/o/r/intent/i/stage/dev/unit/unit-03-foo/`
	const out = renderStatusline(
		baseState({
			itemBars: [{ id: "U-03", segments: ["done", "active"], url }],
		}),
		{ color: false },
	)
	assert.ok(
		out.includes(`${OSC8_OPEN}${url}${BEL}`),
		"unit chip should be an OSC 8 link",
	)
})
