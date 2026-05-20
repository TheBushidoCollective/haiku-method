// statusline.test.mjs — the `haiku statusline` subcommand: pure
// renderer, disk state resolution, install/uninstall round-trip, and
// fallback chaining when there's no active intent.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

// ── renderer (pure) ──────────────────────────────────────────────────

test("renderStatusline: plain (NO_COLOR) execute line has the expected glyphs", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	// Base layout, no studio tag and no phase track (set explicitly null).
	const line = renderStatusline(
		{
			intent: "demo",
			studio: "",
			stages: [
				{ name: "inception", status: "done" },
				{ name: "design", status: "active" },
				{ name: "product", status: "pending" },
			],
			activeStage: "design",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "3/7 units",
			phaseTrack: null,
		},
		{ color: false },
	)
	assert.equal(line, "H·AI·K·U ⬢ demo · ⬢⬣⬡ design ❯ execute · 3/7 units")
})

test("renderStatusline: studio tag + phase track render", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [
				{ name: "inception", status: "done" },
				{ name: "design", status: "active" },
				{ name: "product", status: "pending" },
			],
			activeStage: "design",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "3/7 units",
			phaseTrack: { index: 2, total: 4 }, // execute = phase 3 of 4
		},
		{ color: false },
	)
	// studio tag present; the 4-pip phase bar sits to the RIGHT of the
	// stage word (not between hexes), 3 filled (▰▰▰) + 1 pending (▱).
	assert.equal(
		line,
		"H·AI·K·U ⬢ demo · software · ⬢⬣⬡ design ▰▰▰▱ ❯ execute · 3/7 units",
	)
})

test("renderStatusline: post-stage band — 3-pip bar after the intent scope label", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "ship",
			studio: "software",
			stages: [
				{ name: "inception", status: "done" },
				{ name: "design", status: "done" },
			],
			activeStage: "",
			phaseLabel: "intent review",
			phaseKind: "review",
			gated: false,
			aggregate: "",
			phaseTrack: { index: 0, total: 3 },
		},
		{ color: false },
	)
	assert.equal(line, "H·AI·K·U ⬢ ship · software · ⬢⬢ intent ▰▱▱ ❯ intent review")
})

test("renderStatusline: intent-level setup phase (no stage, no track)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "new-thing",
			studio: "",
			stages: [],
			activeStage: "",
			phaseLabel: "select studio",
			phaseKind: "setup",
			gated: false,
			aggregate: "",
			phaseTrack: null,
		},
		{ color: false },
	)
	assert.equal(line, "H·AI·K·U ⬢ new-thing · intent ❯ select studio")
})

test("renderStatusline: gated line uses ⊘ and keeps the active hexagon", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "design", status: "active" }],
			activeStage: "design",
			phaseLabel: "approval gate",
			phaseKind: "gate",
			gated: true,
			aggregate: "8 units",
			phaseTrack: { index: 3, total: 4 },
		},
		{ color: false },
	)
	assert.match(line, /design .*⊘ approval gate/)
	assert.ok(!line.includes("❯"), "gated line must not use the flow glyph")
})

test("renderStatusline: color mode emits ANSI; gate goes magenta (38;5;170)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "design", status: "active" }],
			activeStage: "design",
			phaseLabel: "approval gate",
			phaseKind: "gate",
			gated: true,
			aggregate: "",
			phaseTrack: { index: 3, total: 4 },
		},
		{ color: true },
	)
	assert.ok(line.includes("\x1b[38;5;170m"), "gate phase should be magenta")
	assert.ok(line.includes("\x1b[0m"), "should reset")
})

test("renderStatusline: fix-loop shows the actual position struck-through, left of 'fix-loop' (NO_COLOR)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const struck = Array.from("approval gate")
		.map((ch) => `${ch}\u0336`)
		.join("")
	const line = renderStatusline(
		{
			intent: "churn",
			studio: "software",
			stages: [
				{ name: "inception", status: "done" },
				{ name: "design", status: "done" },
				{ name: "security", status: "active" },
			],
			activeStage: "security",
			phaseLabel: "fix-loop",
			phaseKind: "fixloop",
			gated: false,
			aggregate: "2 open",
			phaseTrack: { index: 1, total: 4 },
			actualPhase: "approval gate",
		},
		{ color: false },
	)
	assert.equal(
		line,
		`H·AI·K·U ⬢ churn · software · ⬢⬢⬣ security ▰▰▱▱ ❯ ${struck} fix-loop · 2 open`,
	)
})

