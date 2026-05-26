#!/usr/bin/env npx tsx
// write-brief-path.test.mjs
//
// Regression for the 2026-05-26 bug: the briefer subagent wrote BRIEF.md
// to the GLOBAL haiku dir (~/.haiku/projects/…, where the prompt file
// itself lives in dev mode) instead of the repo's stage dir. Root cause:
// the prompt said "Write BRIEF.md at the stage root — stages/<stage>/BRIEF.md",
// dropping the `.haiku/intents/<slug>/` prefix. The agent writes it with
// the generic Write tool, so the under-specified relative path resolved
// outside the repo.
//
// The engine ONLY reads BRIEF.md from `.haiku/intents/<slug>/stages/<stage>/
// BRIEF.md` (cursor `stillOwesBrief`, session-api, and the guard regex), so
// a brief written anywhere else is invisible and the cursor re-emits
// write_brief forever. This test pins that the subagent prompt names the
// full repo-relative path and warns against the metadata dir — matching the
// fix already in record_observations.

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(TEST_DIR, "..", "..", "..", "plugin")
process.env.HAIKU_PROJECTS_ROOT = mkdtempSync(join(tmpdir(), "haiku-brief-"))

function briefSubagentBody(slug = "demo-intent", stage = "design") {
	return import(`${SRC}orchestrator/prompts/index.ts`).then(
		({ actionPromptBuilders }) => {
			const builder = actionPromptBuilders.get("write_brief")
			assert.ok(builder, "write_brief builder must be registered")
			const out = builder({
				slug,
				studio: "software",
				action: { kind: "write_brief", stage },
			})
			const m = out.match(/prompt_file="([^"]+)"/)
			assert.ok(m, "write_brief must emit a file-backed briefer subagent block")
			return readFileSync(m[1], "utf8")
		},
	)
}

test("briefer prompt names the FULL repo-relative BRIEF.md path", async () => {
	const body = await briefSubagentBody("demo-intent", "design")
	assert.match(
		body,
		/\.haiku\/intents\/demo-intent\/stages\/design\/BRIEF\.md/,
		"must name the full `.haiku/intents/<slug>/stages/<stage>/BRIEF.md` path the engine reads",
	)
})

test("briefer prompt does NOT use the prefix-less `stages/<stage>/BRIEF.md` (the bug)", async () => {
	const body = await briefSubagentBody("demo-intent", "design")
	// The truncated form must not appear except as the tail of the full
	// path. Strip the full paths, then assert no bare occurrence remains.
	const withoutFull = body.replace(
		/\.haiku\/intents\/[^/]+\/stages\/[^/]+\/BRIEF\.md/g,
		"",
	)
	assert.doesNotMatch(
		withoutFull,
		/(^|[^/])stages\/[^/]*\/BRIEF\.md/,
		"must not tell the agent to write a prefix-less stages/<stage>/BRIEF.md",
	)
})

test("briefer prompt warns against the global ~/.haiku metadata dir", async () => {
	const body = await briefSubagentBody("demo-intent", "design")
	assert.match(
		body,
		/~\/\.haiku\/projects|metadata dir|repo-relative/i,
		"must warn the brief is repo-relative, not the ~/.haiku metadata dir",
	)
})

test("cleanup", () => {
	rmSync(process.env.HAIKU_PROJECTS_ROOT, { recursive: true, force: true })
})
