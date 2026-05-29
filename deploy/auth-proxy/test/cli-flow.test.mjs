import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import {
	handleCliRoute,
	setFetchImpl,
	setSessionStore,
} from "../dist/cli.js"
import { makeReq, makeRes, MemoryStore } from "./helpers.mjs"

let mem
beforeEach(() => {
	mem = new MemoryStore()
	setSessionStore(mem)
	setFetchImpl(undefined)
})
afterEach(() => {
	setSessionStore(null)
	setFetchImpl(undefined)
})

describe("/cli/start", () => {
	it("returns a session_id and a verification_url carrying the state", async () => {
		const res = makeRes()
		const owned = await handleCliRoute(
			makeReq({ path: "/cli/start", body: { provider: "github" } }),
			res,
		)
		assert.equal(owned, true)
		assert.equal(res.statusCode, 200)
		assert.ok(res.body.session_id, "session_id present")
		assert.ok(
			res.body.verification_url.startsWith("https://"),
			"verification_url is absolute",
		)
		const u = new URL(res.body.verification_url)
		assert.equal(u.searchParams.get("provider"), "github")
		assert.ok(u.searchParams.get("state"), "state carried in url")
		assert.equal(res.body.expires_in, 600)

		const stored = await mem.getById(res.body.session_id)
		assert.equal(stored.status, "pending")
		assert.equal(stored.provider, "github")
		assert.equal(stored.host, "github.com")
		assert.equal(stored.state, u.searchParams.get("state"))
	})

	it("is enterprise-host aware (self-managed GitLab)", async () => {
		const res = makeRes()
		await handleCliRoute(
			makeReq({
				path: "/cli/start",
				body: { provider: "gitlab", host: "https://git.acme.com/" },
			}),
			res,
		)
		const stored = await mem.getById(res.body.session_id)
		assert.equal(stored.host, "git.acme.com")
		const u = new URL(res.body.verification_url)
		assert.equal(
			u.searchParams.get("authorize_via"),
			"https://git.acme.com/oauth/authorize",
		)
	})

	it("rejects an unknown provider", async () => {
		const res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/start", body: { provider: "bitbucket" } }),
			res,
		)
		assert.equal(res.statusCode, 400)
		assert.equal(res.body.error, "invalid_provider")
	})
})

describe("/cli/poll transitions", () => {
	async function startSession() {
		const res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/start", body: { provider: "github" } }),
			res,
		)
		return res.body
	}

	it("pending → ready → consumed, releasing the token exactly once", async () => {
		const { session_id } = await startSession()
		const session = await mem.getById(session_id)

		// pending
		let res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/poll", body: { session_id } }),
			res,
		)
		assert.deepEqual(res.body, { status: "pending" })

		// complete via the callback contract (keyed by state)
		res = makeRes()
		await handleCliRoute(
			makeReq({
				path: "/cli/complete",
				body: {
					state: session.state,
					access_token: "gho_abc123",
					refresh_token: "ghr_xyz",
					scopes: "repo read:org",
					account: "octocat",
				},
			}),
			res,
		)
		assert.equal(res.statusCode, 200)
		assert.equal(res.body.status, "ready")

		// poll → ready, token released
		res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/poll", body: { session_id } }),
			res,
		)
		assert.equal(res.body.status, "ready")
		assert.equal(res.body.access_token, "gho_abc123")
		assert.equal(res.body.refresh_token, "ghr_xyz")
		assert.deepEqual(res.body.scopes, ["repo", "read:org"])
		assert.equal(res.body.account, "octocat")
		assert.equal(res.body.provider, "github")

		// second poll → no replay
		res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/poll", body: { session_id } }),
			res,
		)
		assert.ok(
			["consumed", "expired"].includes(res.body.status),
			"no replay",
		)
		assert.equal(res.body.access_token, undefined, "token not re-released")
	})

	it("unknown session id reads as expired", async () => {
		const res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/poll", body: { session_id: "nope" } }),
			res,
		)
		assert.equal(res.body.status, "expired")
	})

	it("expired session is reaped on poll", async () => {
		const { session_id } = await startSession()
		const rec = mem.byId.get(session_id)
		rec.expires_at = Math.floor(Date.now() / 1000) - 1
		const res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/poll", body: { session_id } }),
			res,
		)
		assert.equal(res.body.status, "expired")
		assert.equal(mem.byId.has(session_id), false, "reaped from store")
	})
})

describe("/cli/complete guards", () => {
	it("rejects an unknown state", async () => {
		const res = makeRes()
		await handleCliRoute(
			makeReq({
				path: "/cli/complete",
				body: { state: "ghost", access_token: "x" },
			}),
			res,
		)
		assert.equal(res.statusCode, 404)
		assert.equal(res.body.error, "unknown_state")
	})

	it("rejects a missing access_token", async () => {
		const res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/complete", body: { state: "s" } }),
			res,
		)
		assert.equal(res.statusCode, 400)
		assert.equal(res.body.error, "missing_access_token")
	})
})

describe("/cli/refresh", () => {
	it("re-runs the provider exchange with grant_type=refresh_token against the right host", async () => {
		process.env.HAIKU_GITLAB_OAUTH_CLIENT_ID = "cid"
		process.env.HAIKU_GITLAB_OAUTH_CLIENT_SECRET = "csecret"
		const calls = []
		setFetchImpl(async (url, init) => {
			calls.push({ url, body: init.body })
			return new Response(
				JSON.stringify({
					access_token: "new_at",
					refresh_token: "new_rt",
					expires_in: 7200,
					scope: "api",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			)
		})

		const res = makeRes()
		await handleCliRoute(
			makeReq({
				path: "/cli/refresh",
				body: {
					provider: "gitlab",
					host: "git.acme.com",
					refresh_token: "old_rt",
				},
			}),
			res,
		)
		assert.equal(res.statusCode, 200)
		assert.equal(res.body.access_token, "new_at")
		assert.equal(res.body.refresh_token, "new_rt")

		assert.equal(calls.length, 1)
		assert.equal(calls[0].url, "https://git.acme.com/oauth/token")
		const sent = JSON.parse(calls[0].body)
		assert.equal(sent.grant_type, "refresh_token")
		assert.equal(sent.refresh_token, "old_rt")
		assert.equal(sent.client_id, "cid")
		assert.equal(sent.client_secret, "csecret")
	})

	it("rejects a missing refresh_token", async () => {
		const res = makeRes()
		await handleCliRoute(
			makeReq({ path: "/cli/refresh", body: { provider: "github" } }),
			res,
		)
		assert.equal(res.statusCode, 400)
		assert.equal(res.body.error, "missing_refresh_token")
	})
})

describe("CLI router fall-through", () => {
	it("does not own non-/cli/ paths", async () => {
		const res = makeRes()
		const owned = await handleCliRoute(
			makeReq({ path: "/github/token", body: { code: "x" } }),
			res,
		)
		assert.equal(owned, false)
		assert.equal(res.body, undefined, "did not write a response")
	})

	it("owns and 404s an unknown /cli/ path", async () => {
		const res = makeRes()
		const owned = await handleCliRoute(
			makeReq({ path: "/cli/nope", body: {} }),
			res,
		)
		assert.equal(owned, true)
		assert.equal(res.statusCode, 404)
	})
})
