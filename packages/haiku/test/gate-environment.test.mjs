// gate-environment.test.mjs
//
// A quality gate that can't reach a live dependency (DB down, Docker daemon
// off, a declared tool absent) verified NOTHING. The engine must classify
// that as an environment failure — not a code defect — so it routes to
// best-effort-boot / escalate-to-user instead of churning the fix loop or
// (worse) advancing on a false green. This pins the classifier, the boot
// recipe's `service:` / `requires_tool:` fields, and the capability probe.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()
function git(cwd, ...a) {
	execFileSync("git", a, { cwd, stdio: "ignore" })
}

// ── classifier ──────────────────────────────────────────────────────

test("classifyGateFailure: connection-refused output is environment, not code", async () => {
	const { classifyGateFailure } = await import(`${SRC}/gate-environment.ts`)
	const c = classifyGateFailure({
		name: "integration-tests",
		command: "npm test",
		exit_code: 1,
		output:
			"Error: connect ECONNREFUSED 127.0.0.1:5432\n  at TCPConnectWrap...",
	})
	assert.equal(c.environment, true, "ECONNREFUSED → environment")
	assert.ok(c.reason, "carries a reason")
})

test("classifyGateFailure: docker daemon down is environment", async () => {
	const { classifyGateFailure } = await import(`${SRC}/gate-environment.ts`)
	const c = classifyGateFailure({
		name: "e2e",
		command: "docker compose run test",
		exit_code: 1,
		output:
			"Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
	})
	assert.equal(c.environment, true)
})

test("classifyGateFailure: a real assertion failure is NOT environment", async () => {
	const { classifyGateFailure } = await import(`${SRC}/gate-environment.ts`)
	const c = classifyGateFailure({
		name: "unit-tests",
		command: "npm test",
		exit_code: 1,
		output:
			"FAIL src/sum.test.ts\n  expected 4 but received 5\n  1 test failed",
	})
	assert.equal(c.environment, false, "assertion failure is a code defect")
	assert.equal(c.reason, null)
})

test("classifyGateFailure: a declared-but-absent tool is environment (requiresTool set)", async () => {
	const { classifyGateFailure } = await import(`${SRC}/gate-environment.ts`)
	const c = classifyGateFailure(
		{ name: "migrate", command: "make db-migrate", exit_code: 1, output: "" },
		// A tool the capability registry will never report live.
		{ requiredTools: ["definitely-not-a-real-tool-xyz"] },
	)
	assert.equal(c.environment, true, "absent required tool → environment")
	assert.equal(c.requiresTool, "definitely-not-a-real-tool-xyz")
})

test("classifyGateRun: any env failure taints the whole run", async () => {
	const { classifyGateRun } = await import(`${SRC}/gate-environment.ts`)
	const c = classifyGateRun([
		{ name: "lint", command: "eslint", exit_code: 1, output: "2 problems" },
		{
			name: "it",
			command: "npm test",
			exit_code: 1,
			output: "could not connect to server: Connection refused",
		},
	])
	assert.equal(c.environment, true, "one env failure → run is env-blocked")
})

// ── boot recipe service fields ──────────────────────────────────────

test("readServiceProcesses: surfaces service: / requires_tool: processes", async () => {
	const { readServiceProcesses, readBootRecipe } = await import(
		`${SRC}/view-boot.ts`
	)
	const root = mkdtempSync(join(tmpdir(), "haiku-boot-svc-"))
	try {
		mkdirSync(join(root, ".haiku"), { recursive: true })
		writeFileSync(
			join(root, ".haiku", "boot.md"),
			matter.stringify("Drive notes.\n", {
				processes: [
					{
						name: "db",
						command: ["docker", "compose", "up", "db"],
						service: true,
						requires_tool: "docker",
						no_port: true,
						ready_url: "http://127.0.0.1:5432",
					},
					{
						name: "web",
						command: ["npm", "run", "dev"],
						port_env: "PORT",
						ready_url: "http://127.0.0.1:{port}/",
					},
				],
				primary: "web",
			}),
		)
		const recipe = readBootRecipe(root)
		assert.ok(recipe, "recipe parses")
		assert.equal(recipe.primary, "web")
		const db = recipe.processes.find((p) => p.name === "db")
		assert.equal(db.service, true, "service flag parsed")
		assert.equal(db.requires_tool, "docker", "requires_tool parsed")

		const services = readServiceProcesses(root)
		assert.equal(services.length, 1, "only the db is a service")
		assert.equal(services[0].name, "db")
		// The port-bound primary app is NOT a service.
		assert.ok(!services.some((s) => s.name === "web"))
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("readServiceProcesses: app-only recipe has no services", async () => {
	const { readServiceProcesses } = await import(`${SRC}/view-boot.ts`)
	const root = mkdtempSync(join(tmpdir(), "haiku-boot-apponly-"))
	try {
		mkdirSync(join(root, ".haiku"), { recursive: true })
		writeFileSync(
			join(root, ".haiku", "boot.md"),
			matter.stringify("notes\n", {
				command: ["npm", "run", "dev"],
				ready_url: "http://127.0.0.1:{port}/",
			}),
		)
		assert.deepEqual(readServiceProcesses(root), [])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

// ── capability probe ────────────────────────────────────────────────

// ── runInlineQualityGates: env classification end-to-end ────────────

test("runInlineQualityGates: a connection-refused gate returns environment, not quality_gate_failed", async () => {
	if (!HAS_GIT) return
	const { runInlineQualityGates } = await import(`${SRC}/state-tools.ts`)
	const repo = mkdtempSync(join(tmpdir(), "haiku-gate-env-"))
	const orig = process.cwd()
	try {
		git(repo, "init", "-q", "-b", "main")
		git(repo, "config", "user.email", "t@t")
		git(repo, "config", "user.name", "t")
		const slug = "env-intent"
		const intentDir = join(repo, ".haiku", "intents", slug)
		const unitsDir = join(intentDir, "stages", "build", "units")
		mkdirSync(unitsDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", { title: "t", studio: "software" }),
		)
		// A gate whose command emits a service-unavailable signature and fails.
		writeFileSync(
			join(unitsDir, "unit-01-a.md"),
			matter.stringify("# u\n", {
				title: "unit-01-a",
				quality_gates: [
					{
						name: "integration",
						command:
							"sh -c 'echo \"could not connect to server: Connection refused\" >&2; exit 1'",
					},
				],
			}),
		)
		process.chdir(repo)
		const result = runInlineQualityGates(slug, join(unitsDir, "unit-01-a.md"))
		assert.ok(result, "gate failed → non-null result")
		assert.equal(
			result.error,
			"quality_gate_environment_unavailable",
			`env-classified, not a code defect; got ${result.error}`,
		)
		assert.equal(result.environment, true)
		assert.ok(result.env_reason, "carries the env reason")
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repo, { recursive: true, force: true })
	}
})

test("capabilities: unknown tool is never available; known tool returns a bool", async () => {
	const { isToolAvailable, knownTools, _resetCapabilityCacheForTests } =
		await import(`${SRC}/capabilities.ts`)
	_resetCapabilityCacheForTests()
	assert.equal(
		isToolAvailable("not-a-tool-we-probe"),
		false,
		"we only vouch for tools we can probe",
	)
	assert.ok(knownTools().includes("docker"), "docker is registered")
	// Don't assert docker's liveness (CI may or may not have a daemon) — just
	// that the probe returns a boolean without throwing.
	assert.equal(typeof isToolAvailable("docker"), "boolean")
})
