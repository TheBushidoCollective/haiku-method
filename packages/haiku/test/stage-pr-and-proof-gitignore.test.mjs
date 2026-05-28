#!/usr/bin/env npx tsx
// stage-pr-and-proof-gitignore.test.mjs — per-stage delivery PR + proof
// gitignore + verifier proof-upload wiring.
//
// Covers the engine half of "script-driven proof, gitignored artifacts,
// PR-uploaded evidence, per-stage draft PRs":
//   - runtime-verifier is in BOTH role-classes (additive scope grants)
//   - the stage_prs map round-trips on intent.md FM and is NOT a tamper field
//   - ensureHaikuGitignored seeds worktrees + proof patterns idempotently
//   - dispatch_approval hands a runtime-verifier the mode-aware proof
//     upload target (discrete → stage PR; continuous → intent-main PR)
//
// The gh/glab happy path isn't shimmed (no suite precedent) — the
// no-CLI / FM / classification paths are what wedge a real user.
//
// All engine imports are hoisted to top-level await so every test body
// stays fully synchronous (the builder is sync once imported); that
// keeps the manual passed/failed counter honest.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")
process.env.HAIKU_PROJECTS_ROOT = mkdtempSync(join(tmpdir(), "haiku-stagepr-pr-"))

const SRC = new URL("../src/", import.meta.url).pathname
const { _resetIsGitRepoForTests } = await import(`${SRC}state/shared.ts`)
const { RUNTIME_OBSERVATION_ROLES, PR_INTERACTION_ROLES } = await import(
	`${SRC}orchestrator/review-role-classes.ts`
)
const { setStagePrField, readStagePr, readStagePrs, ensureHaikuGitignored } =
	await import(`${SRC}state-tools.ts`)
const { stageRequiresExternalReview } = await import(`${SRC}orchestrator/studio.ts`)
const { INTENT_FIELDS } = await import(`${SRC}workflow-fields.ts`)
const { actionPromptBuilders } = await import(`${SRC}orchestrator/prompts/index.ts`)

let passed = 0
let failed = 0
function test(name, fn) {
	_resetIsGitRepoForTests()
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
		if (err.stack)
			console.log(`    ${err.stack.split("\n").slice(1, 4).join("\n    ")}`)
	}
}

function withCwd(dir, fn) {
	const prev = process.cwd()
	process.chdir(dir)
	try {
		return fn()
	} finally {
		process.chdir(prev)
	}
}

function makeRepo() {
	const dir = mkdtempSync(join(tmpdir(), "haiku-stagepr-"))
	execFileSync("git", ["init", "--initial-branch=main"], {
		cwd: dir,
		stdio: "pipe",
	})
	execFileSync("git", ["config", "user.email", "t@e.com"], {
		cwd: dir,
		stdio: "pipe",
	})
	execFileSync("git", ["config", "user.name", "t"], { cwd: dir, stdio: "pipe" })
	writeFileSync(join(dir, "README.md"), "# test\n")
	execFileSync("git", ["add", "."], { cwd: dir, stdio: "pipe" })
	execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "pipe" })
	return dir
}

/** Lay down `.haiku/intents/<slug>/intent.md` with the given frontmatter. */
function seedIntent(repoDir, slug, fm) {
	const iDir = join(repoDir, ".haiku", "intents", slug)
	mkdirSync(iDir, { recursive: true })
	const lines = Object.entries(fm).map(([k, v]) =>
		typeof v === "string" ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`,
	)
	writeFileSync(
		join(iDir, "intent.md"),
		`---\n${lines.join("\n")}\n---\n\n# ${slug}\n`,
	)
	return iDir
}

function gitignoreLines(repo) {
	try {
		return readFileSync(join(repo, ".gitignore"), "utf8")
	} catch {
		return ""
	}
}

/** Build a dispatch_approval prompt for runtime-verifier in `repo` and
 *  return the file-backed subagent body. Synchronous — builder is sync. */
