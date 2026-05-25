// statusline/render.ts — pure renderer for the H·AI·K·U custom status
// line. Takes a normalized StatuslineState and produces a single ANSI
// line. No I/O, no engine reads — `state.ts` does that and hands the
// shape here so the renderer stays trivially testable.
//
// Visual language (Palette A, the hexagon-native set chosen 2026-05-19):
//
//   ⬢ <intent> · <pipeline> <stage> <flow> <phase> · <aggregate>
//
//   pipeline  ⬢ done (green) · ⬣ active (amber, magenta when gated) · ⬡ pending (dim)
//   flow      ❯ flowing  ·  ⊘ gated/blocked
//   delimiter ·  dim microdot between the three groups (who · where · how-much)
//   phase     color-coded — the fastest "what's happening" signal
//
// The active hexagon is `⬣` (a genuinely distinct glyph), not a recolored
// dot — so the pipeline reads even before color registers. Everything is
// standard BMP Unicode; no Nerd Font required.
//
// Color is emitted unless `NO_COLOR` is set (https://no-color.org). We do
// NOT gate on isTTY: a Claude Code status line is captured (never a TTY)
// yet still rendered with ANSI, so a TTY check would wrongly strip color.

export type StatuslinePhaseKind =
	| "elaborate"
	| "execute"
	| "review"
	| "approve"
	| "fixloop"
	| "gate"
	| "complete"
	| "sealed"
	| "blocked"
	// Intent-level setup / pre-stage phases (no stage active yet):
	// select studio / mode / stage, pre-intent substance verify.
	| "setup"

export interface StatuslineStageDot {
	name: string
	status: "done" | "active" | "pending"
}

/** Per-hat status within a unit/feedback progress bar. `done` = the hat
 *  advanced (green), `active` = its iteration is open / in progress
 *  (yellow), `rejected` = its most recent result was a reject (red),
 *  `pending` = not reached yet (faint empty pip). */
export type HatSegment = "done" | "active" | "rejected" | "pending"

export interface StatuslineState {
	/** Intent slug. */
	intent: string
	/** Studio (lifecycle template) name — rendered as a dim tag. Empty
	 *  before studio selection. */
	studio: string
	/** Ordered stage pipeline with per-stage status. Empty for
	 *  intent-level phases that precede stage resolution. */
	stages: StatuslineStageDot[]
	/** Name of the active stage (the `active` dot). Empty when there's no
	 *  single active stage (intent-level phases, sealed). */
	activeStage: string
	/** Human phase label shown after the flow mark ("execute",
	 *  "fix-loop", "approval gate", "select studio", …). */
	phaseLabel: string
	/** Phase kind — drives the phase color + the flow glyph. */
	phaseKind: StatuslinePhaseKind
	/** True when the workflow is parked on a human/external gate. Flips
	 *  the flow mark to ⊘ and the middle group to magenta. */
	gated: boolean
	/** Right-hand aggregate ("7/12 units", "2/6 closed", "decomposing").
	 *  Empty string renders no third group. */
	aggregate: string
	/** During a fix-loop, the actual structural phase the stage is parked
	 *  at (e.g. "approval gate", "spec review") — the milestone the open
	 *  feedback is blocking. Rendered struck-through immediately left of
	 *  the "fix-loop" word so the line reads "❯ a̶p̶p̶r̶o̶v̶a̶l̶ ̶g̶a̶t̶e̶ fix-loop":
	 *  you can still see WHERE the loop is happening. Empty/undefined for
	 *  every non-fix-loop phase. */
	actualPhase?: string
	/** Phase progress within the current BAND, rendered as a `▰▰▱▱` pip
	 *  run to the RIGHT of the stage/intent word. `total` is the number
	 *  of phases in the band; `index` is the current phase (`0..total-1`,
	 *  or `total` when the band is fully done). `null` = no bar.
	 *
	 *  Three bands, each with its own phase list:
	 *   - pre-stage  (intent setup): studio → mode → stage → verify
	 *   - in-stage   (a stage active): elaborate → review → execute → approve
	 *   - post-stage (intent completion): intent-review → reflect → seal */
	phaseTrack: { index: number; total: number } | null
	/** Per-item hat-progress bars for the live pool, rendered as a SECOND
	 *  line below the main line. During `execute`: one entry per in-flight
	 *  unit. During `fixloop`: one entry per open feedback. Each entry's
	 *  `id` is the prefixed item label (`U-03`, `FB-012`); `segments` is one
	 *  status per hat in the item's sequence, derived from that hat's most
	 *  recent iteration outcome: `done` (advanced — green), `active` (open,
	 *  in progress — yellow), `rejected` (last result was a reject — red),
	 *  `pending` (not reached — faint empty). So the bar shows true per-hat
	 *  state, including a bounce-back. Absent/null/empty for every other
	 *  phase (and an idle pool) → no second line. Capped at the concurrency
	 *  limit by the caller so the line can't overflow. During `fixloop` each
	 *  entry also carries `severity` (the FB's classified urgency, or null
	 *  when unclassified) — rendered as a leading colored glyph and used by
	 *  the caller to order the bars highest-first, mirroring fix-loop
	 *  dispatch. */
	itemBars?: Array<{
		id: string
		segments: HatSegment[]
		severity?: "blocker" | "high" | "medium" | "low" | null
	}> | null
	/** Per-agent status chips for the SECOND line during the await phases
	 *  (pre-execute review, post-execute approval, quality gates, the
	 *  intent-completion review). One chip per known review/approval role
	 *  we're waiting on a stamp from, colored by `status`: `done` = stamped
	 *  (green), `active` = currently being awaited (light), `pending` =
	 *  queued (grey), `failed` = a failure signal (red). Mutually exclusive
	 *  with `itemBars` — a phase is either dispatching work (bars) or
	 *  awaiting sign-offs (chips). Null/empty → no agent chips. */
	agentChips?: Array<{
		id: string
		status: "done" | "active" | "pending" | "failed"
	}> | null
}

