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
			// /cli/start
			() =>
				jsonResponse(200, {
					device_code: "DEV-123",
					verification_url: "https://broker.test/verify/abc",
					interval: 1,
					expires_in: 300,
				}),
			// /cli/poll #1 → pending
			() => jsonResponse(200, { status: "pending" }),
			// /cli/poll #2 → ready with token
			() =>
				jsonResponse(200, {
					status: "ready",
					token: {
						access_token: "gho_secret_value",
						host: "github.com",
						account: "octocat",
						scopes: ["repo"],
						obtained_at: "2026-05-28T00:00:00.000Z",
					},
				}),
		])

		const result = await mod.runBrokerLogin("github", fakeDeps(fetchImpl))
		assert.equal(result.provider, "github")
		assert.equal(result.account, "octocat")

		// start + two polls were all issued at the broker base
		assert.equal(calls.length, 3)
		assert.equal(calls[0].url, "https://broker.test/cli/start")
		assert.equal(calls[1].url, "https://broker.test/cli/poll")
		assert.equal(calls[2].url, "https://broker.test/cli/poll")

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

test("runBrokerLogin: denied → LoginError(auth_login_denied), no token stored", async () => {
	await withTempGlobal(async () => {
		process.env.HAIKU_AUTH_PROXY_URL = "https://broker.test"
		const mod = await import(
			`${SRC}tools/orchestrator/haiku_auth_login.ts?d=denied`
		)
		const gs = await import(`${SRC}global-settings.ts?d=login-denied`)

		const { fetchImpl } = scriptedFetch([
			() =>
				jsonResponse(200, {
					device_code: "DEV-9",
					verification_url: "https://broker.test/verify/x",
				}),
			() => jsonResponse(200, { status: "denied", error: "user said no" }),
		])

		await assert.rejects(
			() => mod.runBrokerLogin("gitlab", fakeDeps(fetchImpl)),
			(err) => {
				assert.ok(err instanceof mod.LoginError)
				assert.equal(err.code, "auth_login_denied")
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
