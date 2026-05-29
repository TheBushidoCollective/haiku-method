// auth-login.test.mjs — drive the broker handshake (start → pending → ready)
// through the injectable LoginDeps so it never touches network/browser/time,
// and assert the captured token is persisted to the GLOBAL store (temp dir).
//
// Imports the TS source via tsx (the test runner is `npx tsx`), matching
// global-settings.test.mjs. HAIKU_GLOBAL_DIR points at a temp dir per test so
// the real ~/.haiku/settings.json is never touched.

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname
const ORIG_DIR = process.env.HAIKU_GLOBAL_DIR
const ORIG_PROXY = process.env.HAIKU_AUTH_PROXY_URL

function restoreProxy() {
	if (ORIG_PROXY === undefined) delete process.env.HAIKU_AUTH_PROXY_URL
	else process.env.HAIKU_AUTH_PROXY_URL = ORIG_PROXY
}

function withTempGlobal(fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-login-"))
	process.env.HAIKU_GLOBAL_DIR = dir
	return Promise.resolve(fn(dir)).finally(() => {
		if (ORIG_DIR === undefined) delete process.env.HAIKU_GLOBAL_DIR
		else process.env.HAIKU_GLOBAL_DIR = ORIG_DIR
		rmSync(dir, { recursive: true, force: true })
	})
}

/** Build a fake fetch from a queue of response factories; records calls. */
function scriptedFetch(handlers) {
	const calls = []
	const fetchImpl = async (url, init) => {
		calls.push({ url: String(url), init: init ?? {} })
		const handler = handlers.shift()
		if (!handler) throw new Error(`unexpected fetch to ${url}`)
		return handler(String(url), init)
	}
	return { fetchImpl, calls }
}

function jsonResponse(status, body) {
	return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function fakeDeps(fetchImpl) {
	return {
		fetch: fetchImpl,
		now: () => 0, // frozen clock — deadline math stays inside the timeout
		sleep: async () => {}, // no real waiting between polls
		openUrl: () => {}, // never open a browser in a test
	}
}

test("authProxyBaseUrl defaults and honors the env override", async () => {
	const mod = await import(`${SRC}tools/orchestrator/haiku_auth_login.ts`)
	delete process.env.HAIKU_AUTH_PROXY_URL
	assert.equal(mod.authProxyBaseUrl(), mod.DEFAULT_AUTH_PROXY_URL)
	process.env.HAIKU_AUTH_PROXY_URL = "https://broker.example.com/"
	assert.equal(mod.authProxyBaseUrl(), "https://broker.example.com") // trailing slash trimmed
	restoreProxy()
})

test("runBrokerLogin: start → pending → ready persists the token", async () => {
	await withTempGlobal(async () => {
		process.env.HAIKU_AUTH_PROXY_URL = "https://broker.test"
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=ready`
		)
		const gs = await import(`${SRC}global-settings.ts?d=login-ready`)

		const { fetchImpl, calls } = scriptedFetch([
			// /cli/start → broker mints a SESSION (not an OAuth device_code)
			() =>
				jsonResponse(200, {
					session_id: "SESS-123",
					verification_url: "https://broker.test/verify/abc",
					expires_in: 600,
				}),
			// /cli/poll #1 → pending
			() => jsonResponse(200, { status: "pending" }),
			// /cli/poll #2 → ready; the token bundle is SPREAD AT TOP LEVEL
			() =>
				jsonResponse(200, {
					status: "ready",
					provider: "github",
					host: "github.com",
					account: "octocat",
					access_token: "gho_secret_value",
					scopes: ["repo"],
				}),
		])

		const result = await mod.runBrokerLogin("github", fakeDeps(fetchImpl))
		assert.equal(result.provider, "github")
		assert.equal(result.account, "octocat")

		// start + two polls were all issued at the broker base; poll is keyed on
		// session_id (NOT a device_code).
		assert.equal(calls.length, 3)
		assert.equal(calls[0].url, "https://broker.test/cli/start")
		assert.equal(calls[1].url, "https://broker.test/cli/poll")
		assert.equal(calls[2].url, "https://broker.test/cli/poll")
		assert.equal(JSON.parse(calls[1].init.body).session_id, "SESS-123")

		// the token landed in the global store and is readable
		const stored = gs.readProviderToken("github")
		assert.ok(stored)
		assert.equal(stored.access_token, "gho_secret_value")
		assert.equal(stored.account, "octocat")

		// the result NEVER carries the token value
		assert.equal("access_token" in result, false)
		restoreProxy()
	})
})

test("runBrokerLogin: expired → LoginError(auth_login_expired), no token stored", async () => {
	await withTempGlobal(async () => {
		process.env.HAIKU_AUTH_PROXY_URL = "https://broker.test"
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=expired`
		)
		const gs = await import(`${SRC}global-settings.ts?d=login-expired`)

		// The broker has no "denied" — a declined/abandoned authorization just
		// expires (session TTL). poll keys on session_id.
		const { fetchImpl } = scriptedFetch([
			() =>
				jsonResponse(200, {
					session_id: "SESS-9",
					verification_url: "https://broker.test/verify/x",
				}),
			() => jsonResponse(200, { status: "expired", error: "session expired" }),
		])

		await assert.rejects(
			() => mod.runBrokerLogin("gitlab", fakeDeps(fetchImpl)),
			(err) => {
				assert.ok(err instanceof mod.LoginError)
				assert.equal(err.code, "auth_login_expired")
				return true
			},
		)
		assert.equal(gs.readProviderToken("gitlab"), null)
		restoreProxy()
	})
})

