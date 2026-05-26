// statusline/state.ts — resolve the current project's active-intent
// state into the shape the renderer consumes. Returns null when there's
// nothing haiku-shaped to show (no `.haiku/`, no active intent, sealed
// intent, composite intent) — the CLI treats null as "fall back to the
// user's original status line".
//
// Assumes the caller has already `process.chdir`'d into the project dir
// (the CLI does this from the status-line stdin payload), so all the
// engine's cwd-relative resolution (`findHaikuRoot`, `intentDir`,
// `derivePosition`) operates on the right tree.

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import {
	resolveIntentStages,
	resolveStageFixHats,
	resolveStageHats,
	resolveStudioFixHats,
} from "../orchestrator/studio.js"
import {
	computeUnitWaves,
	currentWaveNumber,
	listUnits,
} from "../orchestrator/units.js"
import {
	type CursorAction,
	derivePosition,
	findCurrentStage,
	isStageComplete,
} from "../orchestrator/workflow/cursor.js"
import {
	deriveProgressRoleSteps,
	deriveProgressTrack,
} from "../orchestrator/workflow/progress-track.js"
import {
	type FeedbackSeverity,
	feedbackSeverityRank,
} from "../state/schemas/index.js"
import {
	findHaikuRoot,
	intentDir,
	MAX_CONCURRENT_SUBAGENTS,
	parseFrontmatter,
} from "../state-tools.js"
import { readStageArtifactDefs } from "../studio-reader.js"
import type {
	HatSegment,
	StatuslinePhaseKind,
	StatuslineStageDot,
	StatuslineState,
} from "./render.js"
import { readStatuslineSnapshot } from "./snapshot.js"

function readFm(path: string): Record<string, unknown> | null {
	if (!existsSync(path)) return null
	try {
		return parseFrontmatter(readFileSync(path, "utf8")).data
	} catch {
		return null
	}
}

/** Best-effort current git branch (empty string when not a repo). */
function currentBranch(): string {
	try {
		return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim()
	} catch {
		return ""
	}
}

/** Pick the active intent slug for the current tree. Priority:
 *   1. Git branch `haiku/<slug>/<...>` → that slug (the branch IS the
 *      "which intent am I on" signal).
 *   2. Exactly one non-sealed, non-archived intent → that one (unambiguous;
 *      a fresh project with a single intent shows it even before the first
 *      stage branch is checked out).
 *  Returns null when no live intent exists, OR when there are multiple live
 *  intents and the branch names none of them. We deliberately do NOT guess
 *  "most-recently-modified" here: on a non-intent branch (a feature/refactor
 *  branch, `main`, etc.) with several live intents in the tree there is no
 *  signal for which one you're working, and guessing commandeers the status
 *  line for an intent you aren't on (reported 2026-05-20 — the line showed on
 *  `refactor/…` because it picked the most-recently-touched intent.md). */
function pickActiveIntent(haikuRoot: string): string | null {
	const intentsDir = join(haikuRoot, "intents")
	if (!existsSync(intentsDir)) return null

	const branch = currentBranch()
	const m = branch.match(/^haiku\/(.+?)\/[^/]+$/)
	if (m?.[1]) {
		const slug = m[1]
		if (existsSync(join(intentsDir, slug, "intent.md"))) return slug
	}

	let slugs: string[]
	try {
		slugs = readdirSync(intentsDir).filter((d) => {
			try {
				return statSync(join(intentsDir, d)).isDirectory()
			} catch {
				return false
			}
		})
	} catch {
		return null
	}

	const live = slugs.filter((slug) => {
		const fm = readFm(join(intentsDir, slug, "intent.md"))
		if (!fm) return false
		if (fm.archived === true) return false
		if (typeof fm.sealed_at === "string" && fm.sealed_at.length > 0)
			return false
		return true
	})
	if (live.length === 1) return live[0]

	// 0 live intents, or >1 with no branch naming one → no signal. Returning
	// null lets the CLI fall back to the user's original status line instead
	// of pinning an arbitrary intent the user isn't actually working.
	return null
}

/** The stage a cursor action targets, or "" for intent-scope actions. */
function actionStage(action: CursorAction | null): string {
	if (!action) return ""
	const a = action as unknown as {
		stage?: unknown
		dispatches?: Array<{ stage?: unknown }>
	}
	if (typeof a.stage === "string" && a.stage.length > 0) return a.stage
	if (Array.isArray(a.dispatches) && a.dispatches.length > 0) {
		const s = a.dispatches[0]?.stage
		if (typeof s === "string" && s.length > 0) return s
	}
	return ""
}

/** Intent-completion cursor kinds — the actions the engine emits ONLY
 *  after every stage has merged. A fix-loop is deliberately excluded: an
 *  intent-scope finding can be filed mid-intent (e.g. from the SPA) while
 *  stages are still active, so it does NOT imply completion. */
const INTENT_COMPLETION_KINDS = new Set([
	"intent_review",
	"record_reflection",
	"seal_intent",
	"sealed",
])

