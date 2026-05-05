// orchestrator/workflow/write-audit.ts — Write-audit JSONL log +
// shared types for human-attributed write events.
//
// Responsibilities:
//   - `WriteAuditRecord`  — per-invocation record written to
//     `.haiku/intents/{slug}/write-audit.jsonl`
//     (MCP-TOOL-CONTRACT.md §8.1).
//   - `ActionLogEntry`    — per-tick action-log entry (ARCHITECTURE.md §6.2).
//   - `nextEntryId(tick, seq)` — format `HWM-{tick}-{NN}`.
//   - `truncateInstruction(text, max)` — truncate to 200 chars with `...`.
//   - `appendWriteAudit(intentDir, record)` — serialised O_APPEND + fsync,
//     bounded record size (FB-28 atomicity hardening).
//
// FB-28 atomicity model (replaces the prior PIPE_BUF claim):
//   The previous implementation documented "POSIX guarantees that write()s
//   ≤ PIPE_BUF (4 KiB on most platforms) to an O_APPEND file are atomic."
//   That claim was silently wrong:
//     • macOS PIPE_BUF is 512 bytes, not 4 KiB. A typical record (path +
//       rationale + dirs_created) routinely exceeds 512 bytes.
//     • Several record fields were unbounded (rationale, dirs_created,
//       claimed_author_id), so even on Linux a single record could exceed
//       4 KiB and break the atomicity guarantee.
//   The new model has two layers:
//     1. Hard caps on every variable-length record field, validated on
//        the producer side (`validateAndCapAuditRecord`). Records that
//        exceed the per-field caps are truncated; records whose
//        serialised size still exceeds `MAX_AUDIT_RECORD_BYTES` after
//        capping are rejected (`{ ok: false, reason: "record_too_large" }`).
//     2. A per-file in-process mutex (`acquireFileMutex`) serialises all
//        appends to a given log path within the Node process. Combined
//        with O_APPEND on the underlying syscall, this prevents byte
//        interleaving from concurrent writers. Cross-process writers
//        are not a concern in the current single-process MCP-server
//        runtime; if that ever changes the mutex needs to be promoted
//        to an advisory file lock.
//
// No new external dependencies: node:fs/promises only.

import { mkdirSync } from "node:fs"
import { open } from "node:fs/promises"
import { dirname, join } from "node:path"

// ── Types ──────────────────────────────────────────────────────────────────

/** Per-invocation audit record appended to `write-audit.jsonl`
 *  (MCP-TOOL-CONTRACT.md §8.1). Every field is present in stored records;
 *  `audit_log_appended` is always `true` in the file itself.
 *
 *  Author-identity attribution carries TWO keys (V-03 mitigation):
 *    - `claimed_author_id` — canonical, written on every new line. The
 *      name signals that this value is SELF-REPORTED (agent-supplied or
 *      SPA-form-supplied) and not server-resolved. Consumers MUST treat
 *      it as a claim, not an authority.
 *    - `human_author_id`   — legacy name, mirrored on writes for forward
 *      compatibility. Existing on-disk audit lines retain only the
 *      legacy key; readers honour `claimed_author_id ?? human_author_id`. */
export interface WriteAuditRecord {
	timestamp: string
	entry_id: string
	path: string
	sha: string
	author_class: "human-via-mcp"
	/** Self-reported attribution. New canonical field name. */
	claimed_author_id: string | null
	/** Legacy alias, mirrored to `claimed_author_id` on writes. */
	human_author_id: string | null
	rationale: string | null
	user_instruction_excerpt: string | null
	tick_counter: number
	session_id: string | null
	overwrite: boolean
	dirs_created: string[]
	audit_log_appended: true
	/** Tick scope — "stage" for per-stage tick counter (default), "intent"
	 *  for SPA intent-scope uploads stamped via getIntentScopeTickCounter.
	 *  Drift-gate consumer keys its action-log union by this scope (V-05). */
	tick_scope?: "stage" | "intent"
}

