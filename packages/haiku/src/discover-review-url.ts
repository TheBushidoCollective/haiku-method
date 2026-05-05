// discover-review-url.ts — best-effort PR/MR URL discovery via raw git.
//
// The H·AI·K·U engine doesn't gate on PR/MR state — `isBranchMerged`
// against intent main is the only signal. But when a delivery PR or MR
// already exists for the intent main branch, the SPA surfaces it
// informationally (in `IntentCompleteView`'s "Delivery review" section
// and in the future browse interface).
//
// The agent records the URL via
// `haiku_run_next { external_review_url }`. When the agent never
// recorded one — common when the user opened the PR via `gh pr create`
// or the GitHub UI directly — we still want to display the link.
//
// This module discovers the URL using ONLY git plumbing:
//
//   1. Read the head SHA of `haiku/<slug>/main`.
//   2. `git ls-remote origin 'refs/pull/*/head'` (GitHub) or
//      `git ls-remote origin 'refs/merge-requests/*/head'` (GitLab) —
//      every PR/MR's head ref is published as a remote ref.
//   3. Match by SHA → extract the PR/MR number.
//   4. Read `git remote get-url origin`, parse owner/repo, construct
//      the canonical web URL: `https://github.com/<owner>/<repo>/pull/<n>`
//      or `https://gitlab.com/<owner>/<repo>/-/merge_requests/<n>`.
//
// No CLI tools (`gh`, `glab`), no web API calls, no auth assumptions.
// Pure git. Works against private remotes that the operator has SSH /
// PAT access to, same as any other git command.
//
// Squash-merge edge: GitHub's `refs/pull/*/head` continues to point at
// the original (un-squashed) commit even after merge, so the discovery
// keeps working after the PR is closed/merged. Returns null when no
// match — e.g., the branch hasn't been pushed, no PR exists, or the
// remote isn't a recognised host.

import { execFileSync } from "node:child_process"
import type { DiscoveredReviewUrl } from "haiku-api"
import { isGitRepo } from "./state/shared.js"

export type DiscoverySource = DiscoveredReviewUrl["source"]
export type { DiscoveredReviewUrl } from "haiku-api"

function tryRun(args: string[]): string {
	try {
		return execFileSync(args[0], args.slice(1), {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			// `git ls-remote` is a network call against the origin remote.
			// Without a timeout, an unreachable remote hangs execFileSync —
			// which is synchronous and blocks the entire Node event loop.
			// Session API polls every 5s, so a hung ls-remote stalls every
			// poll. 5s is generous: a reachable remote answers in ~100ms.
			timeout: 5000,
		}).trim()
	} catch {
		return ""
	}
}

interface OriginInfo {
	host: "github.com" | "gitlab.com" | "other"
	owner: string
	repo: string
	rawUrl: string
}

/** Parse the origin URL into host/owner/repo. Supports the two URL
 *  shapes git remotes use:
 *   - `git@<host>:<owner>/<repo>.git`  (SSH)
 *   - `https://<host>/<owner>/<repo>.git` (HTTPS, optionally with auth)
 *  The trailing `.git` is optional. Returns null when the origin is
 *  missing or the URL doesn't fit either shape. */
function parseOriginUrl(rawUrl: string): OriginInfo | null {
	if (!rawUrl) return null
	let host = ""
	let path = ""
	const sshMatch = rawUrl.match(/^[^@\s]+@([^:]+):(.+?)(?:\.git)?$/)
	if (sshMatch) {
		host = sshMatch[1]
		path = sshMatch[2]
	} else {
		try {
			const u = new URL(rawUrl)
			host = u.hostname
			path = u.pathname.replace(/^\/+/, "").replace(/\.git$/, "")
		} catch {
			return null
		}
	}
	const segments = path.split("/").filter(Boolean)
	if (segments.length < 2) return null
	const owner = segments[0]
	const repo = segments.slice(1).join("/")
	const knownHost: OriginInfo["host"] =
		host === "github.com"
			? "github.com"
			: host === "gitlab.com"
				? "gitlab.com"
				: "other"
	return { host: knownHost, owner, repo, rawUrl }
}

/** Try to find a published PR/MR ref whose head SHA matches the
 *  branch's HEAD SHA. Each provider exposes a different ref pattern:
 *    - GitHub: `refs/pull/<num>/head`
 *    - GitLab: `refs/merge-requests/<num>/head`
 *  When the origin host is recognised we probe only the matching
 *  pattern — saves one network round-trip per call. For "other" hosts
 *  (self-hosted that mirror either convention) we probe both. */
