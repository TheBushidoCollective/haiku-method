/**
 * DestinationSelect — picks where the upload lands. Default option is
 * `Intent knowledge` → `knowledge/`. Each remaining option corresponds
 * to a stage that has its own `discovery/` or `knowledge/` directory in
 * the studio config (e.g. `stage:design`).
 *
 * Stages whose status is `complete` (forward-only lifecycle) render
 * disabled and tooltipped: "Stage closed — knowledge cannot be added."
 *
 * Token discipline: extends the `Input.tsx` token surface for the
 * native `<select>` chrome — `bg-white dark:bg-stone-800`,
 * `border-stone-300 dark:border-stone-600`, focus-ring teal-500.
 */

export type DestinationOptionStatus = "open" | "complete"

export interface DestinationOption {
	/** Stable id, e.g. `intent` or `stage:design`. */
	value: string
	/** Display label, e.g. `Intent knowledge` or `Design stage`. */
	label: string
	status?: DestinationOptionStatus
}

export interface DestinationSelectProps {
	value: string
	options: DestinationOption[]
	onChange: (value: string) => void
	disabled?: boolean
	id?: string
	"aria-labelledby"?: string
}

export const INTENT_OPTION: DestinationOption = {
	value: "intent",
	label: "Intent knowledge",
	status: "open",
}

const CLOSED_TOOLTIP = "Stage closed — knowledge cannot be added."

export function DestinationSelect({
	value,
	options,
	onChange,
	disabled = false,
	id,
	"aria-labelledby": ariaLabelledBy,
}: DestinationSelectProps): React.ReactElement {
	return (
		<select
			id={id}
			aria-label={ariaLabelledBy ? undefined : "Upload destination"}
			aria-labelledby={ariaLabelledBy}
			value={value}
			disabled={disabled}
			data-testid="destination-select"
			onChange={(event) => onChange(event.target.value)}
			className="h-9 w-full rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 disabled:border-stone-400 dark:disabled:bg-stone-800 dark:disabled:text-stone-300 dark:disabled:border-stone-500"
		>
			{options.map((opt) => {
				const closed = opt.status === "complete"
				return (
					<option
						key={opt.value}
						value={opt.value}
						disabled={closed}
						title={closed ? CLOSED_TOOLTIP : undefined}
					>
						{closed ? `${opt.label} — closed` : opt.label}
					</option>
				)
			})}
		</select>
	)
}
