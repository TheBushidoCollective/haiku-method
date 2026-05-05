// http/assessments-routes.ts — Drift-assessment HTTP read endpoints.
//
// Routes:
//   GET /api/intents/:intent/assessments
//       Query: limit (int, default 50, max 200), since (RFC 3339),
//              stage (string), outcome (string)
//       → reads stages/*/drift-assessments/DA-*.json across all stages
//         of the intent, applies filters, sorts by created_at descending.
//       → { ok, assessments, total, has_more }
//
//   GET /api/intents/:intent/assessments/:assessmentId
//       → { ok, assessment }  for DA-NN.json
//       → 404 assessment_not_found when the file is missing or the ID
//         format is invalid.
//
// DATA-CONTRACTS.md §5.3 / §5.4.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { FastifyInstance } from "fastify"
import { intentDir } from "../state-tools.js"
import { requireTunnelAuth } from "./auth.js"
import { isValidSlug, validateIntent } from "./validation.js"

// ── Types ──────────────────────────────────────────────────────────────────

// Loose Assessment shape — we pass through whatever is in DA-*.json.
type Assessment = Record<string, unknown>

// ── V-09 list-endpoint rationale truncation ───────────────────────────────
//
// VULN-REPORT V-09 (companion to the schema-validation cap in
// haiku_classify_drift): the list endpoint paginates DA-NN.json records
// back to the SPA. With a 10 KB top-level rationale and a 1 KB per-finding
// excerpt, a 200-row page can carry ~2 MB of rationale text — comfortably
// past what the SPA list view needs. We truncate both fields to a 256-char
// preview here; the per-id detail endpoint (`GET /assessments/:id`) still
// returns the full record so the reviewer never loses information.
//
// `TRUNCATE_RATIONALE_PREVIEW_CHARS` is the visible-character budget;
// truncated values are postfixed with `…` so the SPA can show an
// unambiguous truncation marker.
const TRUNCATE_RATIONALE_PREVIEW_CHARS = 256

/** Truncate a string to `TRUNCATE_RATIONALE_PREVIEW_CHARS` plus a `…` marker.
 *  Counts code points — not bytes — because the SPA renders by character. */
function truncateRationale(value: unknown): unknown {
	if (typeof value !== "string") return value
	if (value.length <= TRUNCATE_RATIONALE_PREVIEW_CHARS) return value
	return `${value.slice(0, TRUNCATE_RATIONALE_PREVIEW_CHARS)}…`
}

/**
 * Return a SHALLOW copy of an Assessment with `agent_rationale` and every
 * classification's `rationale_excerpt` truncated to a list-view-safe
 * preview length. The original record on disk is NOT modified — the
 * detail endpoint reads it again for full text.
 */
