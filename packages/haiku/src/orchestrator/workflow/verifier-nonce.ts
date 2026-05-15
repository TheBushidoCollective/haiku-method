// orchestrator/workflow/verifier-nonce.ts — Per-intent verifier nonce
// store. The cursor's wrapper layer (run-tick) mints a nonce when
// emitting a verifier-review action; the matching seal tool consumes
// the nonce before stamping. Without a valid nonce, the seal tool
// returns `verifier_nonce_invalid`.
//
// Storage: `.haiku/intents/<slug>/.verifier-nonces.json` — a runtime
// sidecar keyed by verifier-kind. Persists until consumed by the seal
// tool. Rotates only when the underlying artifact's `recorded_at`
// changes (so re-recording a stage elaboration invalidates a stale
// nonce from before the rewrite — an in-flight verifier dispatched
// against the prior body can't seal the new one).
//
// This isn't a cryptographic gate — the agent can read the minted
// nonce off the action payload it received — but it makes
// self-certification (calling seal without dispatching the verifier)
// surface as a distinguishable, named error (`verifier_nonce_invalid`)
// instead of passing silently. That's the contract the GAPS doc
// records under "verifier nonce" hardening: keep the cost low, give
// the engine a clear signal when the prompt contract is violated.

import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { findHaikuRoot } from "../../state-tools.js"

export type VerifierNonceKey =
	| { kind: "intent_elaborate"; slug: string }
	| { kind: "stage_elaborate"; slug: string; stage: string }
	| { kind: "stage_decompose"; slug: string; stage: string }

type NonceEntry = { nonce: string; tied_to: string | null }
type NonceStore = Record<string, NonceEntry>

function noncePath(slug: string, root?: string): string {
	const r = root ?? findHaikuRoot()
	return join(r, "intents", slug, ".verifier-nonces.json")
}

function keyString(key: VerifierNonceKey): string {
	switch (key.kind) {
		case "intent_elaborate":
			return "intent.elaborate"
		case "stage_elaborate":
			return `stages/${key.stage}/elaborate`
		case "stage_decompose":
			return `stages/${key.stage}/decompose`
	}
}

function readStore(slug: string): NonceStore {
	const p = noncePath(slug)
	if (!existsSync(p)) return {}
	try {
		const raw = readFileSync(p, "utf8")
		const parsed = JSON.parse(raw) as unknown
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {}
		}
		return parsed as NonceStore
	} catch {
		return {}
	}
}

function writeStore(slug: string, store: NonceStore): void {
	const p = noncePath(slug)
	const keys = Object.keys(store)
	if (keys.length === 0) {
		if (existsSync(p)) {
			try {
				unlinkSync(p)
			} catch {
				// Best-effort delete; if the file is gone, that's fine.
			}
		}
		return
	}
	writeFileSync(p, `${JSON.stringify(store, null, 2)}\n`)
}

/**
 * Ensure a nonce exists for this verifier key. If an entry already
 * exists AND its `tied_to` matches the provided value, return the
 * existing nonce (idempotent across ticks while the artifact body
 * hasn't changed). Otherwise mint a fresh nonce and store it.
 *
 * `tiedTo` is typically the source artifact's `recorded_at` stamp.
 * Re-recording overwrites the artifact (changing `recorded_at`),
 * which invalidates the prior nonce — an in-flight verifier
 * dispatched against the old body fails to seal the new body.
 *
 * For pre-intent (intent.md isn't re-recorded wholesale), pass `null`.
 */
export function ensureNonce(
	key: VerifierNonceKey,
	tiedTo: string | null,
): string {
	const store = readStore(key.slug)
	const k = keyString(key)
	const existing = store[k]
	if (existing && existing.tied_to === tiedTo) {
		return existing.nonce
	}
	const nonce = randomBytes(16).toString("hex")
	store[k] = { nonce, tied_to: tiedTo }
	writeStore(key.slug, store)
	return nonce
}

/**
 * Validate and consume a nonce. On success the entry is deleted (the
 * nonce is single-use). On mismatch the store is left untouched so the
 * legitimate verifier dispatch can still seal with the correct value.
 */
export function consumeNonce(
	key: VerifierNonceKey,
	provided: string | undefined,
): { ok: true } | { ok: false; reason: "missing" | "mismatch" } {
	if (!provided || provided.length === 0) {
		return { ok: false, reason: "missing" }
	}
	const store = readStore(key.slug)
	const k = keyString(key)
	const entry = store[k]
	if (!entry) return { ok: false, reason: "missing" }
	if (entry.nonce !== provided) return { ok: false, reason: "mismatch" }
	delete store[k]
	writeStore(key.slug, store)
	return { ok: true }
}

/**
 * Drop an entry without consumption. Used by callers that need to
 * invalidate a pending nonce (e.g., `haiku_stage_elaboration_record`
 * overwriting the artifact — the next tick will mint a fresh nonce
 * tied to the new `recorded_at`).
 */
export function clearNonce(key: VerifierNonceKey): void {
	const store = readStore(key.slug)
	const k = keyString(key)
	if (store[k]) {
		delete store[k]
		writeStore(key.slug, store)
	}
}

/**
 * Test-only: clear the entire store for an intent.
 */
export function __clearAllNoncesForTest(slug: string): void {
	const p = noncePath(slug)
	if (existsSync(p)) {
		try {
			unlinkSync(p)
		} catch {
			// Best-effort.
		}
	}
}
