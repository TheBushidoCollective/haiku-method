#!/usr/bin/env npx tsx
// write-brief-path.test.mjs
//
// The 2026-05-26 bug class: the briefer subagent wrote BRIEF.md with the
// generic Write tool, and an under-specified relative path resolved outside
// the repo (into the GLOBAL ~/.haiku/projects/… dir where the prompt file
// lives in dev mode), so the engine never saw it and the cursor re-emitted
// write_brief forever.
//
// The 2026-05-29 redesign eliminates that class structurally: the briefer
// calls the `haiku_write_brief { body }` tool and the ENGINE writes BRIEF.md
// to the canonical `.haiku/intents/<slug>/stages/<stage>/BRIEF.md` path it
// reads from — the agent never names a path, so it can never get it wrong.
// This test now pins that NEW contract: the prompt routes through the tool
// (body only) and does NOT instruct a direct file write.

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

test("briefer prompt routes through haiku_write_brief with body only", async () => {
	const body = await briefSubagentBody("demo-intent", "design")
	assert.match(
		body,
		/haiku_write_brief\s*\{\s*body:/,
		"must instruct calling `haiku_write_brief { body: … }`",
	)
})

test("briefer prompt does NOT hand the agent a BRIEF.md filesystem path", async () => {
	const body = await briefSubagentBody("demo-intent", "design")
	// The engine owns the path now — the prompt must not name any BRIEF.md
	// filesystem path for the agent to write to. (Telling the agent NOT to use
	// the Write tool is fine and expected; we only forbid a positive path.)
	assert.doesNotMatch(
		body,
		/stages\/[^/]*\/BRIEF\.md|\.haiku\/intents\/[^/]*\/.*BRIEF\.md/,
		"prompt must not name a BRIEF.md path — that's the tool's job",
	)
})

test("briefer prompt does NOT make the agent specify intent/stage/phase", async () => {
	const body = await briefSubagentBody("demo-intent", "design")
	// Those are engine-resolved (intent from branch, stage from cursor, phase
	// from file existence). The tool call the prompt shows must be body-only.
	assert.doesNotMatch(
		body,
		/haiku_write_brief\s*\{[^}]*\b(intent|stage|phase)\s*:/,
		"the haiku_write_brief call must pass body only — no intent/stage/phase",
	)
})

test("cleanup", () => {
	rmSync(process.env.HAIKU_PROJECTS_ROOT, { recursive: true, force: true })
})
