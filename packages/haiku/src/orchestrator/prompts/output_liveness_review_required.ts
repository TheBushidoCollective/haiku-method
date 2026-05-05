// orchestrator/prompts/output_liveness_review_required.ts — emitted by
// `validateOutputLiveness` from two call sites:
//   1. per-stage review handler (`workflow/handlers/review.ts`) — fires
//      after quality gates pass, before workflowAdvancePhase to gate, so
//      adversarial reviewers see the orphan list per-stage.
//   2. intent-completion handler (`workflow/handlers/intent-completion.ts`)
//      — final cross-stage check before studio-level review dispatch.
// In both cases the validator finds code outputs (`.ts`/`.tsx`/etc.)
// that no other file in the repo references. The validator's
// `message` already enumerates the orphan list and the two response
// paths (author/extend an integration unit vs. acknowledge as
// out-of-scope via `haiku_coverage_acknowledge`) verbatim — surface
// it through.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	return `## Output Liveness Review Required\n\n${action.message}`
})
