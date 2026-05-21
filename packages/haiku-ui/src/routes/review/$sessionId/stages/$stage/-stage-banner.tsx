/**
 * StageBanner + PhaseStepper — sticky top-of-main banner showing the
 * selected stage's status, name, and mini stepper across the stage's
 * own lifecycle phases (elaborate → execute → review → gate).
 *
 * Extracted from `pages/review/ReviewPage.tsx` so the stage layout
 * route owns it directly. Gate badges come from the layout context;
 * phase + stageStatus are derived from the session's stage_state.
 */

import type { ProgressMilestone } from "haiku-api"
import {
	PHASE_TOOLTIPS,
	phaseBadgeCopy,
	STAGE_PHASES,
} from "../../-review-helpers"

/** Human-readable phase title shown as the tooltip header. PHASE_TOOLTIPS
 *  in `-review-helpers.ts` carry both the title and the description in
 *  one string (`"Elaborate — specify the work (hats plan unit files)"`);
 *  split them so we can render a two-line card instead of a one-liner. */
function splitPhaseTooltip(p: (typeof STAGE_PHASES)[number]): {
	title: string
	description: string
} {
	const raw = PHASE_TOOLTIPS[p]
	const idx = raw.indexOf(" — ")
	if (idx < 0) {
		return {
			title: `${p[0].toUpperCase()}${p.slice(1)}`,
			description: raw,
		}
	}
	return {
		title: raw.slice(0, idx),
		description: raw.slice(idx + 3),
	}
}

