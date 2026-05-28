// orchestrator/prompts/review_fix/index.ts — Stage-scope fix loop.
// Same shape as intent_completion_fix but stage-scoped. Per-finding
// hat chain runs serially via relay (each hat calls
// haiku_feedback_advance_hat and returns the next hat's <subagent>
// block for the parent to spawn); chains run in parallel across
// findings. Dispatch is built in reverse hat order so every hat's
// prompt embeds the next hat's relay block at write time. Only the
// first hat's dispatch block is surfaced to the parent.

import { existsSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import { resolvePluginRoot } from "../../../../config.js"
import { getCapabilities } from "../../../../harness.js"
import {
	findHaikuRoot,
	isGitRepo,
	MAX_FIX_LOOP_BOLTS,
} from "../../../../state-tools.js"
import { readHatDefs, resolveStudio } from "../../../../studio-reader.js"
import { writeNextRelaySidecar } from "../../../../subagent-prompt-file.js"
import { resolveStudioFilePath } from "../../../studio.js"
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
	const fixStage = action.stage as string
	const fixHatsList = (action.fix_hats as string[]) || []
	const fixMaxBolts = (action.max_bolts as number) || MAX_FIX_LOOP_BOLTS
	const items = (action.items as FixItem[]) || []
	const totalPending = (action.total_pending as number) || items.length
	const escalatedCount = (action.escalated_count as number) || 0
	const haikuRoot = findHaikuRoot()

	const allHats = readHatDefs(studio, fixStage)
	const studioInfo = resolveStudio(studio)
	const studioDir = studioInfo ? studioInfo.dir : studio
	const pluginRoot = resolvePluginRoot()
	const stageBasePath = resolveStudioFilePath(
		join(studioDir, "stages", fixStage, "STAGE.md"),
	)

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
				const hatDef = allHats[hat]
				if (!hatDef) {
					warnings.push(
						`> **Warning:** hat \`${hat}\` declared in \`fix_hats\` has no mandate file in \`hats/${hat}.md\`. The subagent will run without a mandate — this is likely a studio bug.`,
					)
				}
				const hatPath = hatDef
					? join(
							pluginRoot,
							"studios",
							studioDir,
							"stages",
							fixStage,
							"hats",
							`${hat}.md`,
						)
					: null

				const isLast = hatIdx === fixHatsList.length - 1

				const stageBaseInline = stageBasePath
					? inlineFile(stageBasePath, `Stage scope: ${fixStage}`)
					: ""
				const hatMandateInline =
					hatPath && existsSync(hatPath)
						? inlineFile(hatPath, `Hat mandate: ${hat}`)
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
					fixStage,
					slug,
					fbWorktree,
					fbBranch,
					stageBaseInline,
					hatMandateInline,
					hatInterpBlock,
					fbInline,
					priorRejectBlock,
					gitRepo: isGitRepo(),
					isLast,
				})

				const fixHatMandatePath = join(
					resolvePluginRoot(),
					"studios",
					studio,
					"stages",
					fixStage,
					"hats",
					`${hat}.md`,
				)
				const fixHatModel = resolveStudioMandateModel({
					mandatePath: fixHatMandatePath,
					studio,
					stage: fixStage,
				})
				const dispatchBlock = emitSubagentDispatchBlock({
					unit: `fix-${fbId}`,
					hat,
					bolt: fixBolt,
					intent: slug,
					stage: fixStage,
					agentType: hatDef?.agent_type ?? "general-purpose",
					model: fixHatModel ?? hatDef?.model,
					promptBody,
					heading: `#### Subagent: \`${hat}\`${isLast ? " (final — validates closure)" : " (relays next hat to parent)"}`,
				})

				if (!isLast && nextHatRelayBlock) {
					try {
						writeNextRelaySidecar(
							{
								unit: `fix-${fbId}`,
								hat,
								bolt: fixBolt,
								intent: slug,
								stage: fixStage,
							},
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
		fixStage,
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
