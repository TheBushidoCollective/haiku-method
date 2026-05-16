// http/debug-routes.ts — /haiku:debug SPA admin layer.
//
// Pairs with the `haiku_debug` MCP tool (see
// `tools/orchestrator/haiku_debug.ts`). The MCP tool exists for agent-driven
// admin ops with picker confirmation; this surface exists for user-driven
// admin ops where the SPA itself is the elicitation gate. The user clicks
// the action button, the SPA shows a confirmation modal showing the exact
// mutation, and only on confirm does the POST fire and the op run.
//
// Auth model: read endpoints are mounted bare (loopback gates them in
// local mode; tunnel mode requires the JWT). Write endpoints additionally
// require tunnel auth so a tunneled deployment can't be hit anonymously.
// This mirrors the rest of the SPA's mutation surface.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { FastifyInstance } from "fastify"
import { HAIKU_UI_HTML } from "../haiku-ui-html.js"
import {
	forceStageComplete,
	mutateFeedback,
	previewCursor,
	resetDrift,
	setIntentField,
	setUnitIterations,
} from "../orchestrator/workflow/debug-ops.js"
import { findHaikuRoot, intentDir, parseFrontmatter } from "../state-tools.js"
import { requireTunnelAuth, verifyIntentMutationAuth } from "./auth.js"
import { isValidSlug } from "./validation.js"

interface IntentSummary {
	slug: string
	title: string | null
	studio: string | null
	mode: string | null
	status: string | null
	archived: boolean
	created_at: string | null
}

