// provider-rest.ts — PR/MR write operations over the provider REST API,
// driven by a stored OAuth token (Phase 4 of provider OAuth).
//
// These are the token-backed counterparts to the `gh` / `glab` shell-outs in
// git-worktree.ts. When the engine has a stored provider token (captured by
// haiku_auth_login), it can create and ready a PR/MR without an authed CLI on
// PATH — the provider-agnostic delivery path. When there's no token, the
// callers fall back to the CLI as before; this module is never the only path.
//
// Scope is deliberately create + mark-ready. There is NO merge helper here —
// the engine never merges a delivery PR/MR on its own (the merge is the human's
// explicit call, and on hosts with branch protection the merge itself is the
// approval signal). Merge stays CLI/human-only by design.
//
// Every provider call is factored behind an injectable `fetch` so the handshake
// is unit-testable (dedup → create → ready) without real network. The default
// callers pass global fetch. NOTE: the REST contracts here are written to the
// GitHub / GitLab API docs but validated only against a mocked fetch — same as
// haiku_upload_proof. The CLI fallback remains the integration-proven path; the
// REST path is exercised for real once a broker token exists (post-deploy).

import type { ProviderName } from "./state/schemas/global-settings.js"

/** Everything a REST PR/MR call needs: the parsed remote + the bearer. */
export interface PrRestContext {
	provider: ProviderName
	host: string
	owner: string
	repo: string
	token: string
}

/** Inputs for opening a PR/MR. */
export interface CreatePrInput {
	/** Head / source branch. */
	branch: string
	/** Base / target branch. */
	mainline: string
	title: string
	body: string
	draft: boolean
}

/** Stable named errors so callers can fall back to the CLI on any REST miss. */
export class ProviderRestError extends Error {
	code: string
	constructor(code: string, message: string) {
		super(message)
		this.code = code
	}
}

/** GitHub REST + GraphQL bases for a host. github.com → api.github.com;
 *  GitHub Enterprise → https://<host>/api/v3 (REST) + /api/graphql. */
function githubApiBase(host: string): { rest: string; graphql: string } {
	if (host === "github.com") {
		return {
			rest: "https://api.github.com",
			graphql: "https://api.github.com/graphql",
		}
	}
	return {
		rest: `https://${host}/api/v3`,
		graphql: `https://${host}/api/graphql`,
	}
}

/** GitLab REST base for a host (always /api/v4). */
function gitlabApiBase(host: string): string {
	return `https://${host}/api/v4`
}

function githubAuthHeaders(token: string): Record<string, string> {
	return {
		authorization: `Bearer ${token}`,
		accept: "application/vnd.github+json",
		"x-github-api-version": "2022-11-28",
	}
}

/** GitLab accepts an OAuth access token (what the broker relays) via the
 *  Authorization: Bearer header. PATs would also work via PRIVATE-TOKEN, but
 *  the broker yields OAuth tokens, so Bearer is the correct choice. */
function gitlabAuthHeaders(token: string): Record<string, string> {
	return { authorization: `Bearer ${token}` }
}

// ── GitHub ─────────────────────────────────────────────────────────

