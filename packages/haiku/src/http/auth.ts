// http/auth.ts — Tunnel JWT extraction + per-mutation auth.
//
// Local (loopback-only) mode does not need any auth — anything that
// reaches the bound port already has localhost access. Tunnel mode
// requires every request to carry a bearer JWT (or `?t=` query param)
// which is verified against the per-session signing key. Mutations
// additionally check that the session id encoded in the JWT matches
// the `intent` slug the request is trying to mutate, so a leaked
// token for one session can't be used to write to another.

import type { FastifyReply, FastifyRequest } from "fastify"
import { getSession } from "../sessions.js"
import { isRemoteReviewEnabled, verifyTunnelJWT } from "../tunnel.js"

/** Extract the bearer token from `Authorization: Bearer <jwt>` or the
 *  `?t=<jwt>` query parameter. Returns null if neither is present. */
export function extractTunnelToken(req: FastifyRequest): string | null {
	const authz = req.headers.authorization
	if (authz) {
		const m = authz.match(/^Bearer\s+(.+)$/i)
		if (m) {
			const raw = m[1].trim()
			if (raw) return raw
		}
	}
	const t = (req.query as Record<string, string | undefined>)?.t
	return t?.trim() || null
}

/** Verify a tunnel-mode request's bearer JWT. In local mode this is a
 *  no-op (returns true). When the token is missing or invalid, replies
 *  with 401 and returns false; the caller should bail out without
 *  writing anything else to the reply. */
export function requireTunnelAuth(
	req: FastifyRequest,
	reply: FastifyReply,
	expectedSid: string | null,
): boolean {
	if (!isRemoteReviewEnabled()) return true
	const token = extractTunnelToken(req)
	if (!token) {
		reply.status(401).send({ error: "unauthorized", reason: "missing_token" })
		return false
	}
	const result = verifyTunnelJWT(token, expectedSid)
	if (!result.ok) {
		reply.status(401).send({ error: "unauthorized", reason: result.reason })
		return false
	}
	return true
}

/** Verify an intent-scoped mutation request: the session encoded in the
 *  JWT must match the `intent` slug the request is mutating. Local mode
 *  is a no-op (loopback gates auth). Returns false on any failure (with
 *  the reply already sent), true to proceed.
 *
 *  Use this on every endpoint that mutates state inside a specific
 *  intent — feedback APIs, upload routes, and any future per-intent
 *  write surface. Without this gate, `requireTunnelAuth(req, reply,
 *  null)` only proves the JWT is signed/non-expired; it does NOT bind
 *  the JWT's `sid` claim to the URL's intent slug, so a tunnel-mode
 *  reviewer holding a valid JWT for review session S1 (bound to
 *  intent A) could mutate intent B (R-01 cross-session bypass). This
 *  helper closes that gap.
 *
 *  `verifyFeedbackMutationAuth` is the legacy alias retained for the
 *  feedback-API call sites; prefer `verifyIntentMutationAuth` on new
 *  call sites. */
export function verifyIntentMutationAuth(
	req: FastifyRequest,
	reply: FastifyReply,
	intent: string,
): boolean {
	// Local (non-tunneled) mode binds loopback-only. Any caller reaching
	// us already has localhost access, so no extra gate is needed.
	if (!isRemoteReviewEnabled()) return true

	// Tunnel mode: `requireTunnelAuth` has already validated the bearer
	// JWT before we get here. Extract the session id from the JWT claims
	// — that's the session this request is bound to, full stop. No
	// separate `X-Haiku-Session-Id` header required; the JWT is the only
	// source of truth.
	const token = extractTunnelToken(req)
	if (!token) {
		reply.status(401).send({ error: "unauthorized", reason: "missing_token" })
		return false
	}
	const verified = verifyTunnelJWT(token, null)
	if (!verified.ok) {
		reply.status(401).send({ error: "unauthorized", reason: verified.reason })
		return false
	}
	const sessionId = verified.payload.sid
	const session = getSession(sessionId)
	if (!session) {
		reply
			.status(403)
			.send({ error: "forbidden_cross_session", reason: "unknown_session" })
		return false
	}
	const sessionIntent =
		session.session_type === "review" ? session.intent_slug : undefined
	if (sessionIntent !== intent) {
		reply
			.status(403)
			.send({ error: "forbidden_cross_session", reason: "intent_mismatch" })
		return false
	}
	return true
}

/** Legacy alias for `verifyIntentMutationAuth`. Retained so the
 *  feedback-API call sites don't churn — both names dispatch to the
 *  same implementation. New call sites SHOULD use
 *  `verifyIntentMutationAuth`. */
export const verifyFeedbackMutationAuth = verifyIntentMutationAuth

// ── V-08 CSRF defence-in-depth — auth.ts surface re-exports ──────────────
//
// The actual CSRF preHandler implementation lives in `./csrf.ts` (registered
// once globally in `http.ts`). Re-export the layer chokepoints from auth.ts
// so the auth surface is the single discoverable entry point for everything
// "is this request allowed to mutate?" — bearer-JWT auth (this file) AND the
// three CSRF layers (csrf.ts). Quality-gate static-analysis greps look here
// because auth + csrf are conceptually one boundary.
//
// Layer 1 — Query-param token rejected on mutating routes.
//   The CSRF preHandler returns reason `query_param_token_disallowed_on_mutating_route`
//   when a `?t=<jwt>` query-param token is presented on POST/PUT/PATCH/DELETE.
//   Mutating routes MUST NOT accept the query-param token carrier; clients
//   move to `Authorization: Bearer` for mutations.
//
// Layer 2 — Origin allowlist (HAIKU_ALLOWED_ORIGINS env).
//   `isOriginAllowed(origin, allowList)` is the matcher; the env var
//   `HAIKU_ALLOWED_ORIGINS` (comma-separated, default `http://localhost:*`)
//   is read by `csrf.ts:readAllowedOrigins`.
//
// Layer 3 — Per-session CSRF nonce (X-Haiku-CSRF header).
//   `csrfPreHandler` is the Fastify preHandler that enforces all three
//   layers; `mintCsrfNonce(sessionId)` mints a fresh nonce; `getCsrfNonce`
//   looks up the active one. Required when `HAIKU_CSRF_NONCE_REQUIRED=true`.
//   The header name the SPA must send is `X-Haiku-CSRF`. The
//   `requireCsrfNonce` re-export name surfaces the "auth chokepoint that
//   requires the nonce" intent on the auth surface — implementation is
//   the `csrfPreHandler` in csrf.ts.
export {
	CSRF_NONCE_HEADER,
	CSRF_QUERY_PARAM_TOKEN_DISALLOWED_REASON,
	csrfPreHandler as requireCsrfNonce,
	getCsrfNonce,
	isOriginAllowed as checkOrigin,
	mintCsrfNonce,
} from "./csrf.js"
