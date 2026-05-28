// orchestrator/workflow/progress-track.ts — Granular cursor-action
// progress for diagnostic surfaces (the status line).
//
// The coarse `DerivedStagePhase` (elaborate|execute|review|gate) is too
// blunt to show real progress: a stage with five review roles and six
// approval roles collapses to one "review" pip and one "gate" pip. This
// module enumerates the ORDERED cursor-action milestones the engine
// actually walks — the elaborate loop, each pre-execute review role,
// execute, each post-execute approval role, observations — plus the
// intent-level review/reflect/seal tail, and marks each done / active /
// pending from the SAME on-disk signals the cursor reads.
//
// Source-of-truth discipline: the role lists come from `stageRoleLists`
// (the exact lists `derivePosition` walks) and the elaborate done-check
// from `computeElaborateSignals`. If the cursor's walk changes, this
// track moves with it — no parallel role math to drift.

import { existsSync } from "node:fs"
import { join } from "node:path"
import {
	buildStageMilestones,
	finalizeSteps,
	type ProgressStep,
	type StepStatus,
} from "@haiku/shared"
import { readStudioReviewAgentPaths } from "../../studio-reader.js"
import { resolveStageHats } from "../studio.js"
import {
	computeElaborateSignals,
	findCurrentStage,
	intentReviewRoles,
	isReflectionEnabled,
	listUnitPaths,
	readFm,
	stageRoleLists,
	unitName,
} from "./cursor.js"

// Milestone order, labels, and the done→active→pending finalize are owned
// by `@haiku/shared` (`buildStageMilestones`) so this disk-driven track and
// the website browse UI's VCS-driven track can't drift. This module's job
// is to GATHER the done-flags from the cursor's on-disk signals and hand
// them to the shared builder.
export type { ProgressStep, StepStatus }

export interface ProgressTrack {
	scope: "stage" | "intent"
	steps: ProgressStep[]
	/** Index of the active (first not-done) step, or `steps.length` when
	 *  every step is done. Drives the status-line pip bar. */
	index: number
	total: number
}

type Fm = Record<string, unknown>

// ── Action → milestone index (shared by the status line AND the SPA) ──
// The track's `index` is the first NOT-done milestone from on-disk stamps,
// which LAGS the live cursor action (a stamp lands a tick after the action
// fires — so an intent at the approval gate can still read "spec review"
// from stamps alone). Both surfaces must instead place the active milestone
// from the LIVE action, or the status line and the SPA's phase strip
// disagree (reported 2026-05-26: status line "approval gate" vs SPA "spec
// review"). This is the single shared mapper; callers pass the action they
// got from `derivePosition` and fall back to the track index only when the
// action carries no stage milestone.
type MilestoneAction = {
	kind?: string
	role?: string
	gate_kind?: string
	dispatches?: unknown[]
}

/** Roles that run one-at-a-time (no parallel fan-out): the spec gate, the
 *  mechanical quality-gate runner, the human gate. */
const SINGLE_ACTOR_ROLES = new Set(["spec", "quality_gates", "user"])
export const rawRoleOf = (key: string): string =>
	key.includes(":") ? key.slice(key.indexOf(":") + 1) : key

/** True when the dispatched action is a PARALLEL fan-out — more than one
 *  agent runs at once (a multi-dispatch batch, or a single non-single-actor
 *  role). */
export function actionIsFanOut(action: MilestoneAction | null): boolean {
	if (!action) return false
	if (Array.isArray(action.dispatches) && action.dispatches.length > 1) {
		return true
	}
	const role = action.role
	return (
		typeof role === "string" && role.length > 0 && !SINGLE_ACTOR_ROLES.has(role)
	)
}

export { SINGLE_ACTOR_ROLES }

/** Locate the milestone index the DISPATCHED action sits at, within the
 *  given (grouped) milestone steps. Returns -1 for actions with no stage
 *  milestone (the caller falls back to the track index). */
export function snapshotMilestoneIndex(
	action: MilestoneAction | null,
	steps: ReadonlyArray<{ key: string }>,
): number {
	if (!action) return -1
	const k = action.kind as string
	const role = action.role
	const gateKind = action.gate_kind
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
			const i = find((key) => key === "approve:quality_gates")
			return i >= 0 ? i : find((key) => key === "intent-quality-gates")
		}
		case "user_gate":
			return gateKind === "approval"
				? find((key) => key === "approve:user")
				: find((key) => key === "review:user")
		case "write_brief":
			return find((key) => key === "review:user")
		case "intent_review":
			if (role === "user") return find((key) => key === "intent-review:user")
			return adversarial
				? find((key) => key.startsWith("intent-review:adversarial"))
				: find((key) => key === `intent-review:${role ?? "spec"}`)
		case "record_reflection":
			return find((key) => key === "reflection")
		case "seal_intent":
		case "pending_seal":
		case "sealed":
			return find((key) => key === "seal")
		default:
			return -1
	}
}

