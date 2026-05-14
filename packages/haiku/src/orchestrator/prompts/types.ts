// orchestrator/prompts/types.ts — Per-action prompt-builder contract.
//
// Each `case` in buildRunInstructions's giant switch becomes a
// PromptBuilder living in its own file under
// orchestrator/prompts/{action}.ts. The builder receives the slug,
// studio, action object, and intent-dir, and returns one or more
// prompt sections that get concatenated into the final markdown
// instructions returned to the agent.
//
// Returning `null` is the "decline" signal — the framework falls
// back to the legacy switch arm in orchestrator.ts. This lets the
// migration land per-action without touching every case at once.

import type { OrchestratorAction } from "../../orchestrator.js"

export interface PromptBuilderContext {
	readonly slug: string
	readonly studio: string
	readonly action: OrchestratorAction
	readonly dir: string
	/** True when this builder is being invoked by the `elaborate_loop`
	 *  router as a sub-builder. Five elaborate-loop signals share that
	 *  router; each sub-builder MUST suppress its own top-level
	 *  framing (heading, "call haiku_run_next" tail) when this flag is
	 *  set so the composite doesn't render competing headings or
	 *  duplicated tail instructions. The router supplies its own
	 *  framing around each sub-builder's body. */
	readonly composedMode?: boolean
}

export type PromptBuilder = (ctx: PromptBuilderContext) => string | null
