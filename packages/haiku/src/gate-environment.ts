// gate-environment.ts — classify a quality-gate failure as an ENVIRONMENT
// failure (a runtime dependency the gate needs wasn't reachable) vs a real
// code defect.
//
// Why this matters: every quality-gate failure used to file a
// `severity: "blocker"` feedback that activates the code fix loop. When the
// failure is "the database isn't up" / "the Docker daemon isn't running",
// the fix loop has nothing to fix — it re-runs the same gate against the
// same dead dependency, burns bolts, and churns to the cap. (The runtime
// VERIFIER already dodges this with its BLOCKED verdict; gates had no
// equivalent.)
//
// An environment-classified failure does NOT enter the code fix loop. The
// engine routes it to the best-effort-boot → escalate-to-user path: bring
// the declared service up if the tool is live, otherwise hold the stage for
// the user. It NEVER advances on an unreachable dependency — a gate that
// couldn't run verified nothing, and advancing on it is a false green.

import { isToolAvailable } from "./capabilities.js"

export interface GateFailureLike {
	name: string
	command: string
	exit_code: number
	output: string
}

// Output substrings that mean "a service/dependency the gate needs wasn't
// reachable." Deliberately conservative — a false positive would route a
// real code failure away from the fix loop, so each pattern names a
// connection/availability error, never a generic assertion failure.
const ENV_DOWN_SIGNATURES: RegExp[] = [
	/cannot connect to the docker daemon/i,
	/is the docker daemon running/i,
	/connection refused/i,
	/\beconnrefused\b/i,
	/could not connect to server/i, // libpq / postgres
	/can't reach database server/i, // prisma
	/no connection could be made/i, // windows
	/getaddrinfo (enotfound|eai_again)/i,
	/\bmongonetworkerror\b/i,
	/server closed the connection unexpectedly/i,
	/connection to .* (port|host) .* failed/i,
	/(redis|mongo|postgres|postgresql|mysql|mariadb).*(connection|connect).*(refused|failed|timed out)/i,
	// The tool itself isn't installed (so the gate's command can't even start).
	/\b(docker|docker-compose|psql|mysql|redis-cli|pg_isready)\b[^\n]*\b(command not found|not found|no such file)/i,
	/\b(command not found|not found):?\s*(docker|docker-compose|psql|mysql)\b/i,
]

export interface EnvClassification {
	/** True when the failure is an unreachable runtime dependency, not code. */
	environment: boolean
	/** Human-readable reason (set iff environment). */
	reason: string | null
	/** The declared tool that was missing, when that was the trigger. Drives
	 *  whether the agent CAN best-effort boot (tool live) or must escalate. */
	requiresTool?: string
}

/** Classify one gate failure. Two triggers, in priority order:
 *
 *   1. A tool the gate's service declared (`requires_tool` on the boot
 *      recipe, passed via `requiredTools`) is not live. The gate can't run
 *      at all — environment, not code.
 *   2. The gate output matches a dependency-down signature (connection
 *      refused, daemon not running, …) even with no declared tool.
 *
 * `requiredTools` is the union of `requires_tool` across the project's
 * declared service processes (see `readServiceProcesses`). */
export function classifyGateFailure(
	failure: GateFailureLike,
	opts: { requiredTools?: string[] } = {},
): EnvClassification {
	for (const tool of opts.requiredTools ?? []) {
		if (!isToolAvailable(tool)) {
			return {
				environment: true,
				requiresTool: tool,
				reason: `gate '${failure.name}' needs '${tool}', which isn't available in this environment`,
			}
		}
	}
	if (ENV_DOWN_SIGNATURES.some((re) => re.test(failure.output))) {
		return {
			environment: true,
			reason: `gate '${failure.name}' couldn't reach a runtime dependency (its output matches a service-unavailable signature) — the gate ran nothing meaningful`,
		}
	}
	return { environment: false, reason: null }
}

/** Classify a whole gate run. If ANY failure is environment-unavailable the
 *  run is environment-blocked — a broken env taints the other gates too, so
 *  we can't trust their pass/fail. Returns the first env reason + tool. */
export function classifyGateRun(
	failures: GateFailureLike[],
	opts: { requiredTools?: string[] } = {},
): EnvClassification {
	for (const f of failures) {
		const c = classifyGateFailure(f, opts)
		if (c.environment) return c
	}
	return { environment: false, reason: null }
}