function approvalBodyFor(repo, slug, stage) {
	const builder = actionPromptBuilders.get("dispatch_approval")
	return withCwd(repo, () => {
		const out = builder({
			slug,
			studio: "software",
			action: {
				kind: "dispatch_approval",
				stage,
				role: "runtime-verifier",
				units: ["unit-01-foo"],
			},
		})
		const m = out.match(/prompt_file="([^"]+)"/)
		assert.ok(m, "dispatch_approval must emit a file-backed subagent block")
		return readFileSync(m[1], "utf8")
	})
}

console.log("=== role classification ===")

test("runtime-verifier is in BOTH runtime-observation AND pr-interaction sets", () => {
	assert.ok(
		RUNTIME_OBSERVATION_ROLES.has("runtime-verifier"),
		"runtime-verifier drives the live work (observation)",
	)
	assert.ok(
		PR_INTERACTION_ROLES.has("runtime-verifier"),
		"runtime-verifier also uploads its proof to the PR (interaction)",
	)
	assert.ok(
		PR_INTERACTION_ROLES.has("delivery-verifier"),
		"delivery-verifier stays a PR-interaction role",
	)
	assert.ok(
		!RUNTIME_OBSERVATION_ROLES.has("delivery-verifier"),
		"delivery-verifier is NOT a runtime-observation role",
	)
})

console.log("\n=== discrete-hybrid external-review stage gating ===")

test("stageRequiresExternalReview reads STAGE.md review gate (software)", () => {
	// [external, ask] → external; ask / auto → not external.
	assert.strictEqual(
		stageRequiresExternalReview("software", "development"),
		true,
		"development is [external, ask] → external",
	)
	assert.strictEqual(
		stageRequiresExternalReview("software", "design"),
		true,
		"design is [external, ask] → external",
	)
	assert.strictEqual(
		stageRequiresExternalReview("software", "inception"),
		false,
		"inception is `ask` → not external",
	)
	assert.strictEqual(
		stageRequiresExternalReview("software", "operations"),
		false,
		"operations is `auto` → not external",
	)
})

console.log("\n=== stage_prs map on intent.md FM ===")

test("setStagePrField → readStagePr round-trips one stage record", () => {
	const repo = makeRepo()
	withCwd(repo, () => {
		seedIntent(repo, "demo", { studio: "software", mode: "discrete" })
		setStagePrField("demo", "design", "url", "https://github.com/o/r/pull/7")
		setStagePrField("demo", "design", "status", "draft")
		const rec = readStagePr("demo", "design")
		assert.strictEqual(rec.url, "https://github.com/o/r/pull/7")
		assert.strictEqual(rec.status, "draft")
	})
	rmSync(repo, { recursive: true, force: true })
})

test("two stages do not clobber each other in the map", () => {
	const repo = makeRepo()
	withCwd(repo, () => {
		seedIntent(repo, "demo", { studio: "software", mode: "discrete" })
		setStagePrField("demo", "design", "url", "https://x/pull/1")
		setStagePrField("demo", "development", "url", "https://x/pull/2")
		const map = readStagePrs("demo")
		assert.strictEqual(map.design.url, "https://x/pull/1")
		assert.strictEqual(map.development.url, "https://x/pull/2")
	})
	rmSync(repo, { recursive: true, force: true })
})

test("readStagePr returns null for a stage with no PR", () => {
	const repo = makeRepo()
	withCwd(repo, () => {
		seedIntent(repo, "demo", { studio: "software", mode: "discrete" })
		assert.strictEqual(readStagePr("demo", "design"), null)
	})
	rmSync(repo, { recursive: true, force: true })
})

test("stage_prs is NOT a tamper-checksummed INTENT_FIELD", () => {
	assert.ok(
		!INTENT_FIELDS.includes("stage_prs"),
		"stage_prs must stay out of INTENT_FIELDS (engine-written, like draft_pr_*)",
	)
})

