// http/session-api.ts — GET /api/session/:id response shaper.
//
// Maps the in-memory session record (review / question / design-direction
// shapes) to the wire-format JSON the SPA expects. Mostly pure projection
// from the cached session object, plus a fresh-on-every-request
// `current_state` field that calls getCurrentState(slug) to defeat the
// stale-cache divergence the SPA's stage stepper used to suffer from.

import type { FastifyReply } from "fastify"
import { getCurrentState } from "../current-state.js"
import {
	resolveIntentStages,
	resolveStudioStages,
} from "../orchestrator/studio.js"
import { getSession, type ReviewSession } from "../sessions.js"

interface ApproveAction {
	label: string
	kind:
		| "ad_hoc_done"
		| "open_pr"
		| "submit_external"
		| "start_intent"
		| "start_execution"
		| "complete_stage"
		| "submit_intent_review"
		| "complete_intent"
		| "approve"
}

function titleCase(s: string): string {
	return s
		.split(/[-_]/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
}

/** Decide what the Approve button should say based on what approval will
 *  actually trigger. Server-authoritative — the SPA renders the string and
 *  doesn't reimplement workflow rules. */
function computeApproveAction(session: ReviewSession): ApproveAction {
	if (session.ad_hoc) {
		return { label: "Done", kind: "ad_hoc_done" }
	}

	const gateContext = session.gate_context || "stage_gate"
	const gateType = session.gate_type || "ask"
	const hasExternal = gateType.split(",").some((p) => p.trim() === "external")
	const isCompoundExternal = hasExternal && gateType.includes(",")

	// Resolve the stage label — prefer fresh derivation from disk so a
	// stale cached session can't display the wrong stage name.
	const current = session.intent_slug
		? getCurrentState(session.intent_slug)
		: null
	const stage = current?.stage || session.stage || ""
	const stageTitle = stage ? titleCase(stage) : ""
	const nextStageTitle = session.next_stage ? titleCase(session.next_stage) : ""

	// Intent-completion review (terminal review after every stage gate
	// passed and the studio-level reviewers — if any — have approved).
	if (gateContext === "intent_completion") {
		return { label: "Mark Intent Done", kind: "complete_intent" }
	}

	// Discrete mode / external review — approval routes through a PR/MR
	// rather than locally closing the gate.
	if (hasExternal) {
		if (isCompoundExternal) {
			return {
				label: stageTitle
					? `Submit ${stageTitle} for Review`
					: "Submit for Review",
				kind: "submit_external",
			}
		}
		return {
			label: stageTitle
				? `Open ${stageTitle} Pull Request`
				: "Open Pull Request",
			kind: "open_pr",
		}
	}

	// First-stage elaborate gate — approving kicks off the intent.
	if (gateContext === "intent_review") {
		return {
			label: stageTitle ? `Start ${stageTitle}` : "Start Intent",
			kind: "start_intent",
		}
	}

	// Pre-execution gate (after elaborate, before execute) on a non-first
	// stage — approving begins building.
	if (gateContext === "elaborate_to_execute") {
		return {
			label: stageTitle ? `Start ${stageTitle} Execution` : "Start Execution",
			kind: "start_execution",
		}
	}

	// Default stage gate (post-execution review). When this is the last
	// stage in the studio's stage list, approval routes the intent toward
	// final completion review (or completion outright if disabled).
	const intentFm =
		(session.parsedIntent as { frontmatter?: Record<string, unknown> } | null)
			?.frontmatter || {}
	const studio =
		(current?.studio as string) || (intentFm.studio as string) || ""
	const stages = studio
		? resolveIntentStages(intentFm, studio).length > 0
			? resolveIntentStages(intentFm, studio)
			: resolveStudioStages(studio)
		: []
	const isLastStage =
		!session.next_stage &&
		stages.length > 0 &&
		stages[stages.length - 1] === stage
	if (isLastStage) {
		const completionReviewEnabled = intentFm.intent_completion_review !== false
		if (completionReviewEnabled) {
			return {
				label: "Submit Intent for Final Review",
				kind: "submit_intent_review",
			}
		}
		return { label: "Complete Intent", kind: "complete_intent" }
	}

	if (stageTitle) {
		const label = nextStageTitle
			? `Complete ${stageTitle} Stage → Start ${nextStageTitle}`
			: `Complete ${stageTitle} Stage`
		return { label, kind: "complete_stage" }
	}
	return { label: "Approve", kind: "approve" }
}

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
		if (session.gate_context) data.gate_context = session.gate_context
		if (session.next_stage !== undefined) data.next_stage = session.next_stage
		if (session.next_phase !== undefined) data.next_phase = session.next_phase
		data.approve_action = computeApproveAction(session)
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
