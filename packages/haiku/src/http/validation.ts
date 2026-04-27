// http/validation.ts — Body validation + slug / intent / stage checks
// shared across every HTTP handler. Pure functions — no closure capture
// over the Fastify instance.

import { existsSync } from "node:fs"
import { join } from "node:path"
import type { FastifyReply } from "fastify"
import type { ValidationError, ZodIssueWire } from "haiku-api"
import type { ZodTypeAny, z } from "zod"
import { intentDir } from "../state-tools.js"

// ── Body validation ──────────────────────────────────────────────────────

export function validationErrorReply(
	reply: FastifyReply,
	issues: ZodIssueWire[],
	status = 400,
): FastifyReply {
	const payload: ValidationError = { error: "validation_failed", issues }
	return reply.status(status).send(payload)
}

/** Parse `body` against `schema` and either return the parsed data or
 *  send a 400 validation error and return `{ok: false}`. The caller
 *  must bail out without writing anything else to the reply when this
 *  returns `{ok: false}`. */
export function parseBodyWithSchema<S extends ZodTypeAny>(
	reply: FastifyReply,
	body: unknown,
	schema: S,
): { ok: true; data: z.infer<S> } | { ok: false } {
	const result = schema.safeParse(body)
	if (!result.success) {
		const issues: ZodIssueWire[] = result.error.issues.map((iss) => ({
			code: iss.code,
			message: iss.message,
			path: iss.path as (string | number)[],
		}))
		validationErrorReply(reply, issues)
		return { ok: false }
	}
	return { ok: true, data: result.data as z.infer<S> }
}

// ── Slug + intent + stage validation ─────────────────────────────────────

/** Reject slugs containing path separators, traversal sequences, or
 *  null bytes. Decode-percent first so `%2e%2e` etc. don't sneak past. */
export function isValidSlug(value: string): boolean {
	let decoded: string
	try {
		decoded = decodeURIComponent(value)
	} catch {
		return false
	}
	if (decoded.includes("\x00")) return false
	return !/[/\\]|\.\./.test(decoded)
}

/** True when `.haiku/intents/<slug>/intent.md` exists on disk. */
export function validateIntent(slug: string): boolean {
	try {
		const intentRoot = intentDir(slug)
		return existsSync(join(intentRoot, "intent.md"))
	} catch {
		return false
	}
}

/** True when the stage directory exists under the intent. */
export function validateStage(slug: string, stage: string): boolean {
	try {
		const root = intentDir(slug)
		return existsSync(join(root, "stages", stage))
	} catch {
		return false
	}
}