export function PhaseStepper({
	phase,
	stageStatus,
	milestones,
	progressIndex,
}: {
	phase: string | null
	stageStatus: string
	/** Granular per-stage milestone track (the same ordered milestones the
	 *  status line shows: elaborate → each review role → execute → each
	 *  approval role → observations). When present and non-empty the
	 *  stepper renders one bubble per milestone instead of the coarse
	 *  four-phase strip. Bubbles are keyed by the stable milestone `key`
	 *  so live updates reconcile in place without remounting. */
	milestones?: ProgressMilestone[] | null
	/** Index of the active (first not-done) milestone, or
	 *  `milestones.length` when every milestone is done. */
	progressIndex?: number
}): React.ReactElement {
	const isStageComplete =
		stageStatus === "completed" || stageStatus === "complete"

	// ── Granular track ────────────────────────────────────────────────
	// One bubble per cursor milestone. The labels arrive pre-worded from
	// the engine ("spec review", "quality gates", "observations"); we
	// don't re-derive them. Many stages produce 8–12 milestones, so the
	// bubbles are small dots (not the numbered 20px bubbles the coarse
	// strip uses) with the active milestone's label spelled out in text
	// after the count.
	if (milestones && milestones.length > 0) {
		const total = milestones.length
		const ai =
			typeof progressIndex === "number"
				? progressIndex
				: milestones.findIndex((m) => m.status === "active")
		const allDone = isStageComplete || ai < 0 || ai >= total
		const activeLabel = !allDone ? milestones[ai]?.label : undefined
		const groupAriaLabel = allDone
			? "All milestones complete"
			: ai >= 0
				? `Milestone ${ai + 1} of ${total}`
				: "Milestone progress"
		return (
			// biome-ignore lint/a11y/useSemanticElements: role=group on a div is the right minimal grouping; a fieldset would force legend + form semantics
			<div
				className="inline-flex items-center gap-2"
				role="group"
				aria-label={groupAriaLabel}
			>
				<span className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 leading-none">
					Phase
				</span>
				<ol className="inline-flex items-center gap-1 list-none m-0 p-0">
					{milestones.map((m, i) => {
						const done = isStageComplete || m.status === "done"
						const active = !isStageComplete && m.status === "active"
						const stateWord = active ? "active" : done ? "done" : "pending"
						const ariaLabel = `${m.label} — ${stateWord}`
						return (
							<li key={m.key} className="flex items-center gap-1">
								<span
									className="relative inline-flex items-center justify-center p-1 -m-1 group rounded-md"
									role="img"
									aria-label={ariaLabel}
									aria-current={active ? "step" : undefined}
								>
									<span
										className={`inline-block w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125 ${
											active
												? "bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700"
												: done
													? "bg-green-500"
													: "bg-stone-300 dark:bg-stone-700"
										}`}
										aria-hidden="true"
									/>
									<span
										role="tooltip"
										className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs rounded-lg bg-stone-900 dark:bg-stone-50 px-3 py-2 text-xs shadow-xl ring-1 ring-stone-700 dark:ring-stone-200 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 z-50"
									>
										<span className="block text-xs font-bold text-white dark:text-stone-900 leading-tight capitalize">
											{m.label}
										</span>
										<span
											className={`block text-xs font-medium uppercase tracking-wide leading-tight mt-0.5 ${
												active
													? "text-amber-300 dark:text-amber-600"
													: done
														? "text-green-300 dark:text-green-600"
														: "text-stone-300 dark:text-stone-600"
											}`}
										>
											{stateWord}
										</span>
										<span
											aria-hidden="true"
											className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-stone-900 dark:bg-stone-50 ring-1 ring-stone-700 dark:ring-stone-200"
										/>
									</span>
								</span>
								{i < total - 1 && (
									<span
										className={`w-2 h-0.5 transition-colors ${
											done
												? "bg-green-400 dark:bg-green-700"
												: "bg-stone-300 dark:bg-stone-700"
										}`}
										aria-hidden="true"
									/>
								)}
							</li>
						)
					})}
				</ol>
				<span className="text-xs font-mono text-stone-500 dark:text-stone-400">
					{allDone ? "done" : `${ai + 1}/${total}`}
				</span>
				{activeLabel && (
					<span className="text-xs text-amber-600 dark:text-amber-400 truncate max-w-[12rem] capitalize">
						{activeLabel}
					</span>
				)}
			</div>
		)
	}

	// ── Coarse fallback ───────────────────────────────────────────────
	// Legacy four-phase strip for payloads without a milestone track.
	const activeIndex = phase
		? STAGE_PHASES.indexOf(phase as (typeof STAGE_PHASES)[number])
		: -1
	// Group-level SR label. Three cases:
	//   - stage complete: "All phases complete" (don't say "Phase 0 of 4").
	//   - active phase known: "Phase N of M"
	//   - no live phase (pending stage): "Phase progress" (neutral)
	const groupAriaLabel = isStageComplete
		? "All phases complete"
		: activeIndex >= 0
			? `Phase ${activeIndex + 1} of ${STAGE_PHASES.length}`
			: "Phase progress"
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset would force a legend + form-context semantics that don't apply here; role=group on a div is the right minimal grouping
		<div
			className="inline-flex items-center gap-2"
			role="group"
			aria-label={groupAriaLabel}
		>
			<span className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 leading-none">
				Phase
			</span>
			<ol className="inline-flex items-center gap-1 list-none m-0 p-0">
				{STAGE_PHASES.map((p, i) => {
					const isActive = i === activeIndex && !isStageComplete
					const isDone = isStageComplete || activeIndex > i
					const stateWord = isActive ? "active" : isDone ? "done" : "pending"
					const { title, description } = splitPhaseTooltip(p)
					const ariaLabel = `${title} — ${stateWord}. ${description}`
					return (
						<li key={p} className="flex items-center gap-1">
							{/*
							 * Tooltip card — two-line card (title + description)
							 * shown on pointer hover. The hit-target wrapper has
							 * `p-1 -m-1` for a forgiving 28×28 hit zone over the
							 * 20×20 bubble. The card carries a caret triangle at
							 * the bottom so it visually anchors to its bubble.
							 *
							 * SR / keyboard contract: each bubble is `role="img"`
							 * with a full `aria-label` (title + state + body).
							 * Screen readers expose the parent `<ol>` as a list
							 * and announce each bubble's aria-label on list
							 * navigation — no extra tab stops needed. We
							 * deliberately do NOT use `tabIndex={0}` because
							 * adding 4 extra focus stops per stage banner
							 * crowds the keyboard nav path; the active phase
							 * also carries `aria-current="step"` so the user
							 * lands on the right one when list-nav'ing.
							 */}
							<span
								className="relative inline-flex items-center justify-center p-1 -m-1 group rounded-md"
								role="img"
								aria-label={ariaLabel}
								aria-current={isActive ? "step" : undefined}
							>
								<span
									className={`relative inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold leading-none transition-transform group-hover:scale-110 ${
										isActive
											? "bg-amber-500 text-white ring-2 ring-amber-300 dark:ring-amber-700 shadow-sm"
											: isDone
												? "bg-green-500 text-white"
												: "bg-stone-300 dark:bg-stone-700 text-stone-700 dark:text-stone-300"
									}`}
									aria-hidden="true"
								>
									{isDone ? (
										<svg
											viewBox="0 0 16 16"
											className="w-3 h-3"
											fill="none"
											stroke="currentColor"
											strokeWidth="3"
										>
											<title>done</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M3 8.5l3 3 7-7"
											/>
										</svg>
									) : (
										<span>{i + 1}</span>
									)}
								</span>
								<span
									role="tooltip"
									className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs rounded-lg bg-stone-900 dark:bg-stone-50 px-3 py-2 text-xs shadow-xl ring-1 ring-stone-700 dark:ring-stone-200 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 z-50"
								>
									<span className="block text-xs font-bold text-white dark:text-stone-900 leading-tight">
										{title}
									</span>
									<span
										className={`block text-xs font-medium uppercase tracking-wide leading-tight mt-0.5 ${
											isActive
												? "text-amber-300 dark:text-amber-600"
												: isDone
													? "text-green-300 dark:text-green-600"
													: "text-stone-300 dark:text-stone-600"
										}`}
									>
										{stateWord}
									</span>
									<span className="block text-xs font-normal text-stone-200 dark:text-stone-700 leading-snug mt-1">
										{description}
									</span>
									{/* caret triangle anchoring the card to the bubble */}
									<span
										aria-hidden="true"
										className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-stone-900 dark:bg-stone-50 ring-1 ring-stone-700 dark:ring-stone-200"
									/>
								</span>
							</span>
							{i < STAGE_PHASES.length - 1 && (
								<span
									className={`w-3 h-0.5 transition-colors ${
										isDone
											? "bg-green-400 dark:bg-green-700"
											: "bg-stone-300 dark:bg-stone-700"
									}`}
									aria-hidden="true"
								/>
							)}
						</li>
					)
				})}
			</ol>
			<span className="text-xs font-mono text-stone-500 dark:text-stone-400">
				{isStageComplete
					? "done"
					: activeIndex >= 0
						? `${activeIndex + 1}/${STAGE_PHASES.length}`
						: "—"}
			</span>
		</div>
	)
}