async function createPullRequestGitHub(
	ctx: PrRestContext,
	input: CreatePrInput,
	fetchImpl: typeof fetch,
): Promise<{ url: string }> {
	const { rest } = githubApiBase(ctx.host)
	const repoPath = `${ctx.owner}/${ctx.repo}`
	const headers = githubAuthHeaders(ctx.token)

	// dedup: an open PR for this head already exists → return it
	const listRes = await fetchImpl(
		`${rest}/repos/${repoPath}/pulls?head=${encodeURIComponent(
			`${ctx.owner}:${input.branch}`,
		)}&state=open&base=${encodeURIComponent(input.mainline)}`,
		{ headers },
	)
	if (listRes.ok) {
		const existing = (await listRes.json()) as Array<{ html_url?: string }>
		if (Array.isArray(existing) && existing[0]?.html_url) {
			return { url: existing[0].html_url }
		}
	}

	const createRes = await fetchImpl(`${rest}/repos/${repoPath}/pulls`, {
		method: "POST",
		headers: { ...headers, "content-type": "application/json" },
		body: JSON.stringify({
			title: input.title,
			head: input.branch,
			base: input.mainline,
			body: input.body,
			draft: input.draft,
		}),
	})
	if (!createRes.ok) {
		throw new ProviderRestError(
			"pr_create_github_failed",
			`creating PR returned HTTP ${createRes.status}`,
		)
	}
	const created = (await createRes.json()) as { html_url?: string }
	if (!created.html_url) {
		throw new ProviderRestError(
			"pr_create_github_no_url",
			"GitHub create PR response had no html_url",
		)
	}
	return { url: created.html_url }
}

/** Mark a GitHub PR ready for review. REST has no draft→ready endpoint — it's
 *  the GraphQL `markPullRequestReadyForReview` mutation, which needs the PR's
 *  node_id. So: parse the PR number from the URL, GET the PR for its node_id,
 *  then run the mutation. */
async function markReadyGitHub(
	ctx: PrRestContext,
	url: string,
	fetchImpl: typeof fetch,
): Promise<void> {
	const { rest, graphql } = githubApiBase(ctx.host)
	const repoPath = `${ctx.owner}/${ctx.repo}`
	const headers = githubAuthHeaders(ctx.token)

	const numMatch = url.match(/\/pull\/(\d+)/)
	if (!numMatch) {
		throw new ProviderRestError(
			"pr_ready_github_bad_url",
			`could not parse PR number from URL: ${url}`,
		)
	}
	const getRes = await fetchImpl(
		`${rest}/repos/${repoPath}/pulls/${numMatch[1]}`,
		{ headers },
	)
	if (!getRes.ok) {
		throw new ProviderRestError(
			"pr_ready_github_lookup_failed",
			`looking up PR returned HTTP ${getRes.status}`,
		)
	}
	const pr = (await getRes.json()) as { node_id?: string }
	if (!pr.node_id) {
		throw new ProviderRestError(
			"pr_ready_github_no_node_id",
			"PR lookup returned no node_id",
		)
	}
	const mutation =
		"mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id}}}"
	const gqlRes = await fetchImpl(graphql, {
		method: "POST",
		headers: { ...headers, "content-type": "application/json" },
		body: JSON.stringify({ query: mutation, variables: { id: pr.node_id } }),
	})
	if (!gqlRes.ok) {
		throw new ProviderRestError(
			"pr_ready_github_failed",
			`markReadyForReview returned HTTP ${gqlRes.status}`,
		)
	}
	const out = (await gqlRes.json()) as { errors?: unknown[] }
	if (Array.isArray(out.errors) && out.errors.length > 0) {
		throw new ProviderRestError(
			"pr_ready_github_graphql_error",
			`markReadyForReview returned GraphQL errors: ${JSON.stringify(out.errors)}`,
		)
	}
}

// ── GitLab ─────────────────────────────────────────────────────────

const GITLAB_DRAFT_PREFIX = /^(draft:|wip:)\s*/i

