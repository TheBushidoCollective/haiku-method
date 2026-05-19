// orchestrator/prompts/intent_completion_fix/index.ts — Studio-level
// fix loop. Per-finding chain: studio fix-hats run serially via
// relay (each hat calls haiku_feedback_advance_hat and returns the
// next hat's <subagent> block for the parent to spawn); chains run
// in parallel across findings. Dispatch is built in reverse hat
// order so every hat's prompt embeds the next hat's relay block at
// write time. Only the first hat's dispatch block is surfaced to
// the parent.

import { existsSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import { getCapabilities } from "../../../../harness.js"
import {
	findHaikuRoot,
	isGitRepo,
	MAX_FIX_LOOP_BOLTS,
} from "../../../../state-tools.js"
import { readStudioFixHatPaths } from "../../../../studio-reader.js"
import { writeNextRelaySidecar } from "../../../../subagent-prompt-file.js"
import {
	buildInterpretationBlock,
	buildPriorFeedbackRejectBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	readInterpretation,
	resolveStudioMandateModel,
} from "../../_helpers.js"
import { loadTemplate } from "../../_load-template.js"
import { sharedBlockRef } from "../../_shared/index.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

interface FixItem {
	feedback_id: string
	feedback_file: string
	feedback_title: string
	bolt: number
	worktree?: string | null
	branch?: string | null
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const fixHatsList = (action.fix_hats as string[]) || []
	const fixMaxBolts = (action.max_bolts as number) || MAX_FIX_LOOP_BOLTS
	const items = (action.items as FixItem[]) || []
	const totalPending = (action.total_pending as number) || items.length
	const escalatedCount = (action.escalated_count as number) || 0
	const haikuRoot = findHaikuRoot()
	const fixHatPaths = readStudioFixHatPaths(studio)

	const findings = items.map(
		({
			feedback_id: fbId,
			feedback_file: fbFile,
			feedback_title: fbTitle,
			bolt: fixBolt,
			worktree: fbWorktree,
			branch: fbBranch,
		}) => {
			const fbAbsPath = join(haikuRoot, fbFile)
			const fbNum = Number.parseInt(fbId.replace(/^FB-/i, ""), 10) || 0
			const warnings: string[] = []
			let nextHatRelayBlock: string | null = null
			let firstHatBlock = ""

			for (let hatIdx = fixHatsList.length - 1; hatIdx >= 0; hatIdx--) {
				const hat = fixHatsList[hatIdx]
				const hatPath = fixHatPaths[hat]
				if (!hatPath) {
					warnings.push(
						`> **Warning:** studio fix-hat \`${hat}\` has no mandate file in \`plugin/studios/${studio}/fix-hats/${hat}.md\`. The subagent will run without a mandate — this is likely a studio bug.`,
					)
				}
				const isLast = hatIdx === fixHatsList.length - 1

				const hatMandateInline =
					hatPath && existsSync(hatPath)
						? inlineFile(hatPath, `Fix-hat mandate: ${hat}`)
						: ""
				const hatInterpBlock =
					hatPath && existsSync(hatPath)
						? buildInterpretationBlock(readInterpretation(hatPath))
						: ""
				const fbInline = existsSync(fbAbsPath)
					? inlineFile(fbAbsPath, `Feedback: ${fbId} — ${fbTitle}`)
					: ""
				const priorRejectBlock = existsSync(fbAbsPath)
					? buildPriorFeedbackRejectBlock(fbAbsPath)
					: ""

				const promptBody = eta.renderString(SUBAGENT_TEMPLATE, {
					hat,
					fbId,
					fbNum,
					fbTitle,
					fixBolt,
					fixMaxBolts,
					slug,
					fbWorktree,
					fbBranch,
					hatMandateInline,
					hatInterpBlock,
					fbInline,
					priorRejectBlock,
					gitRepo: isGitRepo(),
					isLast,
				})

				const fixHatModel = hatPath
					? resolveStudioMandateModel({ mandatePath: hatPath, studio })
					: undefined
				const dispatchBlock = emitSubagentDispatchBlock({
					unit: `fix-${fbId}`,
					hat,
					bolt: fixBolt,
					intent: slug,
					agentType: "general-purpose",
					model: fixHatModel,
					promptBody,
					heading: `#### Subagent: \`${hat}\`${isLast ? " (final — validates closure)" : " (relays next hat to parent)"}`,
				})

				if (!isLast && nextHatRelayBlock) {
					try {
						writeNextRelaySidecar(
							{ unit: `fix-${fbId}`, hat, bolt: fixBolt, intent: slug },
							nextHatRelayBlock,
						)
					} catch {
						/* Best-effort. */
					}
				}

				nextHatRelayBlock = dispatchBlock
				if (hatIdx === 0) {
					firstHatBlock = dispatchBlock
				}
			}

			return {
				fbId,
				fbTitle,
				fixBolt,
				warnings: warnings.join("\n"),
				firstHatBlock,
			}
		},
	)

	const bgClause = getCapabilities().subagents.backgroundSpawn
		? '`background="true"` → `run_in_background: true` (always present on fix-loop dispatches — pass it through; the parent waits on results, so foreground would block this thread); '
		: ""

	return eta.renderString(TEMPLATE, {
		slug,
		itemCount: items.length,
		fixHatsList,
		fixMaxBolts,
		escalatedCount,
		totalPending,
		showTotalsLine: totalPending !== items.length + escalatedCount,
		showAnnouncement: items.length > 1,
		announcementBlock: sharedBlockRef("workflow-contracts-announcement"),
		workflowContractsBlock: sharedBlockRef("workflow-contracts-fix-loop"),
		findings,
		bgClause,
	})
})
