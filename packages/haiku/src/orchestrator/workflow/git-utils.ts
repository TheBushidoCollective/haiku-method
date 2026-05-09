// orchestrator/workflow/git-utils.ts — Tiny git helpers shared across
// workflow modules. Kept minimal on purpose; resist the urge to grow
// this into a general-purpose git wrapper.

import { execFileSync } from "node:child_process"

/**
 * Run a command and return trimmed stdout, or "" on any failure.
 * Used by workflow modules that probe git topology — empty string is
 * the "couldn't determine" signal callers already handle.
 */
export function tryRun(args: string[]): string {
	try {
		return execFileSync(args[0], args.slice(1), {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim()
	} catch {
		return ""
	}
}
