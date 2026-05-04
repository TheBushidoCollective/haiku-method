#!/usr/bin/env npx tsx
// Tests for haiku_human_write MCP tool.
//
// Coverage (per features/agent-writes-on-behalf-of-human.feature):
//  1.  Happy path — file written, action log stamped, baseline NOT updated,
//      response shape correct (ok, path, sha, author_class, etc.)
//  2.  Audit log records all 12 fields including user_instruction_excerpt.
//  3.  Failed writes (deny-list) do NOT append to audit log.
//  4.  Failed write (escape path) does NOT append to audit log.
//  5.  Refusal: workflow-managed path (stages/design/state.json).
//  6.  Refusal: write-audit.jsonl itself.
//  7.  Refusal: ../../../etc/passwd — path_escape.
//  8.  Refusal: empty content.
//  9.  Trust+Audit interactive mode: write completes without confirmation.
// 10.  Trust+Audit autopilot mode: identical behaviour.
// 11.  Path normalisation: absolute path inside intent dir is accepted.
// 12.  Absolute path escaping intent dir is rejected.
// 13.  human_author_id / rationale / user_instruction_excerpt carry through
//      to audit log entry literally.
// 14.  Kill-switch: drift_detection: false → file written, action log
//      stamped, audit log skipped, audit_log_appended: false + reason.
// 15.  overwrite: false on existing file → path_already_exists with existing_sha.
// 16.  create_dirs: false with missing parent → parent_dir_missing.
// 17.  content_encoding: base64 → file written correctly.
// 18.  human_write_require_rationale: true + no rationale → rationale_required.
// 19.  Hook compatibility: guard-workflow-fields does NOT block haiku_human_write
//      (the hook only guards Read/Write/Edit/MultiEdit — this tool's deny-list
//      is defence-in-depth at the tool layer, not the hook layer).
// 20.  Audit log NOT updated on no_allow_match path rejection.

import assert from "node:assert"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

// ── Test infrastructure ────────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-human-write-test-"))

// Redirect findHaikuRoot() to our tmp fixture.
const { setHaikuRootForTests } = await import("../src/state/shared.ts")

// Import the tool handler.
const toolModule = await import(
	"../src/tools/orchestrator/haiku_human_write.ts"
)
const tool = toolModule.default

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		await fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (process.env.VERBOSE) console.error(e)
	}
}

// ── Fixture helpers ────────────────────────────────────────────────────────

/**
 * Create a minimal intent fixture under `root/.haiku`.
 * Returns { haikuRoot, intentDir }.
 */
function makeFixture(
	slug = "demo-intent",
	opts = { stages: ["development"], archived: false },
) {
	const haikuRoot = mkdtempSync(join(tmp, "root-"))
	const intentsRoot = join(haikuRoot, "intents")
	const intentDir = join(intentsRoot, slug)

	mkdirSync(intentDir, { recursive: true })

	// Write intent.md with optional archived flag.
	const archiveLine = opts.archived ? "\narchived: true" : ""
	writeFileSync(
		join(intentDir, "intent.md"),
		`---\ntitle: Test Intent${archiveLine}\n---\nBody.\n`,
	)

	// Create stage directories + state.json.
	for (const stage of opts.stages ?? []) {
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "state.json"),
			JSON.stringify({ iteration: 5, status: "active" }),
		)
	}

	return { haikuRoot, intentDir }
}

/** Read lines from the write-audit.jsonl file for an intent. */
function readAuditLines(intentDir) {
	const p = join(intentDir, "write-audit.jsonl")
	if (!existsSync(p)) return []
	return readFileSync(p, "utf8")
		.split("\n")
		.filter((l) => l.trim() !== "")
		.map((l) => JSON.parse(l))
}

/** Read lines from the action-log.jsonl file for an intent. */
function readActionLines(intentDir) {
	const p = join(intentDir, "action-log.jsonl")
	if (!existsSync(p)) return []
	return readFileSync(p, "utf8")
		.split("\n")
		.filter((l) => l.trim() !== "")
		.map((l) => JSON.parse(l))
}

