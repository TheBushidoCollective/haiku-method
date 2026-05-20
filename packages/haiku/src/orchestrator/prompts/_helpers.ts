// orchestrator/prompts/_helpers.ts — Shared functional helpers used
// by per-action prompt builders. The static contract blocks live
// in their own per-block files in this directory:
//
//   - WORKFLOW_CONTRACTS_ELABORATE_BLOCK.ts
//   - WORKFLOW_CONTRACTS_EXECUTE_BLOCK.ts
//   - WORKFLOW_CONTRACTS_REVIEW_BLOCK.ts
//   - WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK.ts
//   - SUBAGENT_ERROR_RECOVERY.ts
//
// This module holds only functions that compute prompt fragments
// at call time:
//   - readInterpretation / buildInterpretationBlock — render the
//     `interpretation: lens|strict` mandate-mode block.
//   - inlineFile — strip frontmatter and emit a fenced inline block.
//   - emitSubagentDispatchBlock — write the prompt to a tmpfile and
//     emit the parent's `<subagent>` dispatch block.
//   - resolveStudioMandateModel — cascade mandate → stage → studio for any
//     studio-author-time dispatch (review-agent, discovery template,
//     studio fix-hat, integrator). The mandate file is optional — when
//     omitted the cascade starts at the stage's `default_model:` (when
//     a stage is provided) or the studio's `default_model:`.
//   - buildInlineSubagentContext — hookless-harness inline context.
//   - batchDispatchDirective — minimal "spawn in parallel; follow each
//     subagent's return" directive (engine-threaded chain via the
//     advance_hat relay breadcrumb; no agent-side pool bookkeeping).

import { existsSync, readFileSync } from "node:fs"
import { Eta } from "eta"
import matter from "gray-matter"
import { features } from "../../config.js"
import { getCapabilities } from "../../harness.js"
import { type ModelTier, sanitizeModel } from "../../model-selection.js"
import {
	MAX_CONCURRENT_SUBAGENTS,
	parseFrontmatter,
} from "../../state-tools.js"
import {
	readModelFromPath,
	readStageDef,
	readStudio,
} from "../../studio-reader.js"
import {
	formatSubagentDispatchBlock,
	writeSubagentPrompt,
} from "../../subagent-prompt-file.js"
import { loadTemplate } from "./_load-template.js"
import { providersForSplicePoint } from "./_provider-loader.js"
import { providerBlockRef } from "./_shared/index.js"

const helperEta = new Eta({ autoEscape: false, useWith: true })
const INLINE_SUBAGENT_CTX_TPL = loadTemplate(
	import.meta.url,
	"_shared/inline-subagent-context.eta.md",
)
const CONCURRENT_ELABORATE_TPL = loadTemplate(
	import.meta.url,
	"_shared/concurrent-elaborate-loop.eta.md",
)

/** Read the `interpretation:` field from a hat-like frontmatter file.
 *  Returns "lens" | "strict" | undefined (unset). Universal field on
 *  hat/review-agent/fix-hat frontmatter. */
export function readInterpretation(
	filePath: string | undefined,
): "lens" | "strict" | undefined {
	if (!filePath || !existsSync(filePath)) return undefined
	try {
		const { data } = parseFrontmatter(readFileSync(filePath, "utf8"))
		const v = data.interpretation
		if (v === "lens" || v === "strict") return v
		return undefined
	} catch {
		return undefined
	}
}

/** Build the interpretive block injected into a dispatch prompt right
 *  after the agent's mandate is inlined. Returns "" when interpretation
 *  is unset (no block emitted). */
export function buildInterpretationBlock(
	mode: "lens" | "strict" | undefined,
): string {
	if (!mode) return ""
	if (mode === "lens") {
		return [
			"## Mandate interpretation: LENS",
			"",
			"Your mandate above is a **lens**, not a checklist.",
			"",
			"- **In-spirit findings count.** A finding obviously within your mandate's lens but not listed as an explicit checklist item is IN scope. The mandate names representative concerns, not the exhaustive set.",
			"- **Out-of-mandate findings are NOT in scope, even if visible.** If your glob matched a file but the change has nothing to do with your lens, return zero findings. Inventing findings to justify dispatch is a scope violation, not thoroughness.",
			"- **Letter and spirit are not separable.** A change that technically passes a literal check but obviously violates what the check exists to enforce IS a finding. State the spirit-violation explicitly in the body so the fix loop knows what to address.",
		].join("\n")
	}
	return [
		"## Mandate interpretation: STRICT",
		"",
		"Your mandate above is a **literal checklist**.",
		"",
		'- Findings MUST be tied to a specific named item in your mandate. Do NOT extend to "in-spirit" issues — for this review, false positives carry the same weight as false negatives.',
		"- If you see something concerning outside the checklist, do NOT log it through this agent. Log it through a different review agent if one exists, or surface it as an out-of-scope observation in your summary.",
		"- Cite the specific checklist item each finding maps to in the `body:` field so the fix loop can verify scope.",
	].join("\n")
}

