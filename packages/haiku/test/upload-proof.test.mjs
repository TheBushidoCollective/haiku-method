// upload-proof.test.mjs — assert the per-provider REST shape (GitHub release
// asset vs GitLab project uploads) through an injectable fetch, plus the
// no-auth / bad-input error paths. No network, no real provider.
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

const baseCtx = {
	provider: "github",
	host: "github.com",
	owner: "gigsmart",
	repo: "haiku-method",
	token: "gho_secret",
	fileName: "proof.webm",
	fileBytes: new Uint8Array([1, 2, 3, 4]),
}

test("uploadProofGitHub: existing release → asset PUT to uploads host", async () => {
	const mod = await import(
		`${SRC}tools/orchestrator/haiku_upload_proof.ts?d=ghexisting`
	)
	const { fetchImpl, calls } = scriptedFetch([
		// GET release by tag → found
		() => jsonResponse(200, { id: 42 }),
		// POST asset upload
		() =>
			jsonResponse(201, {
				browser_download_url:
					"https://github.com/gigsmart/haiku-method/releases/download/haiku-proof/proof.webm",
			}),
	])

	const result = await mod.uploadProofGitHub(baseCtx, fetchImpl)
	assert.equal(result.provider, "github")
	assert.match(result.url, /releases\/download\/haiku-proof\/proof\.webm$/)
	assert.equal(result.markdown, null)

	// release lookup hits api.github.com with the tag + bearer
	assert.equal(
		calls[0].url,
		"https://api.github.com/repos/gigsmart/haiku-method/releases/tags/haiku-proof",
	)
	assert.equal(calls[0].init.headers.authorization, "Bearer gho_secret")
	// asset upload hits uploads.github.com with the release id + ?name=
	assert.equal(
		calls[1].url,
		"https://uploads.github.com/repos/gigsmart/haiku-method/releases/42/assets?name=proof.webm",
	)
	assert.equal(calls[1].init.method, "POST")
	assert.equal(
		calls[1].init.headers["content-type"],
		"application/octet-stream",
	)
})

test("uploadProofGitHub: missing release (404) → create then upload", async () => {
	const mod = await import(
		`${SRC}tools/orchestrator/haiku_upload_proof.ts?d=gh404`
	)
	const { fetchImpl, calls } = scriptedFetch([
		// GET release by tag → 404
		() => jsonResponse(404, {}),
		// POST create release
		() => jsonResponse(201, { id: 99 }),
		// POST asset upload
		() =>
			jsonResponse(201, {
				browser_download_url:
					"https://github.com/x/y/releases/download/z/proof.webm",
			}),
	])

	const result = await mod.uploadProofGitHub(baseCtx, fetchImpl)
	assert.equal(result.provider, "github")
	assert.equal(calls.length, 3)
	// release creation POSTs to /releases
	assert.equal(
		calls[1].url,
		"https://api.github.com/repos/gigsmart/haiku-method/releases",
	)
	assert.equal(calls[1].init.method, "POST")
	// upload references the newly created release id 99
	assert.match(calls[2].url, /releases\/99\/assets\?name=proof\.webm$/)
})

test("uploadProofGitHub: asset upload HTTP error → ProofUploadError", async () => {
	const mod = await import(
		`${SRC}tools/orchestrator/haiku_upload_proof.ts?d=gherr`
	)
	const { fetchImpl } = scriptedFetch([
		() => jsonResponse(200, { id: 1 }),
		() => jsonResponse(422, {}),
	])
	await assert.rejects(
		() => mod.uploadProofGitHub(baseCtx, fetchImpl),
		(err) => {
			assert.ok(err instanceof mod.ProofUploadError)
			assert.equal(err.code, "proof_upload_github_asset_failed")
			return true
		},
	)
})

test("uploadProofGitLab: POSTs to project uploads API with private-token", async () => {
	const mod = await import(
		`${SRC}tools/orchestrator/haiku_upload_proof.ts?d=gl`
	)
	const { fetchImpl, calls } = scriptedFetch([
		() =>
			jsonResponse(201, {
				url: "/uploads/abc123/proof.webm",
				markdown: "[proof.webm](/uploads/abc123/proof.webm)",
				full_path: "/-/project/uploads/abc123/proof.webm",
			}),
	])

	const ctx = {
		...baseCtx,
		provider: "gitlab",
		host: "gitlab.com",
		token: "glpat_secret",
	}
	const result = await mod.uploadProofGitLab(ctx, fetchImpl)

	assert.equal(result.provider, "gitlab")
	assert.ok(result.markdown?.includes("proof.webm"))
	// endpoint shape: /api/v4/projects/<url-encoded owner/repo>/uploads
	assert.equal(
		calls[0].url,
		"https://gitlab.com/api/v4/projects/gigsmart%2Fhaiku-method/uploads",
	)
	assert.equal(calls[0].init.method, "POST")
	// GitLab uses the private-token header, NOT bearer
	assert.equal(calls[0].init.headers["private-token"], "glpat_secret")
})

test("uploadProofGitLab: HTTP error → ProofUploadError", async () => {
	const mod = await import(
		`${SRC}tools/orchestrator/haiku_upload_proof.ts?d=glerr`
	)
	const { fetchImpl } = scriptedFetch([() => jsonResponse(403, {})])
	const ctx = { ...baseCtx, provider: "gitlab", host: "gitlab.com" }
	await assert.rejects(
		() => mod.uploadProofGitLab(ctx, fetchImpl),
		(err) => {
			assert.ok(err instanceof mod.ProofUploadError)
			assert.equal(err.code, "proof_upload_gitlab_failed")
			return true
		},
	)
})

test("haiku_upload_proof: missing path → proof_upload_path_missing", async () => {
	const tool = (
		await import(`${SRC}tools/orchestrator/haiku_upload_proof.ts`)
	).default
	const res = await tool.handle({
		intent: "demo",
		path: "/nonexistent/does/not/exist.webm",
	})
	const body = JSON.parse(res.content[0].text)
	assert.equal(body.error, "proof_upload_path_missing")
})

test("haiku_upload_proof: bad input rejected by gate", async () => {
	const tool = (
		await import(`${SRC}tools/orchestrator/haiku_upload_proof.ts`)
	).default
	// missing required `path`
	const res = await tool.handle({ intent: "demo" })
	assert.equal(res.isError, true)
	assert.match(res.content[0].text, /haiku_upload_proof_input_invalid/)
})