/** Invoke the tool with slug + intent set to the fixture. */
async function invoke(haikuRoot, slug, args) {
	setHaikuRootForTests(haikuRoot)
	try {
		return await tool.handle({ intent_slug: slug, ...args })
	} finally {
		setHaikuRootForTests(null)
	}
}

/** Parse the JSON text from a tool result. */
function parseResult(result) {
	return JSON.parse(result.content[0].text)
}

// ── Test 1: Happy path ─────────────────────────────────────────────────────

await test("Happy path — file written, action log stamped, no baseline update", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-happy", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-happy", {
		path: "knowledge/brand-guide.md",
		content: "# Brand Guide\n\nContent here.",
		human_author_id: "jwaldrip@gigsmart.com",
		rationale: "User asked to save brand guide",
		user_instruction_excerpt:
			"save this brand guide to knowledge/brand-guide.md",
	})

	const body = parseResult(result)

	assert.strictEqual(body.ok, true, "expected ok: true")
	assert.strictEqual(body.path, "knowledge/brand-guide.md")
	assert.strictEqual(body.author_class, "human-via-mcp")
	assert.ok(
		typeof body.sha === "string" && body.sha.length === 64,
		"sha must be 64 hex chars",
	)
	assert.ok(typeof body.timestamp === "string", "timestamp present")
	assert.strictEqual(body.human_author_id, "jwaldrip@gigsmart.com")
	assert.deepStrictEqual(body.dirs_created, ["knowledge"])
	assert.ok(
		typeof body.action_log_entry_id === "string",
		"action_log_entry_id present",
	)
	assert.ok(
		body.action_log_entry_id.startsWith("HWM-"),
		"entry_id has HWM- prefix",
	)
	assert.strictEqual(body.audit_log_appended, true)

	// File exists on disk.
	const destPath = join(intentDir, "knowledge/brand-guide.md")
	assert.ok(existsSync(destPath), "file must be written to disk")
	assert.strictEqual(
		readFileSync(destPath, "utf8"),
		"# Brand Guide\n\nContent here.",
	)

	// baseline.json must NOT exist (tool must not update it).
	assert.ok(
		!existsSync(join(intentDir, "stages/development/baseline.json")),
		"tool must NOT update baseline.json",
	)

	// Action log stamped.
	const actionLines = readActionLines(intentDir)
	assert.ok(actionLines.length >= 1, "action log must have at least one entry")
	const entry = actionLines[actionLines.length - 1]
	assert.strictEqual(entry.author_class, "human-via-mcp")
	assert.strictEqual(entry.path, "knowledge/brand-guide.md")
})

// ── Test 2: Audit log records all 12 fields ───────────────────────────────

await test("Audit log records all 12 fields including user_instruction_excerpt", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-audit-fields", {
		stages: ["inception"],
	})

	const result = await invoke(haikuRoot, "test-audit-fields", {
		path: "knowledge/brand-guide.md",
		content: "# Brand Guide",
		human_author_id: "jwaldrip@gigsmart.com",
		rationale: "User asked to save brand guide for elaboration phase",
		user_instruction_excerpt:
			"hey Claude, write this brand guide to knowledge/brand-guide",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, true)

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(auditLines.length, 1, "one audit entry expected")
	const entry = auditLines[0]

	assert.ok(typeof entry.timestamp === "string", "timestamp field")
	assert.ok(typeof entry.entry_id === "string", "entry_id field")
	assert.strictEqual(entry.path, "knowledge/brand-guide.md", "path field")
	assert.ok(
		typeof entry.sha === "string" && entry.sha.length === 64,
		"sha field",
	)
	assert.strictEqual(entry.author_class, "human-via-mcp", "author_class field")
	assert.strictEqual(
		entry.human_author_id,
		"jwaldrip@gigsmart.com",
		"human_author_id field",
	)
	assert.strictEqual(
		entry.rationale,
		"User asked to save brand guide for elaboration phase",
		"rationale field",
	)
	assert.strictEqual(
		entry.user_instruction_excerpt,
		"hey Claude, write this brand guide to knowledge/brand-guide",
		"user_instruction_excerpt field",
	)
	assert.ok(typeof entry.tick_counter === "number", "tick_counter field")
	// session_id may be null
	assert.ok("session_id" in entry, "session_id field present")
	assert.ok(typeof entry.overwrite === "boolean", "overwrite field")
	assert.ok(Array.isArray(entry.dirs_created), "dirs_created field")
	assert.strictEqual(entry.audit_log_appended, true, "audit_log_appended field")
})

