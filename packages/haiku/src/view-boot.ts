// view-boot.ts — Process-group supervisor for `haiku_view` boot mode.
//
// Boot mode brings a project's runnable stack up: anywhere from one
// process (a Vite dev server, a uvicorn app) to a full graph
// (postgres → api → frontend, with a queue worker on the side). The
// supervisor allocates ephemeral ports, starts in dependency order,
// waits for each process to be ready, injects service-discovery env
// vars (`<NAME>_PORT`, `<NAME>_URL`) into dependents, and returns the
// primary process's URL for Playwright to drive.
//
// The agent supplies the process declarations — it just inspected
// the project and knows whether the stack is a single npm script, a
// Rails `bin/dev`, a Go server fronted by a React app, or a four-
// process monorepo. The engine doesn't try to guess by convention
// beyond a single fast-path: a `package.json` with a `dev`/`start`
// script. Every other shape: the agent declares, the engine runs.
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
import { dirname, isAbsolute, join } from "node:path"
import matter from "gray-matter"
import { getSession } from "./sessions.js"

interface BootProcess {
	name: string
	child: ChildProcess
	port: number | null
	command: string
	cwd: string
}

interface BootSession {
	sessionId: string
	processes: BootProcess[]
	primaryName: string | null
	primaryPort: number | null
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

/**
 * GET `url` and resolve true on any 2xx-4xx response (the server is
 * up and answering; 404 still means "alive"). Resolves false on
 * connection errors, timeouts, or 5xx. Used for health-check polling
 * when a process declares `ready_url`.
 */
async function probeReadyUrl(url: string): Promise<boolean> {
	try {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 1500)
		const res = await fetch(url, { signal: controller.signal })
		clearTimeout(timeout)
		return res.status < 500
	} catch {
		return false
	}
}

