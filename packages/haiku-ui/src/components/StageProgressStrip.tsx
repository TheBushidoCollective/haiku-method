/**
 * StageProgressStrip — visible navigation of the intent's stage progression.
 *
 * Canonical sources:
 *   - unit spec: stages/development/units/unit-12-stage-progress-strip.md
 *   - design: stages/design/artifacts/stage-progress-strip.html
 *   - tokens: knowledge/DESIGN-TOKENS.md §1.7.1 (touch targets)
 *   - a11y: unit-05 (focusRingClass, touchTargetHitAreaClass)
 *
 * Regression guards (enforced by tests/StageProgressStrip.test.tsx +
 * audit-config.json `banned-tabindex-negative-stageprogress`):
 *   1. Every stage node is a native <button> with a ≥ 44×44 CSS-px hit
 *      area via touchTargetHitAreaClass. The visible glyph (20×20 circle
 *      / 22×22 diamond) is sourced from --stage-glyph-* CSS custom
 *      properties, not hardcoded.
 *   2. Future stages remain keyboard-reachable — they are NOT removed
 *      from the Tab order. They carry aria-disabled="true" and visual
 *      dimming; Tab still lands on them. Activation is a no-op.
 *   3. Upcoming glyph uses border-stone-400 dark:border-stone-500 and
 *      label uses text-stone-600 dark:text-stone-300 — both clear WCAG
 *      AA (verified by scripts/audit-contrast.mjs --mode=tokens).
 *   4. The in-progress stage has aria-current="step".
 */

import type { ReactNode } from "react"
import { Fragment } from "react"
import { focusRingClass, touchTargetHitAreaClass } from "../a11y"

export interface StageInfo {
	name: string
	status: string
	/** Optional revisit count — reserved for a future revisit variant (unit-11). */
	visits?: number
	/** Optional short label for mobile (defaults to name.slice(0, 3)). */
	mobileLabel?: string
}

interface Props {
	stages: StageInfo[]
	/**
	 * Canonical name of the in-progress stage. Either `activeStage` or the
	 * legacy alias `currentStage` is accepted; if both are passed, `activeStage`
	 * wins (dev-mode console.warn on disagreement).
	 */
	activeStage?: string
	/**
	 * @deprecated — alias for `activeStage`. Retained so existing call sites
	 * (ReviewPage, ReviewCurrentPage) keep working unmodified until unit-15
	 * migrates them.
	 */
	currentStage?: string
	onStageClick?: (stageName: string) => void
}

type NormalizedStatus = "completed" | "active" | "upcoming"

function normalizeStatus(
	stage: StageInfo,
	isActive: boolean,
): NormalizedStatus {
	if (isActive) return "active"
	if (stage.status === "completed" || stage.status === "complete")
		return "completed"
	return "upcoming"
}

function statusLabel(normalized: NormalizedStatus): string {
	switch (normalized) {
		case "active":
			return "in progress"
		case "completed":
			return "completed"
		default:
			return "upcoming"
	}
}

function labelClasses(normalized: NormalizedStatus): string {
	switch (normalized) {
		case "active":
			return "text-xs font-semibold text-teal-600 dark:text-teal-400 mt-2"
		case "completed":
			return "text-xs font-medium text-stone-700 dark:text-stone-300 mt-2"
		default:
			// Upcoming — must clear WCAG AA on white / stone-950.
			return "text-xs font-medium text-stone-600 dark:text-stone-300 mt-2"
	}
}