// ── Test 3: Deny-list — does not append to audit log ─────────────────────

await test("Deny-list rejection (state.json) does not append to audit log", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-deny-no-audit", {
		stages: ["design"],
	})

	const result = await invoke(haikuRoot, "test-deny-no-audit", {
		path: "stages/design/state.json",
		content: "{}",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "deny_list_match")

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(
		auditLines.length,
		0,
		"no audit entry must be written on refusal",
	)
})

// ── Test 4: Escape path — does not append to audit log ────────────────────

await test("Escape path rejection does not append to audit log", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-escape-no-audit", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-escape-no-audit", {
		path: "../../../etc/passwd",
		content: "malicious",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "path_escape")

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(auditLines.length, 0, "no audit entry on escape rejection")
})

// ── Test 5: Refusal — workflow-managed path (stages/{stage}/state.json) ───

await test("Refusal: stages/design/state.json → deny_list_match", async () => {
	const { haikuRoot } = makeFixture("test-refusal-state", {
		stages: ["design"],
	})

	const result = await invoke(haikuRoot, "test-refusal-state", {
		path: "stages/design/state.json",
		content: "{}",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "deny_list_match")
	assert.ok(typeof body.deny_rule === "string", "deny_rule must be present")
	assert.ok(typeof body.message === "string", "message must be present")
})

// ── Test 6: Refusal — write-audit.jsonl ───────────────────────────────────

await test("Refusal: write-audit.jsonl itself → deny_list_match", async () => {
	const { haikuRoot } = makeFixture("test-refusal-audit", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-refusal-audit", {
		path: "write-audit.jsonl",
		content: "tamper",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "deny_list_match")
})

// ── Test 7: Refusal — path escape ../../../etc/passwd ─────────────────────

await test("Refusal: ../../../etc/passwd → path_escape", async () => {
	const { haikuRoot } = makeFixture("test-refusal-escape", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-refusal-escape", {
		path: "../../../etc/passwd",
		content: "root:x:0:0:root:/root:/bin/bash",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "path_escape")
})

// ── Test 8: Refusal — empty content ───────────────────────────────────────

await test("Refusal: empty content → empty_content error", async () => {
	const { haikuRoot } = makeFixture("test-empty-content", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-empty-content", {
		path: "knowledge/empty.md",
		content: "",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "empty_content")
})

// ── Test 9: Trust+Audit — interactive mode (no confirmation required) ──────

await test("Trust+Audit interactive mode: write completes without confirmation prompt", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-interactive", {
		stages: ["development"],
	})

	// Simply invoke and verify success — no ask_user_visual_question is
	// called because the tool doesn't require confirmation (v1 trust+audit).
	const result = await invoke(haikuRoot, "test-interactive", {
		path: "knowledge/config.json",
		content: '{"mode":"interactive"}',
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, true, "interactive mode: write must succeed")
	assert.strictEqual(body.author_class, "human-via-mcp")
	assert.ok(
		existsSync(join(intentDir, "knowledge/config.json")),
		"file written",
	)
})

// ── Test 10: Trust+Audit — autopilot mode (identical behaviour) ───────────

