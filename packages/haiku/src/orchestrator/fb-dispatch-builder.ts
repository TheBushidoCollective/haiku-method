// orchestrator/fb-dispatch-builder.ts — Engine-side dispatch-block
// builder for fix-loop feedback hats.
//
// Builds a single `<subagent prompt_file="...">` dispatch block for one
// FB at one hat. Shared between two callers:
//   - `prompts/feedback/start_feedback_hat/index.ts` (initial wave
//     dispatch when the cursor returns `start_feedback_hat`)
//   - `state-tools.ts` (haiku_feedback_advance_hat's
//     `next_subagent_dispatch_block` breadcrumb)
//
// Sharing one code path is load-bearing — if the two builders disagree,
// the agent ends up relaying a block that doesn't match what the cursor
// would emit and we're back to the sidecar-keyed-to-wrong-bolt class of
// bugs (task #30, 2026-05-13). The engine, not the agent, owns "what
// dispatches next"; see `.claude/rules/no-agent-mechanics-teaching.md`.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import { features } from "../config.js"
import { type ModelTier, resolveModel } from "../model-selection.js"
import { intentDir, stageDir } from "../state-tools.js"
import { materializeReferenceFile } from "../subagent-prompt-file.js"
import {
	readHatDefs,
	readStageDef,
	readStudio,
	readStudioFixHatDefs,
	readStudioFixHatPaths,
	resolveFixHatPath,
} from "../studio-reader.js"
import {
	buildPriorFeedbackRejectBlock,
	emitSubagentDispatchBlock,
} from "./prompts/_helpers.js"
import { loadTemplate } from "./prompts/_load-template.js"

const eta = new Eta({ autoEscape: false, useWith: true })

// The subagent template lives next to the prompt builder that
// originally owned it; canonicalize-prompt-templates resolves the
// `subagent.eta.md` path via the package layout. We load it relative to
// the prompt builder's source so the same template body powers both
// callers.
// Lazy + memoized: module-init must do no filesystem I/O so that
// state-tools (which imports this builder) can be pulled into non-MCP
// subcommands — the status line, migrate — without firing a prompt
// read before the plugin root is resolvable. Read on first dispatch.
let _subagentTemplate: string | null = null
function subagentTemplate(): string {
	if (_subagentTemplate === null) {
		_subagentTemplate = loadTemplate(
			new URL(
				"./prompts/feedback/start_feedback_hat/index.ts",
				import.meta.url,
			).href,
			"subagent.eta.md",
		)
	}
	return _subagentTemplate
}

/** Resolve the model for a single fix-hat dispatch. Cascade:
 *  FB-level `model:` override → hat → stage default → studio default.
 *  Returns undefined when model selection is disabled or every tier
 *  resolves to undefined. */
function resolveFixHatModel(opts: {
	slug: string
	stage: string
	studio: string
	hat: string
	feedbackId: string
}): { model: ModelTier | undefined; source: string } | undefined {
	if (!features.modelSelection) return undefined
	const { slug, stage, studio, hat, feedbackId } = opts
	let fbModel: string | undefined
	if (feedbackId) {
		const num = feedbackId.replace(/^FB-/, "")
		const dir = stage
			? join(stageDir(slug, stage), "feedback")
			: join(intentDir(slug), "feedback")
		try {
			const candidates = existsSync(dir)
				? readdirSync(dir).filter(
						(f: string) => f.startsWith(num) && f.endsWith(".md"),
					)
				: []
			if (candidates.length > 0) {
				const raw = readFileSync(join(dir, candidates[0]), "utf8")
				fbModel = (matter(raw).data as { model?: string }).model
			}
		} catch {
			/* cascade falls through */
		}
	}
	// Stage-scope FBs resolve the hat tier from the stage `hats/`
	// cascade; intent-scope FBs (stage === "") resolve from the
	// studio-level `fix-hats/` defs so a reconciler with its own
	// `model:` override still routes correctly.
	const hatDef = stage
		? readHatDefs(studio, stage)?.[hat]
		: readStudioFixHatDefs(studio)?.[hat]
	const stageDef = stage ? readStageDef(studio, stage) : undefined
	const studioData = readStudio(studio)
	const resolved = resolveModel({
		unit: fbModel,
		hat: hatDef?.model,
		stage: stageDef?.data?.default_model as string | undefined,
		studio: studioData?.data?.default_model as string | undefined,
	})
	return { model: resolved.model, source: resolved.source }
}