// ── glyphs ───────────────────────────────────────────────────────────
const HEX_DONE = "⬢"
const HEX_ACTIVE = "⬣"
const HEX_PENDING = "⬡"
const WORDMARK = "H·AI·K·U"
const BRAND = "⬢"
const FLOW = "❯"
const GATED = "⊘"
const DOT = "·"
const PIP_DONE = "▰"
const PIP_PENDING = "▱"
// Leader for the second (per-item pool) line.
const ITEM_LEADER = "↳"
// A pip palette = one foreground per hat-segment state. The DEFAULT palette
// reads on the near-white unit chip; each severity box (below) overrides it
// so pips always contrast against their tint. The active pip is the tricky
// one — a warm pip vanishes on a warm tint, so the warm boxes flip it to
// blue and the cool boxes keep amber. pending is dark enough that the empty
// `▱` outline shows on every box.
type PipPalette = Record<HatSegment, string>
const SEG_FG: PipPalette = {
	done: "\x1b[38;5;71m", // green = hat advanced
	active: "\x1b[1;38;5;166m", // amber = hat in progress (reads on near-white)
	rejected: "\x1b[1;38;5;167m", // soft red = hat last rejected
	pending: "\x1b[38;5;244m", // grey = not reached (darker than the box, so the outline shows)
}
// Dark-grey pending pip for the colored severity boxes — reads on the warm
// tints + lavender where the lighter near-white grey (244) would wash.
const SEV_PEND = "\x1b[38;5;240m"
// Agent-status chip palette (the await-phase second line). Pastel solid
// boxes — `bg`/`fg` paint the box body, `mark` is the NO_COLOR-legible
// status glyph appended to the role name (so status survives when bg is
// stripped). Pastel fills with dark text keep contrast high without the
// harshness of saturated bg blocks.
const AGENT_CHIP: Record<
	"done" | "active" | "pending" | "failed",
	{ bg: string; fg: string; mark: string }
