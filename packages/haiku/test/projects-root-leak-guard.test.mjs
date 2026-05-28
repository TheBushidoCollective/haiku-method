#!/usr/bin/env npx tsx
// Guard: the home `~/.haiku/projects/` fallback must live in ONE place.
//
// Why this exists: the per-project state tree (prompts, sessions, shared
// blocks, statusline snapshots) is keyed under a projects root. `projectsBaseDir()`
// in subagent-prompt-file.ts is the single source of truth — it resolves
// HAIKU_PROJECTS_ROOT → a per-process tmpdir sandbox when under a test runner
// → the real `~/.haiku/projects/`. That test-runner fallback is what keeps a
// bare `npx tsx test/foo.test.mjs` (no harness env) from mirroring fixture
// trees into the user's real home.
//
// The leak this guards against (seen 2026-05-19 for prompt files, again
// 2026-05-21 for shared blocks): a new module copy-pastes
// `process.env.HAIKU_PROJECTS_ROOT ?? join(homedir(), ".haiku", "projects")`
// instead of importing projectsBaseDir(). Its private copy lacks the
// test-runner fallback, so every direct test run leaves a `<key>/` dir behind.
//
// This test greps the compiled-from sources and fails if any file other than
// the canonical owner builds that path itself. Route through projectsBaseDir().
//
// Run: npx tsx test/projects-root-leak-guard.test.mjs

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")

// The one file allowed to construct the home fallback — it owns projectsBaseDir().
const CANONICAL_OWNER = "subagent-prompt-file.ts"

/** Recursively collect every .ts source file under src/. */
function tsFiles(dir) {
	const out = []
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) out.push(...tsFiles(full))
		else if (entry.endsWith(".ts")) out.push(full)
	}
	return out
}

// Matches `homedir()` joined with ".haiku" then "projects" on one logical
// expression — the projects-root home fallback. Tolerant of whitespace.
// Does NOT match `join(homedir(), ".haiku")` alone (the statusline installer's
// deliberate global target), only the deeper /projects build.
const HOME_PROJECTS_RE =
	/homedir\(\)\s*,\s*["']\.haiku["']\s*,\s*["']projects["']/

test("only subagent-prompt-file.ts builds the ~/.haiku/projects home fallback", () => {
	const offenders = []
	for (const file of tsFiles(SRC)) {
		const text = readFileSync(file, "utf8")
		if (!HOME_PROJECTS_RE.test(text)) continue
		// Strip line comments / block-comment lines so a doc-comment mentioning
		// the path doesn't count as a real construction.
		const codeOnly = text
			.split("\n")
			.filter((l) => {
				const t = l.trim()
				return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
			})
			.join("\n")
		if (!HOME_PROJECTS_RE.test(codeOnly)) continue
		if (file.endsWith(CANONICAL_OWNER)) continue
		offenders.push(file.replace(`${SRC}/`, ""))
	}
	assert.deepEqual(
		offenders,
		[],
		`These files build the \`~/.haiku/projects\` path directly instead of importing ` +
			`projectsBaseDir() from subagent-prompt-file.ts. Their private fallback lacks ` +
			`the test-runner sandbox, so direct test runs leak fixture state into the ` +
			`user's real home. Route through projectsBaseDir():\n  ${offenders.join("\n  ")}`,
	)
})
