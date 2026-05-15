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
import {
	buildFeedbackAssessorPrompt,
	buildOutputRequirements,
	resolveStudioFilePath,
} from "../../../../../orchestrator.js"
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
	readInterpretation,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { SUBAGENT_ERROR_RECOVERY } from "../../../_shared/index.js"
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
const TICKETING_NOTE = loadTemplate(import.meta.url, "blocks/ticketing-note.md")
const PARENT_INSTRUCTIONS_TPL = loadTemplate(
	import.meta.url,
	"blocks/parent-instructions.eta.md",
)
const PARENT_INSTRUCTIONS_ASSESSOR_TPL = loadTemplate(
	import.meta.url,
	"blocks/parent-instructions-assessor.eta.md",
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
		const assessorPrompt = buildFeedbackAssessorPrompt({
			slug,
			studio,
			stage,
			unit,
			bolt,
			worktreePath,
			intentRoot,
			unitAbsPath,
			closes,
			feedbackFiles,
			unitOutputs,
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

	const prompt: string[] = [
		`You are executing unit **${unit}** as hat **${hat}** (bolt ${bolt}) in stage **${stage}** of studio **${studio}** for intent **${slug}**.`,
		"",
	]
	if (worktreePath) {
		prompt.push(
			`**Unit worktree:** \`${worktreePath}\` (intent dir: \`${intentRoot}\`). Read and write the intent files at this path — it contains any prior-hat commits not yet merged to the parent branch. **Your FIRST Bash command MUST be \`cd <worktree path>\`.** Every git, npm, node, and shell command that follows must run from inside the worktree. Git commits land on the unit's branch only if you are inside the worktree's tree. Absolute paths below are for Read/Write tool references, but shell-layer work (install, build, test, commit) requires the cwd to be the worktree. Verify with \`pwd\` after \`cd\` if in doubt.

${WORKTREE_AND_TIMEOUTS}`,
			"",
		)
	}
	prompt.push(REQUIRED_CONTEXT_PREAMBLE, "")
	if (stagePath) prompt.push(inlineFile(stagePath, "Stage scope"))
	if (executionPath)
		prompt.push(inlineFile(executionPath, "Execute-phase focus"))
	if (hatPath) {
		prompt.push(inlineFile(hatPath, `Hat: ${hat}`))
		const hatInterp = buildInterpretationBlock(readInterpretation(hatPath))
		if (hatInterp) prompt.push("", hatInterp)
	}
	prompt.push(inlineFile(unitAbsPath, `Unit spec: ${unit}`))
	if (outputsDir) prompt.push(`- Stage output templates — \`${outputsDir}/\``)

	const priorRejectBlock = buildPriorRejectBlock(unitFile)
	if (priorRejectBlock) prompt.push("", priorRejectBlock)

	if (unitInputPaths.length > 0) {
		prompt.push(
			"",
			"## Unit inputs (MUST read — scoped to this unit)",
			"Inputs may be markdown, HTML, SVG, PNG/JPG, or PDF — fetch each with the appropriate tool.",
			"",
			...unitInputPaths.map((p) => `- \`${join(intentRoot, p)}\``),
		)
	}
	if (upstreamPaths.length > 0) {
		prompt.push(
			"",
			"## Available upstream artifacts (stage-wide — read what's relevant)",
			"Not required reading — open only what your unit's scope needs.",
			"",
			...upstreamPaths.map(
				(p) => `- **${p.label}** — \`${join(intentRoot, p.path)}\``,
			),
		)
	}
	if (outputReqs) {
		prompt.push("", outputReqs)
	}

	// Applicable skills — annotated by the elaborator on the unit spec.
	if (unitApplicableSkills.length > 0) {
		const installedIndex = new Map(
			listInstalledSkills().map((s) => [s.slug, s]),
		)
		const skillLines = unitApplicableSkills.map((slug) => {
			const skill = installedIndex.get(slug)
			const desc = skill?.description ? ` — ${skill.description}` : ""
			return `- \`/${slug}\`${desc}`
		})
		prompt.push("", SKILLS_PREAMBLE, "", ...skillLines)
	}

	prompt.push("", "## Instructions", "")
	let step = 1
	if (action.action === "start_unit") {
		prompt.push(
			`${step++}. Call \`haiku_unit_start { intent: "${slug}", unit: "${unit}" }\``,
		)
	}
	if (worktreePath) {
		prompt.push(
			`${step++}. Commit frequently inside the worktree: \`git add -A && git commit -m "..."\`. Do NOT push.`,
		)
	}
	const isFirstHat = hat === (hats[0] || "")
	prompt.push(
		`${step++}. When done: call \`haiku_unit_advance_hat { intent: "${slug}", unit: "${unit}" }\``,
		isFirstHat
			? `${step++}. **If blocked**, you are the first hat in this stage's hat sequence — there is no previous hat to reject back to. Do NOT call \`haiku_unit_reject_hat\`. Instead: surface ambiguity via \`AskUserQuestion\` (or \`ask_user_visual_question\` for visual decisions); if upstream-stage outputs are missing, log a stage_revisit feedback at the upstream stage via \`haiku_feedback { intent: "${slug}", stage: "<earlier-stage>", title: "<upstream gap>", body: "<what's missing>", origin: "agent", resolution: "stage_revisit" }\` and call \`haiku_run_next\`; if you've found a real defect in the spec or upstream artifact, log it via \`haiku_feedback\`. The first hat escalates outward, not backward.`
			: `${step++}. If blocked: call \`haiku_unit_reject_hat { intent: "${slug}", unit: "${unit}" }\``,
		`${step++}. **CRITICAL — Relay the Workflow Result path.** When \`advance_hat\`${isFirstHat ? "" : " or `reject_hat`"} returns, its tool response contains a result-file path and instructs you to reply with exactly \`Workflow Result: <path>\`. Your FINAL MESSAGE to the parent MUST BE EXACTLY that one line — nothing before, nothing after. Do NOT summarize the work, do NOT describe what you did, do NOT paraphrase the result. The parent reads the file to drive the next workflow action. If the tool returned plaintext instead of a result path (e.g. "job ends here — parent will call haiku_run_next"), relay THAT plaintext verbatim as your final message.`,
		`${step++}. Track outputs in unit frontmatter \`outputs:\` field`,
		`${step++}. If outputs from a previous stage are missing: log a stage_revisit feedback at that stage via \`haiku_feedback { intent: "${slug}", stage: "<earlier-stage>", title: "<missing output>", body: "<what's needed>", origin: "agent", resolution: "stage_revisit" }\` and call \`haiku_run_next\` — the pre-tick gate routes the rewind.`,
		"",
		AUTONOMY_NOTE,
		"",
		SUBAGENT_ERROR_RECOVERY,
	)

	if (unitCaps.subagents.supported) {
		const promptBody = inlineCtx
			? `${inlineCtx}\n\n${prompt.join("\n")}`
			: prompt.join("\n")
		sections.push(
			emitSubagentDispatchBlock({
				unit,
				hat,
				bolt,
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
			`### Mechanics (Direct Execution)\n\n**Execute the "${hat}" hat work directly** — your harness does not support subagents.\n\n${prompt.join("\n")}`,
		)
	}

	// Check for ticketing provider — move ticket to "In Progress".
	if (action.action === "start_unit") {
		try {
			const settingsPath = join(process.cwd(), ".haiku", "settings.yml")
			if (existsSync(settingsPath)) {
				const settingsRaw = readFileSync(settingsPath, "utf8")
				if (settingsRaw.includes("ticketing")) {
					sections.push(TICKETING_NOTE)
				}
			}
		} catch {
			/* non-fatal */
		}
	}

	return sections.join("\n\n")
})
