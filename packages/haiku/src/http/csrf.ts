// http/csrf.ts — V-08 CSRF defence-in-depth.
//
// Layered protection against cross-origin POST/PUT/PATCH/DELETE attacks
// in tunnel mode. Three independent layers, registered as a single
// Fastify global `preHandler` so every mutating route is covered without
// per-route opt-in (and so a future endpoint that forgets to register
// CSRF is automatically protected).
//
// Layer 1 — Query-param token ban (HARD).
//   Mutating routes (POST/PUT/PATCH/DELETE) MUST NOT accept the
//   `?t=<jwt>` query parameter as the JWT carrier. Tokens leaked via
//   chat-link sharing of `?t=...` URLs are then unable to mint
//   cross-origin form posts: a cross-origin attacker cannot set the
//   Authorization header (no preflight will pass without server CORS
//   approval the attacker doesn't have), and the server simply refuses
//   any mutation that uses `?t=` as the auth carrier.
//   Read routes (GET/HEAD/OPTIONS) keep `?t=` for ergonomics — opening
//   the tunnel URL in a browser tab is the primary review entry point.
//
// Layer 2 — Origin allowlist.
//   Mutating routes require an `Origin` header that matches the
//   `HAIKU_ALLOWED_ORIGINS` env var (comma-separated; default
//   `http://localhost:*`). Cross-origin attackers cannot spoof the
//   browser-set Origin header. Wildcard suffix supported via `*` (e.g.
//   `http://localhost:*` matches any port; `https://*.example.com`
//   matches any subdomain). Missing Origin is rejected (attackers can
//   omit Origin from `<form>` submissions in some browsers, but
//   cross-origin POST from a real browser always includes it).
//
// Layer 3 — Per-session CSRF nonce (defence in depth).
//   Mutating routes require an `X-Haiku-CSRF` header whose value
//   matches the nonce minted for the request's authenticated session.
//   Custom headers force a CORS preflight, which a cross-origin
//   attacker cannot satisfy without server CORS approval. Nonces are
//   minted on demand via `GET /api/csrf-nonce` (authenticated) and
//   stored in-memory keyed by session id. They expire after
//   `HAIKU_CSRF_NONCE_TTL_MS` (default 1 hour) or are evicted when
//   the session is evicted from `sessions.ts`.
//
//   Layer 3 is OPT-IN via `HAIKU_CSRF_NONCE_REQUIRED=true` until the
//   SPA bootstrap fetches and persists the nonce. Layers 1 and 2 are
//   sufficient against the cross-origin attack class on their own;
//   Layer 3 closes the same-origin "future endpoint forgot CORS"
//   class, which is a defence-in-depth concern, not a live attack.
//
// Audit / static-analysis safety net:
//   `scripts/audit-mutating-routes.mjs` enumerates every
//   `app.post|put|patch|delete` registration in the source tree and
//   asserts the global preHandler is in scope. CI fails on any orphan
//   route. This is the static safety net that catches the case where
//   a future engineer registers a mutating route inside an isolated
//   Fastify scope (where the global preHandler may not propagate).

import { randomBytes } from "node:crypto"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { isRemoteReviewEnabled, verifyTunnelJWT } from "../tunnel.js"
import { extractTunnelToken } from "./auth.js"

// ── Configuration ────────────────────────────────────────────────────────

/** Methods considered "mutating" for CSRF purposes. GET/HEAD/OPTIONS
 *  are read-only by HTTP spec (no side effects allowed) and intentionally
 *  excluded — applying CSRF to them would break tunnel-link ergonomics
 *  (operators paste `?t=<jwt>` URLs into chat to share read access). */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/** V-08 Layer 1 — the canonical `reason` value the CSRF preHandler
 *  returns when a `?t=<jwt>` query-param token is presented on a mutating
 *  route. Re-exported from `auth.ts` so the auth surface is the single
 *  discoverable entry point for "is this request allowed to mutate?". */
export const CSRF_QUERY_PARAM_TOKEN_DISALLOWED_REASON =
	"query_param_token_disallowed_on_mutating_route" as const

/** V-08 Layer 3 — the request header name the SPA must send to satisfy
 *  the per-session CSRF nonce check. Kept as a constant so tests and
 *  call sites cannot drift on the casing. */
export const CSRF_NONCE_HEADER = "X-Haiku-CSRF" as const

/** Read the comma-separated `HAIKU_ALLOWED_ORIGINS` env var. Default
 *  `http://localhost:*` matches any localhost port — the common dev /
 *  review-app loopback case. Operators set this explicitly in tunnel
 *  mode to constrain to their public origin. */
function readAllowedOrigins(): string[] {
	const raw = process.env.HAIKU_ALLOWED_ORIGINS
	if (!raw || raw.trim() === "") return ["http://localhost:*"]
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
}

