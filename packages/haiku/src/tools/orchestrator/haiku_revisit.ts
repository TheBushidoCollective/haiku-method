// tools/orchestrator/haiku_revisit.ts — Re-enter a stage for another
// pass. Two paths:
//   1. No reasons + no pending feedback → `revisit_needs_reasons`
//      (refuses; the agent must supply reasons or queue user
//      feedback first).
//   2. No reasons but pending feedback exists → drop straight into
//      revisit() — the pending items ARE the reasons (stacked-
//      comments review-UI flow).
//   3. Reasons provided → write feedback files first, then revisit.
//
// Aligns the branch with the active stage BEFORE writing feedback
// — otherwise feedback can land on whatever branch was checked out
// at call time and prepareRevisitBranch only merges main+fromStage,
// so feedback mis-written to a third branch would never make it
// into the revisit.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ensureOnStageBranch } from "../../git-worktree.js"
import {
	buildGuardResponse,
	revisit as runRevisit,
} from "../../orchestrator.js"
import {
	appendStageIteration,
	findHaikuRoot,
	gitCommitState,
	parseFrontmatter,
	readFeedbackFiles,
	syncSessionMetadata,
	writeFeedbackFile,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

export default defineTool({
	name: "haiku_revisit",
	description:
		"Revisit a stage with optional feedback reasons. If reasons are provided, writes them as feedback files BEFORE rolling back. If reasons are omitted but pending feedback exists, drops straight into revisit (the stacked-comments flow). User-revisits are NOT capped — explicit human intent wins over iteration guardrails.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string" },
			stage: { type: "string" },
			reasons: {
				type: "array",
				items: {
					type: "object",
					properties: {
						title: { type: "string" },
						body: { type: "string" },
					},
					required: ["title", "body"],
				},
			},
			state_file: { type: "string" },
		},
		required: ["intent"],
	},
	handle(args) {
		// Some MCP clients ship nested array/object args as JSON-encoded
		// strings. Parse them back before use — otherwise iterating the
		// "array" yields single characters and the downstream feedback
		// writer explodes on undefined properties.
		const rawReasons = args.reasons
		let reasons: Array<{ title: string; body: string }> | undefined
		if (typeof rawReasons === "string") {
			try {
				const parsed = JSON.parse(rawReasons)
				if (!Array.isArray(parsed)) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Error: reasons must be an array of {title, body} objects — got a non-array JSON value",
							},
						],
						isError: true,
					}
				}
				reasons = parsed
			} catch (err) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: reasons was a string but failed to parse as JSON: ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					isError: true,
				}
			}
		} else if (rawReasons !== undefined) {
			if (!Array.isArray(rawReasons)) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: reasons must be an array — received ${typeof rawReasons}`,
						},
					],
					isError: true,
				}
			}
			reasons = rawReasons as Array<{ title: string; body: string }>
		}

		if (reasons !== undefined) {
			if (reasons.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Error: reasons array must contain at least one item",
						},
					],
					isError: true,
				}
			}
			for (const reason of reasons) {
				if (
					!reason ||
					typeof reason !== "object" ||
					typeof reason.title !== "string" ||
					reason.title.trim() === ""
				) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Error: each reason must have a non-empty title",
							},
						],
						isError: true,
					}
				}
				if (typeof reason.body !== "string" || reason.body.trim() === "") {
					return {
						content: [
							{
								type: "text" as const,
								text: "Error: each reason must have a non-empty body",
							},
						],
						isError: true,
					}
				}
			}
		}

		// Stopgap: no reasons provided — do NOT roll back UNLESS pending
		// feedback already exists on the active stage. In the stacked-
		// comments flow the reviewer adds items one at a time in the UI,
		// then clicks "Send to agent" which fires this tool with no
		// `reasons`: the pending feedback items on disk ARE the reasons,
		// so we should drop straight into `revisit()` (which classifies
		// per resolution field + either rolls back or returns a
		// `feedback_dispatch` action). Keep the stopgap for the agent
		// path — an agent calling `haiku_revisit` on a clean stage with
		// no reasons is still a no-op.
		if (!reasons) {
			const stopgapSlug = args.intent as string
			const stopgapRoot = findHaikuRoot()
			const stopgapIntentFile = join(
				stopgapRoot,
				"intents",
				stopgapSlug,
				"intent.md",
			)
			const stopgapActiveStage = existsSync(stopgapIntentFile)
				? (readFrontmatter(stopgapIntentFile).active_stage as string) || ""
				: ""
			const stopgapStage =
				(args.stage as string | undefined) || stopgapActiveStage
			const pendingOnStage = stopgapStage
				? readFeedbackFiles(stopgapSlug, stopgapStage).filter(
						(i) => i.status === "pending",
					)
				: []
			if (pendingOnStage.length === 0) {
				return text(
					JSON.stringify(
						{
							action: "revisit_needs_reasons",
							message:
								"To revisit, provide reasons as feedback. Call haiku_revisit with reasons: [{title, body}] so the feedback is recorded before rolling back — or add pending feedback items via the review UI first.",
						},
						null,
						2,
					),
				)
			}
			const directResult = runRevisit(
				stopgapSlug,
				args.stage as string | undefined,
			)
			return text(JSON.stringify(directResult, null, 2))
		}

		// Reasons provided — write feedback files BEFORE rolling back.
		const revisitSlug = args.intent as string
		const revisitRoot = findHaikuRoot()
		const revisitIntentFile = join(
			revisitRoot,
			"intents",
			revisitSlug,
			"intent.md",
		)
		if (!existsSync(revisitIntentFile)) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: intent '${revisitSlug}' not found`,
					},
				],
				isError: true,
			}
		}
		const revisitIntentData = readFrontmatter(revisitIntentFile)
		const revisitTargetStage =
			(args.stage as string | undefined) ||
			(revisitIntentData.active_stage as string) ||
			""
		if (!revisitTargetStage) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: no active stage found for intent '${revisitSlug}'`,
					},
				],
				isError: true,
			}
		}

		// Align branch with the current active stage BEFORE writing
		// feedback files. Without this, feedback can land on whatever
		// branch was checked out at call time (e.g. intent-main) and
		// prepareRevisitBranch only merges main + fromStage into the
		// target — so feedback mis-written to a third branch wouldn't
		// make it into the revisit.
		const guard = ensureOnStageBranch(
			revisitSlug,
			(revisitIntentData.active_stage as string) || undefined,
		)
		if (!guard.ok) {
			return buildGuardResponse(
				revisitSlug,
				(revisitIntentData.active_stage as string) || undefined,
				guard,
				"revisit pre-branch",
			)
		}

		const createdFeedback: Array<{
			feedback_id: string
			title: string
		}> = []
		for (const reason of reasons) {
			// Agents calling `haiku_revisit` with explicit reasons are
			// asking for the stage to roll back — that's the whole point
			// of the call. Tag the feedback `resolution: stage_revisit` so
			// the classifier honors the intent and the revisit branch
			// runs. User-UI comments (posted via POST /api/feedback) stay
			// null by default and get triaged.
			const fb = writeFeedbackFile(revisitSlug, revisitTargetStage, {
				title: reason.title,
				body: reason.body,
				origin: "agent",
				author: "parent-agent",
				resolution: "stage_revisit",
			})
			createdFeedback.push({
				feedback_id: fb.feedback_id,
				title: reason.title,
			})
		}
		gitCommitState(
			`haiku: revisit feedback in ${revisitTargetStage} (${createdFeedback.length} items)`,
		)

		const revisitResult = runRevisit(
			revisitSlug,
			args.stage as string | undefined,
		)

		// If revisit() failed (e.g. prepareRevisitBranch hit a merge
		// conflict), short-circuit BEFORE appending an iteration entry.
		// Otherwise a retry after conflict resolution would produce a
		// duplicate iteration record.
		if (revisitResult.action === "error") {
			return text(JSON.stringify(revisitResult, null, 2))
		}

		// Record a user-revisit iteration on the target stage.
		// User-invoked revisits are NOT capped — explicit human intent
		// always wins over the iteration guardrails.
		const iterResult = appendStageIteration(
			revisitSlug,
			revisitTargetStage,
			{
				trigger: "user-revisit",
				reason: `User revisit with ${createdFeedback.length} feedback item(s)`,
				feedbackTitles: createdFeedback.map((f) => f.title),
			},
			"user-revisit",
		)
		gitCommitState(
			`haiku: user-revisit ${revisitTargetStage} (iteration ${iterResult.count})`,
		)

		emitTelemetry("haiku.orchestrator.action", {
			intent: revisitSlug,
			action: "revisit_with_reasons",
			feedback_count: String(createdFeedback.length),
		})
		syncSessionMetadata(revisitSlug, args.state_file as string | undefined)

		return text(
			JSON.stringify(
				{
					action: "revisit",
					from_stage:
						(revisitIntentData.active_stage as string) || revisitTargetStage,
					from_phase: revisitResult.target_phase ? "gate" : "execute",
					to_stage: revisitTargetStage,
					to_phase: "elaborate",
					iteration: iterResult.count,
					visits: iterResult.count, // legacy alias — prefer `iteration`
					feedback_created: createdFeedback,
					message: `Revisited ${revisitTargetStage} (elaborate, iteration ${iterResult.count}). Created ${createdFeedback.length} feedback item(s).`,
				},
				null,
				2,
			),
		)
	},
})