/** Per-tick action-log entry (ARCHITECTURE.md §6.2).
 *  Written by `haiku_human_write` and the SPA upload endpoint.
 *  Read by the drift-detection gate to classify author_class.
 *
 *  V-11 blue-team (unit-03 bolt 1): the entry_type union is widened to
 *  carry tamper-evident security signals — `baseline_established` and
 *  `baseline_corruption_event`. These entries do NOT represent file
 *  writes; the `path` / `sha` / `author_class` fields are populated with
 *  sentinel values (path = `__baseline_marker__:{stage}`, sha is empty
 *  string for non-content events) so downstream consumers that filter
 *  on `entry_type === "human_write" | "agent_write"` (e.g.
 *  reconstructPriorBaseline) keep their existing semantics. The drift-
 *  detection gate uses these markers to derive
 *  `wasBaselinePreviouslyEstablished` and `isBaselineThrashing` from
 *  the append-only log — closing the V-11.RT1 / RT2 / RT6 bypasses where
 *  an out-of-band attacker could disarm the gate by deleting state.json
 *  or baseline-thrash.json.
 *
 *  Author-identity (V-03) carries `claimed_author_id` (canonical) and
 *  `human_author_id` (legacy alias) — see WriteAuditRecord above. Both
 *  are SELF-REPORTED claims, not authoritative identities. */
