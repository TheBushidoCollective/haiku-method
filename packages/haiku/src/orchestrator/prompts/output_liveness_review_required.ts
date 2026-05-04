// orchestrator/prompts/output_liveness_review_required.ts — emitted by
// the intent-completion handler before studio-level review dispatch when
// `validateOutputLiveness` finds code outputs (`.ts`/`.tsx`/etc.) that
// no other file in the repo references. The validator's `message`
// already enumerates the orphan list and the two response paths
// (author/extend an integration unit vs. acknowledge as out-of-scope
// via `haiku_coverage_acknowledge`) verbatim — surface it through.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	return `## Output Liveness Review Required\n\n${action.message}`
})
