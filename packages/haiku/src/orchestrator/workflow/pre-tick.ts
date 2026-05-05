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

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { getCurrentState } from "../../current-state.js"
import {
	branchExists,
	isBranchMerged,
	mergeUnitWorktree,
} from "../../git-worktree.js"
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
import {
	findIncompleteStages,
	rewindFromCompletionReview,
} from "./side-effects.js"

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

	let intent = readFm(intentFile)
	const studio = (intent.studio as string) || ""
	if (!studio) return null
	if (intent.composite) return null

	const studioStages = resolveIntentStages(intent, studio)
	if (studioStages.length === 0) return null

	const allStudioStages = resolveStudioStages(studio)
	if (allStudioStages.length === 0) return null

	// Stale completion-review recovery: an earlier tick (or pre-guard
	// build) may have set `phase: awaiting_completion_review` while
	// real stages were still incomplete. Without this rewind, every
	// subsequent tick routes to the intent-completion handler and the
	// `findIncompleteStages` guard fires the same error in a loop —
	// the engine never gets a chance to actually run the missing
	// stages. Detect that shape and reset before derive-state runs.
	const stalePhases = ["awaiting_completion_review", "intent_completion"]
	if (stalePhases.includes((intent.phase as string) || "")) {
		const incomplete = findIncompleteStages(slug, studio, root)
		if (incomplete.length > 0) {
			rewindFromCompletionReview(slug, incomplete[0], root)
			// gitCommitState walks up from cwd to find the git repo and
			// commits there. Under test fixtures (root passed as a
			// tmpdir override) the resolved repo is the parent project
			// — running a commit there would scoop up whatever's dirty
			// in the real working tree. Skip the commit when the caller
			// passed an explicit root; the rewind is still observable
			// on disk via the frontmatter changes.
			if (!root) {
				gitCommitState(
					`haiku: rewind ${slug} from completion-review — ${incomplete.length} stage(s) still pending`,
				)
			}
			emitTelemetry("haiku.workflow.completion_review_rewound", {
				intent: slug,
				incomplete_stages: incomplete.join(","),
			})
			// Re-read intent.md so the rest of pre-tick sees the
			// post-rewind frontmatter (active_stage moved to the first
			// incomplete stage, phase + completion_review_* cleared).
			intent = readFm(intentFile)
		}
	}

	const activeStage = (intent.active_stage as string) || ""
	const currentStage = activeStage || studioStages[0]
	const activeIdx = studioStages.indexOf(currentStage)

	// Orphan-completed-unit merge-retry pass.
	//
	// When advance_hat completes a unit's last hat, it tries to merge the
	// unit branch into the stage branch via mergeUnitWorktree. When the
	// stage worktree is dirty (typical: the engine just wrote feedback
	// files, unit FM updates, or stage state.json from a prior tick),
	// the merge returns merge_failed. The agent commits the dirty files
	// per the structured error and re-ticks — but nothing in the engine
	// re-attempts the merge. The unit's status is `completed` in its FM,
	// so the execute handler treats the unit as done; the stage outputs
	// validation then fails because the deliverables only exist on the
	// orphaned unit branch. The workflow loops on `outputs_missing`.
	//
	// This pass walks the active stage's units, identifies those whose
	// status is `completed` AND whose branch is not yet merged into the
	// stage branch, and re-runs mergeUnitWorktree. Each re-attempt picks
	// up the now-clean stage worktree and lands the merge.
	//
	// Runs early so subsequent pre-tick repairs and the per-state
	// dispatch see the post-merge stage tip. Best-effort: any merge that
	// still fails (real conflict, missing branch, etc.) leaves the unit
	// orphaned and downstream `outputs_missing` will surface it; the
	// agent then has the structured error path to act on.
	if (currentStage) {
		const unitsDirRetry = join(iDir, "stages", currentStage, "units")
		if (existsSync(unitsDirRetry)) {
			const stageBranch = `haiku/${slug}/${currentStage}`
			const unitFiles = readdirSync(unitsDirRetry).filter((f) =>
				f.endsWith(".md"),
			)
			for (const f of unitFiles) {
				const unitName = f.replace(/\.md$/, "")
				const unitFm = readFm(join(unitsDirRetry, f))
				if ((unitFm.status as string) !== "completed") continue
				const unitBranch = `haiku/${slug}/${unitName}`
				if (!branchExists(unitBranch)) continue
				if (!branchExists(stageBranch)) continue
				if (isBranchMerged(unitBranch, stageBranch)) continue

				// Branch exists, status is completed, but the merge into
				// stage hasn't happened. Re-attempt.
				const result = mergeUnitWorktree(slug, unitName, currentStage)
				emitTelemetry("haiku.workflow.orphan_unit_merge_retry", {
					intent: slug,
					stage: currentStage,
					unit: unitName,
					ok: String(result.success),
					message: result.message,
				})
				// On failure: surface the merge result to the agent
				// instead of silently continuing. Continuing would let
				// the next handler advance phase past an unmerged unit
				// or — worse — leave a half-merged state with conflict
				// markers in the working tree that the next tick reads
				// as if it were normal content. Surfacing here matches
				// the structured error path the merge_failed /
				// resolve_merge_conflicts shapes already define.
				if (!result.success) {
					const isConflict = /merge_conflict:/i.test(result.message)
					return {
						action: isConflict ? "resolve_merge_conflicts" : "merge_failed",
						intent: slug,
						stage: currentStage,
						unit: unitName,
						unit_branch: unitBranch,
						stage_branch: stageBranch,
						error: result.message,
						message: `Pre-tick orphan-merge retry on '${unitName}' could not land into '${stageBranch}': ${result.message}. Resolve the merge in the stage worktree (commit dirty engine-owned files first if the failure cited "would be overwritten"; resolve any conflict markers and \`git add\`/\`git commit\` if the failure cited content conflicts), then call haiku_run_next so the engine retries.`,
					}
				}
			}
		}
	}

	// Pre-walk: sync intent.md.active_stage from state.json reality.
	// state.json is the single source of truth for stage position
	// (see project memory: project_state_json_owns_stage_position.md).
	// We do this AFTER the existing in-place repair logic below has
	// had a chance to synthesize completion for empty priors — the
	// `syncActiveStageFromStateJson` helper is called from each
	// `return null` path.
	//
	// The actual derivation lives in current-state.ts so the API and
	// SPA can call it directly without going through pre-tick. This
	// function is the writer that keeps the intent.md cache in step.
	const syncActiveStageFromStateJson = () => {
		// `intent` was read at the top of preTickConsistency. No call site
		// of this closure mutates intent.md before invoking it, so re-reading
		// the frontmatter would just be a redundant fs hit.
		const declared = (intent.active_stage as string) || studioStages[0]
		const current = getCurrentState(slug, root)
		const derived = current?.stage || studioStages[studioStages.length - 1]
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
	const fixedInputs: string[] = []
	if (activePhase === "execute") {
		for (const f of activeUnitFiles) {
			const fm = readFm(join(activeUnitsDir, f))
			const unitStatus = (fm.status as string) || ""
			if (["completed", "skipped", "failed"].includes(unitStatus)) continue
			// Three cases count as "missing": absent, empty array, OR
			// non-array (e.g. a string from prior-corruption like
			// `inputs: >- ["a","b"]` parsing back as a single string).
			// The non-array case used to slip through `length > 0` since
			// any non-empty string passes that check, leaving previously-
			// corrupted units stuck.
			const rawInputs = fm.inputs ?? fm.refs ?? []
			const isUsable = Array.isArray(rawInputs) && rawInputs.length > 0
			if (!isUsable) missingInputs.push(f)
		}
		// Mechanically populate `inputs:` on flagged units using the
		// intent.md + knowledge/*.md fallback. Doing this here keeps
		// the SDK repair agent out of unit files entirely — the agent
		// previously had Edit access and corrupted FM by confusing
		// YAML arrays with JSON-encoded strings (e.g. `inputs: >- ["a","b"]`
		// instead of a YAML list). gray-matter's stringifier produces a
		// proper YAML sequence for `string[]`.
		if (missingInputs.length > 0) {
			const knowledgeDir = join(iDir, "knowledge")
			const fallbackInputs: string[] = ["intent.md"]
			if (existsSync(knowledgeDir)) {
				for (const k of readdirSync(knowledgeDir)) {
					if (k.endsWith(".md")) fallbackInputs.push(`knowledge/${k}`)
				}
			}
			const stillMissing: string[] = []
			for (const f of missingInputs) {
				const unitFilePath = join(activeUnitsDir, f)
				try {
					const raw = readFileSync(unitFilePath, "utf8")
					const parsed = matter(raw)
					const existing = (parsed.data.inputs as unknown[]) || []
					if (Array.isArray(existing) && existing.length > 0) continue
					parsed.data.inputs = fallbackInputs
					writeFileSync(
						unitFilePath,
						matter.stringify(parsed.content, parsed.data),
					)
					fixedInputs.push(f)
				} catch {
					stillMissing.push(f)
				}
			}
			missingInputs.length = 0
			missingInputs.push(...stillMissing)
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

	if (synthesized.length > 0 || phaseRegressed || fixedInputs.length > 0) {
		// Format: leading " — " before the first suffix, "; " between
		// the rest. Joining with `; ` and prepending one ` — ` keeps
		// the punctuation consistent regardless of which subset of
		// outcomes fired.
		const suffixes: string[] = []
		if (synthesized.length > 0) {
			suffixes.push(`synthesize ${synthesized.join(", ")}`)
		}
		if (fixedInputs.length > 0) {
			suffixes.push(`auto-add inputs to ${fixedInputs.join(", ")}`)
		}
		if (phaseRegressed) {
			suffixes.push("regress phase to elaborate")
		}
		gitCommitState(
			`haiku: safe-repair ${slug}${suffixes.length > 0 ? ` — ${suffixes.join("; ")}` : ""}`,
		)
	}

	emitTelemetry("haiku.workflow.safe_repair", {
		intent: slug,
		active_stage: currentStage,
		synthesized_stages: synthesized.join(","),
		needs_manual_review: needsManualReview.join(","),
		phase_regressed: String(phaseRegressed),
		auto_fixed_inputs: fixedInputs.join(","),
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
