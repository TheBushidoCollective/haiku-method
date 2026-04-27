// orchestrator.ts — H·AI·K·U workflow-engine entry point + back-compat
// re-export surface.
//
// The orchestrator's logic lives in focused modules under
// `orchestrator/`:
//
//   - workflow/run-tick.ts  → tick loop + dispatcher
//   - workflow/handlers/    → per-state handlers
//   - workflow/side-effects → state mutators (workflowStartStage etc.)
//   - actions.ts            → OrchestratorAction helpers (summarize,
//                             escalate, elaborator instruction, etc.)
//   - studio.ts             → studio / stage / hat resolution
//   - units.ts              → unit listing + DAG wave computation
//   - validators.ts         → output / discovery / naming / inputs /
//                             quality-gate validators
//   - external-review.ts    → gh/glab CLI probing + changes_requested
//   - revisit.ts            → stage / phase regression
//   - preview.ts            → tell_user / next_step enrichment
//
// This file just re-exports the public surface for back-compat with
// callers (and tests) that still import from "./orchestrator.js",
// plus the MCP tool handler dispatch.

import { actionPromptBuilders } from "./orchestrator/prompts/index.js"
import { orchestratorToolDefs } from "./orchestrator/tool-defs.js"
import { dispatchOrchestratorAction } from "./orchestrator/workflow/run-tick.js"
import { validateSlugArgs } from "./state-tools.js"
import { orchestratorToolHandlers } from "./tools/orchestrator/index.js"

export { orchestratorToolDefs }

/** Back-compat re-export of the workflow dispatcher. Older callers
 *  (and tests) imported this as `runNext` from orchestrator.ts; new
 *  code should prefer `dispatchOrchestratorAction` directly from
 *  `orchestrator/workflow/run-tick.js`. */
export const runNext = dispatchOrchestratorAction

export {
	buildElaboratorInstruction,
	buildGuardResponse,
	maybeEscalate,
	summarizeFeedback,
} from "./orchestrator/actions.js"
// Re-exports from extracted submodules. Callers of the old monolith
// continue to import from "./orchestrator.js"; new code can import
// directly from the per-concern modules.
export {
	checkExternalState,
	type ExternalReviewState,
	handleExternalChangesRequested,
} from "./orchestrator/external-review.js"
export { enrichActionWithPreview } from "./orchestrator/preview.js"
export {
	classifyPendingForRevisit,
	resetFixLoopBolts,
	revisit,
	revisitCurrentStage,
} from "./orchestrator/revisit.js"
export {
	buildFeedbackAssessorPrompt,
	resolveIntentStages,
	resolveStageHats,
	resolveStageMetadata,
	resolveStageReview,
	resolveStudioFilePath,
	resolveStudioStages,
	resolveUnitHatsInStudio,
} from "./orchestrator/studio.js"
export {
	cleanupPreExecuteFeedback,
	computeUnitWaves,
	currentWaveNumber,
	isStagePreExecute,
	listUnits,
	type UnitInfo,
} from "./orchestrator/units.js"
export {
	buildOutputRequirements,
	runQualityGates,
	validateDiscoveryArtifacts,
	validateStageOutputs,
	validateUnitInputs,
	validateUnitNaming,
	writeReviewFeedbackFiles,
} from "./orchestrator/validators.js"
export {
	completeOrReviewIntent,
	workflowAdvancePhase,
	workflowAdvanceStage,
	workflowCompleteStage,
	workflowGateAsk,
	workflowIntentComplete,
	workflowStartStage,
} from "./orchestrator/workflow/side-effects.js"

// ── Action types ───────────────────────────────────────────────────────────

export interface OrchestratorAction {
	action: string
	[key: string]: unknown
}

// ── Main orchestration function ────────────────────────────────────────────

// ── Run instruction builder ───────────────────────────────────────────────