test("renderStatusline: fix-loop struck position uses ANSI strikethrough (SGR 9) in color mode", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "churn",
			studio: "software",
			stages: [{ name: "security", status: "active" }],
			activeStage: "security",
			phaseLabel: "fix-loop",
			phaseKind: "fixloop",
			gated: false,
			aggregate: "2 open",
			phaseTrack: { index: 1, total: 4 },
			actualPhase: "approval gate",
		},
		{ color: true },
	)
	assert.ok(line.includes("\x1b[9m"), "actual position should be struck (SGR 9)")
	assert.ok(
		line.indexOf("approval gate") < line.indexOf("fix-loop"),
		"struck actual position must sit left of the 'fix-loop' word",
	)
})

test("renderStatusline: non-fix-loop phase never renders a struck position", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const line = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "design", status: "active" }],
			activeStage: "design",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "3/7 units",
			phaseTrack: { index: 2, total: 4 },
			// actualPhase set but ignored — only fix-loop surfaces it.
			actualPhase: "execute",
		},
		{ color: true },
	)
	assert.ok(!line.includes("\x1b[9m"), "non-fix-loop must not strike anything")
})

// ── state resolution (disk) ──────────────────────────────────────────

function seedIntent(repoRoot, slug, stage, opts = {}) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Statusline intent",
			studio: "software",
			mode: "continuous",
			stages: [stage],
			...(opts.sealed ? { sealed_at: "2026-05-19T00:00:00Z" } : {}),
		}),
	)
	// Wave-ready unit so findCurrentStage pins the stage (execute phase).
	writeFileSync(
		join(stageDir, "units", "unit-01-stub.md"),
		matter.stringify("unit\n", {
			title: "stub",
			inputs: [],
			iterations: [],
			reviews: {},
			approvals: {},
		}),
	)
	return { intentDir, stageDir }
}

