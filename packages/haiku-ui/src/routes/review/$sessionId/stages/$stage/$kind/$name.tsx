/**
 * /review/:sessionId/stages/:stage/:kind/:name — artifact detail view.
 *
 * Valid `kind`: `units` | `knowledge` | `outputs` | `other`. The
 * artifact name round-trips through `encodeURIComponent` so names
 * containing slashes or spaces survive the URL grammar (see
 * `buildReviewPath` history + TanStack Router's default param
 * encoder).
 *
 * `other` is the catchall kind for stray stage files surfaced via
 * the Other tab (ReviewTab union widening, commit ee1c784ae). The
 * sibling route `$tab.tsx` gained `"other"` in its allowlist in PR
 * #360; this file had the same gap one level deeper, so detail
 * URLs like `/stages/<stage>/other/<filename>` 404'd even after
 * the tab route worked. Reported 2026-05-13 on a v5.0.2 session.
 */

import { createFileRoute, notFound } from "@tanstack/react-router"
import type { ReviewDetailKind } from "../../../../../../pages/review/shared/stage-tabs"
import { StageContent } from "../-stage-content"

const VALID_KINDS = [
	"units",
	"knowledge",
	"outputs",
	"other",
] as const satisfies readonly ReviewDetailKind[]
// Compile-time exhaustiveness: fails to compile if any ReviewDetailKind
// member is missing from VALID_KINDS. Mirrors the guard added to
// $tab.tsx in commit 12c1abb91.
type _Exhaustive =
	Exclude<ReviewDetailKind, (typeof VALID_KINDS)[number]> extends never
		? true
		: never
const _exhaustive: _Exhaustive = true
void _exhaustive

// A known fixed detail kind, OR a dynamic per-directory tab id (a stage
// subdirectory name like `proofs`). Dir tabs reuse the same list+detail
// render path keyed off the directory id, so opening an item in one routes
// here with the dir name as `kind`. Mirror `$tab.tsx`: accept a known kind OR
// a safe slug. Without this, opening a `proofs/` item 404'd with "Not Found"
// because the dir name wasn't in VALID_KINDS (reported 2026-05-27).
const DIR_KIND_RE = /^[a-z0-9][a-z0-9._-]*$/i
function isKind(v: string): boolean {
	return (VALID_KINDS as readonly string[]).includes(v) || DIR_KIND_RE.test(v)
}

function StageDetail(): React.ReactElement {
	const { stage, kind, name } = Route.useParams()
	// `kind` may be a dynamic dir-tab id. StageContent's detail.kind is typed
	// ReviewDetailKind, but the render path treats it as a string tab id
	// (StageReview matches `detail.tab === <dir>`); the cast is sound at runtime.
	return (
		<StageContent
			stage={stage}
			tab={kind}
			detail={{ kind: kind as ReviewDetailKind, name }}
		/>
	)
}

export const Route = createFileRoute(
	"/review/$sessionId/stages/$stage/$kind/$name",
)({
	parseParams: (params) => {
		if (!isKind(params.kind)) throw notFound()
		return { ...params, kind: params.kind }
	},
	component: StageDetail,
})