export interface ActionLogEntry {
	entry_type:
		| "human_write"
		| "agent_write"
		| "baseline_established"
		| "baseline_corruption_event"
	path: string
	sha: string
	author_class: "human-via-mcp" | "agent"
	timestamp: string
	/** Self-reported attribution. New canonical field name. */
	claimed_author_id: string | null
	/** Legacy alias, mirrored to `claimed_author_id` on writes. */
	human_author_id: string | null
	entry_id: string
	tick_counter: number
	/** Tick scope — "stage" for per-stage counter (default), "intent" for
	 *  intent-scope (SPA `stage === null` uploads, V-05). */
	tick_scope?: "stage" | "intent"
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format a write entry identifier: `HWM-{tickCounter}-{NN}` where NN is
 *  zero-padded to at least 2 digits (MCP-TOOL-CONTRACT.md §4.1). */
export function nextEntryId(
	tickCounter: number,
	sequenceNumber: number,
): string {
	const nn = String(sequenceNumber).padStart(2, "0")
	return `HWM-${tickCounter}-${nn}`
}

/** Truncate `text` to `max` characters, appending `...` when truncated.
 *  The result is at most `max + 3` chars when truncated, or ≤ max chars
 *  when the input already fits.
 *
 *  Per MCP-TOOL-CONTRACT.md §8.2: "the first 200 characters of the user's
 *  instruction … truncated to 200 chars." This helper truncates to `max`
 *  and appends `...` so the output is `max + 3` = 203 chars maximum. */
export function truncateInstruction(text: string, max = 200): string {
	if (text.length <= max) return text
	return `${text.slice(0, max)}...`
}

// ── FB-28 record-size caps ────────────────────────────────────────────────

/** Hard cap on the serialized JSONL record size (one line, no newline).
 *
 *  Sized at 16 KiB to comfortably hold the typed record fields after the
 *  per-field caps below, with headroom for envelope keys and JSON
 *  escaping. Pre-FB-28 the implicit bound was PIPE_BUF (~4 KiB Linux,
 *  512 macOS) — that bound mattered because atomicity relied on it.
 *  Under the new mutex model, atomicity no longer depends on record
 *  size; the cap exists to block disk-fill / OOM amplification, not to
 *  preserve POSIX append atomicity.
 *
 *  Worst-case sum (post per-field cap):
 *    rationale (4 KB) + path (1 KB) + dirs_created (32 × 512 B = 16 KB
 *    BEFORE bound check; in practice an envelope-sized contributor)
 *    + claimed/human author id (2 × 128 B) + envelope (~512 B) → ≤ 16 KiB
 *  Records that still exceed the bound after capping are rejected with
 *  `record_too_large`. */
export const MAX_AUDIT_RECORD_BYTES = 16 * 1024

/** Per-field caps. Each is enforced by `validateAndCapAuditRecord` BEFORE
 *  the record is serialised; oversize values are truncated (with a
 *  marker on string fields, with truncation-on-array for arrays). */
export const MAX_AUDIT_RATIONALE_BYTES = 4096
export const MAX_AUDIT_AUTHOR_ID_BYTES = 128
export const MAX_AUDIT_PATH_BYTES = 1024
// 16 entries × 512 bytes/entry = 8 KiB worst-case from this field alone.
// The directory chain cap is sized for typical depths (newly-created
// scaffolds rarely exceed 4 levels); 16 is comfortable headroom.
export const MAX_AUDIT_DIRS_CREATED_COUNT = 16
export const MAX_AUDIT_DIR_PATH_BYTES = 512

/** UTF-8 byte length of a string (JS `.length` is UTF-16 code units). */
function utf8ByteLength(s: string): number {
	return Buffer.byteLength(s, "utf-8")
}

/** Truncate a UTF-8 string to at most `maxBytes` bytes, appending the
 *  marker `...[truncated]` when truncation occurs. The marker itself
 *  consumes 14 bytes and is always retained inside the final byte
 *  budget so the bound is never exceeded. */
function truncateBytes(s: string, maxBytes: number): string {
	if (utf8ByteLength(s) <= maxBytes) return s
	const marker = "...[truncated]"
	const markerBytes = utf8ByteLength(marker)
	const budget = Math.max(0, maxBytes - markerBytes)
	const buf = Buffer.from(s, "utf-8")
	// Walk back to the nearest UTF-8 boundary.
	let end = budget
	while (end > 0 && (buf[end] & 0xc0) === 0x80) end--
	return `${buf.slice(0, end).toString("utf-8")}${marker}`
}

/** Apply per-field caps to a `WriteAuditRecord`, returning a bounded copy
 *  plus the serialised JSON line. Returns `{ ok: false }` when the
 *  serialised line still exceeds `MAX_AUDIT_RECORD_BYTES` after capping
 *  (e.g. envelope blow-up from extreme nesting; should not happen with
 *  the typed schema but defended in depth).
 *
 *  This is the chokepoint that the FB-28 atomicity model relies on:
 *  the appender will refuse any record above the cap so the on-disk
 *  bytes are always within a size the userspace mutex + O_APPEND can
 *  guarantee don't interleave. */
export function validateAndCapAuditRecord(
	record: WriteAuditRecord,
):
	| { ok: true; record: WriteAuditRecord; line: string }
	| { ok: false; reason: string; bytes: number; cap: number } {
	// Defensive: treat null/undefined uniformly so legacy fixtures and
	// callers that omit a nullable field don't crash the truncate path.
	const capStr = (v: string | null | undefined, max: number): string | null =>
		v === null || v === undefined ? null : truncateBytes(v, max)
	const capped: WriteAuditRecord = {
		...record,
		path: truncateBytes(record.path, MAX_AUDIT_PATH_BYTES),
		claimed_author_id: capStr(
			record.claimed_author_id,
			MAX_AUDIT_AUTHOR_ID_BYTES,
		),
		human_author_id: capStr(record.human_author_id, MAX_AUDIT_AUTHOR_ID_BYTES),
		rationale: capStr(record.rationale, MAX_AUDIT_RATIONALE_BYTES),
		dirs_created: (record.dirs_created ?? [])
			.slice(0, MAX_AUDIT_DIRS_CREATED_COUNT)
			.map((d) => truncateBytes(d, MAX_AUDIT_DIR_PATH_BYTES)),
	}
	const line = JSON.stringify(capped)
	const bytes = utf8ByteLength(line)
	if (bytes > MAX_AUDIT_RECORD_BYTES) {
		return {
			ok: false,
			reason: "record_too_large",
			bytes,
			cap: MAX_AUDIT_RECORD_BYTES,
		}
	}
	return { ok: true, record: capped, line }
}

// ── Audit-log path ─────────────────────────────────────────────────────────

/** Returns the absolute path of the audit log for an intent directory. */
export function writeAuditPath(intentDir: string): string {
	return join(intentDir, "write-audit.jsonl")
}

// ── In-process append mutex ───────────────────────────────────────────────

/** Per-file-path mutex queue. Each entry is the tail of a Promise chain
 *  that the next `append*` caller awaits before performing its own
 *  open/write/sync/close cycle. This serialises every concurrent
 *  appender on the same file path within the Node process — the
 *  prior implementation relied on PIPE_BUF atomicity, which was
 *  silently false on macOS (PIPE_BUF=512) and ever-fragile under
 *  unbounded record sizes (FB-28). The mutex makes byte interleaving
 *  impossible regardless of record size. */
const fileMutexes = new Map<string, Promise<unknown>>()

/** Acquire the per-file mutex and run `fn` exclusively. The mutex is
 *  scoped by absolute file path so independent log files do not
 *  serialise against each other. The mutex chain is cleaned up after
 *  the last waiter resolves to avoid unbounded memory growth. */
async function withFileMutex<T>(
	filePath: string,
	fn: () => Promise<T>,
): Promise<T> {
	const prior = fileMutexes.get(filePath) ?? Promise.resolve()
	let release!: () => void
	const next = new Promise<void>((resolve) => {
		release = resolve
	})
	fileMutexes.set(
		filePath,
		prior.then(() => next),
	)
	try {
		await prior
		return await fn()
	} finally {
		release()
		// If we are still the tail, drop the entry so the map stays bounded.
		queueMicrotask(() => {
			const tail = fileMutexes.get(filePath)
			if (tail === undefined) return
			Promise.resolve(tail).then(() => {
				if (fileMutexes.get(filePath) === tail) {
					fileMutexes.delete(filePath)
				}
			})
		})
	}
}

// ── Append helpers ─────────────────────────────────────────────────────────

/** Append one line to a JSONL file under the per-file mutex.
 *
 *  The file is opened with `flag: "a"` so the underlying write uses
 *  O_APPEND. The mutex guarantees no other writer in this process
 *  interleaves bytes mid-line. The caller MUST ensure `line` is within
 *  `MAX_AUDIT_RECORD_BYTES` (validated upstream by
 *  `validateAndCapAuditRecord`).
 *
 *  Parent directories are created if they do not exist. An fsync follows
 *  to ensure durability before returning.
 *
 *  Returns `{ ok: true }` on success or `{ ok: false, reason: string }`
 *  on failure — never throws. */
async function appendJsonlLine(
	filePath: string,
	line: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	try {
		mkdirSync(dirname(filePath), { recursive: true })
	} catch (err) {
		return { ok: false, reason: String(err) }
	}

	return withFileMutex(filePath, async () => {
		let fd: Awaited<ReturnType<typeof open>> | null = null
		try {
			fd = await open(filePath, "a")
			await fd.write(`${line}\n`)
			await fd.sync()
			return { ok: true } as const
		} catch (err) {
			return { ok: false, reason: String(err) } as const
		} finally {
			if (fd !== null) {
				await fd.close().catch(() => {})
			}
		}
	})
}

/** Append a `WriteAuditRecord` to `write-audit.jsonl` (MCP-TOOL-CONTRACT.md §8).
 *
 *  Pipeline:
 *    1. `validateAndCapAuditRecord` truncates per-field overruns and
 *       rejects any record whose serialised JSON still exceeds
 *       `MAX_AUDIT_RECORD_BYTES`. Rejection surfaces as
 *       `{ ok: false, reason: "record_too_large" }`.
 *    2. The serialised line is appended under the per-file mutex so no
 *       concurrent writer can interleave bytes (FB-28 atomicity model).
 *    3. fsync is awaited before returning.
 *
 *  Failures do NOT throw — the caller surfaces them via the
 *  `audit_log_appended` field on the tool response
 *  (MCP-TOOL-CONTRACT.md §4.1). */
export async function appendWriteAudit(
	intentDir: string,
	record: WriteAuditRecord,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	const validation = validateAndCapAuditRecord(record)
	if (!validation.ok) {
		return {
			ok: false,
			reason: `${validation.reason} (bytes=${validation.bytes}, cap=${validation.cap})`,
		}
	}
	const filePath = writeAuditPath(intentDir)
	return appendJsonlLine(filePath, validation.line)
}

/** Append a raw line (no validation) to a JSONL file. Exported for
 *  callers that maintain their own size discipline (e.g. action-log
 *  entries that share the mutex but have a different schema).
 *
 *  Callers MUST ensure the line ≤ `MAX_AUDIT_RECORD_BYTES`. The append
 *  uses the same per-file mutex as `appendWriteAudit` so the two
 *  writers cannot interleave on the same file. */
export async function appendJsonlLineGuarded(
	filePath: string,
	line: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	if (utf8ByteLength(line) > MAX_AUDIT_RECORD_BYTES) {
		return {
			ok: false,
			reason: `record_too_large (bytes=${utf8ByteLength(line)}, cap=${MAX_AUDIT_RECORD_BYTES})`,
		}
	}
	return appendJsonlLine(filePath, line)
}