async function waitForReadyUrl(
	url: string,
	signal?: AbortSignal,
): Promise<void> {
	const deadline = Date.now() + BOOT_READY_TIMEOUT_MS
	while (Date.now() < deadline) {
		if (signal?.aborted) throw new Error("waitForReadyUrl aborted")
		if (await probeReadyUrl(url)) return
		await new Promise((r) => setTimeout(r, BOOT_READY_POLL_INTERVAL_MS))
	}
	throw new Error(
		`Process did not return a healthy ready_url (${url}) within ${BOOT_READY_TIMEOUT_MS}ms`,
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
 * Build a `BootDetection` from an agent-supplied command. The agent
 * just inspected the project and knows the runnable shape — engine
 * trusts it. Use this when `haiku_view` was called with an explicit
 * `command` argument.
 */
export function bootFromAgent(
	command: string[],
	cwd: string,
): BootDetection {
	if (command.length === 0) {
		throw new Error("bootFromAgent: command must have at least one entry")
	}
	return {
		command,
		cwd,
		description: command.join(" "),
	}
}

/**
 * Fast-path detection for the JS-ecosystem case: a `package.json`
 * with a `dev` or `start` script. Returns null for every other
 * stack — the agent is expected to supply `command` explicitly via
 * `haiku_view`'s input schema. We deliberately don't try to detect
 * Python / Ruby / Go / Rust / Make / Procfile / etc., because the
 * agent has full project context (README, lockfiles, source tree)
 * and will choose better than any heuristic the engine could carry.
 *
 * Detection precedence (when no explicit command is supplied):
 *   1. `package.json` with a `dev` script   → run via the package
 *      manager indicated by the lockfile (bun → bun, pnpm → pnpm,
 *      yarn → yarn, else npm).
 *   2. `package.json` with a `start` script → same as above.
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

/**
 * A single process declaration the supervisor will spawn as part of
 * a boot session. Multiple of these compose a stack.
 */
export interface BootProcessSpec {
	name: string
	command: string[]
	cwd: string
	port_env?: string
	ready_url?: string
	depends_on?: string[]
	no_port?: boolean
	/** Extra environment for this process (e.g. `RAILS_ENV: development`).
	 *  Merged UNDER the engine-managed vars (HOST / PORT / dependency
	 *  discovery) so a recipe can configure the app without clobbering the
	 *  port the supervisor allocated. */
	env?: Record<string, string>
}

export interface SpawnedBootProcess {
	name: string
	port: number | null
	command: string
	pid: number
}

export interface SpawnedBoot {
	processes: SpawnedBootProcess[]
	primary: SpawnedBootProcess
}

/** A resolved project boot recipe — always normalized to a process
 *  group (a single `command:` becomes a one-process group named "app")
 *  so every boot path runs through the same supervisor with uniform
 *  env / readiness / port handling. */
export interface BootRecipe {
	processes: BootProcessSpec[]
	primary: string
}

const BOOT_RECIPE_FILE = ".haiku/boot.md"

function recipeError(msg: string): Error {
	return new Error(`[${BOOT_RECIPE_FILE}] ${msg}`)
}

function asStringArray(v: unknown, where: string): string[] {
	if (
		!Array.isArray(v) ||
		v.length === 0 ||
		!v.every((x) => typeof x === "string" && x.length > 0)
	) {
		throw recipeError(`${where} must be a non-empty array of strings`)
	}
	return v as string[]
}

/**
 * Read and resolve the project boot recipe at `<projectRoot>/.haiku/boot.md`.
 * The harness-agnostic analog of a committed run-skill: the project author
 * declares — once — how to boot/drive this app, and every agent on every
 * harness boots it the same way without rediscovering it. The frontmatter
 * is the machine-readable recipe; the markdown body is human/agent drive
 * notes (which routes matter, gotchas) the runtime-verifier reads.
 *
 * Frontmatter (single-process form):
 *   command: [bin/dev]        # required for the single form
 *   cwd: web                  # optional, relative to project root
 *   env: { RAILS_ENV: development }   # optional
 *   ready_url: http://127.0.0.1:{port}/up   # optional; {port} is substituted
 *   port_env: PORT            # optional, defaults to PORT
 *
 * Frontmatter (multi-process form — takes precedence over `command`):
 *   processes:
 *     - { name: api, command: [bin/rails, server], port_env: PORT,
 *         ready_url: "http://127.0.0.1:{port}/up", cwd: api }
 *     - { name: web, command: [npm, run, dev], depends_on: [api] }
 *   primary: web              # which process Playwright drives; inferred
 *                             # when exactly one is port-bound
 *
 * Returns null when the file is absent or declares nothing runnable
 * (a notes-only recipe). Throws a descriptive error when the file is
 * present but structurally invalid, so the author gets a clear signal
 * rather than a silent fallthrough to auto-detection.
 */
export function readBootRecipe(projectRoot: string): BootRecipe | null {
	const path = join(projectRoot, BOOT_RECIPE_FILE)
	if (!existsSync(path)) return null
	let data: Record<string, unknown>
	try {
		data = matter(readFileSync(path, "utf8")).data
	} catch (err) {
		throw recipeError(
			`could not parse frontmatter: ${err instanceof Error ? err.message : String(err)}`,
		)
	}

	const resolveCwd = (c: unknown): string => {
		if (c === undefined || c === null) return projectRoot
		if (typeof c !== "string") throw recipeError("`cwd` must be a string")
		return isAbsolute(c) ? c : join(projectRoot, c)
	}
	const asEnv = (e: unknown): Record<string, string> | undefined => {
		if (e === undefined || e === null) return undefined
		if (typeof e !== "object" || Array.isArray(e)) {
			throw recipeError("`env` must be a mapping of string→string")
		}
		const out: Record<string, string> = {}
		for (const [k, val] of Object.entries(e as Record<string, unknown>)) {
			out[k] = String(val)
		}
		return out
	}

	// Multi-process form wins when present.
	if (Array.isArray(data.processes) && data.processes.length > 0) {
		const specs: BootProcessSpec[] = (
			data.processes as Array<Record<string, unknown>>
		).map((p, i) => {
			if (typeof p?.name !== "string" || !p.name) {
				throw recipeError(`processes[${i}] is missing a string \`name\``)
			}
			return {
				name: p.name,
				command: asStringArray(p.command, `processes[${i}].command`),
				cwd: resolveCwd(p.cwd),
				port_env: typeof p.port_env === "string" ? p.port_env : undefined,
				ready_url: typeof p.ready_url === "string" ? p.ready_url : undefined,
				depends_on: Array.isArray(p.depends_on)
					? (p.depends_on as unknown[]).map(String)
					: undefined,
				no_port: p.no_port === true,
				env: asEnv(p.env),
			}
		})
		const portBound = specs.filter((s) => !s.no_port)
		let primary: string
		if (typeof data.primary === "string" && data.primary) {
			primary = data.primary
		} else if (portBound.length === 1) {
			primary = portBound[0].name
		} else {
			throw recipeError(
				`\`processes\` has ${portBound.length} port-bound entries (${portBound.map((s) => s.name).join(", ")}); set \`primary: <name>\` to name the one Playwright should drive`,
			)
		}
		const names = new Set(specs.map((s) => s.name))
		if (!names.has(primary)) {
			throw recipeError(
				`\`primary: ${primary}\` does not match any process name (${[...names].join(", ")})`,
			)
		}
		if (specs.find((s) => s.name === primary)?.no_port) {
			throw recipeError(`\`primary: ${primary}\` cannot be a no_port process`)
		}
		return { processes: specs, primary }
	}

	// Single-process form.
	if (data.command !== undefined) {
		if (data.no_port === true) {
			throw recipeError(
				"a single-`command` recipe drives a URL, so it cannot set `no_port: true` — use the `processes` form for a portless helper",
			)
		}
		const spec: BootProcessSpec = {
			name: "app",
			command: asStringArray(data.command, "`command`"),
			cwd: resolveCwd(data.cwd),
			port_env: typeof data.port_env === "string" ? data.port_env : undefined,
			ready_url:
				typeof data.ready_url === "string" ? data.ready_url : undefined,
			env: asEnv(data.env),
		}
		return { processes: [spec], primary: "app" }
	}

	// File exists but declares nothing runnable (notes-only) — treat as
	// absent so the caller falls through to auto-detection.
	return null
}

function topoSort(specs: BootProcessSpec[]): BootProcessSpec[] {
	const byName = new Map(specs.map((s) => [s.name, s]))
	const visiting = new Set<string>()
	const visited = new Set<string>()
	const order: BootProcessSpec[] = []
	const visit = (name: string, path: string[]) => {
		if (visited.has(name)) return
		if (visiting.has(name)) {
			throw new Error(
				`Cyclic depends_on in boot processes: ${[...path, name].join(" → ")}`,
			)
		}
		const spec = byName.get(name)
		if (!spec) {
			throw new Error(
				`depends_on references unknown process "${name}" (referenced from "${path.at(-1) ?? "?"}")`,
			)
		}
		visiting.add(name)
		for (const dep of spec.depends_on ?? []) visit(dep, [...path, name])
		visiting.delete(name)
		visited.add(name)
		order.push(spec)
	}
	for (const spec of specs) visit(spec.name, [])
	return order
}

/**
 * Bring an entire process group up: allocate ports, start in
 * dependency order, wait for each to be ready, inject service-
 * discovery env vars into dependents, and register the session for
 * lifecycle cleanup. Killing the session kills every child.
 */
export async function spawnBootGroup(
	sessionId: string,
	specs: BootProcessSpec[],
	primaryName: string,
): Promise<SpawnedBoot> {
	if (specs.length === 0) {
		throw new Error("spawnBootGroup: at least one process spec required")
	}
	const ordered = topoSort(specs)

	// Allocate ports up front so a depends_on can see the dependency's
	// port via env injection before the dependency has finished its
	// readiness check. Order: declared order (not topo order) — the
	// port allocation is just a number, not a binding.
	const ports = new Map<string, number | null>()
	for (const spec of specs) {
		ports.set(spec.name, spec.no_port ? null : await pickEphemeralPort())
	}

	const primary = specs.find((s) => s.name === primaryName)
	if (!primary) {
		throw new Error(`primary "${primaryName}" not found in process group`)
	}
	if (primary.no_port) {
		throw new Error(`primary "${primaryName}" cannot have no_port: true`)
	}

	const ttlTimer = setTimeout(() => {
		console.error(
			`[haiku-view-boot] TTL hit for session ${sessionId} — killing process group`,
		)
		killBootSession(sessionId)
	}, BOOT_TTL_MS)
	ttlTimer.unref?.()

	const record: BootSession = {
		sessionId,
		processes: [],
		primaryName,
		primaryPort: ports.get(primaryName) ?? null,
		startedAt: Date.now(),
		ttlTimer,
	}
	bootSessions.set(sessionId, record)

	try {
		for (const spec of ordered) {
			const port = ports.get(spec.name) ?? null
			const portEnv = spec.port_env ?? "PORT"
			// Build env: base + recipe-declared env + engine-managed vars.
			// Recipe env sits UNDER HOST/PORT/discovery so the supervisor's
			// allocated port always wins.
			const env: NodeJS.ProcessEnv = {
				...process.env,
				...(spec.env ?? {}),
				HOST: "127.0.0.1",
			}
			if (port !== null) env[portEnv] = String(port)
			for (const depName of spec.depends_on ?? []) {
				const depPort = ports.get(depName)
				if (depPort !== null && depPort !== undefined) {
					const upper = depName.toUpperCase().replace(/-/g, "_")
					env[`${upper}_PORT`] = String(depPort)
					env[`${upper}_URL`] = `http://127.0.0.1:${depPort}`
				}
			}

			const [cmd, ...args] = spec.command
			if (!cmd) throw new Error(`process "${spec.name}" has empty command`)
			const child = spawn(cmd, args, {
				cwd: spec.cwd,
				env,
				stdio: "ignore",
				detached: false,
			})
			const description = spec.command.join(" ")
			child.on("error", (err) => {
				console.error(
					`[haiku-view-boot] process "${spec.name}" (${description}) spawn error:`,
					err.message,
				)
			})

			record.processes.push({
				name: spec.name,
				child,
				port,
				command: description,
				cwd: spec.cwd,
			})

			if (port !== null) {
				if (spec.ready_url) {
					const url = spec.ready_url.replace("{port}", String(port))
					await waitForReadyUrl(url)
				} else {
					await waitForPort(port)
				}
			}
		}
	} catch (err) {
		killBootSession(sessionId)
		throw err
	}

	const spawnedProcesses: SpawnedBootProcess[] = record.processes.map((p) => ({
		name: p.name,
		port: p.port,
		command: p.command,
		pid: p.child.pid ?? -1,
	}))
	const spawnedPrimary = spawnedProcesses.find((p) => p.name === primaryName)
	if (!spawnedPrimary) {
		// Shouldn't happen — topoSort + primary validation above guarantee it,
		// but the TypeScript narrowing needs the check.
		throw new Error(`primary "${primaryName}" missing from spawned set`)
	}

	return { processes: spawnedProcesses, primary: spawnedPrimary }
}

/**
 * Single-process convenience: wrap one `BootDetection` as a one-
 * process group whose only entry is the primary. Existing callers
 * that hand a single detection in get the same behavior they had
 * before the process-group refactor.
 */
export async function spawnBoot(
	sessionId: string,
	detection: BootDetection,
): Promise<SpawnedBootProcess> {
	const spec: BootProcessSpec = {
		name: "app",
		command: detection.command,
		cwd: detection.cwd,
	}
	const group = await spawnBootGroup(sessionId, [spec], "app")
	return group.primary
}

/**
 * Kill every spawned process in the session and forget the session.
 * Idempotent.
 */
export function killBootSession(sessionId: string): boolean {
	const record = bootSessions.get(sessionId)
	if (!record) return false
	clearTimeout(record.ttlTimer)
	bootSessions.delete(sessionId)
	// Kill in reverse-start order so dependents go down before their
	// dependencies (matches docker-compose / overmind convention).
	for (const proc of [...record.processes].reverse()) {
		try {
			proc.child.kill("SIGTERM")
		} catch {
			// Already dead — fine.
		}
		const sigkillTimer = setTimeout(() => {
			try {
				proc.child.kill("SIGKILL")
			} catch {
				// Already dead — fine.
			}
		}, 2000)
		sigkillTimer.unref?.()
	}
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