> = {
	done: { bg: "\x1b[48;5;151m", fg: "\x1b[1;38;5;22m", mark: " ✓" }, // pastel green = stamped
	active: { bg: "\x1b[48;5;254m", fg: "\x1b[1;38;5;238m", mark: " ▸" }, // near-white = being awaited
	pending: { bg: "\x1b[48;5;248m", fg: "\x1b[38;5;240m", mark: "" }, // soft grey = queued
	failed: { bg: "\x1b[48;5;217m", fg: "\x1b[1;38;5;124m", mark: " ✗" }, // pastel red = failure signal
}
// Feedback-severity tint for the fix-loop bars — the chip BOX itself is
// lightly colored by urgency (saves the 2 chars a leading dot would cost),
// graded warm: light red → orange → gold for blocker/high/medium, the plain
// near-white baseline for low, and a cool lavender for not-yet-classified.
// The dark bold label (C.chipLabel) stays legible on every tint. `mark` is
// the NO_COLOR-legible prefix so severity still survives when escape codes
// are stripped (no bg to carry it then). Mirrors the SPA's feedback-status
// palette family (red/orange/gold) so terminal and SPA agree at a glance.
const SEVERITY_CHIP: Record<
	"blocker" | "high" | "medium" | "low",
	{ bg: string; mark: string; pips: PipPalette }
> = {
	// Warm boxes: dark-green done, BLUE active (a warm pip would vanish on a
	// warm tint), very-dark-red rejected, dark-grey pending.
	blocker: {
		bg: "\x1b[48;5;210m", // red (deeper — 224 read too faint)
		mark: "!",
		pips: {
			done: "\x1b[1;38;5;22m",
			active: "\x1b[1;38;5;27m",
			rejected: "\x1b[1;38;5;52m",
			pending: SEV_PEND,
		},
	},
	high: {
		bg: "\x1b[48;5;216m", // light orange
		mark: "^",
		pips: {
			done: "\x1b[1;38;5;22m",
			active: "\x1b[1;38;5;27m",
			rejected: "\x1b[1;38;5;88m",
			pending: SEV_PEND,
		},
	},
	medium: {
		bg: "\x1b[48;5;223m", // light gold
		mark: "~",
		pips: {
			done: "\x1b[1;38;5;22m",
			active: "\x1b[1;38;5;27m",
			rejected: "\x1b[1;38;5;88m",
			pending: SEV_PEND,
		},
	},
	// near-white baseline — same box + pips as the default unit chip.
	low: { bg: "\x1b[48;5;254m", mark: ".", pips: SEG_FG },
}
// Cool lavender box: dark-green done, amber active (warm pip pops on the
// cool tint), dark-red rejected, dark-grey pending.
const SEVERITY_UNCLASSIFIED = {
	bg: "\x1b[48;5;189m",
	mark: "?",
	pips: {
		done: "\x1b[1;38;5;28m",
		active: "\x1b[1;38;5;130m",
		rejected: "\x1b[1;38;5;124m",
		pending: SEV_PEND,
	} as PipPalette,
}

// Combining long stroke overlay — fakes a strikethrough per-character for
// the no-color path (where ANSI SGR 9 is stripped). Color mode uses real
// ANSI strikethrough (C.strike) instead; this keeps the "struck" semantic
// alive when escape codes aren't.
const combiningStrike = (s: string): string =>
	Array.from(s)
		.map((ch) => `${ch}\u0336`)
		.join("")

// ── 256-color codes ──────────────────────────────────────────────────
const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	strike: "\x1b[9m", // crossed-out (struck actual position in a fix-loop)
	brand: "\x1b[38;5;43m", // teal (brand anchor)
	intent: "\x1b[1;38;5;255m", // bright white bold
	done: "\x1b[38;5;71m", // green
	active: "\x1b[38;5;214m", // amber
	pending: "\x1b[38;5;243m", // dim grey
	dim: "\x1b[38;5;240m", // delimiter grey
	pipDone: "\x1b[38;5;255m", // white (completed phase pips, pre-active)
	stage: "\x1b[38;5;38m", // cyan
	// phase hues
	elaborate: "\x1b[38;5;245m", // grey
	execute: "\x1b[38;5;39m", // blue
	review: "\x1b[38;5;220m", // yellow
	approve: "\x1b[38;5;220m", // yellow
	fixloop: "\x1b[38;5;208m", // orange
	gate: "\x1b[38;5;170m", // magenta
	complete: "\x1b[38;5;71m", // green
	sealed: "\x1b[38;5;71m", // green
	blocked: "\x1b[38;5;203m", // red
	setup: "\x1b[38;5;245m", // grey (intent-level setup phases)
	// second-line item "chip" (a bg box per unit/feedback). Set the bg
	// once per chip and switch FG (not bg) per pip, resetting only at the
	// chip's end — a per-pip C.reset would clear the bg mid-box.
	chipBg: "\x1b[48;5;254m", // pastel near-white box fill
	chipLabel: "\x1b[1;38;5;238m", // dark bold label on the light box
	chipPending: "\x1b[38;5;250m", // faint empty pip on the light box
} as const