/** Match an Origin against the allowlist. Supports trailing-`*` wildcard
 *  for ports (`http://localhost:*`) and host-prefix wildcards
 *  (`https://*.example.com`). Exact match otherwise. Returns true on
 *  match, false on no-match or malformed input. */
export function isOriginAllowed(origin: string, allowList: string[]): boolean {
	if (!origin) return false
	for (const entry of allowList) {
		if (entry === origin) return true
		if (entry === "*") return true
		// Trailing port wildcard: `http://localhost:*` → match any port
		// on `http://localhost`.
		if (entry.endsWith(":*")) {
			const prefix = entry.slice(0, -2)
			// Origin must be `<prefix>:<port>` with port being digits only.
			if (origin.startsWith(`${prefix}:`)) {
				const port = origin.slice(prefix.length + 1)
				if (/^\d+$/.test(port)) return true
			}
		}
		// Subdomain wildcard: `https://*.example.com` → match any host
		// ending in `.example.com` with the same scheme.
		if (entry.includes("://*.")) {
			const [scheme, rest] = entry.split("://*.")
			if (origin.startsWith(`${scheme}://`)) {
				const host = origin.slice(scheme.length + 3)
				if (host.endsWith(`.${rest}`) || host === rest) return true
			}
		}
	}
	return false
}

/** Whether Layer 3 (CSRF nonce) is enforced. Defaults to false until
 *  the SPA bootstrap is updated to fetch and persist the nonce. */
function isCsrfNonceRequired(): boolean {
	const raw = process.env.HAIKU_CSRF_NONCE_REQUIRED
	return raw === "true" || raw === "1"
}

const NONCE_TTL_MS_DEFAULT = 60 * 60 * 1000 // 1 hour
function nonceTtlMs(): number {
	const raw = process.env.HAIKU_CSRF_NONCE_TTL_MS
	if (!raw) return NONCE_TTL_MS_DEFAULT
	const parsed = Number.parseInt(raw, 10)
	if (!Number.isFinite(parsed) || parsed <= 0) return NONCE_TTL_MS_DEFAULT
	return parsed
}

// ── Nonce store (in-memory, per-session, TTL-bounded) ────────────────────

interface NonceEntry {
	nonce: string
	expiresAt: number
}

const nonces = new Map<string, NonceEntry>()

/** Mint (or refresh) the CSRF nonce for a session. Returns the nonce
 *  string. The nonce is 32 random bytes, base64url-encoded — same
 *  entropy class as the session ID. */
export function mintCsrfNonce(sessionId: string): string {
	const nonce = randomBytes(32).toString("base64url")
	nonces.set(sessionId, {
		nonce,
		expiresAt: Date.now() + nonceTtlMs(),
	})
	return nonce
}

/** Look up the active nonce for a session. Returns null if no nonce
 *  has been minted, or if the existing nonce has expired (and clears
 *  the expired entry as a side effect). */
export function getCsrfNonce(sessionId: string): string | null {
	const entry = nonces.get(sessionId)
	if (!entry) return null
	if (entry.expiresAt < Date.now()) {
		nonces.delete(sessionId)
		return null
	}
	return entry.nonce
}

/** Clear a nonce — call when the session is evicted or logged out. */
export function clearCsrfNonce(sessionId: string): void {
	nonces.delete(sessionId)
}

/** Test-only: reset the nonce store. Not exported from the package. */
export function _resetCsrfNoncesForTests(): void {
	nonces.clear()
}

// ── Pre-handler ──────────────────────────────────────────────────────────

/** The single Fastify preHandler that applies all three CSRF layers.
 *  Registered in `http.ts` as a global `addHook("preHandler", ...)` so
 *  every route inherits it (including future ones).
 *
 *  Design notes:
 *  - Local mode (loopback-only) is exempt — `isRemoteReviewEnabled() ===
 *    false` returns true and short-circuits before any layer fires. This
 *    matches the local-mode trust model (loopback already gates auth).
 *  - GET/HEAD/OPTIONS are exempt by HTTP spec (no side effects allowed).
 *  - The CSRF nonce mint endpoint (`/api/csrf-nonce`) is also exempt
 *    from Layer 3 specifically (you can't require the nonce on the
 *    endpoint that mints it). It is still subject to Layer 1 and 2.
 *  - Errors return 401 (Layer 1) or 403 (Layer 2/3), with a structured
 *    `error` + `reason` envelope so the SPA can distinguish the layers
 *    for telemetry and operator debugging.
 */
