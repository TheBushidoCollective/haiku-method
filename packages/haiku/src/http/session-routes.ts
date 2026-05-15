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

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { FastifyInstance } from "fastify"
import {
	type AdvanceResponse,
	DirectionSelectRequestSchema,
	type DirectionSelectResponse,
	QuestionAnswerRequestSchema,
	type QuestionAnswerResponse,
	ReviewDecisionRequestSchema,
	type ReviewDecisionResponse,
	SESSION_ANSWER_MAX_BYTES,
} from "haiku-api"
import { HAIKU_UI_HTML } from "../haiku-ui-html.js"
import { broadcastIntent } from "../intent-broadcaster.js"
import {
	buildApprovalRecord,
	buildReviewRecord,
} from "../orchestrator/workflow/sign-slot.js"
import {
	type DirectionSelection,
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
	gitCommitStateBackgroundPush,
	intentDir,
	parseFrontmatter,
	persistDesignDirectionSelection,
	persistDesignDirectionUploads,
	readFeedbackFiles,
	readJson,
	setFrontmatterField,
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
		// Live-session model: queue the decision into pending_decision
		// rather than terminally setting status="decided". This is what
		// awaitGateReviewSession drains on entry / on each wake. Mirrors
		// the WS `decide` handler in http/ws.ts so HTTP and WebSocket
		// clients converge on the same consumer path. Without this, the
		// SPA's submit (which goes through HTTP via client.submitDecision)
		// would never reach a blocked await and would time out at 30 min.
		updateSession(req.params.sessionId, {
			pending_decision: {
				decision,
				feedback,
				annotations,
				submitted_at: new Date().toISOString(),
			},
		})
		if (session.intent_slug) {
			broadcastIntent(session.intent_slug, {
				type: "pending_decision_changed",
				session_id: req.params.sessionId,
				queued: true,
			})
		}
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
			// Three write paths:
			//   1. select mode → persistDesignDirectionSelection — writes
			//      annotated PNG sidecars + state.json with screenshot paths,
			//      with a minimal state-only fallback when there are no
			//      screenshots OR the full persist throws (disk full,
			//      permission denied, etc).
			//   2. upload mode → persistDesignDirectionUploads — decodes
			//      designer-uploaded files onto disk under
			//      `<stage>/artifacts/design-direction/uploads/` and stamps
			//      `design_direction_selected: true` so the next
			//      haiku_run_next surfaces the upload paths.
			//   3. regenerate / generate modes → no persist. The selection
			//      stays in the in-memory session so the await handler can
			//      hand the agent back; the workflow's design_direction_
			//      selected flag remains false so elaborate keeps requiring
			//      the picker until the user picks select or upload.
			//
			// Without these, the elaborate handler would re-emit
			// design_direction_required and the agent would loop into a 409
			// on the closed session.
			// `selection` is the runtime in-memory form of the user's
			// response — paths-only for files, no embedded data URLs. It
			// matches the wire shape for select / regenerate / generate
			// modes and diverges for upload (data_url → path).
			let selection: DirectionSelection =
				parsed.data.mode === "upload"
					? // Placeholder — overwritten in the upload branch below
						// once persistDesignDirectionUploads returns the paths.
						{ mode: "upload", files: [] }
					: parsed.data
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

			if (parsed.data.mode === "upload") {
				const ddSession = getSession(req.params.sessionId)
				const slug =
					ddSession?.session_type === "design_direction"
						? ddSession.intent_slug
						: ""
				const activeStage = slug ? readActiveStage(slug) : ""
				if (slug && activeStage) {
					try {
						const { uploads } = persistDesignDirectionUploads({
							slug,
							stage: activeStage,
							files: parsed.data.files,
							...(parsed.data.comments
								? { comments: parsed.data.comments }
								: {}),
						})
						// Replace the heavy data URLs with paths-only metadata
						// for the in-memory session record. Authoritative
						// storage is on disk now and the workflow surfaces
						// uploads by path on the next haiku_run_next.
						selection = {
							mode: "upload",
							files: uploads,
							...(parsed.data.comments
								? { comments: parsed.data.comments }
								: {}),
						}
					} catch (err) {
						req.log.error(
							{ err },
							"persistDesignDirectionUploads failed — designer uploads not durable",
						)
						reply.status(500).send({
							error: "upload_persist_failed",
							detail: err instanceof Error ? err.message : String(err),
						})
						return
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

	// ── Picker: SPA shell + select ─────────────────────────────────────
	// Generic single-select picker (studio / mode / stage / confirm).
	// Replaces MCP elicitation. The blocking tool (e.g.
	// haiku_select_studio) waits on session.status === "answered".
	instance.get<{ Params: { sessionId: string } }>(
		"/picker/:sessionId",
		async (req, reply) => {
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "picker") {
				reply.status(404).send("Session not found")
				return
			}
			reply.type("text/html; charset=utf-8").send(HAIKU_UI_HTML)
		},
	)
	instance.post<{ Params: { sessionId: string } }>(
		"/picker/:sessionId/select",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "picker") {
				reply.status(404).send({ error: "Session not found or expired" })
				return
			}
			if (session.status === "answered") {
				reply.status(409).send({ error: "Picker already submitted" })
				return
			}
			const body = (req.body ?? {}) as Record<string, unknown>
			const id = typeof body.id === "string" ? body.id : ""
			if (!id) {
				reply.status(400).send({ error: "Missing required field: id" })
				return
			}
			// url_input pickers carry a free-text URL in `id` instead of
			// a selection from a fixed set. Validate URL shape (http(s)://
			// or git+ssh-shaped) but skip the option-set check.
			if (session.kind === "url_input") {
				const trimmed = id.trim()
				if (trimmed.length < 4 || trimmed.length > 2048) {
					reply.status(400).send({
						error: "URL must be 4–2048 characters",
					})
					return
				}
				if (
					!/^https?:\/\//i.test(trimmed) &&
					!/^git@/i.test(trimmed) &&
					!/^ssh:\/\//i.test(trimmed)
				) {
					reply.status(400).send({
						error:
							"URL must start with http://, https://, ssh://, or git@ — paste the full URL",
					})
					return
				}
				const { updatePickerSession } = await import("../sessions.js")
				updatePickerSession(req.params.sessionId, {
					status: "answered",
					selection: { id: trimmed },
				})
				reply.send({ ok: true, id: trimmed })
				return
			}
			const validIds = new Set(session.options.map((o) => o.id))
			if (!validIds.has(id)) {
				reply.status(400).send({
					error: `id "${id}" is not in the option set: ${[...validIds].join(", ")}`,
				})
				return
			}
			const { updatePickerSession } = await import("../sessions.js")
			updatePickerSession(req.params.sessionId, {
				status: "answered",
				selection: { id },
			})
			reply.send({ ok: true, id })
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

	// POST /api/advance/:sessionId — the ONLY SPA → engine signal
	// besides /api/feedback (which writes feedback files to disk) and
	// the heartbeat / GET routes. No body, no payload, no workflow
	// verb: the SPA is purely a data-writer + wake source. The cursor
	// reads disk on the next `haiku_run_next` tick and decides.
	//
	// Two effects:
	//
	//   1. Stamp `reviews.user` and `approvals.user` on every unit in
	//      the active stage IF no feedback items are open on that
	//      stage. The user's act of advancing with nothing pending IS
	//      the approval — there's no other signal the SPA needs to
	//      send. When FBs are open, no stamps fire; the cursor walks
	//      Track B first, and the next advance signal (after closure)
	//      does the stamping.
	//   2. Wake the gate session so `haiku_await_gate` returns and the
	//      agent re-enters `haiku_run_next`.
	//
	// Was previously `/api/revisit` with a `reasons[]` payload that
	// bundled FB-create + workflow-verb together — removed
	// 2026-05-14 per the v4 rule "SPA writes data + signals advance;
	// engine decides everything else."
	instance.post<{ Params: { sessionId: string } }>(
		"/api/advance/:sessionId",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, req.params.sessionId)) return
			const session = getSession(req.params.sessionId)
			if (!session || session.session_type !== "review") {
				logFeedbackAction({
					reqId: req.id,
					action: "advance",
					status: 404,
					detail: `session=${req.params.sessionId} not_found_or_wrong_type`,
				})
				reply.status(404).send("Session not found")
				return
			}
			if (!session.intent_slug) {
				logFeedbackAction({
					reqId: req.id,
					action: "advance",
					status: 409,
					detail: `session=${req.params.sessionId} no_intent_context`,
				})
				reply.status(409).send({ error: "Session has no intent context" })
				return
			}
			const slug = session.intent_slug
			const targetStage = readActiveStage(slug)
			if (!targetStage) {
				logFeedbackAction({
					reqId: req.id,
					action: "advance",
					status: 409,
					intent: slug,
					detail: "no_active_stage",
				})
				reply.status(409).send({
					error: "no_active_stage",
					detail: "intent has no active stage",
				})
				return
			}

			const stageOpenFbs = readFeedbackFiles(slug, targetStage).filter(
				(item) =>
					item.status === "pending" ||
					item.status === "fixing" ||
					item.status === "addressed",
			)
			let stampedUserSlots = false
			if (stageOpenFbs.length === 0) {
				try {
					stampUserSlotsForCompletedStage(slug, targetStage)
					stampedUserSlots = true
					gitCommitStateBackgroundPush(
						`haiku: user advance with no pending feedback on ${targetStage} — stamp user slots`,
					)
				} catch (err) {
					logFeedbackAction({
						reqId: req.id,
						action: "advance",
						status: 500,
						intent: slug,
						stage: targetStage,
						detail: `user_slot_stamp_failed: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
			}

			updateSession(req.params.sessionId, {
				pending_decision: {
					decision: "advance",
					feedback: "",
					annotations: {},
					submitted_at: new Date().toISOString(),
				},
			})
			if (session.intent_slug) {
				broadcastIntent(session.intent_slug, {
					type: "pending_decision_changed",
					session_id: req.params.sessionId,
					queued: true,
				})
			}

			const response: AdvanceResponse = {
				ok: true,
				stage: targetStage,
				open_feedback_count: stageOpenFbs.length,
				stamped_user_slots: stampedUserSlots,
			}
			logFeedbackAction({
				reqId: req.id,
				action: "advance",
				status: 200,
				intent: slug,
				stage: targetStage,
				detail: `open_fbs=${stageOpenFbs.length} stamped=${stampedUserSlots}`,
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

/** Stamp `reviews.user` and `approvals.user` (when missing) on every
 *  unit in the stage whose unit FM is still waiting for the user gate.
 *  Called when the SPA signals advance with no open feedback on the
 *  stage — the user clicked "I'm done" and there's nothing for the
 *  cursor to walk, so the per-unit user slots get filled and the
 *  cursor advances on the next tick. Pure filesystem write; no
 *  workflow verbs cross the SPA boundary. */
function stampUserSlotsForCompletedStage(slug: string, stage: string): void {
	const intentDirAbs = intentDir(slug)
	const unitsDir = join(intentDirAbs, "stages", stage, "units")
	if (!existsSync(unitsDir)) return
	const files = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
	for (const f of files) {
		const unitPath = join(unitsDir, f)
		try {
			const { data } = parseFrontmatter(readFileSync(unitPath, "utf8"))
			const outputs = Array.isArray(data.outputs)
				? (data.outputs as string[])
				: []
			const reviews =
				data.reviews && typeof data.reviews === "object"
					? { ...(data.reviews as Record<string, unknown>) }
					: {}
			const approvals =
				data.approvals && typeof data.approvals === "object"
					? { ...(data.approvals as Record<string, unknown>) }
					: {}
			let changedReviews = false
			let changedApprovals = false
			if (!reviews.user) {
				reviews.user = buildReviewRecord(unitPath)
				changedReviews = true
			}
			if (!approvals.user) {
				approvals.user = buildApprovalRecord(intentDirAbs, outputs)
				changedApprovals = true
			}
			if (changedReviews) setFrontmatterField(unitPath, "reviews", reviews)
			if (changedApprovals)
				setFrontmatterField(unitPath, "approvals", approvals)
		} catch {
			// best-effort per-unit; a malformed unit FM shouldn't block the
			// rest of the stage from advancing
		}
	}
}
