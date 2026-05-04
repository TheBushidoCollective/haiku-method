// dev-spa-rebuild.ts — auto-rebuild the inlined SPA bundle when running
// the MCP server from a dev checkout and any haiku-ui source file is newer
// than the generated `haiku-ui-html.ts`.
//
// Production install path: the npm-published binary doesn't ship the
// haiku-ui sources — `packages/haiku-ui/src/` doesn't exist next to the
// running script — so the freshness check short-circuits and the prebuilt
// `haiku-ui-html.ts` is used as-is. No vite, no build, no surprise.
//
// Dev checkout path: the user runs `bun packages/haiku/src/main.ts mcp`
// (via `plugin/bin/haiku`'s shim), edits a `.tsx`, restarts the MCP
// server. We compare the newest mtime under `packages/haiku-ui/src/` to
// the mtime of `packages/haiku/src/haiku-ui-html.ts`. If sources are
// newer, we shell out to `packages/haiku/scripts/bundle-haiku-ui.mjs`
// (which does `vite build` + inlines into `haiku-ui-html.ts`) before the
// server module ever imports `HAIKU_UI_HTML`. The cost is ~5s on a stale
// cache, ~50ms on a clean cache.
//
// We never rebuild during a session — the inlined HTML is read at module
// evaluation time, and Bun caches `haiku-ui-html.ts` in its resolution
// cache. A live HMR experience would need a separate proxy to a running
// `vite dev` (deferred).

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** Walk a directory tree and return the highest mtimeMs among regular
 *  files. Skips `node_modules`, `dist`, and `__tests__` (test files
 *  don't end up in the bundle). Returns `0` if the dir doesn't exist or
 *  is empty — callers treat that as "nothing to rebuild against." */
function newestMtimeUnder(dir: string): number {
	if (!existsSync(dir)) return 0
	let max = 0
	const stack: string[] = [dir]
	while (stack.length > 0) {
		const cur = stack.pop() as string
		let entries: string[]
		try {
			entries = readdirSync(cur)
		} catch {
			continue
		}
		for (const name of entries) {
			if (name === "node_modules" || name === "dist" || name === "__tests__") {
				continue
			}
			const full = join(cur, name)
			let st: ReturnType<typeof statSync>
			try {
				st = statSync(full)
			} catch {
				continue
			}
			if (st.isDirectory()) {
				stack.push(full)
			} else if (st.isFile() && st.mtimeMs > max) {
				max = st.mtimeMs
			}
		}
	}
	return max
}

/** Locate the repo's `packages/` root by walking up from the running
 *  script. Returns null when the running binary is the npm-published
 *  bundle (no sibling `haiku-ui/` source — the sentinel for "we are not
 *  in a dev checkout"). */
function resolveDevRoots(scriptUrl: string): {
	repoRoot: string
	uiSrcDir: string
	bundledHtml: string
	bundleScript: string
} | null {
	// Fall through to the cwd when import.meta.url isn't a file:// (e.g.
	// when run via a bundled binary). The freshness check below will
	// short-circuit on the missing source dir.
	let scriptDir: string
	try {
		scriptDir = dirname(fileURLToPath(scriptUrl))
	} catch {
		scriptDir = process.cwd()
	}
	// scriptDir is either `<repo>/packages/haiku/src` (dev) or wherever
	// the bundled binary unpacked itself (prod). Walk to `packages/`.
	const haikuPkg = resolve(scriptDir, "..")
	const packages = resolve(haikuPkg, "..")
	const uiSrcDir = join(packages, "haiku-ui", "src")
	const bundleScript = join(haikuPkg, "scripts", "bundle-haiku-ui.mjs")
	const bundledHtml = join(haikuPkg, "src", "haiku-ui-html.ts")
	if (!existsSync(uiSrcDir) || !existsSync(bundleScript)) {
		// Production install — no sources to build from. The inlined
		// HTML constant is whatever the npm publisher shipped.
		return null
	}
	return {
		repoRoot: resolve(packages, ".."),
		uiSrcDir,
		bundledHtml,
		bundleScript,
	}
}

/** Rebuild the inlined SPA bundle iff any haiku-ui source file is newer
 *  than the generated `haiku-ui-html.ts`. Logs one line on rebuild,
 *  silent on no-op. Throws on build failure — the server should not
 *  start with a stale bundle the user thinks is fresh. The
 *  `HAIKU_DEV_SPA_AUTO_REBUILD=0` escape hatch disables the check
 *  entirely (useful when iterating on engine code without touching the
 *  SPA — saves the freshness scan cost). */
export function maybeRebuildSpaForDev(scriptUrl: string): void {
	if (process.env.HAIKU_DEV_SPA_AUTO_REBUILD === "0") return
	const roots = resolveDevRoots(scriptUrl)
	if (!roots) return // production install
	const srcMtime = newestMtimeUnder(roots.uiSrcDir)
	const bundledMtime = existsSync(roots.bundledHtml)
		? statSync(roots.bundledHtml).mtimeMs
		: 0
	if (srcMtime <= bundledMtime) return
	console.error(
		`[haiku] SPA sources newer than haiku-ui-html.ts — rebuilding (dev mode)…`,
	)
	const startedAt = Date.now()
	try {
		execFileSync("node", [roots.bundleScript], {
			cwd: roots.repoRoot,
			stdio: ["ignore", "ignore", "inherit"],
		})
	} catch (err) {
		throw new Error(
			`[haiku] SPA rebuild failed: ${err instanceof Error ? err.message : String(err)}\n  Run 'node packages/haiku/scripts/bundle-haiku-ui.mjs' manually to see full output, or set HAIKU_DEV_SPA_AUTO_REBUILD=0 to skip the check.`,
		)
	}
	console.error(
		`[haiku] SPA rebuild complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
	)
}
