// orchestrator/workflow/derive-state.ts — Pure function: read disk →
// return current workflow state name + minimal context.
//
// The function never writes; it only reads. Every call is a fresh
// snapshot of the on-disk state. Callers (workflow tick dispatch,
// visualization, debugging) consume the result without affecting
// future calls.
//
// Derivation returns the COARSE state name and lets the per-state
// handler in handlers/ do the finer-grained branching at runtime
// (DAG topology, pending-feedback scans, fix-chain reconciliation,
// etc.). This is the contract:
//   - Derivation answers: "which state node am I conceptually in?"
//   - The handler answers: "given my current context, what action
//     should the orchestrator emit?"
//
// The split keeps derivation testable in isolation — fixtures only
// need to set the fields derivation reads.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { intentDir, parseFrontmatter, readJson } from "../../state-tools.js"
import type { StateName } from "./types.js"

export interface DerivedContext {
	readonly slug: string
	readonly studio: string
	/** Absolute path to the intent dir (`.haiku/intents/{slug}`). */
	readonly intentDirPath: string
	/** Full intent.md frontmatter — readers may pull additional
	 *  fields beyond what derivation already extracted. */
	readonly intent: Record<string, unknown>
	/** Active stage when the workflow is mid-stage. Empty string for
	 *  pre-stage states (select_studio, start_stage with no active
	 *  stage yet) and post-final states. */
	readonly currentStage: string
	/** Stage phase (elaborate / execute / review / gate). Empty
	 *  string when stage is pending. */
	readonly currentPhase: string
	/** Stage state.json contents when a stage is active. Empty
	 *  object otherwise. */
	readonly stageState: Record<string, unknown>
}

export interface DerivedState {
	readonly state: StateName
	readonly context: DerivedContext
}

/** Derive the workflow state for an intent from disk. Pure read; the
 *  function never mutates. Returns null when the intent doesn't
 *  exist. */
