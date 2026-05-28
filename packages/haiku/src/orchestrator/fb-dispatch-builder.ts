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
import matter from "gray-matter"
import { features } from "../config.js"
import { createFixChainWorktree } from "../git-worktree.js"
import { type ModelTier, resolveModel } from "../model-selection.js"
import { intentDir, stageDir } from "../state-tools.js"
import {
	readHatBody,
	readHatDefs,
	readStageDef,
	readStudio,
	readStudioFixHatBody,
	readStudioFixHatDefs,
} from "../studio-reader.js"
import {
	buildHatDispatchBlock,
	type HatLoopTarget,
} from "./hat-loop-dispatch.js"
import {
	buildPriorFeedbackRejectBlock,
	studioReadRef,
} from "./prompts/_helpers.js"
import { loadTemplate } from "./prompts/_load-template.js"

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
		// `@canon:` sentinel — see unit-dispatch-builder.ts: this builder is
		// outside `orchestrator/prompts/`, so the import.meta.url/new-URL form
		// crashes in the production bundle. `@canon:` resolves in both runtimes.
		// Template at `plugin/prompts/feedback/start_feedback_hat/`.
		_subagentTemplate = loadTemplate(
			"@canon:feedback/start_feedback_hat",
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
	const scope = stage || "intent"

	// The FB body is NOT inlined — it's a live, mutable artifact (an earlier
	// hat may append a `## Classification` section); the subagent reads it
	// live via `haiku_feedback_read`. We open the file here only for the
	// engine's own bookkeeping the read tool hides: the bolt counter and the
	// prior-rejection baton. Read once, lazily, memoized.
	let fbStateCache: { priorRejectBlock: string; bolt: number } | null = null
	const fbState = () => {
		if (fbStateCache) return fbStateCache
		const fbDir = stage
			? join(stageDir(slug, stage), "feedback")
			: join(intentDir(slug), "feedback")
		const fbNum = feedbackId.replace(/^FB-/i, "")
		let priorRejectBlock = ""
		let bolt = 1
		if (existsSync(fbDir)) {
			const fbFile = readdirSync(fbDir).find(
				(f) => f.startsWith(fbNum) && f.endsWith(".md"),
			)
			if (fbFile) {
				const fbPath = join(fbDir, fbFile)
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
		fbStateCache = { priorRejectBlock, bolt }
		return fbStateCache
	}

	const target: HatLoopTarget = {
		slug,
		emitStage: stage || undefined,
		dispatchId: `fix-${feedbackId}`,
		// Isolate the fix-chain's hat loop in its own worktree (branch
		// `haiku/<slug>/fix-<scope>-<FB>`, forked from the stage branch for a
		// stage-scope FB or intent main for an intent-scope FB). Idempotent;
		// the terminal close -> mergeFixChainWorktree lands it back. "" in
		// filesystem mode.
		ensureWorktree: () => createFixChainWorktree(slug, scope, feedbackId) ?? "",
		// Snapshot the fix-hat mandate via the SAME reader haiku_read_hat uses.
		// Stage-scope FBs resolve the fix-scoped variant; intent-scope FBs
		// (stage === "") resolve a STUDIO-level fix-hat, which the stage-scoped
		// haiku_read_hat doesn't cover — hence the dedicated reader + args.
		mandateRef: (h) =>
			studioReadRef({
				resolveBody: () =>
					stage
						? readHatBody(studio, stage, h, true)
						: readStudioFixHatBody(studio, h),
				toolName: "haiku_read_hat",
				toolArgs: stage
					? { studio, stage, hat: h, fix: true }
					: { studio, hat: h, fix: true },
				intent: slug,
				stage: stage || undefined,
				kind: "mandate",
				name: h,
			}),
		priorHandoffBlock: () => fbState().priorRejectBlock,
		resolveModel: (h) =>
			resolveFixHatModel({ slug, studio, stage, hat: h, feedbackId })?.model,
		bolt: () => fbState().bolt,
		template: () => subagentTemplate(),
		templateVars: ({
			hat: h,
			terminal: term,
			worktree,
			mandateRef,
			priorRejectBlock,
		}) => ({
			slug,
			hat: h,
			stage,
			feedbackId,
			fbInt,
			terminal: term,
			worktree,
			mandateRef,
			priorRejectBlock,
		}),
		heading: (h) =>
			`### Subagent — \`${feedbackId}\` (stage \`${stage || "(intent)"}\`, hat \`${h}\`)`,
	}
	return buildHatDispatchBlock(target, hat, terminal)
}
