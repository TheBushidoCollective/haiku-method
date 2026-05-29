// statusline/links.ts — build haikumethod.ai deep-link URLs for the
// clickable status line (OSC 8 hyperlinks, see render.ts `osc8`).
//
// URL formats mirror the website's real routes:
//   • DEFINITION links (studio, stage) — static site routes describing the
//     lifecycle template itself:
//       studio → /studios/<studio>/
//       stage  → /studios/<studio>/stages/<stage>/
//   • INSTANCE links (intent, unit, feedback) — the live work in THIS repo,
//     served by the browse SPA, which is path-keyed on the repo's origin
//     host/owner/repo and uses KEYWORD-delimited segments (see
//     website/lib/browse/url.ts `buildBrowseUrl`):
//       intent   → /browse/<host>/<owner>/<repo>/intent/<slug>/
//       unit     → …/intent/<slug>/stage/<stage>/unit/<unit>/
//       feedback → …/intent/<slug>/stage/<stage>/feedback/<id>/  (stage-scoped)
//                  …/intent/<slug>/feedback/<id>/                 (intent-scoped)
//     These need the repo remote, so they return null when there's no
//     parseable `origin` (a local-only repo isn't browseable — the chip just
//     renders unlinked).
//
// Base host overridable via HAIKU_WEB_BASE (default https://haikumethod.ai).

const DEFAULT_BASE = "https://haikumethod.ai"

/** Site base, trailing slash stripped. Honors HAIKU_WEB_BASE. */
function webBase(): string {
	const raw = process.env.HAIKU_WEB_BASE?.trim()
	return (raw && raw.length > 0 ? raw : DEFAULT_BASE).replace(/\/+$/, "")
}

/** Encode a single path segment (slugs/stage/unit/feedback ids are simple
 *  identifiers, but encode defensively against spaces / unexpected chars). */
function seg(s: string): string {
	return encodeURIComponent(s)
}

/** Studio DEFINITION page. */
export function studioDefUrl(studio: string): string | null {
	if (!studio) return null
	return `${webBase()}/studios/${seg(studio)}/`
}

/** Stage DEFINITION page within a studio. */
export function stageDefUrl(studio: string, stage: string): string | null {
	if (!studio || !stage) return null
	return `${webBase()}/studios/${seg(studio)}/stages/${seg(stage)}/`
}

/** Repo coordinates for the browse SPA's path-based deep links. */
export interface RepoCoords {
	host: string
	owner: string
	repo: string
}

/** The `/browse/<host>/<owner>/<repo>` project prefix, or null when any
 *  coord is missing. Repo may itself contain slashes (GitLab subgroups), so
 *  it's emitted as-is (already a path); host/owner are single segments. */
function browseProjectPrefix(repo: RepoCoords | null): string | null {
	if (!repo || !repo.host || !repo.owner || !repo.repo) return null
	const repoPath = repo.repo.split("/").map(seg).join("/")
	return `${webBase()}/browse/${seg(repo.host)}/${seg(repo.owner)}/${repoPath}`
}

/** Intent browse page. Null when the repo has no browseable origin. */
export function intentBrowseUrl(
	repo: RepoCoords | null,
	slug: string,
): string | null {
	const prefix = browseProjectPrefix(repo)
	if (!prefix || !slug) return null
	return `${prefix}/intent/${seg(slug)}/`
}

/** Unit deep link: intent → stage → unit (keyword-delimited). */
export function unitBrowseUrl(
	repo: RepoCoords | null,
	slug: string,
	stage: string,
	unit: string,
): string | null {
	const base = intentBrowseUrl(repo, slug)
	if (!base || !stage || !unit) return null
	return `${base}stage/${seg(stage)}/unit/${seg(unit)}/`
}

/** Feedback deep link. Stage-scoped (`…/stage/<stage>/feedback/<id>/`) or
 *  intent-scoped (`…/feedback/<id>/`) depending on whether `stage` is set. */
export function feedbackBrowseUrl(
	repo: RepoCoords | null,
	slug: string,
	stage: string,
	feedbackId: string,
): string | null {
	const base = intentBrowseUrl(repo, slug)
	if (!base || !feedbackId) return null
	const scope = stage ? `stage/${seg(stage)}/` : ""
	return `${base}${scope}feedback/${seg(feedbackId)}/`
}
