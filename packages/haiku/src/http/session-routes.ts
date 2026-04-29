// http/session-routes.ts — Session-scoped routes:
//
//   - SPA shell GETs (review/question/direction)
//   - Mutation POSTs (decide/answer/select)
//   - Session metadata + heartbeat + revisit
//
// All session-tied; each route resolves the session, validates type,
// and either serves the SPA HTML or persists a state transition. The
// revisit route is the heaviest — it bridges to the orchestrator
// tool dispatcher and rebroadcasts the result via session annotations
// so the parked gate_review waiter unblocks.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { FastifyInstance } from "fastify"
import {
	DirectionSelectRequestSchema,
	type DirectionSelectResponse,
	QuestionAnswerRequestSchema,
	type QuestionAnswerResponse,
	ReviewDecisionRequestSchema,
	type ReviewDecisionResponse,
	RevisitRequestSchema,
	type RevisitResponse,
	SESSION_ANSWER_MAX_BYTES,
} from "haiku-api"
import { HAIKU_UI_HTML } from "../haiku-ui-html.js"
import { handleOrchestratorTool } from "../orchestrator.js"
import {
	getSession,
	type QuestionAnnotations,
	type QuestionAnswer,
	type ReviewAnnotations,
	recordHeartbeat,
	updateDesignDirectionSession,
	updateQuestionSession,
	updateSession,
} from "../sessions.js"
import {
	intentDir,
	parseFrontmatter,
	persistDesignDirectionSelection,
	readJson,
	stageStatePath,
	timestamp,
	writeJson,
} from "../state-tools.js"
import { logFeedbackAction } from "./action-log.js"
import { requireTunnelAuth } from "./auth.js"
import { respondSessionApi } from "./session-api.js"
import { parseBodyWithSchema } from "./validation.js"

