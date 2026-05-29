// global-settings.test.mjs — the GLOBAL token store (~/.haiku/settings.json)
// + the haiku_auth_status / haiku_auth_logout MCP tools.
//
// HAIKU_GLOBAL_DIR is pointed at a temp dir per test so the real user file is
// never touched. Covers: round-trip, clear, status hides token values + reports
// expiry, corrupt-file tolerance, 0600 perms, and the two tools' contracts.

import assert from "node:assert/strict"
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

function withTempGlobal(fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-global-"))
	const prev = process.env.HAIKU_GLOBAL_DIR
	process.env.HAIKU_GLOBAL_DIR = dir
	return Promise.resolve(fn(dir)).finally(() => {
		if (prev === undefined) delete process.env.HAIKU_GLOBAL_DIR
		else process.env.HAIKU_GLOBAL_DIR = prev
		rmSync(dir, { recursive: true, force: true })
	})
}

const TOKEN = {
	access_token: "ghs_secret_value",
	refresh_token: "ghr_refresh",
	scopes: ["repo"],
	account: "octocat",
	host: "github.com",
	obtained_at: "2026-05-28T00:00:00.000Z",
}

test("writeProviderToken → readProviderToken round-trips", async () => {
	await withTempGlobal(async () => {
		const gs = await import(`${SRC}global-settings.ts`)
		assert.equal(gs.readProviderToken("github"), null)
		gs.writeProviderToken("github", TOKEN)
		assert.deepEqual(gs.readProviderToken("github"), TOKEN)
		// independent slot
		assert.equal(gs.readProviderToken("gitlab"), null)
	})
})

test("clearProviderToken reports was-connected + removes", async () => {
	await withTempGlobal(async () => {
		const gs = await import(`${SRC}global-settings.ts?d=clear`)
		gs.writeProviderToken("gitlab", { ...TOKEN, host: "gitlab.com" })
		assert.equal(gs.clearProviderToken("gitlab"), true)
		assert.equal(gs.readProviderToken("gitlab"), null)
		// idempotent
		assert.equal(gs.clearProviderToken("gitlab"), false)
	})
})

test("listConnectedProviders hides token values + reports expiry", async () => {
	await withTempGlobal(async () => {
		const gs = await import(`${SRC}global-settings.ts?d=list`)
		gs.writeProviderToken("github", {
			...TOKEN,
			expires_at: "2000-01-01T00:00:00.000Z", // past → expired
		})
		gs.writeProviderToken("gitlab", {
			access_token: "glpat",
			host: "gitlab.com",
			obtained_at: "2026-05-28T00:00:00.000Z",
			// no expires_at → non-expiring
		})
		const list = gs.listConnectedProviders()
		const gh = list.find((p) => p.provider === "github")
		const gl = list.find((p) => p.provider === "gitlab")
		assert.ok(gh && gl)
		// SAFE fields only — never the secret
		const serialized = JSON.stringify(list)
		assert.ok(!serialized.includes("ghs_secret_value"))
		assert.ok(!serialized.includes("ghr_refresh"))
		assert.ok(!serialized.includes("glpat"))
		assert.equal(gh.account, "octocat")
		assert.deepEqual(gh.scopes, ["repo"])
		assert.equal(gh.expired, true)
		assert.equal(gl.expired, false) // null expires_at = non-expiring
	})
})

test("corrupt settings file is tolerated (no throw)", async () => {
	await withTempGlobal(async (dir) => {
		writeFileSync(join(dir, "settings.json"), "{ not valid json ")
		const gs = await import(`${SRC}global-settings.ts?d=corrupt`)
		assert.equal(gs.readProviderToken("github"), null)
		assert.deepEqual(gs.listConnectedProviders(), [])
		// a write recovers — overwrites the corrupt file
		gs.writeProviderToken("github", TOKEN)
		assert.deepEqual(gs.readProviderToken("github"), TOKEN)
	})
})

test("settings file is written 0600", async () => {
	await withTempGlobal(async (dir) => {
		const gs = await import(`${SRC}global-settings.ts?d=perms`)
		gs.writeProviderToken("github", TOKEN)
		const mode = statSync(join(dir, "settings.json")).mode & 0o777
		assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`)
	})
})

test("an unknown top-level key is preserved (forward-compat)", async () => {
	await withTempGlobal(async (dir) => {
		writeFileSync(
			join(dir, "settings.json"),
			JSON.stringify({ futureKey: { a: 1 } }),
		)
		const gs = await import(`${SRC}global-settings.ts?d=fwd`)
		gs.writeProviderToken("github", TOKEN)
		const raw = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"))
		assert.deepEqual(raw.futureKey, { a: 1 })
		assert.equal(raw.providers.github.access_token, "ghs_secret_value")
	})
})

// ── tools ──

test("haiku_auth_status: connected=false when empty, never leaks tokens", async () => {
	await withTempGlobal(async () => {
		const tool = (await import(`${SRC}tools/orchestrator/haiku_auth_status.ts`))
			.default
		const empty = JSON.parse((await tool.handle({})).content[0].text)
		assert.equal(empty.ok, true)
		assert.equal(empty.connected, false)
		assert.deepEqual(empty.providers, [])

		const gs = await import(`${SRC}global-settings.ts?d=toolstatus`)
		gs.writeProviderToken("github", TOKEN)
		const res = await tool.handle({})
		assert.ok(!res.content[0].text.includes("ghs_secret_value"))
		const payload = JSON.parse(res.content[0].text)
		assert.equal(payload.connected, true)
		assert.equal(payload.providers[0].provider, "github")
		assert.equal(payload.providers[0].account, "octocat")
		assert.equal(payload.providers[0].expired, false)
	})
})

test("haiku_auth_status: provider filter narrows", async () => {
	await withTempGlobal(async () => {
		const gs = await import(`${SRC}global-settings.ts?d=toolfilter`)
		gs.writeProviderToken("github", TOKEN)
		gs.writeProviderToken("gitlab", { ...TOKEN, host: "gitlab.com" })
		const tool = (await import(`${SRC}tools/orchestrator/haiku_auth_status.ts`))
			.default
		const gl = JSON.parse(
			(await tool.handle({ provider: "gitlab" })).content[0].text,
		)
		assert.equal(gl.providers.length, 1)
		assert.equal(gl.providers[0].provider, "gitlab")
	})
})

test("haiku_auth_status: bad provider → input_invalid", async () => {
	await withTempGlobal(async () => {
		const tool = (await import(`${SRC}tools/orchestrator/haiku_auth_status.ts`))
			.default
		const res = await tool.handle({ provider: "bitbucket" })
		assert.equal(res.isError, true)
		assert.match(res.content[0].text, /haiku_auth_status_input_invalid/)
	})
})

test("haiku_auth_logout: clears + idempotent + requires provider", async () => {
	await withTempGlobal(async () => {
		const gs = await import(`${SRC}global-settings.ts?d=toollogout`)
		gs.writeProviderToken("github", TOKEN)
		const tool = (await import(`${SRC}tools/orchestrator/haiku_auth_logout.ts`))
			.default
		const first = JSON.parse(
			(await tool.handle({ provider: "github" })).content[0].text,
		)
		assert.equal(first.was_connected, true)
		assert.equal(gs.readProviderToken("github"), null)
		const second = JSON.parse(
			(await tool.handle({ provider: "github" })).content[0].text,
		)
		assert.equal(second.was_connected, false)
		// provider required
		const missing = await tool.handle({})
		assert.equal(missing.isError, true)
		assert.match(missing.content[0].text, /haiku_auth_logout_input_invalid/)
	})
})
