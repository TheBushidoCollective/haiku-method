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
	return groups.join(` ${delim} `)
}
