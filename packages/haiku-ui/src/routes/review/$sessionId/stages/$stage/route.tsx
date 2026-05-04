/**
 * /review/:sessionId/stages/:stage — stage layout.
 *
 * Renders the sticky StageBanner + a rereview banner (when the session
 * carries a previous-review snapshot), then the child route content in
 * the main pane.
 */

import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import {
	DriftBanner,
	type DriftEntry,
} from "../../../../../molecules/DriftBanner"
import { RereviewBanner } from "../../../../../pages/review/shared/RereviewBanner"
import { useReviewContext } from "../../-context"
import { gateBadgeCopy, resolveGateModes } from "../../-review-helpers"
import { StageBanner } from "./-stage-banner"

function StageLayout(): React.ReactElement {
	const { stage } = Route.useParams()
	const { session, sessionId, activeStage } = useReviewContext()
	// Terminal-intent guard: when the intent is in
	// `awaiting_completion_review` or `status: completed`, deep links
	// to `/stages/<X>` would render with the stage banner highlighting
	// the (now-done) stage and the chrome labeling it "current". The
	// IntentCompleteView lives at /intent — redirect there so the
	// chrome reflects "we're reviewing the intent, not a stage."
	const intentFm = session.intent?.frontmatter
	const intentStatus = (intentFm?.status as string | undefined) ?? ""
	const intentPhase = (intentFm?.phase as string | undefined) ?? ""
	const isIntentTerminal =
		intentStatus === "completed" ||
		intentPhase === "awaiting_completion_review" ||
		intentPhase === "intent_completion"
	if (isIntentTerminal) {
		return (
			<Navigate to="/review/$sessionId/intent" params={{ sessionId }} replace />
		)
	}
	const stageStates = session.stage_states ?? {}
	const stageStatus =
		stage === activeStage
			? "current"
			: (stageStates[stage]?.status ?? "pending")
	const stagePhase = stageStates[stage]?.phase ?? null
	const gateModes = resolveGateModes(session.gate_type)
	const gateBadges = gateModes.map(gateBadgeCopy)

	// Keep the Tab list from sliding under the sticky StageBanner by
	// publishing the banner's actual rendered height into the scope's
	// `--header-height` CSS variable. `<Tabs>` sticks at
	// `top: var(--header-height)`, and the banner itself varies in
	// height (phase stepper + wrapping gate badges), so a hard-coded
	// value gets it wrong in the banner's taller states.
	const bannerRef = useRef<HTMLDivElement>(null)
	const [bannerHeight, setBannerHeight] = useState<number | null>(null)
	useEffect(() => {
		const el = bannerRef.current
		if (!el) return
		const measure = () => setBannerHeight(el.getBoundingClientRect().height)
		measure()
		const obs = new ResizeObserver(measure)
		obs.observe(el)
		return () => obs.disconnect()
	}, [])

	const scopeStyle = bannerHeight
		? ({ "--header-height": `${bannerHeight}px` } as React.CSSProperties)
		: undefined

	return (
		<div style={scopeStyle}>
			<div ref={bannerRef} className="sticky top-0 z-20">
				<StageBanner
					stageName={stage}
					stageStatus={stageStatus}
					stagePhase={stagePhase}
					gateBadges={gateBadges}
				/>
			</div>
			{/* Drift banner — between StageBanner and RereviewBanner per
			    SPA-UI-SPECS §3. Component returns null on empty drift, so
			    the integration is safe even before the WS bridge that
			    pushes drift entries lands. Wiring `drift` to the
			    manual_change_assessment finding feed is the next iteration. */}
			<DriftBanner drift={[] as DriftEntry[]} />
			<div className="px-6 lg:px-10 pb-6">
				{session.previous_review && (
					<RereviewBanner snapshot={session.previous_review} />
				)}
				<Outlet />
			</div>
		</div>
	)
}

export const Route = createFileRoute("/review/$sessionId/stages/$stage")({
	component: StageLayout,
})
