// orchestrator/prompts/_shared/index.ts — Shared prompt blocks
// reused by multiple prompt builders.
//
// Each block lives as a sibling `.md` (or `.eta.md`) file. The
// `loadTemplate` helper reads the file at module load in dev/test
// (tsx, bun, plain node); the `inline-prompt-templates` esbuild
// plugin replaces every loadTemplate call with a JSON-stringified
// literal at bundle time, so the blocks are baked into the
// production binary.

import { Eta } from "eta"
import { MAX_STAGE_ITERATIONS } from "../../../state-tools.js"
import { loadTemplate } from "../_load-template.js"

export const WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK = loadTemplate(
	import.meta.url,
	"announcement.md",
)

export const SUBAGENT_ERROR_RECOVERY = loadTemplate(
	import.meta.url,
	"subagent-error-recovery.md",
)

export const WORKFLOW_CONTRACTS_ELABORATE_BLOCK = loadTemplate(
	import.meta.url,
	"workflow-contracts-elaborate.md",
)

export const WORKFLOW_CONTRACTS_EXECUTE_BLOCK = loadTemplate(
	import.meta.url,
	"workflow-contracts-execute.md",
)

export const WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK = loadTemplate(
	import.meta.url,
	"workflow-contracts-fix-loop.md",
)

// Review block has one substitution (MAX_STAGE_ITERATIONS) — render
// once at module load. Eta is heavy for a single substitution but
// keeps the templating mechanism uniform with the per-action prompts.
const REVIEW_TEMPLATE = loadTemplate(
	import.meta.url,
	"workflow-contracts-review.eta.md",
)
const eta = new Eta({ autoEscape: false, useWith: true })
export const WORKFLOW_CONTRACTS_REVIEW_BLOCK = eta.renderString(
	REVIEW_TEMPLATE,
	{ maxStageIterations: MAX_STAGE_ITERATIONS },
)