/** Inline a list of files into a single concatenated block. Used by
 *  subagent prompt builders to pre-load every file the subagent will
 *  need to read — the subagent is short-lived and pays a Read-tool
 *  cost for each separate file, so bundling them into one prompt body
 *  trades a small upfront token cost for zero Read calls in the
 *  subagent's session.
 *
 *  Use ONLY for subagent prompts. The parent agent's <subagent
 *  prompt_file="..."> dispatch is written to a tmpfile and the parent
 *  is explicitly told not to read it (the file is sized for the
 *  subagent's context), so the expansion stays behind the file-backed
 *  boundary. Inlining a file the parent will see would just bloat the
 *  parent's context.
 *
 *  Empty heading → skipped silently. Missing file path → skipped
 *  silently (consistent with `inlineFile`'s behavior). Returns an
 *  empty string when no entries resolve. */
export function inlineFiles(
	entries: Array<{ heading: string; path: string }>,
): string {
	if (entries.length === 0) return ""
	const blocks: string[] = []
	for (const { heading, path } of entries) {
		if (!heading || !path) continue
		const block = inlineFile(path, heading)
		if (block) blocks.push(block)
	}
	return blocks.join("\n")
}

/** Strip YAML frontmatter and emit a fenced inline block. Frontmatter
 *  carries workflow metadata that the orchestrator already consumed — the
 *  subagent should see only the authoritative body. ~~~~ fences survive
 *  inlined content that contains triple backticks. */
export function inlineFile(absPath: string, heading: string): string {
	if (!existsSync(absPath)) return ""
	const raw = readFileSync(absPath, "utf8")
	let body: string
	try {
		body = matter(raw).content.trim()
	} catch {
		body = raw
	}
	if (!body) return ""
	return `### ${heading}\n\n*Source: \`${absPath}\`*\n\n~~~~\n${body}\n~~~~\n`
}

/** Read a unit's iterations frontmatter and emit a "Prior rejection" block
 *  for the next bolt. The most-recent completed iteration with
 *  `result === "reject"` and a non-empty `reason` is surfaced so the next
 *  bolt's hat — whether re-running its own work after an auto-reject, or
 *  picking up after a downstream hat bounced back — knows what was rejected.
 *
 *  Without this, `inlineFile()` strips the unit FM (where iterations live)
 *  and the next-bolt prompt is silent on what failed. The reviewer's reason
 *  ("Two defects: ...") or the quality-gate auto-reject summary
 *  ("auto-reject: quality_gate_failed (typecheck, ...)") are dropped on the
 *  floor and the next bolt re-discovers the failure mode from scratch.
 *
 *  Returns "" when no completed reject is found (first hat / first bolt /
 *  unit file missing). */
export function buildPriorRejectBlock(unitFilePath: string): string {
	if (!existsSync(unitFilePath)) return ""
	let iters: Array<{
		hat?: unknown
		completed_at?: unknown
		result?: unknown
		reason?: unknown
	}> = []
	try {
		const { data } = parseFrontmatter(readFileSync(unitFilePath, "utf8"))
		if (Array.isArray(data.iterations)) {
			iters = data.iterations as typeof iters
		}
	} catch {
		return ""
	}
	for (let i = iters.length - 1; i >= 0; i--) {
		const it = iters[i]
		if (!it) continue
		if (!it.completed_at) continue
		if (it.result !== "reject") continue
		if (typeof it.reason !== "string" || !it.reason.trim()) continue
		const hatName = typeof it.hat === "string" ? it.hat : "previous hat"
		return [
			"## Prior rejection — address this before advancing",
			"",
			`The previous bolt's **${hatName}** hat rejected the work with this reason:`,
			"",
			"~~~~",
			it.reason.trim(),
			"~~~~",
			"",
			"Treat each item as a hard requirement: your hat is NOT done until every issue above is resolved. Reference the specific items in your final commit message and your hat-completion summary so the next reviewer can verify closure. Do NOT call `haiku_unit_advance_hat` while any of these remain open — call `haiku_unit_reject_hat` with what's still outstanding.",
		].join("\n")
	}
	return ""
}