await test("Trust+Audit autopilot mode: identical behaviour to interactive", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-autopilot", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-autopilot", {
		path: "knowledge/config-auto.json",
		content: '{"mode":"autopilot"}',
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, true, "autopilot mode: write must succeed")
	assert.strictEqual(body.author_class, "human-via-mcp")
	assert.ok(
		existsSync(join(intentDir, "knowledge/config-auto.json")),
		"file written",
	)
	assert.strictEqual(body.audit_log_appended, true)
})

// ── Test 11: Path normalisation — absolute path inside intent dir ──────────

await test("Absolute path resolving inside intent dir is accepted", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-abs-inside", {
		stages: ["development"],
	})

	const absPath = resolve(join(intentDir, "knowledge/abs-file.md"))
	const result = await invoke(haikuRoot, "test-abs-inside", {
		path: absPath,
		content: "absolute path test",
	})

	const body = parseResult(result)
	assert.strictEqual(
		body.ok,
		true,
		"absolute path inside intent dir must succeed",
	)
	// Response path must be intent-relative (canonical).
	assert.strictEqual(body.path, "knowledge/abs-file.md")
	assert.ok(
		existsSync(join(intentDir, "knowledge/abs-file.md")),
		"file written",
	)
})

// ── Test 12: Absolute path escaping intent dir is rejected ────────────────

await test("Absolute path escaping intent dir is rejected", async () => {
	const { haikuRoot } = makeFixture("test-abs-outside", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-abs-outside", {
		path: "/tmp/evil-file.md",
		content: "evil",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "path_escape")
})

// ── Test 13: Attribution fields carry through to audit log ────────────────

await test("human_author_id / rationale / user_instruction_excerpt carry through literally", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-attribution", {
		stages: ["development"],
	})

	const humanId = "designer@company.com"
	const rationaleText = "Saving designer's updated spec per their request"
	const instructionText =
		"hey Claude, save this to stages/development/artifacts/spec.md"

	const result = await invoke(haikuRoot, "test-attribution", {
		path: "stages/development/artifacts/spec.md",
		content: "# Spec\n\nContent.",
		human_author_id: humanId,
		rationale: rationaleText,
		user_instruction_excerpt: instructionText,
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, true, "write must succeed")
	assert.strictEqual(body.human_author_id, humanId)

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(auditLines.length, 1)
	const entry = auditLines[0]
	assert.strictEqual(entry.human_author_id, humanId, "human_author_id in audit")
	assert.strictEqual(entry.rationale, rationaleText, "rationale in audit")
	assert.strictEqual(
		entry.user_instruction_excerpt,
		instructionText,
		"user_instruction_excerpt in audit",
	)
})

// ── Test 14: Kill-switch interaction ──────────────────────────────────────

await test("Kill-switch: file written, action log stamped, audit log skipped", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-kill-switch", {
		stages: ["development"],
	})

	// Write settings.yml with drift_detection: false.
	writeFileSync(join(haikuRoot, "settings.yml"), "drift_detection: false\n")

	const result = await invoke(haikuRoot, "test-kill-switch", {
		path: "knowledge/kill-switch-file.md",
		content: "kill switch test",
	})

	const body = parseResult(result)
	assert.strictEqual(
		body.ok,
		true,
		"file write must succeed even with kill-switch",
	)
	assert.strictEqual(
		body.audit_log_appended,
		false,
		"audit_log_appended must be false",
	)
	assert.strictEqual(
		body.reason,
		"drift_detection_disabled",
		"reason must be drift_detection_disabled",
	)

	// File must exist on disk.
	assert.ok(
		existsSync(join(intentDir, "knowledge/kill-switch-file.md")),
		"file must be written",
	)

	// Action log must STILL be stamped (kill-switch only skips audit log).
	const actionLines = readActionLines(intentDir)
	assert.ok(
		actionLines.length >= 1,
		"action log must be stamped even with kill-switch",
	)
	const actionEntry = actionLines[actionLines.length - 1]
	assert.strictEqual(actionEntry.author_class, "human-via-mcp")

	// Audit log must NOT exist (or be empty).
	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(
		auditLines.length,
		0,
		"audit log must not be appended with kill-switch",
	)
})

