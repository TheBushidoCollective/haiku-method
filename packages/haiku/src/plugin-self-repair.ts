// plugin-self-repair.ts — Detect & recover from a wiped plugin cache dir.
//
// Claude Code's plugin cache (~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/)
// can disappear from under a running MCP server — CLI auto-update, manual
// `/plugin uninstall`, or any of the open Claude Code cache bugs (#48985,
// #14061, #51536, #54132). The running binary survives because the OS
// keeps the file mapped in memory after deletion, but every subsequent
// disk read for studios/, schemas/, hooks/, .claude-plugin/ fails.
//
// This module:
//   1. Detects removal by stat'ing the critical sub-paths each tool call
//      (cheap; throttled to once per CHECK_THROTTLE_MS).
//   2. Reports each detection to Sentry with full context so we know
//      how often this is actually happening in production.
//   3. Attempts self-repair by copying from ~/.claude/plugins/npm-cache/
//      first (fast path, no network), then by running `npm install`
//      against the published version (slow path, requires network +
//      npm in PATH).
//   4. Surfaces a structured failure to the tool caller when repair
//      doesn't recover.
//
// Dev builds (MCP_VERSION === "dev") skip the npm-install fallback —
// there's no published version to pull, and the dev shim runs from
// source which is the user's checkout, not the plugin cache.

import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { resolvePluginRoot } from "./config.js"
import { reportError } from "./sentry.js"
import { MCP_VERSION } from "./version.js"

/** Critical sub-paths that MUST exist for the MCP to keep functioning.
 *  If any of these is missing, the plugin dir has been removed or
 *  partially wiped. */
const CRITICAL_SUBPATHS: ReadonlyArray<string> = [
	"studios",
	"schemas",
	".claude-plugin/plugin.json",
]

const CHECK_THROTTLE_MS = 5_000
let _lastGoodCheck = 0

/** Resolve the npm-cache install path that backs the active marketplace
 *  source. Claude Code's plugin manager does an `npm install` of the
 *  haiku-method package into this directory, then copies/symlinks into
 *  the per-version cache dir. We can read directly from here when the
 *  cache dir is wiped but the npm cache survived. */
function resolveNpmCachePath(): string {
	return join(
		homedir(),
		".claude",
		"plugins",
		"npm-cache",
		"node_modules",
		"haiku-method",
	)
}

interface DetectionResult {
	removed: boolean
	root: string
	missingPaths: string[]
}

/** Cheap stat-based check of every CRITICAL_SUBPATH. Returns the list of
 *  paths that don't exist; an empty list means the plugin is intact.
 *  `rootOverride` is for tests — production callers omit it and use the
 *  cached `resolvePluginRoot()` value. */
export function detectPluginRemoval(rootOverride?: string): DetectionResult {
	const root = rootOverride ?? resolvePluginRoot()
	if (!root) {
		return {
			removed: true,
			root: "",
			missingPaths: ["<plugin root unresolvable>"],
		}
	}
	const missing: string[] = []
	for (const sub of CRITICAL_SUBPATHS) {
		if (!existsSync(join(root, sub))) missing.push(sub)
	}
	return { removed: missing.length > 0, root, missingPaths: missing }
}

interface RepairResult {
	ok: boolean
	method: "npm-cache-copy" | "npm-install" | "skipped"
	reason?: string
	error?: string
}

/** Attempt to restore the plugin contents at `target`. Tries the npm
 *  cache copy path first (offline, fast); falls back to running
 *  `npm install` against the published version (online, slow). */
export function attemptSelfRepair(): RepairResult {
	if (MCP_VERSION === "dev") {
		return {
			ok: false,
			method: "skipped",
			reason: "dev_build_no_npm_source",
		}
	}

	const target = resolvePluginRoot()
	if (!target) {
		return {
			ok: false,
			method: "skipped",
			reason: "no_target_path",
		}
	}

	const npmCachePath = resolveNpmCachePath()

	// Fast path: copy from the npm-installed package if the npm cache
	// survived the plugin-cache wipe.
	if (existsSync(npmCachePath)) {
		try {
			mkdirSync(target, { recursive: true })
			cpSync(npmCachePath, target, { recursive: true, force: true })
			return { ok: true, method: "npm-cache-copy" }
		} catch (err) {
			// Fall through to npm install — the copy failed (permissions,
			// stale symlinks, etc.) but a fresh install may succeed.
			void err
		}
	}

	// Slow path: ask npm to fetch the exact version we're running.
	const npmCacheDir = join(homedir(), ".claude", "plugins", "npm-cache")
	try {
		mkdirSync(npmCacheDir, { recursive: true })
		execFileSync(
			"npm",
			["install", `haiku-method@${MCP_VERSION}`, "--prefix", npmCacheDir],
			{ encoding: "utf8", timeout: 60_000, stdio: "pipe" },
		)
		if (!existsSync(npmCachePath)) {
			return {
				ok: false,
				method: "npm-install",
				reason: "npm_install_no_module",
			}
		}
		mkdirSync(target, { recursive: true })
		cpSync(npmCachePath, target, { recursive: true, force: true })
		return { ok: true, method: "npm-install" }
	} catch (err) {
		return {
			ok: false,
			method: "npm-install",
			reason: "npm_install_failed",
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

/** Top-level integrity check. Throttled to CHECK_THROTTLE_MS so the
 *  fsync-on-every-call cost stays negligible. Returns true when the
 *  plugin is intact (or was just successfully repaired). Fires Sentry
 *  on every removal detection AND on every repair attempt result so
 *  we can quantify how often this is happening in production. */
export function checkPluginIntegrity(sessionCtx?: Record<string, string>): {
	ok: boolean
	repaired: boolean
	result?: RepairResult
} {
	const now = Date.now()
	if (now - _lastGoodCheck < CHECK_THROTTLE_MS) {
		return { ok: true, repaired: false }
	}

	const detection = detectPluginRemoval()
	if (!detection.removed) {
		_lastGoodCheck = now
		return { ok: true, repaired: false }
	}

	// Removal detected — fire Sentry first (before attempting repair so
	// the report lands even if repair throws).
	reportError(
		new Error(
			`Haiku plugin dir missing during tool call: ${detection.missingPaths.join(", ")}`,
		),
		{
			context: "plugin-self-repair-detected",
			plugin_root: detection.root,
			missing_paths: detection.missingPaths,
			mcp_version: MCP_VERSION,
		},
		sessionCtx,
	)

	const result = attemptSelfRepair()

	// Always report the repair attempt outcome — both success (so we
	// can see how often the fast path vs slow path fires) and failure
	// (so users with broken npm setups get surfaced).
	reportError(
		new Error(
			`Haiku plugin self-repair ${result.ok ? "succeeded" : "failed"} (${result.method})`,
		),
		{
			context: "plugin-self-repair-result",
			ok: result.ok,
			method: result.method,
			reason: result.reason,
			error: result.error,
			mcp_version: MCP_VERSION,
		},
		sessionCtx,
	)

	if (result.ok) _lastGoodCheck = now
	return { ok: result.ok, repaired: result.ok, result }
}
