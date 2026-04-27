// orchestrator/workflow/pre-tick.ts — Cross-cutting consistency check
// that runs BEFORE deriveCurrentState on every tick.
//
// The original runNext interleaved this check with phase routing —
// the check could (a) synthesize completion records for empty prior
// stages, (b) regress an execute-phase stage to elaborate when units
// lack inputs, (c) reset active_stage backwards to the first
// incomplete prior. Each of those mutations changes what the next
// derive-state call would return.
//
// To preserve that semantics under the per-state workflow handler dispatch
// (which routes by phase, not by "consistency check first"), the
// check lives here and runs as a pre-pass. If it produces a
// safe_intent_repair action, the tick short-circuits with that
// action. Otherwise the mutations land on disk and runWorkflowTick
// continues into derive-state on the now-consistent intent.

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { OrchestratorAction } from "../../orchestrator.js"
import { resolveIntentStages, resolveStudioStages } from "../../orchestrator.js"
import {
	gitCommitState,
	intentDir,
	parseFrontmatter,
	readJson,
	setFrontmatterField,
	timestamp,
	writeJson,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"

function readFm(filePath: string): Record<string, unknown> {
	const { data } = parseFrontmatter(readFileSync(filePath, "utf8"))
	return data
}

/** Run the consistency pre-tick. May mutate disk state. Returns:
 *    - null: proceed with normal dispatch (either no inconsistency,
 *      or inconsistency was repaired silently)
 *    - safe_intent_repair action: short-circuit the tick with this
 *      result (manual review required, or phase regression needs
 *      agent attention)
 *
 *  The function is a no-op when:
 *    - intent.md doesn't exist (caller falls through to error path)
 *    - no studio is set
 *    - composite intents (skip — runNextComposite owns these)
 *    - active_stage is the first stage (no priors to validate)
 */
export function preTickConsistency(
	slug: string,
	root?: string,
): OrchestratorAction | null {
	const iDir = root ? join(root, "intents", slug) : intentDir(slug)
	const intentFile = join(iDir, "intent.md")
	if (!existsSync(intentFile)) return null

	const intent = readFm(intentFile)
	const studio = (intent.studio as string) || ""
	if (!studio) return null
	if (intent.composite) return null

	const studioStages = resolveIntentStages(intent, studio)
	if (studioStages.length === 0) return null

	const allStudioStages = resolveStudioStages(studio)
	if (allStudioStages.length === 0) return null

	const activeStage = (intent.active_stage as string) || ""
	const currentStage = activeStage || studioStages[0]
	const activeIdx = studioStages.indexOf(currentStage)

	// Pre-walk: sync intent.md.active_stage from state.json reality.
	// state.json is the single source of truth for stage position
	// (see project memory: project_state_json_owns_stage_position.md).
	// We do this AFTER the existing in-place repair logic below has
	// had a chance to synthesize completion for empty priors — the
	// `syncActiveStageFromStateJson` helper is called from each
	// `return null` path.
	const syncActiveStageFromStateJson = () => {
		const declared =
			(readFm(intentFile).active_stage as string) || studioStages[0]
		let derived = studioStages[studioStages.length - 1]
		for (const stage of studioStages) {
			const stPath = join(iDir, "stages", stage, "state.json")
			const st = existsSync(stPath) ? readJson(stPath) : {}
			const status = (st.status as string) || "pending"
			// A stage is "done" only when status === completed AND it's
			// not blocked at an external gate. status: completed +
			// gate_outcome: blocked is the "awaiting external review"
			// state — the merge hasn't happened, so the stage is still
			// active per the contract that completion lives in the
			// merge.
			const gateOutcome = (st.gate_outcome as string) || ""
			const isDone = status === "completed" && gateOutcome !== "blocked"
			if (!isDone) {
				derived = stage
				break
			}
		}
		if (declared !== derived) {
			setFrontmatterField(intentFile, "active_stage", derived)
			emitTelemetry("haiku.workflow.consistency_fix", {
				intent: slug,
				stale_stage: declared,
				corrected_stage: derived,
				reason: "intent_md_active_stage_drift",
			})
		}
	}

	if (activeIdx <= 0) {
		// No priors to validate, but still sync active_stage in case the
		// current stage's state.json shows completed (e.g., last-stage
		// drift). This addresses the pure "intent.md is stale" scenario.
		syncActiveStageFromStateJson()
		return null
	}

	const incompletePrior: string[] = []
	for (let i = 0; i < activeIdx; i++) {
		const prevState = readJson(
			join(iDir, "stages", studioStages[i], "state.json"),
		)
		const prevStatus = (prevState.status as string) || "pending"
		if (prevStatus !== "completed") {
			incompletePrior.push(studioStages[i])
		}
	}
	if (incompletePrior.length === 0) {
		// Priors are all completed but active_stage may still be
		// stale relative to state.json reality (e.g., current stage
		// just transitioned to status: completed but intent.md hasn't
		// caught up).
		syncActiveStageFromStateJson()
		return null
	}

	const activeUnitsDir = join(iDir, "stages", currentStage, "units")
	const activeUnitFiles = existsSync(activeUnitsDir)
		? readdirSync(activeUnitsDir).filter((f) => f.endsWith(".md"))
		: []

	if (activeUnitFiles.length === 0) {
		// Active stage has no units — point active_stage at the first
		// incomplete prior and proceed (next derive-state will pick up).
		const corrected = incompletePrior[0]
		setFrontmatterField(intentFile, "active_stage", corrected)
		emitTelemetry("haiku.workflow.consistency_fix", {
			intent: slug,
			stale_stage: activeStage,
			corrected_stage: corrected,
		})
		return null
	}

	// Active stage has units → safe-repair path.
	const synthesized: string[] = []
	const needsManualReview: string[] = []
	const now = timestamp()
	const intentStarted =
		(intent.started_at as string) || (intent.created_at as string) || now

	for (const stageName of incompletePrior) {
		const priorUnitsDir = join(iDir, "stages", stageName, "units")
		const priorUnitFiles = existsSync(priorUnitsDir)
			? readdirSync(priorUnitsDir).filter((f) => f.endsWith(".md"))
			: []

		if (priorUnitFiles.length > 0) {
			needsManualReview.push(stageName)
		} else {
			const stageDir = join(iDir, "stages", stageName)
			mkdirSync(stageDir, { recursive: true })
			const statePath = join(stageDir, "state.json")
			writeJson(statePath, {
				stage: stageName,
				status: "completed",
				phase: "gate",
				started_at: intentStarted,
				completed_at: intentStarted,
				gate_entered_at: null,
				gate_outcome: "advanced",
			})
			synthesized.push(stageName)
		}
	}

	const activeStageState = readJson(
		join(iDir, "stages", currentStage, "state.json"),
	)
	const activePhase = (activeStageState.phase as string) || ""
	let phaseRegressed = false
	const missingInputs: string[] = []
	if (activePhase === "execute") {
		for (const f of activeUnitFiles) {
			const fm = readFm(join(activeUnitsDir, f))
			const unitStatus = (fm.status as string) || ""
			if (["completed", "skipped", "failed"].includes(unitStatus)) continue
			const inputs = (fm.inputs as string[]) || (fm.refs as string[]) || []
			if (inputs.length === 0) missingInputs.push(f)
		}
		if (missingInputs.length > 0) {
			activeStageState.phase = "elaborate"
			writeJson(
				join(iDir, "stages", currentStage, "state.json"),
				activeStageState,
			)
			phaseRegressed = true
		}
	}

	if (synthesized.length > 0 || phaseRegressed) {
		gitCommitState(
			`haiku: safe-repair ${slug} — synthesize ${synthesized.join(", ")}${phaseRegressed ? "; regress phase to elaborate" : ""}`,
		)
	}

	emitTelemetry("haiku.workflow.safe_repair", {
		intent: slug,
		active_stage: currentStage,
		synthesized_stages: synthesized.join(","),
		needs_manual_review: needsManualReview.join(","),
		phase_regressed: String(phaseRegressed),
	})

	if (needsManualReview.length > 0) {
		return {
			action: "safe_intent_repair",
			intent: slug,
			studio,
			stage: currentStage,
			synthesized_stages: synthesized,
			needs_manual_review: needsManualReview,
			phase_regressed: phaseRegressed,
			units_missing_inputs: missingInputs,
			message: `Intent '${slug}' was in an inconsistent state — work exists in '${currentStage}' but earlier stages were incomplete.\n\n${synthesized.length > 0 ? `Synthesized completion records for empty stages: [${synthesized.join(", ")}]\n` : ""}Stages needing manual review (have units but aren't completed): [${needsManualReview.join(", ")}]\n${phaseRegressed ? `\nAdditionally, phase was regressed from 'execute' to 'elaborate' because some units are missing \`inputs:\` declarations.\n` : ""}Resolve these stages manually, then call haiku_run_next again.`,
		}
	}

	if (phaseRegressed) {
		return {
			action: "safe_intent_repair",
			intent: slug,
			studio,
			stage: currentStage,
			synthesized_stages: synthesized,
			needs_manual_review: [],
			phase_regressed: true,
			units_missing_inputs: missingInputs,
			message: `Intent '${slug}' repaired — synthesized completion for [${synthesized.join(", ")}]. Phase regressed from 'execute' to 'elaborate' because some units are missing \`inputs:\` declarations. Add inputs to the flagged units, then call haiku_run_next to proceed.`,
		}
	}

	// Clean repair: synthesized priors only, no manual review needed,
	// no phase regression. Mutations are on disk; derive-state will
	// see consistent state on the next read. Sync intent.md
	// active_stage from the now-consistent state.json walk.
	syncActiveStageFromStateJson()
	return null
}
