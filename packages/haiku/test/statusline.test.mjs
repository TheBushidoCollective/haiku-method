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
	assert.equal(
		line,
		"H·AI·K·U ⬢ ship · software · ⬢⬢ intent ▰▱▱ ❯ intent review",
	)
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
	assert.ok(
		line.includes("\x1b[9m"),
		"actual position should be struck (SGR 9)",
	)
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

test("renderStatusline: itemBars emit a second line of per-item hat bars (NO_COLOR)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const out = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "development", status: "active" }],
			activeStage: "development",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "1/4 units",
			phaseTrack: null,
			itemBars: [
				// just started: active first, rest pending
				{
					id: "U-03",
					segments: ["active", "pending", "pending", "pending", "pending"],
				},
				// 2 done + active + 2 pending
				{
					id: "U-07",
					segments: ["done", "done", "active", "pending", "pending"],
				},
			],
		},
		{ color: false },
	)
	const lines = out.split("\n")
	assert.equal(
		lines.length,
		2,
		`expected two lines; got: ${JSON.stringify(out)}`,
	)
	// Prefixed ids + bars. NO_COLOR collapses done/active to ▰, pending ▱.
	assert.equal(lines[1], "↳ U-03 ▰▱▱▱▱  U-07 ▰▰▰▱▱")
})

test("renderStatusline: absent/empty itemBars emit no second line", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const base = {
		intent: "demo",
		studio: "",
		stages: [{ name: "design", status: "active" }],
		activeStage: "design",
		phaseLabel: "execute",
		phaseKind: "execute",
		gated: false,
		aggregate: "",
		phaseTrack: null,
	}
	assert.ok(
		!renderStatusline(base, { color: false }).includes("\n"),
		"no field → one line",
	)
	assert.ok(
		!renderStatusline({ ...base, itemBars: [] }, { color: false }).includes(
			"\n",
		),
		"empty array → one line",
	)
	assert.ok(
		!renderStatusline({ ...base, itemBars: null }, { color: false }).includes(
			"\n",
		),
		"null → one line",
	)
})

