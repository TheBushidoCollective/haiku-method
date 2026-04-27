// orchestrator/workflow/handlers/start-stage.ts — Emit for the
// `start_stage` state.
//
// This handler owns the entire pre-stage routing chain that runNext
// previously inlined at orchestrator.ts:2218-2470. Specifically:
//
//   1. Composite-intent detection (returns null → runNext handles via
//      runNextComposite, which is its own multi-stage delegate not
//      yet ported).
//   2. Studio-without-stages error (line 2226).
//   3. Consistency check across prior stages — if active_stage is
//      not the first stage, every prior stage must be completed.
//      Two recovery modes:
//        a. Safe intent repair (active stage has units but priors
//           are empty): synthesize prior completions, optionally
//           regress phase to elaborate, return safe_intent_repair
//           action.
//        b. Plain consistency reset (active stage is empty): point
//           active_stage at the first incomplete prior stage and
//           re-derive.
//   4. Stage hop forward when current stage is excluded by the
//      effective stages set (intent.stages allow-list /
//      intent.skip_stages deny-list). May terminate the intent if
//      no included stage remains.
//   5. start_stage emission with workflow side effect (workflowStartStage),
//      surfacing parent knowledge for follow-up intents.
//
// derive-state.ts returns "start_stage" both for the empty-active
// case (no stage yet) and the pending-stage case (stage created but
// not started). Both flows land here. The handler returns null only
// for the composite delegate; every other sub-case has a concrete
// emission.

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
	completeOrReviewIntent,
	resolveIntentStages,
	resolveStageHats,
	resolveStageMetadata,
	resolveStudioStages,
	workflowStartStage,
} from "../../../orchestrator.js"
import {
	findHaikuRoot,
	gitCommitState,
	parseFrontmatter,
	readJson,
	setFrontmatterField,
	timestamp,
	writeJson,
} from "../../../state-tools.js"
import { emitTelemetry } from "../../../telemetry.js"
import type { WorkflowHandler } from "./_types.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

const emit: WorkflowHandler = (ctx, rootArg) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const intent = ctx.intent

	// Composite intents have their own multi-stage flow; defer to
	// runNext until that delegate ports.
	if (intent.composite) return null

	const allStudioStages = resolveStudioStages(studio)
	if (allStudioStages.length === 0) {
		return { action: "error", message: `Studio '${studio}' has no stages` }
	}

	// Effective stages honor `intent.stages` allow-list (used by
	// /haiku:quick) and `intent.skip_stages` deny-list. Either, both,
	// or neither.
	const studioStages = resolveIntentStages(intent, studio)

	// Resolve `root` either from the test-fixture override or from
	// findHaikuRoot at runtime. derive-state's intentDirPath is
	// `<root>/intents/<slug>`, so we can recover root by going up two
	// levels when no override is provided.
	const _root =
		rootArg ?? dirname(dirname(ctx.intentDirPath)).replace(/\/intents$/, "")
	const iDir = ctx.intentDirPath
	const intentFile = join(iDir, "intent.md")
	const activeStage = (intent.active_stage as string) || ""

	let currentStage = activeStage || studioStages[0]

	// Consistency check across earlier stages.
	const activeIdx = studioStages.indexOf(currentStage)
	if (activeIdx > 0) {
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

		if (incompletePrior.length > 0) {
			const activeUnitsDir = join(iDir, "stages", currentStage, "units")
			const activeUnitFiles = existsSync(activeUnitsDir)
				? readdirSync(activeUnitsDir).filter((f) => f.endsWith(".md"))
				: []

			if (activeUnitFiles.length > 0) {
				// ── Safe intent repair ─────────────────────────────────
				// Active stage has units but earlier stages are empty —
				// synthesize completions for empty priors, regress phase
				// when units are missing inputs.
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
						const fm = readFrontmatter(join(activeUnitsDir, f))
						const unitStatus = (fm.status as string) || ""
						if (["completed", "skipped", "failed"].includes(unitStatus))
							continue
						const inputs =
							(fm.inputs as string[]) || (fm.refs as string[]) || []
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

				// Clean repair, no phase regression: continue to start_stage
				// emission below. The synthesized priors are now considered
				// completed, so the consistency invariant holds.
			} else {
				// Active stage is empty — point active_stage at the first
				// incomplete prior and treat it as the new currentStage.
				currentStage = incompletePrior[0]
				setFrontmatterField(intentFile, "active_stage", currentStage)
				emitTelemetry("haiku.workflow.consistency_fix", {
					intent: slug,
					stale_stage: activeStage,
					corrected_stage: currentStage,
				})
			}
		}
	}

	// If currentStage isn't in the effective stages list (skip/allow
	// gating), hop forward. Terminates intent if no included stage
	// remains.
	const effectiveStageSet = new Set(studioStages)
	if (!effectiveStageSet.has(currentStage)) {
		const idx = allStudioStages.indexOf(currentStage)
		const next = allStudioStages
			.slice(idx + 1)
			.find((s) => effectiveStageSet.has(s))
		if (!next) {
			return completeOrReviewIntent(
				slug,
				studio,
				`All remaining stages in intent '${slug}' are skipped.`,
			)
		}
		currentStage = next
	}

	// Stage may have advanced from a synthesized repair or hop. If the
	// stage state still looks "pending" (or doesn't exist yet), this
	// is the start_stage emission path. Otherwise — the stage is
	// mid-phase — defer to runNext for the per-phase emission (not
	// yet ported).
	const stageStateFile = join(iDir, "stages", currentStage, "state.json")
	const stageState: Record<string, unknown> = existsSync(stageStateFile)
		? readJson(stageStateFile)
		: {}
	const phase = (stageState.phase as string) || ""
	const stageStatus = (stageState.status as string) || "pending"

	if (phase && stageStatus !== "pending") {
		// Mid-phase — runNext owns this path until per-phase ports
		// land.
		return null
	}

	const hats = resolveStageHats(studio, currentStage)
	const follows = (intent.follows as string) || ""
	const parentKnowledge: string[] = []
	if (follows && currentStage === studioStages[0]) {
		const haikuRoot = rootArg ?? findHaikuRoot()
		const parentKnowledgeDir = join(haikuRoot, "intents", follows, "knowledge")
		if (existsSync(parentKnowledgeDir)) {
			parentKnowledge.push(
				...readdirSync(parentKnowledgeDir).filter((f) => f.endsWith(".md")),
			)
		}
	}

	try {
		workflowStartStage(slug, currentStage)
	} catch (err) {
		return {
			action: "error",
			message: err instanceof Error ? err.message : String(err),
		}
	}

	return {
		action: "start_stage",
		intent: slug,
		studio,
		stage: currentStage,
		hats,
		phase: "elaborate",
		stage_metadata: resolveStageMetadata(studio, currentStage),
		...(follows ? { follows, parent_knowledge: parentKnowledge } : {}),
		message: follows
			? `Start stage '${currentStage}' — this intent follows '${follows}'. Load parent knowledge before elaborating.`
			: `Start stage '${currentStage}' — elaborate the work into units`,
	}
}

export default emit