/** Mirror of `buildPriorRejectBlock` for fix-loop prompts. Reads a
 *  feedback file's `iterations:` frontmatter (shape: FeedbackIteration —
 *  `result: "advanced" | "closed" | "reopened" | "rejected"`) and surfaces
 *  the most-recent `rejected` entry's reason so a fix-loop bolt N+1 hat
 *  knows what the previous attempt was rejected for (assessor reject,
 *  fixer-side `haiku_feedback_reject`, etc).
 *
 *  Returns "" when no rejected iteration is found (first fix bolt, fresh
 *  finding, missing file). */
export function buildPriorFeedbackRejectBlock(
	feedbackFilePath: string,
): string {
	if (!existsSync(feedbackFilePath)) return ""
	let iters: Array<{
		bolt?: unknown
		hat?: unknown
		completed_at?: unknown
		result?: unknown
		reason?: unknown
	}> = []
	try {
		const { data } = parseFrontmatter(readFileSync(feedbackFilePath, "utf8"))
		if (Array.isArray(data.iterations)) {
			iters = data.iterations as typeof iters
		}
	} catch {
		return ""
	}
	for (let i = iters.length - 1; i >= 0; i--) {
		const it = iters[i]
		if (!it) continue
		if (!it.completed_at) continue
		if (it.result !== "rejected") continue
		if (typeof it.reason !== "string" || !it.reason.trim()) continue
		const hatName = typeof it.hat === "string" ? it.hat : "previous fixer"
		const boltStr = typeof it.bolt === "number" ? ` (bolt ${it.bolt})` : ""
		return [
			"## Prior fix-bolt rejection — address this before advancing",
			"",
			`The previous fix attempt's **${hatName}** hat${boltStr} was rejected with this reason:`,
			"",
			"~~~~",
			it.reason.trim(),
			"~~~~",
			"",
			"Treat each item as a hard requirement on this bolt: do NOT repeat the same approach the previous bolt took unless you've identified a meaningfully different root cause. Reference the items by name in your bolt summary and the commit message so the next assessor can verify closure.",
		].join("\n")
	}
	return ""
}

/** Emit a `<subagent>` block whose body is a tmpfile pointer instead
 *  of an inlined prompt. The full prompt is written to a session-scoped
 *  tmpfile; the parent's instruction tells the spawning agent to read
 *  it. The `background` attribute on the emitted block is auto-gated on
 *  the active harness's `subagents.backgroundSpawn` capability — Claude
 *  Code supports it, others don't, so the dispatch markup is only
 *  decorated where the parent can actually follow it. */
export function emitSubagentDispatchBlock(opts: {
	unit: string
	hat: string
	bolt: number
	intent: string
	/** Stage name. Present for stage-scoped dispatches (per-unit hats,
	 *  discovery, stage fix-loops); absent for intent-scoped dispatches
	 *  (intent-completion review/fix). Selects the subdirectory under
	 *  `prompts/`. */
	stage?: string
	agentType: string
	model?: string | null
	promptBody: string
	heading?: string
	toolAttr?: boolean
	/** When true, force foreground spawn even on harnesses that support
	 *  backgroundSpawn. Used by autopilot dispatch paths where the parent
	 *  MUST stay on the turn (no yield) to keep ticking the workflow. */
	forceForeground?: boolean
	/** Drop the trailing `-<bolt>` from the prompt filename. Used by
	 *  discovery dispatches, which never iterate. */
	omitBolt?: boolean
}): string {
	const {
		unit,
		hat,
		bolt,
		intent,
		stage,
		agentType,
		model,
		promptBody,
		heading,
		toolAttr,
		forceForeground,
		omitBolt,
	} = opts
	const { path, parentInstruction } = writeSubagentPrompt({
		unit,
		hat,
		bolt,
		intent,
		stage,
		content: promptBody,
		omitBolt,
	})
	return formatSubagentDispatchBlock({
		path,
		parentInstruction,
		agentType,
		model,
		heading,
		toolAttr,
		background:
			forceForeground === true
				? false
				: getCapabilities().subagents.backgroundSpawn,
	})
}

