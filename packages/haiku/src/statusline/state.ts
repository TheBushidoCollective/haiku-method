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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
	resolveIntentStages,
	resolveStageFixHats,
	resolveStageHats,
	resolveStudioFixHats,
} from "../orchestrator/studio.js"
import {
	type CursorAction,
	derivePosition,
	findCurrentStage,
	isStageComplete,
} from "../orchestrator/workflow/cursor.js"
import { deriveProgressTrack } from "../orchestrator/workflow/progress-track.js"
import {
	findHaikuRoot,
	intentDir,
	MAX_CONCURRENT_SUBAGENTS,
	parseFrontmatter,
} from "../state-tools.js"
import type {
	HatSegment,
	StatuslinePhaseKind,
	StatuslineStageDot,
	StatuslineState,
} from "./render.js"

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
 *   2. Exactly one non-sealed, non-archived intent → that one.
 *   3. Most-recently-modified non-sealed intent (by intent.md mtime).
 *  Returns null when no live intent exists. */
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
	if (live.length === 0) return null
	if (live.length === 1) return live[0]

	// Most-recently-touched intent.md wins.
	let best = live[0]
	let bestMtime = 0
	for (const slug of live) {
		try {
			const mtime = statSync(join(intentsDir, slug, "intent.md")).mtimeMs
			if (mtime > bestMtime) {
				bestMtime = mtime
				best = slug
			}
		} catch {
			/* skip */
		}
	}
	return best
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
		case "dispatch_review":
			return { kind: "review", label: `${shortRole(action.role)} review`, gated: false }
		case "dispatch_approval":
			return {
				kind: "approve",
				label: `${shortRole(action.role)} approval`,
				gated: false,
			}
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
		case "intent_review":
			return { kind: "review", label: `${shortRole(action.role)} review`, gated: false }
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
	slug: string,
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

type ItemBar = { id: string; segments: HatSegment[] }
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
	if (key === "intent-quality-gates" || role === "quality_gates") return "quality"
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
	if (iters.length === 0) {
		segs[0] = "active"
		return segs
	}
	const last = iters[iters.length - 1]
	const lastIdx =
		typeof last.hat === "string" ? hats.indexOf(last.hat) : -1
	if (last.result === null || last.result === undefined) {
		// Defensive: an open iteration (engine writes one in some flows) —
		// that hat is the active one.
		if (lastIdx >= 0) segs[lastIdx] = "active"
	} else if (typeof last.result === "string" && ADVANCE_RESULTS.has(last.result)) {
		const next = lastIdx + 1
		if (next >= 0 && next < hats.length && segs[next] === "pending") {
			segs[next] = "active"
		}
	}
	// reject: the rejecting hat stays `rejected` (red); no separate active.
	return segs
}

/** One progress bar per IN-FLIGHT unit on a stage (started, not yet
 *  through its last hat). `index` is the current hat's position in the
 *  stage's hat sequence; `total` the sequence length. Completed and
 *  not-yet-started units are excluded — the second line shows the LIVE
 *  pool, not the whole roster. */
function unitBars(
	studio: string,
	stage: string,
	iDir: string,
): ItemBar[] {
	const unitsDir = join(iDir, "stages", stage, "units")
	if (!existsSync(unitsDir)) return []
	const hats = resolveStageHats(studio, stage)
	if (hats.length === 0) return []
	const lastHat = hats[hats.length - 1]
	const out: ItemBar[] = []
	for (const f of readdirSync(unitsDir)
		.filter((n) => n.endsWith(".md"))
		.sort()) {
		const fm = readFm(join(unitsDir, f))
		if (!fm) continue
		const started =
			typeof fm.started_at === "string" && (fm.started_at as string).length > 0
		if (!started) continue
		const iters = Array.isArray(fm.iterations)
			? (fm.iterations as Array<Record<string, unknown>>)
			: []
		const last = iters[iters.length - 1]
		const complete =
			!!last && last.result === "advance" && last.hat === lastHat
		if (complete) continue
		out.push({ id: `U-${fileNumber(f)}`, segments: hatSegments(iters, hats) })
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
			(typeof fm.closed_at === "string" && (fm.closed_at as string).length > 0) ||
			fm.status === "closed"
		const rejected =
			(typeof fm.rejected_at === "string" &&
				(fm.rejected_at as string).length > 0) ||
			fm.status === "rejected"
		if (closed || rejected) continue
		const iters = Array.isArray(fm.iterations)
			? (fm.iterations as Array<Record<string, unknown>>)
			: []
		out.push({ id: `FB-${fileNumber(f)}`, segments: hatSegments(iters, fixHats) })
	}
	return out
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

	// The cursor's action is the AUTHORITATIVE position — it considers
	// Track A (per-stage units), Track B (open feedback, which can rewind
	// to an earlier stage), Track C (drift), and the intent-completion
	// walk. Drive the status line from it, NOT from `findCurrentStage`
	// alone: `findCurrentStage` is Track-A-only, so an intent whose stage
	// units all look complete but which has open feedback (or is in
	// intent-completion review) would otherwise read as "sealed" when
	// it's really fix-looping. Reported 2026-05-19 — a churning intent
	// with a wedged intent-scope FB displayed `sealed`.
	let action: CursorAction | null = null
	try {
		action = derivePosition({ slug, intentDir: iDir, studio }).action
	} catch {
		action = null
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
		})
		if (track.total > 0) {
			phaseTrack = { index: track.index, total: track.total }
			if (kind === "fixloop") {
				actualPhase = track.steps[track.index]?.label ?? ""
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
		const bars = unitBars(studio, activeStage, iDir)
		if (bars.length > 0) itemBars = bars.slice(0, MAX_CONCURRENT_SUBAGENTS)
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
		if (bars.length > 0) itemBars = bars.slice(0, MAX_CONCURRENT_SUBAGENTS)
	}

	// Agent chips (second line) for the await phases — the known review /
	// approval roles we're waiting on a stamp from. Reuse the progress
	// track (single source of truth with the cursor) and surface every
	// role in the SAME bucket as the active step: stamped → green,
	// currently-awaited → light, queued → grey. (No `failed`/red is
	// emitted: the engine has no per-role failure stamp — a failed review
	// files feedback and flips to the fix-loop, which the FB bars show.)
	let agentChips: AgentChip[] | null = null
	if (track && (kind === "review" || kind === "approve" || kind === "gate")) {
		const activeKey = track.steps[track.index]?.key ?? ""
		let inBucket: ((k: string) => boolean) | null = null
		if (activeKey.startsWith("review:") || activeKey.startsWith("intent-review:")) {
			inBucket = (k) =>
				k.startsWith("review:") || k.startsWith("intent-review:")
		} else if (
			activeKey.startsWith("approve:") ||
			activeKey === "intent-quality-gates"
		) {
			inBucket = (k) =>
				k.startsWith("approve:") || k === "intent-quality-gates"
		}
		if (inBucket) {
			const chips = track.steps
				.filter((s) => inBucket(s.key))
				.map((s) => ({ id: chipRole(s.key), status: s.status }))
			if (chips.length > 0) agentChips = chips
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
