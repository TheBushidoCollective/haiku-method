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
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
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

test("omitted candidates → no studio_candidates field (picker falls back to all)", () => {
	withTmpRepo((tmp) => {
		intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue and overdue invoices from the billing service.",
			slug: "billing-dashboard",
		})
		const fm = readFm(tmp, "billing-dashboard")
		assert.ok(
			!("studio_candidates" in fm),
			"no candidates passed → field absent, not an empty array",
		)
	})
})

test("all-unresolvable candidates → field omitted (no empty array)", () => {
	withTmpRepo((tmp) => {
		intentCreate.handle({
			title: "Build a billing dashboard",
			description:
				"A finance dashboard surfacing revenue and overdue invoices from the billing service.",
			slug: "billing-dashboard",
			studio_candidates: ["nope", "also-nope"],
		})
		const fm = readFm(tmp, "billing-dashboard")
		assert.ok(
			!("studio_candidates" in fm),
			"nothing resolved → field absent so the picker shows the full registry",
		)
	})
})