/** Resolve the model tier for any studio-author-time dispatch
 *  (review-agent, discovery template, studio fix-hat, integrator).
 *  Cascade: mandate file's own `model:` → stage `default_model:`
 *  (when a stage is provided) → studio `default_model:`. Returns
 *  undefined when the feature is disabled or nothing is declared,
 *  in which case the subagent inherits the parent model. Studios
 *  ship with `default_model: sonnet` so the floor is sonnet whenever
 *  the cascade runs.
 *
 *  `mandatePath` is optional — integrators have no per-mandate file,
 *  so they enter the cascade at the stage default. Reviewer/discovery
 *  callers always pass a path; if the file is missing
 *  `readModelFromPath` returns undefined and the cascade still
 *  proceeds. */
export function resolveStudioMandateModel(opts: {
	mandatePath?: string
	studio: string
	stage?: string
}): ModelTier | undefined {
	if (!features.modelSelection) return undefined
	const { mandatePath, studio, stage } = opts
	// Cascade evaluated lazily so a mandate-level hit doesn't pay for
	// stage / studio file I/O. We don't go through `resolveModel` here
	// because that helper takes eager values; the cascade order
	// (mandate → stage → studio) is short enough to inline.
	if (mandatePath) {
		const mandateModel = readModelFromPath(mandatePath)
		if (mandateModel) return mandateModel
	}
	if (stage) {
		const stageDef = readStageDef(studio, stage)
		const stageDefault = sanitizeModel(
			stageDef?.data?.default_model as string | undefined,
		)
		if (stageDefault) return stageDefault
	}
	const studioData = readStudio(studio)
	return sanitizeModel(studioData?.data?.default_model as string | undefined)
}

/** Build the per-subagent context block injected into unit/hat
 *  dispatch prompts on hookless harnesses. On Claude Code (hooks
 *  available), context injection happens at the hook layer — return
 *  empty string and let the hook do its job. Covers hat isolation,
 *  workflow rules, resilience, and harness-aware communication
 *  guidance. */
export function buildInlineSubagentContext(
	slug: string,
	stage: string,
	hat: string,
	hats: string[],
	bolt: number,
): string {
	const caps = getCapabilities()
	if (caps.hooks) return "" // hooks handle context injection

	return helperEta.renderString(INLINE_SUBAGENT_CTX_TPL, {
		slug,
		stage,
		hat,
		hatsStr: hats.join(" → "),
		bolt,
		nativeAskUser: caps.nativeAskUser,
	})
}

/** Collect every active provider whose `splices_into:` includes the
 *  given phase, and return a concatenated reference block (or empty
 *  string when no provider matches). Each provider materializes once
 *  to `~/.haiku/projects/<key>/shared/providers/<kind>.md` and the
 *  prompt carries a short Read pointer for each.
 *
 *  Phase names are semantic (elaborate, execute, decompose,
 *  complete_stage, seal_intent). Match the `splices_into:` values in
 *  the provider .md frontmatter. */
export function providerSpliceBlock(phase: string, intentDir: string): string {
	// Defensive: tests and some non-intent-dir code paths invoke prompt
	// builders without a real `intentDir`. Provider lookup walks
	// `<intentDir>/../.haiku/settings.yml` and crashes on undefined.
	// No intent dir → no project settings to inspect → no provider
	// splice block; surface as empty string so the render still works.
	if (!intentDir) return ""
	const providers = providersForSplicePoint(phase, intentDir)
	if (providers.length === 0) return ""
	const refs = providers.map((p) =>
		providerBlockRef({
			kind: p.kind,
			category: p.category,
			body: p.body,
		}),
	)
	return [
		`## Active providers for this phase`,
		"",
		`The following provider behavior contracts apply to this prompt. Read each one before drafting your response.`,
		"",
		refs.join("\n\n"),
	].join("\n")
}

/** Read `mode:` from the intent's `intent.md` frontmatter. Returns the
 *  raw mode string, or empty string when the file or field is missing.
 *  Used to gate dispatch behavior (foreground vs background, "wait for
 *  next tick" vs "tick now") in autopilot. */
export function readIntentMode(intentDir: string): string {
	const path = `${intentDir.replace(/\/$/, "")}/intent.md`
	if (!existsSync(path)) return ""
	try {
		const { data } = parseFrontmatter(readFileSync(path, "utf8"))
		const mode = typeof data.mode === "string" ? (data.mode as string) : ""
		return mode
	} catch {
		return ""
	}
}

