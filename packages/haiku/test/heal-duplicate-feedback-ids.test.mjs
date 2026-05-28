// heal-duplicate-feedback-ids.test.mjs
//
// Bug (worker-new-badge, 2026-05-28): two intent-completion reviewers
// (cross-stage-consistency + runtime-verifier) each allocated FB-003 because
// their feedback-create pushes raced a moving origin (local intent-main was
// behind by a CI auto-fix commit). `nextFeedbackNumber` is local-max+1, so
// both picked 003; the non-fast-forward rebase recovery (git-worktree) then
// left BOTH files on disk — `003-cross-stage-….md` AND `003-runtime-….md`.
// Different filenames, SAME numeric prefix → `readFeedbackFiles` returns two
// items with id `FB-003`, and lookup-by-id returns only the first. The
// cross-stage-consistency BLOCKER (delivery branch net-deletes a dev's fix)
// was the shadowed one and was nearly lost.
//
// The heal gate renumbers duplicate-prefix files so every FB has a unique
// id — the earliest-created keeps its number, later ones get fresh ids
// (filename + sidecar attachment + body attachment-URL all moved). No
// finding is ever silently shadowed again.

import assert from "node:assert/strict"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const REPO_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
)
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const { readFeedbackFiles } = await import(`${SRC}state-tools.ts`)
const { healDuplicateFeedbackIds } = await import(
	`${SRC}orchestrator/workflow/heal-duplicate-feedback-ids.ts`
)

let _n = 0
function seed() {
	const root = mkdtempSync(join(tmpdir(), "haiku-fbheal-"))
	const slug = `dup-${_n++}`
	const fbDir = join(root, ".haiku", "intents", slug, "feedback")
	mkdirSync(fbDir, { recursive: true })
	return { root, slug, fbDir }
}

function writeFb(fbDir, filename, fm, body = "body\n") {
	writeFileSync(join(fbDir, filename), matter.stringify(body, fm))
}

function withCwd(root, fn) {
	const prev = process.cwd()
	process.chdir(root)
	try {
		return fn()
	} finally {
		process.chdir(prev)
		rmSync(root, { recursive: true, force: true })
	}
}

test("two files sharing a numeric prefix shadow one finding (the bug)", () => {
	const { root, slug, fbDir } = seed()
	withCwd(root, () => {
		writeFb(fbDir, "003-cross-stage-blocker.md", {
			title: "blocker A",
			origin: "studio-review",
			created_at: "2026-05-28T07:00:00Z",
		})
		writeFb(fbDir, "003-runtime-api-blocked.md", {
			title: "finding B",
			origin: "studio-review",
			created_at: "2026-05-28T07:01:00Z",
		})
		// readFeedbackFiles yields TWO items, both id FB-003 — the shadow.
		const before = readFeedbackFiles(slug, "")
		const threes = before.filter((f) => f.id === "FB-003")
		assert.equal(
			threes.length,
			2,
			"fixture: two FB-003 on disk (the collision)",
		)
	})
})

test("heal renumbers the later duplicate; both findings survive with unique ids", () => {
	const { root, slug, fbDir } = seed()
	withCwd(root, () => {
		// Earliest-created keeps 003; the later one must be renumbered.
		writeFb(fbDir, "003-cross-stage-blocker.md", {
			title: "blocker A",
			origin: "studio-review",
			created_at: "2026-05-28T07:00:00Z",
		})
		writeFb(fbDir, "003-runtime-api-blocked.md", {
			title: "finding B",
			origin: "studio-review",
			created_at: "2026-05-28T07:01:00Z",
		})

		const res = healDuplicateFeedbackIds(slug, [])
		assert.equal(res.renamed.length, 1, "exactly one file renumbered")

		const after = readFeedbackFiles(slug, "")
		const ids = after.map((f) => f.id).sort()
		// Two findings, two DISTINCT ids — no shadow.
		assert.equal(after.length, 2, "both findings preserved")
		assert.equal(new Set(ids).size, 2, "ids are now unique")
		assert.ok(ids.includes("FB-003"), "earliest-created keeps FB-003")
		// The earliest (blocker A) keeps 003; the later (finding B) was bumped.
		const three = after.find((f) => f.id === "FB-003")
		assert.equal(three.title, "blocker A", "earliest-created keeps the id")
		const bumped = after.find((f) => f.id !== "FB-003")
		assert.equal(bumped.title, "finding B", "later duplicate got the fresh id")
	})
})

test("heal moves the sidecar attachment + rewrites the body URL", () => {
	const { root, slug, fbDir } = seed()
	withCwd(root, () => {
		writeFb(fbDir, "005-first.md", {
			title: "first",
			origin: "user-visual",
			created_at: "2026-05-28T07:00:00Z",
		})
		// The duplicate carries a sidecar PNG + a body attachment URL.
		writeFb(
			fbDir,
			"005-second-with-image.md",
			{
				title: "second",
				origin: "user-visual",
				created_at: "2026-05-28T07:05:00Z",
				attachment: "005-second-with-image.png",
			},
			`see image\n\n![annotation](/api/feedback-attachment/${slug}//005-second-with-image.png)\n`,
		)
		writeFileSync(join(fbDir, "005-second-with-image.png"), "PNGDATA")

		const res = healDuplicateFeedbackIds(slug, [])
		assert.equal(res.renamed.length, 1)
		const { to } = res.renamed[0]
		// New numeric prefix; sidecar renamed to match; body URL points at it.
		const newNum = to.match(/(\d+)-/)[1]
		assert.notEqual(newNum, "005", "second was renumbered off 005")
		// Old sidecar gone, new sidecar present.
		assert.ok(
			!existsSync(join(fbDir, "005-second-with-image.png")),
			"old sidecar removed",
		)
		const after = readFeedbackFiles(slug, "")
		const bumped = after.find((f) => f.title === "second")
		assert.ok(
			bumped.body.includes(`${newNum}-second-with-image.png`),
			`body attachment URL rewritten to the new prefix; got: ${bumped.body}`,
		)
		assert.ok(
			existsSync(join(fbDir, `${newNum}-second-with-image.png`)),
			"new sidecar present",
		)
	})
})

test("heal is a no-op when ids are already unique", () => {
	const { root, slug, fbDir } = seed()
	withCwd(root, () => {
		writeFb(fbDir, "001-a.md", {
			title: "a",
			created_at: "2026-05-28T07:00:00Z",
		})
		writeFb(fbDir, "002-b.md", {
			title: "b",
			created_at: "2026-05-28T07:01:00Z",
		})
		const res = healDuplicateFeedbackIds(slug, [])
		assert.equal(res.renamed.length, 0, "no duplicates → no renames")
	})
})
