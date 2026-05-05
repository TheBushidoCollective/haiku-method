// orchestrator/prompts/spec_review.ts — Spec-conformance gate review.
//
// Runs BEFORE the parallel quality-review layer. Only spec-gate agents
// (frontmatter `spec_gate: true`) are dispatched here. Their mandate is
// cross-unit / intent-level spec conformance — did the units collectively
// deliver exactly what was scoped?
//
// Findings are persisted via haiku_feedback (not inline). Any open spec
// finding routes through the fix loop before quality review fires.
//
// Why separated from review.ts? Spec correctness gates quality relevance.
// Burning tokens on architecture / security / test-quality review against
// a wrong implementation wastes review capacity and pollutes the fix loop
// with orthogonal concerns.

import { join } from "node:path"
import { getMainlineBranch } from "../../git-worktree.js"
import { getCapabilities } from "../../harness.js"
import { findHaikuRoot, isGitRepo } from "../../state-tools.js"
import {
	filterReviewAgentsByScope,
	readSpecGateAgentPaths,
} from "../../studio-reader.js"
import {
	batchDispatchDirective,
	buildInterpretationBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	readInterpretation,
	resolveStudioMandateModel,
} from "./_helpers.js"
import { definePromptBuilder } from "./define.js"
import { WORKFLOW_CONTRACTS_REVIEW_BLOCK } from "./WORKFLOW_CONTRACTS_REVIEW_BLOCK.js"

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = action.stage as string
	const sections: string[] = []

	sections.push(WORKFLOW_CONTRACTS_REVIEW_BLOCK)

	let agentPaths: Record<string, string> = readSpecGateAgentPaths(studio, stage)

	agentPaths = filterReviewAgentsByScope(
		agentPaths,
		join(findHaikuRoot(), "intents", slug, "stages", stage, "artifacts"),
		{ studio, stage },
	)

	sections.push(`## Spec-Conformance Gate: ${stage}`)
	sections.push(
		[
			"**Purpose:** Verify that all completed units collectively delivered exactly what the intent scoped — no more, no less.",
			"**Hard rule:** _A perfect implementation of the wrong thing is still wrong._ Quality review does not fire until this gate passes.",
			"**After this gate:** If spec findings are filed, the fix loop runs. Once all spec findings are resolved, quality review (architecture, correctness, performance, security, test-quality) fires.",
		].join("\n"),
	)

	if (Object.keys(agentPaths).length > 0) {
		sections.push(
			"### Spec-Gate Agent Fan-Out (REQUIRED)\n\n**Spawn exactly one subagent per spec-gate agent in parallel — no duplicates.** Each `<subagent>` block below is a complete prompt — relay verbatim.\n",
		)
		for (const [name, mandatePath] of Object.entries(agentPaths)) {
			const interpretation = readInterpretation(mandatePath)
			const interpretiveBlock = buildInterpretationBlock(interpretation)
			const reviewLines: string[] = [
				`You are the **${name}** spec-conformance gate agent for stage "${stage}" of intent "${slug}".`,
				"",
				"## Required context (inlined below)",
				"Your spec-conformance mandate is embedded in this prompt.",
				"",
				inlineFile(mandatePath, `Mandate: ${name}`),
			]
			if (interpretiveBlock) {
				reviewLines.push("", interpretiveBlock)
			}
			reviewLines.push(
				"",
				"## Write scope (STRICT)",
				"**You MUST NOT write, edit, or create any file.** Your ONLY output channel is the `haiku_feedback` MCP tool. Any file write is a scope violation.",
				"",
				"## Instructions",
				"",
				"1. Use your mandate (above) as the lens for this spec-conformance check.",
			)
			let step = 2
			if (isGitRepo()) {
				reviewLines.push(
					`${step++}. Run \`git diff ${getMainlineBranch()}...HEAD\` to get the current diff for this stage.`,
				)
			}
			reviewLines.push(
				`${step++}. Read the stage's output artifacts in \`.haiku/intents/${slug}/stages/${stage}/\` (types vary — use the appropriate tool for each file).`,
				`${step++}. Read the intent spec: acceptance criteria, behavioral spec, data contracts, and design constraints from upstream stages. These are your source of truth for what was scoped.`,
				`${step++}. Review through your mandate's lens — cross-unit, intent-level only.`,
				`${step++}. For each spec violation found, call \`haiku_feedback({ intent: "${slug}", stage: "${stage}", title: "<short title>", body: "<full description with file:line refs and which spec criterion was violated>", origin: "adversarial-review", author: "${name}" })\`.`,
				`${step++}. Return only a summary count of how many spec findings you logged.`,
			)
			const prompt = reviewLines.join("\n")
			const reviewAgentModel = resolveStudioMandateModel({
				mandatePath,
				studio,
				stage,
			})
			sections.push(
				`${emitSubagentDispatchBlock({
					unit: `spec-review-${stage}`,
					hat: name,
					bolt: 1,
					agentType: "general-purpose",
					model: reviewAgentModel,
					promptBody: prompt,
					heading: `#### Subagent: \`${name}\``,
				})}\n`,
			)
		}
	}

	const bgLine = getCapabilities().subagents.backgroundSpawn
		? ' Each `<subagent>` carries `background="true"` — pass `run_in_background: true` to the Task tool so the parent thread stays responsive while spec-gate agents run.'
		: ""
	sections.push(
		[
			"### Parent Instructions (do NOT include in subagent prompts)",
			"",
			`Spawn spec-gate subagents using the \`prompt_file\` attribute — pass \`"Read <prompt_file> and execute its instructions exactly."\` as the spawn prompt. They persist findings directly via haiku_feedback.${bgLine}`,
			"",
			batchDispatchDirective(
				Object.keys(agentPaths).length,
				"spec-gate agents",
			),
			"",
			`After all spec-gate agents complete, call \`haiku_run_next { intent: "${slug}" }\`. If they filed findings, the fix loop will run before quality review fires. If they filed no findings, quality review will proceed automatically on the next tick.`,
		].join("\n"),
	)

	return sections.join("\n\n")
})
