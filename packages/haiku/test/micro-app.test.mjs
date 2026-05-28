#!/usr/bin/env npx tsx
// Test suite for the micro-app browser pop (the chrome-less, clean-profile
// review window). Covers the PURE pieces — executable discovery, the
// app-mode flag set, the profile-dir layout, and the capability/fallback
// decision — without launching a real browser (CI has none).

import assert from "node:assert"
import { join } from "node:path"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const {
	playwrightChromiumPath,
	systemChromiumCandidates,
	findChromiumExecutable,
	buildMicroAppArgs,
	microAppProfileDir,
} = await import("../src/micro-app.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

console.log("\n=== micro-app ===")

test("buildMicroAppArgs opens app-mode against a clean profile", () => {
	const args = buildMicroAppArgs(
		"http://127.0.0.1:9999/review/abc?t=jwt",
		"/tmp/haiku-micro-app/abc",
	)
	assert.ok(
		args.includes("--app=http://127.0.0.1:9999/review/abc?t=jwt"),
		"app-mode flag carries the full review URL (query intact)",
	)
	assert.ok(
		args.includes("--user-data-dir=/tmp/haiku-micro-app/abc"),
		"isolated per-session profile dir",
	)
	assert.ok(
		args.includes("--no-first-run") &&
			args.includes("--no-default-browser-check"),
		"first-run nags suppressed so the window opens straight on the SPA",
	)
})

test("buildMicroAppArgs maximizes (DPR-proof) rather than passing a fixed window-size", () => {
	const args = buildMicroAppArgs("http://x/", "/tmp/p")
	assert.ok(
		args.includes("--start-maximized"),
		"maximize so a Retina display can't shrink the window into the mobile breakpoint",
	)
	assert.ok(
		!args.some((a) => a.startsWith("--window-size=")),
		"no fixed --window-size — it's physical px on Retina and trips the mobile layout",
	)
})

test("microAppProfileDir is per-session under a base", () => {
	const dir = microAppProfileDir("sess-42", "/base")
	assert.equal(dir, join("/base", "sess-42"))
})

test("playwrightChromiumPath picks the highest full chromium build, skips headless_shell", () => {
	const fakeReadDir = () => [
		"chromium-1140",
		"chromium-1200",
		"chromium_headless_shell-1200",
		"ffmpeg-1011",
		"webkit-2090",
	]
	const p = playwrightChromiumPath(
		"linux",
		{ HOME: "/home/u" },
		"/home/u",
		fakeReadDir,
	)
	assert.ok(p, "a full chromium build resolves to a path")
	assert.ok(
		p.includes("chromium-1200"),
		`picks the newest full build (got ${p})`,
	)
	assert.ok(
		!p.includes("headless_shell"),
		"never selects the headless shell — it can't open a window",
	)
	assert.ok(p.endsWith(join("chrome-linux", "chrome")), "linux exe subpath")
})

test("playwrightChromiumPath returns null when the cache has no full chromium", () => {
	const p = playwrightChromiumPath("linux", {}, "/home/u", () => [
		"chromium_headless_shell-1200",
		"ffmpeg-1011",
	])
	assert.equal(p, null, "headless-shell-only cache → no headed binary")
})

test("playwrightChromiumPath probes the macOS x64 (chrome-mac/Chromium.app) layout", () => {
	// Path-aware stub: cache root → builds; build root → per-arch dir;
	// per-arch dir → the .app. (Older x64 Playwright build layout.)
	const readDir = (dir) => {
		if (dir.endsWith("ms-playwright")) return ["chromium-1200"]
		if (dir.endsWith("chromium-1200")) return ["chrome-mac"]
		if (dir.endsWith("chrome-mac")) return ["Chromium.app"]
		return []
	}
	const p = playwrightChromiumPath("darwin", {}, "/Users/u", readDir)
	assert.ok(
		p.endsWith(
			join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
		),
		`x64 mac exe subpath (got ${p})`,
	)
})

test("playwrightChromiumPath probes the macOS arm64 (chrome-mac-arm64/Google Chrome for Testing.app) layout — the Apple-Silicon regression", () => {
	// Newer arm64 builds extract to chrome-mac-arm64 with a renamed app.
	// The pre-fix hardcoded chrome-mac/Chromium path didn't exist here, so
	// findChromiumExecutable fell through to the user's system Chrome.
	const readDir = (dir) => {
		if (dir.endsWith("ms-playwright")) return ["chromium-1223"]
		if (dir.endsWith("chromium-1223")) return ["chrome-mac-arm64"]
		if (dir.endsWith("chrome-mac-arm64"))
			return ["Google Chrome for Testing.app"]
		return []
	}
	const p = playwrightChromiumPath("darwin", {}, "/Users/u", readDir)
	assert.ok(
		p.endsWith(
			join(
				"chrome-mac-arm64",
				"Google Chrome for Testing.app",
				"Contents",
				"MacOS",
				"Google Chrome for Testing",
			),
		),
		`arm64 mac exe subpath (got ${p})`,
	)
})

test("playwrightChromiumPath returns null on darwin when the build has no chrome-mac* dir", () => {
	const readDir = (dir) => {
		if (dir.endsWith("ms-playwright")) return ["chromium-1200"]
		return [] // build dir empty → can't resolve a binary
	}
	const p = playwrightChromiumPath("darwin", {}, "/Users/u", readDir)
	assert.equal(p, null, "no per-arch dir → null → caller falls back")
})

test("systemChromiumCandidates lists Chrome before Edge/Brave on macOS", () => {
	const list = systemChromiumCandidates("darwin", {})
	const chrome = list.findIndex((p) => p.includes("Google Chrome"))
	const edge = list.findIndex((p) => p.includes("Microsoft Edge"))
	assert.ok(chrome >= 0 && edge >= 0 && chrome < edge, "Chrome is preferred")
})

test("findChromiumExecutable honors HAIKU_MICRO_APP_BROWSER override", () => {
	const exe = findChromiumExecutable(
		"linux",
		{ HAIKU_MICRO_APP_BROWSER: "/opt/custom/chrome" },
		(p) => p === "/opt/custom/chrome",
	)
	assert.equal(exe, "/opt/custom/chrome", "explicit override wins")
})

test("findChromiumExecutable prefers the Playwright cache over a system browser", () => {
	// Both a playwright build and a system chrome 'exist'; the playwright
	// one must win (version-stable, isolated from the user's install).
	const exe = findChromiumExecutable(
		"linux",
		{ HOME: "/home/u", PATH: "/usr/bin" },
		(p) => p.includes("ms-playwright") || p === "/usr/bin/google-chrome",
		() => ["chromium-1200"],
	)
	assert.ok(
		exe?.includes("ms-playwright"),
		`playwright cache preferred (got ${exe})`,
	)
})

test("findChromiumExecutable returns null when nothing is installed", () => {
	const exe = findChromiumExecutable("linux", { PATH: "/usr/bin" }, () => false)
	assert.equal(exe, null, "no binary anywhere → null → caller falls back")
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
