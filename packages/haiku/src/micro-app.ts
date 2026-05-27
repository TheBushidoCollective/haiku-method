// micro-app.ts — pop the review SPA as a chrome-less micro-app window.
//
// Instead of handing the review URL to the OS default browser (`open` /
// `xdg-open` / `Start-Process`), which grabs whatever Chrome profile the
// user last touched and drops the SPA into a tab alongside their real
// browsing, we launch a Chromium-family browser in app-mode against a
// clean, per-session profile dir. That gives the SPA a standalone window
// — no tabs, no address bar, no bookmarks bar, its own dock/taskbar
// entry — so it feels like a native micro-app. The dedicated profile
// means no extensions, no profile picker, no cross-talk with the user's
// real browser. And because we own the child process, we can close the
// window when the gate resolves.
//
// No new npm dependency and no bundling hazard. We do NOT import the
// Playwright library — it resolves its browser registry + driver
// relative to its own install dir at runtime and can't be bundled into
// the single-file MCP. Instead we discover an EXISTING Chromium binary
// (Playwright's cached build, installed by the bundled @playwright/mcp,
// is preferred because it's version-stable and isolated from the user's
// install; then a system Chrome / Chromium / Edge / Brave) and drive its
// CLI flags directly.
//
// Degrades safely: when no Chromium-family binary exists, the host is
// headless, or the user opted out (HAIKU_DISABLE_MICRO_APP=1),
// launchMicroApp returns false and the caller falls back to the OS-open
// + URL-log path that always worked.
//
// Lifecycle mirrors view-boot.ts: tracked child per session, SIGTERM →
// SIGKILL on close, a tick-boundary orphan sweep, and a process-exit
// reaper so an MCP crash doesn't leak browser windows.