/** Render the parent's dispatch directive for a parallel subagent
 *  wave. Pre-2026-05-19 this rendered a slot-pool / batch-serial
 *  protocol that taught the agent how to mete out spawns against
 *  `MAX_CONCURRENT_SUBAGENTS`. That mechanism moved into the engine:
 *  each terminal advance emits `next_subagent_dispatch_block`, the
 *  subagent relays it, the parent spawns it. No agent-side bookkeeping.
 *  See `.claude/rules/no-agent-mechanics-teaching.md`.
 *
 *  The directive now just says "spawn in parallel; follow each
 *  subagent's return". `count` / `label` / `forceForeground` are kept
 *  for callsite compatibility but the body is the same across them. */
export function batchDispatchDirective(
	_count: number,
	label = "subagents",
	_opts: { forceForeground?: boolean } = {},
): string {
	return `Spawn each \`<subagent>\` block below in a single message (parallel \`Task\` calls). When a ${label.replace(/s$/, "")} returns, do what its final message tells you — spawn the relayed \`<subagent>\` block it carries, call \`haiku_run_next\`, or just acknowledge.`
}

/** The five completion signals that all live inside the single conceptual
 *  "elaborate loop" cursor state. The cursor walks them first-unmet-wins
 *  and emits ONE action per tick, but the agent is NOT restricted to that
 *  one activity — the prompts invite concurrent progress on any signal
 *  whose precondition is already met. See GOALS.md § "Elaboration as a
 *  concurrent loop" and GAPS.md § "Option B" for the design rationale. */
export type ElaborateLoopSignal =
	| "conversation"
	| "verify_conversation"
	| "discovery"
	| "decompose"
	| "verify_decompose"

/** Build the standardized "concurrent elaborate-loop activities" block
 *  appended to every elaborate-loop prompt builder. The primary signal —
 *  the one the cursor emitted this tick — is the only one repeated above
 *  the block (it's the task headline). This block names the OTHER four
 *  signals the agent may stack into the same response, with the primary
 *  filtered out so it isn't redundantly listed as "also welcome."
 *
 *  Design note: the elaborate loop is one conceptual state with five
 *  completion signals. The cursor returns first-unmet-wins per tick for
 *  back-compat (consumers still switch on `action.kind`), but the agent's
 *  behavior is closer to the spec's "single state, concurrent activities"
 *  when prompts invite multi-signal progress per response. */
export function buildConcurrentElaborateLoopBlock(
	primary: ElaborateLoopSignal,
	args: { slug: string; stage?: string },
): string {
	const { slug, stage } = args
	const stageRef = stage ? `\`${stage}\`` : "the active stage"
	const activities: Array<{ signal: ElaborateLoopSignal; line: string }> = [
		{
			signal: "conversation",
			line: `**Capture (or extend) the conversation.** If alignment on substance for ${stageRef} is already reached, call \`haiku_stage_elaboration_record\` now — the cursor's next tick fires the substance verifier without re-prompting for conversation.`,
		},
		{
			signal: "verify_conversation",
			line: `**Dispatch the elaborate-substance verifier** if a conversation artifact exists but is unverified. Spawning the verifier in this same tick lets the next \`haiku_run_next\` advance past \`elaborate_review\` immediately.`,
		},
		{
			signal: "discovery",
			line: `**Fan out missing discovery subagents** for any \`discovery/*.md\` templates whose \`location:\` artifacts aren't on disk yet. Each subagent runs in its own isolation worktree and writes one file; the cursor's next tick skips \`discovery_required\` for every artifact already present.`,
		},
		{
			signal: "decompose",
			line: `**Draft units as scope crystallizes** via \`haiku_unit_write\`. Units written during the elaborate loop are first-class — the decompose-coverage verifier catches missing units and drift either way, so there's no penalty for landing them early.`,
		},
		{
			signal: "verify_decompose",
			line: `**Dispatch the decompose-coverage verifier** if units exist for ${stageRef} but \`decompose_verified_at\` is missing on the elaboration artifact. Stacking it onto this tick lets the next \`haiku_run_next\` advance past \`decompose_review\` immediately.`,
		},
	]

	const concurrent = activities.filter((a) => a.signal !== primary)
	if (concurrent.length === 0) return ""

	return helperEta.renderString(CONCURRENT_ELABORATE_TPL, {
		slug,
		concurrentLines: concurrent.map((a) => a.line),
	})
}
