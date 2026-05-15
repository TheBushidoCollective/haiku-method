#!/usr/bin/env npx tsx
// test/feedback-targets-persisted.test.mjs — Regression for the bug
// reported 2026-05-15 on `admin-portal-reimagine` design stage.
//
// The bug: `haiku_feedback` (the create handler) accepted
// `target_unit` and `target_invalidates` in its input schema BUT
// silently dropped both fields. Every FB landed with empty `targets`,
// the close-feedback post-hook's step (1)
// (`applyFeedbackInvalidations`) was a no-op, and the witnessed
// approval slot survived forever — drift sweep re-firing on the same
// SHA mismatch on every tick.
//
// The fix:
//   1. `writeFeedbackFile` accepts `targetUnit` + `targetInvalidates`
//      and writes them under `targets.{unit, invalidates}`.
//   2. `haiku_feedback` handler extracts both args from `args` and
//      forwards them.
//   3. `deriveDefaultInvalidates(origin)` defaults the value when
//      omitted: user-* / drift → ["user"], else [].
//
// This test pins all three. If a future refactor drops the args
// again, this test fires before the bug ships.

import assert from "node:assert"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import matter from "gray-matter"

import { handleStateTool, writeFeedbackFile } from "../src/state-tools.ts"

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
	}
}

const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-targets-"))
const projDir = join(tmp, "project")
const haikuRoot = join(projDir, ".haiku")
const intentSlug = "test-fb-targets"
const stage = "design"

function freshIntent() {
	rmSync(haikuRoot, { recursive: true, force: true })
	mkdirSync(join(haikuRoot, "intents", intentSlug, "stages", stage), {
		recursive: true,
	})
	writeFileSync(
		join(haikuRoot, "intents", intentSlug, "intent.md"),
		`---\ntitle: t\nstudio: software\nstages: ["${stage}"]\nactive_stage: "${stage}"\nplugin_version: "7.0.0"\n---\n# t\n`,
	)
}

const origCwd = process.cwd()
mkdirSync(projDir, { recursive: true })
process.chdir(projDir)

console.log("\n=== writeFeedbackFile: targets persisted ===")

test("explicit targetUnit + targetInvalidates land on disk", () => {
	freshIntent()
	const result = writeFeedbackFile(intentSlug, stage, {
		title: "User pushed back on the typography",
		body: "user-pushed",
		origin: "user-chat",
		targetUnit: "unit-02",
		targetInvalidates: ["user"],
	})
	const raw = readFileSync(join(projDir, result.file), "utf8")
	const { data } = matter(raw)
	assert.deepStrictEqual(data.targets, {
		unit: "unit-02",
		invalidates: ["user"],
	})
})

test("explicit empty invalidates = informational FB (no roles cleared on close)", () => {
	freshIntent()
	const result = writeFeedbackFile(intentSlug, stage, {
		title: "FYI for next reviewer",
		body: "fyi",
		origin: "agent",
		targetUnit: "unit-02",
		targetInvalidates: [],
	})
	const { data } = matter(readFileSync(join(projDir, result.file), "utf8"))
	assert.deepStrictEqual(data.targets, { unit: "unit-02", invalidates: [] })
})

console.log("\n=== writeFeedbackFile: origin-based defaults ===")

test("user-chat default invalidates user", () => {
	freshIntent()
	const r = writeFeedbackFile(intentSlug, stage, {
		title: "user said no",
		body: "no",
		origin: "user-chat",
	})
	const { data } = matter(readFileSync(join(projDir, r.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, ["user"])
	assert.strictEqual(data.targets.unit, null)
})

test("user-visual default invalidates user", () => {
	freshIntent()
	const r = writeFeedbackFile(intentSlug, stage, {
		title: "user marked it up",
		body: "no",
		origin: "user-visual",
	})
	const { data } = matter(readFileSync(join(projDir, r.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, ["user"])
})

test("drift default invalidates user", () => {
	freshIntent()
	const r = writeFeedbackFile(intentSlug, stage, {
		title: "drift on artifact",
		body: "drifted",
		origin: "drift",
	})
	const { data } = matter(readFileSync(join(projDir, r.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, ["user"])
})

test("agent default = [] (informational)", () => {
	freshIntent()
	const r = writeFeedbackFile(intentSlug, stage, {
		title: "agent finding",
		body: "noted",
		origin: "agent",
	})
	const { data } = matter(readFileSync(join(projDir, r.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, [])
})

test("studio-review default = [] (informational; user surfaces own findings via different path)", () => {
	freshIntent()
	const r = writeFeedbackFile(intentSlug, stage, {
		title: "studio review",
		body: "noted",
		origin: "studio-review",
	})
	const { data } = matter(readFileSync(join(projDir, r.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, [])
})

console.log("\n=== haiku_feedback MCP tool: targets flow through ===")

test("MCP create with target_unit + target_invalidates persists both", () => {
	freshIntent()
	const result = handleStateTool("haiku_feedback", {
		intent: intentSlug,
		stage,
		title: "regression — close should clear approvals.user",
		body: "the bug from 2026-05-15",
		origin: "user-chat",
		target_unit: "unit-02",
		target_invalidates: ["user"],
	})
	assert.ok(!result.isError, `MCP create failed: ${JSON.stringify(result)}`)
	assert.ok(
		result.structuredContent,
		`missing structuredContent in: ${JSON.stringify(result)}`,
	)
	const parsed = result.structuredContent
	const fbFile = join(projDir, parsed.file)
	const { data } = matter(readFileSync(fbFile, "utf8"))
	assert.deepStrictEqual(data.targets, {
		unit: "unit-02",
		invalidates: ["user"],
	})
})

test("MCP create with origin alone defaults invalidates from origin", () => {
	freshIntent()
	const result = handleStateTool("haiku_feedback", {
		intent: intentSlug,
		stage,
		title: "user pushback",
		body: "no",
		origin: "user-chat",
	})
	assert.ok(!result.isError, `MCP create failed: ${JSON.stringify(result)}`)
	assert.ok(
		result.structuredContent,
		`missing structuredContent in: ${JSON.stringify(result)}`,
	)
	const parsed = result.structuredContent
	const { data } = matter(readFileSync(join(projDir, parsed.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, ["user"])
})

test("MCP create with target_invalidates: [] respects explicit empty (overrides origin default)", () => {
	freshIntent()
	const result = handleStateTool("haiku_feedback", {
		intent: intentSlug,
		stage,
		title: "user FYI",
		body: "no closure invalidation",
		origin: "user-chat",
		target_invalidates: [],
	})
	assert.ok(!result.isError, `MCP create failed: ${JSON.stringify(result)}`)
	assert.ok(
		result.structuredContent,
		`missing structuredContent in: ${JSON.stringify(result)}`,
	)
	const parsed = result.structuredContent
	const { data } = matter(readFileSync(join(projDir, parsed.file), "utf8"))
	assert.deepStrictEqual(data.targets.invalidates, [])
})

process.chdir(origCwd)
rmSync(tmp, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