// ── Test 15: overwrite: false on existing file ────────────────────────────

await test("overwrite: false on existing file → path_already_exists with existing_sha", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-no-overwrite", {
		stages: ["development"],
	})

	// Pre-create the file.
	const knowledgeDir = join(intentDir, "knowledge")
	mkdirSync(knowledgeDir, { recursive: true })
	writeFileSync(join(knowledgeDir, "existing.md"), "original content")

	const result = await invoke(haikuRoot, "test-no-overwrite", {
		path: "knowledge/existing.md",
		content: "new content",
		overwrite: false,
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_already_exists")
	assert.ok(
		typeof body.existing_sha === "string",
		"existing_sha must be present",
	)
	assert.strictEqual(
		body.existing_sha.length,
		64,
		"existing_sha must be 64-char hex",
	)

	// Original file must be unchanged.
	assert.strictEqual(
		readFileSync(join(knowledgeDir, "existing.md"), "utf8"),
		"original content",
	)
})

// ── Test 16: create_dirs: false with missing parent ───────────────────────

await test("create_dirs: false with missing parent → parent_dir_missing", async () => {
	const { haikuRoot } = makeFixture("test-no-create-dirs", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-no-create-dirs", {
		path: "knowledge/new-section/file.md",
		content: "content",
		create_dirs: false,
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "parent_dir_missing")
	assert.ok(typeof body.missing_dir === "string", "missing_dir must be present")
})

// ── Test 17: content_encoding: base64 ─────────────────────────────────────

await test("content_encoding: base64 → file written correctly (decoded bytes)", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-base64", {
		stages: ["development"],
	})

	const originalContent = "Hello, binary world! \x00\x01\x02"
	const base64Content = Buffer.from(originalContent, "binary").toString(
		"base64",
	)

	const result = await invoke(haikuRoot, "test-base64", {
		path: "knowledge/binary-file.bin",
		content: base64Content,
		content_encoding: "base64",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, true, "base64 write must succeed")

	const writtenBytes = readFileSync(
		join(intentDir, "knowledge/binary-file.bin"),
	)
	const expected = Buffer.from(originalContent, "binary")
	assert.ok(
		writtenBytes.equals(expected),
		"decoded bytes must match original content",
	)
})

// ── Test 18: human_write_require_rationale: true + no rationale ───────────

await test("human_write_require_rationale: true + no rationale → rationale_required", async () => {
	const { haikuRoot } = makeFixture("test-rationale-required", {
		stages: ["development"],
	})

	// Write settings with rationale requirement enabled.
	writeFileSync(
		join(haikuRoot, "settings.yml"),
		"human_write_require_rationale: true\n",
	)

	const result = await invoke(haikuRoot, "test-rationale-required", {
		path: "knowledge/no-rationale.md",
		content: "some content",
		// rationale intentionally omitted
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "rationale_required")
	assert.strictEqual(body.config_key, "human_write_require_rationale")
})

// ── Test 19: Hook compatibility — guard-workflow-fields does not block tool ─

await test("Hook compatibility: guard-workflow-fields does not block haiku_human_write", async () => {
	// The guard-workflow-fields hook only fires on Read/Write/Edit/MultiEdit
	// tool names. The haiku_human_write tool is a separate MCP tool with its
	// own deny-list, providing defence-in-depth at the tool layer.
	// This test verifies that the tool's own deny-list is what rejects the
	// path — not an external hook.
	const { guardWorkflowFields } = await import(
		"../src/hooks/guard-workflow-fields.ts"
	)

	// The hook must NOT block a call with tool_name: "haiku_human_write".
	// guardWorkflowFields returns early when the tool name is not Read/Write/Edit/MultiEdit.
	// We call it and verify it does NOT call process.exit(2).
	let exitCalled = false
	const originalExit = process.exit.bind(process)
	// Temporarily replace process.exit to detect the hook firing.
	// Using Object.defineProperty to avoid TypeScript-only cast syntax in .mjs.
	const exitSpy = (code) => {
		if (code === 2) exitCalled = true
		// Do not actually exit — we're in a test.
	}
	Object.defineProperty(process, "exit", { value: exitSpy, configurable: true })

	try {
		// This should be a no-op — the hook ignores non-Read/Write/Edit tools.
		await guardWorkflowFields({
			tool_name: "haiku_human_write",
			tool_input: { path: "stages/design/state.json" },
		})
	} finally {
		Object.defineProperty(process, "exit", {
			value: originalExit,
			configurable: true,
		})
	}

	assert.strictEqual(
		exitCalled,
		false,
		"hook must NOT block haiku_human_write calls",
	)

	// Now verify the TOOL itself rejects the same deny-listed path.
	const { haikuRoot } = makeFixture("test-hook-compat", { stages: ["design"] })
	setHaikuRootForTests(haikuRoot)
	let toolResult
	try {
		toolResult = await tool.handle({
			intent_slug: "test-hook-compat",
			path: "stages/design/state.json",
			content: "{}",
		})
	} finally {
		setHaikuRootForTests(null)
	}

	const body = parseResult(toolResult)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "deny_list_match")
})