export function registerSessionRoutes(instance: FastifyInstance): void {
	// ── SPA shell routes (no auth; token lives in URL fragment) ────────
	instance.get<{ Params: { sessionId: string } }>(
		"/review/:sessionId",
		async (req, reply) => {
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "review") {
				reply.status(404).send("Session not found")
				return
			}
			reply.type("text/html; charset=utf-8").send(HAIKU_UI_HTML)
		},
	)

	instance.get<{ Params: { sessionId: string } }>(
		"/question/:sessionId",
		async (req, reply) => {
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "question") {
				reply.status(404).send("Session not found")
				return
			}
			reply.type("text/html; charset=utf-8").send(HAIKU_UI_HTML)
		},
	)

	instance.get<{ Params: { sessionId: string } }>(
		"/direction/:sessionId",
		async (req, reply) => {
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "design_direction") {
				reply.status(404).send("Session not found")
				return
			}
			reply.type("text/html; charset=utf-8").send(HAIKU_UI_HTML)
		},
	)

	// ── Review decide / question answer / direction select ─────────────
	instance.post<{
		Params: { sessionId: string }
	}>("/review/:sessionId/decide", async (req, reply) => {
		if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
		const session = getSession(req.params.sessionId)
		if (!session || session.session_type !== "review") {
			reply.status(404).send("Session not found")
			return
		}
		const parsed = parseBodyWithSchema(
			reply,
			req.body,
			ReviewDecisionRequestSchema,
		)
		if (!parsed.ok) return
		const decision =
			parsed.data.decision === "approved" ? "approved" : "changes_requested"
		const feedback = parsed.data.feedback ?? ""
		const annotations = parsed.data.annotations as ReviewAnnotations | undefined
		updateSession(req.params.sessionId, {
			status: "decided",
			decision,
			feedback,
			annotations,
		})
		const payload: ReviewDecisionResponse = { ok: true, decision, feedback }
		reply.send(payload)
	})

	instance.post<{
		Params: { sessionId: string }
	}>(
		"/question/:sessionId/answer",
		// Body may carry up to 20 ArtifactAnnotator screenshot data URLs
		// (~1.5 MB each base64-encoded) plus text fields.
		{ bodyLimit: SESSION_ANSWER_MAX_BYTES },
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "question") {
				reply.status(404).send("Session not found")
				return
			}
			const parsed = parseBodyWithSchema(
				reply,
				req.body,
				QuestionAnswerRequestSchema,
			)
			if (!parsed.ok) return
			updateQuestionSession(req.params.sessionId, {
				status: "answered",
				answers: parsed.data.answers as QuestionAnswer[],
				feedback: parsed.data.feedback ?? "",
				annotations: parsed.data.annotations as QuestionAnnotations | undefined,
			})
			const payload: QuestionAnswerResponse = { ok: true }
			reply.send(payload)
		},
	)

	instance.post<{
		Params: { sessionId: string }
	}>(
		"/direction/:sessionId/select",
		// Body may carry up to 20 ArtifactAnnotator screenshot data URLs
		// (~1.5 MB each base64-encoded) plus text fields.
		{ bodyLimit: SESSION_ANSWER_MAX_BYTES },
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "design_direction") {
				reply.status(404).send({ error: "Session not found or expired" })
				return
			}
			if (session.status === "answered") {
				reply
					.status(409)
					.send({ error: "Direction already selected for this session" })
				return
			}
			const parsed = parseBodyWithSchema(
				reply,
				req.body,
				DirectionSelectRequestSchema,
			)
			if (!parsed.ok) return

			// Persist the selection to stage state.json BEFORE waking the
			// MCP tool. This is the durable layer: if the MCP client times
			// out and discards the tool result, the next haiku_run_next
			// still finds `design_direction_selected: true` on disk and
			// emits the `design_direction_complete` recovery action.
			//
			// Two write paths:
			//   1. Full persist via persistDesignDirectionSelection — writes
			//      annotated PNG sidecars + state.json with screenshot paths.
			//   2. Minimal state-only fallback — used when there are no
			//      screenshots OR the full persist threw (disk full,
			//      permission denied, etc). Without this fallback the
			//      elaborate handler would re-emit design_direction_required
			//      and the agent would loop into a 409 on the closed session.
			let selection = parsed.data
			if (parsed.data.mode === "select") {
				const ddSession = getSession(req.params.sessionId)
				const slug =
					ddSession?.session_type === "design_direction"
						? ddSession.intent_slug
						: ""
				const activeStage = slug ? readActiveStage(slug) : ""
				if (slug && activeStage) {
					const screenshots = parsed.data.annotations?.screenshots ?? []
					let persisted = false
					if (screenshots.length > 0) {
						try {
							persistDesignDirectionSelection({
								slug,
								stage: activeStage,
								archetype: parsed.data.archetype,
								...(parsed.data.comments
									? { comments: parsed.data.comments }
									: {}),
								screenshots,
							})
							persisted = true
							// Drop the multi-MB data URLs from the in-memory
							// session; authoritative storage is on disk now and
							// the workflow surfaces them by path on the next
							// haiku_run_next.
							const { annotations: _drop, ...rest } = parsed.data
							selection = parsed.data.annotations?.pins
								? {
										...rest,
										annotations: { pins: parsed.data.annotations.pins },
									}
								: rest
						} catch (err) {
							req.log.error(
								{ err },
								"persistDesignDirectionSelection failed — falling back to minimal state write",
							)
						}
					}
					if (!persisted) {
						// Minimal write covers (a) no-screenshot selects and
						// (b) the persist-throw fallback. Without screenshot
						// paths the recovery action just won't have visual
						// context — but the workflow advances.
						try {
							const ssPath = stageStatePath(slug, activeStage)
							const ssData = readJson(ssPath)
							ssData.design_direction_selected = true
							ssData.design_direction_selected_at = timestamp()
							ssData.design_direction = {
								archetype: parsed.data.archetype,
								...(parsed.data.comments
									? { comments: parsed.data.comments }
									: {}),
							}
							delete ssData.design_direction_surfaced
							writeJson(ssPath, ssData)
						} catch (err) {
							req.log.error(
								{ err },
								"minimal design-direction state write failed — agent may need to re-select",
							)
						}
					}
				}
			}

			updateDesignDirectionSession(req.params.sessionId, {
				status: "answered",
				selection,
			})
			const payload: DirectionSelectResponse = { ok: true }
			reply.send(payload)
		},
	)

	// ── API: session / heartbeat / revisit ─────────────────────────────
	instance.get<{ Params: { sessionId: string } }>(
		"/api/session/:sessionId",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			respondSessionApi(reply, req.params.sessionId)
		},
	)

	instance.head<{ Params: { sessionId: string } }>(
		"/api/session/:sessionId/heartbeat",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			const ok = recordHeartbeat(req.params.sessionId)
			reply.status(ok ? 200 : 404).send()
		},
	)

	instance.post<{ Params: { sessionId: string } }>(
		"/api/revisit/:sessionId",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "review") {
				logFeedbackAction({
					reqId: req.id,
					action: "revisit",
					status: 404,
					detail: `session=${req.params.sessionId} not_found_or_wrong_type`,
				})
				reply.status(404).send("Session not found")
				return
			}
			if (!session.intent_slug) {
				logFeedbackAction({
					reqId: req.id,
					action: "revisit",
					status: 409,
					detail: `session=${req.params.sessionId} no_intent_context`,
				})
				reply.status(409).send({ error: "Session has no intent context" })
				return
			}
			const parsed = parseBodyWithSchema(reply, req.body, RevisitRequestSchema)
			if (!parsed.ok) return
			const args: {
				intent: string
				stage?: string
				reasons?: Array<{ title: string; body: string }>
			} = { intent: session.intent_slug }
			if (parsed.data.stage) args.stage = parsed.data.stage
			if (parsed.data.reasons) args.reasons = parsed.data.reasons
			const toolResult = await handleOrchestratorTool("haiku_revisit", args)
			const text = toolResult.content
				.filter((c) => c.type === "text")
				.map((c) => (c as { text: string }).text)
				.join("\n")
			if (toolResult.isError) {
				logFeedbackAction({
					reqId: req.id,
					action: "revisit",
					status: 409,
					intent: session.intent_slug,
					stage: parsed.data.stage ?? null,
					detail: `revisit_failed: ${text.slice(0, 200)}`,
				})
				reply.status(409).send({ error: "revisit_failed", detail: text })
				return
			}
			let action = "revisit"
			let stage: string | undefined
			let feedbackCreated: string[] | undefined
			let message = text
			try {
				const parsedAction = JSON.parse(text) as Record<string, unknown>
				action =
					typeof parsedAction.action === "string" ? parsedAction.action : action
				if (typeof parsedAction.stage === "string") stage = parsedAction.stage
				if (Array.isArray(parsedAction.feedback_created)) {
					feedbackCreated = parsedAction.feedback_created.filter(
						(v): v is string => typeof v === "string",
					)
				}
				if (typeof parsedAction.message === "string") {
					message = parsedAction.message
				}
			} catch {
				/* */
			}
			// Wake the gate_review waiter blocked inside the MCP tool call.
			// Without this, `waitForSession()` stays parked for the full
			// 30-minute timeout and the reviewer's click looks like a
			// no-op — the HTTP response returns 200 to the browser but
			// the agent never sees the decision.
			//
			// IMPORTANT: carry the revisit's action + message in
			// `annotations.revisit_action` / `annotations.revisit_message`
			// and keep `feedback` EMPTY. Stuffing the dispatch message
			// into `feedback` would make the gate_review handler treat it
			// as reviewer-typed prose and write a brand-new feedback file
			// from the instruction text — an ouroboros bug that mirrored
			// the dispatch message back as a new finding on the next run.
			// The handler reads `revisit_action` on wake and short-circuits
			// to the dispatch result verbatim.
			updateSession(req.params.sessionId, {
				status: "decided",
				decision: "changes_requested",
				feedback: "",
				annotations: {
					...(action ? { revisit_action: action } : {}),
					...(stage ? { revisit_stage: stage } : {}),
					...(message ? { revisit_message: message } : {}),
				} as unknown as Parameters<typeof updateSession>[1]["annotations"],
			})
			const response: RevisitResponse = {
				ok: true,
				action,
				stage,
				feedback_created: feedbackCreated,
				message,
			}
			logFeedbackAction({
				reqId: req.id,
				action: "revisit",
				status: 200,
				intent: session.intent_slug,
				stage: stage ?? null,
				detail: `revisit_action=${action}${
					feedbackCreated && feedbackCreated.length > 0
						? ` feedback_created=${feedbackCreated.join(",")}`
						: ""
				}`,
			})
			reply.send(response)
		},
	)
}

function readActiveStage(slug: string): string {
	const intentFile = join(intentDir(slug), "intent.md")
	if (!existsSync(intentFile)) return ""
	try {
		const { data } = parseFrontmatter(readFileSync(intentFile, "utf8"))
		return (data.active_stage as string) || ""
	} catch {
		return ""
	}
}
