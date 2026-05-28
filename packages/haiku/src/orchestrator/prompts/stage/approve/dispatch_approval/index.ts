// orchestrator/prompts/dispatch_approval/index.ts — v4 review-agent
// dispatch for the POST-execute output approval track.
//
// Counterpart to dispatch_review (which fires PRE-execute against the
// unit specs). dispatch_approval fires after every unit's hat chain
// completes — the agent reads the unit's PRODUCED OUTPUTS (not the
// spec) and confirms they align with the spec they already approved
// pre-execute. On any disagreement, files an FB (origin:
// `adversarial-review`, targets.invalidates: [<role>]) which rewinds
// the cursor through the fix loop on this role. On clean approval,
// stamps `approvals.<role>` per unit.
//
// File-backed dispatch (2026-05-19): same shape as dispatch_review —
// the subagent prompt is written to its own file and the parent only
// sees a `<subagent prompt_file="...">` dispatch block.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import {
	intentDir,
	parseFrontmatter,
	readStagePr,
	stageDir,
} from "../../../../../state-tools.js"
import {
	readReviewAgentBody,
	resolveReviewAgentPath,
} from "../../../../../studio-reader.js"
import { materializeReferenceFile } from "../../../../../subagent-prompt-file.js"
import { PER_STAGE_PR_MODES } from "../../../../workflow/delivery-modes.js"
import {
	buildDecisionsBlock,
	buildExistingFeedbackBlock,
	emitSubagentDispatchBlock,
	resolveStudioMandateModel,
	studioReadRef,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import {
	PR_INTERACTION_ROLES,
	RUNTIME_OBSERVATION_ROLES,
	sharedBlockRef,
} from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

/** The PR/MR a runtime-verifier uploads this stage's proof to. In
 *  per-stage delivery modes that's the stage's own draft PR (base =
 *  intent main); otherwise the single intent-main draft PR. Empty string
 *  when no PR exists (no provider CLI / not a git repo) — the proof still
 *  lands on disk and the SPA serves it live; upload is just skipped. */
function resolveProofTargetPrUrl(slug: string, stage: string): string {
	const intentFile = join(intentDir(slug), "intent.md")
	if (!existsSync(intentFile)) return ""
	const fm = parseFrontmatter(readFileSync(intentFile, "utf8")).data as Record<
		string,
		unknown
	>
	const mode = (fm.mode as string) || ""
	if (stage && PER_STAGE_PR_MODES.has(mode)) {
		const stagePr = readStagePr(slug, stage)?.url
		if (stagePr) return stagePr
	}
	return (fm.draft_pr_url as string) || ""
}

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

// Engine-built-in approval roles — same three names as dispatch_review's
// pre-execute set, but the templates here describe post-execute checks
// (audit the WORK, not the spec).
const ENGINE_APPROVAL_BODIES: Record<string, string> = {
	spec: loadTemplate(import.meta.url, "engine-bodies/spec.eta.md"),
	continuity: loadTemplate(import.meta.url, "engine-bodies/continuity.eta.md"),
	"cross-stage-consistency": loadTemplate(
		import.meta.url,
		"engine-bodies/cross_stage_consistency.eta.md",
	),
}

/** Read the unit FM's declared outputs and return an absolute-path list.
 *  Outputs are heterogeneous (markdown, code, images, PDFs), so we don't
 *  inline their content — just hand the subagent the list of paths to
 *  open with the Read tool. */
function readDeclaredOutputPaths(
	slug: string,
	stage: string,
	unit: string,
): string[] {
	const file = unit.endsWith(".md") ? unit : `${unit}.md`
	const unitPath = join(stageDir(slug, stage), "units", file)
	if (!existsSync(unitPath)) return []
	try {
		const { data } = matter(readFileSync(unitPath, "utf8"))
		const outputs = data.outputs
		if (!Array.isArray(outputs)) return []
		return outputs.filter((o): o is string => typeof o === "string")
	} catch {
		return []
	}
}

/** Build one subagent dispatch block for a single approval role. */
function buildRoleBlock(opts: {
	slug: string
	studio: string
	stage: string
	role: string
	units: string[]
}): { dispatchBlock: string; isEngineRole: boolean } {
	const { slug, studio, stage, role, units } = opts
	const engineBodyTpl = ENGINE_APPROVAL_BODIES[role]
	let mandateRef = ""
	let modelTier: string | undefined

	if (engineBodyTpl) {
		const engineBody = eta.renderString(engineBodyTpl, { slug, stage }).trim()
		const snap = materializeReferenceFile({
			intent: slug,
			stage: stage || undefined,
			kind: "engine-body",
			name: role,
			body: engineBody,
		})
		mandateRef = `**Read** \`${snap}\``
	} else {
		mandateRef = studioReadRef({
			resolveBody: () => readReviewAgentBody(studio, stage, role),
			toolName: "haiku_read_review_agent",
			toolArgs: { studio, stage, role },
			intent: slug,
			stage: stage || undefined,
			kind: "mandate",
			name: role,
		})
		const srcMandatePath = resolveReviewAgentPath(studio, stage, role)
		if (srcMandatePath) {
			modelTier = resolveStudioMandateModel({
				mandatePath: srcMandatePath,
				studio,
				stage,
			})
		}
	}

	const outputPaths = stage
		? units
				.flatMap((u) => readDeclaredOutputPaths(slug, stage, u))
				.filter((v, i, arr) => arr.indexOf(v) === i)
		: []

	const doctrineRef = RUNTIME_OBSERVATION_ROLES.has(role)
		? sharedBlockRef("runtime-verification")
		: ""
	const prInteraction = PR_INTERACTION_ROLES.has(role)
	const proofTargetPrUrl = prInteraction
		? resolveProofTargetPrUrl(slug, stage)
		: ""

	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		slug,
		stage,
		role,
		isEngineRole: engineBodyTpl !== undefined,
		mandateRef,
		units,
		outputPaths,
		doctrineRef,
		prInteraction,
		proofTargetPrUrl,
		existingFeedback: buildExistingFeedbackBlock(slug, stage),
		decisions: buildDecisionsBlock(slug),
	})

	const dispatchBlock = emitSubagentDispatchBlock({
		unit: `approval-${role}`,
		hat: "approval",
		bolt: 1,
		intent: slug,
		stage: stage || undefined,
		agentType: "general-purpose",
		model: modelTier,
		promptBody: subagentPrompt,
		heading: `### Subagent: \`${role}\` (post-execute approval)`,
		omitBolt: true,
	})

	return { dispatchBlock, isEngineRole: engineBodyTpl !== undefined }
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""

	type DispatchEntry = { role: string; units: string[] }
	const dispatches: DispatchEntry[] = Array.isArray(action.dispatches)
		? (action.dispatches as DispatchEntry[])
		: [
				{
					role: (action.role as string) || "",
					units: (action.units as string[]) || [],
				},
			]

	const blocks = dispatches.map((d) =>
		buildRoleBlock({ slug, studio, stage, role: d.role, units: d.units }),
	)

	const allDispatchBlocks = blocks.map((b) => b.dispatchBlock).join("\n\n")

	const allUnits = [...new Set(dispatches.flatMap((d) => d.units))]

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		dispatches,
		dispatchCount: dispatches.length,
		role: dispatches[0]?.role ?? "",
		units: allUnits,
		unitCount: allUnits.length,
		isEngineRole: blocks[0]?.isEngineRole ?? false,
		dispatchBlock: allDispatchBlocks,
	})
})