// ── Test 20: no_allow_match — does not append to audit log ────────────────

await test("no_allow_match rejection does not append to audit log", async () => {
	const { haikuRoot, intentDir } = makeFixture("test-no-allow", {
		stages: ["development"],
	})

	const result = await invoke(haikuRoot, "test-no-allow", {
		path: "stages/development/some-random-dir/file.md",
		content: "not in tracked surface",
	})

	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(body.error, "path_outside_tracked_surface")
	assert.strictEqual(body.reason, "no_allow_match")

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(
		auditLines.length,
		0,
		"no audit entry on no_allow_match rejection",
	)
})

// ── R-02 (V-05 producer fix on MCP path) ──────────────────────────────────
//
// Pre-fix: haiku_human_write called getCurrentTickCounter(intentDir) with no
// stage argument, which falls into a non-deterministic readdirSync(stagesDir)
// loop and returns the FIRST stage's iteration value. This is the same bug
// V-05 fixed on the SPA side. Two consecutive intent-scope MCP writes could
// share a tick value (drawn from whichever stage readdirSync ranked first)
// and the resulting entry_ids could collide with per-stage entries that
// happen to share the chosen tick. The drift gate's per-stage filter would
// then drop the human-via-mcp provenance entirely.
//
// The fix mirrors the SPA branch: intent-scope writes (knowledge/...) go
// through getIntentScopeTickCounter; stage-scope writes (stages/{X}/...)
// pass the parsed stage slug to getCurrentTickCounter explicitly. tick_scope
// is stamped on every action-log + audit-log entry so the drift-gate
// consumer's union routes the entry into the right read.

