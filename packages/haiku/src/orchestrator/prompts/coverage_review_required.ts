// orchestrator/prompts/coverage_review_required.ts — emitted by the
// pre-tick `validateCumulativeInputCoverage` validator (validators.ts) when
// one or more prior-stage outputs are not referenced by any current-stage
// unit's `inputs:` AND not acknowledged in
// `stages/<stage>/coverage-decisions.json`. The validator's `message` field
// already enumerates the unreferenced files and the two response paths
// (haiku_unit_set vs. haiku_coverage_acknowledge) verbatim — surface it
// straight through.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	return `## Coverage Review Required\n\n${action.message}`
})
