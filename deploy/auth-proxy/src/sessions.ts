/**
 * Firestore-backed CLI device-flow session store.
 *
 * A session walks: pending (created by /cli/start) → ready (token captured via
 * the callback / /cli/complete) → consumed (released once by /cli/poll).
 * Sessions self-expire: every record carries `expires_at` (epoch seconds); reads
 * opportunistically delete anything past it. A Firestore TTL policy on
 * `expires_at` (provisioned in terraform) is the backstop sweep.
 *
 * Lookups happen by two keys:
 *   - session id  (what /cli/poll holds; the Firestore doc id)
 *   - state       (what the OAuth round-trip carries back to /cli/complete;
 *                  an indexed field queried on completion)
 */

import type { Firestore } from "@google-cloud/firestore"
import type { Provider, TokenBundle } from "./providers.js"

export type SessionStatus = "pending" | "ready" | "consumed"

export interface SessionRecord {
	session_id: string
	state: string
	provider: Provider
	host: string
	status: SessionStatus
	created_at: number
	expires_at: number
	/** populated once status === "ready" */
	token?: TokenBundle
	/** provider account login/username, when the callback captures it */
	account?: string
}

export const SESSION_TTL_SECONDS = 10 * 60 // 10 minutes
export const COLLECTION = "cli_sessions"

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000)
}

/** Thin interface so tests can inject an in-memory fake. */
export interface SessionStore {
	create(rec: SessionRecord): Promise<void>
	getById(sessionId: string): Promise<SessionRecord | null>
	getByState(state: string): Promise<SessionRecord | null>
	update(sessionId: string, patch: Partial<SessionRecord>): Promise<void>
	delete(sessionId: string): Promise<void>
}

export class FirestoreSessionStore implements SessionStore {
	private dbPromise: Promise<Firestore> | null = null
	private readonly injected: Firestore | null
	constructor(db?: Firestore) {
		this.injected = db ?? null
	}

	/**
	 * Lazily import @google-cloud/firestore so importing this module (e.g. from a
	 * test that only uses an in-memory store) never requires the dependency to be
	 * installed. The real Cloud Function path resolves it on first use.
	 */
	private async client(): Promise<Firestore> {
		if (this.injected) return this.injected
		if (!this.dbPromise) {
			this.dbPromise = import("@google-cloud/firestore").then(
				(m) => new m.Firestore(),
			)
		}
		return this.dbPromise
	}

	private async col() {
		const db = await this.client()
		return db.collection(COLLECTION)
	}

	async create(rec: SessionRecord): Promise<void> {
		const col = await this.col()
		await col.doc(rec.session_id).set(rec)
	}

	async getById(sessionId: string): Promise<SessionRecord | null> {
		const col = await this.col()
		const snap = await col.doc(sessionId).get()
		if (!snap.exists) return null
		return this.reapIfExpired(snap.data() as SessionRecord)
	}

	async getByState(state: string): Promise<SessionRecord | null> {
		const col = await this.col()
		const q = await col.where("state", "==", state).limit(1).get()
		if (q.empty) return null
		return this.reapIfExpired(q.docs[0].data() as SessionRecord)
	}

	async update(sessionId: string, patch: Partial<SessionRecord>): Promise<void> {
		const col = await this.col()
		await col.doc(sessionId).set(patch, { merge: true })
	}

	async delete(sessionId: string): Promise<void> {
		const col = await this.col()
		await col.doc(sessionId).delete()
	}

	/** Opportunistic expiry sweep on read: delete + treat as gone. */
	private async reapIfExpired(
		rec: SessionRecord,
	): Promise<SessionRecord | null> {
		if (rec.expires_at <= nowSeconds()) {
			await this.delete(rec.session_id).catch(() => {})
			return null
		}
		return rec
	}
}

export function buildSession(args: {
	sessionId: string
	state: string
	provider: Provider
	host: string
}): SessionRecord {
	const created = nowSeconds()
	return {
		session_id: args.sessionId,
		state: args.state,
		provider: args.provider,
		host: args.host,
		status: "pending",
		created_at: created,
		expires_at: created + SESSION_TTL_SECONDS,
	}
}