await test("R-02: intent-scope MCP write stamps tick_scope='intent' AND uses getIntentScopeTickCounter (deterministic, monotonic)", async () => {
	// Two stages with WILDLY different iterations so the readdirSync
	// lottery would clearly pick a wrong value pre-fix. The intent-scope
	// counter starts at 1 and is independent from both stage values.
	const { haikuRoot, intentDir } = makeFixture("r02-intent-scope", {
		stages: ["alpha", "beta"],
	})
	// Bump alpha's iteration to 99 and beta's to 7 so we can prove the
	// counter we get back is NEITHER stage's iteration value.
	writeFileSync(
		join(intentDir, "stages", "alpha", "state.json"),
		JSON.stringify({ iteration: 99, status: "active" }),
	)
	writeFileSync(
		join(intentDir, "stages", "beta", "state.json"),
		JSON.stringify({ iteration: 7, status: "active" }),
	)

	// First intent-scope write.
	const r1 = await invoke(haikuRoot, "r02-intent-scope", {
		path: "knowledge/r02-first.md",
		content: "first",
		human_author_id: "alice",
	})
	assert.strictEqual(parseResult(r1).ok, true)

	// Second intent-scope write.
	const r2 = await invoke(haikuRoot, "r02-intent-scope", {
		path: "knowledge/r02-second.md",
		content: "second",
		human_author_id: "alice",
	})
	assert.strictEqual(parseResult(r2).ok, true)

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(auditLines.length, 2, "two audit entries expected")

	// Both entries MUST stamp tick_scope='intent' so the drift gate
	// consumer reads them out of the intent-scope action-log union
	// rather than the per-stage union.
	assert.strictEqual(
		auditLines[0].tick_scope,
		"intent",
		"first intent-scope write MUST carry tick_scope='intent'",
	)
	assert.strictEqual(
		auditLines[1].tick_scope,
		"intent",
		"second intent-scope write MUST carry tick_scope='intent'",
	)

	// tick_counter MUST be monotonic & distinct (no collision).
	assert.notStrictEqual(
		auditLines[0].tick_counter,
		auditLines[1].tick_counter,
		"two consecutive intent-scope MCP writes MUST get DISTINCT tick_counter values (R-02 bypass would let them collide)",
	)
	assert.ok(
		auditLines[1].tick_counter > auditLines[0].tick_counter,
		"intent-scope tick MUST be monotonic",
	)

	// And the counter MUST come from the intent-scope counter (1, 2),
	// NOT from either stage's iteration (99 or 7) — proves we no
	// longer use the readdirSync lottery for intent-scope writes.
	assert.notStrictEqual(
		auditLines[0].tick_counter,
		99,
		"intent-scope MCP write MUST NOT use stages/alpha/state.json.iteration",
	)
	assert.notStrictEqual(
		auditLines[0].tick_counter,
		7,
		"intent-scope MCP write MUST NOT use stages/beta/state.json.iteration",
	)
	assert.strictEqual(
		auditLines[0].tick_counter,
		1,
		"intent-scope counter starts at 1 (no zero-collision with per-stage tick sentinel)",
	)
	assert.strictEqual(auditLines[1].tick_counter, 2)

	// Action log must mirror the same tick_scope discriminator so the
	// consumer-union in drift-detection-gate routes correctly.
	const actionLines = readActionLines(intentDir)
	assert.strictEqual(
		actionLines[0].tick_scope,
		"intent",
		"action log entry MUST carry tick_scope='intent' too",
	)
	assert.strictEqual(actionLines[1].tick_scope, "intent")
})

await test("R-02: stage-scope MCP write parses stage slug from canonical path (NOT readdirSync lottery)", async () => {
	const { haikuRoot, intentDir } = makeFixture("r02-stage-scope", {
		stages: ["alpha", "beta"],
	})
	writeFileSync(
		join(intentDir, "stages", "alpha", "state.json"),
		JSON.stringify({ iteration: 11, status: "active" }),
	)
	writeFileSync(
		join(intentDir, "stages", "beta", "state.json"),
		JSON.stringify({ iteration: 22, status: "active" }),
	)

	// Write to stages/beta/knowledge/...; we MUST get beta's iteration
	// value (22), NOT whichever stage readdirSync ranked first.
	const result = await invoke(haikuRoot, "r02-stage-scope", {
		path: "stages/beta/knowledge/r02-stage-beta.md",
		content: "stage-scoped",
		human_author_id: "alice",
	})
	assert.strictEqual(parseResult(result).ok, true)

	const auditLines = readAuditLines(intentDir)
	assert.strictEqual(auditLines.length, 1)
	assert.strictEqual(
		auditLines[0].tick_scope,
		"stage",
		"stage-scoped MCP write MUST stamp tick_scope='stage'",
	)
	assert.strictEqual(
		auditLines[0].tick_counter,
		22,
		"tick_counter MUST come from stages/beta/state.json (22), NOT from the readdirSync lottery (which could have returned 11 from alpha)",
	)

	// Same for action log.
	const actionLines = readActionLines(intentDir)
	assert.strictEqual(actionLines[0].tick_scope, "stage")
	assert.strictEqual(actionLines[0].tick_counter, 22)
})

