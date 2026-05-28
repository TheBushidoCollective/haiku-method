#!/usr/bin/env node
// test-single.mjs — Run a single test file inside a sandboxed
// HAIKU_PROJECTS_ROOT so it doesn't pollute the user's real
// ~/.haiku/projects/ tree. Mirrors the lifecycle test/run-all.mjs
// gives the full suite, scoped to one file for the `npm run test:*`
// convenience scripts.
//
// Usage: node scripts/test-single.mjs <test-file-path>

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const file = process.argv[2]
if (!file) {
	console.error("usage: test-single.mjs <test-file-path>")
	process.exit(2)
}

const sandbox = mkdtempSync(join(tmpdir(), "haiku-test-projects-"))
const cleanup = () => {
	try {
		rmSync(sandbox, { recursive: true, force: true })
	} catch {
		/* best-effort */
	}
}
process.on("exit", cleanup)
process.on("SIGINT", () => {
	cleanup()
	process.exit(130)
})
process.on("SIGTERM", () => {
	cleanup()
	process.exit(143)
})

const result = spawnSync("npx", ["tsx", file], {
	env: {
		...process.env,
		HAIKU_PROJECTS_ROOT: sandbox,
		// Match run-all.mjs: shorten the browser-attach grace so any
		// inline-await path in a test fails fast instead of stalling.
		HAIKU_GATE_ATTACH_GRACE_MS:
			process.env.HAIKU_GATE_ATTACH_GRACE_MS ?? "1000",
	},
	stdio: "inherit",
})
process.exit(result.status ?? 1)
