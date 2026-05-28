#!/usr/bin/env npx tsx
// Handoff-message feature (v9):
//   1. The FB body is LOCKED once the fix-hat loop has started (>=1
//      iteration) — `haiku_feedback_write` returns `body_locked`. Per-hat
//      work lives in the iteration handoff `message`, not the body.
//   2. `haiku_feedback_read` lazily migrates legacy iteration `reason` →
//      the unified `message` field on disk (idempotent heal-on-read).

import assert from "node:assert"
import { execSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import matter from "gray-matter"
import { handleStateTool } from "../src/state-tools.ts"

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`)
	}
}

function getText(result) {
	return result.content.find((c) => c.type === "text")?.text ?? ""
}

function git(cwd, ...args) {
	return execSync(`git ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

const projDir = mkdtempSync(join(tmpdir(), "haiku-handoff-"))
const originalCwd = process.cwd()
const slug = "handoff-demo"
const stage = "design"
let fbDir = ""

function setup() {
	process.chdir(projDir)
	git(projDir, "init", "-q")
	git(projDir, "config", "user.email", "t@t")
	git(projDir, "config", "user.name", "t")
	git(projDir, "commit", "--allow-empty", "-q", "-m", "init")
	git(projDir, "checkout", "-q", "-b", `haiku/${slug}/main`)
	git(projDir, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
	const intentDir = join(projDir, ".haiku", "intents", slug)
	fbDir = join(intentDir, "stages", stage, "feedback")
	mkdirSync(fbDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# Handoff demo\n", {
			title: "Handoff demo",
			studio: "software",
			mode: "discrete",
		}),
	)
}

console.log("\n── feedback handoff message ─────────────────────────────")
setup()
try {
	test("haiku_feedback_write is refused once the fix loop has started (body_locked)", () => {
		writeFileSync(
			join(fbDir, "01-under-fix.md"),
			matter.stringify("Original finding — the immutable record.\n", {
				title: "Under fix",
				origin: "drift",
				author: "engine",
				author_type: "system",
				status: "pending",
				created_at: new Date().toISOString(),
				targets: { unit: null, invalidates: [] },
				// A fix-hat iteration is on record → loop started.
				iterations: [
					{ bolt: 1, hat: "classifier", started_at: "2026-05-21T00:00:00Z" },
				],
			}),
		)
		const r = handleStateTool("haiku_feedback_write", {
			intent: slug,
			stage,
			feedback_id: 1,
			body: "trying to clobber the finding",
		})
		const parsed = JSON.parse(getText(r))
		assert.strictEqual(parsed.error, "body_locked", `expected body_locked, got ${parsed.error}`)
		// The original body must be untouched on disk.
		const onDisk = matter(readFileSync(join(fbDir, "01-under-fix.md"), "utf8"))
		assert.match(onDisk.content, /immutable record/)
	})

	test("haiku_feedback_write still works before any iteration (pre-loop)", () => {
		writeFileSync(
			join(fbDir, "02-fresh.md"),
			matter.stringify("Fresh finding.\n", {
				title: "Fresh",
				origin: "user-chat",
				author: "user",
				author_type: "human",
				status: "pending",
				created_at: new Date().toISOString(),
				targets: { unit: null, invalidates: [] },
			}),
		)
		const r = handleStateTool("haiku_feedback_write", {
			intent: slug,
			stage,
			feedback_id: 2,
			body: "enriched finding before the loop runs",
		})
		const parsed = JSON.parse(getText(r))
		assert.strictEqual(parsed.ok, true, `expected ok, got ${JSON.stringify(parsed)}`)
	})

	test("haiku_feedback_read heals legacy iteration reason → message on disk", () => {
		writeFileSync(
			join(fbDir, "03-legacy.md"),
			matter.stringify("Legacy finding.\n", {
				title: "Legacy",
				origin: "adversarial-review",
				author: "completeness",
				author_type: "agent",
				status: "pending",
				created_at: new Date().toISOString(),
				targets: { unit: null, invalidates: [] },
				iterations: [
					{
						bolt: 1,
						hat: "builder",
						completed_at: "2026-05-21T00:01:00Z",
						result: "rejected",
						reason: "legacy reject text",
					},
				],
			}),
		)
		handleStateTool("haiku_feedback_read", { intent: slug, stage, feedback_id: 3 })
		const fm = matter(readFileSync(join(fbDir, "03-legacy.md"), "utf8")).data
		const it = fm.iterations[0]
		assert.strictEqual(it.message, "legacy reject text", "reason copied to message")
		assert.strictEqual(it.reason, undefined, "legacy reason dropped after heal")
	})
} finally {
	process.chdir(originalCwd)
	if (existsSync(projDir)) rmSync(projDir, { recursive: true, force: true })
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