import { type ChildProcess, spawn } from "node:child_process"
import {
	accessSync,
	constants,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { getSession } from "./sessions.js"

// ── Default micro-app window geometry ──────────────────────────────────
// App-sized, not full-screen — it should read as a focused tool window,
// not a browser. Chrome centers app windows on the active display.
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 860

interface MicroAppRecord {
	child: ChildProcess
	profileDir: string
}

const liveApps = new Map<string, MicroAppRecord>()

// Discovery is memoized — the executable set doesn't change during a
// process lifetime. `null` means "looked and found nothing"; `undefined`
// means "not looked yet".
let resolvedExecutable: string | null | undefined

/** Reset the memoized executable lookup. TEST ONLY. */
export function _resetMicroAppDiscoveryForTests(): void {
	resolvedExecutable = undefined
}

// ── Browser discovery (pure) ───────────────────────────────────────────

/** The highest-versioned full Chromium build in Playwright's browser
 *  cache, or null. We deliberately skip `chromium_headless_shell-*` —
 *  the headless shell can't open a visible window, and `@playwright/mcp
 *  --headless` may install only that variant. */
export function playwrightChromiumPath(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
	readDir: (dir: string) => string[] = (dir) => {
		try {
			return readdirSync(dir)
		} catch {
			return []
		}
	},
): string | null {
	const cacheRoot =
		env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== "0"
			? env.PLAYWRIGHT_BROWSERS_PATH
			: platform === "darwin"
				? join(home, "Library", "Caches", "ms-playwright")
				: platform === "win32"
					? join(home, "AppData", "Local", "ms-playwright")
					: join(home, ".cache", "ms-playwright")

	const builds = readDir(cacheRoot)
		.filter((name) => /^chromium-\d+$/.test(name))
		.sort((a, b) => {
			const av = Number.parseInt(a.slice("chromium-".length), 10)
			const bv = Number.parseInt(b.slice("chromium-".length), 10)
			return bv - av
		})
	if (builds.length === 0) return null

	const build = builds[0] as string
	const rel =
		platform === "darwin"
			? join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium")
			: platform === "win32"
				? join("chrome-win", "chrome.exe")
				: join("chrome-linux", "chrome")
	return join(cacheRoot, build, rel)
}

/** System Chromium-family executable candidates, in priority order, for
 *  the given platform. Absolute paths for mac/win; bare command names for
 *  linux (resolved against PATH by the caller). */
export function systemChromiumCandidates(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
): string[] {
	if (platform === "darwin") {
		return [
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
		]
	}
	if (platform === "win32") {
		const pf = env.PROGRAMFILES || "C:\\Program Files"
		const pf86 = env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)"
		const local = env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
		return [
			join(pf, "Google\\Chrome\\Application\\chrome.exe"),
			join(pf86, "Google\\Chrome\\Application\\chrome.exe"),
			join(local, "Google\\Chrome\\Application\\chrome.exe"),
			join(pf, "Microsoft\\Edge\\Application\\msedge.exe"),
			join(pf86, "Microsoft\\Edge\\Application\\msedge.exe"),
			join(pf, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
		]
	}
	// linux + other unix — resolved against PATH by resolveOnPath.
	return [
		"google-chrome",
		"google-chrome-stable",
		"chromium",
		"chromium-browser",
		"microsoft-edge",
		"microsoft-edge-stable",
		"brave-browser",
	]
}

/** Resolve a bare command name to an absolute path by scanning PATH.
 *  Returns null when not found. Absolute inputs are returned as-is. */
function resolveOnPath(
	name: string,
	env: NodeJS.ProcessEnv,
	isFile: (p: string) => boolean,
): string | null {
	if (name.includes("/") || name.includes("\\")) {
		return isFile(name) ? name : null
	}
	const pathVar = env.PATH || ""
	for (const dir of pathVar.split(":")) {
		if (!dir) continue
		const full = join(dir, name)
		if (isFile(full)) return full
	}
	return null
}

/** Find a usable Chromium-family executable, preferring Playwright's
 *  cached build (version-stable, isolated from the user's install) over
 *  a system browser. Returns null when none is found. */
export function findChromiumExecutable(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	isExecutable: (p: string) => boolean = (p) => {
		try {
			accessSync(p, constants.X_OK)
			return true
		} catch {
			return existsSync(p)
		}
	},
	readDir?: (dir: string) => string[],
): string | null {
	// Explicit override always wins (a user pointing at a specific build).
	const override = env.HAIKU_MICRO_APP_BROWSER
	if (override) return isExecutable(override) ? override : null

	const pw = playwrightChromiumPath(platform, env, homedir(), readDir)
	if (pw && isExecutable(pw)) return pw

	for (const candidate of systemChromiumCandidates(platform, env)) {
		const resolved = resolveOnPath(candidate, env, isExecutable)
		if (resolved) return resolved
	}
	return null
}

/** Memoized capability probe. */
export function microAppExecutable(): string | null {
	if (resolvedExecutable === undefined) {
		resolvedExecutable = findChromiumExecutable()
	}
	return resolvedExecutable
}

/** True when a micro-app window can be opened on this host. False on a
 *  headless host with no Chromium-family binary, or when disabled. */
export function isMicroAppCapable(): boolean {
	if (process.env.HAIKU_DISABLE_MICRO_APP === "1") return false
	return microAppExecutable() !== null
}

// ── Launch arg construction (pure) ─────────────────────────────────────

/** The Chromium CLI flags that turn a review URL into a clean micro-app
 *  window. `--app` strips the tab strip / address bar / bookmarks;
 *  `--user-data-dir` isolates the profile (no picker, no extensions, no
 *  cross-talk); the rest suppress first-run nags and background chatter
 *  so the window opens straight onto the SPA. */
export function buildMicroAppArgs(
	url: string,
	profileDir: string,
	width = DEFAULT_WIDTH,
	height = DEFAULT_HEIGHT,
): string[] {
	return [
		`--app=${url}`,
		`--user-data-dir=${profileDir}`,
		`--window-size=${width},${height}`,
		"--no-first-run",
		"--no-default-browser-check",
		"--no-service-autorun",
		"--disable-background-networking",
		"--disable-component-update",
		"--disable-sync",
		"--disable-extensions",
	]
}

/** Per-session profile dir under the OS temp tree. Ephemeral by design —
 *  removed on close so each review starts from a clean window. A unique
 *  dir per session also sidesteps Chromium's single-instance behavior
 *  (re-launching against a profile that's already running just signals
 *  the existing process and exits, which would lose our child handle). */
export function microAppProfileDir(
	sessionId: string,
	base: string = join(tmpdir(), "haiku-micro-app"),
): string {
	return join(base, sessionId)
}

// ── Lifecycle (impure) ─────────────────────────────────────────────────

/**
 * Launch the SPA as a micro-app window. Returns true when a window was
 * popped (or one is already open for this session), false when the host
 * can't — the caller then falls back to the OS-open path.
 */
export function launchMicroApp(
	url: string,
	opts: { sessionId?: string; width?: number; height?: number } = {},
): boolean {
	if (!isMicroAppCapable()) return false
	const exe = microAppExecutable()
	if (!exe) return false

	const key =
		opts.sessionId ??
		`anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

	// Reuse: a live window for this session is already showing the SPA —
	// don't spawn a second one (gate cycle 2 reusing the same tab).
	const existing = liveApps.get(key)
	if (existing && existing.child.exitCode === null && !existing.child.killed) {
		return true
	}

	const profileDir = microAppProfileDir(key)
	try {
		mkdirSync(profileDir, { recursive: true })
	} catch {
		// Can't create the profile dir → let the caller fall back.
		return false
	}

	try {
		const child = spawn(
			exe,
			buildMicroAppArgs(url, profileDir, opts.width, opts.height),
			{ stdio: "ignore", detached: false },
		)
		child.on("error", (err) => {
			console.error(
				`[haiku-micro-app] launch error (${exe}): ${err.message}. ` +
					"The review URL is still printed above — open it manually.",
			)
			liveApps.delete(key)
			cleanupProfileDir(profileDir)
		})
		liveApps.set(key, { child, profileDir })
		installExitHook()
		return true
	} catch (err) {
		console.error(
			`[haiku-micro-app] spawn threw: ${err instanceof Error ? err.message : String(err)}`,
		)
		cleanupProfileDir(profileDir)
		return false
	}
}

function cleanupProfileDir(profileDir: string): void {
	try {
		rmSync(profileDir, { recursive: true, force: true })
	} catch {
		// Best-effort — OS temp cleaning will get it eventually.
	}
}

/**
 * Close the micro-app window for a session and remove its profile dir.
 * Idempotent — a no-op when no window is tracked for the session.
 */
export function closeMicroApp(sessionId: string): boolean {
	const record = liveApps.get(sessionId)
	if (!record) return false
	liveApps.delete(sessionId)
	try {
		record.child.kill("SIGTERM")
	} catch {
		// Already gone.
	}
	const sigkillTimer = setTimeout(() => {
		try {
			record.child.kill("SIGKILL")
		} catch {
			// Already gone.
		}
	}, 2000)
	sigkillTimer.unref?.()
	cleanupProfileDir(record.profileDir)
	return true
}

/**
 * Close every micro-app window whose owning session no longer exists in
 * the in-memory registry. Called at the workflow tick boundary, mirroring
 * killAllOrphanedBootSessions. Anonymous windows (launched without a
 * session id) are left to the process-exit reaper.
 */
export function killAllOrphanedMicroApps(): number {
	let killed = 0
	for (const [key] of liveApps) {
		if (key.startsWith("anon-")) continue
		if (!getSession(key)) {
			closeMicroApp(key)
			killed += 1
		}
	}
	return killed
}

/** Live micro-app window count — for debug + test assertions. */
export function liveMicroAppCount(): number {
	return liveApps.size
}

// Best-effort cleanup on MCP process exit. Won't fire on SIGKILL, but
// covers Ctrl+C, normal shutdown, and propagated uncaught exceptions —
// so an MCP crash doesn't leave orphaned browser windows on the user's
// desktop.
let exitHookInstalled = false
function installExitHook(): void {
	if (exitHookInstalled) return
	exitHookInstalled = true
	const reap = () => {
		for (const [key] of liveApps) {
			closeMicroApp(key)
		}
	}
	process.on("exit", reap)
	process.on("SIGINT", () => {
		reap()
		process.exit(130)
	})
	process.on("SIGTERM", () => {
		reap()
		process.exit(143)
	})
}