async function createMergeRequestGitLab(
	ctx: PrRestContext,
	input: CreatePrInput,
	fetchImpl: typeof fetch,
): Promise<{ url: string }> {
	const api = gitlabApiBase(ctx.host)
	const projectId = encodeURIComponent(`${ctx.owner}/${ctx.repo}`)
	const headers = gitlabAuthHeaders(ctx.token)

	// dedup: an opened MR for this source branch already exists → return it
	const listRes = await fetchImpl(
		`${api}/projects/${projectId}/merge_requests?source_branch=${encodeURIComponent(
			input.branch,
		)}&state=opened`,
		{ headers },
	)
	if (listRes.ok) {
		const existing = (await listRes.json()) as Array<{ web_url?: string }>
		if (Array.isArray(existing) && existing[0]?.web_url) {
			return { url: existing[0].web_url }
		}
	}

	// GitLab marks a draft via a "Draft: " title prefix (what `glab --draft` does).
	const title = input.draft ? `Draft: ${input.title}` : input.title
	const createRes = await fetchImpl(
		`${api}/projects/${projectId}/merge_requests`,
		{
			method: "POST",
			headers: { ...headers, "content-type": "application/json" },
			body: JSON.stringify({
				source_branch: input.branch,
				target_branch: input.mainline,
				title,
				description: input.body,
			}),
		},
	)
	if (!createRes.ok) {
		throw new ProviderRestError(
			"mr_create_gitlab_failed",
			`creating MR returned HTTP ${createRes.status}`,
		)
	}
	const created = (await createRes.json()) as { web_url?: string }
	if (!created.web_url) {
		throw new ProviderRestError(
			"mr_create_gitlab_no_url",
			"GitLab create MR response had no web_url",
		)
	}
	return { url: created.web_url }
}

/** Mark a GitLab MR ready by stripping the "Draft:"/"WIP:" prefix from its
 *  title (the inverse of `glab mr update --ready`). Fetches the current title,
 *  strips the prefix, PUTs it back. No-op when already un-prefixed. */
async function markReadyGitLab(
	ctx: PrRestContext,
	url: string,
	fetchImpl: typeof fetch,
): Promise<void> {
	const api = gitlabApiBase(ctx.host)
	const projectId = encodeURIComponent(`${ctx.owner}/${ctx.repo}`)
	const headers = gitlabAuthHeaders(ctx.token)

	const iidMatch = url.match(/\/merge_requests\/(\d+)/)
	if (!iidMatch) {
		throw new ProviderRestError(
			"mr_ready_gitlab_bad_url",
			`could not parse MR iid from URL: ${url}`,
		)
	}
	const iid = iidMatch[1]
	const getRes = await fetchImpl(
		`${api}/projects/${projectId}/merge_requests/${iid}`,
		{ headers },
	)
	if (!getRes.ok) {
		throw new ProviderRestError(
			"mr_ready_gitlab_lookup_failed",
			`looking up MR returned HTTP ${getRes.status}`,
		)
	}
	const mr = (await getRes.json()) as { title?: string }
	const stripped = (mr.title ?? "").replace(GITLAB_DRAFT_PREFIX, "")
	if (stripped === mr.title) return // already ready
	const putRes = await fetchImpl(
		`${api}/projects/${projectId}/merge_requests/${iid}`,
		{
			method: "PUT",
			headers: { ...headers, "content-type": "application/json" },
			body: JSON.stringify({ title: stripped }),
		},
	)
	if (!putRes.ok) {
		throw new ProviderRestError(
			"mr_ready_gitlab_failed",
			`updating MR returned HTTP ${putRes.status}`,
		)
	}
}

// ── Routing ────────────────────────────────────────────────────────

/** Open a PR/MR over the provider REST API. Routes by provider. */
export async function createPullRequestRest(
	ctx: PrRestContext,
	input: CreatePrInput,
	fetchImpl: typeof fetch,
): Promise<{ url: string }> {
	if (ctx.provider === "github") {
		return createPullRequestGitHub(ctx, input, fetchImpl)
	}
	return createMergeRequestGitLab(ctx, input, fetchImpl)
}

/** Mark a draft PR/MR ready for review over the provider REST API. */
export async function markPullRequestReadyRest(
	ctx: PrRestContext,
	url: string,
	fetchImpl: typeof fetch,
): Promise<void> {
	if (ctx.provider === "github") {
		return markReadyGitHub(ctx, url, fetchImpl)
	}
	return markReadyGitLab(ctx, url, fetchImpl)
}