function reviewsOf(fm: Fm): Record<string, unknown> {
	const r = fm.reviews
	return r && typeof r === "object" ? (r as Record<string, unknown>) : {}
}
function approvalsOf(fm: Fm): Record<string, unknown> {
	const a = fm.approvals
	return a && typeof a === "object" ? (a as Record<string, unknown>) : {}
}
function itersOf(fm: Fm): Array<Record<string, unknown>> {
	return Array.isArray(fm.iterations)
		? (fm.iterations as Array<Record<string, unknown>>)
		: []
}

/** Build the ordered stage milestone list with each marked done. Pass
 *  `groupAdversarial: false` to expand each parallel reviewer into its own
 *  step (the status line's per-agent second line); the default groups them
 *  into one `(signed/total)` pip for the compact bar + SPA surfaces. */
function stageSteps(opts: {
	slug: string
	studio: string
	stage: string
	stageDir: string
	mode: string
	groupAdversarial?: boolean
}): ProgressStep[] {
	const { slug, studio, stage, stageDir, mode, groupAdversarial = true } = opts
	const unitPaths = listUnitPaths(stageDir)
	const units = unitPaths
		.map((p) => ({ name: unitName(p), fm: (readFm(p)?.data ?? {}) as Fm }))
		.filter((u) => u.fm)
	const unitNames = units.map((u) => u.name)
	const hats = resolveStageHats(studio, stage)
	const { reviewRoles, approvalRoles } = stageRoleLists(studio, stage, mode)

	// 1. Elaborate loop — done when no unmet signals.
	const elaborateDone =
		computeElaborateSignals({ slug, studio, stage, stageDir, unitNames, mode })
			.length === 0

	const allUnitsStamped = (bucket: "reviews" | "approvals", role: string) =>
		units.length > 0 &&
		units.every((u) =>
			Boolean(
				(bucket === "reviews" ? reviewsOf(u.fm) : approvalsOf(u.fm))[role],
			),
		)

	// 2. Execute — done when every unit is past its terminal hat.
	const executeDone =
		units.length > 0 &&
		(hats.length === 0 ||
			units.every((u) => {
				const its = itersOf(u.fm)
				if (its.length === 0) return false
				const last = its[its.length - 1]
				return last.result === "advance" && last.hat === hats[hats.length - 1]
			}))

	// 3. Observations — only when reflection is enabled for the intent.
	const observationsDone = isReflectionEnabled(join(stageDir, "..", ".."))
		? existsSync(join(stageDir, "observations.md"))
		: null

	// Order + labels + finalize are owned by the shared builder; we just
	// supply the done-flags gathered above.
	return buildStageMilestones({
		elaborateDone,
		reviewRoles: reviewRoles.map((role) => ({
			role,
			stamped: allUnitsStamped("reviews", role),
		})),
		executeDone,
		approvalRoles: approvalRoles.map((role) => ({
			role,
			stamped: allUnitsStamped("approvals", role),
		})),
		observationsDone,
		groupAdversarial,
	})
}

/** Build the intent-level tail (after every stage completes): per-role
 *  intent-completion review, reflection, seal. */
function intentSteps(opts: {
	intentDir: string
	mode: string
	/** Group the adversarial intent-review roles into ONE `adversarial
	 *  review` pip (the compact track) instead of one pip per agent. `spec`
	 *  and the `user` gate stay serial. Mirrors the per-stage walk; matches
	 *  the parallel `intent_review` dispatch the cursor now emits. Default
	 *  true; `deriveProgressRoleSteps` passes false to keep the per-agent
	 *  chip row. */
	groupAdversarial?: boolean
}): ProgressStep[] {
	const { intentDir, mode, groupAdversarial = true } = opts
	const steps: { key: string; label: string; done: boolean }[] = []
	const intentFm = (readFm(join(intentDir, "intent.md"))?.data ?? {}) as Fm
	// Intent-completion sign-offs stamp `approvals.<role>` on intent.md
	// (the cursor reads pickApprovals there), NOT `reviews.*`.
	const intentApprovals = approvalsOf(intentFm)

	// 1. Per-role intent-completion review, in cursor order. Studio
	// intent-review agents must mirror the cursor's walk
	// (`walkIntentTrack`) or the progress UI drifts from what actually
	// runs — pass the same `intent-review-agents/` set the cursor reads.
	const intentStudio = (intentFm.studio as string) || ""
	const intentStudioAgents = intentStudio
		? Object.keys(readStudioReviewAgentPaths(intentStudio)).sort()
		: []
	// `spec` (serial conformance) and `user` (the gate) dispatch alone; every
	// other intent-review role is an adversarial fan-out agent.
	const isSerialIntentRole = (role: string) =>
		role === "spec" || role === "user"
	let pendingAdv: string[] = []
	const flushAdv = () => {
		if (pendingAdv.length === 0) return
		const signed = pendingAdv.filter((r) => Boolean(intentApprovals[r])).length
		steps.push({
			key: "intent-review:adversarial:0",
			label:
				pendingAdv.length > 1
					? `adversarial review (${signed}/${pendingAdv.length})`
					: "adversarial review",
			done: pendingAdv.every((r) => Boolean(intentApprovals[r])),
		})
		pendingAdv = []
	}
	for (const role of intentReviewRoles(mode, intentStudioAgents)) {
		if (groupAdversarial && !isSerialIntentRole(role)) {
			pendingAdv.push(role)
			continue
		}
		flushAdv() // serial role — close any open adversarial group first
		steps.push({
			key: `intent-review:${role}`,
			label: role === "user" ? "intent gate" : `${role} review`,
			done: Boolean(intentApprovals[role]),
		})
	}
	flushAdv()
	// 2. Intent-scope quality gates (union of every unit's gates).
	steps.push({
		key: "intent-quality-gates",
		label: "quality gates",
		done: Boolean(intentApprovals.intent_quality_gates),
	})
	// 3. Reflection — only when enabled.
	if (isReflectionEnabled(intentDir)) {
		steps.push({
			key: "reflection",
			label: "reflection",
			done: existsSync(join(intentDir, "reflection.md")),
		})
	}
	// 4. Seal — done once the intent is sealed.
	steps.push({
		key: "seal",
		label: "seal",
		done: intentFm.sealed_at != null,
	})
	return finalizeSteps(steps)
}

