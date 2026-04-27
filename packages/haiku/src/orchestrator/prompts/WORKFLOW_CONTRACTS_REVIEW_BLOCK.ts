// orchestrator/prompts/WORKFLOW_CONTRACTS_REVIEW_BLOCK.ts — Static
// prompt body. Injected verbatim into review-phase dispatch prompts
// as the contract reminder for adversarial review agents.

import { MAX_STAGE_ITERATIONS } from "../../state-tools.js"

export const WORKFLOW_CONTRACTS_REVIEW_BLOCK = [
	"### Workflow Contracts (REQUIRED — reminder during review)",
	"",
	"> ## ⟁ REVIEWERS LOG, NEVER EDIT.",
	"> Your only output channel is `haiku_feedback`. Any file write is a scope violation, regardless of how trivial the fix looks.",
	"",
	"- Review agents MUST NOT write, edit, or create any file. Their ONLY output channel is `haiku_feedback`. Any file write is a scope violation.",
	"- Conditional review: each agent's `applies_to:` frontmatter (glob list) scopes it to matching output kinds. The workflow engine filters agents whose scope doesn't match; agents without `applies_to:` always run.",
	'- Findings with concrete reproducible claims (file:line + gate command + proposed fix) accelerate resolution. Vague concerns ("looks wrong") are less actionable — prefer concrete.',
	"- **Just log the finding** — don't pre-classify cross-stage placement. The pre-tick triage gate is the single point that relocates misplaced feedback via `haiku_feedback_move`. If you suspect the root cause is upstream, mention it in the body and let triage decide.",
	`- A stage's retry budget is TIGHT: agent-invoked rejection cycles are capped at ${MAX_STAGE_ITERATIONS} iterations (\`MAX_STAGE_ITERATIONS=${MAX_STAGE_ITERATIONS}\`). Beyond that, the framework escalates to the human — repeated rejections indicate a spec problem the pre-execute review should have caught, and the correct response is to fix the plan, not keep building against a broken plan.`,
	"",
	"#### Red flags (STOP and re-read this contract if you catch yourself thinking)",
	"",
	'- "This finding is trivial, I\'ll just fix it myself" — file write = scope violation; log it as feedback no matter how small.',
	"- \"The mandate doesn't quite cover this, but it's clearly wrong\" — if it's in your mandate's spirit, log it; if not, leave it for another agent.",
	"- **Did you open the artifact at HEAD, or are you reading the diff alone?** The diff lies about deletions, renames, and unchanged-but-relevant context. Read both — the diff for what changed, the artifact for the surrounding code that constrains the change.",
	'- "I\'ll batch related concerns into one finding" — atomic findings let the fix loop dispatch in parallel; merged findings serialize.',
	"- \"This finding's root cause is upstream, I'll route it through this stage's hats anyway\" — log the finding here; the pre-tick triage gate will move it to the right stage at the next tick. Don't try to bypass triage by force-fixing the wrong stage's artifacts.",
	"- \"It's not on my checklist, so I'll skip it\" — if your mandate has `interpretation: lens`, the checklist is examples; the mandate is the lens. In-spirit findings count.",
	'- "I was dispatched, I should find something" — out-of-mandate findings are noise; zero findings is a valid result for a clean review.',
	'- "It passes the literal check but it\'s clearly wrong" — the spirit-violation IS the finding. State the spirit-violation explicitly in the body.',
].join("\n")
