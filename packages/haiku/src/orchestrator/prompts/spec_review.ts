// orchestrator/prompts/spec_review.ts — Engine spec-conformance gate.
//
// Universal hard gate. Fires between `execute` and the parallel quality
// review on every stage of every intent. No per-studio mandate file, no
// opt-out — every intent has a spec, every stage produces something the
// intent scoped, so every stage benefits.
//
// Findings are persisted via `haiku_feedback`; any open spec finding
// flows through the normal `review_fix` loop before quality review fires.
//
// Why an engine phase, not a per-studio review agent? "Did the work
// deliver what the spec scoped?" is a universal invariant of every
// agent-driven workflow. Putting it in `review-agents/` made it studio-
// configurable (and silently absent in studios nobody updated) for
// something that should always run.

import { getMainlineBranch } from "../../git-worktree.js"
import { getCapabilities } from "../../harness.js"
import { isGitRepo } from "../../state-tools.js"
import {
	batchDispatchDirective,
	emitSubagentDispatchBlock,
} from "./_helpers.js"
import { definePromptBuilder } from "./define.js"
import { WORKFLOW_CONTRACTS_REVIEW_BLOCK } from "./WORKFLOW_CONTRACTS_REVIEW_BLOCK.js"

const SPEC_CONFORMANCE_MANDATE = [
	"**Mandate:** Verify that all completed units in this stage collectively delivered exactly what the intent's spec scoped — no more, no less.",
	"",
	"**Focus (cross-unit, intent-level — NOT individual unit compliance):**",
	"",
	"- Read the full intent spec: acceptance criteria, behavioral spec, data contracts, and design constraints from upstream stages. These are the source of truth for what was scoped.",
	"- Map each acceptance criterion to the completed unit(s) that satisfy it. Flag any criterion that no unit addresses.",
	"- Flag **scope creep** — functionality implemented across one or more units that has no corresponding criterion in the intent spec.",
	"- Flag **missed criteria** — spec criteria that are not addressed by any completed unit, in whole or in part.",
	"- Flag **cross-unit drift** — cases where multiple units together were supposed to collectively satisfy a criterion but their combination falls short or contradicts the spec (e.g. unit A implements half a behavior, unit B contradicts it, the spec requires both halves).",
	"",
	"**Hard rule:** _A perfect implementation of the wrong thing is still wrong._ Quality review does not fire until this gate passes.",
	"",
	"**Explicit out-of-scope:**",
	"",
	"- Do **NOT** flag code quality concerns (architecture, performance, security, test coverage) — those belong to the quality reviewers that run after this gate.",
	"- Do **NOT** re-audit per-unit compliance for individual units — the per-unit `verifier` hat already does that. Focus on what only emerges _across_ units at the stage level.",
	"- Do **NOT** flag aspirational improvements beyond the stated spec. The spec is the contract; delivering exactly the spec is a pass.",
].join("\n")

export default definePromptBuilder(({ slug, action }) => {
	const stage = action.stage as string
	const sections: string[] = []

	sections.push(WORKFLOW_CONTRACTS_REVIEW_BLOCK)

	sections.push(`## Spec-Conformance Gate: ${stage}`)
	sections.push(
		[
			"**Purpose:** Verify that all completed units collectively delivered exactly what the intent scoped — no more, no less.",
			"**Hard rule:** _A perfect implementation of the wrong thing is still wrong._ Quality review does not fire until this gate passes.",
			"**After this gate:** If spec findings are filed, the fix loop runs. Once all spec findings are resolved, quality review (architecture, correctness, performance, security, test-quality) fires.",
		].join("\n"),
	)

	const reviewLines: string[] = [
		`You are the **spec-conformance** gate agent for stage "${stage}" of intent "${slug}". You are the universal engine-level spec checker — you have no per-studio mandate file. The mandate is below.`,
		"",
		"## Mandate",
		"",
		SPEC_CONFORMANCE_MANDATE,
		"",
		"## Write scope (STRICT)",
		"**You MUST NOT write, edit, or create any file.** Your ONLY output channel is the `haiku_feedback` MCP tool. Any file write is a scope violation.",
		"",
		"## Instructions",
		"",
		"1. Use the mandate above as the lens for this spec-conformance check.",
	]
	let step = 2
	if (isGitRepo()) {
		reviewLines.push(
			`${step++}. Run \`git diff ${getMainlineBranch()}...HEAD\` to get the current diff for this stage.`,
		)
	}
	reviewLines.push(
		`${step++}. Read the stage's output artifacts in \`.haiku/intents/${slug}/stages/${stage}/\` (types vary — use the appropriate tool for each file).`,
		`${step++}. Read the intent spec: \`.haiku/intents/${slug}/intent.md\` plus any upstream-stage outputs that established acceptance criteria, behavioral spec, data contracts, or design constraints.`,
		`${step++}. Map criteria → units. For each acceptance criterion, identify which completed unit(s) satisfy it. Flag gaps.`,
		`${step++}. For each spec violation found, call \`haiku_feedback({ intent: "${slug}", stage: "${stage}", title: "<short title>", body: "<full description with file:line refs and which spec criterion was violated>", origin: "adversarial-review", author: "spec-conformance" })\`.`,
		`${step++}. Return only a summary count of how many spec findings you logged.`,
	)
	const prompt = reviewLines.join("\n")

	sections.push(
		"### Spec-Conformance Subagent (REQUIRED)\n\n**Spawn exactly one subagent for the spec-conformance check — no duplicates.** The block below is a complete prompt; relay verbatim.\n",
	)
	sections.push(
		`${emitSubagentDispatchBlock({
			unit: `spec-review-${stage}`,
			hat: "spec-conformance",
			bolt: 1,
			agentType: "general-purpose",
			model: undefined,
			promptBody: prompt,
			heading: "#### Subagent: `spec-conformance`",
		})}\n`,
	)

	const bgLine = getCapabilities().subagents.backgroundSpawn
		? ' The `<subagent>` carries `background="true"` — pass `run_in_background: true` to the Task tool so the parent thread stays responsive while the spec-gate agent runs.'
		: ""
	sections.push(
		[
			"### Parent Instructions (do NOT include in subagent prompts)",
			"",
			`Spawn the spec-conformance subagent using the \`prompt_file\` attribute — pass \`"Read <prompt_file> and execute its instructions exactly."\` as the spawn prompt. It persists findings directly via haiku_feedback.${bgLine}`,
			"",
			batchDispatchDirective(1, "spec-conformance subagent"),
			"",
			`After the spec-conformance subagent completes, call \`haiku_run_next { intent: "${slug}" }\`. If it filed findings, the fix loop will run before quality review fires. If it filed no findings, quality review will proceed automatically on the next tick.`,
		].join("\n"),
	)

	return sections.join("\n\n")
})