/** True when the cursor action is intent-scope AND signals the intent is
 *  past every stage. The status line renders an all-done pipeline for
 *  these instead of falling back to `findCurrentStage`, which on the
 *  merged main branch mis-reports the first stage as active (the
 *  "●○○○○○ inception … continuity review" contradiction, 2026-05-20).
 *  Exported for unit testing the decision in isolation. */
export function isPastAllStages(action: CursorAction | null): boolean {
	return (
		!!action &&
		actionStage(action) === "" &&
		INTENT_COMPLETION_KINDS.has(action.kind)
	)
}

/** Compact a review/approval role for the one-line phase word.
 *  `cross-stage-consistency` is too long to sit in the status line. */
function shortRole(role: string): string {
	if (role === "cross-stage-consistency") return "cross-stage"
	return role
}

/** Map a cursor action to a (phaseKind, label, gated) display triple. */
function describeAction(action: CursorAction | null): {
	kind: StatuslinePhaseKind
	label: string
	gated: boolean
} {
	if (!action) return { kind: "execute", label: "working", gated: false }
	// Engine self-maintenance actions the agent isn't driving. These are
	// OrchestratorAction kinds the tick dispatches into the snapshot — NOT
	// members of the CursorAction union, so they're matched by string before
	// the typed switch (which would otherwise drop them to "working"). They
	// render as "recovering" (cyan, not gated) so the user sees the engine is
	// merging / repairing — not stuck on an opaque "spec error" or "working".
	switch (action.kind as string) {
		case "integrate_fix_chains":
			return { kind: "recovering", label: "resolving conflicts", gated: false }
		case "safe_intent_repair":
			return { kind: "recovering", label: "recovering", gated: false }
		case "upstream_reconciliation_required":
			return { kind: "recovering", label: "merging upstream", gated: false }
	}
	switch (action.kind) {
		case "elaborate_loop":
			return { kind: "elaborate", label: "elaborate", gated: false }
		case "start_unit_hat":
			return { kind: "execute", label: "execute", gated: false }
		case "start_feedback_hat":
		case "close_feedback":
			return { kind: "fixloop", label: "fix-loop", gated: false }
		case "feedback_question":
			return { kind: "fixloop", label: "question", gated: true }
		case "dispatch_review": {
			const dispatches = (action as { dispatches?: unknown[] }).dispatches
			const label =
				dispatches && dispatches.length > 1
					? "adversarial review"
					: `${shortRole(action.role)} review`
			return { kind: "review", label, gated: false }
		}
		case "dispatch_approval": {
			const dispatches = (action as { dispatches?: unknown[] }).dispatches
			const label =
				dispatches && dispatches.length > 1
					? "adversarial approval"
					: `${shortRole(action.role)} approval`
			return { kind: "approve", label, gated: false }
		}
		case "write_brief":
			return { kind: "review", label: "writing brief", gated: false }
		case "dispatch_quality_gates":
			return { kind: "approve", label: "quality gates", gated: false }
		case "user_gate":
			return {
				kind: "gate",
				label: `${action.gate_kind} gate`,
				gated: true,
			}
		case "complete_stage":
			return { kind: "complete", label: "complete", gated: false }
		case "record_observations":
			return { kind: "complete", label: "observations", gated: false }
		case "intent_review": {
			// The terminal human gate.
			if (action.role === "user")
				return { kind: "gate", label: "intent gate", gated: true }
			// The adversarial fan-out dispatches many roles in one tick — show
			// the GROUP name ("adversarial review"), not each agent, just like
			// the per-stage walk. A single-role dispatch (spec) keeps its name.
			const dispatches = (action as { dispatches?: unknown[] }).dispatches
			return {
				kind: "review",
				label:
					Array.isArray(dispatches) && dispatches.length > 1
						? "adversarial review"
						: `${shortRole(action.role)} review`,
				gated: false,
			}
		}
		case "record_reflection":
			return { kind: "complete", label: "reflection", gated: false }
		case "seal_intent":
		case "sealed":
			return { kind: "sealed", label: "sealed", gated: false }
		case "unit_inputs_not_declared":
		case "unit_outputs_empty_iterations":
			return { kind: "blocked", label: "spec error", gated: true }
		default:
			return { kind: "execute", label: "working", gated: false }
	}
}

/** Count units on a stage that have completed their full hat sequence
 *  (last iteration is a terminal `advance` on the stage's last hat). */
function unitProgress(
	_slug: string,
	studio: string,
	stage: string,
	iDir: string,
): { done: number; total: number } {
	const unitsDir = join(iDir, "stages", stage, "units")
	if (!existsSync(unitsDir)) return { done: 0, total: 0 }
	const hats = resolveStageHats(studio, stage)
	const lastHat = hats[hats.length - 1] ?? ""
	let done = 0
	let total = 0
	for (const f of readdirSync(unitsDir).filter((n) => n.endsWith(".md"))) {
		const fm = readFm(join(unitsDir, f))
		if (!fm) continue
		total++
		const iters = Array.isArray(fm.iterations)
			? (fm.iterations as Array<Record<string, unknown>>)
			: []
		const last = iters[iters.length - 1]
		if (last && last.result === "advance" && last.hat === lastHat) done++
	}
	return { done, total }
}