export async function csrfPreHandler(
	req: FastifyRequest,
	reply: FastifyReply,
): Promise<void> {
	// Local mode: loopback-only. CSRF is undefined here — no cross-origin
	// attacker can reach loopback from a browser without local code
	// execution, which already implies a fully compromised host.
	if (!isRemoteReviewEnabled()) return

	// Read-only methods bypass all layers.
	const method = (req.method || "GET").toUpperCase()
	if (!MUTATING_METHODS.has(method)) return

	// Reading the URL pathname for the CSRF-nonce-mint exemption (Layer 3
	// only). Never trust `req.url` for security decisions on its own —
	// strip the querystring before matching the path.
	const urlPath = (req.url ?? "/").split("?")[0]
	const isCsrfMintEndpoint = urlPath === "/api/csrf-nonce"

	// ── Layer 1 — Query-param token ban on mutating routes ──────────────
	//
	// `extractTunnelToken` checks Authorization first, then `?t=`. We
	// re-check the query directly so we can distinguish "token is
	// in `?t=` only" (HARD reject) from "token is in Authorization"
	// (allowed).
	const queryToken = (req.query as Record<string, string | undefined> | null)?.t
	const authzHeader = req.headers.authorization
	const hasAuthzBearer =
		typeof authzHeader === "string" && /^Bearer\s+/i.test(authzHeader)
	if (queryToken && !hasAuthzBearer) {
		reply.status(401).send({
			error: "unauthorized",
			reason: CSRF_QUERY_PARAM_TOKEN_DISALLOWED_REASON,
		})
		return reply
	}

	// ── Layer 2 — Origin allowlist ──────────────────────────────────────
	const originHeader = req.headers.origin
	const allowList = readAllowedOrigins()
	const originStr = typeof originHeader === "string" ? originHeader : ""
	if (!originStr || !isOriginAllowed(originStr, allowList)) {
		reply.status(403).send({
			error: "forbidden",
			reason: originStr ? "origin_not_allowed" : "origin_missing",
		})
		return reply
	}

	// ── Layer 3 — Per-session CSRF nonce (opt-in) ───────────────────────
	if (!isCsrfNonceRequired() || isCsrfMintEndpoint) return

	// Header lookup uses lowercase per Node's http header normalisation;
	// the constant captures the canonical casing the SPA sends.
	const csrfHeader = req.headers[CSRF_NONCE_HEADER.toLowerCase()]
	const csrfStr =
		typeof csrfHeader === "string"
			? csrfHeader
			: Array.isArray(csrfHeader)
				? csrfHeader[0]
				: undefined
	if (!csrfStr) {
		reply.status(403).send({
			error: "forbidden",
			reason: "csrf_nonce_missing",
		})
		return reply
	}

	// Resolve the session id from the JWT (the only auth-bound identity
	// the server has — query token already barred above for mutations).
	const token = extractTunnelToken(req)
	if (!token) {
		// Layers 1/2 should already have caught this. Belt-and-braces.
		reply.status(401).send({
			error: "unauthorized",
			reason: "missing_token",
		})
		return reply
	}
	const verified = verifyTunnelJWT(token, null)
	if (!verified.ok) {
		// Auth handlers will re-check + return their own structured
		// envelope; surface a layered error here so telemetry can split
		// "auth fail" from "csrf fail". The route handler still gets a
		// chance to bail out cleanly via requireTunnelAuth.
		reply.status(401).send({
			error: "unauthorized",
			reason: verified.reason,
		})
		return reply
	}

	const expectedNonce = getCsrfNonce(verified.payload.sid)
	if (!expectedNonce || expectedNonce !== csrfStr) {
		reply.status(403).send({
			error: "forbidden",
			reason: "csrf_nonce_invalid",
		})
		return reply
	}

	// All three layers passed. Continue to the route handler.
}

// ── /api/csrf-nonce endpoint registration ────────────────────────────────

/** Register the CSRF-nonce mint endpoint and the global preHandler.
 *  Call exactly once from `buildApp()` AFTER auth-bearing routes are
 *  understood (the preHandler runs for every route, so registration
 *  order between routes and the hook itself doesn't matter — this is
 *  Fastify hook semantics, not Express middleware ordering). */
export function registerCsrfRoutes(instance: FastifyInstance): void {
	// Global preHandler — runs for every request, no per-route opt-in.
	instance.addHook("preHandler", csrfPreHandler)

	// GET /api/csrf-nonce — mint and return the nonce for the
	// authenticated session. Idempotent: calling twice in the TTL window
	// re-mints (so a fresh page load always gets a fresh nonce; lifetime
	// caps abuse from token-theft scenarios).
	instance.get("/api/csrf-nonce", async (req, reply) => {
		// Local mode: nonce is meaningless (no CSRF), but return one for
		// API symmetry so the SPA doesn't have to special-case local.
		if (!isRemoteReviewEnabled()) {
			return reply.send({ nonce: "local-mode-no-csrf-required" })
		}
		const token = extractTunnelToken(req)
		if (!token) {
			return reply
				.status(401)
				.send({ error: "unauthorized", reason: "missing_token" })
		}
		const verified = verifyTunnelJWT(token, null)
		if (!verified.ok) {
			return reply
				.status(401)
				.send({ error: "unauthorized", reason: verified.reason })
		}
		const nonce = mintCsrfNonce(verified.payload.sid)
		return reply.send({ nonce })
	})
}