export function buildRunInstructions(
	slug: string,
	studio: string,
	action: OrchestratorAction,
	dir: string,
): string {
	// Strip tell_user/next_step from the JSON output — they appear in the
	// announcement section already, no need to duplicate in the raw action.
	const { tell_user, next_step, ...actionForJson } =
		action as OrchestratorAction & { tell_user?: string; next_step?: string }
	const actionJson = JSON.stringify(actionForJson, null, 2)
	const sections: string[] = []

	// Agent announcement directive — tell the user what's happening
	if (tell_user || next_step) {
		const parts: string[] = [
			"## Announce to User (MANDATORY)\n",
			`**Before doing ANY work**, tell the user what you're about to do:`,
		]
		if (tell_user) parts.push(`> ${tell_user}`)
		if (next_step) parts.push(`\n_${next_step}_`)
		parts.push(
			"\nKeep the announcement concise — one or two sentences. Do NOT skip this step.",
		)
		sections.push(parts.join("\n"))
	}

	sections.push(`## Orchestrator Action\n\n\`\`\`json\n${actionJson}\n\`\`\``)

	// All per-action prompts live in orchestrator/prompts/* per-file
	// modules registered in actionPromptBuilders. The legacy switch is
	// gone — unknown actions fall through to the default JSON dump
	// below for forward-compat with new action types.
	const perActionBuilder = actionPromptBuilders.get(action.action)
	if (perActionBuilder) {
		const built = perActionBuilder({ slug, studio, action, dir })
		if (built !== null) {
			sections.push(built)
			return sections.join("\n\n")
		}
	}

	sections.push(
		`## Unknown Action: ${action.action}\n\n${JSON.stringify(action, null, 2)}`,
	)
	return sections.join("\n\n")
}

// ── Tool definitions ───────────────────────────────────────────────────────

// ── Tool handlers ──────────────────────────────────────────────────────────

/**
 * Callback for opening a review and blocking until the user decides.
 * Set by server.ts at startup to avoid circular imports.
 */
let _openReviewAndWait:
	| ((
			intentDir: string,
			reviewType: string,
			gateType?: string,
			/** Abort signal propagated from the MCP tool call so the review
			 *  session can be torn down (and its WebSocket closed) if the
			 *  user cancels the tool. */
			signal?: AbortSignal,
	  ) => Promise<{ decision: string; feedback: string; annotations?: unknown }>)
	| null = null

/**
 * Callback for elicitation — asks the user a question via the MCP client's native UI.
 * Used as fallback when the review UI fails to open.
 */
let _elicitInput:
	| ((params: { message: string; requestedSchema: unknown }) => Promise<{
			action: string
			content?: unknown
	  }>)
	| null = null

export function setOpenReviewHandler(handler: typeof _openReviewAndWait): void {
	_openReviewAndWait = handler
}

export function setElicitInputHandler(handler: typeof _elicitInput): void {
	_elicitInput = handler
}

/** Per-tool orchestrator handlers reach the elicit handler through this
 *  getter — keeps the variable module-private while still allowing
 *  extracted per-tool files to call it. */
export function getElicitInput(): typeof _elicitInput {
	return _elicitInput
}

/** Per-tool orchestrator handlers reach the open-review handler
 *  through this getter — same pattern as getElicitInput. */
export function getOpenReviewAndWait(): typeof _openReviewAndWait {
	return _openReviewAndWait
}

export async function handleOrchestratorTool(
	name: string,
	args: Record<string, unknown>,
	_signal?: AbortSignal,
): Promise<{
	content: Array<{ type: "text"; text: string }>
	isError?: boolean
}> {
	const text = (s: string) => ({
		content: [{ type: "text" as const, text: s }],
	})

	const validationError = validateSlugArgs(args)
	if (validationError) return validationError

	// Per-tool handlers in tools/orchestrator/* take priority over the
	// legacy if-chain. Migrated tools live in their own file with
	// defineTool(); the chain below handles the rest until they all
	// migrate.
	const perToolHandler = orchestratorToolHandlers.get(name)
	if (perToolHandler) {
		const result = perToolHandler.handle(args)
		return result instanceof Promise ? await result : result
	}

	return text(`Unknown orchestrator tool: ${name}`)
}
