// view-boot.ts — Subprocess supervisor for `haiku_view` boot mode.
//
// Boot mode spawns the project's own dev server (npm/bun/yarn/pnpm
// `dev` or `start`), captures the port the child binds, and returns
// a `http://127.0.0.1:<port>/` URL the caller hands to playwright.
//
// Lifecycle is layered, in order of preference:
//   1. Explicit close — `haiku_view_close` calls killBootSession()
//   2. TTL — a per-session timer (BOOT_TTL_MS) kills the child if no
//      `haiku_view_close` arrives.
//   3. Tick-end sweep — `killAllOrphanedBootSessions()` is callable
//      from the workflow engine's tick boundary to reap any session
//      whose session_id no longer maps to a live session in the
//      registry.
//   4. Process exit — `process.on("exit")` registers a best-effort
//      SIGTERM on every tracked child so an MCP crash doesn't leak
//      dev servers.

import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createServer } from "node:net"
import { join } from "node:path"
import { getSession } from "./sessions.js"

interface BootSession {
	sessionId: string
	child: ChildProcess
	port: number
	command: string
	startedAt: number
	ttlTimer: NodeJS.Timeout
}

const bootSessions = new Map<string, BootSession>()

/** 30-minute TTL — the runtime-verifier mandates expect quick runs.
 *  If a session lives past this without an explicit close, something
 *  has gone wrong; kill the child rather than leak a dev server. */
const BOOT_TTL_MS = 30 * 60 * 1000
/** How long to poll the captured port before giving up on the dev
 *  server. Most dev servers are listening within 10s; the cap is
 *  generous so first-run installs (e.g. cold next.config compile)
 *  still succeed. */
const BOOT_READY_TIMEOUT_MS = 60 * 1000
const BOOT_READY_POLL_INTERVAL_MS = 200

/**
 * Allocate an ephemeral port by binding 0 and immediately closing.
 * Race-y in principle (another process could claim the port between
 * our close and the child's bind), in practice fine — the gap is
 * microseconds and the operating system's port-allocation algorithm
 * does not hand out the same number twice in quick succession.
 */
function pickEphemeralPort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer()
		server.unref()
		server.on("error", reject)
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address()
			if (typeof addr !== "object" || addr === null) {
				server.close()
				reject(new Error("could not determine ephemeral port"))
				return
			}
			const port = addr.port
			server.close(() => resolve(port))
		})
	})
}

/**
 * Probe the local port. Resolves true when something is accepting
 * TCP connections (the dev server is up), false otherwise.
 */
function isPortAcceptingConnections(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const { Socket } = require("node:net") as typeof import("node:net")
		const socket = new Socket()
		socket.setTimeout(500)
		socket.once("connect", () => {
			socket.destroy()
			resolve(true)
		})
		socket.once("timeout", () => {
			socket.destroy()
			resolve(false)
		})
		socket.once("error", () => {
			socket.destroy()
			resolve(false)
		})
		socket.connect(port, "127.0.0.1")
	})
}

async function waitForPort(port: number, signal?: AbortSignal): Promise<void> {
	const deadline = Date.now() + BOOT_READY_TIMEOUT_MS
	while (Date.now() < deadline) {
		if (signal?.aborted) throw new Error("waitForPort aborted")
		if (await isPortAcceptingConnections(port)) return
		await new Promise((r) => setTimeout(r, BOOT_READY_POLL_INTERVAL_MS))
	}
	throw new Error(
		`Dev server did not bind to port ${port} within ${BOOT_READY_TIMEOUT_MS}ms`,
	)
}

export interface BootDetection {
	/** The command to spawn (e.g. ["npm", "run", "dev"]) */
	command: string[]
	/** Working directory for the child. */
	cwd: string
	/** Human-readable description for diagnostics. */
	description: string
}

/**
 * Detect what dev command to run in `cwd`. Returns null when no
 * bootable target is detectable (the caller should fall back to
 * viewer mode or return a structured "no boot target" error).
 *
 * Detection precedence:
 *   1. `package.json` with a `dev` script   → run via the package
 *      manager indicated by the lockfile (bun → bun, pnpm → pnpm,
 *      yarn → yarn, else npm).
 *   2. `package.json` with a `start` script → same as above.
 *
 * Stage-FM `preview:` declarations are a followup — for now boot
 * mode only consults package.json scripts in the intent dir.
 */
