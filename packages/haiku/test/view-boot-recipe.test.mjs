// view-boot-recipe.test.mjs — `.haiku/boot.md` project boot recipe
// resolution. The harness-agnostic analog of a committed run-skill:
// the project declares once how to boot/drive its app and every agent
// on every harness uses it. Recipes normalize to a process group so a
// single `command:` and a multi-process stack share one supervisor.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

/** Make a temp project root with a `.haiku/boot.md` carrying `frontmatter`. */
function projectWithRecipe(frontmatter, body = "") {
	const root = mkdtempSync(join(tmpdir(), "haiku-boot-"))
	mkdirSync(join(root, ".haiku"), { recursive: true })
	writeFileSync(join(root, ".haiku", "boot.md"), `---\n${frontmatter}\n---\n${body}\n`)
	return root
}

test("absent recipe → null", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = mkdtempSync(join(tmpdir(), "haiku-boot-none-"))
	try {
		assert.equal(readBootRecipe(root), null)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("notes-only recipe (no command/processes) → null", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe("title: how to run", "Just notes, no boot config.")
	try {
		assert.equal(readBootRecipe(root), null)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("single command → one-process group named 'app', cwd joined to project root", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe(
		'command: [bin/dev]\ncwd: web\nenv:\n  RAILS_ENV: development\nready_url: "http://127.0.0.1:{port}/up"',
	)
	try {
		const recipe = readBootRecipe(root)
		assert.ok(recipe, "recipe resolves")
		assert.equal(recipe.primary, "app")
		assert.equal(recipe.processes.length, 1)
		const p = recipe.processes[0]
		assert.deepEqual(p.command, ["bin/dev"])
		assert.equal(p.cwd, join(root, "web"))
		assert.deepEqual(p.env, { RAILS_ENV: "development" })
		assert.equal(p.ready_url, "http://127.0.0.1:{port}/up")
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("single command with no cwd → cwd defaults to project root", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe("command: [npm, run, dev]")
	try {
		const recipe = readBootRecipe(root)
		assert.equal(recipe.processes[0].cwd, root)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("single command with no_port:true → throws (a URL-driver can't be portless)", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe("command: [bin/dev]\nno_port: true")
	try {
		assert.throws(() => readBootRecipe(root), /no_port/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("multi-process recipe → specs + inferred primary (single port-bound)", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe(
		[
			"processes:",
			"  - name: api",
			"    command: [bin/rails, server]",
			"    no_port: true",
			"  - name: web",
			"    command: [npm, run, dev]",
			"    depends_on: [api]",
			"    cwd: frontend",
		].join("\n"),
	)
	try {
		const recipe = readBootRecipe(root)
		assert.equal(recipe.primary, "web", "the only port-bound process is inferred primary")
		assert.equal(recipe.processes.length, 2)
		const web = recipe.processes.find((p) => p.name === "web")
		assert.equal(web.cwd, join(root, "frontend"))
		assert.deepEqual(web.depends_on, ["api"])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("multi-process with explicit primary", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe(
		[
			"primary: web",
			"processes:",
			"  - name: api",
			"    command: [uvicorn, app:main]",
			"  - name: web",
			"    command: [npm, run, dev]",
		].join("\n"),
	)
	try {
		assert.equal(readBootRecipe(root).primary, "web")
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("multi-process, multiple port-bound, no primary → throws", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe(
		[
			"processes:",
			"  - name: api",
			"    command: [uvicorn, app:main]",
			"  - name: web",
			"    command: [npm, run, dev]",
		].join("\n"),
	)
	try {
		assert.throws(() => readBootRecipe(root), /primary/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("primary naming a process not in the group → throws", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe(
		["primary: nope", "processes:", "  - name: web", "    command: [npm, run, dev]"].join("\n"),
	)
	try {
		assert.throws(() => readBootRecipe(root), /does not match/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("command not an array of strings → throws", async () => {
	const { readBootRecipe } = await import(`${SRC}view-boot.ts`)
	const root = projectWithRecipe('command: "bin/dev"')
	try {
		assert.throws(() => readBootRecipe(root), /non-empty array of strings/)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