export function StageBanner({
	stageName,
	stageStatus,
	stagePhase,
	gateBadges,
	adHoc,
	milestones,
	progressIndex,
}: {
	stageName: string
	stageStatus: string
	stagePhase: string | null
	gateBadges: Array<{ label: string; classes: string }>
	/** Ad-hoc panes are not gate reviews — suppress the gate-context
	 *  badges and render an "Ad-hoc" pill instead so the user can see
	 *  at a glance that this surface won't advance the workflow. */
	adHoc?: boolean
	/** Granular per-stage milestone track for the engine's current stage
	 *  (null when browsing another stage). Drives the fine-grained phase
	 *  stepper; falls back to the coarse four-phase strip when absent. */
	milestones?: ProgressMilestone[] | null
	progressIndex?: number
}): React.ReactElement {
	const statusPill =
		stageStatus === "current" || stageStatus === "active"
			? {
					bannerClasses:
						"border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-900/20",
					pillClasses: "bg-teal-700 text-white",
					label: "current",
				}
			: stageStatus === "completed" || stageStatus === "complete"
				? {
						bannerClasses:
							"border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-900/20",
						pillClasses: "bg-green-700 text-white",
						label: "complete",
					}
				: {
						bannerClasses:
							"border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40",
						pillClasses: "bg-stone-600 text-white",
						label: "upcoming",
					}
	const phasePill = phaseBadgeCopy(stagePhase ?? undefined, stageStatus)
	return (
		<div
			data-testid="review-stage-banner"
			className="bg-stone-50 dark:bg-stone-950 px-6 lg:px-10 pt-6 pb-3"
		>
			<div
				className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${statusPill.bannerClasses}`}
			>
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusPill.pillClasses}`}
				>
					{statusPill.label}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-3 flex-wrap">
						<p className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 leading-none">
							Stage
						</p>
						<PhaseStepper
							phase={stagePhase}
							stageStatus={stageStatus}
							milestones={milestones}
							progressIndex={progressIndex}
						/>
					</div>
					<div className="flex items-center gap-2 mt-1 flex-wrap">
						<h1 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight capitalize">
							{stageName}
						</h1>
						{phasePill && (
							<span
								className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${phasePill.classes}`}
							>
								{phasePill.label}
							</span>
						)}
						{adHoc ? (
							<span
								className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
								title="Ad-hoc review — not a gate. Feedback routes through the normal fix-loop on the next run_next."
							>
								Ad-hoc
							</span>
						) : (
							gateBadges.map((b) => (
								<span
									key={b.label}
									className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${b.classes}`}
								>
									{b.label}
								</span>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
