// orchestrator/workflow/handlers/execute.ts — Emit for the
// `execute` state.
//
// Owns the execute-phase emission chain at orchestrator.ts:3184-3340.
// Sub-cases handled:
//
//   1. Unit naming validation → unit_naming_invalid
//   2. All units complete → validateStageOutputs may surface
//      outputs_missing; otherwise advance_phase (execute → review)
//   3. Single in-flight unit → continue_unit
//   4. Multiple in-flight units → continue_units (parallel batch)
//   5. Multiple ready units in current wave → start_units (creates
//      worktrees per unit)
//   6. Single ready unit → start_unit (creates worktree)
//   7. Stuck (none active, none ready, not all complete) → blocked
//
// Side effects: createUnitWorktree per unit dispatch,
// workflowAdvancePhase on the all-complete path.

import { existsSync } from "node:fs"
import { join } from "node:path"
import { createUnitWorktree } from "../../../git-worktree.js"
import {
	computeUnitWaves,
	currentWaveNumber,
	listUnits,
	resolveStageHats,
	resolveStageMetadata,
	resolveUnitHatsInStudio,
	validateStageOutputs,
	validateUnitNaming,
	workflowAdvancePhase,
} from "../../../orchestrator.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const currentStage = ctx.currentStage
	const iDir = ctx.intentDirPath

	if (!currentStage) return null
	if (ctx.currentPhase !== "execute") return null

	const execNamingViolation = validateUnitNaming(iDir, currentStage)
	if (execNamingViolation) return execNamingViolation

	const units = listUnits(iDir, currentStage)
	const activeUnits = units.filter((u) => u.status === "active")
	const allComplete = units.every((u) => u.status === "completed")

	const { unitWave, totalWaves } = computeUnitWaves(units)
	const wave = currentWaveNumber(units, unitWave, totalWaves)

	const readyUnits = units.filter(
		(u) =>
			u.status === "pending" && u.depsComplete && unitWave.get(u.name) === wave,
	)

	if (allComplete) {
		const outputValidation = validateStageOutputs(slug, currentStage, studio)
		if (outputValidation) return outputValidation

		workflowAdvancePhase(slug, currentStage, "review")

		return {
			action: "advance_phase",
			intent: slug,
			stage: currentStage,
			from_phase: "execute",
			to_phase: "review",
			message: `All units complete — begin adversarial review of stage '${currentStage}'`,
		}
	}

	if (activeUnits.length > 0) {
		const worktreeFor = (unitName: string): string | null => {
			const p = join(process.cwd(), ".haiku", "worktrees", slug, unitName)
			return existsSync(p) ? p : null
		}

		if (activeUnits.length === 1) {
			const unit = activeUnits[0]
			const hats = resolveUnitHatsInStudio(
				studio,
				currentStage,
				slug,
				unit.name,
			)
			return {
				action: "continue_unit",
				intent: slug,
				stage: currentStage,
				unit: unit.name,
				hat: unit.hat,
				bolt: unit.bolt,
				wave: unitWave.get(unit.name) ?? wave,
				total_waves: totalWaves,
				hats,
				worktree: worktreeFor(unit.name),
				stage_metadata: resolveStageMetadata(studio, currentStage),
				message: `Continue unit '${unit.name}' — hat: ${unit.hat}, bolt: ${unit.bolt}, wave: ${unitWave.get(unit.name) ?? wave}/${totalWaves}`,
			}
		}

		const hats = resolveStageHats(studio, currentStage)
		const unitEntries = activeUnits.map((u) => ({
			name: u.name,
			hat: u.hat,
			bolt: u.bolt,
			worktree: worktreeFor(u.name),
		}))
		return {
			action: "continue_units",
			intent: slug,
			studio,
			stage: currentStage,
			wave,
			total_waves: totalWaves,
			hats,
			units: unitEntries,
			stage_metadata: resolveStageMetadata(studio, currentStage),
			message: `Continue ${activeUnits.length} units in parallel: ${activeUnits.map((u) => `${u.name}(${u.hat}#${u.bolt})`).join(", ")}`,
		}
	}

	if (readyUnits.length > 1) {
		const hats = resolveStageHats(studio, currentStage)
		const unitWorktrees: Record<string, string | null> = {}
		for (const u of readyUnits) {
			unitWorktrees[u.name] = createUnitWorktree(slug, u.name, currentStage)
		}
		return {
			action: "start_units",
			intent: slug,
			studio,
			stage: currentStage,
			wave,
			total_waves: totalWaves,
			units: readyUnits.map((u) => u.name),
			first_hat: hats[0] || "",
			hats,
			worktrees: unitWorktrees,
			stage_metadata: resolveStageMetadata(studio, currentStage),
			message: `Wave ${wave}/${totalWaves} — ${readyUnits.length} units ready for parallel execution: ${readyUnits.map((u) => u.name).join(", ")}`,
		}
	}

	if (readyUnits.length > 0) {
		const unit = readyUnits[0]
		const hats = resolveStageHats(studio, currentStage)
		const worktreePath = createUnitWorktree(slug, unit.name, currentStage)
		return {
			action: "start_unit",
			intent: slug,
			studio,
			stage: currentStage,
			wave,
			total_waves: totalWaves,
			unit: unit.name,
			first_hat: hats[0] || "",
			hats,
			worktree: worktreePath,
			stage_metadata: resolveStageMetadata(studio, currentStage),
			message: `Wave ${wave}/${totalWaves} — start unit '${unit.name}' with hat '${hats[0] || ""}' in stage '${currentStage}'`,
		}
	}

	const blockedUnits = units.filter((u) => u.status !== "completed")
	return {
		action: "blocked",
		intent: slug,
		stage: currentStage,
		wave,
		total_waves: totalWaves,
		blocked_units: blockedUnits.map((u) => u.name),
		message: `${blockedUnits.length} unit(s) blocked — dependencies not met or manual intervention needed`,
	}
}

export default emit
