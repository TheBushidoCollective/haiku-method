#!/usr/bin/env npx tsx
// Test suite for validateOutputLiveness — every code-output declared
// by any unit must be referenced by SOME OTHER file in the repo.
// Catches the "defined but never rendered" failure mode (e.g., a .tsx
// component that ships with passing tests but no <Component /> JSX usage
// anywhere — invisible to the user).

import assert from "node:assert"
import { execSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const { validateOutputLiveness } = await import(
	"../src/orchestrator/validators.ts"
)

const tmp = mkdtempSync(join(tmpdir(), "haiku-liveness-test-"))

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		const result = fn()
		if (result && typeof result.then === "function") await result
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

// Each fixture is its own throwaway git repo so `git grep` works.
function createRepo(name, slug = "test-intent") {
	const repoRoot = join(tmp, name)
	mkdirSync(repoRoot, { recursive: true })
	execSync("git init -q", { cwd: repoRoot })
	execSync("git config user.email t@t.t && git config user.name t", {
		cwd: repoRoot,
	})
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	mkdirSync(intentDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		"---\ntitle: test\nstudio: test\n---\nbody\n",
	)
	return { repoRoot, intentDir }
}

function writeUnit(intentDir, stage, name, frontmatter) {
	const dir = join(intentDir, "stages", stage, "units")
	mkdirSync(dir, { recursive: true })
	const fmYaml = Object.entries(frontmatter)
		.map(([k, v]) => {
			if (Array.isArray(v))
				return `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}`
			return `${k}: ${JSON.stringify(v)}`
		})
		.join("\n")
	writeFileSync(join(dir, `${name}.md`), `---\n${fmYaml}\n---\nbody\n`)
}

function writeRepoFile(repoRoot, relPath, content) {
	const fullPath = join(repoRoot, relPath)
	mkdirSync(fullPath.replace(/\/[^/]+$/, ""), { recursive: true })
	writeFileSync(fullPath, content)
}

function commitAll(repoRoot) {
	execSync("git add -A && git commit -q -m 'fixture'", { cwd: repoRoot })
}

function writeCoverageDecisions(intentDir, stage, decisions) {
	const dir = join(intentDir, "stages", stage)
	mkdirSync(dir, { recursive: true })
	writeFileSync(
		join(dir, "coverage-decisions.json"),
		JSON.stringify({ stage, decisions }, null, 2),
	)
}

console.log("\n=== validateOutputLiveness ===")

await test("returns null when no stages", () => {
	const { repoRoot, intentDir } = createRepo("no-stages")
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, [], repoRoot)
	assert.strictEqual(result, null)
})

await test("returns null when every code output is referenced elsewhere", () => {
	const { repoRoot, intentDir } = createRepo("all-referenced")
	writeUnit(intentDir, "dev", "unit-01-button", {
		title: "test",
		outputs: ["src/Button.tsx"],
	})
	// The output:
	writeRepoFile(
		repoRoot,
		"src/Button.tsx",
		"export function Button() { return null }\n",
	)
	// A consumer that references it:
	writeRepoFile(
		repoRoot,
		"src/App.tsx",
		"import { Button } from './Button'\nexport function App() { return <Button /> }\n",
	)
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["dev"], repoRoot)
	assert.strictEqual(result, null)
})

await test("returns output_liveness_review_required for orphan code outputs", () => {
	const { repoRoot, intentDir } = createRepo("orphan")
	writeUnit(intentDir, "dev", "unit-01-orphan", {
		title: "test",
		outputs: ["src/OrphanComponent.tsx"],
	})
	// The output exists but NO other file references the stem.
	writeRepoFile(
		repoRoot,
		"src/OrphanComponent.tsx",
		"export function OrphanComponent() { return null }\n",
	)
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["dev"], repoRoot)
	assert.ok(result, "expected non-null orphan result")
	assert.strictEqual(result.action, "output_liveness_review_required")
	assert.strictEqual(result.orphans.length, 1)
	assert.strictEqual(result.orphans[0].path, "src/OrphanComponent.tsx")
	assert.strictEqual(result.orphans[0].from_stage, "dev")
	assert.strictEqual(result.orphans[0].from_unit, "unit-01-orphan")
})