/** Build a single per-FB fix-hat `<subagent prompt_file="...">`
 *  dispatch block. Reads the FB file on disk for the latest bolt
 *  counter and inlines the FB body + hat mandate into the subagent
 *  prompt. The parent never sees the body — only the `<subagent>`
 *  markup. */
export function buildFbHatDispatchBlock(opts: {
	slug: string
	studio: string
	feedbackId: string
	stage: string
	hat: string
	terminal: boolean
}): string {
	const { slug, studio, feedbackId, stage, hat, terminal } = opts
	const fbInt = Number.parseInt(feedbackId.replace(/^FB-/i, ""), 10) || 0
	// Resolve the hat mandate. Stage-scope FBs route through the stage's
	// `hats/` cascade; intent-scope FBs (stage === "") route through the
	// studio-level `fix-hats/` dir — the `fix_hats:` chain declared on
	// STUDIO.md (e.g. [reconciler, validator]). Pre-2026-05-19 the
	// intent-scope branch resolved to `null`, so the subagent prompt
	// rendered an empty mandate and every reconciler reported "no
	// on-disk mandate file resolved for the `reconciler` hat" — the
	// engine dispatched a hat it couldn't define (fixloop-bug-f4dd5a92).
	const hatPath = stage
		? resolveFixHatPath(studio, stage, hat)
		: (readStudioFixHatPaths(studio)[hat] ?? null)
	// Strip frontmatter (engine bookkeeping — `agent_type`, `model`; the
	// agent doesn't need it and inlining it raw was the FB-001 leak) and
	// materialize the agent-facing mandate body into the intent's prompts
	// tree. The dispatched prompt references THIS snapshot, not the
	// mutable plugin-source path — so the record reflects exactly what
	// the subagent read and reflection agents can re-read it.
	const rawHatBody =
		hatPath && existsSync(hatPath) ? readFileSync(hatPath, "utf8") : ""
	const mandateBody = rawHatBody ? matter(rawHatBody).content.trim() : ""
	const mandatePath = mandateBody
		? materializeReferenceFile({
				intent: slug,
				stage: stage || undefined,
				kind: "mandate",
				name: hat,
				body: mandateBody,
			})
		: ""

	const fbDir = stage
		? join(stageDir(slug, stage), "feedback")
		: join(intentDir(slug), "feedback")
	const fbNum = feedbackId.replace(/^FB-/i, "")
	// The FB body is NOT inlined or snapshotted — it's a live, mutable
	// workflow artifact (an earlier hat may append a `## Classification`
	// section mid-chain). The subagent prompt instructs the agent to
	// read it live via `haiku_feedback_read` (which strips engine FM).
	// We still open the file here for the engine's own bookkeeping: the
	// bolt counter and the prior-rejection reason (FM-derived state the
	// read tool intentionally hides).
	let priorRejectBlock = ""
	let bolt = 1
	if (existsSync(fbDir)) {
		const fbFile = readdirSync(fbDir).find(
			(f) => f.startsWith(fbNum) && f.endsWith(".md"),
		)
		if (fbFile) {
			const fbPath = join(fbDir, fbFile)
			// Surface the most-recent rejection reason so a bounced-to hat
			// addresses the verifier's specific objection on the new bolt
			// instead of re-rolling a fresh approach the verifier already
			// turned down. Empty on the first bolt (no prior rejection).
			priorRejectBlock = buildPriorFeedbackRejectBlock(fbPath)
			try {
				const fbFm = matter(readFileSync(fbPath, "utf8")).data as Record<
					string,
					unknown
				>
				const iters = Array.isArray(fbFm.iterations) ? fbFm.iterations : []
				const maxBolt = (iters as Array<{ bolt?: unknown }>).reduce(
					(acc, it) => {
						const b = it?.bolt
						return typeof b === "number" && b > acc ? b : acc
					},
					0,
				)
				bolt = maxBolt > 0 ? maxBolt : 1
			} catch {
				/* fall back to bolt 1 */
			}
		}
	}

	const resolved = resolveFixHatModel({
		slug,
		studio,
		stage,
		hat,
		feedbackId,
	})

	const promptBody = eta.renderString(subagentTemplate(), {
		slug,
		hat,
		stage,
		feedbackId,
		fbInt,
		terminal,
		mandatePath,
		priorRejectBlock,
	})

	return emitSubagentDispatchBlock({
		unit: `fix-${feedbackId}`,
		hat,
		bolt,
		intent: slug,
		stage: stage || undefined,
		agentType: "general-purpose",
		model: resolved?.model,
		promptBody,
		heading: `### Subagent — \`${feedbackId}\` (stage \`${stage || "(intent)"}\`, hat \`${hat}\`)`,
	})
}
