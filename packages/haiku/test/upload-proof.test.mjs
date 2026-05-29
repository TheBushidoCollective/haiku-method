// upload-proof.test.mjs — assert the per-provider REST shape (GitHub release
// asset vs GitLab project uploads) through an injectable fetch, plus the
// no-auth / bad-input error paths. No network, no real provider.
//
// Imports the TS source via tsx (the test runner is `npx tsx`).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
	fileBytes: Buffer.from([1, 2, 3, 4]),
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

test("uploadProofGitLab: POSTs to project uploads API with Authorization: Bearer", async () => {
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
		token: "oauth_token",
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
	// OAuth tokens (broker-issued) require Authorization: Bearer, NOT the
	// PAT-only PRIVATE-TOKEN header (which 401s an OAuth token).
	assert.equal(calls[0].init.headers.authorization, "Bearer oauth_token")
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
	const tool = (await import(`${SRC}tools/orchestrator/haiku_upload_proof.ts`))
		.default
	const res = await tool.handle({
		intent: "demo",
		path: "/nonexistent/does/not/exist.webm",
	})
	const body = JSON.parse(res.content[0].text)
	assert.equal(body.error, "proof_upload_path_missing")
})

test("haiku_upload_proof: bad input rejected by gate", async () => {
	const tool = (await import(`${SRC}tools/orchestrator/haiku_upload_proof.ts`))
		.default
	// missing required `path`
	const res = await tool.handle({ intent: "demo" })
	assert.equal(res.isError, true)
	assert.match(res.content[0].text, /haiku_upload_proof_input_invalid/)
})

test("haiku_upload_proof: no token → AUTHENTICATES (doesn't ask) and surfaces auth_unavailable when the broker can't be reached", async () => {
	const HAS_GIT = (() => {
		try {
			execFileSync("git", ["--version"], { stdio: "ignore" })
			return true
		} catch {
			return false
		}
	})()
	if (!HAS_GIT) return

	const repo = mkdtempSync(join(tmpdir(), "haiku-upload-auth-"))
	const globalDir = mkdtempSync(join(tmpdir(), "haiku-upload-global-"))
	const origCwd = process.cwd()
	const origGlobal = process.env.HAIKU_GLOBAL_DIR
	const origProxy = process.env.HAIKU_AUTH_PROXY_URL
	try {
		execFileSync("git", ["init", "-q"], { cwd: repo })
		// A GitHub origin so the provider resolves; no token in the empty global
		// store; the broker pointed at a dead local port (fast ECONNREFUSED, so
		// /cli/start fails before any browser open).
		execFileSync(
			"git",
			["remote", "add", "origin", "https://github.com/acme/widgets.git"],
			{ cwd: repo },
		)
		const proof = join(repo, "proof.webm")
		writeFileSync(proof, "fake video bytes")
		process.chdir(repo)
		process.env.HAIKU_GLOBAL_DIR = globalDir // empty → no stored token
		process.env.HAIKU_AUTH_PROXY_URL = "http://127.0.0.1:1"

		const tool = (
			await import(`${SRC}tools/orchestrator/haiku_upload_proof.ts?d=authpath`)
		).default
		const res = await tool.handle({ intent: "demo", path: proof })
		const body = JSON.parse(res.content[0].text)
		// The engine auto-authed (hit the broker) and, since it couldn't, surfaced
		// the new error — NOT the old "run haiku_auth_login first."
		assert.equal(body.error, "proof_upload_auth_unavailable")
		assert.doesNotMatch(
			res.content[0].text,
			/haiku_auth_login|proof_upload_no_auth/,
			"must not tell the agent to authenticate first",
		)
	} finally {
		process.chdir(origCwd)
		if (origGlobal === undefined) delete process.env.HAIKU_GLOBAL_DIR
		else process.env.HAIKU_GLOBAL_DIR = origGlobal
		if (origProxy === undefined) delete process.env.HAIKU_AUTH_PROXY_URL
		else process.env.HAIKU_AUTH_PROXY_URL = origProxy
		rmSync(repo, { recursive: true, force: true })
		rmSync(globalDir, { recursive: true, force: true })
	}
})
