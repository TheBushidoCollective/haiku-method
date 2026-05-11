#!/usr/bin/env npx tsx
// intent-create-meta-pollution.test.mjs
//
// Failure mode this guards against: a user says "I want to start an
// intent only with the inception phase." The agent obediently passes
// that phrasing through as the intent's description, which becomes
// workflow-shape commentary instead of the subject of work the user
// wanted done. The engine owns studio / mode / stage selection via the
// SPA picker; the description should be substance.
//
// This test pins the guard: when title or description contains
// workflow-meta phrasing, haiku_intent_create returns
// `intent_create_meta_pollution` with a clear redirect message instead
// of silently writing the polluted intent to disk.
//
// The guard is permissive enough that legitimate domain content
// mentioning "stage" / "design" / "operations" / etc. is NOT rejected.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const intentCreate = (
	await import("../src/tools/orchestrator/haiku_intent_create.ts")
).default

function getJson(result) {
	const t = result?.content?.[0]?.text ?? ""
	try {
		return JSON.parse(t)
	} catch {
		return { _raw: t }
	}
}

function withTmpRepo(fn) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-meta-pollution-"))
	// findHaikuRoot walks up from cwd looking for `.haiku/`. Create one
	// so the "accepts" tests can reach past the pollution guard and
	// hit the rest of the handler.
	mkdirSync(join(tmp, ".haiku", "intents"), { recursive: true })
	const origCwd = process.cwd()
	try {
		process.chdir(tmp)
		return fn(tmp)
	} finally {
		try {
			process.chdir(origCwd)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(tmp, { recursive: true, force: true })
	}
}

// ── Pollution rejected ────────────────────────────────────────────

test("rejects: 'only with the inception phase' (the reported user phrasing)", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Some Intent",
			description: "only wants to run this in the inception phase.",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "intent_create_meta_pollution")
		assert.strictEqual(j.where, "description")
		assert.match(j.message, /Studio, mode, and stage are engine-managed/i)
	})
})

test("rejects: 'in continuous mode' in description", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Build dashboard",
			description: "Build the dashboard in continuous mode.",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("rejects: 'use the software studio'", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Build dashboard",
			description: "Use the software studio to ship a dashboard for ops.",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("rejects: 'autopilot mode' in title", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Refactor in autopilot mode",
			description: "Refactor the user service.",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "intent_create_meta_pollution")
		assert.strictEqual(j.where, "title")
	})
})

test("rejects: raw 'studio: software' in description (FM-in-body)", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Refactor user service",
			description: "studio: software\nmode: continuous\nDo the work.",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "intent_create_meta_pollution")
	})
})

// ── Legitimate domain usage NOT rejected ───────────────────────────

test("accepts: domain noun 'design' (UI work)", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Refresh checkout design",
			description:
				"The current checkout flow is dated. Redesign the form layout, button hierarchy, and the success state so it feels modern.",
		})
		const j = getJson(res)
		// Either succeeds or fails for an UNRELATED reason — the
		// meta-pollution guard must NOT fire on legitimate domain usage.
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("accepts: 'operations' as a domain noun (ops dashboard)", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Build operations dashboard",
			description:
				"The ops team needs a single pane that shows queue depth, error rates, and active incidents pulled from the live telemetry feed.",
		})
		const j = getJson(res)
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("accepts: 'inception' used as ordinary word, not workflow stage", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Write product origin doc",
			description:
				"Document the inception story of the product line — who decided what, when, and why we landed on the current shape.",
		})
		const j = getJson(res)
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("accepts: 'stage' as in performance/concert", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Stage manager app",
			description:
				"Build an app that manages live performance cues for stage managers running theater productions.",
		})
		const j = getJson(res)
		// "stage" appearing alone (not in a workflow-config phrase) must
		// not trip the guard.
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("accepts: 'development environment' as ordinary tech jargon", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Provision development environments",
			description:
				"Set up reproducible development environments for new hires using dev containers and a one-shot setup script.",
		})
		const j = getJson(res)
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("accepts: 'the yoga studio' as a domain noun (physical studio)", () => {
	// Regression: an earlier pattern `(use|using|in|with|the) X studio`
	// false-positived on "the <word> studio" for ANY word — including
	// real businesses like yoga, recording, tattoo, art. Narrowed to
	// directive verbs only (`use`/`using`) so domain content passes.
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Yoga studio booking system",
			description:
				"Build a booking and scheduling system for the yoga studio chain so instructors can manage classes and members can reserve spots.",
		})
		const j = getJson(res)
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("accepts: 'recording studio' as a domain noun", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Session manager for the recording studio",
			description:
				"The recording studio needs a session manager that tracks track lists, takes, and final mixes per project.",
		})
		const j = getJson(res)
		assert.notStrictEqual(j.error, "intent_create_meta_pollution")
	})
})

test("rejects: both title and description polluted — `where: 'title and description'`", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Build in autopilot mode",
			description: "Only with the inception phase.",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "intent_create_meta_pollution")
		assert.strictEqual(
			j.where,
			"title and description",
			"`where` must report both when both contain pollution",
		)
	})
})
