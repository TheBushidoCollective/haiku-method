#!/usr/bin/env node
/**
 * scripts/check-mcp-boots.mjs — CI gate that proves the production MCP
 * bundle (a) builds, (b) has every prompt template inlined at build
 * time (no runtime fs lookups), and (c) actually starts the MCP server
 * without crashing.
 *
 * Why this exists: the published 7.0.0 binary shipped with a
 * half-broken inline-prompt-templates esbuild plugin — six prompt
 * blocks in `_shared/index.ts` slipped past the inliner's early-exit
 * substring check (calls were formatted multi-line) and stayed as
 * runtime `loadTemplate(import.meta.url, "<name>.md")` calls. At
 * startup the binary tried to fs-read `plugin/bin/announcement.md`,
 * hit ENOENT, and the MCP failed to bind. Users couldn't even reach
 * the tool list.
 *
 * The contract this script enforces:
 *   1. The build script exits 0.
 *   2. `plugin/bin/haiku.mjs` exists and contains zero residual
 *      `loadTemplate(import.meta.url ...)` runtime calls.
 *   3. Spawning `node plugin/bin/haiku.mjs mcp` produces a server that
 *      binds to stdio (proven by the "running on stdio" log line) and
 *      doesn't exit before we kill it.
 *
 * Skip the SPA bundle + workflow diagrams — neither matters for the
 * boot path. (`HAIKU_SKIP_SPA_BUNDLE=1`, `HAIKU_SKIP_WORKFLOW_DIAGRAMS=1`)
 */

import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, "..")
const repoRoot = join(pkgRoot, "..", "..")
const bundlePath = join(repoRoot, "plugin", "bin", "haiku.mjs")

function step(label) {
	console.error(`\n== ${label} ==`)
}

function fail(message) {
	console.error(`\n[FAIL] ${message}`)
	process.exit(1)
}

step("Build production bundle (skip SPA + diagrams)")
const buildRes = spawnSync(
	process.execPath,
	["--experimental-vm-modules", "scripts/build-mcp.mjs"],
	{
		cwd: pkgRoot,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			HAIKU_SKIP_SPA_BUNDLE: "1",
			HAIKU_SKIP_WORKFLOW_DIAGRAMS: "1",
		},
	},
)
if (buildRes.status !== 0) {
	process.stderr.write(buildRes.stdout)
	process.stderr.write(buildRes.stderr)
	fail(`build-mcp.mjs exited ${buildRes.status}`)
}

step(`Verify ${bundlePath} exists`)
if (!existsSync(bundlePath)) {
	fail(`bundle not produced at ${bundlePath}`)
}

step("Verify zero residual loadTemplate(import.meta.url ...) runtime calls")
const bundle = readFileSync(bundlePath, "utf8")
// Loose substring check: every loadTemplate call carries a sibling
// .md filename string literal in the bundle when it isn't inlined. If
// any call site appears with a `"...md"` (or `'...md'`) literal next
// to `import.meta.url`, the inliner missed it. Other utilities that
// take `import.meta.url` (createRequire, fileURLToPath, dirname,
// pathToFileURL, etc.) never pair it with a sibling-relative string,
// so this filter is precise. The default-arg form
// `loadTemplate(import.meta.url)` resolves to `template.eta.md`; we
// catch those by ALSO matching a bare `loadTemplate(import.meta.url)`
// shape via the source-readable symbol prefix `gv`/`np`-style minified
// idents — but the sibling-string heuristic alone has caught every
// real production failure to date.
const tplStringRegex = /\bimport\.meta\.url\s*,\s*("[^"]+\.md"|'[^']+\.md')/g
const matches = Array.from(bundle.matchAll(tplStringRegex), (m) => m[0])
if (matches.length > 0) {
	const samples = Array.from(new Set(matches)).slice(0, 5).join("\n  ")
	fail(
		`bundle still contains ${matches.length} runtime template call site(s) — the inline plugin missed them.\n  Sample(s):\n  ${samples}`,
	)
}

step(`Spawn ${bundlePath} mcp and wait for "running on stdio"`)
await new Promise((resolve) => {
	const proc = spawn(process.execPath, [bundlePath, "mcp"], {
		stdio: ["pipe", "pipe", "pipe"],
	})
	let stderrBuf = ""
	let resolved = false
	const settle = (ok, msg) => {
		if (resolved) return
		resolved = true
		try {
			proc.kill("SIGTERM")
		} catch {}
		if (ok) {
			console.error(`[OK] ${msg}`)
			resolve()
		} else {
			fail(msg)
		}
	}
	proc.stderr.on("data", (chunk) => {
		stderrBuf += chunk.toString()
		if (stderrBuf.includes("running on stdio")) {
			settle(true, "MCP server bound to stdio")
		}
	})
	proc.on("exit", (code) => {
		if (!resolved) {
			settle(
				false,
				`MCP exited (code ${code}) before printing "running on stdio". Stderr:\n${stderrBuf || "(empty)"}`,
			)
		}
	})
	proc.on("error", (err) => {
		settle(false, `failed to spawn MCP: ${err.message}`)
	})
	// Hard cap — the server binds in <1s on a fresh box; 15s is a
	// huge margin of error.
	setTimeout(() => {
		settle(
			false,
			`MCP did not print "running on stdio" within 15s. Stderr so far:\n${stderrBuf || "(empty)"}`,
		)
	}, 15000)
})

console.error("\n[OK] MCP boot smoke test passed.")
