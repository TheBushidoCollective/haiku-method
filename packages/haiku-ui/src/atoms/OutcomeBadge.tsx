/**
 * OutcomeBadge — pill atom that renders a manual-change-assessment
 * lifecycle state.
 *
 * Outcome → label mapping (per `features/drift-assessment-visibility.feature`
 * Scenario Outline + the SPA state machine in the `pending-revisit` /
 * `revisit-invoked` / `resolved` scenarios):
 *
 *   - `ignore`              → "Acknowledged"  (terminal — green family)
 *   - `inline-fix`          → "Acknowledged"  (terminal — green family)
 *   - `surface-as-feedback` → "Surfaced as FB-NN" (interpolated — blue family)
 *                             — clicking the badge navigates to the linked FB
 *   - `trigger-revisit`     → one of three labels keyed off the SPA state:
 *       - "Pending revisit"  (Assessment.revisit_invoked_at === null AND
 *                             PendingMarker.cleared_at === null) — rose family
 *       - "Revisit invoked"  (revisit_invoked_at !== null AND
 *                             PendingMarker.cleared_at === null) — rose family
 *       - "Resolved"         (PendingMarker.cleared_at !== null) — green family
 *   - (no record yet)       → "Drift detected" (pre-classification — amber)
 *
 * Drift-state colors come from DESIGN-TOKENS §1.3.2 — every color reference
 * resolves to a token via Tailwind arbitrary value (`bg-[var(--color-…)]`)
 * so the `no-raw-hex` gate stays clean.
 *
 * A11y: the badge is a non-live `role="img"` with an explicit aria-label
 * matching the visible text — a screen reader announces "Outcome:
 * Acknowledged" rather than the bare slug. When the badge is rendered as a
 * link (`href` supplied), the wrapping `<a>` carries the action affordance
 * and the inner span keeps the role="img" so the label fires once.
 */

export type AssessmentOutcome =
	| "ignore"
	| "inline-fix"
	| "surface-as-feedback"
	| "trigger-revisit"

/**
 * SPA-state machine for the `trigger-revisit` outcome. The other three
 * outcomes have no internal state machine — they map directly to a label.
 */
export type RevisitState = "pending-revisit" | "revisit-invoked" | "resolved"

export interface OutcomeBadgeProps {
	/** Pre-classification renders "Drift detected" with the amber palette. */
	outcome?: AssessmentOutcome
	/** Required when outcome === "surface-as-feedback" — interpolated into
	 *  the badge label. The literal string `FB-NN` is used as a placeholder
	 *  copy when the spec wants to communicate the shape without a real id
	 *  (e.g. the Scenario-Outline row). */
	linkedFeedbackId?: string
	/** Required when outcome === "trigger-revisit" — drives label + color. */
	revisitState?: RevisitState
	/** When supplied, the badge renders as `<a href={href}>`. Used for the
	 *  surface-as-feedback case (`/review/{intent}/feedback/FB-07`). */
	href?: string
	/** Optional click handler — used by the assessments view to intercept
	 *  navigation in client-side routers (TanStack). When both `href` and
	 *  `onClick` are supplied, the handler runs first and the link still
	 *  has a real target for keyboard activation + middle-click. */
	onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
	className?: string
}

interface Variant {
	label: string
	classes: string
}

function variantFor(props: OutcomeBadgeProps): Variant {
	const { outcome, linkedFeedbackId, revisitState } = props

	if (outcome === "ignore" || outcome === "inline-fix") {
		return {
			label: "Acknowledged",
			classes:
				"bg-[var(--color-drift-acknowledged-bg)] text-[var(--color-drift-acknowledged-fg)]",
		}
	}

	if (outcome === "surface-as-feedback") {
		// `FB-NN` is the spec literal when no concrete id is supplied — it
		// is documented in the feature file Scenario-Outline as the badge_text
		// placeholder so the label drives the assertion.
		const id = linkedFeedbackId ?? "FB-NN"
		return {
			label: `Surfaced as ${id}`,
			classes:
				"bg-[var(--color-drift-surfaced-bg)] text-[var(--color-drift-surfaced-fg)]",
		}
	}

	if (outcome === "trigger-revisit") {
		if (revisitState === "resolved") {
			return {
				label: "Resolved",
				classes:
					"bg-[var(--color-drift-acknowledged-bg)] text-[var(--color-drift-acknowledged-fg)]",
			}
		}
		if (revisitState === "revisit-invoked") {
			return {
				label: "Revisit invoked",
				classes:
					"bg-[var(--color-drift-revisit-bg)] text-[var(--color-drift-revisit-fg)]",
			}
		}
		// default for trigger-revisit is the pre-revisit-invoked state
		return {
			label: "Pending revisit",
			classes:
				"bg-[var(--color-drift-revisit-bg)] text-[var(--color-drift-revisit-fg)]",
		}
	}

	// No outcome record yet — pre-classification state
	return {
		label: "Drift detected",
		classes:
			"bg-[var(--color-drift-detected-bg)] text-[var(--color-drift-detected-fg)]",
	}
}

const BASE_CLASSES =
	"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"

export function OutcomeBadge(props: OutcomeBadgeProps): React.ReactElement {
	const variant = variantFor(props)
	const classes = [BASE_CLASSES, variant.classes, props.className]
		.filter(Boolean)
		.join(" ")
	const ariaLabel = `Outcome: ${variant.label}`

	if (props.href) {
		return (
			<a
				href={props.href}
				onClick={props.onClick}
				className={`${classes} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`}
				aria-label={ariaLabel}
			>
				{variant.label}
			</a>
		)
	}

	return (
		<span className={classes} role="img" aria-label={ariaLabel}>
			{variant.label}
		</span>
	)
}