function truncateRationaleForListView(assessment: Assessment): Assessment {
	const out: Assessment = { ...assessment }
	out.agent_rationale = truncateRationale(assessment.agent_rationale)
	const classifications = assessment.classifications
	if (Array.isArray(classifications)) {
		out.classifications = classifications.map((c) => {
			if (c === null || typeof c !== "object") return c
			return {
				...(c as Record<string, unknown>),
				rationale_excerpt: truncateRationale(
					(c as Record<string, unknown>).rationale_excerpt,
				),
			}
		})
	}
	return out
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Validate assessment ID format: DA-NN (one or more digits). */
function isValidAssessmentId(id: string): boolean {
	return /^DA-\d+$/.test(id)
}

/** Read one DA-*.json file from disk. Returns null on any parse/read error. */
function readAssessmentFile(absPath: string): Assessment | null {
	try {
		const raw = readFileSync(absPath, "utf-8")
		return JSON.parse(raw) as Assessment
	} catch {
		return null
	}
}

/**
 * Enumerate all DA-*.json files for an intent across all stages.
 * Returns { absPath, stage, id } tuples sorted by created_at descending.
 */
function listAllAssessments(intentSlug: string): Array<{
	absPath: string
	stage: string
	id: string
	createdAt: string
}> {
	const iDir = intentDir(intentSlug)
	const stagesDir = join(iDir, "stages")
	if (!existsSync(stagesDir)) return []

	const results: Array<{
		absPath: string
		stage: string
		id: string
		createdAt: string
	}> = []

	let stageDirs: string[]
	try {
		stageDirs = readdirSync(stagesDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
	} catch {
		return []
	}

	for (const stage of stageDirs) {
		const assessmentsDir = join(stagesDir, stage, "drift-assessments")
		if (!existsSync(assessmentsDir)) continue

		let files: string[]
		try {
			files = readdirSync(assessmentsDir).filter((f) =>
				/^DA-\d+\.json$/.test(f),
			)
		} catch {
			continue
		}

		for (const file of files) {
			const id = file.replace(/\.json$/, "")
			const absPath = join(assessmentsDir, file)
			const assessment = readAssessmentFile(absPath)
			const createdAt =
				typeof assessment?.created_at === "string"
					? assessment.created_at
					: "1970-01-01T00:00:00Z"
			results.push({ absPath, stage, id, createdAt })
		}
	}

	// Sort newest-first.
	results.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	)
	return results
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerAssessmentsRoutes(instance: FastifyInstance): void {
	// ── GET /api/intents/:intent/assessments ─────────────────────────────

	instance.get<{
		Params: { intent: string }
		Querystring: Record<string, string | undefined>
	}>("/api/intents/:intent/assessments", async (req, reply) => {
		if (!requireTunnelAuth(req, reply, null)) return

		const { intent } = req.params
		if (!isValidSlug(intent)) {
			reply.status(400).send({ error: "bad_param", code: "bad_param" })
			return
		}

		if (!validateIntent(intent)) {
			reply
				.status(404)
				.send({ error: "intent_not_found", code: "intent_not_found" })
			return
		}

		const query = req.query as Record<string, string | undefined>

		// Parse limit (default 50, max 200).
		let limit = 50
		if (query.limit !== undefined) {
			const parsed = Number.parseInt(query.limit, 10)
			if (!Number.isFinite(parsed) || parsed < 1) {
				reply.status(400).send({
					error: "bad_param",
					code: "bad_param",
					message: "limit must be a positive integer",
				})
				return
			}
			limit = Math.min(parsed, 200)
		}

		// Parse since (RFC 3339 / ISO-8601).
		let sinceMs: number | null = null
		if (query.since !== undefined) {
			const ts = Date.parse(query.since)
			if (Number.isNaN(ts)) {
				reply.status(400).send({
					error: "bad_param",
					code: "bad_param",
					message: "since must be a valid RFC 3339 timestamp",
				})
				return
			}
			sinceMs = ts
		}

		const stageFilter = query.stage ?? null
		const outcomeFilter = query.outcome ?? null

		// Enumerate all assessment records newest-first.
		const all = listAllAssessments(intent)

		// Apply filters.
		const filtered = all.filter((entry) => {
			// since filter.
			if (sinceMs !== null) {
				const entryMs = new Date(entry.createdAt).getTime()
				if (entryMs <= sinceMs) return false
			}
			// Stage filter — check findings[*].stage.
			if (stageFilter !== null) {
				const assessment = readAssessmentFile(entry.absPath)
				if (!assessment) return false
				const findings = assessment.findings as
					| Array<Record<string, unknown>>
					| undefined
				if (!Array.isArray(findings)) return false
				if (!findings.some((f) => f.stage === stageFilter)) return false
			}
			// Outcome filter — check classifications[*].outcome.
			if (outcomeFilter !== null) {
				const assessment = readAssessmentFile(entry.absPath)
				if (!assessment) return false
				const classifications = assessment.classifications as
					| Array<Record<string, unknown>>
					| undefined
				if (!Array.isArray(classifications)) return false
				if (!classifications.some((c) => c.outcome === outcomeFilter))
					return false
			}
			return true
		})

		const total = filtered.length
		const has_more = total > limit
		const page = filtered.slice(0, limit)

		// V-09: truncate `agent_rationale` and per-classification
		// `rationale_excerpt` to a list-view-safe preview. The detail
		// endpoint below returns the full text untouched.
		const assessments: Assessment[] = []
		for (const entry of page) {
			const a = readAssessmentFile(entry.absPath)
			if (a !== null) assessments.push(truncateRationaleForListView(a))
		}

		reply.send({ ok: true, assessments, total, has_more })
	})

	// ── GET /api/intents/:intent/assessments/:assessmentId ──────────────

	instance.get<{
		Params: { intent: string; assessmentId: string }
	}>("/api/intents/:intent/assessments/:assessmentId", async (req, reply) => {
		if (!requireTunnelAuth(req, reply, null)) return

		const { intent, assessmentId } = req.params
		if (!isValidSlug(intent)) {
			reply.status(400).send({ error: "bad_param", code: "bad_param" })
			return
		}

		if (!validateIntent(intent)) {
			reply
				.status(404)
				.send({ error: "intent_not_found", code: "intent_not_found" })
			return
		}

		// Validate assessment ID format.
		if (!isValidAssessmentId(assessmentId)) {
			reply
				.status(404)
				.send({ error: "assessment_not_found", code: "assessment_not_found" })
			return
		}

		// Search for the file across all stages.
		const iDir = intentDir(intent)
		const stagesDir = join(iDir, "stages")
		if (!existsSync(stagesDir)) {
			reply
				.status(404)
				.send({ error: "assessment_not_found", code: "assessment_not_found" })
			return
		}

		let stageDirs: string[]
		try {
			stageDirs = readdirSync(stagesDir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
		} catch {
			reply
				.status(404)
				.send({ error: "assessment_not_found", code: "assessment_not_found" })
			return
		}

		for (const stage of stageDirs) {
			const absPath = join(
				stagesDir,
				stage,
				"drift-assessments",
				`${assessmentId}.json`,
			)
			if (existsSync(absPath)) {
				const assessment = readAssessmentFile(absPath)
				if (assessment === null) {
					// File exists but cannot be parsed.
					reply.status(404).send({
						error: "assessment_not_found",
						code: "assessment_not_found",
					})
					return
				}
				reply.send({ ok: true, assessment })
				return
			}
		}

		reply
			.status(404)
			.send({ error: "assessment_not_found", code: "assessment_not_found" })
	})
}