console.log("\n=== ensureHaikuGitignored ===")

test("fresh repo gets worktree pool + both proof globs", () => {
	const repo = makeRepo()
	withCwd(repo, () => {
		ensureHaikuGitignored()
		const gi = gitignoreLines(repo)
		assert.match(gi, /\.haiku\/worktrees\//, "worktree pool ignored")
		assert.match(
			gi,
			/\.haiku\/intents\/\*\/stages\/\*\/proof\//,
			"per-stage proof ignored",
		)
		assert.match(gi, /\.haiku\/intents\/\*\/proof\//, "intent proof ignored")
	})
	rmSync(repo, { recursive: true, force: true })
})

test("idempotent — a second call adds nothing and makes no new commit", () => {
	const repo = makeRepo()
	withCwd(repo, () => {
		ensureHaikuGitignored()
		const headAfterFirst = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: repo,
			encoding: "utf8",
		}).trim()
		const giAfterFirst = gitignoreLines(repo)
		ensureHaikuGitignored()
		const headAfterSecond = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: repo,
			encoding: "utf8",
		}).trim()
		assert.strictEqual(
			headAfterSecond,
			headAfterFirst,
			"second call must not create a commit",
		)
		assert.strictEqual(
			gitignoreLines(repo),
			giAfterFirst,
			"second call must not rewrite .gitignore",
		)
	})
	rmSync(repo, { recursive: true, force: true })
})

test("pre-existing worktrees entry → only the proof globs get added", () => {
	const repo = makeRepo()
	withCwd(repo, () => {
		writeFileSync(join(repo, ".gitignore"), "node_modules/\n.haiku/worktrees/\n")
		execFileSync("git", ["add", ".gitignore"], { cwd: repo, stdio: "pipe" })
		execFileSync("git", ["commit", "-m", "pre"], { cwd: repo, stdio: "pipe" })
		ensureHaikuGitignored()
		const gi = gitignoreLines(repo)
		const worktreeCount = gi
			.split("\n")
			.filter((l) => l.trim() === ".haiku/worktrees/").length
		assert.strictEqual(worktreeCount, 1, "worktrees entry not duplicated")
		assert.match(gi, /\.haiku\/intents\/\*\/proof\//, "proof globs added")
	})
	rmSync(repo, { recursive: true, force: true })
})

console.log("\n=== mode-aware proof upload target (dispatch_approval) ===")

test("discrete mode → upload target is the stage PR", () => {
	const repo = makeRepo()
	seedIntent(repo, "demo", {
		studio: "software",
		mode: "discrete",
		draft_pr_url: "https://github.com/o/r/pull/1",
		stage_prs: { development: { url: "https://github.com/o/r/pull/9" } },
	})
	const body = approvalBodyFor(repo, "demo", "development")
	assert.ok(
		body.includes("PR/MR interaction"),
		"runtime-verifier gets the PR-interaction block",
	)
	assert.ok(
		body.includes("https://github.com/o/r/pull/9"),
		"discrete proof target is the stage PR, not the intent-main PR",
	)
	assert.ok(
		!body.includes("pull/1"),
		"the intent-main draft PR is NOT the discrete target",
	)
	rmSync(repo, { recursive: true, force: true })
})

test("continuous mode → upload target is the intent-main draft PR", () => {
	const repo = makeRepo()
	seedIntent(repo, "demo2", {
		studio: "software",
		mode: "continuous",
		draft_pr_url: "https://github.com/o/r/pull/1",
		stage_prs: { development: { url: "https://github.com/o/r/pull/9" } },
	})
	const body = approvalBodyFor(repo, "demo2", "development")
	assert.ok(
		body.includes("https://github.com/o/r/pull/1"),
		"continuous proof target is the intent-main draft PR",
	)
	assert.ok(
		!body.includes("pull/9"),
		"a stray stage_prs entry must NOT be used in continuous mode",
	)
	rmSync(repo, { recursive: true, force: true })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