function listIntentSummaries(): IntentSummary[] {
	const intentsDir = join(findHaikuRoot(), "intents")
	if (!existsSync(intentsDir)) return []
	const out: IntentSummary[] = []
	for (const entry of readdirSync(intentsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue
		const intentMd = join(intentsDir, entry.name, "intent.md")
		if (!existsSync(intentMd)) continue
		try {
			const fm = parseFrontmatter(readFileSync(intentMd, "utf8")).data
			out.push({
				slug: entry.name,
				title: typeof fm.title === "string" ? fm.title : null,
				studio: typeof fm.studio === "string" ? fm.studio : null,
				mode: typeof fm.mode === "string" ? fm.mode : null,
				status: typeof fm.status === "string" ? fm.status : null,
				archived: fm.archived === true,
				created_at: typeof fm.created_at === "string" ? fm.created_at : null,
			})
		} catch {
			out.push({
				slug: entry.name,
				title: null,
				studio: null,
				mode: null,
				status: null,
				archived: false,
				created_at: null,
			})
		}
	}
	return out.sort((a, b) => a.slug.localeCompare(b.slug))
}

function readIntentDetail(slug: string):
	| {
			ok: true
			intent: IntentSummary & {
				frontmatter: Record<string, unknown>
				stages_present: string[]
			}
	  }
	| { ok: false; error: string } {
	if (!isValidSlug(slug)) return { ok: false, error: "invalid_slug" }
	const dir = intentDir(slug)
	const intentMd = join(dir, "intent.md")
	if (!existsSync(intentMd)) return { ok: false, error: "intent_not_found" }
	const fm = parseFrontmatter(readFileSync(intentMd, "utf8")).data
	const stagesDir = join(dir, "stages")
	const stagesPresent = existsSync(stagesDir)
		? readdirSync(stagesDir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
				.sort()
		: []
	return {
		ok: true,
		intent: {
			slug,
			title: typeof fm.title === "string" ? fm.title : null,
			studio: typeof fm.studio === "string" ? fm.studio : null,
			mode: typeof fm.mode === "string" ? fm.mode : null,
			status: typeof fm.status === "string" ? fm.status : null,
			archived: fm.archived === true,
			created_at: typeof fm.created_at === "string" ? fm.created_at : null,
			frontmatter: fm as Record<string, unknown>,
			stages_present: stagesPresent,
		},
	}
}

const SUPPORTED_OPS = new Set([
	"force_stage_complete",
	"set_intent_field",
	"reset_drift",
	"mutate_feedback",
	"set_unit_iterations",
])

export function registerDebugRoutes(instance: FastifyInstance): void {
	// SPA shells — serve the bundled HAIKU_UI_HTML so TanStack Router can
	// render the /debug index + per-intent admin panel. No auth: the HTML
	// shell is harmless; the data endpoints below gate the actual reads
	// and writes.
	instance.get("/debug", async (_req, reply) => {
		reply.type("text/html; charset=utf-8").send(HAIKU_UI_HTML)
	})
	instance.get<{ Params: { slug: string } }>(
		"/debug/:slug",
		async (_req, reply) => {
			reply.type("text/html; charset=utf-8").send(HAIKU_UI_HTML)
		},
	)

	// ── Read endpoints ────────────────────────────────────────────────
	instance.get("/api/debug/intents", async (req, reply) => {
		if (!requireTunnelAuth(req, reply, null)) return
		reply.send({ intents: listIntentSummaries() })
	})

	instance.get<{ Params: { intent: string } }>(
		"/api/debug/intents/:intent",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, null)) return
			const detail = readIntentDetail(req.params.intent)
			if (!detail.ok) {
				reply
					.status(detail.error === "intent_not_found" ? 404 : 400)
					.send({ error: detail.error })
				return
			}
			reply.send(detail.intent)
		},
	)

	instance.get<{ Params: { intent: string } }>(
		"/api/debug/intents/:intent/cursor",
		async (req, reply) => {
			if (!requireTunnelAuth(req, reply, null)) return
			const slug = req.params.intent
			if (!isValidSlug(slug)) {
				reply.status(400).send({ error: "invalid_slug" })
				return
			}
			// `derivePosition()` may throw on a truly corrupted intent —
			// exactly what callers reach for the debug surface to diagnose.
			// Catch + return a structured 500 so the SPA renders an error
			// message instead of a Fastify-default crash response.
			try {
				const r = previewCursor({ slug })
				if (!("ok" in r) || !r.ok) {
					reply.status(404).send(r)
					return
				}
				reply.send(r)
			} catch (err) {
				reply.status(500).send({
					ok: false,
					error: "preview_cursor_threw",
					detail: err instanceof Error ? err.message : String(err),
				})
			}
		},
	)

	// ── Write endpoint (one POST per op, dispatched by `op` path param) ──
	//
	// The SPA's confirmation modal IS the elicitation gate — the user has
	// already seen the exact mutation and clicked through before this route
	// fires. There is no MCP picker on this path (that's the agent-driven
	// path via `haiku_debug`). Both surfaces ultimately call the same
	// debug-ops functions; the only difference is who confirmed.
	instance.post<{
		Params: { intent: string; op: string }
		Body: Record<string, unknown>
	}>("/api/debug/intents/:intent/ops/:op", async (req, reply) => {
		const slug = req.params.intent
		const op = req.params.op
		if (!isValidSlug(slug)) {
			reply.status(400).send({ error: "invalid_slug" })
			return
		}
		// `verifyIntentMutationAuth` (not bare `requireTunnelAuth`) — binds
		// the JWT's `sid` claim to the URL's intent slug. Without this, a
		// reviewer with a valid JWT for session S1 (intent A) could POST
		// to /api/debug/intents/B/ops/<anything> and corrupt intent B
		// (R-01 cross-session bypass — see auth.ts:62–68).
		if (!verifyIntentMutationAuth(req, reply, slug)) return
		if (!SUPPORTED_OPS.has(op)) {
			reply.status(400).send({
				error: "unsupported_op",
				message: `op must be one of: ${[...SUPPORTED_OPS].join(", ")}`,
			})
			return
		}
		const body = (req.body ?? {}) as Record<string, unknown>
		try {
			let result: unknown
			switch (op) {
				case "force_stage_complete": {
					const stage = typeof body.stage === "string" ? body.stage : ""
					if (!stage) {
						reply.status(400).send({ error: "missing_stage" })
						return
					}
					if (!isValidSlug(stage)) {
						reply.status(400).send({ error: "invalid_stage" })
						return
					}
					result = forceStageComplete({
						slug,
						targetStage: stage,
						closeOpenFeedback: body.close_open_feedback === true,
					})
					break
				}
				case "set_intent_field": {
					// Batch form — `fields` object applies multiple keys in
					// one call (one SPA confirm covers the whole set).
					if (body.fields && typeof body.fields === "object") {
						const fields = body.fields as Record<string, unknown>
						const results: Array<{ field: string; result: unknown }> = []
						for (const [k, v] of Object.entries(fields)) {
							results.push({
								field: k,
								result: setIntentField({ slug, field: k, value: v }),
							})
						}
						result = { batch: true, count: results.length, results }
						break
					}
					const field = typeof body.field === "string" ? body.field : ""
					if (!field) {
						reply.status(400).send({ error: "missing_field" })
						return
					}
					result = setIntentField({ slug, field, value: body.value })
					break
				}
				case "reset_drift": {
					result = resetDrift({ slug })
					break
				}
				case "set_unit_iterations": {
					const stage = typeof body.stage === "string" ? body.stage : ""
					const unit = typeof body.unit === "string" ? body.unit : ""
					if (!stage || !unit) {
						reply.status(400).send({ error: "missing_stage_or_unit" })
						return
					}
					if (!isValidSlug(stage)) {
						reply.status(400).send({ error: "invalid_stage" })
						return
					}
					if (!isValidSlug(unit)) {
						reply.status(400).send({ error: "invalid_unit" })
						return
					}
					const iterations = Array.isArray(body.iterations)
						? (body.iterations as Array<{
								hat: string
								result: "advance" | "reject"
								at?: string
							}>)
						: undefined
					result = setUnitIterations({ slug, stage, unit, iterations })
					break
				}
				case "mutate_feedback": {
					const stage =
						typeof body.stage === "string" && body.stage ? body.stage : null
					if (stage && !isValidSlug(stage)) {
						reply.status(400).send({ error: "invalid_stage" })
						return
					}
					const patch =
						body.patch && typeof body.patch === "object"
							? (body.patch as Record<string, unknown>)
							: {}
					// Batch form — apply same patch to every FB in feedback_ids.
					if (
						Array.isArray(body.feedback_ids) &&
						body.feedback_ids.length > 0
					) {
						const ids = body.feedback_ids as unknown[]
						const results: Array<{ feedback_id: string; result: unknown }> = []
						for (const fid of ids) {
							if (typeof fid !== "string" || !fid) {
								reply.status(400).send({
									error: "invalid_feedback_id",
									message: "feedback_ids entries must be non-empty strings",
								})
								return
							}
							results.push({
								feedback_id: fid,
								result: mutateFeedback({ slug, stage, feedbackId: fid, patch }),
							})
						}
						result = { batch: true, count: results.length, results }
						break
					}
					const feedbackId =
						typeof body.feedback_id === "string" ? body.feedback_id : ""
					if (!feedbackId) {
						reply.status(400).send({ error: "missing_feedback_id" })
						return
					}
					result = mutateFeedback({ slug, stage, feedbackId, patch })
					break
				}
				default:
					reply.status(400).send({ error: "unhandled_op" })
					return
			}
			reply.send({ op, intent: slug, result })
		} catch (err) {
			reply.status(500).send({
				error: "debug_op_threw",
				op,
				detail: err instanceof Error ? err.message : String(err),
			})
		}
	})
}