/** Count feedback on a scope: closed vs total (open + closed). */
function feedbackProgress(
	iDir: string,
	stage: string,
): { closed: number; total: number } {
	const dir = stage
		? join(iDir, "stages", stage, "feedback")
		: join(iDir, "feedback")
	if (!existsSync(dir)) return { closed: 0, total: 0 }
	let closed = 0
	let total = 0
	for (const f of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
		const fm = readFm(join(dir, f))
		if (!fm) continue
		total++
		const isClosed =
			(typeof fm.closed_at === "string" && fm.closed_at.length > 0) ||
			(typeof fm.status === "string" && fm.status === "closed")
		const isRejected =
			(typeof fm.rejected_at === "string" && fm.rejected_at.length > 0) ||
			(typeof fm.status === "string" && fm.status === "rejected")
		if (isClosed || isRejected) closed++
	}
	return { closed, total }
}

type ItemBar = {
	id: string
	segments: HatSegment[]
	/** Feedback severity (fix-loop bars only); null = unclassified (the
	 *  classifier hasn't ranked it yet). Drives the leading severity glyph
	 *  and the highest-first bar order, mirroring fix-loop dispatch. */
	severity?: FeedbackSeverity | null
}
type AgentChip = {
	id: string
	status: "done" | "active" | "pending" | "failed"
}

/** Numeric tag of a unit/feedback file: `unit-03-foo.md` → "03",
 *  `012-bar.md` → "012". Empty when there's no leading number. */
function fileNumber(name: string): string {
	const m = name.match(/^(?:unit-)?(\d+)/)
	return m?.[1] ?? ""
}

/** Short agent-chip label for a progress-track step key:
 *  `review:spec` → "spec", `intent-review:cross-stage-consistency` →
 *  "cross-stage", `intent-quality-gates` / `approve:quality_gates` →
 *  "quality", any `*:user` gate → "gate". */
function chipRole(key: string): string {
	const role = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key
	if (role === "cross-stage-consistency") return "cross-stage"
	if (key === "intent-quality-gates" || role === "quality_gates")
		return "quality"
	if (role === "user") return "gate"
	return role
}

const ADVANCE_RESULTS = new Set(["advance", "advanced", "closed"])
const REJECT_RESULTS = new Set(["reject", "rejected"])

/** Per-hat status segments for a unit/feedback bar, over a hat sequence.
 *  Iterations are only written when a hat COMPLETES (advance/reject) —
 *  there is no open/in-progress entry on disk — so the ACTIVE hat is the
 *  one after the last completed iteration, not the last iteration itself.
 *
 *  Each hat's base status comes from its MOST RECENT iteration result:
 *  advance/advanced/closed → done (green), reject/rejected → rejected
 *  (red, stays red while it retries), none → pending. Then the single
 *  active hat (yellow) is derived: after an advance, the next hat in the
 *  sequence is up; after a reject, the rejecting hat keeps its red (the
 *  retry isn't a separate active slot); before any iteration, the first
 *  hat is up. (If an open `result: null` entry ever appears, that hat is
 *  the active one — handled defensively.) */
export function hatSegments(
	iters: Array<Record<string, unknown>>,
	hats: string[],
	started = true,
): HatSegment[] {
	const recent = new Map<string, unknown>()
	for (const it of iters) {
		if (typeof it.hat === "string") recent.set(it.hat, it.result)
	}
	const segs: HatSegment[] = hats.map((h) => {
		const r = recent.get(h)
		if (r === undefined) return "pending"
		if (typeof r === "string" && ADVANCE_RESULTS.has(r)) return "done"
		if (typeof r === "string" && REJECT_RESULTS.has(r)) return "rejected"
		return "pending"
	})
	if (hats.length === 0) return segs
	// Not started yet (queued, never dispatched) → empty progress, no
	// in-progress indicator. Caller passes `started=false` when there's no
	// dispatch signal (e.g. a feedback with zero iterations is queued, not
	// mid-fix). An in-flight item carries an open `result:null` iteration
	// instead, handled below.
	if (!started) return segs
	if (iters.length === 0) {
		segs[0] = "active"
		return segs
	}
	const last = iters[iters.length - 1]
	const lastIdx = typeof last.hat === "string" ? hats.indexOf(last.hat) : -1
	if (last.result === null || last.result === undefined) {
		// Defensive: an open iteration (engine writes one in some flows) —
		// that hat is the active one.
		if (lastIdx >= 0) segs[lastIdx] = "active"
	} else if (
		typeof last.result === "string" &&
		ADVANCE_RESULTS.has(last.result)
	) {
		const next = lastIdx + 1
		if (next >= 0 && next < hats.length && segs[next] === "pending") {
			segs[next] = "active"
		}
	}
	// reject: the rejecting hat stays `rejected` (red); no separate active.
	return segs
}

/** One progress bar per unit in the CURRENT WAVE — the concurrent batch the
 *  cursor is running (units at the active dependency level). Every wave
 *  member is shown with its real status: completed (all done), in-flight
 *  (active hat), or not-yet-started (empty progress) — so the second line is
 *  the whole wave, not just the units that happen to be mid-flight. Wave
 *  membership reuses the cursor's own wave computation, so it matches the
 *  real pool and the `wave N/M` aggregate. */
