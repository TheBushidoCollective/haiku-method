// orchestrator/prompts/start_unit/index.ts — Spawn a single unit's
// hat subagent. Handles two action shapes (start_unit and
// continue_unit share this builder — same body, only `action.action`
// differs and the `start_unit` path adds an extra `haiku_unit_start`
// step).
//
// Big picture per dispatch:
//   1. Resolve stage scope, execute-phase mandate, hat mandate, and
//      output templates as path-only inlines.
//   2. Read unit frontmatter for inputs + model hints.
//   3. Resolve cascade for model selection (unit > hat > stage > studio).
//   4. Filter unit `inputs:` to ones that exist + escape-safe within
//      the intent dir; merge in stage-wide upstream artifacts.
//   5. If the hat is `feedback-assessor`, dispatch the alternate
//      assessor prompt (verification, not production).
//   6. Otherwise emit the standard hat dispatch with workflow contract
//      reminders, scope, and the advance/reject/error-recovery flow.
//
// Static prose blocks (worktree+timeouts, parent instructions,
// autonomy note, ticketing block) live as `.md` siblings under
// `blocks/` so the prose is editable as markdown rather than trapped
// in template literals.

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { Eta } from "eta"
import { features } from "../../../../../config.js"
import { getCapabilities } from "../../../../../harness.js"
import { type ModelTier, resolveModel } from "../../../../../model-selection.js"
// Import directly from the source modules to avoid a circular dep
// through `orchestrator.js`'s re-export barrel: orchestrator.js loads
// `prompts/index.js` (the prompt-builder map), which loads this file.
// Going through the barrel produces a TDZ on `start_unit` at the map
// construction site.
import { buildOutputRequirements } from "../../../../validators.js"
import { resolveStudioFilePath } from "../../../../studio.js"
import {
	listInstalledSkills,
	parseFrontmatter,
	readFeedbackFiles,
} from "../../../../../state-tools.js"
import {
	readHatDefs,
	readStageDef,
	readStudio,
	resolveStageInputs,
} from "../../../../../studio-reader.js"
import {
	buildInlineSubagentContext,
	buildInterpretationBlock,
	buildPriorRejectBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	inlineFiles,
	readInterpretation,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { sharedBlockRef } from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })

const WORKTREE_AND_TIMEOUTS = loadTemplate(
	import.meta.url,
	"blocks/worktree-and-timeouts.md",
)
const REQUIRED_CONTEXT_PREAMBLE = loadTemplate(
	import.meta.url,
	"blocks/required-context-preamble.md",
)
const SKILLS_PREAMBLE = loadTemplate(
	import.meta.url,
	"blocks/skills-preamble.md",
)
const AUTONOMY_NOTE = loadTemplate(import.meta.url, "blocks/autonomy-note.md")
const PARENT_INSTRUCTIONS_TPL = loadTemplate(
	import.meta.url,
	"blocks/parent-instructions.eta.md",
)
const PARENT_INSTRUCTIONS_ASSESSOR_TPL = loadTemplate(
	import.meta.url,
	"blocks/parent-instructions-assessor.eta.md",
)
const UNIT_SUBAGENT_TPL = loadTemplate(
	import.meta.url,
	"blocks/unit-subagent.eta.md",
)
const FEEDBACK_ASSESSOR_TPL = loadTemplate(
	import.meta.url,
	"blocks/feedback-assessor.eta.md",
)

