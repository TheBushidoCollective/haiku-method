// capabilities.ts — ambient PROJECT-tool detection.
//
// The analog of `harness.ts` for tools that live in the project's runtime
// environment (Docker, docker compose, make) rather than the AI harness.
// Quality gates and the service-dependency doctrine ask "is this tool LIVE
// right now?" to decide whether the agent can bring a declared service
// (a database, a queue) up before running a gate that needs it.
//
// Why "live" not "installed": a gate that needs Postgres-in-Docker can only
// be satisfied if the Docker *daemon* is reachable — the `docker` binary
// existing in a CI image whose daemon is dead is a false positive that would
// send the agent off to `docker compose up` against nothing. So the docker
// probe runs `docker info` (daemon round-trip), not `docker --version`.
//
// Memoized per process (mirrors `isGitRepo`): the daemon's up/down state is
// stable across a single intent run, and the decision it drives — "can the
// agent boot this service, or must it escalate to the user?" — only needs
// that coarse answer. `_resetCapabilityCacheForTests` clears it for tests
// that toggle availability.

import { execFileSync } from "node:child_process"

export interface ToolCapability {
	/** Lookup key (lowercase, kebab). */
	name: string
	/** Human label for prompts / logs. */
	displayName: string
	/** Cheap liveness probe. MUST verify the tool is usable NOW, not merely
	 *  installed — see the docker-daemon note above. Returns true when live. */
	probe: () => boolean
}

/** Run a command silently with a short timeout; true iff it exits 0. */
function probeOk(cmd: string, args: string[]): boolean {
	try {
		execFileSync(cmd, args, { stdio: "ignore", timeout: 5000 })
		return true
	} catch {
		return false
	}
}

const REGISTRY: Record<string, ToolCapability> = {
	// `docker info` round-trips the daemon. `docker --version` would pass on a
	// box with the CLI but no running daemon — the exact false positive that
	// sends the agent to boot a service that can never come up.
	docker: {
		name: "docker",
		displayName: "Docker",
		probe: () => probeOk("docker", ["info"]),
	},
	// Compose ships two ways: the v2 plugin (`docker compose`) and the legacy
	// standalone binary (`docker-compose`). Either counts.
	"docker-compose": {
		name: "docker-compose",
		displayName: "Docker Compose",
		probe: () =>
			probeOk("docker", ["compose", "version"]) ||
			probeOk("docker-compose", ["version"]),
	},
	make: {
		name: "make",
		displayName: "Make",
		probe: () => probeOk("make", ["--version"]),
	},
}

const _cache = new Map<string, boolean>()

/** Is the named ambient tool live right now? Unknown tools → false (we only
 *  vouch for tools we have a real liveness probe for). Memoized per process. */
export function isToolAvailable(name: string): boolean {
	const key = name.toLowerCase().replace(/[\s_]/g, "-")
	const tool = REGISTRY[key]
	if (!tool) return false
	const cached = _cache.get(key)
	if (cached !== undefined) return cached
	const ok = tool.probe()
	_cache.set(key, ok)
	return ok
}

/** Every registered tool that's live — for surfacing to prompts. */
export function availableTools(): string[] {
	return Object.keys(REGISTRY).filter(isToolAvailable)
}

/** Every tool the registry knows how to probe (live or not). */
export function knownTools(): string[] {
	return Object.keys(REGISTRY)
}

/** Clear the liveness cache. Tests that toggle tool availability call this. */
export function _resetCapabilityCacheForTests(): void {
	_cache.clear()
}
