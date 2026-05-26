#!/usr/bin/env npx tsx
// intent-create-studio-candidates.test.mjs
//
// The agent picks the 2–4 best-fit studios when it creates an intent
// (it has the description in context then) and passes them as
// `studio_candidates`. haiku_intent_create resolves each to its
// canonical name, dedupes, drops anything unresolvable, and stamps the
// result on intent.md — the inline studio picker reads it to present a
// shortlist instead of the whole registry. This test pins that stamp.

import assert from "node:assert"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs"
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
const { resolveStudio } = await import("../src/studio-reader.ts")
const { parseFrontmatter } = await import("../src/state-tools.ts")
const { getPluginVersion } = await import("../src/version.ts")

function getJson(result) {
	const t = result?.content?.[0]?.text ?? ""
	try {
		return JSON.parse(t)
	} catch {
		return { _raw: t }
	}
}

function withTmpRepo(fn) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-studio-candidates-"))
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

function readFm(tmp, slug) {
	const raw = readFileSync(
		join(tmp, ".haiku", "intents", slug, "intent.md"),
		"utf8",
	)
	return parseFrontmatter(raw).data
}

// Two real studios whose canonical names we resolve dynamically so the
// assertions don't hard-code name==dir.
const SOFTWARE = resolveStudio("software")?.name
const MARKETING = resolveStudio("marketing")?.name

test("setup: the studios this test references resolve", () => {
	assert.ok(SOFTWARE, "expected a 'software' studio in the registry")
	assert.ok(MARKETING, "expected a 'marketing' studio in the registry")
})

test("stamps resolved canonical candidates onto intent.md", () => {
	withTmpRepo((tmp) => {
		const res = intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"Ship a dashboard that shows MRR, churn, and outstanding invoices for the finance team, pulling from the live billing API.",
			slug: "billing-dashboard",
			studio_candidates: ["software", "marketing"],
		})
		const j = getJson(res)
		assert.notStrictEqual(j.error, "intent_create_meta_pollution", j.message)
		const fm = readFm(tmp, "billing-dashboard")
		assert.deepStrictEqual(fm.studio_candidates, [SOFTWARE, MARKETING])
		assert.strictEqual(
			fm.studio,
			"",
			"studio stays unset — candidates are a hint",
		)
	})
})

test("fresh intent is stamped with current plugin_version (no immediate migration)", () => {
	// Without a plugin_version on the freshly-written intent.md, the
	// pre-tick gate reads sourceVersion="0" and the migrator fires on the
	// first haiku_run_next — an immediate migration of a brand-new intent.
	withTmpRepo((tmp) => {
		intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue and overdue invoices.",
			slug: "billing-dashboard",
			studio_candidates: ["software"],
		})
		const fm = readFm(tmp, "billing-dashboard")
		assert.ok(fm.plugin_version, "fresh intent.md must carry plugin_version")
		const stampedMajor = Number(String(fm.plugin_version).split(".")[0])
		const currentMajor = Number(getPluginVersion().split(".")[0])
		assert.strictEqual(
			stampedMajor,
			currentMajor,
			"plugin_version major must match the running plugin so the migration gate skips it",
		)
	})
})

test("drops unresolvable candidates, keeps the valid ones", () => {
	withTmpRepo((tmp) => {
		intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"Ship a dashboard for the finance team that surfaces revenue and overdue invoices from the billing service.",
			slug: "billing-dashboard",
			studio_candidates: ["software", "totally-not-a-studio", "marketing"],
		})
		const fm = readFm(tmp, "billing-dashboard")
		assert.deepStrictEqual(fm.studio_candidates, [SOFTWARE, MARKETING])
	})
})

test("dedupes candidates that resolve to the same studio", () => {
	withTmpRepo((tmp) => {
		intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue, churn, and overdue invoices from the live billing feed.",
			slug: "billing-dashboard",
			// "software" twice (name + itself) collapses to one entry.
			studio_candidates: ["software", "software"],
		})
		const fm = readFm(tmp, "billing-dashboard")
		assert.deepStrictEqual(fm.studio_candidates, [SOFTWARE])
	})
})

test("omitted candidates → REQUIRED error, no intent created", () => {
	withTmpRepo((tmp) => {
		const res = intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue and overdue invoices from the billing service.",
			slug: "billing-dashboard",
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "studio_candidates_required")
		// Recovery guidance must point the agent at haiku_studio_list.
		assert.match(j.message, /haiku_studio_list/)
		// No half-created intent left behind — validation runs before any write.
		assert.ok(
			!existsSync(
				join(tmp, ".haiku", "intents", "billing-dashboard", "intent.md"),
			),
			"a rejected create must not leave an intent.md on disk",
		)
	})
})

test("empty-array candidates → REQUIRED error", () => {
	withTmpRepo(() => {
		const res = intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue and overdue invoices.",
			slug: "billing-dashboard",
			studio_candidates: [],
		})
		assert.strictEqual(getJson(res).error, "studio_candidates_required")
	})
})

test("all-unresolvable candidates → UNRESOLVED error, no intent created", () => {
	withTmpRepo((tmp) => {
		const res = intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue and overdue invoices from the billing service.",
			slug: "billing-dashboard",
			studio_candidates: ["nope", "also-nope"],
		})
		const j = getJson(res)
		assert.strictEqual(j.error, "studio_candidates_unresolved")
		assert.match(j.message, /haiku_studio_list/)
		assert.ok(
			!existsSync(
				join(tmp, ".haiku", "intents", "billing-dashboard", "intent.md"),
			),
			"a rejected create must not leave an intent.md on disk",
		)
	})
})