test("resolveStatuslineState: live intent yields intent + active stage", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-state-"))
	const orig = process.cwd()
	try {
		const slug = "sl-live"
		seedIntent(repoRoot, slug, "security")
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		const state = resolveStatuslineState()
		assert.ok(state, "expected a state for a live intent")
		assert.equal(state.intent, slug)
		assert.equal(state.activeStage, "security")
		assert.ok(
			state.stages.some((s) => s.status === "active"),
			"pipeline must mark the active stage",
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("resolveStatuslineState: sealed intent returns null (fall back to OG line)", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-sealed-"))
	const orig = process.cwd()
	try {
		seedIntent(repoRoot, "sl-sealed", "security", { sealed: true })
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		assert.equal(
			resolveStatuslineState(),
			null,
			"sealed intent must yield null so the OG status line shows",
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("resolveStatuslineState: no .haiku/ returns null", async () => {
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-none-"))
	const orig = process.cwd()
	try {
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		assert.equal(resolveStatuslineState(), null)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

// ── fallback resolution (chain back through settings + saved record) ──

/** Build a temp project root (+ .haiku) and a temp home, returning paths
 *  and small writers for each settings file + the saved fallback record. */
function fallbackFixture(tag) {
	const root = mkdtempSync(join(tmpdir(), `haiku-sl-fb-${tag}-`))
	const home = mkdtempSync(join(tmpdir(), `haiku-sl-fbhome-${tag}-`))
	mkdirSync(join(root, ".haiku"), { recursive: true })
	const writeSettings = (path, statusLine) => {
		mkdirSync(dirname(path), { recursive: true })
		writeFileSync(path, JSON.stringify(statusLine ? { statusLine } : {}, null, 2))
	}
	return {
		root,
		home,
		projectSettings: join(root, ".claude", "settings.json"),
		projectLocal: join(root, ".claude", "settings.local.json"),
		userSettings: join(home, ".claude", "settings.json"),
		record: join(root, ".haiku", "statusline-fallback.json"),
		writeSettings,
		writeRecord: (statusLine) =>
			writeFileSync(
				join(root, ".haiku", "statusline-fallback.json"),
				JSON.stringify({ statusLine }, null, 2),
			),
		cleanup: () => {
			rmSync(root, { recursive: true, force: true })
			rmSync(home, { recursive: true, force: true })
		},
	}
}

const CMD = (command) => ({ type: "command", command })

test("resolveFallbackCommand: a user's project statusLine wins over the saved record", async () => {
	const { resolveFallbackCommand } = await import(`${SRC}statusline/index.ts`)
	const fx = fallbackFixture("proj")
	try {
		// haiku installed globally (user settings = our command), saved a
		// global original. The project keeps its own real line.
		fx.writeSettings(fx.userSettings, CMD("npx -y @haiku/haiku statusline"))
		fx.writeRecord(CMD("old-global-prompt"))
		fx.writeSettings(fx.projectSettings, CMD("project-prompt --x"))
		assert.equal(
			resolveFallbackCommand(fx.root, fx.home),
			"project-prompt --x",
		)
	} finally {
		fx.cleanup()
	}
})

test("resolveFallbackCommand: reconstructs the original line at the file haiku clobbered", async () => {
	const { resolveFallbackCommand } = await import(`${SRC}statusline/index.ts`)
	const fx = fallbackFixture("recon")
	try {
		// haiku is the project statusLine; the original lives in the record.
		fx.writeSettings(fx.projectSettings, CMD("/x/bin/haiku statusline"))
		fx.writeRecord(CMD("orig-project-prompt"))
		assert.equal(
			resolveFallbackCommand(fx.root, fx.home),
			"orig-project-prompt",
		)
	} finally {
		fx.cleanup()
	}
})

test("resolveFallbackCommand: falls through to the user's ~/.claude/settings.json", async () => {
	const { resolveFallbackCommand } = await import(`${SRC}statusline/index.ts`)
	const fx = fallbackFixture("user")
	try {
		// No project statusLine, no saved record — the user's global line is
		// the only thing to chain to, and it must be honored.
		fx.writeSettings(fx.userSettings, CMD("user-global-prompt"))
		assert.equal(
			resolveFallbackCommand(fx.root, fx.home),
			"user-global-prompt",
		)
	} finally {
		fx.cleanup()
	}
})

test("resolveFallbackCommand: saved record is the last resort when settings carry nothing", async () => {
	const { resolveFallbackCommand } = await import(`${SRC}statusline/index.ts`)
	const fx = fallbackFixture("rec")
	try {
		fx.writeRecord(CMD("recorded-prompt"))
		assert.equal(resolveFallbackCommand(fx.root, fx.home), "recorded-prompt")
	} finally {
		fx.cleanup()
	}
})

test("resolveFallbackCommand: nothing anywhere → null (Claude shows its default)", async () => {
	const { resolveFallbackCommand } = await import(`${SRC}statusline/index.ts`)
	const fx = fallbackFixture("empty")
	try {
		assert.equal(resolveFallbackCommand(fx.root, fx.home), null)
	} finally {
		fx.cleanup()
	}
})

test("resolveFallbackCommand: never chains to our own command (no recursion)", async () => {
	const { resolveFallbackCommand } = await import(`${SRC}statusline/index.ts`)
	const fx = fallbackFixture("self")
	try {
		// Every layer is haiku's own command and there's no saved original →
		// must NOT return a haiku command (would recurse); returns null.
		fx.writeSettings(fx.projectSettings, CMD("npx -y @haiku/haiku statusline"))
		fx.writeSettings(fx.userSettings, CMD("/x/bin/haiku statusline"))
		assert.equal(resolveFallbackCommand(fx.root, fx.home), null)
	} finally {
		fx.cleanup()
	}
})

// ── install / uninstall round-trip ───────────────────────────────────

test("install saves the existing statusLine as fallback, then uninstall restores it", async () => {
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-install-"))
	const orig = process.cwd()
	try {
		const claudeDir = join(repoRoot, ".claude")
		mkdirSync(claudeDir, { recursive: true })
		const ogStatusLine = { type: "command", command: "my-prompt --fancy" }
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({ statusLine: ogStatusLine, model: "opus" }, null, 2),
		)
		process.chdir(repoRoot)
		const { runStatusline } = await import(`${SRC}statusline/index.ts`)

		await runStatusline(["install"])
		const afterInstall = JSON.parse(
			readFileSync(join(claudeDir, "settings.json"), "utf8"),
		)
		assert.match(
			afterInstall.statusLine.command,
			/statusline/,
			"install must point statusLine at the haiku command",
		)
		assert.equal(afterInstall.model, "opus", "other settings preserved")
		const fallback = JSON.parse(
			readFileSync(join(repoRoot, ".haiku", "statusline-fallback.json"), "utf8"),
		)
		assert.deepEqual(
			fallback.statusLine,
			ogStatusLine,
			"original statusLine must be saved as the fallback",
		)

		await runStatusline(["uninstall"])
		const afterUninstall = JSON.parse(
			readFileSync(join(claudeDir, "settings.json"), "utf8"),
		)
		assert.deepEqual(
			afterUninstall.statusLine,
			ogStatusLine,
			"uninstall must restore the original statusLine",
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("install with no prior statusLine, uninstall removes it cleanly", async () => {
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-install2-"))
	const orig = process.cwd()
	try {
		const claudeDir = join(repoRoot, ".claude")
		mkdirSync(claudeDir, { recursive: true })
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({ model: "sonnet" }, null, 2),
		)
		process.chdir(repoRoot)
		const { runStatusline } = await import(`${SRC}statusline/index.ts`)

		await runStatusline(["install"])
		await runStatusline(["uninstall"])
		const after = JSON.parse(
			readFileSync(join(claudeDir, "settings.json"), "utf8"),
		)
		assert.ok(
			!("statusLine" in after),
			"uninstall with no saved fallback must remove statusLine entirely",
		)
		assert.equal(after.model, "sonnet")
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