function matchPrRefForSha(
	sha: string,
	origin: OriginInfo,
): {
	source: DiscoverySource
	prNumber: number
} | null {
	if (!sha) return null
	for (const [pattern, source, requiredHost] of [
		[
			"refs/pull/*/head",
			"github-pr-ref" as DiscoverySource,
			"github.com" as const,
		],
		[
			"refs/merge-requests/*/head",
			"gitlab-mr-ref" as DiscoverySource,
			"gitlab.com" as const,
		],
	] as const) {
		if (origin.host !== "other" && origin.host !== requiredHost) continue
		const out = tryRun(["git", "ls-remote", "origin", pattern])
		if (!out) continue
		for (const line of out.split("\n")) {
			const [refSha, refName] = line.trim().split(/\s+/)
			if (refSha !== sha) continue
			const numMatch = refName?.match(
				/^refs\/(?:pull|merge-requests)\/(\d+)\/head$/,
			)
			if (numMatch) {
				return { source, prNumber: Number(numMatch[1]) }
			}
		}
	}
	return null
}

/** Construct the canonical web URL for a PR/MR given the host, owner,
 *  repo, and number. Returns null for unknown hosts (we don't guess
 *  URL shapes for self-hosted Bitbucket / Gitea / Forgejo / Gerrit). */
function constructUrl(
	origin: OriginInfo,
	source: DiscoverySource,
	prNumber: number,
): string | null {
	if (origin.host === "github.com" && source === "github-pr-ref") {
		return `https://github.com/${origin.owner}/${origin.repo}/pull/${prNumber}`
	}
	if (origin.host === "gitlab.com" && source === "gitlab-mr-ref") {
		return `https://gitlab.com/${origin.owner}/${origin.repo}/-/merge_requests/${prNumber}`
	}
	return null
}

function discoverReviewUrlUncached(slug: string): DiscoveredReviewUrl | null {
	if (!isGitRepo()) return null
	const branch = `haiku/${slug}/main`
	// Resolve the branch's HEAD SHA. tryRun returns "" on missing branch.
	const sha =
		tryRun(["git", "rev-parse", "--verify", branch]) ||
		tryRun(["git", "rev-parse", "--verify", `origin/${branch}`])
	if (!sha) return null
	const originRaw = tryRun(["git", "remote", "get-url", "origin"])
	const origin = parseOriginUrl(originRaw)
	if (!origin) return null
	const match = matchPrRefForSha(sha, origin)
	if (!match) return null
	const url = constructUrl(origin, match.source, match.prNumber)
	if (!url) return null
	return {
		url,
		source: match.source,
		prNumber: match.prNumber,
		matchedSha: sha,
	}
}

// In-process per-slug TTL cache. The session API is polled every 5s and
// `git ls-remote` is a real network call, so without a cache every poll
// re-hits the remote. 30s is plenty: a PR URL doesn't change once
// created, and discovery itself is best-effort/informational. Negative
// results are cached too — a slug with no PR shouldn't re-probe the
// network on every poll either.
interface CacheEntry {
	value: DiscoveredReviewUrl | null
	expiresAt: number
}
const CACHE_TTL_MS = 30_000
const cache = new Map<string, CacheEntry>()

/** Discover the PR/MR URL for an intent's main branch using only git
 *  plumbing. Returns null when:
 *   - Not in a git repo.
 *   - The intent main branch doesn't exist.
 *   - The branch's head SHA matches no published PR/MR ref.
 *   - The origin URL is missing or unparseable.
 *   - The origin host isn't GitHub or GitLab (the URL shape is
 *     provider-specific; we don't guess).
 *
 *  Result is cached per-slug for `CACHE_TTL_MS` to amortise the
 *  network cost of `git ls-remote` across the SPA's 5s session poll. */
export function discoverReviewUrl(slug: string): DiscoveredReviewUrl | null {
	const now = Date.now()
	const cached = cache.get(slug)
	if (cached && cached.expiresAt > now) return cached.value
	const value = discoverReviewUrlUncached(slug)
	cache.set(slug, { value, expiresAt: now + CACHE_TTL_MS })
	return value
}

/** Test/debug hook — drops every cached entry. Call after operations
 *  that mutate the matched ref (e.g. creating a PR mid-session) when
 *  you don't want to wait for the TTL to expire. */
export function clearDiscoverReviewUrlCache(): void {
	cache.clear()
}
