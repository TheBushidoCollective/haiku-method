// tools/orchestrator/haiku_upload_proof.ts — upload a runtime-verification
// proof file to the intent's / stage's change request over the provider REST
// API (no `gh` / `glab` shell-out).
//
//   GitHub → upload the file as a release asset (uploads.github.com), so the
//            proof is durably attached to the delivery and linkable from the PR.
//   GitLab → POST the file to the project uploads API
//            (/api/v4/projects/:id/uploads), which returns a markdown ref the
//            caller can drop into the MR description / a note.
//
// Provider is detected from the origin host. The bearer comes from the GLOBAL
// token store, AUTHENTICATING WHEN NEEDED via `ensureProviderToken` (the broker
// handshake runs inline if no token is stored — the engine never tells the
// agent to authenticate first). Only a genuinely unobtainable auth (broker
// unreachable / declined / timed out) surfaces `proof_upload_auth_unavailable`.
//
// The provider API call is factored behind an injectable fetch so the test can
// assert the right endpoint + headers per provider without network.

import { existsSync, readFileSync, statSync } from "node:fs"
import { basename } from "node:path"
import {
	parseGitRemote,
	providerFromHost,
	readOriginRemoteUrl,
} from "../../git-worktree.js"
import type { ProviderName } from "../../state/schemas/global-settings.js"
import {
	HAIKU_UPLOAD_PROOF_INPUT_SCHEMA,
	type HaikuUploadProofInput,
	validateHaikuUploadProofInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"
import { ensureProviderToken } from "./haiku_auth_login.js"

/** What the caller hands the uploader: the parsed remote, the proof bytes, the
 *  bearer, and the (optional) PR/MR URL the proof should reference. */
export interface ProofUploadContext {
	provider: ProviderName
	host: string
	owner: string
	repo: string
	token: string
	fileName: string
	/** Proof bytes. `Buffer` (what `readFileSync` returns) is a valid `BodyInit`
	 *  and `BlobPart`; tests pass a `Buffer.from([...])`. */
	fileBytes: Buffer
	prUrl?: string
}

/** Result of an upload — the durable asset/upload URL (or markdown ref). */
export interface ProofUploadResult {
	provider: ProviderName
	/** Canonical URL or markdown reference for the uploaded proof. */
	url: string
	/** GitLab returns a relative markdown snippet too; null for GitHub. */
	markdown: string | null
}

/** Stable named errors the uploader can throw — mapped to MCP error codes. */
export class ProofUploadError extends Error {
	code: string
	constructor(code: string, message: string) {
		super(message)
		this.code = code
	}
}

/** GitHub API base for a host (github.com → api.github.com; Enterprise →
 *  https://<host>/api/v3). Uploads use uploads.github.com on .com. */
function githubApiBase(host: string): { api: string; uploads: string } {
	if (host === "github.com") {
		return {
			api: "https://api.github.com",
			uploads: "https://uploads.github.com",
		}
	}
	// GitHub Enterprise
	return {
		api: `https://${host}/api/v3`,
		uploads: `https://${host}/api/uploads`,
	}
}

/** GitLab API base for a host (always /api/v4 on the host). */
function gitlabApiBase(host: string): string {
	return `https://${host}/api/v4`
}

/**
 * Upload to GitHub as a release asset. Ensures (or creates) a `haiku-proof`
 * release, then PUTs the asset. Returns the asset's browser_download_url.
 * Factored over an injectable fetch for testability.
 */
export async function uploadProofGitHub(
	ctx: ProofUploadContext,
	fetchImpl: typeof fetch,
): Promise<ProofUploadResult> {
	const { api, uploads } = githubApiBase(ctx.host)
	const repoPath = `${ctx.owner}/${ctx.repo}`
	const tag = "haiku-proof"
	const authHeaders = {
		authorization: `Bearer ${ctx.token}`,
		accept: "application/vnd.github+json",
		"x-github-api-version": "2022-11-28",
	}

	// 1) ensure a release exists for the proof tag (idempotent: GET then create)
	let releaseId: number | null = null
	const getRel = await fetchImpl(
		`${api}/repos/${repoPath}/releases/tags/${tag}`,
		{ headers: authHeaders },
	)
	if (getRel.ok) {
		const rel = (await getRel.json()) as { id: number }
		releaseId = rel.id
	} else if (getRel.status === 404) {
		const createRel = await fetchImpl(`${api}/repos/${repoPath}/releases`, {
			method: "POST",
			headers: { ...authHeaders, "content-type": "application/json" },
			body: JSON.stringify({
				tag_name: tag,
				name: "H·AI·K·U runtime-verification proofs",
				body: "Runtime-verification proof artifacts uploaded by the H·AI·K·U engine.",
			}),
		})
		if (!createRel.ok) {
			throw new ProofUploadError(
				"proof_upload_github_release_failed",
				`creating proof release returned HTTP ${createRel.status}`,
			)
		}
		const rel = (await createRel.json()) as { id: number }
		releaseId = rel.id
	} else {
		throw new ProofUploadError(
			"proof_upload_github_release_failed",
			`looking up proof release returned HTTP ${getRel.status}`,
		)
	}

	// 2) upload the asset
	const assetName = encodeURIComponent(ctx.fileName)
	const uploadUrl = `${uploads}/repos/${repoPath}/releases/${releaseId}/assets?name=${assetName}`
	const uploadRes = await fetchImpl(uploadUrl, {
		method: "POST",
		headers: {
			...authHeaders,
			"content-type": "application/octet-stream",
		},
		// Buffer is a valid request body at runtime; the DOM `BodyInit` type is
		// narrower than the Node reality, so cast through it.
		body: ctx.fileBytes as unknown as BodyInit,
	})
	if (!uploadRes.ok) {
		throw new ProofUploadError(
			"proof_upload_github_asset_failed",
			`uploading proof asset returned HTTP ${uploadRes.status}`,
		)
	}
	const asset = (await uploadRes.json()) as { browser_download_url: string }
	return {
		provider: "github",
		url: asset.browser_download_url,
		markdown: null,
	}
}

/**
 * Upload to GitLab via the project uploads API. Returns the file's full URL +
 * the markdown snippet GitLab hands back (drop it into the MR). Factored over an
 * injectable fetch for testability.
 */
export async function uploadProofGitLab(
	ctx: ProofUploadContext,
	fetchImpl: typeof fetch,
): Promise<ProofUploadResult> {
	const api = gitlabApiBase(ctx.host)
	const projectId = encodeURIComponent(`${ctx.owner}/${ctx.repo}`)
	const form = new FormData()
	form.append(
		"file",
		// Buffer is a valid BlobPart at runtime; cast through the narrower DOM type.
		new Blob([ctx.fileBytes as unknown as BlobPart], {
			type: "application/octet-stream",
		}),
		ctx.fileName,
	)
	const res = await fetchImpl(`${api}/projects/${projectId}/uploads`, {
		method: "POST",
		// OAuth access tokens (what the broker relays) require Authorization:
		// Bearer — PRIVATE-TOKEN is PAT-only and 401s an OAuth token. Matches
		// provider-rest.ts's gitlabAuthHeaders.
		headers: { authorization: `Bearer ${ctx.token}` },
		body: form,
	})
	if (!res.ok) {
		throw new ProofUploadError(
			"proof_upload_gitlab_failed",
			`GitLab uploads API returned HTTP ${res.status}`,
		)
	}
	const out = (await res.json()) as {
		url?: string
		full_path?: string
		markdown?: string
	}
	const rel = out.full_path ?? out.url ?? ""
	const full = rel.startsWith("http")
		? rel
		: `https://${ctx.host}/${ctx.owner}/${ctx.repo}${rel}`
	return {
		provider: "gitlab",
		url: full,
		markdown: out.markdown ?? null,
	}
}

/** Route to the right provider uploader. */
export async function uploadProof(
	ctx: ProofUploadContext,
	fetchImpl: typeof fetch,
): Promise<ProofUploadResult> {
	if (ctx.provider === "github") return uploadProofGitHub(ctx, fetchImpl)
	return uploadProofGitLab(ctx, fetchImpl)
}

export default defineTool({
	name: "haiku_upload_proof",
	description:
		"Upload a runtime-verification proof file to the intent's / stage's change request over the provider REST API. GitHub → release asset; GitLab → project uploads API + MR-ready markdown ref. Provider is detected from the repo origin; the bearer comes from ~/.haiku/settings.json (run haiku_auth_login first). Returns the durable proof URL.",
	inputSchema: jsonSchemaOf(HAIKU_UPLOAD_PROOF_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuUploadProofInputSchema,
			"haiku_upload_proof",
		)
		if (inputErr) return inputErr
		const { path, pr_url } = args as HaikuUploadProofInput

		// 1) proof file must exist + be a regular file
		if (!existsSync(path)) {
			return text(
				JSON.stringify({
					ok: false,
					error: "proof_upload_path_missing",
					message: `proof path not found: ${path}`,
				}),
			)
		}
		if (!statSync(path).isFile()) {
			return text(
				JSON.stringify({
					ok: false,
					error: "proof_upload_path_not_file",
					message: `proof path is not a regular file: ${path}`,
				}),
			)
		}

		// 2) detect provider from origin
		const origin = readOriginRemoteUrl()
		const parsed = origin ? parseGitRemote(origin) : null
		const provider = parsed ? providerFromHost(parsed.host) : null
		if (!parsed || !provider) {
			return text(
				JSON.stringify({
					ok: false,
					error: "proof_upload_provider_unresolved",
					message:
						"could not detect a supported provider from the repo origin remote",
				}),
			)
		}

		// 3) bearer — AUTH WHEN NEEDED. The engine never tells the agent to
		// "go authenticate first": if there's no usable token, ensureProviderToken
		// runs the broker handshake inline (browser + poll) for the repo's
		// provider, then returns the fresh token. Only a genuinely unobtainable
		// auth (broker unreachable / declined / timed out) surfaces an error.
		const token = await ensureProviderToken(provider)
		if (!token?.access_token) {
			return text(
				JSON.stringify({
					ok: false,
					error: "proof_upload_auth_unavailable",
					message: `could not authenticate to ${provider} via the haikumethod.ai broker — the auth flow didn't complete (declined, timed out, or broker unreachable). Proof was not uploaded.`,
				}),
			)
		}

		// 4) upload
		try {
			const result = await uploadProof(
				{
					provider,
					host: parsed.host,
					owner: parsed.owner,
					repo: parsed.repo,
					token: token.access_token,
					fileName: basename(path),
					fileBytes: readFileSync(path),
					prUrl: pr_url,
				},
				(...a: Parameters<typeof fetch>) => fetch(...a),
			)
			return text(
				JSON.stringify({
					ok: true,
					provider: result.provider,
					url: result.url,
					markdown: result.markdown,
				}),
			)
		} catch (err) {
			if (err instanceof ProofUploadError) {
				return text(
					JSON.stringify({ ok: false, error: err.code, message: err.message }),
				)
			}
			return text(
				JSON.stringify({
					ok: false,
					error: "proof_upload_failed",
					message: err instanceof Error ? err.message : String(err),
				}),
			)
		}
	},
})