function unitBars(studio: string, stage: string, iDir: string): ItemBar[] {
	const unitsDir = join(iDir, "stages", stage, "units")
	if (!existsSync(unitsDir)) return []
	const hats = resolveStageHats(studio, stage)
	if (hats.length === 0) return []
	let waveUnits: Set<string>
	try {
		const wUnits = listUnits(iDir, stage)
		const { unitWave, totalWaves } = computeUnitWaves(wUnits)
		const cur = currentWaveNumber(wUnits, unitWave, totalWaves)
		waveUnits = new Set(
			wUnits
				.filter((u) => (unitWave.get(u.name) ?? 0) === cur)
				.map((u) => u.name),
		)
	} catch {
		return [] // best-effort — never let a wave-calc error blank the line
	}
	if (waveUnits.size === 0) return []
	const out: ItemBar[] = []
	for (const f of readdirSync(unitsDir)
		.filter((n) => n.endsWith(".md"))
		.sort()) {
		if (!waveUnits.has(f.replace(/\.md$/, ""))) continue
		const fm = readFm(join(unitsDir, f))
		if (!fm) continue
		const iters = Array.isArray(fm.iterations)
			? (fm.iterations as Array<Record<string, unknown>>)
			: []
		// Started = started_at stamped OR any iteration recorded. An unstarted
		// wave member shows empty progress (hatSegments `started=false`); an
		// in-flight one shows its active hat; a completed one shows all done.
		const started =
			(typeof fm.started_at === "string" &&
				(fm.started_at as string).length > 0) ||
			iters.length > 0
		out.push({
			id: `U-${fileNumber(f)}`,
			segments: hatSegments(iters, hats, started),
		})
	}
	return out
}

/** One progress bar per OPEN feedback in a directory, walked over the
 *  given fix-hat sequence. Closed/rejected FBs are excluded. A
 *  zero-iteration (queued) FB reads as an empty bar; a dispatched one
 *  fills to its current fix-hat. */
function feedbackBars(dir: string, fixHats: string[]): ItemBar[] {
	if (!existsSync(dir) || fixHats.length === 0) return []
	const out: ItemBar[] = []
	for (const f of readdirSync(dir)
		.filter((n) => n.endsWith(".md"))
		.sort()) {
		const fm = readFm(join(dir, f))
		if (!fm) continue
		const closed =
			(typeof fm.closed_at === "string" &&
				(fm.closed_at as string).length > 0) ||
			fm.status === "closed"
		const rejected =
			(typeof fm.rejected_at === "string" &&
				(fm.rejected_at as string).length > 0) ||
			fm.status === "rejected"
		if (closed || rejected) continue
		const iters = Array.isArray(fm.iterations)
			? (fm.iterations as Array<Record<string, unknown>>)
			: []
		const severity =
			typeof fm.severity === "string" ? (fm.severity as FeedbackSeverity) : null
		// An FB is "started" iff it carries iterations — there's no separate
		// started_at on feedback (deriveFeedbackStatus: iterations[] non-empty
		// → "fixing"). A zero-iteration FB is queued, so it shows empty
		// progress (no in-progress pip) until the fix loop dispatches it.
		out.push({
			id: `FB-${fileNumber(f)}`,
			segments: hatSegments(iters, fixHats, iters.length > 0),
			severity,
		})
	}
	return out
}

/** Roles that run one-at-a-time (no parallel fan-out): the spec gate, the
 *  mechanical quality-gate runner, the human gate. They get no chip row —
 *  it would just restate the phase label. */
const SINGLE_ACTOR_ROLES = new Set(["spec", "quality_gates", "user"])
const rawRoleOf = (key: string): string =>
	key.includes(":") ? key.slice(key.indexOf(":") + 1) : key

/** True when the dispatched action is a PARALLEL fan-out — more than one
 *  agent runs at once, so its per-agent chip row carries information. A
 *  multi-dispatch batch (`dispatches.length > 1`) or a single non-single-
 *  actor role both qualify. */
export function actionIsFanOut(action: CursorAction | null): boolean {
	if (!action) return false
	const dispatches = (action as { dispatches?: unknown[] }).dispatches
	if (Array.isArray(dispatches) && dispatches.length > 1) return true
	const role = (action as { role?: string }).role
	return (
		typeof role === "string" && role.length > 0 && !SINGLE_ACTOR_ROLES.has(role)
	)
}

/** Locate the milestone index the DISPATCHED action sits at, within the
 *  given (grouped) milestone steps. The phase label is read from this same
 *  snapshot action, so deriving the pip done/active boundary from it — rather
 *  than from a live re-derive of the unit frontmatter — keeps the pips, the
 *  label, and the chips on ONE clock. Returns -1 for actions with no stage
 *  milestone (the caller falls back to the live track index). */
