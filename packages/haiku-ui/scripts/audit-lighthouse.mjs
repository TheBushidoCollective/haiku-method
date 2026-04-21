#!/usr/bin/env node
/**
 * Lighthouse CI audit harness for the H·AI·K·U review SPA (unit-06).
 *
 * Flow:
 *   1. Run `vite build` (skipped with --skip-build / LIGHTHOUSE_SKIP_BUILD=1).
 *   2. Boot a minimal Node http server on an ephemeral port that:
 *        - serves dist/index.html for every non-/api/* path (SPA fallback),
 *        - serves dist/* static assets,
 *        - returns a committed test-fixture JSON for /api/sessions/demo,
 *          /api/sessions/demo-question, /api/sessions/demo-direction,
 *          and a synthesized payload for /api/review/current.
 *   3. Stamp the real port into `lighthouserc.json` (placeholder
 *      `LIGHTHOUSE_PORT`), write the stamped config to a tmp path.
 *   4. Invoke `@lhci/cli autorun --config=<stamped>`.
 *   5. Tear down the server and exit with lhci's exit code.
 *
 * Opt-out: set LIGHTHOUSE_SKIP=1 to skip the whole run (exits 0). Useful
 * inside sandboxed CI that cannot launch Chromium.
 */

import { spawn } from "node:child_process"
import { readFile, readdir, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(__dirname, "..")
const DIST = join(PKG_ROOT, "dist")
const FIXTURES = join(PKG_ROOT, "test-fixtures")

const SKIP_BUILD =
	process.env.LIGHTHOUSE_SKIP_BUILD === "1" ||
	process.argv.includes("--skip-build")

if (process.env.LIGHTHOUSE_SKIP === "1") {
	console.log("[audit-lighthouse] LIGHTHOUSE_SKIP=1 — exiting 0")
	process.exit(0)
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_FILES = {
	"/api/sessions/demo": join(FIXTURES, "review-session.json"),
	"/api/sessions/test-review-1": join(FIXTURES, "review-session.json"),
	"/api/sessions/demo-question": join(FIXTURES, "question-session.json"),
	"/api/sessions/test-question-1": join(FIXTURES, "question-session.json"),
	"/api/sessions/demo-direction": join(FIXTURES, "direction-session.json"),
	"/api/sessions/test-direction-1": join(FIXTURES, "direction-session.json"),
}

function reviewCurrentPayload() {
	return {
		intent: "demo-intent",
		stage: "design",
		stages: [],
		units: [],
		feedback_summary: { pending: 0, addressed: 0, closed: 0, rejected: 0 },
		feedback_items: [],
	}
}

// ── Step 1: build ──────────────────────────────────────────────────────────

async function runBuild() {
	if (SKIP_BUILD) {
		console.log("[audit-lighthouse] skipping build (--skip-build)")
		return
	}
	console.log("[audit-lighthouse] running vite build…")
	await new Promise((resolveExit, rejectExit) => {
		const child = spawn("npx", ["vite", "build"], {
			cwd: PKG_ROOT,
			stdio: "inherit",
		})
		child.on("exit", (code) =>
			code === 0 ? resolveExit(undefined) : rejectExit(new Error(`vite build exit ${code}`)),
		)
		child.on("error", rejectExit)
	})
}

// ── Step 2: server ─────────────────────────────────────────────────────────

const CONTENT_TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
}

function contentType(path) {
	const dot = path.lastIndexOf(".")
	if (dot < 0) return "application/octet-stream"
	return CONTENT_TYPES[path.slice(dot)] ?? "application/octet-stream"
}

async function bootServer() {
	const indexHtml = await readFile(join(DIST, "index.html"))
	const distEntries = new Set(await readdir(DIST))

	return await new Promise((resolveBoot, rejectBoot) => {
		const server = createServer(async (req, res) => {
			try {
				const url = new URL(req.url ?? "/", "http://localhost")
				const pathname = url.pathname

				// /api/review/current — synthesized payload
				if (pathname === "/api/review/current") {
					res.writeHead(200, { "content-type": "application/json" })
					res.end(JSON.stringify(reviewCurrentPayload()))
					return
				}

				// /api/sessions/:id — fixture
				if (pathname.startsWith("/api/sessions/")) {
					const fixturePath = FIXTURE_FILES[pathname]
					if (fixturePath) {
						const body = await readFile(fixturePath)
						res.writeHead(200, { "content-type": "application/json" })
						res.end(body)
						return
					}
					res.writeHead(404, { "content-type": "application/json" })
					res.end(JSON.stringify({ error: "unknown fixture" }))
					return
				}

				// Feedback list endpoint — empty
				if (pathname.startsWith("/api/intents/") && pathname.endsWith("/feedback")) {
					res.writeHead(200, { "content-type": "application/json" })
					res.end(JSON.stringify({ items: [] }))
					return
				}

				// Static asset from dist/
				if (pathname !== "/" && distEntries.has(pathname.slice(1))) {
					const body = await readFile(join(DIST, pathname.slice(1)))
					res.writeHead(200, { "content-type": contentType(pathname) })
					res.end(body)
					return
				}

				// SPA fallback
				res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
				res.end(indexHtml)
			} catch (err) {
				res.writeHead(500, { "content-type": "text/plain" })
				res.end(String(err))
			}
		})
		server.on("upgrade", (_req, socket) => socket.destroy())
		server.listen(0, () => {
			const addr = server.address()
			if (typeof addr !== "object" || addr === null) {
				server.close()
				rejectBoot(new Error("could not read server port"))
				return
			}
			resolveBoot({ server, port: addr.port })
		})
		server.on("error", rejectBoot)
	})
}

// ── Step 3 + 4: stamp config + run lhci ────────────────────────────────────

async function stampConfig(port) {
	const raw = await readFile(join(PKG_ROOT, "lighthouserc.json"), "utf-8")
	const stamped = raw.replaceAll("LIGHTHOUSE_PORT", String(port))
	const outPath = join(tmpdir(), `lighthouserc.${process.pid}.json`)
	await writeFile(outPath, stamped)
	return outPath
}

async function runLhci(configPath) {
	return await new Promise((resolveExit) => {
		const child = spawn("npx", ["lhci", "autorun", `--config=${configPath}`], {
			cwd: PKG_ROOT,
			stdio: "inherit",
			env: { ...process.env },
		})
		child.on("exit", (code) => resolveExit(code ?? 1))
		child.on("error", (err) => {
			console.error("[audit-lighthouse] lhci spawn error:", err)
			resolveExit(1)
		})
	})
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
	await runBuild()
	const { server, port } = await bootServer()
	console.log(`[audit-lighthouse] serving dist/ on http://localhost:${port}`)
	try {
		const configPath = await stampConfig(port)
		const exitCode = await runLhci(configPath)
		process.exitCode = exitCode
	} finally {
		server.close()
	}
}

main().catch((err) => {
	console.error("[audit-lighthouse] fatal:", err)
	process.exit(1)
})
