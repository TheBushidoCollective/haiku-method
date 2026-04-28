// http/session-api.ts — GET /api/session/:id response shaper.
//
// Maps the in-memory session record (review / question / design-direction
// shapes) to the wire-format JSON the SPA expects. Mostly pure projection
// from the cached session object, plus a fresh-on-every-request
// `current_state` field that calls getCurrentState(slug) to defeat the
// stale-cache divergence the SPA's stage stepper used to suffer from.

import type { FastifyReply } from "fastify"
import { getCurrentState } from "../current-state.js"
import { getSession } from "../sessions.js"

/** Send the JSON response for `GET /api/session/:sessionId`. Returns
 *  404 when the session is unknown. */
export function respondSessionApi(
	reply: FastifyReply,
	sessionId: string,
): void {
	const session = getSession(sessionId)
	if (!session) {
		reply.status(404).send({ error: "Session not found" })
		return
	}
	const data: Record<string, unknown> = {
		session_id: session.session_id,
		session_type: session.session_type,
		status: session.status,
	}
	if (session.session_type === "review") {
		data.intent_slug = session.intent_slug
		data.review_type = session.review_type
		data.gate_type = session.gate_type || "ask"
		data.target = session.target
		data.decision = session.decision
		data.feedback = session.feedback
		if (session.annotations) data.annotations = session.annotations
		if (session.parsedIntent) data.intent = session.parsedIntent
		if (session.parsedUnits) data.units = session.parsedUnits
		if (session.parsedCriteria) data.criteria = session.parsedCriteria
		if (session.parsedMermaid) data.mermaid = session.parsedMermaid
		if (session.intentMockups) data.intent_mockups = session.intentMockups
		if (session.unitMockups) {
			const obj: Record<string, unknown> = {}
			if (session.unitMockups instanceof Map) {
				for (const [k, v] of session.unitMockups) obj[k] = v
			} else {
				Object.assign(obj, session.unitMockups)
			}
			data.unit_mockups = obj
		}
		if (session.stageStates) data.stage_states = session.stageStates
		// Read current_state fresh from disk on every request so the
		// SPA's stage stepper can never disagree with the workflow
		// engine's view of "which stage are we on?". The cached
		// session.parsedIntent.frontmatter.active_stage was captured
		// when the session was first built and goes stale as ticks land.
		if (session.intent_slug) {
			const current = getCurrentState(session.intent_slug)
			if (current) data.current_state = current
		}
		if (session.knowledgeFiles) data.knowledge_files = session.knowledgeFiles
		if (session.stageArtifacts) data.stage_artifacts = session.stageArtifacts
		if (session.outputArtifacts) data.output_artifacts = session.outputArtifacts
		if (session.previousReview) data.previous_review = session.previousReview
		if (session.ad_hoc) data.ad_hoc = true
		if (session.stage) data.stage = session.stage
	}
	if (session.session_type === "question") {
		data.title = session.title
		data.context = session.context
		data.questions = session.questions
		data.answers = session.answers
		const imagePaths = session.imagePaths ?? []
		data.image_urls = imagePaths.map(
			(_: string, i: number) => `/question-image/${session.session_id}/${i}`,
		)
	}
	if (session.session_type === "design_direction") {
		data.title = "Design Direction"
		data.intent_slug = session.intent_slug
		data.archetypes = session.archetypes
		data.selection = session.selection
	}
	reply.send(data)
}
