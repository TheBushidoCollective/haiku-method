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
import { resolveIntentStages, resolveStageHats } from "../orchestrator/studio.js"
import {
	type CursorAction,
	derivePosition,
	findCurrentStage,
	isStageComplete,
} from "../orchestrator/workflow/cursor.js"
import { deriveProgressTrack } from "../orchestrator/workflow/progress-track.js"
import { findHaikuRoot, intentDir, parseFrontmatter } from "../state-tools.js"
import type {
	StatuslinePhaseKind,
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

	// The stage the action targets (its own `stage`, or the first
	// dispatch's stage for a feedback batch). Empty for intent-scope
	// actions (intent_review, intent-scope fix-loop, seal). Fall back to
	// the Track-A current stage for actions that don't carry one.
	const actStage =
		actionStage(action) || findCurrentStage(slug, studio, iDir) || ""

	// Build the pipeline: done = isStageComplete, active = the action's
	// stage, pending = the rest. When the action is intent-scope (no
	// stage), there's no active dot — every stage shows its completion
	// state, and the phase word carries what's happening (fix-loop /
	// intent review / sealed).
	let sawActive = false
	const stages = stageList.map((name) => {
		if (actStage && name === actStage) {
			sawActive = true
			return { name, status: "active" as const }
		}
		if (!sawActive && isStageComplete(iDir, studio, name, mode)) {
			return { name, status: "done" as const }
		}
		return { name, status: "pending" as const }
	})
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
	try {
		const track = deriveProgressTrack({
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
	}
}
