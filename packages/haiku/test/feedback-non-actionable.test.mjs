#!/usr/bin/env npx tsx
// feedback-non-actionable.test.mjs — admin-portal-reimagine BUG-6.
//
// A valid finding with no code fix (a question, an out-of-scope note, an
// immutable/superseded target) reached the builder, which can't edit files to
// advance and can't close — only reject_hat, which bounced to the classifier
// and looped to the bolt cap. The classifier can now TERMINAL-CLOSE such a
// finding via haiku_feedback_advance_hat { resolution: "non_actionable" } — a
// distinct terminal disposition (acknowledged, valid, no code fix), separate
// from a fixed-closure and from reject's invalid-rejection. The FB is never
// re-dispatched.

import assert from "node:assert/strict"
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
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
process.env.CLAUDE_PLUGIN_ROOT = join(resolve(HERE, "..", "..", ".."), "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function git(cwd, ...args) {
	execFileSync("git", args, { cwd, stdio: "ignore" })
}

const STAGE = "development"

function setup(slug) {
	const repo = mkdtempSync(join(tmpdir(), "haiku-na-"))
	git(repo, "init", "-q", "-b", "main")
	git(repo, "config", "user.email", "t@t")
	git(repo, "config", "user.name", "t")
	const intentDir = join(repo, ".haiku", "intents", slug)
	const fbDir = join(intentDir, "stages", STAGE, "feedback")
	mkdirSync(fbDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# t\n", {
			title: "t",
			studio: "software",
			mode: "continuous",
			stages: [STAGE],
		}),
	)
	// An open finding with no iterations — fresh, the classifier is its first hat.
	writeFileSync(
		join(fbDir, "01-question.md"),
		matter.stringify("Is the rate limit per-user or global?\n", {
			id: "FB-001",
			title: "question: rate-limit scope",
			origin: "user-question",
			author: "test",
			stage: STAGE,
			created_at: "2026-05-24T00:00:00Z",
			triaged_at: "2026-05-24T00:00:00Z",
			iterations: [],
			reviews: {},
			approvals: {},
			targets: { unit: null, invalidates: [] },
		}),
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-q", "-m", "seed")
	git(repo, "checkout", "-q", "-b", `haiku/${slug}/main`)
	git(repo, "checkout", "-q", "-b", `haiku/${slug}/${STAGE}`)
	return { repo, intentDir, fbDir }
}

async function call(slug, args) {
	const orig = process.cwd()
	process.chdir(args._repo)
	try {
		const { handleStateTool, _resetIsGitRepoForTests } = await import(
			`${SRC}/state-tools.ts`
		)
		_resetIsGitRepoForTests()
		const { _repo, ...toolArgs } = args
		const resp = await handleStateTool("haiku_feedback_advance_hat", {
			intent: slug,
			stage: STAGE,
			feedback_id: 1,
			...toolArgs,
		})
		return JSON.parse(resp.content?.[0]?.text ?? "{}")
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
	}
}

test("advance_hat resolution:non_actionable terminal-closes the FB as non_actionable", async () => {
	if (!HAS_GIT) return
	const slug = "na-close"
	const { repo, fbDir } = setup(slug)
	try {
		const parsed = await call(slug, {
			_repo: repo,
			resolution: "non_actionable",
			message:
				"Answered inline: the rate limit is per-user. No code change — the spec already says so.",
		})
		assert.strictEqual(
			parsed.action,
			"feedback_non_actionable",
			`expected feedback_non_actionable; got ${JSON.stringify(parsed)}`,
		)
		assert.strictEqual(parsed.resolution, "non_actionable")

		// On disk: terminal-closed with the non_actionable resolution.
		const fm = matter(readFileSync(join(fbDir, "01-question.md"), "utf8")).data
		assert.ok(fm.closed_at, "closed_at must be stamped (terminal)")
		assert.strictEqual(fm.resolution, "non_actionable")
		const { deriveFeedbackStatus } = await import(`${SRC}/state-tools.ts`)
		assert.strictEqual(
			deriveFeedbackStatus(fm),
			"non_actionable",
			"status derives to non_actionable (distinct from closed/rejected)",
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("a non_actionable FB is terminal — a second advance is refused", async () => {
	if (!HAS_GIT) return
	const slug = "na-terminal"
	const { repo } = setup(slug)
	try {
		await call(slug, {
			_repo: repo,
			resolution: "non_actionable",
			message: "out of scope for this stage",
		})
		const again = await call(slug, {
			_repo: repo,
			message: "try again",
		})
		assert.strictEqual(
			again.error,
			"lifecycle_violation",
			`a closed non_actionable FB must not advance again; got ${JSON.stringify(again)}`,
		)
		assert.strictEqual(again.current_status, "non_actionable")
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("resolution:non_actionable without a reason is refused", async () => {
	if (!HAS_GIT) return
	const slug = "na-noreason"
	const { repo } = setup(slug)
	try {
		const parsed = await call(slug, {
			_repo: repo,
			resolution: "non_actionable",
			message: "",
		})
		// message minLength:1 trips the input gate, OR the handler's
		// reason_required guard — either way it must NOT close.
		assert.ok(
			parsed.error === "reason_required" ||
				/input_invalid|message/i.test(JSON.stringify(parsed)),
			`closing non_actionable with no reason must be refused; got ${JSON.stringify(parsed)}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
