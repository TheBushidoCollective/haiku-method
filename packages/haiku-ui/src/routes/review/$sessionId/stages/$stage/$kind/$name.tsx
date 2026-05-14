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

function isKind(v: string): v is ReviewDetailKind {
	return (VALID_KINDS as readonly string[]).includes(v)
}

function StageDetail(): React.ReactElement {
	const { stage, kind, name } = Route.useParams()
	return <StageContent stage={stage} tab={kind} detail={{ kind, name }} />
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