/** Derive the granular progress track for an intent's current scope —
 *  the active stage's milestones, or the intent-level tail when every
 *  stage is complete. */
export function deriveProgressTrack(opts: {
	slug: string
	studio: string
	intentDir: string
	intentMode: string
	/** Pin the track to a specific stage instead of the live current one.
	 *  The status line passes the SNAPSHOT's stage so the pip track matches
	 *  the displayed phase label — without this, the pips derive from a live
	 *  `findCurrentStage` that can be a different stage/scope than the label,
	 *  so their indices don't correspond (reported 2026-05-26: spec approval
	 *  / adversarial review appearing before execute). `""` = intent scope;
	 *  omitted = resolve the live current stage (the original behavior). */
	stage?: string
}): ProgressTrack {
	const { slug, studio, intentDir, intentMode, stage } = opts
	const activeStage =
		stage !== undefined ? stage : findCurrentStage(slug, studio, intentDir)
	const steps = activeStage
		? stageSteps({
				slug,
				studio,
				stage: activeStage,
				stageDir: join(intentDir, "stages", activeStage),
				mode: intentMode,
			})
		: intentSteps({ intentDir, mode: intentMode })
	const firstPending = steps.findIndex((s) => s.status !== "done")
	return {
		scope: activeStage ? "stage" : "intent",
		steps,
		index: firstPending === -1 ? steps.length : firstPending,
		total: steps.length,
	}
}

/** The active scope's milestone steps with each parallel reviewer kept as
 *  its OWN step (no `adversarial (n/m)` collapse). The status line's second
 *  line maps these to one chip per reviewing/approving agent — the compact
 *  pip bar (`deriveProgressTrack`) stays grouped. Returns the intent-tail
 *  steps verbatim when every stage is done (that tail is already per-role),
 *  so a single call covers both scopes. */
export function deriveProgressRoleSteps(opts: {
	slug: string
	studio: string
	intentDir: string
	intentMode: string
	/** Pin to a specific stage (the status line passes the snapshot's stage
	 *  so the chips match the label + pip track). `""` = intent scope;
	 *  omitted = resolve the live current stage. See `deriveProgressTrack`. */
	stage?: string
}): ProgressStep[] {
	const { slug, studio, intentDir, intentMode, stage } = opts
	const activeStage =
		stage !== undefined ? stage : findCurrentStage(slug, studio, intentDir)
	// Ungrouped: one step per agent so the chip row shows each reviewer.
	if (!activeStage)
		return intentSteps({ intentDir, mode: intentMode, groupAdversarial: false })
	return stageSteps({
		slug,
		studio,
		stage: activeStage,
		stageDir: join(intentDir, "stages", activeStage),
		mode: intentMode,
		groupAdversarial: false,
	})
}

/** Derive the granular milestone track for a SPECIFIC stage (not just the
 *  cursor's active one). The milestone LIST (order + labels) is studio-config
 *  driven via `stageSteps`, so it's correct for any stage regardless of which
 *  branch's unit FM is on disk; the per-step done-flags may be stale for an
 *  already-merged stage (unit FM frozen at fork), but callers that render a
 *  completed stage force every pip done from the stage status. Used by the
 *  review session payload so the SPA shows the SAME fine-grained stepper on
 *  every stage, not only the active one. */
export function deriveStageMilestones(opts: {
	slug: string
	studio: string
	intentDir: string
	stage: string
	mode: string
}): ProgressStep[] {
	return stageSteps({
		slug: opts.slug,
		studio: opts.studio,
		stage: opts.stage,
		stageDir: join(opts.intentDir, "stages", opts.stage),
		mode: opts.mode,
	})
}
