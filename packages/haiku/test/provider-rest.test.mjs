// provider-rest.test.mjs — assert the token-backed PR/MR REST shape (GitHub
// pulls + GraphQL ready, GitLab merge_requests + Draft-prefix ready) through an
// injectable fetch. No network, no real provider. This codifies the REST
// contracts the engine drives when a stored provider token is present; the
// `gh`/`glab` CLI remains the integration-proven fallback (see git-worktree.ts).
//
// Imports the TS source via tsx (the test runner is `npx tsx`).

import assert from "node:assert/strict"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

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

const ghCtx = {
	provider: "github",
	host: "github.com",
	owner: "gigsmart",
	repo: "haiku-method",
	token: "gho_secret",
}
const glCtx = {
	provider: "gitlab",
	host: "gitlab.com",
	owner: "gigsmart",
	repo: "haiku-method",
	token: "glpat_secret",
}

// ── GitHub create ──────────────────────────────────────────────────

test("createPullRequestRest (github): no existing PR → POST /pulls, returns html_url", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=ghcreate`)
	const { fetchImpl, calls } = scriptedFetch([
		() => jsonResponse(200, []), // dedup list → empty
		() =>
			jsonResponse(201, {
				html_url: "https://github.com/gigsmart/haiku-method/pull/7",
			}),
	])
	const out = await mod.createPullRequestRest(
		ghCtx,
		{ branch: "haiku/x/main", mainline: "main", title: "T", body: "B", draft: true },
		fetchImpl,
	)
	assert.equal(out.url, "https://github.com/gigsmart/haiku-method/pull/7")
	// dedup hits api.github.com pulls with the head filter
	assert.match(calls[0].url, /api\.github\.com\/repos\/gigsmart\/haiku-method\/pulls\?head=/)
	// create is a POST carrying draft:true + bearer
	assert.equal(calls[1].init.method, "POST")
	assert.equal(calls[1].init.headers.authorization, "Bearer gho_secret")
	const body = JSON.parse(calls[1].init.body)
	assert.equal(body.draft, true)
	assert.equal(body.head, "haiku/x/main")
	assert.equal(body.base, "main")
})

test("createPullRequestRest (github): existing open PR → returns it, no create", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=ghdedup`)
	const { fetchImpl, calls } = scriptedFetch([
		() =>
			jsonResponse(200, [
				{ html_url: "https://github.com/gigsmart/haiku-method/pull/3" },
			]),
	])
	const out = await mod.createPullRequestRest(
		ghCtx,
		{ branch: "b", mainline: "main", title: "T", body: "B", draft: false },
		fetchImpl,
	)
	assert.equal(out.url, "https://github.com/gigsmart/haiku-method/pull/3")
	assert.equal(calls.length, 1) // dedup only; no second POST
})

test("createPullRequestRest (github): create failure throws ProviderRestError", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=ghfail`)
	const { fetchImpl } = scriptedFetch([
		() => jsonResponse(200, []),
		() => jsonResponse(422, { message: "validation failed" }),
	])
	await assert.rejects(
		() =>
			mod.createPullRequestRest(
				ghCtx,
				{ branch: "b", mainline: "main", title: "T", body: "B", draft: false },
				fetchImpl,
			),
		(err) => err.code === "pr_create_github_failed",
	)
})

// ── GitHub mark-ready (GraphQL) ────────────────────────────────────

test("markPullRequestReadyRest (github): GET node_id → GraphQL mutation", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=ghready`)
	const { fetchImpl, calls } = scriptedFetch([
		() => jsonResponse(200, { node_id: "PR_nodeid_123" }),
		() => jsonResponse(200, { data: { markPullRequestReadyForReview: { pullRequest: { id: "PR_nodeid_123" } } } }),
	])
	await mod.markPullRequestReadyRest(
		ghCtx,
		"https://github.com/gigsmart/haiku-method/pull/7",
		fetchImpl,
	)
	assert.match(calls[0].url, /\/repos\/gigsmart\/haiku-method\/pulls\/7$/)
	assert.match(calls[1].url, /\/graphql$/)
	const gql = JSON.parse(calls[1].init.body)
	assert.match(gql.query, /markPullRequestReadyForReview/)
	assert.equal(gql.variables.id, "PR_nodeid_123")
})

test("markPullRequestReadyRest (github): GraphQL errors throw", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=ghreadyerr`)
	const { fetchImpl } = scriptedFetch([
		() => jsonResponse(200, { node_id: "PR_x" }),
		() => jsonResponse(200, { errors: [{ message: "not a draft" }] }),
	])
	await assert.rejects(
		() =>
			mod.markPullRequestReadyRest(
				ghCtx,
				"https://github.com/gigsmart/haiku-method/pull/7",
				fetchImpl,
			),
		(err) => err.code === "pr_ready_github_graphql_error",
	)
})

// ── GitLab create ──────────────────────────────────────────────────

test("createPullRequestRest (gitlab): draft prefixes title, POST merge_requests", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=glcreate`)
	const { fetchImpl, calls } = scriptedFetch([
		() => jsonResponse(200, []), // dedup
		() =>
			jsonResponse(201, {
				web_url: "https://gitlab.com/gigsmart/haiku-method/-/merge_requests/4",
			}),
	])
	const out = await mod.createPullRequestRest(
		glCtx,
		{ branch: "src", mainline: "main", title: "T", body: "B", draft: true },
		fetchImpl,
	)
	assert.equal(out.url, "https://gitlab.com/gigsmart/haiku-method/-/merge_requests/4")
	assert.match(calls[1].url, /\/api\/v4\/projects\/gigsmart%2Fhaiku-method\/merge_requests$/)
	const body = JSON.parse(calls[1].init.body)
	assert.equal(body.title, "Draft: T") // draft → prefix
	assert.equal(body.source_branch, "src")
	assert.equal(calls[1].init.headers.authorization, "Bearer glpat_secret")
})

// ── GitLab mark-ready (strip Draft: prefix) ────────────────────────

test("markPullRequestReadyRest (gitlab): strips Draft: prefix via PUT", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=glready`)
	const { fetchImpl, calls } = scriptedFetch([
		() => jsonResponse(200, { title: "Draft: My feature" }),
		() => jsonResponse(200, { title: "My feature" }),
	])
	await mod.markPullRequestReadyRest(
		glCtx,
		"https://gitlab.com/gigsmart/haiku-method/-/merge_requests/4",
		fetchImpl,
	)
	assert.equal(calls[1].init.method, "PUT")
	assert.equal(JSON.parse(calls[1].init.body).title, "My feature")
})

test("markPullRequestReadyRest (gitlab): already-ready title → no PUT", async () => {
	const mod = await import(`${SRC}provider-rest.ts?d=glnoop`)
	const { fetchImpl, calls } = scriptedFetch([
		() => jsonResponse(200, { title: "Already ready" }),
	])
	await mod.markPullRequestReadyRest(
		glCtx,
		"https://gitlab.com/gigsmart/haiku-method/-/merge_requests/4",
		fetchImpl,
	)
	assert.equal(calls.length, 1) // GET only; no PUT
})