function renderGlyph(normalized: NormalizedStatus): ReactNode {
	if (normalized === "completed") {
		return (
			<span
				className="w-[var(--stage-glyph-circle)] h-[var(--stage-glyph-circle)] rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold"
				aria-hidden="true"
				data-glyph="circle"
			>
				<svg
					width="10"
					height="10"
					viewBox="0 0 10 10"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					aria-hidden="true"
				>
					<path d="M2 5l2 2 4-4" />
				</svg>
			</span>
		)
	}
	if (normalized === "active") {
		return (
			<span
				className="w-[var(--stage-glyph-diamond)] h-[var(--stage-glyph-diamond)] bg-teal-600 text-white shadow-md ring-2 ring-teal-400/50 flex items-center justify-center"
				style={{ transform: "rotate(45deg)" }}
				aria-hidden="true"
				data-glyph="diamond"
			>
				<span
					style={{ transform: "rotate(-45deg)" }}
					className="text-xs font-bold"
				>
					◆
				</span>
			</span>
		)
	}
	// Upcoming — stone-200 fill with stone-400 border, stone-600 glyph text.
	return (
		<span
			className="w-[var(--stage-glyph-circle)] h-[var(--stage-glyph-circle)] rounded-full bg-stone-200 dark:bg-stone-700 border border-stone-400 dark:border-stone-500 text-stone-600 dark:text-stone-300 flex items-center justify-center text-xs"
			aria-hidden="true"
			data-glyph="circle"
		>
			○
		</span>
	)
}

function connectorClasses(
	prev: NormalizedStatus,
	_next: NormalizedStatus,
): string {
	// Connector color reflects upstream stage: teal once the upstream stage is
	// completed or active; otherwise the muted stone connector.
	if (prev === "completed" || prev === "active") {
		return "bg-teal-600"
	}
	return "bg-stone-300 dark:bg-stone-600"
}

export function StageProgressStrip({
	stages,
	activeStage,
	currentStage,
	onStageClick,
}: Props) {
	// Resolve the active name from whichever prop is provided.
	if (
		typeof activeStage === "string" &&
		typeof currentStage === "string" &&
		activeStage !== currentStage &&
		activeStage.length > 0 &&
		currentStage.length > 0 &&
		import.meta.env?.DEV
	) {
		console.warn(
			`[StageProgressStrip] activeStage ("${activeStage}") and currentStage ("${currentStage}") disagree; using activeStage.`,
		)
	}
	const active =
		(typeof activeStage === "string" && activeStage.length > 0
			? activeStage
			: currentStage) ?? ""

	// Render the nav landmark even when empty so screen readers can still find
	// it on first mount. aria-landmark-spec §1 prefers stable landmarks over
	// conditional mounts.
	return (
		<nav
			aria-label="Stage progress"
			className="flex items-center gap-0 overflow-x-auto py-2 px-1"
		>
			{stages.map((stage, i) => {
				const isActive = stage.name === active
				const normalized = normalizeStatus(stage, isActive)
				const prev = i > 0 ? stages[i - 1] : undefined
				const prevNormalized: NormalizedStatus | undefined = prev
					? normalizeStatus(prev, prev.name === active)
					: undefined
				const isUpcoming = normalized === "upcoming"
				const hasVisits = (stage.visits ?? 0) > 0
				// Future stages with no prior visits are "aria-disabled" — focusable
				// via Tab (WCAG 2.1.1) but clicks are ignored. Completed / active /
				// previously-visited upcoming nodes are fully interactive.
				const ariaDisabled = isUpcoming && !hasVisits

				return (
					<Fragment key={stage.name}>
						{i > 0 && prevNormalized && (
							<div
								aria-hidden="true"
								className={`h-[2px] flex-1 min-w-5 ${connectorClasses(prevNormalized, normalized)}`}
							/>
						)}
						<button
							type="button"
							aria-current={isActive ? "step" : undefined}
							aria-disabled={ariaDisabled ? "true" : undefined}
							aria-label={`${stage.name} stage, ${statusLabel(normalized)}`}
							data-stage={stage.name}
							data-status={normalized}
							onClick={(e) => {
								if (e.currentTarget.getAttribute("aria-disabled") === "true")
									return
								onStageClick?.(stage.name)
							}}
							className={`${touchTargetHitAreaClass} ${focusRingClass} relative flex flex-col items-center justify-center shrink-0 bg-transparent`}
						>
							{renderGlyph(normalized)}
							<span className={labelClasses(normalized)}>
								<span className="hidden sm:inline">{stage.name}</span>
								<span className="sm:hidden">
									{stage.mobileLabel ?? stage.name.slice(0, 3)}
								</span>
							</span>
						</button>
					</Fragment>
				)
			})}
		</nav>
	)
}