export function detectBootTarget(cwd: string): BootDetection | null {
	const pkgPath = join(cwd, "package.json")
	if (!existsSync(pkgPath)) return null
	let pkg: { scripts?: Record<string, unknown> }
	try {
		pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
			scripts?: Record<string, unknown>
		}
	} catch {
		return null
	}
	const scripts = pkg.scripts ?? {}
	const script = typeof scripts.dev === "string"
		? "dev"
		: typeof scripts.start === "string"
			? "start"
			: null
	if (!script) return null

	const pm = detectPackageManager(cwd)
	const command = pm === "npm"
		? ["npm", "run", script]
		: [pm, "run", script]
	return {
		command,
		cwd,
		description: `${pm} run ${script}`,
	}
}

function detectPackageManager(cwd: string): "bun" | "pnpm" | "yarn" | "npm" {
	if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
		return "bun"
	}
	if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm"
	if (existsSync(join(cwd, "yarn.lock"))) return "yarn"
	return "npm"
}

export interface SpawnedBoot {
	port: number
	command: string
	pid: number
}

/**
 * Spawn the dev command on a captured port, wait until the child
 * binds, and register the session for lifecycle cleanup. Throws if
 * the child fails to bind within BOOT_READY_TIMEOUT_MS.
 */
export async function spawnBoot(
	sessionId: string,
	detection: BootDetection,
): Promise<SpawnedBoot> {
	const port = await pickEphemeralPort()
	const [cmd, ...args] = detection.command
	if (!cmd) throw new Error("detectBootTarget returned empty command")
	// PORT is the de-facto convention every modern dev server reads
	// (Next, Vite, Webpack, Express, Fastify, Hono, …). Set it on the
	// child env so the dev server actually binds where we expect.
	const child = spawn(cmd, args, {
		cwd: detection.cwd,
		env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
		stdio: "ignore",
		detached: false,
	})

	child.on("error", (err) => {
		console.error(
			`[haiku-view-boot] dev server (${detection.description}) spawn error:`,
			err.message,
		)
	})

	const ttlTimer = setTimeout(() => {
		console.error(
			`[haiku-view-boot] TTL hit for session ${sessionId} — killing dev server`,
		)
		killBootSession(sessionId)
	}, BOOT_TTL_MS)
	ttlTimer.unref?.()

	const record: BootSession = {
		sessionId,
		child,
		port,
		command: detection.description,
		startedAt: Date.now(),
		ttlTimer,
	}
	bootSessions.set(sessionId, record)

	try {
		await waitForPort(port)
	} catch (err) {
		// Child never bound — kill it and surface the failure to the
		// caller so haiku_view can return a structured error rather
		// than handing the agent a URL that 502s.
		killBootSession(sessionId)
		throw err
	}

	return { port, command: detection.description, pid: child.pid ?? -1 }
}

/**
 * Kill the spawned dev server (if any) and forget the session.
 * Idempotent.
 */
export function killBootSession(sessionId: string): boolean {
	const record = bootSessions.get(sessionId)
	if (!record) return false
	clearTimeout(record.ttlTimer)
	bootSessions.delete(sessionId)
	try {
		record.child.kill("SIGTERM")
	} catch {
		// Already dead — fine.
	}
	// Belt-and-suspenders: SIGKILL after 2s if SIGTERM didn't take.
	const sigkillTimer = setTimeout(() => {
		try {
			record.child.kill("SIGKILL")
		} catch {
			// Already dead — fine.
		}
	}, 2000)
	sigkillTimer.unref?.()
	return true
}

/**
 * Sweep all boot sessions whose owning view-session no longer
 * exists in the in-memory registry. Called from the workflow
 * engine's tick boundary; safe to call from anywhere.
 */
export function killAllOrphanedBootSessions(): number {
	let killed = 0
	for (const [sessionId] of bootSessions) {
		if (!getSession(sessionId)) {
			killBootSession(sessionId)
			killed += 1
		}
	}
	return killed
}

/** Number of live boot sessions — for debug + test assertions. */
export function liveBootSessionCount(): number {
	return bootSessions.size
}

// Best-effort cleanup on MCP process exit. Won't fire on SIGKILL
// (nothing does) but covers Ctrl+C, normal shutdown, and uncaught
// exceptions that propagate through the default handler.
let exitHookInstalled = false
function installExitHook(): void {
	if (exitHookInstalled) return
	exitHookInstalled = true
	const reap = () => {
		for (const [sessionId] of bootSessions) {
			killBootSession(sessionId)
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
installExitHook()
