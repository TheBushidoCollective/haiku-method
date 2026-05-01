// tools/orchestrator/haiku_run_next.ts — The workflow driver. Sole tool
// agents call to advance the H·AI·K·U lifecycle.
//
// Flow per call:
//   1. Auto-resolve `intent` when omitted (current branch → sole
//      active intent → error).
//   2. Validate we're on the intent branch.
//   3. Stage-branch enforcement (align checkout to active stage so
//      writes land on the right branch).
//   4. Optional external_review_url write (records URL on the
//      blocked stage's state.json for approval polling).
//   5. Drive `runNext(slug)` — the canonical workflow tick.
//   6. Telemetry + session log.
//   7. Per-action processing:
//      - external_review_requested: append the "where did you submit"
//        prompt to the message.
//      - gate_review: open the review UI, block, process the
//        decision (approved → workflowAdvancePhase/Stage/Complete or
//        completeOrReviewIntent; external_review → mark blocked;
//        revisit_action short-circuit; otherwise persist feedback
//        files and route by gate context).
//      - safe_intent_repair: try the embedded repair agent; if it
//        succeeds, re-run runNext for the real next action.
//      - everything else: enrich + render and return.
//
// Output shape: JSON action body + "---" separator + per-action
// prompt instructions (rendered by buildRunInstructions, harness-
// adapted by adaptInstructions).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { adaptInstructions } from "../../harness-instructions.js"
import { runWorkflowTick } from "../../orchestrator/workflow/run-tick.js"
import type { OrchestratorAction as OrchestratorActionType } from "../../orchestrator.js"
import {
	buildGuardResponse,
	buildRunInstructions,
	completeOrReviewIntent,
	enrichActionWithPreview,
	getElicitInput,
	getOpenReviewAndWait,
	isStagePreExecute,
	listUnits,
	type OrchestratorAction,
	resetFixLoopBolts,
	workflowAdvancePhase,
	workflowAdvanceStage,
	workflowCompleteStage,
	workflowIntentComplete,
	writeReviewFeedbackFiles,
} from "../../orchestrator.js"

/** Single-source dispatch: one workflow tick → one action. Handles
 *  the intent-not-found and registry-gap cases inline. */
function dispatchOrchestratorAction(slug: string): OrchestratorActionType {
	const tick = runWorkflowTick(slug)
	if (tick?.action) return tick.action
	if (!tick) {
		return { action: "error", message: `Intent '${slug}' not found` }
	}
	return {
		action: "error",
		message: `runWorkflowTick produced no action for intent '${slug}' (state: ${tick.state}). Indicates a derive-state output without a registered handler.`,
	}
}