export function snapshotMilestoneIndex(
	action: CursorAction | null,
	steps: ReadonlyArray<{ key: string }>,
): number {
	if (!action) return -1
	const k = action.kind as string
	const role = (action as { role?: string }).role
	const gateKind = (action as { gate_kind?: string }).gate_kind
	const adversarial = actionIsFanOut(action)
	const find = (pred: (key: string) => boolean) =>
		steps.findIndex((s) => pred(s.key))
	switch (k) {
		case "elaborate_loop":
			return find((key) => key === "elaborate")
		case "dispatch_review":
			return adversarial
				? find((key) => key.startsWith("review:adversarial"))
				: find((key) => key === `review:${role ?? "spec"}`)
		case "start_unit_hat":
		case "start_units":
		case "execute":
		case "continue_unit":
		case "continue_units":
			return find((key) => key === "execute")
		case "dispatch_approval":
			return adversarial
				? find((key) => key.startsWith("approve:adversarial"))
				: find((key) => key === `approve:${role ?? "spec"}`)
		case "dispatch_quality_gates": {
			// Stage scope → `approve:quality_gates`; intent scope → the intent
			// track's `intent-quality-gates`.
			const i = find((key) => key === "approve:quality_gates")
			return i >= 0 ? i : find((key) => key === "intent-quality-gates")
		}
		case "user_gate":
			return gateKind === "approval"
				? find((key) => key === "approve:user")
				: find((key) => key === "review:user")
		case "write_brief":
			// The brief is written just before the review user gate.
			return find((key) => key === "review:user")
		case "intent_review":
			// Intent-completion review (intent track). `spec` and the `user`
			// gate are their own pips; the adversarial fan-out is ONE grouped
			// `intent-review:adversarial` pip (matches the "adversarial review"
			// label + the parallel dispatch).
			if (role === "user") return find((key) => key === "intent-review:user")
			return adversarial
				? find((key) => key.startsWith("intent-review:adversarial"))
				: find((key) => key === `intent-review:${role ?? "spec"}`)
		case "record_reflection":
			return find((key) => key === "reflection")
		case "seal_intent":
		case "sealed":
			return find((key) => key === "seal")
		default:
			return -1
	}
}

/** Resolve the current project's status-line state, or null when there
 *  is nothing haiku-shaped to show (caller falls back to the OG line). */
