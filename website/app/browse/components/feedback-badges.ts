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