// ── R-03 (V-06 helper coverage gap on MCP path) ───────────────────────────
//
// Pre-fix: SPA upload routes checked both isIntentArchived AND
// isIntentLocked, but haiku_human_write only checked archived state. An
// operator-locked intent (mid-revisit freeze) would reject SPA uploads
// (423 intent_locked) but happily accept haiku_human_write MCP calls.
// This test pins the symmetric helper coverage so the V-06 'shared helper
// rule' (both surfaces gate on both states) holds at the MCP boundary.

await test("R-03: locked intent rejects haiku_human_write with intent_locked (matches SPA 423 surface)", async () => {
	const { haikuRoot, intentDir } = makeFixture("r03-locked", {
		stages: ["development"],
	})
	// Lock the intent by rewriting intent.md with status: locked.
	writeFileSync(
		join(intentDir, "intent.md"),
		`---\ntitle: R-03 Locked Intent\nstatus: locked\n---\nLocked.\n`,
	)

	const result = await invoke(haikuRoot, "r03-locked", {
		path: "knowledge/r03-locked-write.md",
		content: "should be rejected",
		human_author_id: "alice",
	})
	const body = parseResult(result)
	assert.strictEqual(
		body.ok,
		false,
		"locked intent MUST reject haiku_human_write (R-03 helper coverage gap)",
	)
	assert.strictEqual(
		body.error,
		"intent_locked",
		"error code MUST be intent_locked (matches the SPA 423 intent_locked surface)",
	)

	// File must NOT have been written.
	assert.ok(
		!existsSync(join(intentDir, "knowledge/r03-locked-write.md")),
		"file must NOT be written when intent is locked",
	)
	// Audit log must NOT have been appended.
	assert.strictEqual(
		readAuditLines(intentDir).length,
		0,
		"no audit entry on intent_locked rejection",
	)
	// Action log must NOT have been stamped.
	assert.strictEqual(
		readActionLines(intentDir).length,
		0,
		"no action log entry on intent_locked rejection",
	)
})

await test("R-03: single-quoted YAML status: 'locked' rejects haiku_human_write (matches SPA single-quoted V-06 test)", async () => {
	const { haikuRoot, intentDir } = makeFixture("r03-locked-singlequoted", {
		stages: ["development"],
	})
	writeFileSync(
		join(intentDir, "intent.md"),
		`---\ntitle: R-03 Singlequoted Locked\nstatus: 'locked'\n---\nLocked.\n`,
	)

	const result = await invoke(haikuRoot, "r03-locked-singlequoted", {
		path: "knowledge/r03-singlequoted-locked.md",
		content: "should be rejected",
		human_author_id: "alice",
	})
	const body = parseResult(result)
	assert.strictEqual(body.ok, false)
	assert.strictEqual(
		body.error,
		"intent_locked",
		"single-quoted YAML status: 'locked' MUST classify as locked on the MCP surface (V-06 cross-surface contract)",
	)
})

await test("R-03: body-text quoting `status: locked` does NOT lock the MCP surface (no false-positives via shared helper)", async () => {
	const { haikuRoot, intentDir } = makeFixture("r03-bodytext-falsepos", {
		stages: ["development"],
	})
	writeFileSync(
		join(intentDir, "intent.md"),
		`---\ntitle: R-03 Body Text\nstatus: active\n---\nRunbook excerpt: when an intent has \`status: locked\` in its frontmatter, ...\n`,
	)

	const result = await invoke(haikuRoot, "r03-bodytext-falsepos", {
		path: "knowledge/r03-bodytext-not-locked.md",
		content: "should succeed",
		human_author_id: "alice",
	})
	const body = parseResult(result)
	assert.strictEqual(
		body.ok,
		true,
		"body text quoting `status: locked` MUST NOT classify as locked — gray-matter parses frontmatter only (V-06 cross-surface contract)",
	)
})

// ── Cleanup ────────────────────────────────────────────────────────────────

rmSync(tmp, { recursive: true, force: true })

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
