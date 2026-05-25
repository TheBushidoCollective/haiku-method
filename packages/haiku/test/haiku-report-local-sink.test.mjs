#!/usr/bin/env npx tsx
// haiku-report-local-sink.test.mjs — admin-portal-reimagine BUG-5.
//
// Without a Sentry DSN, haiku_report used to return a no-op success and
// silently DROP the report — every engine-class finding from record_reflection
// vanished on dev builds (which have no DSN). Now it writes the report to a
// durable local sink (`<haikuRoot>/reports/<ts>.json`) and returns the path.

import assert from "node:assert/strict"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
process.env.CLAUDE_PLUGIN_ROOT = join(resolve(HERE, "..", "..", ".."), "plugin")
// Ensure no DSN so the local-sink fallback path is taken.
process.env.HAIKU_SENTRY_DSN_MCP = ""
process.env.HAIKU_SENTRY_DSN = ""

test("haiku_report without a Sentry DSN writes the report to a local sink and returns the path", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-report-sink-"))
	const orig = process.cwd()
	try {
		// A .haiku root so findHaikuRoot() resolves under the tmp repo.
		mkdirSync(join(repo, ".haiku"), { recursive: true })
		process.chdir(repo)
		const { handleToolCall } = await import(`${SRC}/server/tool-call.ts`)
		const { isSentryConfigured } = await import(`${SRC}/sentry.ts`)
		// Precondition: this build is genuinely DSN-less.
		assert.equal(isSentryConfigured(), false, "test requires no Sentry DSN")

		const resp = await handleToolCall({
			params: {
				name: "haiku_report",
				arguments: {
					message: "engine-class finding: gate X is non-convergent",
				},
			},
		})
		const text = resp?.content?.[0]?.text ?? ""
		assert.ok(!resp?.isError, `report must not error; got: ${text}`)
		assert.match(
			text,
			/written locally to .*reports/,
			`expected a local-sink path; got: ${text}`,
		)

		// The report file exists under <haikuRoot>/reports and carries the message.
		const reportsDir = join(repo, ".haiku", "reports")
		assert.ok(existsSync(reportsDir), "reports dir created")
		const files = readdirSync(reportsDir).filter((f) => f.endsWith(".json"))
		assert.equal(files.length, 1, "exactly one report written")
		const body = JSON.parse(readFileSync(join(reportsDir, files[0]), "utf8"))
		assert.match(
			body.message,
			/non-convergent/,
			"report body carries the message",
		)
		assert.ok(body.recorded_at, "report carries a recorded_at timestamp")
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repo, { recursive: true, force: true })
	}
})

test("haiku_report still rejects a missing message", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-report-nomsg-"))
	const orig = process.cwd()
	try {
		mkdirSync(join(repo, ".haiku"), { recursive: true })
		process.chdir(repo)
		const { handleToolCall } = await import(`${SRC}/server/tool-call.ts`)
		const resp = await handleToolCall({
			params: { name: "haiku_report", arguments: {} },
		})
		assert.ok(resp?.isError, "missing message must error")
		assert.match(resp.content[0].text, /message is required/)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repo, { recursive: true, force: true })
	}
})