await test("ignores non-code outputs (.md, .json, etc.)", () => {
	const { repoRoot, intentDir } = createRepo("non-code")
	writeUnit(intentDir, "design", "unit-01-spec", {
		title: "test",
		outputs: ["docs/SPEC.md", "data/seed.json", "config.yml"],
	})
	writeRepoFile(repoRoot, "docs/SPEC.md", "# spec\n")
	writeRepoFile(repoRoot, "data/seed.json", "{}\n")
	writeRepoFile(repoRoot, "config.yml", "x: 1\n")
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["design"], repoRoot)
	assert.strictEqual(result, null)
})

await test("ignores test files (*.test.ts, *.spec.ts, __tests__/)", () => {
	const { repoRoot, intentDir } = createRepo("test-files")
	writeUnit(intentDir, "dev", "unit-01-tests", {
		title: "test",
		outputs: ["src/foo.test.ts", "src/bar.spec.tsx", "src/__tests__/baz.tsx"],
	})
	writeRepoFile(repoRoot, "src/foo.test.ts", "// test\n")
	writeRepoFile(repoRoot, "src/bar.spec.tsx", "// test\n")
	writeRepoFile(repoRoot, "src/__tests__/baz.tsx", "// test\n")
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["dev"], repoRoot)
	assert.strictEqual(result, null)
})

await test("out-of-scope acknowledgment in coverage-decisions.json suppresses orphan", () => {
	const { repoRoot, intentDir } = createRepo("acknowledged")
	writeUnit(intentDir, "dev", "unit-01-future", {
		title: "test",
		outputs: ["src/FutureComponent.tsx"],
	})
	writeRepoFile(
		repoRoot,
		"src/FutureComponent.tsx",
		"export function FutureComponent() { return null }\n",
	)
	writeCoverageDecisions(intentDir, "dev", [
		{
			path: "src/FutureComponent.tsx",
			decision: "out-of-scope",
			rationale: "reserved for future stage integration",
			acknowledged_at: "2026-05-03T20:00:00Z",
		},
	])
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["dev"], repoRoot)
	assert.strictEqual(result, null)
})

await test("walks outputs across multiple stages", () => {
	const { repoRoot, intentDir } = createRepo("multi-stage")
	writeUnit(intentDir, "design", "unit-01-icon", {
		title: "test",
		outputs: ["src/Icon.tsx"],
	})
	writeUnit(intentDir, "dev", "unit-01-orphan", {
		title: "test",
		outputs: ["src/Orphan.tsx"],
	})
	// Icon is referenced by App; Orphan is not.
	writeRepoFile(repoRoot, "src/Icon.tsx", "export const Icon = () => null\n")
	writeRepoFile(
		repoRoot,
		"src/Orphan.tsx",
		"export const Orphan = () => null\n",
	)
	writeRepoFile(
		repoRoot,
		"src/App.tsx",
		"import { Icon } from './Icon'\nexport const App = () => <Icon />\n",
	)
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["design", "dev"], repoRoot)
	assert.ok(result)
	assert.strictEqual(result.orphans.length, 1)
	assert.strictEqual(result.orphans[0].path, "src/Orphan.tsx")
})

await test("error message lists each orphan with stage + unit", () => {
	const { repoRoot, intentDir } = createRepo("multi-orphan")
	writeUnit(intentDir, "dev", "unit-01-a", {
		title: "test",
		outputs: ["src/AaaUnique.tsx", "src/BbbUnique.tsx"],
	})
	writeRepoFile(
		repoRoot,
		"src/AaaUnique.tsx",
		"export const AaaUnique = () => null\n",
	)
	writeRepoFile(
		repoRoot,
		"src/BbbUnique.tsx",
		"export const BbbUnique = () => null\n",
	)
	commitAll(repoRoot)
	const result = validateOutputLiveness(intentDir, ["dev"], repoRoot)
	assert.ok(result)
	assert.strictEqual(result.orphans.length, 2)
	assert.match(result.message, /AaaUnique\.tsx/)
	assert.match(result.message, /BbbUnique\.tsx/)
	assert.match(result.message, /unit-01-a/)
	assert.match(result.message, /haiku_coverage_acknowledge/)
})

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)

try {
	rmSync(tmp, { recursive: true, force: true })
} catch {}

if (failed > 0) process.exit(1)
