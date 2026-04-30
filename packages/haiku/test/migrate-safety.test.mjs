#!/usr/bin/env npx tsx
// Safety tests for `haiku migrate`.
//
// The bare-invocation guard exists because a single `haiku migrate` (no
// args) used to migrate every intent in `.ai-dlc/`, and committing that
// output to a base branch in a monorepo polluted every open MR. These
// tests pin the safety contract:
//
//   1. Bare invocation refuses (no slug, no --all).
//   2. Unknown slug refuses with a candidate list.
//   3. Merged sub-intent slugs refuse and point at the base.
//   4. Dry-run is the default — `--apply` is required to write.
//   5. Dirty git tree refuses to apply unless --allow-dirty.

import assert from "node:assert"
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const _origCwdEarly = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = join(_origCwdEarly, "..", "..", "plugin")

const { runMigrate } = await import("../src/migrate.ts")

const origCwd = process.cwd()
const tmp = mkdtempSync(join(tmpdir(), "haiku-migrate-safety-test-"))

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

function makeAiDlc(projName, intents) {
	const projDir = join(tmp, projName)
	mkdirSync(join(projDir, ".ai-dlc"), { recursive: true })
	for (const slug of intents) {
		mkdirSync(join(projDir, ".ai-dlc", slug), { recursive: true })
		writeFileSync(
			join(projDir, ".ai-dlc", slug, "intent.md"),
			`---\nstatus: active\n---\n\n# ${slug}\n`,
		)
	}
	return projDir
}

/** Stub git so the dirty-check path can be exercised deterministically.
 *  `mode: "clean"` exits 0 with empty output; `"dirty"` exits 0 with
 *  a `M file` line. */
function stubGit(projDir, mode) {
	const binDir = join(projDir, "fake-bin")
	mkdirSync(binDir, { recursive: true })
	const script =
		mode === "dirty"
			? "#!/bin/sh\nif [ \"$1\" = status ]; then echo ' M fake.txt'; fi\nexit 0\n"
			: "#!/bin/sh\nexit 0\n"
	writeFileSync(join(binDir, "git"), script)
	chmodSync(join(binDir, "git"), 0o755)
	process.env.PATH = `${binDir}:${process.env.PATH}`
}

async function expectThrows(fn, matcher) {
	let threw
	try {
		await fn()
	} catch (e) {
		threw = e
	}
	if (!threw) throw new Error("expected runMigrate to throw, got success")
	if (matcher && !matcher.test(threw.message)) {
		throw new Error(
			`error message did not match ${matcher}\n  got: ${threw.message}`,
		)
	}
	return threw
}

console.log("\n  haiku migrate safety contract")

await test("bare invocation refuses (no slug, no --all)", async () => {
	const proj = makeAiDlc("bare", ["foo", "bar"])
	process.chdir(proj)
	const err = await expectThrows(
		() => runMigrate([]),
		/refusing to run without a slug or --all/,
	)
	assert.ok(/foo/.test(err.message), "should list candidate slugs")
	assert.ok(/bar/.test(err.message), "should list candidate slugs")
	process.chdir(origCwd)
})

await test("unknown slug refuses with candidate list", async () => {
	const proj = makeAiDlc("unknown", ["foo"])
	process.chdir(proj)
	await expectThrows(
		() => runMigrate(["does-not-exist"]),
		/unknown intent slug/,
	)
	process.chdir(origCwd)
})

await test("merged sub-intent slug refuses and points at base", async () => {
	const proj = makeAiDlc("merged", ["foo", "foo-dev"])
	process.chdir(proj)
	const err = await expectThrows(
		() => runMigrate(["foo-dev"]),
		/merged sub-intent/,
	)
	assert.ok(/foo-dev → foo/.test(err.message), "should hint at base slug")
	process.chdir(origCwd)
})

await test("default is dry-run — no .haiku/intents/ created", async () => {
	const proj = makeAiDlc("default-dry", ["foo"])
	stubGit(proj, "clean")
	process.chdir(proj)
	await runMigrate(["foo"])
	assert.equal(
		existsSync(join(proj, ".haiku", "intents", "foo", "intent.md")),
		false,
		"dry-run must not write intent.md",
	)
	process.chdir(origCwd)
})

await test("--apply writes when tree is clean", async () => {
	const proj = makeAiDlc("apply-clean", ["foo"])
	stubGit(proj, "clean")
	process.chdir(proj)
	await runMigrate(["foo", "--apply"])
	assert.equal(
		existsSync(join(proj, ".haiku", "intents", "foo", "intent.md")),
		true,
		"--apply should write intent.md",
	)
	process.chdir(origCwd)
})

await test("--apply refuses when git tree is dirty", async () => {
	const proj = makeAiDlc("apply-dirty", ["foo"])
	stubGit(proj, "dirty")
	process.chdir(proj)
	await expectThrows(
		() => runMigrate(["foo", "--apply"]),
		/uncommitted changes/,
	)
	assert.equal(
		existsSync(join(proj, ".haiku", "intents", "foo", "intent.md")),
		false,
		"refusal must happen before any write",
	)
	process.chdir(origCwd)
})

await test("--apply --allow-dirty writes despite dirty tree", async () => {
	const proj = makeAiDlc("apply-allow-dirty", ["foo"])
	stubGit(proj, "dirty")
	process.chdir(proj)
	await runMigrate(["foo", "--apply", "--allow-dirty"])
	assert.equal(
		existsSync(join(proj, ".haiku", "intents", "foo", "intent.md")),
		true,
		"--allow-dirty bypasses the precheck",
	)
	process.chdir(origCwd)
})

await test("--all without --apply does not write", async () => {
	const proj = makeAiDlc("all-dry", ["foo", "bar"])
	stubGit(proj, "clean")
	process.chdir(proj)
	await runMigrate(["--all"])
	assert.equal(
		existsSync(join(proj, ".haiku", "intents", "foo", "intent.md")),
		false,
	)
	assert.equal(
		existsSync(join(proj, ".haiku", "intents", "bar", "intent.md")),
		false,
	)
	process.chdir(origCwd)
})

console.log(`\n  ${passed} passed, ${failed} failed\n`)

rmSync(tmp, { recursive: true, force: true })

if (failed > 0) process.exit(1)
