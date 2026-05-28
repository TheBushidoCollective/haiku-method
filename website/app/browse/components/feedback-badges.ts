/**
 * Feedback resolution badges — shared by the stage/intent feedback cards
 * (IntentDetailView) and the unit feedback card (UnitDetailView) so the
 * resolution routing pill reads identically wherever a finding is shown.
 * Lives in its own module to avoid a cycle (IntentDetailView imports
 * UnitDetailView, so UnitDetailView can't import back from it).
 */
export const RESOLUTION_BADGES: Record<
	"question" | "inline_fix" | "stage_revisit",
	{ label: string; classes: string; tooltip: string }
> = {
	question: {
		label: "Question",
		classes:
			"bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
		tooltip:
			"Question — the cursor pauses on this finding (feedback_question) and asks the agent to answer the body. No fix-hat chain runs.",
	},
	inline_fix: {
		label: "Inline fix",
		classes: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
		tooltip:
			"Inline fix — the engine dispatches the stage's fix-hat chain against this finding in place. The terminal hat's closure reply is the resolution-of-record.",
	},
	stage_revisit: {
		label: "Stage revisit",
		classes:
			"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
		tooltip:
			"Stage revisit — the cursor walks back to this finding's stage and reopens its elaborate phase. Corrective units land in the next bolt; completed work isn't mutated.",
	},
}

/**
 * Feedback severity badges — mirror the SPA's `SEVERITY_LABELS`
 * (`packages/haiku-ui/src/organisms/FeedbackItem.tsx`) so a finding's
 * severity reads identically on the website browse view. Color runs hot
 * (red) to cool (stone) with severity.
 */
export const SEVERITY_BADGES: Record<
	"blocker" | "high" | "medium" | "low",
	{ label: string; classes: string; tooltip: string }
> = {
	blocker: {
		label: "Blocker",
		classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
		tooltip:
			"Blocker — stops the gate; fixed before the stage advances. The fix-loop dispatches blockers first.",
	},
	high: {
		label: "High",
		classes:
			"bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
		tooltip: "High — a real defect that should be fixed before delivery.",
	},
	medium: {
		label: "Medium",
		classes:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
		tooltip: "Medium — a genuine issue worth fixing; not delivery-blocking.",
	},
	low: {
		label: "Low",
		classes: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
		tooltip: "Low — a nit, polish, or nice-to-have.",
	},
}