test("runBrokerLogin: broker /cli/start HTTP error → LoginError", async () => {
	await withTempGlobal(async () => {
		process.env.HAIKU_AUTH_PROXY_URL = "https://broker.test"
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=starterr`
		)
		const { fetchImpl } = scriptedFetch([() => jsonResponse(500, {})])
		await assert.rejects(
			() => mod.runBrokerLogin("github", fakeDeps(fetchImpl)),
			(err) => {
				assert.ok(err instanceof mod.LoginError)
				assert.equal(err.code, "auth_login_broker_start_failed")
				return true
			},
		)
		restoreProxy()
	})
})

test("haiku_auth_login rejects unknown provider via input gate", async () => {
	const tool = (await import(`${SRC}tools/orchestrator/haiku_auth_login.ts`))
		.default
	const res = await tool.handle({ provider: "bitbucket" })
	assert.equal(res.isError, true)
	assert.match(res.content[0].text, /haiku_auth_login_input_invalid/)
})

test("haiku_auth_login rejects additional properties via input gate", async () => {
	const tool = (await import(`${SRC}tools/orchestrator/haiku_auth_login.ts`))
		.default
	const res = await tool.handle({ provider: "github", extra: true })
	assert.equal(res.isError, true)
	assert.match(res.content[0].text, /haiku_auth_login_input_invalid/)
})

// ── ensureProviderToken: AUTH WHEN NEEDED (no "go call the auth tool first") ──

test("ensureProviderToken: a usable stored token is returned WITHOUT calling the broker", async () => {
	await withTempGlobal(async () => {
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=ept-have`
		)
		const gs = await import(`${SRC}global-settings.ts?d=ept-have`)
		gs.writeProviderToken("github", {
			access_token: "gho_existing",
			host: "github.com",
			account: "octocat",
			obtained_at: "2026-05-28T00:00:00.000Z",
		})
		// fetch THROWS if touched — proves no broker round-trip when a token exists.
		const deps = fakeDeps(async () => {
			throw new Error("broker must not be called when a token is present")
		})
		const tok = await mod.ensureProviderToken("github", deps)
		assert.ok(tok)
		assert.equal(tok.access_token, "gho_existing")
	})
})

test("ensureProviderToken: no token → runs the broker handshake inline, returns the fresh token", async () => {
	await withTempGlobal(async () => {
		process.env.HAIKU_AUTH_PROXY_URL = "https://broker.test"
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=ept-auth`
		)
		const gs = await import(`${SRC}global-settings.ts?d=ept-auth`)
		const { fetchImpl } = scriptedFetch([
			() =>
				jsonResponse(200, {
					session_id: "SESS-AUTO",
					verification_url: "https://broker.test/verify/auto",
				}),
			() =>
				jsonResponse(200, {
					status: "ready",
					provider: "github",
					host: "github.com",
					account: "octocat",
					access_token: "gho_just_obtained",
				}),
		])
		const tok = await mod.ensureProviderToken("github", fakeDeps(fetchImpl))
		assert.ok(tok, "auto-auth should have obtained a token")
		assert.equal(tok.access_token, "gho_just_obtained")
		// persisted for next time
		assert.equal(
			gs.readProviderToken("github").access_token,
			"gho_just_obtained",
		)
		restoreProxy()
	})
})

test("ensureProviderToken: broker unreachable → returns null (never throws), so the caller can fall back", async () => {
	await withTempGlobal(async () => {
		process.env.HAIKU_AUTH_PROXY_URL = "https://broker.test"
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=ept-down`
		)
		// /cli/start 500 (broker down / undeployed) → login throws internally →
		// ensureProviderToken swallows it and returns null.
		const { fetchImpl } = scriptedFetch([() => jsonResponse(500, {})])
		const tok = await mod.ensureProviderToken("github", fakeDeps(fetchImpl))
		assert.equal(tok, null)
		restoreProxy()
	})
})