export function resolveStatuslineState(): StatuslineState | null {
	let haikuRoot: string
	try {
		haikuRoot = findHaikuRoot()
	} catch {
		return null // no .haiku/ in this tree
	}

	const slug = pickActiveIntent(haikuRoot)
	if (!slug) return null

	const iDir = intentDir(slug)
	const intentFm = readFm(join(iDir, "intent.md"))
	if (!intentFm) return null
	if (intentFm.composite) return null // composite intents aren't single-walk
	const studio = typeof intentFm.studio === "string" ? intentFm.studio : ""

	// ── intent-level SETUP phases (precede any stage walk) ──
	// These mirror the pre-cursor selection gates in run-tick.ts. The
	// pipeline can't render yet (stages aren't resolvable), so we show the
	// intent + (studio, once known) + the setup phase word.
	// Pre-stage band: studio → mode → stage → verify (4 phases). Each
	// setup state carries its own bar index over that band.
	const setupState = (phaseLabel: string, idx: number): StatuslineState => ({
		intent: slug,
		studio,
		stages: [],
		activeStage: "",
		phaseLabel,
		phaseKind: "setup",
		gated: false,
		aggregate: "",
		phaseTrack: { index: idx, total: 4 },
	})
	if (!studio) return setupState("select studio", 0)

	const modeRaw =
		typeof intentFm.mode === "string" && intentFm.mode.length > 0
			? intentFm.mode
			: ""
	if (!modeRaw) return setupState("select mode", 1)
	const mode = modeRaw

	const stageList = resolveIntentStages(intentFm, studio)
	if (stageList.length === 0) {
		// quick mode with no stage chosen yet → select stage; any other
		// empty-stages case is a misconfig we can't render a pipeline for.
		if (mode === "quick") return setupState("select stage", 2)
		return null
	}

	// Sealed intent. We only get here for one on its OWN branch —
	// `pickActiveIntent`'s `haiku/<slug>/…` branch match bypasses the
	// sealed filter so the line keeps showing while you're parked on the
	// finished work. A sealed intent is complete by definition, so render
	// an all-done pipeline + the "sealed" word directly. Do NOT run it
	// through the `findCurrentStage`/`isStageComplete` derivation below:
	// on the merged main branch those mis-report the FIRST stage as active
	// and the rest pending, which is what produced the contradiction
	// reported 2026-05-20 ("⬣⬡⬡⬡⬡⬡ inception … sealed" on a finished
	// intent — active stage AND sealed at once).
	if (
		typeof intentFm.sealed_at === "string" &&
		(intentFm.sealed_at as string).length > 0
	) {
		return {
			intent: slug,
			studio,
			stages: stageList.map((name) => ({ name, status: "done" as const })),
			activeStage: "",
			phaseLabel: "sealed",
			phaseKind: "sealed",
			gated: false,
			aggregate: "",
			phaseTrack: null,
			itemBars: null,
			agentChips: null,
		}
	}

	// POSITION = the action the engine last DISPATCHED, read from the
	// persisted snapshot the tick writes (`broadcastTick` →
	// `writeStatuslineSnapshot`). This reflects what the agent is actually
	// doing, not what a fresh cursor walk predicts next — the status line
	// runs out-of-band, so a live derive would jump ahead the moment a tool
	// changed disk state (e.g. a review agent files feedback → "fix-loop"
	// before the agent picks it up). The per-hat/unit BARS below are still
	// read live, so progress within a phase stays dynamic; only the
	// position is frozen until the next tick.
	//
	// Cold start (no snapshot — fresh project, or before the first tick of
	// a restarted agent): fall back to a live derive. The next tick writes
	// the snapshot and pins the position from then on.
	let action: CursorAction | null = null
	const snapshot = readStatuslineSnapshot(slug)
	if (snapshot?.action) {
		action = snapshot.action as CursorAction
	} else {
		try {
			action = derivePosition({ slug, intentDir: iDir, studio }).action
		} catch {
			action = null
		}
	}

	// Pre-intent substance verify: the cursor emits `elaborate_loop` with
	// NO stage before the first stage walk. That's an intent-level setup
	// phase, not a stage's elaborate — label it accordingly.
	if (action && action.kind === "elaborate_loop" && !actionStage(action)) {
		return setupState("verifying intent", 3)
	}

	const { kind, label, gated } = describeAction(action)

	// Is this an INTENT-SCOPE action — one the cursor only emits AFTER every
	// stage has merged (intent-completion review, reflection, seal) or an
	// intent-scope fix-loop on an intent-level finding? Those carry no
	// stage. They mean "past all stages", so the pipeline is fully done.
	// We must NOT fall back to `findCurrentStage` for them: on the merged
	// main branch it reads the FIRST stage as still-incomplete and reports
	// it active, producing the contradiction reported 2026-05-20 — an
	// intent in intent-completion `continuity review` rendering
	// `●○○○○○ inception` instead of an all-done pipeline.
	const pastAllStages = isPastAllStages(action)

	// The stage the action targets (its own `stage`, or the first
	// dispatch's stage for a feedback batch). Fall back to the Track-A
	// current stage only for stage-scoped actions that don't carry one.
	const actStage = pastAllStages
		? ""
		: actionStage(action) || findCurrentStage(slug, studio, iDir) || ""

	// Build the pipeline. Intent-scope (past all stages) → every stage
	// done, no active dot; the phase word carries what's happening (intent
	// review / reflection / intent-scope fix-loop). Otherwise: done =
	// isStageComplete up to the active stage, active = the action's stage,
	// pending = the rest.
	let stages: StatuslineStageDot[]
	if (pastAllStages) {
		stages = stageList.map((name) => ({ name, status: "done" as const }))
	} else {
		let sawActive = false
		stages = stageList.map((name) => {
			if (actStage && name === actStage) {
				sawActive = true
				return { name, status: "active" as const }
			}
			if (!sawActive && isStageComplete(iDir, studio, name, mode)) {
				return { name, status: "done" as const }
			}
			return { name, status: "pending" as const }
		})
	}
	const activeStage = actStage

	// Aggregate counter, phase-appropriate.
	let aggregate = ""
	if (kind === "execute" && activeStage) {
		const { done, total } = unitProgress(slug, studio, activeStage, iDir)
		if (total > 0) aggregate = `${done}/${total} units`
		// Append the current wave when the stage runs in more than one — the
		// units execute in dependency waves (the cursor's barrier), so
		// "7/12 units · wave 2/4" tells you which wave is in flight. Reuses the
		// cursor's own wave computation so the numbers match the real pool, not
		// a parallel reinvention. Single-wave stages omit it (no signal).
		try {
			const wUnits = listUnits(iDir, activeStage)
			if (wUnits.length > 0) {
				const { unitWave, totalWaves } = computeUnitWaves(wUnits)
				if (totalWaves > 1) {
					const cur = currentWaveNumber(wUnits, unitWave, totalWaves)
					aggregate = `${aggregate || `${total} units`} · wave ${cur + 1}/${totalWaves}`
				}
			}
		} catch {
			/* best-effort — never let the wave annotation break the line */
		}
	} else if (kind === "fixloop") {
		// Show OPEN findings remaining, not `closed/total`. A fix-loop
		// always has ≥1 open finding by definition, so `0/1 closed` would
		// read as "no progress" while the chain is actively churning the
		// fix — unfair. `N open` is the actionable count (work left) and
		// decrements as findings close. The FB the cursor dispatches may be
		// stage- or intent-scope, so sum both scopes.
		const stageFb = activeStage
			? feedbackProgress(iDir, activeStage)
			: { closed: 0, total: 0 }
		const intentFb = feedbackProgress(iDir, "")
		const total = stageFb.total + intentFb.total
		const closed = stageFb.closed + intentFb.closed
		const open = total - closed
		if (open > 0) aggregate = `${open} open`
		else if (total > 0) aggregate = "closing"
	} else if (
		(kind === "review" || kind === "approve" || kind === "gate") &&
		activeStage
	) {
		const { total } = unitProgress(slug, studio, activeStage, iDir)
		if (total > 0) aggregate = `${total} units`
	} else if (kind === "elaborate") {
		aggregate = "decomposing"
	}

	// Phase bar = the GRANULAR cursor-action track for the current scope.
	//
	// `deriveProgressTrack` enumerates the ordered milestones the engine
	// actually walks — elaborate loop, each pre-execute review role,
	// execute, each post-execute approval role, observations (stage
	// scope); or per-role intent-completion review → quality gates →
	// reflection → seal (intent scope, once every stage merges). Each is
	// marked done from the SAME on-disk signals the cursor reads, so the
	// bar tracks true progress at the granularity that actually moves —
	// not the coarse elaborate/execute/review/gate buckets, which
	// collapsed five review roles into a single pip and mis-ordered the
	// pre-execute spec review after execute.
	//
	// The position is STRUCTURAL (derived from stamps, not the live
	// action), so during a fix-loop the word reads "fix-loop" while the
	// bar still shows where the stage sits in its forward walk.
	let phaseTrack: { index: number; total: number } | null = null
	// During a fix-loop the phase word is "fix-loop", but the same track
	// the bar is built from knows the actual structural milestone the stage
	// is parked at (the first not-done step). Surface its label so the
	// renderer can show it struck-through, left of "fix-loop".
	let actualPhase = ""
	let track: ReturnType<typeof deriveProgressTrack> | null = null
	try {
		track = deriveProgressTrack({
			slug,
			studio,
			intentDir: iDir,
			intentMode: mode,
			// Pin to the SNAPSHOT's stage (the one the label describes), not a
			// live re-derive — otherwise the pips come from a different
			// stage/scope than the label and their indices don't line up
			// (execute appearing after spec approval, etc.).
			stage: actStage,
		})
		if (track.total > 0) {
			let activeIdx: number
			if (kind === "fixloop") {
				// A fix-loop interrupts the stage at the FURTHEST milestone it
				// reached — the last non-pending step — NOT the first gap. The
				// first-pending heuristic wrongly reports an early phase (e.g.
				// "spec review") for a tangled/recovered stage whose early stamps
				// were lost, even when it had actually reached quality gates. The
				// struck overlay should read "we were at <furthest> when findings
				// sent us to the fix loop."
				let furthest = -1
				for (let i = track.steps.length - 1; i >= 0; i--) {
					if (track.steps[i].status !== "pending") {
						furthest = i
						break
					}
				}
				activeIdx = furthest >= 0 ? furthest : track.index
			} else {
				// Drive the active pip from the SNAPSHOT action (the same source
				// as the phase label), not the live unit-FM done-flags. Otherwise
				// the label can say "adversarial approval" (index 5) while the live
				// stamps only reach index 2 — the pip fill then contradicts the
				// label. -1 (action has no stage milestone) → fall back to live.
				const snapIdx = snapshotMilestoneIndex(action, track.steps)
				activeIdx = snapIdx >= 0 ? snapIdx : track.index
			}
			phaseTrack = { index: activeIdx, total: track.total }
			if (kind === "fixloop") {
				actualPhase = track.steps[activeIdx]?.label ?? ""
			}
		}
	} catch {
		phaseTrack = null
		track = null
	}

	// Per-item pool bars (second line). During execute → in-flight units;
	// during fix-loop → open feedback (stage-scope under the stage's
	// fix-hats, plus any intent-scope FBs under the studio's). Capped at
	// the concurrency limit so the line tracks the real pool and can't
	// overflow. Null for every other phase (and an idle pool) → no line 2.
	let itemBars: ItemBar[] | null = null
	if (kind === "execute" && activeStage) {
		// Show the WHOLE current wave — no concurrency slice. unitBars already
		// bounds to the active dependency level (the cursor's wave), so the
		// line is the wave itself, not an arbitrary MAX_CONCURRENT cap.
		const bars = unitBars(studio, activeStage, iDir)
		if (bars.length > 0) itemBars = bars
	} else if (kind === "fixloop") {
		const bars: ItemBar[] = []
		if (activeStage) {
			bars.push(
				...feedbackBars(
					join(iDir, "stages", activeStage, "feedback"),
					resolveStageFixHats(studio, activeStage),
				),
			)
		}
		bars.push(
			...feedbackBars(join(iDir, "feedback"), resolveStudioFixHats(studio)),
		)
		// Highest-severity first across BOTH scopes — mirrors the fix-loop's
		// dispatch order (`feedbackSeverityRank`: blocker < high < medium <
		// low; unclassified ranks as medium). Stable sort keeps same-severity
		// bars in their file order.
		bars.sort(
			(a, b) =>
				feedbackSeverityRank(a.severity) - feedbackSeverityRank(b.severity),
		)
		if (bars.length > 0) itemBars = bars.slice(0, MAX_CONCURRENT_SUBAGENTS)
	}

	// Agent chips (second line) belong to ONE phase: the adversarial
	// review/approval fan-out. That's the only phase where multiple agents
	// run at once (continuity, cross-stage-consistency, the studio review
	// agents), so it's the only phase whose per-agent breakdown carries
	// information. spec, quality_gates, and the user gate are single-actor —
	// exactly one thing runs, so a chip row would just restate the phase
	// label. The pip bar already collapses the fan-out into a single
	// `(signed/total)` pip; this second line expands THAT pip into named,
	// individually-colored chips so you can see which agents have signed and
	// which we're still waiting on (stamped → green, awaited → light, queued
	// → grey). No `failed`/red: the engine has no per-role failure stamp — a
	// failed review files feedback and flips to the fix-loop (the FB bars).
	let agentChips: AgentChip[] | null = null
	// Chips belong to the PARALLEL fan-out phases — adversarial review/approval
	// (stage scope) and the intent-completion review (intent scope). Drive the
	// row off the SNAPSHOT action (the same source as the phase label), not a
	// live first-pending step: otherwise the chips key off a position the label
	// has already advanced past, so e.g. "adversarial approval" rendered an
	// empty row. `actionIsFanOut` is false for the spec / quality-gate / user
	// gates (single-actor), so those phases get no row.
	if (
		track &&
		(kind === "review" || kind === "approve") &&
		actionIsFanOut(action)
	) {
		const roleSteps = deriveProgressRoleSteps({
			slug,
			studio,
			intentDir: iDir,
			intentMode: mode,
			// Same stage as the label + pip track (the snapshot's stage).
			stage: actStage,
		})
		// Intent-completion review fans out under `intent-review:`; a stage's
		// review/approval walks fan out under `review:` / `approve:`.
		const bucketPrefix = pastAllStages
			? "intent-review:"
			: kind === "review"
				? "review:"
				: "approve:"
		const chips = roleSteps
			.filter(
				(s) =>
					s.key.startsWith(bucketPrefix) &&
					!SINGLE_ACTOR_ROLES.has(rawRoleOf(s.key)),
			)
			.map((s) => ({
				// Parallel fan-out: every not-done role is in-flight (active),
				// not queued behind the others (the serial active/pending split
				// finalizeSteps produces is wrong for a one-response spawn).
				// Stamped → done (green ✓); otherwise active (light ▸).
				id: chipRole(s.key),
				status: (s.status === "done" ? "done" : "active") as "done" | "active",
			}))
		if (chips.length > 0) agentChips = chips
	}

	// Discovery chips — one chip per REQUIRED discovery template for the
	// active stage, shown ONLY while discovery is the active sub-phase of
	// elaborate. Two gates:
	//   1. The conversation sub-phase must be DONE. While `conversation` /
	//      `verify_conversation` is still unmet, the agent is aligning with
	//      the user, not running discovery — showing the chips then made
	//      design's discovery look like it was running the instant the
	//      cursor advanced into the stage (e.g. right after the prior
	//      stage's record_observations), before any agent was dispatched
	//      (reported 2026-05-26). Autopilot has no conversation gate, so the
	//      check is naturally a no-op there. (Reliable via signals_unmet —
	//      the conversation signals, unlike non-tool discovery ones, are
	//      never skipped.)
	//   2. Per-chip status is keyed off ARTIFACT EXISTENCE on disk (NOT
	//      signals_unmet, whose non-tool discovery entries are skipped while
	//      units==0 — that had marked still-running agents ✓). Present →
	//      done; missing → active. The row shows only while ≥1 is still
	//      active; once every artifact lands, discovery is done and an all-✓
	//      row is just noise.
	const rawSignals = action
		? (action as Record<string, unknown>).signals_unmet
		: undefined
	const elabSignals: Array<{ signal?: string }> = Array.isArray(rawSignals)
		? (rawSignals as Array<{ signal?: string }>)
		: []
	const conversationPending = elabSignals.some(
		(s) => s.signal === "conversation" || s.signal === "verify_conversation",
	)
	if (
		!agentChips &&
		action &&
		(action as { kind?: string }).kind === "elaborate_loop" &&
		!conversationPending &&
		activeStage &&
		studio
	) {
		try {
			const defs = readStageArtifactDefs(studio, activeStage).filter(
				(d) => d.kind === "discovery" && d.required,
			)
			const chips: AgentChip[] = defs.map((def) => {
				const resolved = (def.location ?? "").replace(/\{intent-slug\}/g, slug)
				let exists = false
				if (resolved) {
					const absPath = join(process.cwd(), resolved)
					exists = resolved.endsWith("/")
						? existsSync(absPath) &&
							readdirSync(absPath).filter((e) => e !== ".gitkeep").length > 0
						: existsSync(absPath)
				}
				return { id: def.name, status: exists ? "done" : "active" }
			})
			if (chips.length > 0 && chips.some((c) => c.status === "active")) {
				agentChips = chips
			}
		} catch {
			/* studio/stage unreadable — skip discovery chips */
		}
	}

	return {
		intent: slug,
		studio,
		stages,
		activeStage,
		phaseLabel: label,
		phaseKind: kind,
		gated,
		aggregate,
		phaseTrack,
		actualPhase,
		itemBars,
		agentChips,
	}
}