function phaseColor(kind: StatuslinePhaseKind, gated: boolean): string {
	if (gated) return C.gate
	return C[kind] ?? C.execute
}

/** Render the status line. When `color` is false (or NO_COLOR is set),
 *  emit the same glyphs with no escape codes. */
export function renderStatusline(
	state: StatuslineState,
	opts: { color?: boolean } = {},
): string {
	const color = opts.color ?? !process.env.NO_COLOR
	const paint = (code: string, s: string) =>
		color ? `${code}${s}${C.reset}` : s

	// ── group 1: wordmark + brand glyph + intent ──
	// `H·AI·K·U` is the fixed letterhead; the `⬢` is the live anchor that
	// carries the eye to the state. Both in brand teal so they read as
	// one mark.
	const wordmark = paint(C.brand, WORDMARK)
	const brand = paint(C.brand, BRAND)
	const intent = paint(C.intent, state.intent)

	// ── studio tag (dim) ──
	const studio = state.studio ? paint(C.dim, state.studio) : ""

	const phaseHue = phaseColor(state.phaseKind, state.gated)

	// ── phase bar: `▰▰▱▱` over the current band's phases ──
	// Pips before the current phase are done (white filled), the current
	// pip is phase-hued, later pips are pending (dimmer empty); when the
	// band is fully done (index === total) every pip is filled. Rendered
	// to the RIGHT of the stage/intent word (below), not between hexes,
	// so the hexagon pipeline stays clean.
	const phaseBar =
		state.phaseTrack === null
			? ""
			: Array.from({ length: state.phaseTrack.total }, (_, i) => {
					const idx = (state.phaseTrack as { index: number }).index
					if (i < idx) return paint(C.pipDone, PIP_DONE)
					if (i === idx) return paint(phaseHue, PIP_DONE)
					return paint(C.pending, PIP_PENDING)
				}).join("")

	// ── group 2: pipeline + stage/intent + phase bar + flow + phase ──
	const dots = state.stages
		.map((s) => {
			if (s.status === "done") return paint(C.done, HEX_DONE)
			if (s.status === "active") {
				// The active hexagon carries the PHASE hue so the active dot
				// and the phase word read as one signal.
				return paint(phaseHue, HEX_ACTIVE)
			}
			return paint(C.pending, HEX_PENDING)
		})
		.join("")
	// Scope label in the stage slot. A stage-scoped line names the stage
	// (`development`); an intent-level line (setup phases, intent review,
	// sealing — no active stage) names the scope `intent`, so the
	// structure stays uniform: `<pipeline> <scope> <bar> ❯ <phase>`.
	const stageName = state.activeStage
		? paint(C.stage, state.activeStage)
		: paint(C.stage, "intent")
	const flowGlyph = state.gated ? GATED : FLOW
	const flow = paint(state.gated ? C.gate : C.dim, flowGlyph)
	// In a fix-loop the phase WORD reads "fix-loop", but the stage is
	// really parked mid-walk at some review/approval milestone. Surface
	// that actual position struck-through, immediately left of the
	// "fix-loop" word, so the line shows both WHERE we are and WHY we're
	// stalled: `❯ a̶p̶p̶r̶o̶v̶a̶l̶ ̶g̶a̶t̶e̶ fix-loop`. Color mode uses real ANSI
	// strikethrough; no-color falls back to per-char combining strokes.
	const phaseWord = paint(phaseHue, state.phaseLabel)
	const struck =
		state.phaseKind === "fixloop" && state.actualPhase
			? color
				? `${C.dim}${C.strike}${state.actualPhase}${C.reset}`
				: combiningStrike(state.actualPhase)
			: ""
	const phase = struck ? `${struck} ${phaseWord}` : phaseWord
	const where = [dots, stageName, phaseBar, flow, phase]
		.filter(Boolean)
		.join(" ")

	// ── group 3: aggregate ──
	const aggregate = state.aggregate
		? paint(state.phaseKind === "blocked" ? C.blocked : C.dim, state.aggregate)
		: ""

	// ── assemble with dim microdot group delimiters ──
	// who · [studio] · where · how-much
	const delim = paint(C.dim, DOT)
	const groups = [`${wordmark} ${brand} ${intent}`]
	if (studio) groups.push(studio)
	groups.push(where)
	if (aggregate) groups.push(aggregate)
	const mainLine = groups.join(` ${delim} `)

	// ── second line: per-item hat-progress "chips" for the live pool ──
	// One chip per in-flight unit (execute) or open feedback (fix-loop):
	// `↳ ▏ U-01 ▰▰▱▱▱ ▏ ▏ U-02 ▰▱▱▱▱ ▏` / `▏ FB-012 ▰▰▱ ▏`. Each `id`
	// already carries its `U-`/`FB-` prefix (built in state.ts). Same pip
	// language as the phase bar — hats before the current are done (white
	// ▰), the current hat is phase-hued (▰), later hats pending (dim ▱) —
	// so a chip fills left-to-right as the item walks its hats, and a
	// fix-loop bounce visibly shrinks it.
	//
	// In COLOR mode each chip is a dark-grey background box: set the bg
	// once, switch only the FG per pip, and reset at the chip's end (a
	// per-pip reset would clear the box mid-way). NO_COLOR has no bg, so we
	// fall back to plain `U-01 ▰▰▱▱▱` separated by double spaces.
	// A unit/feedback chip: a solid pastel box whose pip bar colors each
	// hat by its real status — green done, amber active, red rejected,
	// faint pending. NO_COLOR drops the bg/color and renders any non-pending
	// hat as a filled pip, pending as empty (`U-01 ▰▰▱▱▱`).
	const barChip = (it: {
		id: string
		segments: HatSegment[]
		severity?: "blocker" | "high" | "medium" | "low" | null
	}): string => {
		// Resolve the chip's box + pip palette from severity. `undefined` = a
		// unit bar (default near-white box, default pips); `null` = an
		// unclassified FB (lavender box / `?` mark); a value = the urgency-
		// tinted box. The box carries severity in color mode (no leading dot);
		// the NO_COLOR path keeps the `mark` prefix since there's no bg to tint.
		// Pips come from the resolved box's palette so they contrast on the tint.
		const sev = !(it.severity !== undefined)
			? null
			: it.severity
				? SEVERITY_CHIP[it.severity]
				: SEVERITY_UNCLASSIFIED
		const pal = sev ? sev.pips : SEG_FG
		if (!color) {
			const bar = it.segments
				.map((s) => (s === "pending" ? PIP_PENDING : PIP_DONE))
				.join("")
			const mark = sev ? `${sev.mark} ` : ""
			return `${mark}${it.id} ${bar}`
		}
		const pips = it.segments
			.map((s) => `${pal[s]}${s === "pending" ? PIP_PENDING : PIP_DONE}`)
			.join("")
		const chipBg = sev ? sev.bg : C.chipBg
		return `${chipBg} ${C.chipLabel}${it.id} ${pips} ${C.reset}`
	}

	// An agent chip: a solid pastel status box (no bar). The box color IS
	// the status — pastel green stamped, near-white being-awaited, grey
	// queued, pastel red failed. NO_COLOR keeps the status legible via the
	// `mark` glyph appended to the role name.
	const agentChip = (a: {
		id: string
		status: "done" | "active" | "pending" | "failed"
	}): string => {
		const st = AGENT_CHIP[a.status] ?? AGENT_CHIP.pending
		if (!color) return `${a.id}${st.mark}`
		return `${st.bg}${st.fg} ${a.id}${st.mark} ${C.reset}`
	}

	// Second line: dispatch-phase work bars OR await-phase agent chips
	// (mutually exclusive). Neither → no second line.
	const sep = color ? " " : "  "
	let second = ""
	if (state.itemBars && state.itemBars.length > 0) {
		second = state.itemBars.map(barChip).join(sep)
	} else if (state.agentChips && state.agentChips.length > 0) {
		second = state.agentChips.map(agentChip).join(sep)
	}
	if (!second) return mainLine
	return `${mainLine}\n${paint(C.dim, ITEM_LEADER)} ${second}`
}
