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

export type StepStatus = "done" | "active" | "pending"

export interface ProgressStep {
	/** Stable key, e.g. `review:spec`, `execute`, `approve:quality_gates`. */
	key: string
	/** Human label for the phase word, e.g. "spec review", "quality gates". */
	label: string
	status: StepStatus
}

export interface ProgressTrack {
	scope: "stage" | "intent"
	steps: ProgressStep[]
	/** Index of the active (first not-done) step, or `steps.length` when
	 *  every step is done. Drives the status-line pip bar. */
	index: number
	total: number
}

type Fm = Record<string, unknown>

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

/** Label a review role for the phase word. Engine + agent roles read as
 *  "<role> review"; the human `user` gate reads as "spec gate" (it gates
 *  the pre-execute spec). */
function reviewLabel(role: string): string {
	if (role === "user") return "spec gate"
	if (role === "cross-stage-consistency") return "cross-stage review"
	return `${role} review`
}

/** Label an approval role. `quality_gates` and the human `user` gate get
 *  their own words; everything else reads as "<role> approval". */
function approvalLabel(role: string): string {
	if (role === "user") return "approval gate"
	if (role === "quality_gates") return "quality gates"
	if (role === "cross-stage-consistency") return "cross-stage approval"
	return `${role} approval`
}

/** Build the ordered stage milestone list with each marked done. */
function stageSteps(opts: {
	slug: string
	studio: string
	stage: string
	stageDir: string
	mode: string
}): ProgressStep[] {
	const { slug, studio, stage, stageDir, mode } = opts
	const unitPaths = listUnitPaths(stageDir)
	const units = unitPaths
		.map((p) => ({ name: unitName(p), fm: (readFm(p)?.data ?? {}) as Fm }))
		.filter((u) => u.fm)
	const unitNames = units.map((u) => u.name)
	const hats = resolveStageHats(studio, stage)
	const { reviewRoles, approvalRoles } = stageRoleLists(studio, stage, mode)

	const steps: { key: string; label: string; done: boolean }[] = []

	// 1. Elaborate loop — one milestone; done when no unmet signals.
	const elaborateDone =
		computeElaborateSignals({ slug, studio, stage, stageDir, unitNames, mode })
			.length === 0
	steps.push({ key: "elaborate", label: "elaborate", done: elaborateDone })

	const allUnitsStamped = (bucket: "reviews" | "approvals", role: string) =>
		units.length > 0 &&
		units.every((u) =>
			Boolean(
				(bucket === "reviews" ? reviewsOf(u.fm) : approvalsOf(u.fm))[role],
			),
		)

	// 2. Pre-execute review roles, in cursor order.
	for (const role of reviewRoles) {
		steps.push({
			key: `review:${role}`,
			label: reviewLabel(role),
			done: elaborateDone && allUnitsStamped("reviews", role),
		})
	}

	// 3. Execute — done when every unit is past its terminal hat.
	const executeDone =
		units.length > 0 &&
		(hats.length === 0 ||
			units.every((u) => {
				const its = itersOf(u.fm)
				if (its.length === 0) return false
				const last = its[its.length - 1]
				return (
					last.result === "advance" && last.hat === hats[hats.length - 1]
				)
			}))
	steps.push({ key: "execute", label: "execute", done: executeDone })

	// 4. Post-execute approval roles, in cursor order.
	for (const role of approvalRoles) {
		steps.push({
			key: `approve:${role}`,
			label: approvalLabel(role),
			done: executeDone && allUnitsStamped("approvals", role),
		})
	}

	// 5. Observations — only when reflection is enabled.
	if (isReflectionEnabled(join(stageDir, "..", ".."))) {
		steps.push({
			key: "observations",
			label: "observations",
			done: existsSync(join(stageDir, "observations.md")),
		})
	}

	return finalize(steps)
}

/** Build the intent-level tail (after every stage completes): per-role
 *  intent-completion review, reflection, seal. */
function intentSteps(opts: {
	intentDir: string
	mode: string
}): ProgressStep[] {
	const { intentDir, mode } = opts
	const steps: { key: string; label: string; done: boolean }[] = []
	const intentFm = (readFm(join(intentDir, "intent.md"))?.data ?? {}) as Fm
	// Intent-completion sign-offs stamp `approvals.<role>` on intent.md
	// (the cursor reads pickApprovals there), NOT `reviews.*`.
	const intentApprovals = approvalsOf(intentFm)

	// 1. Per-role intent-completion review, in cursor order.
	for (const role of intentReviewRoles(mode)) {
		steps.push({
			key: `intent-review:${role}`,
			label: role === "user" ? "intent gate" : `${role} review`,
			done: Boolean(intentApprovals[role]),
		})
	}
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
	return finalize(steps)
}

/** Convert the done-flagged list into status-marked steps: every done
 *  step is `done`, the first not-done is `active`, the rest `pending`. */
function finalize(
	raw: { key: string; label: string; done: boolean }[],
): ProgressStep[] {
	let activeAssigned = false
	return raw.map((s) => {
		if (s.done) return { key: s.key, label: s.label, status: "done" as const }
		if (!activeAssigned) {
			activeAssigned = true
			return { key: s.key, label: s.label, status: "active" as const }
		}
		return { key: s.key, label: s.label, status: "pending" as const }
	})
}

/** Derive the granular progress track for an intent's current scope —
 *  the active stage's milestones, or the intent-level tail when every
 *  stage is complete. */
export function deriveProgressTrack(opts: {
	slug: string
	studio: string
	intentDir: string
	intentMode: string
}): ProgressTrack {
	const { slug, studio, intentDir, intentMode } = opts
	const activeStage = findCurrentStage(slug, studio, intentDir)
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