import { reportError } from "../../sentry.js"
import { logSessionEvent } from "../../session-metadata.js"
import { sealIntentState } from "../../state-integrity.js"
import {
	findHaikuRoot,
	gitCommitState,
	intentDir,
	intentFromCurrentBranch,
	isGitRepo,
	listVisibleIntents,
	parseFrontmatter,
	readJson,
	setFrontmatterField,
	stageStatePath,
	syncSessionMetadata,
	validateBranch,
	writeJson,
} from "../../state-tools.js"
import { resolveStudio } from "../../studio-reader.js"
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
	name: "haiku_run_next",
	description:
		"Advance the workflow. Returns the next action for the agent to take, with rendered instructions appended. Auto-resolves `intent` from the current branch when omitted; if multiple intents are active, requires explicit `intent`. Pass `external_review_url` when a stage is blocked on external review to record the URL for approval polling.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string" },
			external_review_url: { type: "string" },
			state_file: { type: "string" },
		},
	},
	async handle(args) {
		// Auto-resolve `intent` when omitted. Resolution order:
		//   1. Current git branch (`haiku/<slug>/main` or `haiku/<slug>/<stage>`)
		//      — the user's checkout already names the intent, so the skill
		//      surface can stay thin and doesn't need to prompt.
		//   2. Sole active intent on the filesystem — if there's exactly one,
		//      use it; zero-or-many yields an error with available slugs.
		let slug = (args.intent as string) || ""
		if (!slug) {
			const branchMatch = intentFromCurrentBranch()
			if (branchMatch) {
				slug = branchMatch.slug
			} else {
				const root = findHaikuRoot()
				const intentsDir = join(root, "intents")
				const active = existsSync(intentsDir)
					? listVisibleIntents(intentsDir).filter(
							(i) => (i.data.status as string) !== "completed",
						)
					: []
				if (active.length === 1) {
					slug = active[0].slug
				} else if (active.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No active intents found. Start one with /haiku:start.",
							},
						],
						isError: true,
					}
				} else {
					return {
						content: [
							{
								type: "text" as const,
								text: `Multiple active intents (${active.map((i) => i.slug).join(", ")}). Pass \`intent\` explicitly, or checkout an intent branch (\`git switch haiku/<slug>/main\`) so the workflow engine can auto-resolve.`,
							},
						],
						isError: true,
					}
				}
			}
		}
		const stFile = args.state_file as string | undefined

		const branchCheck = validateBranch(slug, "intent")
		if (branchCheck) {
			return {
				content: [{ type: "text" as const, text: branchCheck }],
				isError: true,
			}
		}

		// Stage-branch enforcement: before ANY stage-scoped write, align
		// the current checkout with the active stage branch. If main has
		// drifted ahead (feedback files or state leaked there), merge
		// main → stage first so the workflow engine sees a consistent view. No-op in
		// filesystem mode. Must run BEFORE the external_review_url write
		// below — otherwise that write could land on the wrong branch.
		{
			const intentFile = join(findHaikuRoot(), "intents", slug, "intent.md")
			if (existsSync(intentFile)) {
				const im = readFrontmatter(intentFile)
				const activeStage = (im.active_stage as string) || ""
				const guard = ensureOnStageBranch(slug, activeStage || undefined)
				if (!guard.ok) {
					return buildGuardResponse(slug, activeStage, guard, "run_next entry")
				}
			}
		}

		// Gap 8: If external_review_url is passed and stage is blocked,
		// store it. Placed AFTER the stage-branch guard so this write
		// lands on the stage branch, not intent main.
		if (args.external_review_url) {
			try {
				const root = findHaikuRoot()
				const intentFile = join(root, "intents", slug, "intent.md")
				if (existsSync(intentFile)) {
					const intentFm = readFrontmatter(intentFile)
					const activeStage = (intentFm.active_stage as string) || ""
					if (activeStage) {
						const ssPath = stageStatePath(slug, activeStage)
						const ssData = readJson(ssPath)
						ssData.external_review_url = args.external_review_url as string
						writeJson(ssPath, ssData)
					}
				}
			} catch {
				/* non-fatal */
			}
		}

		// Workflow-engine dispatch: read disk → derive state → run
		// per-state handler. The handler registry lives in
		// orchestrator/workflow/handlers/.
		const result = dispatchOrchestratorAction(slug)
		emitTelemetry("haiku.orchestrator.action", {
			intent: slug,
			action: result.action,
		})
		if (stFile)
			logSessionEvent(stFile, {
				event: "run_next",
				intent: slug,
				action: result.action,
				stage: result.stage,
				unit: result.unit,
				hat: result.hat,
				wave: result.wave,
			})

		if (stFile && result.action === "outputs_missing") {
			logSessionEvent(stFile, {
				event: "outputs_missing",
				intent: slug,
				stage: result.stage,
				missing: result.missing,
			})
		}
		if (stFile && result.action === "discovery_missing") {
			logSessionEvent(stFile, {
				event: "discovery_missing",
				intent: slug,
				stage: result.stage,
				missing: result.missing,
			})
		}
		// Read intent metadata for instruction building (used in all
		// return paths).
		let intentMeta: Record<string, unknown> = {}
		try {
			const iDir = intentDir(slug)
			const intentRaw = readFileSync(join(iDir, "intent.md"), "utf8")
			const parsed = parseFrontmatter(intentRaw)
			intentMeta = parsed.data
		} catch {
			/* intent might not exist for error actions */
		}
		const intentStudio = (intentMeta.studio as string) || ""

		// Helper to enrich result with preview and append instructions.
		const withInstructions = (resultObj: Record<string, unknown>): string => {
			enrichActionWithPreview(resultObj as OrchestratorAction)
			const instructions = buildRunInstructions(
				slug,
				intentStudio,
				resultObj as OrchestratorAction,
				intentDir(slug),
			)
			const adapted = adaptInstructions(instructions)
			// Strip tell_user/next_step from outer JSON — they appear in
			// the announcement section.
			const { tell_user: _tu, next_step: _ns, ...resultForJson } = resultObj
			return `${JSON.stringify(resultForJson, null, 2)}\n\n---\n\n${adapted}`
		}

		// External review: include instructions about recording the URL.
		if (result.action === "external_review_requested") {
			result.message = `${(result.message as string) || ""}\n\nIMPORTANT: Ask the user WHERE they submitted the work for review (PR URL, MR link, email, Slack channel, etc.). Record the URL by calling haiku_run_next { intent: "${slug}", external_review_url: "<url>" } so the workflow engine can track approval status.`
		}

		const _openReviewAndWait = getOpenReviewAndWait()
		const _elicitInput = getElicitInput()

		// Gate review: open review UI, block until user decides, process
		// decision.
		if (result.action === "gate_review" && _openReviewAndWait) {
			const stage = result.stage as string
			const nextStage = result.next_stage as string | null
			const nextPhase = result.next_phase as string | null
			const gateContext = (result.gate_context as string) || "stage_gate"
			const gateType = result.gate_type as string
			const intentDirPath = `.haiku/intents/${slug}`
			if (stFile)
				logSessionEvent(stFile, {
					event: "gate_review_opened",
					intent: slug,
					stage,
					gate_type: gateType,
				})
			try {
				const reviewResult = await _openReviewAndWait(
					intentDirPath,
					gateType,
					// signal not threaded through MCP per-tool calls — fine,
					// review UI handles its own cancel via WS close.
					undefined,
					{
						gateContext,
						stage,
						nextStage,
						nextPhase,
					},
				)

				// Re-enforce stage branch after the await — the user may
				// have manually checked out another branch during the
				// review wait. Every downstream branch of this switch
				// writes stage or intent state, so alignment must be
				// re-verified here.
				{
					const postReviewGuard = ensureOnStageBranch(slug, stage)
					if (!postReviewGuard.ok) {
						return buildGuardResponse(
							slug,
							stage,
							postReviewGuard,
							"after review wait",
						)
					}
				}

				if (stFile)
					logSessionEvent(stFile, {
						event: "gate_decision",
						intent: slug,
						stage,
						decision: reviewResult.decision,
						feedback: reviewResult.feedback,
					})
				if (reviewResult.decision === "approved") {
					// Final intent-completion review — the terminal bookend.
					// Approval fires workflowIntentComplete and returns
					// intent_complete.
					if (gateContext === "intent_completion") {
						const studioForCompletion =
							(readFrontmatter(join(intentDir(slug), "intent.md"))
								.studio as string) || ""
						workflowIntentComplete(slug)
						syncSessionMetadata(slug, args.state_file as string | undefined)
						const gateResult = {
							action: "intent_complete",
							intent: slug,
							studio: studioForCompletion,
							message:
								"Final review approved — intent complete. Report the completion summary to the user.",
						}
						return text(withInstructions(gateResult))
					}
					if (gateContext === "intent_review") {
						// Intent approved — mark as reviewed AND advance phase
						// to execute.
						const intentFilePath = join(
							process.cwd(),
							intentDirPath,
							"intent.md",
						)
						setFrontmatterField(intentFilePath, "intent_reviewed", true)
						if (nextPhase) workflowAdvancePhase(slug, stage, nextPhase)
						gitCommitState(`haiku: intent ${slug} approved by user`)
						syncSessionMetadata(slug, args.state_file as string | undefined)
						const gateResult = {
							action: "intent_approved",
							intent: slug,
							stage,
							from_phase: "elaborate",
							to_phase: nextPhase,
							message: `Intent approved — advancing to ${nextPhase || "execute"}. IMPORTANT: Call haiku_run_next { intent: "${slug}" } immediately. Do NOT ask the user — the transition was already approved.`,
						}
						return text(withInstructions(gateResult))
					}
					if (gateContext === "elaborate_to_execute" && nextPhase) {
						// Phase advancement (specs approved → start execution).
						workflowAdvancePhase(slug, stage, nextPhase)
						syncSessionMetadata(slug, args.state_file as string | undefined)
						const gateResult = {
							action: "advance_phase",
							intent: slug,
							stage,
							from_phase: "elaborate",
							to_phase: nextPhase,
							message: `Specs approved — advancing to ${nextPhase}. IMPORTANT: Call haiku_run_next { intent: "${slug}" } immediately. Do NOT ask the user — the transition was already approved.`,
						}
						return text(withInstructions(gateResult))
					}
					if (nextStage) {
						workflowAdvanceStage(slug, stage, nextStage)
						syncSessionMetadata(slug, args.state_file as string | undefined)
						const gateResult = {
							action: "advance_stage",
							intent: slug,
							stage,
							next_stage: nextStage,
							gate_outcome: "advanced",
							message: `Approved — advancing to '${nextStage}'. IMPORTANT: Call haiku_run_next { intent: "${slug}" } immediately. Do NOT ask the user, do NOT summarize, do NOT say "want me to continue?" — the gate was already approved. Just call the tool.`,
						}
						return text(withInstructions(gateResult))
					}
					workflowCompleteStage(slug, stage, "advanced")
					syncSessionMetadata(slug, args.state_file as string | undefined)
					// Stage approved ≠ intent complete. Enter the intent-
					// review bookend unless the intent explicitly opted out.
					const approvedStudio =
						(readFrontmatter(join(intentDir(slug), "intent.md"))
							.studio as string) || ""
					const gateResult = completeOrReviewIntent(
						slug,
						approvedStudio,
						`Stage '${stage}' approved — final stage complete.`,
					)
					return text(withInstructions(gateResult))
				}
				if (reviewResult.decision === "external_review") {
					workflowCompleteStage(slug, stage, "blocked")
					syncSessionMetadata(slug, args.state_file as string | undefined)
					const gateResult = {
						action: "external_review_requested",
						intent: slug,
						stage,
						feedback: reviewResult.feedback,
						message: isGitRepo()
							? `External review requested. Open ONE merge request from branch 'haiku/${slug}/${stage}' to 'haiku/${slug}/main'. Do NOT open separate MRs for individual units — all unit work is already merged into the stage branch. Include the H·AI·K·U browse link in the description so reviewers can see the intent, units, and knowledge artifacts. Record the review URL via haiku_run_next { intent, external_review_url }. Run /haiku:pickup again after approval.`
							: `External review requested. Submit the work for review through your project's review process. Record the review URL via haiku_run_next { intent, external_review_url }. Run /haiku:pickup again after approval.`,
					}
					return text(withInstructions(gateResult))
				}
				// Revisit-dispatch short-circuit: when the decision came in
				// via POST /api/revisit, the HTTP bridge parks the dispatch
				// action in `annotations.revisit_action` and the
				// orchestrator's instruction prose in
				// `annotations.revisit_message`. The `feedback` field is
				// empty on purpose — treating that prose as reviewer-typed
				// input would spawn a new feedback file mirroring the
				// dispatch message back, which the next run would read as
				// a finding. Detect the marker and return the dispatch
				// result verbatim, skipping file creation + rollback.
				const revisitAnnotations = reviewResult.annotations as
					| { revisit_action?: string; revisit_message?: string }
					| undefined
				const revisitAction =
					typeof revisitAnnotations?.revisit_action === "string"
						? revisitAnnotations.revisit_action
						: null
				if (revisitAction) {
					syncSessionMetadata(slug, args.state_file as string | undefined)
					return text(
						withInstructions({
							action: revisitAction,
							intent: slug,
							stage,
							message:
								revisitAnnotations?.revisit_message ||
								`Revisit dispatched on stage '${stage}'. Follow the instructions returned by the orchestrator.`,
						}),
					)
				}

				// Feedback files only make sense when there are built
				// artifacts to critique. If this rejection is happening at
				// pre-execute time (elaborate phase with no completed units
				// in the stage), persist nothing — the reviewer's comments
				// go inline in the action and the agent edits unit specs
				// directly.
				const intentDirPathAbs = join(process.cwd(), intentDirPath)
				const preExecute =
					gateContext === "elaborate_to_execute" ||
					gateContext === "intent_review"
						? isStagePreExecute(intentDirPathAbs, stage)
						: false

				// changes_requested — persist all annotations and feedback
				// as durable feedback files (post-execute contexts only).
				const feedbackIds = preExecute
					? []
					: writeReviewFeedbackFiles(slug, stage, reviewResult)
				const feedbackSummary =
					feedbackIds.length > 0
						? ` Created ${feedbackIds.length} feedback file(s): ${feedbackIds.join(", ")}.`
						: ""

				if (gateContext === "intent_review") {
					// Intent rejected — stay in pending, agent must revise
					// intent.md.
					syncSessionMetadata(slug, args.state_file as string | undefined)
					const gateResult = {
						action: "changes_requested",
						intent: slug,
						stage,
						feedback: reviewResult.feedback,
						annotations: reviewResult.annotations,
						feedback_ids: feedbackIds,
						message: `Changes requested on intent: ${reviewResult.feedback || "(see annotations)"}.${feedbackSummary} Revise the intent description, then call haiku_run_next { intent: "${slug}" } again.`,
					}
					return text(withInstructions(gateResult))
				}
				if (gateContext === "intent_completion") {
					// Final-review rejection — drop out of the completion-
					// review phase and route the agent back. Feedback files
					// were written against the last stage; the agent invokes
					// /haiku:revisit (or logs a stage_revisit FB directly)
					// to re-open that stage's elaborate phase and address
					// them. Reset the dispatched flag so
					// the next time we re-enter the completion review phase,
					// the studio-level reviewers RE-AUDIT the fixes instead
					// of short-circuiting to the gate on the stale "already
					// dispatched" signal. Also reset intent-scope fix-loop
					// bolt counters so the next completion cycle starts with
					// a fresh budget. These fields are workflow-tracked in
					// INTENT_FIELDS, so we must reseal the integrity
					// checksum after writing or verifyIntentState() will
					// false-positive.
					const intentFilePath = join(intentDir(slug), "intent.md")
					setFrontmatterField(intentFilePath, "phase", "active")
					setFrontmatterField(
						intentFilePath,
						"completion_review_dispatched",
						false,
					)
					setFrontmatterField(
						intentFilePath,
						"completion_review_skipped",
						false,
					)
					resetFixLoopBolts(slug, "")
					sealIntentState(slug)
					gitCommitState(
						`haiku: intent ${slug} completion-review rejected, reopening for revisit`,
					)
					syncSessionMetadata(slug, args.state_file as string | undefined)
					const gateResult = {
						action: "changes_requested",
						intent: slug,
						stage: null,
						gate_context: "intent_completion",
						feedback: reviewResult.feedback,
						annotations: reviewResult.annotations,
						feedback_ids: feedbackIds,
						message: `Changes requested on intent completion: ${reviewResult.feedback || "(see annotations)"}.${feedbackSummary} The intent is no longer in final review. Invoke the /haiku:revisit slash command (or log stage_revisit feedback at the target stage directly via \`haiku_feedback\` with \`resolution: "stage_revisit"\`) to re-open the relevant stage, then address the feedback and call \`haiku_run_next\` to drive back to final review.`,
					}
					return text(withInstructions(gateResult))
				}
				if (gateContext === "elaborate_to_execute") {
					// Don't advance phase — stay in elaborate so agent can
					// fix.
					syncSessionMetadata(slug, args.state_file as string | undefined)
					// Pre-execute rejection: no feedback files, inline
					// annotations, direct the agent to edit existing
					// unstarted unit specs (or add new unit files). Nothing
					// has been built — there is no artifact-level feedback
					// to persist.
					const unstartedUnits = listUnits(intentDirPathAbs, stage)
						.filter((u) => u.status !== "completed")
						.map((u) => u.name)
					const gateResult = {
						action: "revise_unit_specs",
						intent: slug,
						stage,
						feedback: reviewResult.feedback,
						annotations: reviewResult.annotations,
						unstarted_units: unstartedUnits,
						units_dir: `.haiku/intents/${slug}/stages/${stage}/units/`,
						message: `Changes requested on unit specs:\n\n${reviewResult.feedback || "(see annotations)"}\n\nNothing has been built yet — NO feedback files were created. Resolve by EDITING the unstarted unit.md files in \`.haiku/intents/${slug}/stages/${stage}/units/\` directly (or adding new unit files if the scope needs expansion). Do NOT draft a full new wave of units to "close feedback" — that's a post-execute flow. When the edits are done, call \`haiku_run_next { intent: "${slug}" }\` again to re-open the review gate.`,
					}
					return text(withInstructions(gateResult))
				}
				syncSessionMetadata(slug, args.state_file as string | undefined)
				const gateResult = {
					action: "changes_requested",
					intent: slug,
					stage,
					feedback: reviewResult.feedback,
					annotations: reviewResult.annotations,
					feedback_ids: feedbackIds,
					message: `Changes requested: ${reviewResult.feedback || "(see annotations)"}.${feedbackSummary} Address the feedback, then call haiku_run_next { intent: "${slug}" } again.`,
				}
				return text(withInstructions(gateResult))
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err)
				const errorStack = err instanceof Error ? err.stack : ""

				console.error(`[haiku] gate_review failed: ${errorMsg}`)
				reportError(err, { intent: slug, stage })

				// Log full error to .haiku/ for debugging.
				try {
					const logDir = join(process.cwd(), ".haiku", "logs")
					mkdirSync(logDir, { recursive: true })
					writeFileSync(
						join(logDir, "gate-review-error.log"),
						`${new Date().toISOString()}\nintent: ${slug}\nstage: ${stage}\nerror: ${errorMsg}\n${errorStack}\n---\n`,
						{ flag: "a" },
					)
				} catch {
					/* logging failure is non-fatal */
				}

				// Classify error: agent-fixable or retryable errors go
				// back to the agent.
				const agentFixable =
					errorMsg.includes("Could not parse intent") ||
					errorMsg.includes("No such file") ||
					errorMsg.includes("ENOENT") ||
					errorMsg.includes("frontmatter") ||
					errorMsg.includes("invalid identifier") ||
					errorMsg.includes("Circular dependency") ||
					errorMsg.includes("timeout") ||
					errorMsg.includes("Timeout")

				if (agentFixable) {
					syncSessionMetadata(slug, args.state_file as string | undefined)
					return {
						content: [
							{
								type: "text" as const,
								text: `GATE BLOCKED: ${errorMsg}. This is a data issue the agent can fix — check that the intent directory and files are correctly structured, then call haiku_run_next again.`,
							},
						],
						isError: true,
					}
				}

				// Infrastructure failure — fall back to elicitation.
				if (stFile)
					logSessionEvent(stFile, {
						event: "gate_elicitation_fallback",
						intent: slug,
						stage,
						error: errorMsg,
					})
				if (_elicitInput) {
					try {
						const elicitResult = await _elicitInput({
							message:
								gateContext === "intent_review"
									? `Review UI failed (${errorMsg}). Approve intent '${slug}' to begin work?`
									: `Review UI failed (${errorMsg}). Approve stage '${stage}' specs to proceed to execution?`,
							requestedSchema: {
								type: "object" as const,
								properties: {
									decision: {
										type: "string",
										title: "Decision",
										description: "Approve specs or request changes",
										enum: ["approve", "request_changes"],
									},
									feedback: {
										type: "string",
										title: "Feedback (optional)",
										description: "Any notes or requested changes",
									},
								},
								required: ["decision"],
							},
						})

						// Re-enforce stage branch after the elicitation
						// await — user may have switched branches while the
						// prompt was up.
						{
							const postElicitGuard = ensureOnStageBranch(slug, stage)
							if (!postElicitGuard.ok) {
								return buildGuardResponse(
									slug,
									stage,
									postElicitGuard,
									"after elicitation",
								)
							}
						}

						if (elicitResult.action === "accept" && elicitResult.content) {
							const decision = (elicitResult.content as Record<string, string>)
								.decision
							const feedback =
								(elicitResult.content as Record<string, string>).feedback || ""
							if (decision === "approve") {
								if (gateContext === "intent_review") {
									const intentFilePath = join(
										process.cwd(),
										intentDirPath,
										"intent.md",
									)
									setFrontmatterField(intentFilePath, "intent_reviewed", true)
									if (nextPhase) workflowAdvancePhase(slug, stage, nextPhase)
									gitCommitState(
										`haiku: intent ${slug} approved by user (elicitation)`,
									)
									syncSessionMetadata(
										slug,
										args.state_file as string | undefined,
									)
									const elicitApproveResult = {
										action: "intent_approved",
										intent: slug,
										stage,
										from_phase: "elaborate",
										to_phase: nextPhase,
										message: `Intent approved — advancing to ${nextPhase || "execute"}. Call haiku_run_next immediately.`,
									}
									return text(withInstructions(elicitApproveResult))
								}
								if (gateContext === "elaborate_to_execute" && nextPhase) {
									workflowAdvancePhase(slug, stage, nextPhase)
									syncSessionMetadata(
										slug,
										args.state_file as string | undefined,
									)
									const elicitApproveResult = {
										action: "advance_phase",
										intent: slug,
										stage,
										from_phase: "elaborate",
										to_phase: nextPhase,
										message:
											"Specs approved via elicitation — advancing to execute",
									}
									return text(withInstructions(elicitApproveResult))
								}
								if (nextStage) {
									workflowAdvanceStage(slug, stage, nextStage)
									syncSessionMetadata(
										slug,
										args.state_file as string | undefined,
									)
									const elicitApproveResult = {
										action: "advance_stage",
										intent: slug,
										stage,
										next_stage: nextStage,
										gate_outcome: "advanced",
										message: "Approved via elicitation",
									}
									return text(withInstructions(elicitApproveResult))
								}
								// Final stage approved via elicitation — enter
								// intent-completion bookend instead of completing
								// silently.
								workflowCompleteStage(slug, stage, "advanced")
								syncSessionMetadata(slug, args.state_file as string | undefined)
								const elicitStudio =
									(readFrontmatter(join(intentDir(slug), "intent.md"))
										.studio as string) || ""
								const elicitApproveResult = completeOrReviewIntent(
									slug,
									elicitStudio,
									"Final stage approved via elicitation.",
								)
								return text(withInstructions(elicitApproveResult))
							}
							// request_changes
							syncSessionMetadata(slug, args.state_file as string | undefined)
							const changeMsg =
								gateContext === "intent_review"
									? `Changes requested on intent: ${feedback}. Revise the intent description, then call haiku_run_next { intent: "${slug}" } again.`
									: `Changes requested: ${feedback}. Call haiku_run_next { intent: "${slug}" } again after fixing.`
							const elicitChangesResult = {
								action: "changes_requested",
								intent: slug,
								stage,
								feedback,
								message: changeMsg,
							}
							return text(withInstructions(elicitChangesResult))
						}
						// User declined/cancelled elicitation — stay blocked.
						syncSessionMetadata(slug, args.state_file as string | undefined)
						const elicitCancelResult = {
							action: "gate_blocked",
							intent: slug,
							stage,
							message:
								"Gate review cancelled. Call haiku_run_next again to retry.",
						}
						return text(withInstructions(elicitCancelResult))
					} catch {
						// Elicitation also failed — return error.
					}
				}

				syncSessionMetadata(slug, args.state_file as string | undefined)
				return {
					content: [
						{
							type: "text" as const,
							text: `GATE BLOCKED: Review UI and elicitation both failed. Error: ${errorMsg}. Logged to .haiku/logs/gate-review-error.log. Call haiku_run_next to retry.`,
						},
					],
					isError: true,
				}
			}
		}

		// Repair agent intercept — if runNext detected a broken migrated
		// intent, try the embedded repair agent before returning to the
		// outer agent. Falls through to the normal withInstructions
		// return if the agent isn't available or repair fails.
		if (result.action === "safe_intent_repair") {
			try {
				const { runRepairAgent } = await import("../../repair-agent.js")
				const root = findHaikuRoot()
				const iDir = join(root, "intents", slug)

				const studioInfo = resolveStudio(intentStudio)
				const studioDir = studioInfo?.path
				if (!studioDir) {
					syncSessionMetadata(slug, args.state_file as string | undefined)
					return text(withInstructions(result))
				}

				const activeStage = (result.stage as string) || ""
				const diagnosis = {
					slug,
					intentDir: iDir,
					studio: intentStudio,
					studioDir,
					activeStage,
					synthesizedStages: (result.synthesized_stages as string[]) || [],
					needsManualReview: (result.needs_manual_review as string[]) || [],
					phaseRegressed: result.phase_regressed as boolean,
					unitsMissingInputs: (result.units_missing_inputs as string[]) || [],
				}

				const repairResult = await runRepairAgent(diagnosis)

				// Re-enforce stage branch after the repair-agent await — it
				// can take minutes, during which the user or the repair
				// agent itself may have touched the checkout. Every
				// downstream write depends on the correct branch.
				{
					const postRepairGuard = ensureOnStageBranch(
						slug,
						(result.stage as string) || undefined,
					)
					if (!postRepairGuard.ok) {
						return buildGuardResponse(
							slug,
							(result.stage as string) || undefined,
							postRepairGuard,
							"after repair-agent run",
						)
					}
				}

				if (repairResult.success && !repairResult.fallbackUsed) {
					// Repair agent succeeded — run the workflow again to get the real
					// next action.
					const postRepairResult = dispatchOrchestratorAction(slug)

					// Guard: if repair didn't actually fix things, don't loop.
					if (postRepairResult.action === "safe_intent_repair") {
						// Fall through to return the original result as-is.
					} else {
						emitTelemetry("haiku.orchestrator.action", {
							intent: slug,
							action: postRepairResult.action,
						})
						if (stFile)
							logSessionEvent(stFile, {
								event: "run_next",
								intent: slug,
								action: postRepairResult.action,
								stage: postRepairResult.stage,
								unit: postRepairResult.unit,
								hat: postRepairResult.hat,
								wave: postRepairResult.wave,
							})

						syncSessionMetadata(slug, args.state_file as string | undefined)

						const repairNote = `**Intent repaired automatically:** ${repairResult.summary}\n\n---\n\n`
						return {
							content: [
								{
									type: "text" as const,
									text: repairNote + withInstructions(postRepairResult),
								},
							],
						}
					}
				}
				// Repair failed or used fallback — fall through to return
				// safe_intent_repair as-is.
			} catch {
				// Repair agent not available — fall through to normal
				// handling.
			}
		}

		syncSessionMetadata(slug, args.state_file as string | undefined)
		return text(withInstructions(result))
	},
})