export default definePromptBuilder(({ slug, studio, action, dir }) => {
	const stage = action.stage as string
	const unit = (action.unit as string) || ""
	const hat = (action.hat as string) || (action.first_hat as string) || ""
	const hats = (action.hats as string[]) || []
	const bolt = (action.bolt as number) || 1

	// Resolve file paths (NOT content). Subagent reads each file itself.
	const stagePath = resolveStudioFilePath(
		join(studio, "stages", stage, "STAGE.md"),
	)
	const executionPath = resolveStudioFilePath(
		join(studio, "stages", stage, "phases", "EXECUTION.md"),
	)
	const hatPath = resolveStudioFilePath(
		join(studio, "stages", stage, "hats", `${hat}.md`),
	)
	const outputsDir = resolveStudioFilePath(
		join(studio, "stages", stage, "outputs"),
	)

	const unitFile = join(
		dir,
		"stages",
		stage,
		"units",
		unit.endsWith(".md") ? unit : `${unit}.md`,
	)

	// Migration recovery for intents committed before the haiku_unit_set
	// type gate landed: legacy `inputs: >- ["..."]` (folded-scalar JSON)
	// surfaces here as a string. Detect and parse.
	let unitInputs: string[] = []
	let unitModel: string | undefined
	let unitApplicableSkills: string[] = []
	if (existsSync(unitFile)) {
		const { data } = parseFrontmatter(readFileSync(unitFile, "utf8"))
		const rawInputs = data.inputs
		if (Array.isArray(rawInputs)) {
			unitInputs = rawInputs.filter((r): r is string => typeof r === "string")
		} else if (typeof rawInputs === "string") {
			const trimmed = rawInputs.trim()
			if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
				try {
					const parsed = JSON.parse(trimmed)
					if (Array.isArray(parsed)) {
						unitInputs = parsed.filter(
							(r): r is string => typeof r === "string",
						)
					}
				} catch {
					/* leave unitInputs empty */
				}
			}
		}
		unitModel = (data.model as string) || undefined
		if (Array.isArray(data.applicable_skills)) {
			unitApplicableSkills = (data.applicable_skills as unknown[]).filter(
				(s): s is string => typeof s === "string",
			)
		}
	}

	const hatDefs = readHatDefs(studio, stage)
	const hatDef = hatDefs[hat]
	const hatAgentType = hatDef?.agent_type || "general-purpose"

	let resolvedModel: ModelTier | undefined
	if (features.modelSelection) {
		const stageDef = readStageDef(studio, stage)
		const studioData = readStudio(studio)
		const { model, source } = resolveModel({
			unit: unitModel,
			hat: hatDef?.model,
			stage: stageDef?.data?.default_model as string | undefined,
			studio: studioData?.data?.default_model as string | undefined,
		})
		resolvedModel = model
		if (resolvedModel) {
			console.error(
				`[haiku] resolved model: ${resolvedModel} (source: ${source})`,
			)
		}
	}

	// Per-unit inputs (scoped) — paths only.
	const unitInputPaths: string[] = []
	{
		const dirResolved = resolve(dir)
		for (const ref of unitInputs) {
			const refResolved = resolve(dir, ref)
			if (
				!refResolved.startsWith(`${dirResolved}/`) &&
				refResolved !== dirResolved
			)
				continue
			if (existsSync(join(dir, ref))) unitInputPaths.push(ref)
		}
	}

	// Stage-wide upstream artifacts (shared, optional) — paths only.
	const upstreamPaths: Array<{ label: string; path: string }> = []
	{
		const stageDef = readStageDef(studio, stage)
		if (stageDef?.data?.inputs && Array.isArray(stageDef.data.inputs)) {
			const stageInputDefs = stageDef.data.inputs as Array<{
				stage: string
				discovery?: string
				output?: string
			}>
			const resolvedInputs = resolveStageInputs(
				studio,
				stageInputDefs,
				dir,
				slug,
			)
			const found = resolvedInputs.filter((r) => r.exists)
			const inputSet = new Set(unitInputs.map((r) => resolve(dir, r)))
			for (const r of found) {
				if (inputSet.has(resolve(r.resolvedPath))) continue
				const relPath = r.resolvedPath.startsWith(`${dir}/`)
					? r.resolvedPath.slice(dir.length + 1)
					: r.resolvedPath
				upstreamPaths.push({
					label: `${r.stage}/${r.artifactName}`,
					path: relPath,
				})
			}
		}
	}

	const outputReqs = buildOutputRequirements(studio, stage)

	const worktreePath = (action.worktree as string) || ""
	const intentRoot = worktreePath
		? join(worktreePath, ".haiku", "intents", slug)
		: dir
	const unitAbsPath = join(
		intentRoot,
		"stages",
		stage,
		"units",
		unit.endsWith(".md") ? unit : `${unit}.md`,
	)
	const unitCaps = getCapabilities()

	const inlineCtx = buildInlineSubagentContext(slug, stage, hat, hats, bolt)

	const sections: string[] = []

	// Feedback-assessor hat gets an entirely different prompt body —
	// its job is verification, not production.
	if (hat === "feedback-assessor") {
		const unitFm = existsSync(unitFile)
			? parseFrontmatter(readFileSync(unitFile, "utf8")).data
			: {}
		const closes = (unitFm.closes as string[]) || []
		const unitOutputs = (unitFm.outputs as string[]) || []
		const feedbackFiles: Array<{ id: string; file: string }> = []
		const allFeedback = readFeedbackFiles(slug, stage)
		for (const fbId of closes) {
			const found = allFeedback.find((f) => f.id === fbId)
			if (found)
				feedbackFiles.push({
					id: found.id,
					file: found.file.startsWith(".haiku/intents/")
						? found.file.slice(`.haiku/intents/${slug}/`.length)
						: found.file,
				})
		}
		// Inline every artifact the assessor needs to verify closure —
		// unit spec (for `closes:` array), each unit output, and every
		// claimed-closed FB body. The assessor is one-shot; pre-loading
		// these files saves a Read tool call per artifact.
		const unitInline = inlineFile(unitAbsPath, `Unit spec: ${unit}`)
		const outputsInline = inlineFiles(
			unitOutputs.map((o) => ({
				heading: `Unit output: ${o}`,
				path: join(intentRoot, o),
			})),
		)
		const feedbackInline = inlineFiles(
			feedbackFiles.map((f) => ({
				heading: `Feedback ${f.id}`,
				path: join(intentRoot, f.file),
			})),
		)
		const assessorPrompt = eta.renderString(FEEDBACK_ASSESSOR_TPL, {
			slug,
			stage,
			unit,
			bolt,
			worktreePath,
			intentRoot,
			unitInline,
			outputsInline,
			feedbackInline,
		})
		if (unitCaps.subagents.supported) {
			const assessorBody = inlineCtx
				? `${inlineCtx}\n\n${assessorPrompt}`
				: assessorPrompt
			sections.push(
				emitSubagentDispatchBlock({
					unit,
					hat,
					bolt,
					intent: slug,
					stage,
					agentType: hatAgentType,
					model: resolvedModel,
					promptBody: assessorBody,
					toolAttr: true,
				}),
			)
			sections.push(
				eta.renderString(PARENT_INSTRUCTIONS_ASSESSOR_TPL, {
					backgroundSpawn: unitCaps.subagents.backgroundSpawn,
				}),
			)
		} else {
			if (inlineCtx) sections.push(inlineCtx)
			sections.push(
				`### Feedback Assessor (Direct Execution)\n\n${assessorPrompt}`,
			)
		}
		return sections.join("\n\n")
	}

	const isFirstHat = hat === (hats[0] || "")
	const installedIndex = new Map(
		listInstalledSkills().map((s) => [s.slug, s]),
	)
	const skillLines =
		unitApplicableSkills.length > 0
			? unitApplicableSkills.map((s) => {
					const skill = installedIndex.get(s)
					const desc = skill?.description ? ` — ${skill.description}` : ""
					return `- \`/${s}\`${desc}`
				})
			: []
	const hatInterpBlock = hatPath
		? buildInterpretationBlock(readInterpretation(hatPath))
		: ""
	const unitPromptBody = eta.renderString(UNIT_SUBAGENT_TPL, {
		unit,
		hat,
		bolt,
		stage,
		studio,
		slug,
		worktreePath,
		intentRoot,
		worktreeAndTimeoutsBlock: WORKTREE_AND_TIMEOUTS,
		requiredContextPreamble: REQUIRED_CONTEXT_PREAMBLE,
		stageInline: stagePath ? inlineFile(stagePath, "Stage scope") : "",
		executionInline: executionPath
			? inlineFile(executionPath, "Execute-phase focus")
			: "",
		hatInline: hatPath ? inlineFile(hatPath, `Hat: ${hat}`) : "",
		hatInterpBlock,
		unitInline: inlineFile(unitAbsPath, `Unit spec: ${unit}`),
		outputsDir: outputsDir || "",
		priorRejectBlock: buildPriorRejectBlock(unitFile),
		unitInputPaths: unitInputPaths.map((p) => join(intentRoot, p)),
		upstreamPaths: upstreamPaths.map((p) => ({
			label: p.label,
			path: join(intentRoot, p.path),
		})),
		outputReqs: outputReqs || "",
		skillLines,
		skillsPreamble: SKILLS_PREAMBLE,
		isStartUnit: action.action === "start_unit",
		isFirstHat,
		autonomyNote: AUTONOMY_NOTE,
		subagentErrorRecovery: sharedBlockRef("subagent-error-recovery"),
	})

	if (unitCaps.subagents.supported) {
		const promptBody = inlineCtx
			? `${inlineCtx}\n\n${unitPromptBody}`
			: unitPromptBody
		sections.push(
			emitSubagentDispatchBlock({
				unit,
				hat,
				bolt,
				intent: slug,
				stage,
				agentType: hatAgentType,
				model: resolvedModel,
				promptBody,
				toolAttr: true,
			}),
		)
		sections.push(
			eta.renderString(PARENT_INSTRUCTIONS_TPL, {
				backgroundSpawn: unitCaps.subagents.backgroundSpawn,
			}),
		)
	} else {
		// Subagentless: direct execution in current context.
		if (inlineCtx) sections.push(inlineCtx)
		sections.push(
			`### Mechanics (Direct Execution)\n\n**Execute the "${hat}" hat work directly** — your harness does not support subagents.\n\n${unitPromptBody}`,
		)
	}

	// Ticketing-provider "move to In Progress" hint used to inject
	// here from a string match on settings.yml. Replaced 2026-05-19
	// by the provider-injection layer — start_unit_hat carries the
	// full ticketing contract via `providerSpliceBlock("execute", dir)`,
	// which includes status-sync direction.

	return sections.join("\n\n")
})
