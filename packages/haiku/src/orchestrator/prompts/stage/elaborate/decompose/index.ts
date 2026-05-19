// orchestrator/prompts/decompose/index.ts — Per-stage unit-spec
// writing. Renamed from `elaborate.ts` (2026-05-08) when the
// per-stage cursor action was split into two phases:
//   - `elaborate` — the human-conversation gate (separate file).
//   - `decompose` — this file. Writes unit specs, dispatches stage-
//     scoped discovery subagents, evaluates review-agent lenses.
//
// The split is the engine-side enforcement of the principle that
// every non-autopilot stage starts with a real conversation before
// any autonomous decomposition work fires.
//
// Three top-level branches by action shape:
//   1. Iterative re-entry — stage was entered with completed units
//      from a prior iteration. Treat completed units as knowledge,
//      decide whether new work is needed for this iteration.
//   2. Revisit (iteration > 1) — pending feedback drove a roll-back
//      to elaborate; emit the focused additive-elaboration block.
//   3. Fresh elaborate — full rendering: stage def, workflow
//      contracts, review-agent lenses (inlined), upstream input
//      REFERENCES (paths only), prior-stage REFERENCES, optional
//      discovery fan-out (early-return if any artifacts are pending),
//      then output expectations + design-provider hint + approach
//      selection + scope/mechanics.
//
// Static prose blocks live as `.md` (or `.eta.md` when they need
// interpolation) siblings under `blocks/`. Conditional assembly
// stays here — the file is heavy because the assembly is heavy, not
// because the prose is heavy.

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { Eta } from "eta"
import {
	createDiscoveryWorktree,
	discoveryBranchName,
} from "../../../../../git-worktree.js"
import { getCapabilities } from "../../../../../harness.js"
import {
	listInstalledSkills,
	parseFrontmatter,
} from "../../../../../state-tools.js"
import {
	filterReviewAgentsByScope,
	readPhaseOverride,
	readReviewAgentPaths,
	readStageDef,
	resolveStageInputs,
	studioSearchPaths,
} from "../../../../../studio-reader.js"
import {
	resolveIntentStages,
	resolveStudioFilePath,
} from "../../../../studio.js"
import { buildOutputRequirements } from "../../../../validators.js"
import {
	batchDispatchDirective,
	buildConcurrentElaborateLoopBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	providerSpliceBlock,
	readIntentMode,
	resolveStudioMandateModel,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { sharedBlockRef } from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"
import type { PromptBuilderContext } from "../../../types.js"

const eta = new Eta({ autoEscape: false, useWith: true })

const ITERATIVE_DECIDE_TPL = loadTemplate(
	import.meta.url,
	"blocks/iterative-decide.eta.md",
)
const LENS_PREAMBLE = loadTemplate(import.meta.url, "blocks/lens-preamble.md")
const SKILL_REGISTRY_PREAMBLE = loadTemplate(
	import.meta.url,
	"blocks/skill-registry-preamble.md",
)
const UPSTREAM_CONTEXT_HEADER = loadTemplate(
	import.meta.url,
	"blocks/upstream-context-header.md",
)
const PRIOR_STAGE_PREAMBLE = loadTemplate(
	import.meta.url,
	"blocks/prior-stage-preamble.md",
)
const PRIOR_STAGE_FOOTER = loadTemplate(
	import.meta.url,
	"blocks/prior-stage-footer.md",
)
const DESIGN_PROVIDER_MCPS = loadTemplate(
	import.meta.url,
	"blocks/design-provider-mcps.md",
)
const APPROACH_SELECTION_TPL = loadTemplate(
	import.meta.url,
	"blocks/approach-selection.eta.md",
)
const COLLABORATIVE_MECHANICS = loadTemplate(
	import.meta.url,
	"blocks/collaborative-mechanics.md",
)
const AUTONOMOUS_MECHANICS = loadTemplate(
	import.meta.url,
	"blocks/autonomous-mechanics.md",
)
const ELABORATE_OUTPUT_TAIL_TPL = loadTemplate(
	import.meta.url,
	"blocks/elaborate-output-tail.eta.md",
)
const SCOPE_HEADER = loadTemplate(import.meta.url, "blocks/scope-header.md")
const FILE_BASED_POINTER_TPL = loadTemplate(
	import.meta.url,
	"blocks/file-based-pointer.eta.md",
)
const DISCOVERY_SUBAGENT_TPL = loadTemplate(
	import.meta.url,
	"blocks/discovery-subagent.eta.md",
)
const REVIEW_AGENT_LENS_TPL = loadTemplate(
	import.meta.url,
	"blocks/review-agent-lens-section.eta.md",
)
const SKILL_REGISTRY_TPL = loadTemplate(
	import.meta.url,
	"blocks/skill-registry-section.eta.md",
)

interface PendingFeedback {
	feedback_id: string
	title: string
	origin: string
	author: string
	status: string
	file: string
}

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

/** Strip the YAML frontmatter from a review-agent file body so the
 *  inlined "lens" content is just the mandate prose. */
function readReviewAgentBody(absPath: string): string {
	if (!existsSync(absPath)) return ""
	const raw = readFileSync(absPath, "utf8")
	try {
		const { body } = parseFrontmatter(raw)
		return (body || raw).trim()
	} catch {
		return raw.trim()
	}
}

/** Build the per-stage review-agent lens section. Pulls every per-stage
 *  review agent that scopes to this stage's declared outputs (via
 *  `applies_to:` glob) and inlines its body under a per-agent
 *  subheading. */
function buildReviewAgentLensSection(
	studio: string,
	stage: string,
	dir: string,
): string | null {
	const agentPaths = filterReviewAgentsByScope(
		readReviewAgentPaths(studio, stage),
		join(dir, "stages", stage, "artifacts"),
		{ studio, stage },
	)
	const names = Object.keys(agentPaths).sort()
	if (names.length === 0) return null
	const entries = names
		.map((name) => {
			const body = readReviewAgentBody(agentPaths[name])
			if (!body) return null
			const heading = name
				.split(/[-_]/)
				.map((p) => (p.length === 0 ? p : p[0].toUpperCase() + p.slice(1)))
				.join(" ")
			return { heading, body }
		})
		.filter((e): e is { heading: string; body: string } => e !== null)
	if (entries.length === 0) return null
	return eta
		.renderString(REVIEW_AGENT_LENS_TPL, { preamble: LENS_PREAMBLE, entries })
		.trimEnd()
}

/** Build the "## Available Skills" injection block. */
function buildSkillRegistrySection(): string | null {
	const skills = listInstalledSkills()
	if (skills.length === 0) return null
	const skillLines = skills.map((skill) => {
		const desc = skill.description ? ` — ${skill.description}` : ""
		return `- \`/${skill.slug}\`${desc}`
	})
	return eta.renderString(SKILL_REGISTRY_TPL, {
		preamble: SKILL_REGISTRY_PREAMBLE,
		skillLines,
	})
}

// Exported so the workflow handler (`handlers/elaborate.ts`) can write
// the rendered body to a tmpfile and stamp `prompt_file` on the
// action, without going through `buildRunInstructions`. The
// registered prompt builder below short-circuits when
// `action.prompt_file` is set, so this is the only call site that
// produces the full body.
export function buildElaboratePromptBody(ctx: PromptBuilderContext): string {
	return renderElaborate(ctx)
}

function renderElaborate(ctx: PromptBuilderContext): string {
	const { slug, studio, action, dir } = ctx
	const stage = action.stage as string
	const elaboration = (action.elaboration as string) || "collaborative"
	const stageDef = readStageDef(studio, stage)
	const iteration =
		(action.iteration as number) || (action.visits as number) || 0
	const completedUnits = (action.completed_units as string[]) || []
	const pendingUnitsList = (action.pending_units as string[]) || []
	const iterative = Boolean(action.iterative)
	const pendingFeedback = (action.pending_feedback as PendingFeedback[]) || []
	const validationError = action.validation_error as string | undefined
	// When composed inside `elaborate_loop`, the router already emits a
	// `### Signal: decompose — …` heading and a single trailing
	// "Concurrent execution reminder." Suppress this builder's own
	// `## Elaborate:` / `## Iterative Re-Entry:` / `## Revisit Elaborate:`
	// headings + the trailing `buildConcurrentElaborateLoopBlock` so the
	// composite stays single-framed.
	const composed = ctx.composedMode === true

	const sections: string[] = []

	// Iterative re-entry mode.
	if (iterative) {
		if (!composed) {
			sections.push(`## Iterative Re-Entry: ${stage} (iteration #${iteration})`)
		}
		if (stageDef) sections.push(`${stageDef.body}`)
		sections.push(
			`You're re-entering this stage with prior work already landed on the stage branch. **Completed units below are knowledge** — their artifacts are part of the current stage baseline and must NOT be re-done or modified. Your job is to decide whether this iteration of the intent needs new work, and if so, draft new units for it.`,
		)

		if (completedUnits.length > 0) {
			const completedLines: string[] = [
				`### Completed Units (knowledge — read-only)`,
				"",
			]
			for (const name of completedUnits) {
				const unitFile = join(dir, "stages", stage, "units", `${name}.md`)
				if (!existsSync(unitFile)) {
					completedLines.push(`- **${name}** — _(file missing)_`)
					continue
				}
				const fm = readFrontmatter(unitFile)
				const title = (fm.title as string) || name
				const hat = (fm.hat as string) || ""
				const outputs = Array.isArray(fm.outputs)
					? (fm.outputs as string[])
					: []
				const summary = [
					`- **${name}** — ${title}`,
					hat ? `  - hat: \`${hat}\`` : null,
					outputs.length > 0
						? `  - outputs: ${outputs.map((o) => `\`${o}\``).join(", ")}`
						: null,
					`  - file: \`.haiku/intents/${slug}/stages/${stage}/units/${name}.md\``,
				]
					.filter(Boolean)
					.join("\n")
				completedLines.push(summary)
			}
			sections.push(completedLines.join("\n"))
		}

		if (pendingUnitsList.length > 0) {
			sections.push(
				`### Pending Units (targets for this iteration)\n\n${pendingUnitsList.map((n) => `- \`${n}\``).join("\n")}\n\nThese units exist but haven't been executed. If they're still relevant, leave them. Revise their specs if the intent has evolved. Reject individual units by deleting their file (not advised unless clearly obsolete).`,
			)
		}

		sections.push(sharedBlockRef("workflow-contracts-elaborate"))

		const lenses = buildReviewAgentLensSection(studio, stage, dir)
		if (lenses) sections.push(lenses)

		sections.push(eta.renderString(ITERATIVE_DECIDE_TPL, { slug }))
		return sections.join("\n\n")
	}

	// Revisit mode (iteration > 1): emit a focused additive-elaboration
	// block instead of re-running discovery/input-resolution.
	if (iteration > 1) {
		if (!composed) {
			sections.push(`## Revisit Elaborate: ${stage} (iteration #${iteration})`)
		}
		if (validationError) {
			sections.push(`### Validation Error\n\n${validationError}`)
		}
		if (completedUnits.length > 0) {
			sections.push(
				`### Frozen Completed Units (read-only)\n\nThe following units from prior iterations are **completed and immutable** — do NOT modify or re-queue them:\n\n${completedUnits.map((u) => `- \`${u}\``).join("\n")}`,
			)
		}
		if (pendingFeedback.length > 0) {
			sections.push(
				`### Pending Feedback (MUST address — READ EACH FILE IN FULL)\n\n${pendingFeedback
					.map(
						(f) =>
							`- **${f.feedback_id}** — ${f.title}\n  - file: \`${f.file}\`\n  - origin: ${f.origin} · author: ${f.author}`,
					)
					.join(
						"\n",
					)}\n\nYou MUST open every file above and read it completely before drafting units. The title is only a handle; the body carries requirements, tests, and acceptance criteria.`,
			)
		}
		const lenses = buildReviewAgentLensSection(studio, stage, dir)
		if (lenses) sections.push(lenses)
		const revisitSkillSection = buildSkillRegistrySection()
		if (revisitSkillSection) sections.push(revisitSkillSection)
		sections.push(
			`### Responsibilities\n\n- Read every \`pending_feedback[].file\` in full before drafting — the title is only a handle.\n- Draft one or more new units whose \`closes:\` frontmatter references the feedback items they resolve.\n- Every pending feedback item MUST be referenced by at least one new unit's \`closes:\` (orphans block advancement).\n- Ask the user clarifying questions (\`AskUserQuestion\` with options[]) when trade-offs are unclear; iterate across turns.\n- When the user approves the drafted units, call \`haiku_run_next\` to advance.\n\nInputs (read directly — do not inline summaries, open the actual files):\n- every \`pending_feedback[].file\` listed above\n- \`stage_metadata\` (STAGE.md body + review agents)\n- \`completed_units\` (read-only reference)\n- \`intent.md\` for overall goals`,
		)
		sections.push(
			`### Mechanics\n\n1. Continue the existing file-naming sequence: if the last unit is \`unit-0N-...\`, start new units at \`unit-0(N+1)-...\` (keep the same digit width as existing units in this stage; the engine resolves either width by numeric prefix).\n2. Each new unit MUST declare \`closes: [FB-NNN]\` for every feedback id it addresses.\n3. Every pending feedback item MUST be referenced by at least one new unit's \`closes:\` (orphans block advancement).\n4. Use the unit-file naming convention: \`unit-NNN-slug.md\` (kebab-case slug, 3-digit zero-padded number; max 999).\n5. Call \`haiku_run_next { intent: "${slug}" }\` when done — the orchestrator re-validates and advances.`,
		)
		return sections.join("\n\n")
	}

	// Fresh elaborate.
	if (!composed) sections.push(`## Elaborate: ${stage}`)
	if (stageDef) sections.push(`${stageDef.body}`)

	const elaborationOverride = readPhaseOverride(studio, stage, "ELABORATION")
	if (elaborationOverride) {
		sections.push(
			`### Phase: Elaboration Override\n\n${elaborationOverride.body}`,
		)
	}

	sections.push(sharedBlockRef("workflow-contracts-elaborate"))

	// Provider splice: source providers (spec, knowledge, design) and
	// always-on / workflow providers (git, ticketing if active) inject
	// their behavior contracts for the elaborate phase.
	const providerBlock = providerSpliceBlock("elaborate", dir)
	if (providerBlock) sections.push(providerBlock)

	const lenses = buildReviewAgentLensSection(studio, stage, dir)
	if (lenses) sections.push(lenses)

	// Upstream context — REFERENCES, not inlined bodies.
	const upstreamReferenceLines: string[] = []
	let upstreamRefPaths: string[] = []
	if (stageDef?.data?.inputs && Array.isArray(stageDef.data.inputs)) {
		const inputs = stageDef.data.inputs as Array<{
			stage: string
			discovery?: string
			output?: string
		}>
		const resolved = resolveStageInputs(studio, inputs, dir, slug)
		const found = resolved.filter((r) => r.exists)
		const missing = resolved.filter((r) => !r.exists)

		if (found.length > 0) {
			upstreamRefPaths = found.map((r) =>
				r.resolvedPath.startsWith(`${dir}/`)
					? r.resolvedPath.slice(dir.length + 1)
					: r.resolvedPath,
			)
			for (const r of found) {
				const relPath = r.resolvedPath.startsWith(`${dir}/`)
					? r.resolvedPath.slice(dir.length + 1)
					: r.resolvedPath
				upstreamReferenceLines.push(
					`- **${r.stage}/${r.artifactName}** (${r.kind}) — \`${relPath}\``,
				)
			}
		}

		if (missing.length > 0) {
			sections.push(
				`## ⚠ Missing Upstream Artifacts\n\nThe following inputs are declared but do not exist on disk:\n\n${missing.map((r) => `- **${r.stage}/${r.artifactName}** (${r.kind}) — expected at \`${r.resolvedPath}\``).join("\n")}\n\nThese may not have been produced yet, or may have been saved to a different location. If they are critical for this stage, log a stage_revisit feedback at the producing stage via \`haiku_feedback { intent, stage: "<producing-stage>", title: "<missing artifact>", body: "<what's needed>", origin: "agent", resolution: "stage_revisit" }\` and call \`haiku_run_next\` — the pre-tick gate routes the rewind.`,
			)
		}
	}

	// Prior-stage reference enumeration.
	const priorStageReferenceLines: string[] = []
	{
		const orderedStages = resolveIntentStages(
			existsSync(join(dir, "intent.md"))
				? readFrontmatter(join(dir, "intent.md"))
				: {},
			studio,
		)
		const myIdx = orderedStages.indexOf(stage)
		const priorStages = myIdx > 0 ? orderedStages.slice(0, myIdx) : []
		for (const prior of priorStages) {
			const priorDir = `.haiku/intents/${slug}/stages/${prior}`
			priorStageReferenceLines.push(
				`- **${prior}**`,
				`  - knowledge / discovery: \`${priorDir}/knowledge/\` (+ project-scope \`.haiku/knowledge/\` produced during that stage)`,
				`  - unit specs: \`${priorDir}/units/unit-*.md\``,
				`  - stage outputs: any files under \`${priorDir}/\` outside \`units/\` (\`.md\` reports, \`artifacts/\`)`,
				`  - resolved feedback: \`${priorDir}/feedback/*.md\``,
			)
		}
	}

	if (
		upstreamReferenceLines.length > 0 ||
		priorStageReferenceLines.length > 0
	) {
		const refSection: string[] = [UPSTREAM_CONTEXT_HEADER]
		if (upstreamReferenceLines.length > 0) {
			refSection.push("", "### Declared Inputs (from STAGE.md)")
			refSection.push("", ...upstreamReferenceLines)
		}
		if (priorStageReferenceLines.length > 0) {
			refSection.push(
				"",
				PRIOR_STAGE_PREAMBLE,
				"",
				...priorStageReferenceLines,
				"",
				PRIOR_STAGE_FOOTER,
			)
		}
		sections.push(refSection.join("\n"))

		if (upstreamRefPaths.length > 0) {
			sections.push(
				`## Unit Inputs Requirement (MANDATORY)\n\nEvery unit **MUST** have a non-empty \`inputs:\` field in its frontmatter. At minimum, every unit should reference the intent document and discovery docs. Units will be **blocked from execution** if \`inputs:\` is empty.\n\nAvailable upstream artifacts:\n\`\`\`yaml\ninputs:\n${upstreamRefPaths.map((p) => `  - ${p}`).join("\n")}\n\`\`\`\nInclude all inputs relevant to the unit's scope. Frontend/UI units should reference design artifacts. Backend units should reference behavioral specs and data contracts.`,
			)
		}
	}

	// Discovery fan-out.
	const discoveryArtifactsAll: Array<{
		name: string
		templatePath: string
		outputPath: string | null
	}> = []
	{
		const seen = new Set<string>()
		for (const base of [...studioSearchPaths()].reverse()) {
			const discoveryDir = join(base, studio, "stages", stage, "discovery")
			if (!existsSync(discoveryDir)) continue
			for (const f of readdirSync(discoveryDir).filter((f) =>
				f.endsWith(".md"),
			)) {
				if (seen.has(f)) continue
				seen.add(f)
				const templatePath = join(discoveryDir, f)
				const tplRaw = readFileSync(templatePath, "utf8")
				const { data: tplFM } = parseFrontmatter(tplRaw)
				const locRaw = (tplFM as { location?: unknown }).location
				const loc =
					typeof locRaw === "string"
						? locRaw.replace(/\{intent-slug\}/g, slug)
						: locRaw
				let outputPath: string | null = null
				if (typeof loc === "string" && loc.length > 0) {
					if (loc.startsWith(".haiku/")) {
						outputPath = join(process.cwd(), loc)
					} else if (loc.startsWith("/")) {
						outputPath = loc
					} else {
						outputPath = join(dir, loc)
					}
				}
				discoveryArtifactsAll.push({
					name: f.replace(/\.md$/i, "").toLowerCase(),
					templatePath,
					outputPath,
				})
			}
		}
	}

	// Self-heal: relocate misplaced legacy `knowledge/<NAME>.md` artifacts
	// to the template's declared `outputPath` when the destination is empty.
	const knowledgeDir = join(dir, "knowledge")
	for (const a of discoveryArtifactsAll) {
		if (!a.outputPath) continue
		if (existsSync(a.outputPath)) continue
		const legacyName = `${a.name.toUpperCase()}.md`
		const legacyPath = join(knowledgeDir, legacyName)
		if (legacyPath === a.outputPath) continue
		if (!existsSync(legacyPath)) continue
		try {
			mkdirSync(dirname(a.outputPath), { recursive: true })
			renameSync(legacyPath, a.outputPath)
			console.error(
				`[haiku] Relocated misplaced discovery artifact: '${legacyPath}' → '${a.outputPath}' (template '${a.name}' declares ${a.outputPath}). Clears the cursor re-emission wedge from pre-2026-05-13 engine versions.`,
			)
		} catch (err) {
			console.error(
				`[haiku] Could not relocate '${legacyPath}' to '${a.outputPath}': ${err instanceof Error ? err.message : String(err)}. Discovery will continue to re-emit until the file is moved manually.`,
			)
		}
	}
	const discoveryArtifacts = discoveryArtifactsAll.filter((a) => {
		if (a.outputPath) return !existsSync(a.outputPath)
		const candidate = join(knowledgeDir, `${a.name.toUpperCase()}.md`)
		return !existsSync(candidate)
	})

	if (discoveryArtifacts.length > 0) {
		const artifactNames = discoveryArtifacts
			.map((a) => `\`${a.name}\``)
			.join(", ")
		const plural = discoveryArtifacts.length !== 1 ? "s" : ""
		const intentPath = join(dir, "intent.md")
		const stagePath = resolveStudioFilePath(
			join(studio, "stages", stage, "STAGE.md"),
		)

		const intentMode = readIntentMode(dir)
		const isAutopilot = intentMode === "autopilot"

		let fanOutText = `## Discovery Fan-Out (REQUIRED)\n\nThis stage produces ${discoveryArtifacts.length} discovery artifact${plural}: ${artifactNames}.\n\n${sharedBlockRef("workflow-contracts-announcement")}\n\n**Spawn one subagent per artifact** using the \`prompt_file\` attribute on each \`<subagent>\` block — pass \`"Read <prompt_file> and execute its instructions exactly."\` as the spawn prompt (substituting the attribute's path). Each subagent writes inside its own isolation worktree, then calls \`haiku_discovery_complete { intent, stage, template }\` to hand the merge-back over to the engine (which takes a per-stage lock so parallel siblings serialize cleanly).\n\n${batchDispatchDirective(discoveryArtifacts.length, "discovery subagents", { forceForeground: isAutopilot })}\n\n`

		for (const a of discoveryArtifacts) {
			const wt = createDiscoveryWorktree(slug, stage, a.name)
			const expectedArtifactPath = wt
				? a.outputPath
					? a.outputPath.startsWith(dir)
						? join(
								wt,
								".haiku",
								"intents",
								slug,
								a.outputPath.slice(dir.length + 1),
							)
						: a.outputPath.startsWith(process.cwd())
							? join(wt, a.outputPath.slice(process.cwd().length + 1))
							: a.outputPath
					: join(
							wt,
							".haiku",
							"intents",
							slug,
							"knowledge",
							`${a.name.toUpperCase()}.md`,
						)
				: null
			const promptBody = eta.renderString(DISCOVERY_SUBAGENT_TPL, {
				artifactName: a.name,
				slug,
				stage,
				studio,
				worktree: wt,
				branchName: wt ? discoveryBranchName(slug, stage, a.name) : "",
				expectedArtifactPath,
				intentInline: inlineFile(intentPath, "Intent goal"),
				stageInline: stagePath ? inlineFile(stagePath, "Stage scope") : "",
				templateInline: inlineFile(
					a.templatePath,
					`Discovery template: ${a.name} (content guide + quality signals + output location)`,
				),
			})
			const discoveryModel = resolveStudioMandateModel({
				mandatePath: a.templatePath,
				studio,
				stage,
			})
			fanOutText += `${emitSubagentDispatchBlock({
				unit: "discovery",
				hat: a.name,
				bolt: 1,
				intent: slug,
				stage,
				agentType: "general-purpose",
				model: discoveryModel,
				promptBody,
				heading: `### Subagent: \`${a.name}\``,
				forceForeground: isAutopilot,
				omitBolt: true,
			})}\n\n`
		}

		const elabBgLine =
			getCapabilities().subagents.backgroundSpawn && !isAutopilot
				? ' Each `<subagent>` carries `background="true"` — pass `run_in_background: true` to the Task tool so the parent thread stays responsive while discovery agents run.'
				: ""
		const tickGuidance = isAutopilot
			? ` **You are in autopilot mode — do NOT yield.** Spawn the subagents in the foreground (the \`<subagent>\` blocks above carry no \`background\` attribute) and wait for every one to return in this same response. The instant the last subagent returns, call \`haiku_run_next { intent: "${slug}" }\` in the SAME response. The next tick emits the unit-decomposition instructions, which you also handle in-turn. Autopilot is a contiguous drive — pausing across turns defeats the mode.`
			: ` When ALL subagents return, call \`haiku_run_next { intent: "${slug}" }\` — the workflow engine merges their isolation worktrees back into the stage branch (resolving conflicts via the integrator if needed) and then emits the unit-decomposition instructions. **Do NOT proceed to decomposition in this response** — wait for the next workflow tick so the merged knowledge artifacts are visible.`
		fanOutText += `### Parent Instructions (do NOT include in subagent prompts)\n\nSpawn each subagent above using the \`prompt_file\` attribute — pass \`"Read <prompt_file> and execute its instructions exactly."\` as the spawn prompt (substituting the attribute's path). Do NOT include the \`<subagent>\` block body itself in the spawn prompt.${elabBgLine}${tickGuidance}`

		sections.push(fanOutText)
		if (!composed) {
			sections.push(
				buildConcurrentElaborateLoopBlock("discovery", { slug, stage }),
			)
		}
		return sections.join("\n\n")
	}

	const outputExpectations = buildOutputRequirements(
		studio,
		stage,
		"## Stage Output Expectations\n\nThis stage must ultimately produce the following outputs during execution. Plan units accordingly:",
	)
	if (outputExpectations) sections.push(outputExpectations)

	// Detect design stages and add MCP provider instructions.
	const stageHats = (stageDef?.data?.hats as string[]) || []
	const isDesignStage =
		stage.includes("design") ||
		stageHats.some((h) => h.includes("designer") || h.includes("design")) ||
		stageDef?.body?.includes("pick_design_direction")
	if (isDesignStage) {
		sections.push(DESIGN_PROVIDER_MCPS)
	}

	// Approach selection.
	sections.push(
		eta.renderString(APPROACH_SELECTION_TPL, {
			collaborative: elaboration === "collaborative",
		}),
	)

	const skillSection = buildSkillRegistrySection()
	if (skillSection) sections.push(skillSection)

	const mechanicsBlock =
		elaboration === "collaborative"
			? COLLABORATIVE_MECHANICS
			: AUTONOMOUS_MECHANICS
	const tail = eta.renderString(ELABORATE_OUTPUT_TAIL_TPL, { slug, stage })
	sections.push(`${SCOPE_HEADER}\n\n${mechanicsBlock}\n\n${tail}`)

	// Ticketing-provider guidance was previously injected here as an
	// inline block when `.haiku/settings.yml` contained the string
	// "ticketing". Replaced 2026-05-19 by the provider-injection layer
	// — `providerSpliceBlock("elaborate", dir)` (called above) emits
	// the full ticketing behavior contract from `plugin/providers/
	// ticketing.md` via the per-project shared/providers/ tree.

	if (!composed) {
		sections.push(
			buildConcurrentElaborateLoopBlock("decompose", { slug, stage }),
		)
	}

	return sections.join("\n\n")
}

export default definePromptBuilder((ctx) => {
	const promptFile = ctx.action.prompt_file as string | undefined
	if (promptFile) {
		return eta.renderString(FILE_BASED_POINTER_TPL, { promptFile })
	}
	return renderElaborate(ctx)
})