export function deriveCurrentState(
	slug: string,
	root?: string,
): DerivedState | null {
	const iDir = root ? join(root, "intents", slug) : intentDir(slug)
	const intentFile = join(iDir, "intent.md")
	if (!existsSync(intentFile)) return null

	const { data: intent } = parseFrontmatter(readFileSync(intentFile, "utf8"))
	const studio = (intent.studio as string) || ""
	const status = (intent.status as string) || "active"
	const phase = (intent.phase as string) || ""
	const archived = intent.archived === true

	const baseContext = (
		stage: string,
		stagePhase: string,
		stageState: Record<string, unknown>,
	): DerivedContext => ({
		slug,
		studio,
		intentDirPath: iDir,
		intent,
		currentStage: stage,
		currentPhase: stagePhase,
		stageState,
	})

	// Terminal: completed status. (archived === true is handled
	// further down — runNext returns `error` not `complete` for that
	// path, mirrored here so emission parity holds.)
	if (status === "completed") {
		return {
			state: "complete",
			context: baseContext("", "", {}),
		}
	}

	// Legacy "archived" status was a pre-flag terminal marker.
	// Surfaced as error so the agent runs /haiku:repair.
	if (status === "archived") {
		return {
			state: "error",
			context: baseContext("", "", {}),
		}
	}

	// New `archived: true` flag (separate from status) — agent must
	// call haiku_intent_unarchive. Emitted as error.
	if (archived) {
		return {
			state: "error",
			context: baseContext("", "", {}),
		}
	}

	// Pre-studio: no studio selected yet.
	if (!studio) {
		return {
			state: "select_studio",
			context: baseContext("", "", {}),
		}
	}

	// Composite intents — multi-studio with declared per-studio stage
	// progressions and cross-studio sync barriers. Routed to its own
	// workflow handler that walks the composite + sync rules.
	if (intent.composite) {
		return {
			state: "composite_run_stage",
			context: baseContext("", "", {}),
		}
	}

	// Pre-mode: studio selected, mode not yet elicited. The mode
	// elicitation happens AFTER studio selection so the option list
	// is studio-aware (e.g. some studios may not support `quick`).
	const modeRaw = (intent.mode as string) || ""
	const mode = modeRaw.toLowerCase()
	const activeStageEarly = (intent.active_stage as string) || ""
	if (!mode && !activeStageEarly) {
		return {
			state: "select_mode",
			context: baseContext("", "", {}),
		}
	}

	// Pre-stage stage selection: only fires for `quick` mode, which
	// is single-stage. The agent elicits exactly one stage from the
	// studio's stage list. Other modes get `stages` set to the studio's
	// full list at mode-selection time, so they fall through.
	const stagesField = (intent.stages as unknown[]) || []
	const stagesArray = Array.isArray(stagesField)
		? (stagesField as string[])
		: []
	if (mode === "quick" && stagesArray.length === 0 && !activeStageEarly) {
		return {
			state: "select_stage",
			context: baseContext("", "", {}),
		}
	}

	// Pre-stage intent review. Studio + mode + stages are all set, no
	// stage has started yet (no active_stage), and the user has not
	// approved the intent yet (intent_reviewed !== true). Pop a review
	// screen for the minimal intent before the workflow enters stage 0.
	// Approved via haiku_await_gate, which stamps intent_reviewed: true
	// so this branch falls through on the next tick.
	const intentReviewed = intent.intent_reviewed === true
	if (
		!intentReviewed &&
		!activeStageEarly &&
		(!phase || phase === "intent_review")
	) {
		return {
			state: "intent_review",
			context: baseContext("", "", {}),
		}
	}

	// Intent-level phases (intent_completion) are driven by
	// intent.phase, not stage state. They short-circuit stage
	// processing.
	// Production writes `awaiting_completion_review` via workflowEnterIntentCompletionReview;
	// `intent_completion` is reserved for callers that want the same routing under
	// the more descriptive name. Both surface to the same workflow handler.
	if (phase === "intent_completion" || phase === "awaiting_completion_review") {
		const dispatched = intent.completion_review_dispatched === true
		if (!dispatched) {
			return {
				state: "intent_completion_review",
				context: baseContext("", "", {}),
			}
		}
		// Dispatched — could be intent_completion_fix (pending
		// feedback) or gate_review (final approval). The fine-grained
		// pick happens inside the state's decide(); coarse derivation
		// returns intent_completion_fix as the entrypoint.
		return {
			state: "intent_completion_fix",
			context: baseContext("", "", {}),
		}
	}

	// Stage-driven phases. Read active_stage and its state.json.
	const activeStage = (intent.active_stage as string) || ""
	if (!activeStage) {
		// No active stage — workflow is about to enter the first
		// (or next) stage.
		return {
			state: "start_stage",
			context: baseContext("", "", {}),
		}
	}

	// Build the stage state.json path explicitly from iDir so test
	// fixtures rooted at a tmpdir resolve correctly. Mirrors the
	// shape of state-tools.ts's stageStatePath without depending on
	// process.cwd-based findHaikuRoot().
	const stageStateFile = join(iDir, "stages", activeStage, "state.json")
	const stageState: Record<string, unknown> = existsSync(stageStateFile)
		? (readJson(stageStateFile) as Record<string, unknown>)
		: {}
	const stagePhase = (stageState.phase as string) || ""
	const stageStatus = (stageState.status as string) || "pending"

	// Stage not started yet.
	if (!stagePhase || stageStatus === "pending") {
		return {
			state: "start_stage",
			context: baseContext(activeStage, "", stageState),
		}
	}

	// Stage in progress — map phase to state.
	switch (stagePhase) {
		case "elaborate":
			return {
				state: "elaborate",
				context: baseContext(activeStage, stagePhase, stageState),
			}
		case "execute":
			return {
				state: "execute",
				context: baseContext(activeStage, stagePhase, stageState),
			}
		case "review":
			return {
				state: "review",
				context: baseContext(activeStage, stagePhase, stageState),
			}
		case "gate":
			return {
				state: "gate_review",
				context: baseContext(activeStage, stagePhase, stageState),
			}
		default:
			// Unknown phase — surface as error so the test fixture
			// catches the corruption rather than the runtime fudging
			// it.
			return {
				state: "error",
				context: baseContext(activeStage, stagePhase, stageState),
			}
	}
}