test("renderStatusline: itemBars color each hat by status (green/amber/red)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const out = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "development", status: "active" }],
			activeStage: "development",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "",
			phaseTrack: null,
			itemBars: [{ id: "U-01", segments: ["done", "rejected", "active"] }],
		},
		{ color: true },
	)
	const line2 = out.split("\n")[1]
	assert.ok(out.includes("\n"), "color mode still emits the second line")
	assert.ok(/\x1b\[38;5;71m▰/.test(line2), "done hat → green (71)")
	assert.ok(/\x1b\[1;38;5;167m▰/.test(line2), "rejected hat → red (167)")
	assert.ok(/\x1b\[1;38;5;172m▰/.test(line2), "active hat → amber (172)")
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

test("resolveStatuslineState: multiple live intents, no intent branch → null", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-multi-"))
	const orig = process.cwd()
	try {
		seedIntent(repoRoot, "sl-multi-a", "security")
		seedIntent(repoRoot, "sl-multi-b", "security")
		execFileSync("git", ["init", "-q", "-b", "main", repoRoot], {
			stdio: "ignore",
		})
		execFileSync("git", ["config", "user.email", "t@t"], { cwd: repoRoot })
		execFileSync("git", ["config", "user.name", "t"], { cwd: repoRoot })
		execFileSync("git", ["config", "commit.gpgsign", "false"], {
			cwd: repoRoot,
		})
		execFileSync("git", ["add", "-A"], { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["commit", "-q", "-m", "seed"], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		// A non-intent branch (refactor/feature/main) — names neither intent.
		execFileSync("git", ["checkout", "-q", "-b", "refactor/some-work"], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		assert.equal(
			resolveStatuslineState(),
			null,
			"with several live intents and no intent branch there's no signal — fall back to the OG line",
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("resolveStatuslineState: multiple live intents, on one's branch → that intent", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-multi-br-"))
	const orig = process.cwd()
	try {
		seedIntent(repoRoot, "sl-br-a", "security")
		seedIntent(repoRoot, "sl-br-b", "security")
		execFileSync("git", ["init", "-q", "-b", "main", repoRoot], {
			stdio: "ignore",
		})
		execFileSync("git", ["config", "user.email", "t@t"], { cwd: repoRoot })
		execFileSync("git", ["config", "user.name", "t"], { cwd: repoRoot })
		execFileSync("git", ["config", "commit.gpgsign", "false"], {
			cwd: repoRoot,
		})
		execFileSync("git", ["add", "-A"], { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["commit", "-q", "-m", "seed"], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		execFileSync("git", ["checkout", "-q", "-b", "haiku/sl-br-b/development"], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		const state = resolveStatuslineState()
		assert.ok(state, "branch names an intent → render it")
		assert.equal(state.intent, "sl-br-b")
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
		writeFileSync(
			path,
			JSON.stringify(statusLine ? { statusLine } : {}, null, 2),
		)
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
		assert.equal(resolveFallbackCommand(fx.root, fx.home), "project-prompt --x")
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
		assert.equal(resolveFallbackCommand(fx.root, fx.home), "user-global-prompt")
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
			readFileSync(
				join(repoRoot, ".haiku", "statusline-fallback.json"),
				"utf8",
			),
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

// ── itemBars (second-line pool) state resolution ─────────────────────

test("resolveStatuslineState: execute phase populates itemBars for in-flight units", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-bars-"))
	const orig = process.cwd()
	try {
		const slug = "sl-bars"
		const stage = "security"
		const AT = "2026-05-20T00:00:00Z"
		// Reviews must be COMPLETE for the phase to advance to execute.
		// Autopilot keeps the studio review agents, so stamp every review
		// role the cursor walks for this stage (not just the engine pair) —
		// derive them so the fixture can't drift from the studio config.
		const { stageRoleLists } = await import(
			`${SRC}orchestrator/workflow/cursor.ts`
		)
		const ER = Object.fromEntries(
			stageRoleLists("software", stage, "autopilot").reviewRoles.map((r) => [
				r,
				{ signed_at: AT, agent: "e" },
			]),
		)
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "bars",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
			}),
		)
		const kn = join(repoRoot, ".haiku", "knowledge")
		mkdirSync(kn, { recursive: true })
		writeFileSync(join(kn, "THREAT-MODEL.md"), "x\n")
		writeFileSync(join(kn, "VULN-REPORT.md"), "x\n")
		writeFileSync(
			join(stageDir, "elaboration.md"),
			matter.stringify("e\n", { verified_at: AT, decompose_verified_at: AT }),
		)
		const hats = matter(
			readFileSync(
				join(
					REPO_ROOT,
					"plugin",
					"studios",
					"software",
					"stages",
					stage,
					"STAGE.md",
				),
				"utf8",
			),
		).data.hats
		if (!Array.isArray(hats) || hats.length < 2) return
		// done (all hats advanced) → excluded
		writeFileSync(
			join(stageDir, "units", "unit-01-done.md"),
			matter.stringify("d\n", {
				title: "unit-01-done",
				started_at: AT,
				inputs: [],
				iterations: hats.map((h) => ({
					hat: h,
					started_at: AT,
					completed_at: AT,
					result: "advance",
				})),
				reviews: ER,
				approvals: {},
			}),
		)
		// started, no completed iteration yet → first hat active (real model:
		// iterations are written only on completion, no open entry on disk).
		writeFileSync(
			join(stageDir, "units", "unit-02-a.md"),
			matter.stringify("a\n", {
				title: "unit-02-a",
				started_at: AT,
				inputs: [],
				iterations: [],
				reviews: ER,
				approvals: {},
			}),
		)
		// hats[0] advanced → hats[1] is the active (next) hat.
		writeFileSync(
			join(stageDir, "units", "unit-03-b.md"),
			matter.stringify("b\n", {
				title: "unit-03-b",
				started_at: AT,
				inputs: [],
				iterations: [
					{ hat: hats[0], started_at: AT, completed_at: AT, result: "advance" },
				],
				reviews: ER,
				approvals: {},
			}),
		)
		// not started → excluded
		writeFileSync(
			join(stageDir, "units", "unit-04-c.md"),
			matter.stringify("c\n", {
				title: "unit-04-c",
				started_at: null,
				inputs: [],
				iterations: [],
				reviews: ER,
				approvals: {},
			}),
		)
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		const state = resolveStatuslineState()
		assert.ok(state, "expected a state")
		assert.equal(
			state.phaseKind,
			"execute",
			`expected execute; got ${state.phaseKind}`,
		)
		assert.ok(
			Array.isArray(state.itemBars),
			"itemBars must be populated in execute",
		)
		// Only the two in-flight units, in numeric order. done + pending excluded.
		const pend = (n) => Array(n).fill("pending")
		assert.deepEqual(
			state.itemBars,
			[
				// just started → first hat active
				{ id: "U-02", segments: ["active", ...pend(hats.length - 1)] },
				// hats[0] advanced → hats[1] active
				{ id: "U-03", segments: ["done", "active", ...pend(hats.length - 2)] },
			],
			`got: ${JSON.stringify(state.itemBars)}`,
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

// ── agent chips (await-phase second line) ────────────────────────────

test("renderStatusline: agentChips render status marks on the second line (NO_COLOR)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const out = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "design", status: "active" }],
			activeStage: "design",
			phaseLabel: "continuity review",
			phaseKind: "review",
			gated: false,
			aggregate: "7 units",
			phaseTrack: { index: 1, total: 4 },
			agentChips: [
				{ id: "spec", status: "done" },
				{ id: "continuity", status: "active" },
				{ id: "cross-stage", status: "pending" },
			],
		},
		{ color: false },
	)
	const lines = out.split("\n")
	assert.equal(lines.length, 2)
	// done → ✓, active → ▸, pending → no mark.
	assert.equal(lines[1], "↳ spec ✓  continuity ▸  cross-stage")
})

test("renderStatusline: agentChips color the bubble bg by status", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const out = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "design", status: "active" }],
			activeStage: "design",
			phaseLabel: "spec review",
			phaseKind: "review",
			gated: false,
			aggregate: "",
			phaseTrack: null,
			agentChips: [
				{ id: "spec", status: "done" },
				{ id: "continuity", status: "active" },
				{ id: "cross-stage", status: "pending" },
			],
		},
		{ color: true },
	)
	const line2 = out.split("\n")[1]
	assert.ok(
		/\x1b\[48;5;151m/.test(line2),
		"stamped role → pastel green bg (151)",
	)
	assert.ok(/\x1b\[48;5;254m/.test(line2), "awaited role → near-white bg (254)")
	assert.ok(/\x1b\[48;5;248m/.test(line2), "queued role → soft grey bg (248)")
})

test("renderStatusline: itemBars take precedence over agentChips when both present", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const out = renderStatusline(
		{
			intent: "demo",
			studio: "software",
			stages: [{ name: "design", status: "active" }],
			activeStage: "design",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "",
			phaseTrack: null,
			itemBars: [{ id: "U-01", segments: ["active", "pending", "pending"] }],
			agentChips: [{ id: "spec", status: "done" }],
		},
		{ color: false },
	)
	const line2 = out.split("\n")[1]
	assert.ok(/U-01/.test(line2) && /▰/.test(line2), "bars win")
	assert.ok(!/spec/.test(line2), "agent chips suppressed when bars present")
})

// ── sealed intent renders all-done (no active/sealed contradiction) ───

test("resolveStatuslineState: sealed intent on its branch renders all stages done", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-sealed2-"))
	const orig = process.cwd()
	try {
		const slug = "sealed-done"
		const stage = "security"
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "sealed",
				studio: "software",
				mode: "continuous",
				stages: ["inception", "design", stage],
				sealed_at: "2026-05-20T00:00:00Z",
			}),
		)
		execFileSync("git", ["init", "-q", "-b", "main", repoRoot], {
			stdio: "ignore",
		})
		execFileSync("git", ["config", "user.email", "t@t"], { cwd: repoRoot })
		execFileSync("git", ["config", "user.name", "t"], { cwd: repoRoot })
		execFileSync("git", ["config", "commit.gpgsign", "false"], {
			cwd: repoRoot,
		})
		execFileSync("git", ["add", "-A"], { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["commit", "-q", "-m", "seed"], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		// On the intent's branch → pickActiveIntent's branch match returns it
		// despite sealed_at (the case that produced the contradiction).
		execFileSync("git", ["checkout", "-q", "-b", `haiku/${slug}/main`], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		const state = resolveStatuslineState()
		assert.ok(state, "sealed intent on its branch should still render a line")
		assert.equal(state.phaseKind, "sealed")
		assert.equal(state.activeStage, "", "no active stage when sealed")
		assert.ok(
			state.stages.every((s) => s.status === "done"),
			`every stage must be done when sealed; got: ${JSON.stringify(state.stages)}`,
		)
		assert.equal(state.itemBars ?? null, null)
		assert.equal(state.agentChips ?? null, null)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("resolveStatuslineState: agent chips appear ONLY in adversarial review, not spec review", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-chips-"))
	const orig = process.cwd()
	try {
		const slug = "sl-chips"
		const stage = "security"
		const AT = "2026-05-20T00:00:00Z"
		const { stageRoleLists } = await import(
			`${SRC}orchestrator/workflow/cursor.ts`
		)
		const reviewRoles = stageRoleLists(
			"software",
			stage,
			"autopilot",
		).reviewRoles
		// The parallel adversarial group = every review role but the serial
		// spec/user gates. Security ships studio agents on top of the engine
		// pair, so this is >2.
		const adversarial = reviewRoles.filter((r) => r !== "spec" && r !== "user")
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "chips",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
			}),
		)
		const kn = join(repoRoot, ".haiku", "knowledge")
		mkdirSync(kn, { recursive: true })
		writeFileSync(join(kn, "THREAT-MODEL.md"), "x\n")
		writeFileSync(join(kn, "VULN-REPORT.md"), "x\n")
		writeFileSync(
			join(stageDir, "elaboration.md"),
			matter.stringify("e\n", { verified_at: AT, decompose_verified_at: AT }),
		)
		const unitPath = join(stageDir, "units", "unit-01.md")
		const writeUnit = (reviews) =>
			writeFileSync(
				unitPath,
				matter.stringify("u\n", {
					title: "u",
					inputs: [],
					started_at: null,
					iterations: [],
					reviews,
					approvals: {},
				}),
			)
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)

		// Phase 1 — nothing stamped → the serial spec gate is active. spec is
		// single-actor, so the second-line chip row is SUPPRESSED.
		writeUnit({})
		let state = resolveStatuslineState()
		assert.equal(state.phaseLabel, "spec review")
		assert.equal(
			state.agentChips ?? null,
			null,
			"spec review is single-actor — no parallel chips",
		)

		// Phase 2 — spec signed, the adversarial group still pending → the
		// phase is the parallel fan-out. NOW the chips appear: one per
		// adversarial agent, and spec (single-actor, already done) is NOT
		// among them.
		writeUnit({ spec: { signed_at: AT, agent: "e" } })
		state = resolveStatuslineState()
		assert.equal(state.phaseLabel, "adversarial review")
		assert.ok(
			Array.isArray(state.agentChips) && state.agentChips.length > 0,
			"adversarial review must surface the parallel agent chips",
		)
		const chipIds = state.agentChips.map((c) => c.id)
		assert.ok(
			!chipIds.includes("spec"),
			`spec must not be a chip in adversarial review; got ${chipIds.join(", ")}`,
		)
		assert.equal(
			state.agentChips.length,
			adversarial.length,
			`expected one chip per adversarial agent (${adversarial.length}); got ${chipIds.join(", ")}`,
		)
		// Parallel fan-out: with nothing stamped yet, EVERY adversarial chip is
		// in-flight at once — no serial "first active, rest queued". So all are
		// `active`; none `pending`/`done`.
		assert.ok(
			state.agentChips.every((c) => c.status === "active"),
			`all adversarial chips must be active (parallel fan-out); got ${state.agentChips
				.map((c) => `${c.id}:${c.status}`)
				.join(", ")}`,
		)

		// Phase 3 — ONE adversarial agent stamped, the rest still running. The
		// stamped one flips to `done`; every other stays `active`. NO chip is
		// `pending` — there's no queue behind a parallel fan-out. (This is the
		// exact scenario the status line used to mis-render: one `active` ▸ and
		// the rest grey `pending`.)
		const firstAdv = adversarial[0]
		writeUnit({
			spec: { signed_at: AT, agent: "e" },
			[firstAdv]: { signed_at: AT, agent: "e" },
		})
		state = resolveStatuslineState()
		assert.ok(
			Array.isArray(state.agentChips) && state.agentChips.length > 0,
			"adversarial review must still surface chips with one signed",
		)
		assert.equal(
			state.agentChips.filter((c) => c.status === "pending").length,
			0,
			`no chip may be pending in a parallel fan-out; got ${state.agentChips
				.map((c) => `${c.id}:${c.status}`)
				.join(", ")}`,
		)
		assert.ok(
			state.agentChips.some((c) => c.status === "done"),
			"the stamped adversarial agent must read as done",
		)
		assert.ok(
			state.agentChips.some((c) => c.status === "active"),
			"the unstamped adversarial agents must read as active (in-flight)",
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("resolveStatuslineState: discovery agents surface as chips during elaborate_loop", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-disc-"))
	const orig = process.cwd()
	try {
		const slug = "sl-disc"
		const stage = "security"
		const AT = "2026-05-22T00:00:00Z"
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "disc",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
			}),
		)
		// Conversation captured + decompose verified + a unit on disk → the
		// only unmet elaborate signals are the missing discovery artifacts
		// (.haiku/knowledge/ is empty, so every required discovery template
		// fires its signal). `computeElaborateSignals` skips non-tool
		// discoveries when no units exist, hence the unit-01 seed.
		writeFileSync(
			join(stageDir, "elaboration.md"),
			matter.stringify("e\n", { verified_at: AT, decompose_verified_at: AT }),
		)
		writeFileSync(
			join(stageDir, "units", "unit-01.md"),
			matter.stringify("u\n", {
				title: "u",
				started_at: null,
				inputs: [],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		process.chdir(repoRoot)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		const state = resolveStatuslineState()
		assert.ok(state, "expected a state")
		// Cursor sits in the elaborate phase with discovery signals pending.
		assert.equal(state.phaseKind, "elaborate")
		// One chip per discovery template configured for the stage; all
		// missing → every chip is "active" (the parallel fan-out being run).
		assert.ok(
			Array.isArray(state.agentChips) && state.agentChips.length > 0,
			`expected discovery chips; got ${JSON.stringify(state.agentChips)}`,
		)
		assert.ok(
			state.agentChips.every((c) => c.status === "active"),
			`every chip should be active when no artifacts exist; got ${JSON.stringify(state.agentChips)}`,
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

// ── isPastAllStages: intent-completion vs stage-scoped actions ────────

test("isPastAllStages: intent-completion actions are past all stages, stage-scoped are not", async () => {
	const { isPastAllStages } = await import(`${SRC}statusline/state.ts`)
	// Intent-scope completion kinds (no stage) → true.
	assert.equal(
		isPastAllStages({ kind: "intent_review", role: "continuity" }),
		true,
	)
	assert.equal(isPastAllStages({ kind: "record_reflection" }), true)
	assert.equal(isPastAllStages({ kind: "seal_intent" }), true)
	assert.equal(isPastAllStages({ kind: "sealed" }), true)
	// Stage-scoped actions → false (they carry a stage; the active dot is real).
	assert.equal(
		isPastAllStages({
			kind: "dispatch_review",
			role: "continuity",
			stage: "development",
		}),
		false,
		"a STAGE's continuity review is not past all stages",
	)
	assert.equal(
		isPastAllStages({ kind: "start_unit_hat", stage: "design", units: [] }),
		false,
	)
	assert.equal(
		isPastAllStages({
			kind: "dispatch_approval",
			role: "spec",
			stage: "design",
		}),
		false,
	)
	// Fix-loop is deliberately NOT treated as completion even at intent scope
	// (a mid-intent intent-scope finding can be open while stages run).
	assert.equal(
		isPastAllStages({
			kind: "start_feedback_hat",
			dispatches: [
				{ feedback_id: "FB-001", stage: "", hat: "x", terminal: true },
			],
		}),
		false,
	)
	assert.equal(isPastAllStages(null), false)
})

// ── hatSegments: per-hat status from iterations ──────────────────────

test("hatSegments: derives done/active/rejected/pending from iteration history", async () => {
	const { hatSegments } = await import(`${SRC}statusline/state.ts`)
	const hats = ["planner", "builder", "reviewer", "verifier"]
	// Nothing run yet → first hat active.
	assert.deepEqual(hatSegments([], hats), [
		"active",
		"pending",
		"pending",
		"pending",
	])
	// planner advanced → builder is the active (next) hat.
	assert.deepEqual(hatSegments([{ hat: "planner", result: "advance" }], hats), [
		"done",
		"active",
		"pending",
		"pending",
	])
	// builder just rejected → builder stays red (retrying), nothing else active.
	assert.deepEqual(
		hatSegments(
			[
				{ hat: "planner", result: "advance" },
				{ hat: "builder", result: "reject" },
			],
			hats,
		),
		["done", "rejected", "pending", "pending"],
	)
	// builder rejected then re-advanced → red clears to green, reviewer active.
	assert.deepEqual(
		hatSegments(
			[
				{ hat: "planner", result: "advance" },
				{ hat: "builder", result: "reject" },
				{ hat: "builder", result: "advance" },
			],
			hats,
		),
		["done", "done", "active", "pending"],
	)
	// last hat in progress (prior all advanced) → verifier active.
	assert.deepEqual(
		hatSegments(
			[
				{ hat: "planner", result: "advance" },
				{ hat: "builder", result: "advance" },
				{ hat: "reviewer", result: "advance" },
			],
			hats,
		),
		["done", "done", "done", "active"],
	)
	// defensive: an open (null-result) iteration marks its hat active.
	assert.deepEqual(
		hatSegments(
			[
				{ hat: "planner", result: "advance" },
				{ hat: "builder", result: null },
			],
			hats,
		),
		["done", "active", "pending", "pending"],
	)
})

// ── new (2026-05-25): current wave in the execute aggregate + feedback
//    severity glyphs on the fix-loop bars. ──

test("renderStatusline: fix-loop bars show severity glyphs (NO_COLOR marks + color dots)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const state = {
		intent: "sev",
		studio: "software",
		stages: [{ name: "development", status: "active" }],
		activeStage: "development",
		phaseLabel: "fix-loop",
		phaseKind: "fixloop",
		gated: false,
		aggregate: "3 open",
		phaseTrack: null,
		itemBars: [
			{ id: "FB-01", segments: ["active", "pending"], severity: "blocker" },
			{ id: "FB-02", segments: ["pending", "pending"], severity: "low" },
			{ id: "FB-03", segments: ["pending", "pending"], severity: null },
		],
	}
	const plain = renderStatusline(state, { color: false }).split("\n")[1]
	assert.match(plain, /! FB-01/, "blocker → '!' mark")
	assert.match(plain, /\. FB-02/, "low → '.' mark")
	assert.match(plain, /\? FB-03/, "unclassified → '?' mark")

	const colored = renderStatusline(state, { color: true }).split("\n")[1]
	assert.match(colored, /\x1b\[1;38;5;160m●/, "blocker → red (160) filled dot")
	assert.match(
		colored,
		/\x1b\[38;5;250m○/,
		"unclassified → faint (250) hollow dot",
	)
})

test("renderStatusline: execute unit bars carry NO severity glyph (regression guard)", async () => {
	const { renderStatusline } = await import(`${SRC}statusline/render.ts`)
	const plain = renderStatusline(
		{
			intent: "u",
			studio: "software",
			stages: [{ name: "development", status: "active" }],
			activeStage: "development",
			phaseLabel: "execute",
			phaseKind: "execute",
			gated: false,
			aggregate: "1/2 units · wave 1/2",
			phaseTrack: null,
			itemBars: [{ id: "U-01", segments: ["active", "pending"] }],
		},
		{ color: false },
	).split("\n")[1]
	// No severity → bar starts at the id, no leading mark.
	assert.match(
		plain,
		/U-01 /,
		"unit bar renders its id without a severity prefix",
	)
	assert.ok(
		!/[!^~?.] U-01/.test(plain),
		"unit bar must NOT get a severity mark",
	)
})

test("resolveStatuslineState: execute aggregate shows the current wave for a multi-wave stage", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-sl-wave-"))
	process.env.HAIKU_PROJECTS_ROOT = join(repoRoot, ".haiku", "_pr")
	mkdirSync(process.env.HAIKU_PROJECTS_ROOT, { recursive: true })
	const orig = process.cwd()
	try {
		const slug = "sl-wave"
		const stage = "development"
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const unitsDir = join(intentDir, "stages", stage, "units")
		mkdirSync(unitsDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "wave intent",
				studio: "software",
				mode: "continuous",
				stages: [stage],
			}),
		)
		// unit-02 depends_on unit-01 → two dependency waves.
		writeFileSync(
			join(unitsDir, "unit-01-foo.md"),
			matter.stringify("u1\n", {
				title: "foo",
				inputs: [],
				depends_on: [],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		writeFileSync(
			join(unitsDir, "unit-02-bar.md"),
			matter.stringify("u2\n", {
				title: "bar",
				inputs: [],
				depends_on: ["unit-01-foo"],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		process.chdir(repoRoot)
		// Pin the execute phase deterministically via the snapshot (bypass the
		// elaborate gate the live derive would hit on an un-elaborated fixture).
		const { writeStatuslineSnapshot } = await import(
			`${SRC}statusline/snapshot.ts`
		)
		writeStatuslineSnapshot(slug, {
			kind: "start_unit_hat",
			stage,
			hat: "planner",
			units: ["unit-01-foo"],
		})
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		const state = resolveStatuslineState()
		assert.ok(state, "expected a state")
		assert.match(
			state.aggregate,
			/wave 1\/2/,
			`execute aggregate must show the current wave; got "${state.aggregate}"`,
		)
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
