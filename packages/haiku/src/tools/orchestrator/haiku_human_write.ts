// tools/orchestrator/haiku_human_write.ts — Conversational human-attributed
// write MCP tool. Called when a user instructs the agent to write a file on
// their behalf ("hey Claude, save this config to knowledge/...").
//
// The tool:
//   1. Validates the path against the deny-list and allow-list
//      (MCP-TOOL-CONTRACT.md §5).
//   2. Writes the file atomically (tempfile + rename).
//   3. Stamps an action-log entry with author_class "human-via-mcp".
//   4. Appends a write-audit record to write-audit.jsonl (unless the
//      drift_detection kill-switch is set — §8.5).
//   5. Does NOT update baseline.json — the next drift-gate tick observes
//      the SHA divergence and dispatches manual_change_assessment (AC-AB2).
//
// References:
//   - MCP-TOOL-CONTRACT.md §3–§10 (input/output/path/error/audit contracts)
//   - ARCHITECTURE.md §6.1–§6.3, §8.5 (author-class, trust+audit, kill-switch)
//   - ACCEPTANCE-CRITERIA.md AC-AB1, AC-AB2, AC-TA1–AC-TA4, AC-ALIAS1/2

import { createHash, randomBytes } from "node:crypto"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import matter from "gray-matter"
import { appendActionLogEntry } from "../../orchestrator/workflow/action-log.js"
import {
	canonicalisePath,
	getCurrentTickCounter,
	getIntentStages,
	isDriftDetectionDisabled,
} from "../../orchestrator/workflow/drift-baseline.js"
import {
	appendWriteAudit,
	nextEntryId,
	truncateInstruction,
	type WriteAuditRecord,
} from "../../orchestrator/workflow/write-audit.js"
import {
	findHaikuRoot,
	getIntentScopeTickCounter,
	isIntentArchived,
	isIntentLocked,
} from "../../state-tools.js"
import { cleanupTempFile, safeMkdirAndRename } from "../../state/safe-write.js"
import { defineTool, validateSlugArgs } from "../define.js"
import { text } from "./_text.js"

// ── Internal helpers ───────────────────────────────────────────────────────

/** Detect whether human_write_require_rationale is set to true in
 *  .haiku/settings.yml. Returns false when absent or not true. */
function isRationaleRequired(root: string): boolean {
	const settingsPath = join(root, "settings.yml")
	if (!existsSync(settingsPath)) return false
	try {
		const raw = readFileSync(settingsPath, "utf8")
		const { data } = matter(`---\n${raw}\n---\n`)
		return (
			(data as Record<string, unknown>).human_write_require_rationale === true
		)
	} catch {
		return false
	}
}

/** Count existing lines in write-audit.jsonl to derive the next sequence
 *  number. Returns 1 when the file does not exist or is empty.
 *  This is best-effort — the resulting entry_id is for human reference only. */
function getNextAuditSequenceNumber(intentDir: string): number {
	const auditPath = join(intentDir, "write-audit.jsonl")
	if (!existsSync(auditPath)) return 1
	try {
		const content = readFileSync(auditPath, "utf8")
		const lines = content.split("\n").filter((l) => l.trim() !== "")
		return lines.length + 1
	} catch {
		return 1
	}
}

// ── Path validation ────────────────────────────────────────────────────────

/** Deny-list patterns (MCP-TOOL-CONTRACT.md §5.2). Each entry carries the
 *  pattern to test against, the deny_rule label, and an optional human message. */
const DENY_LIST: Array<{ pattern: RegExp; rule: string; message: string }> = [
	{
		pattern: /(?:^|\/)units\/[^/]+\.md$/,
		rule: "stages/{stage}/units/*.md",
		message:
			"Unit files are lifecycle-managed. Use haiku_unit_write or haiku_unit_set.",
	},
	{
		pattern: /(?:^|\/)feedback\/[^/]+\.md$/,
		rule: "stages/{stage}/feedback/*.md",
		message:
			"Feedback files are lifecycle-managed. Use haiku_feedback or haiku_feedback_write.",
	},
	{
		pattern: /(?:^|\/)intent\.md$/,
		rule: "intent.md",
		message:
			"intent.md is workflow-engine-managed. Use haiku_intent_get or haiku_run_next.",
	},
	{
		pattern: /(?:^|\/)state\.json$/,
		rule: "stages/{stage}/state.json",
		message:
			"state.json is workflow engine-internal. Use haiku_run_next or a dedicated MCP tool.",
	},
	{
		pattern: /(?:^|\/)baseline\.json$/,
		rule: "stages/{stage}/baseline.json",
		message:
			"baseline.json is managed by the drift-detection gate. Direct writes desync SHA tracking.",
	},
	{
		pattern: /(?:^|\/)drift-markers\.json$/,
		rule: "drift-markers.json",
		message:
			"drift-markers.json is an internal workflow-engine artifact. Do not write directly.",
	},
	{
		// V-11 — the operator-only baseline-corrupt acknowledgement
		// marker. Only `/haiku:repair --confirm-baseline-reset ...`
		// (operator-driven) may write this; the agent has no path here.
		pattern: /(?:^|\/)\.baseline-ack$/,
		rule: "stages/{stage}/.baseline-ack",
		message:
			".baseline-ack is the operator-only baseline-reset acknowledgement marker. Only /haiku:repair --confirm-baseline-reset can write it; the agent has no path. This is the V-11 defence against silent baseline laundering.",
	},
	{
		// V-11 — the thrash counter is workflow-engine-managed. Letting
		// the agent reset it would let an attacker zero out the thrash
		// circuit breaker right before each corruption attempt.
		pattern: /(?:^|\/)baseline-thrash\.json$/,
		rule: "stages/{stage}/baseline-thrash.json",
		message:
			"baseline-thrash.json is the V-11 baseline-corruption circuit breaker. Managed exclusively by the drift-detection gate.",
	},
	{
		pattern: /(?:^|\/)write-audit\.jsonl$/,
		rule: "write-audit.jsonl",
		message:
			"write-audit.jsonl is append-only and managed exclusively by the haiku_human_write tool.",
	},
	{
		pattern: /(?:^|\/)drift-assessments\//,
		rule: "drift-assessments/*",
		message:
			"drift-assessments/ entries are managed by the workflow engine's assessment pipeline.",
	},
]

/** Allow-list pattern matchers. Returns the tracking class if the path
 *  matches an allowed surface, or null otherwise. */
function matchesAllowList(
	pathRel: string,
): { allowed: true; stageSegment: string | null } | { allowed: false } {
	// Intent-scope knowledge/ (no stage segment).
	if (/^knowledge\//.test(pathRel)) {
		return { allowed: true, stageSegment: null }
	}

	// Stage-scoped paths.
	const stageMatch = pathRel.match(/^stages\/([^/]+)\/(.+)$/)
	if (stageMatch) {
		const stageSlug = stageMatch[1]
		const rest = stageMatch[2]

		if (
			/^knowledge\//.test(rest) ||
			/^discovery\//.test(rest) ||
			/^artifacts\//.test(rest) ||
			/^outputs\//.test(rest) // alias — already canonicalised before we get here
		) {
			return { allowed: true, stageSegment: stageSlug }
		}
	}

	return { allowed: false }
}

type PathValidationResult =
	| { ok: true; canonicalPath: string }
	| {
			ok: false
			code: "path_outside_tracked_surface"
			reason:
				| "path_escape"
				| "deny_list_match"
				| "no_allow_match"
				| "invalid_stage"
			deny_rule?: string
			path: string
			message: string
	  }

/** Validate that `rawPath` is within the intent directory and the tracked
 *  surface. Returns the canonical form on success. */
function validatePath(
	rawPath: string,
	intentDir: string,
	intentStages: string[],
): PathValidationResult {
	// 1. Canonicalise outputs/ → artifacts/.
	let pathRel = canonicalisePath(rawPath)

	// 2. If absolute, make intent-relative.
	const intentAbs = resolve(intentDir)
	if (isAbsolute(pathRel)) {
		const absNormalised = resolve(pathRel)
		if (
			!absNormalised.startsWith(`${intentAbs}/`) &&
			absNormalised !== intentAbs
		) {
			return {
				ok: false,
				code: "path_outside_tracked_surface",
				reason: "path_escape",
				path: rawPath,
				message: `Path '${rawPath}' resolves outside the intent directory.`,
			}
		}
		pathRel = relative(intentAbs, absNormalised)
	}

	// Normalise any remaining . or .. by resolving against intentDir.
	const absCandidate = resolve(join(intentDir, pathRel))

	// 3. Check for path escape via .. or resolve climbing out.
	if (!absCandidate.startsWith(`${intentAbs}/`) && absCandidate !== intentAbs) {
		return {
			ok: false,
			code: "path_outside_tracked_surface",
			reason: "path_escape",
			path: rawPath,
			message: `Path '${rawPath}' resolves outside the intent directory (path escape detected).`,
		}
	}

	// Re-derive a clean relative path from the resolved absolute.
	const cleanRel = relative(intentAbs, absCandidate)

	// 4. Symlink escape — pre-validation pass.
	//    Authoritative defence is in `safeMkdirAndRename` (called from
	//    the write path below) — it walks the parent chain segment by
	//    segment with `lstatSync`, refusing any pre-existing symlink,
	//    and re-validates the realpath immediately before the atomic
	//    rename. That closes the V-04 TOCTOU window the legacy
	//    "realpath check, then mkdirSync(recursive: true)" idiom left
	//    open (parent dir didn't exist → realpath check skipped → mkdir
	//    silently followed planted symlinks).
	//
	//    This pre-check stays as a fast-fail for the common case where
	//    the parent dir already contains a planted symlink (e.g.
	//    `stages/security/knowledge` is already `→ /tmp/owned` at the
	//    moment of the request). It returns the same
	//    `path_outside_tracked_surface` envelope the rest of the
	//    validation uses, so downstream callers don't have to learn a
	//    second error shape. Even if this check passes,
	//    `safeMkdirAndRename` re-validates race-free.
	const parentDir = dirname(absCandidate)
	if (existsSync(parentDir)) {
		try {
			const realParent = realpathSync(parentDir)
			const realIntent = realpathSync(intentAbs)
			if (
				!realParent.startsWith(`${realIntent}/`) &&
				realParent !== realIntent
			) {
				return {
					ok: false,
					code: "path_outside_tracked_surface",
					reason: "path_escape",
					path: rawPath,
					message: `Path '${rawPath}' parent directory resolves outside the intent directory via symlink.`,
				}
			}
		} catch {
			// realpathSync failure — conservative: reject.
			return {
				ok: false,
				code: "path_outside_tracked_surface",
				reason: "path_escape",
				path: rawPath,
				message: `Path '${rawPath}': could not resolve parent directory. Rejecting for safety.`,
			}
		}
	}

	// Re-canonicalise after resolve in case the raw path had redundant segments.
	const canonicalPath = canonicalisePath(cleanRel)

	// 5. Apply deny-list (before allow-list — deny takes precedence).
	for (const entry of DENY_LIST) {
		if (entry.pattern.test(canonicalPath)) {
			return {
				ok: false,
				code: "path_outside_tracked_surface",
				reason: "deny_list_match",
				deny_rule: entry.rule,
				path: canonicalPath,
				message: `Cannot write to '${canonicalPath}': ${entry.message}`,
			}
		}
	}

	// 6. Apply allow-list.
	const allowResult = matchesAllowList(canonicalPath)
	if (!allowResult.allowed) {
		return {
			ok: false,
			code: "path_outside_tracked_surface",
			reason: "no_allow_match",
			path: canonicalPath,
			message: `Path '${canonicalPath}' does not match any allowed tracked-surface pattern (knowledge/, stages/{stage}/knowledge/, stages/{stage}/discovery/, stages/{stage}/artifacts/).`,
		}
	}

	// 7. Validate stage segment exists in this intent.
	if (allowResult.stageSegment !== null) {
		const stageSlug = allowResult.stageSegment
		if (!intentStages.includes(stageSlug)) {
			return {
				ok: false,
				code: "path_outside_tracked_surface",
				reason: "invalid_stage",
				path: canonicalPath,
				message: `Path '${canonicalPath}' references stage '${stageSlug}' which does not exist in this intent.`,
			}
		}
	}

	return { ok: true, canonicalPath }
}

// ── Tool definition ────────────────────────────────────────────────────────

export default defineTool({
	name: "haiku_human_write",
	description:
		"Write a file to the intent's tracked surface as a human-attributed write. Use when a user explicitly instructs the agent to write a file on their behalf (e.g. 'save this config to knowledge/'). The file is written atomically, attributed to the human via an action-log entry, and appended to the write-audit log. The baseline is NOT updated — the next drift-gate tick detects the change and dispatches manual_change_assessment. Allowed destinations: knowledge/, stages/{stage}/knowledge/, stages/{stage}/discovery/, stages/{stage}/artifacts/ (or outputs/ alias). Workflow-managed files (units, feedback, intent.md, state.json) are refused.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent_slug: {
				type: "string",
				description: "The slug of the active intent.",
			},
			path: {
				type: "string",
				description:
					"Destination file path — intent-relative (e.g. knowledge/brand-guide.md) or absolute within the intent directory. Path is canonicalised (outputs/ → artifacts/) before validation.",
			},
			content: {
				type: "string",
				description:
					"File content. UTF-8 string by default. Pass base64-encoded bytes and set content_encoding: 'base64' for binary files.",
			},
			content_encoding: {
				type: "string",
				enum: ["utf-8", "base64"],
				description: "Encoding of the content field. Default: 'utf-8'.",
			},
			claimed_author_id: {
				type: "string",
				description:
					"Self-reported identifier (username, email, UUID) of who the agent BELIEVES gave the instruction. Captured in the audit log as a CLAIM, not an authoritative identity — the server does not cross-check against any session or OS identity. Reviewers reading audit logs MUST treat this as 'what the agent said' rather than 'who did it'. (V-03 mitigation: renamed from `human_author_id` so consumers stop treating it as authoritative.)",
			},
			human_author_id: {
				type: "string",
				description:
					"DEPRECATED legacy alias for `claimed_author_id`. Accepted for backwards compatibility; the value is mirrored to `claimed_author_id` on persistence. New callers MUST use `claimed_author_id`.",
			},
			rationale: {
				type: "string",
				description:
					"Short free-text explanation of why the human requested this write. Strongly recommended. Required when the plugin setting human_write_require_rationale is true.",
			},
			user_instruction_excerpt: {
				type: "string",
				description:
					"The user's instruction as it appeared in chat (first 200 chars). Captured in the audit log for security review. Self-reported by the agent.",
			},
			overwrite: {
				type: "boolean",
				description:
					"Whether to overwrite the file if it already exists. Default: true. When false, returns path_already_exists if the destination exists.",
			},
			create_dirs: {
				type: "boolean",
				description:
					"Whether to create intermediate directories if they do not exist. Default: true. When false, returns parent_dir_missing if the parent directory is absent.",
			},
		},
		required: ["intent_slug", "path", "content"],
	},

	async handle(args) {
		// ── Input extraction ──────────────────────────────────────────────────
		const slug = args.intent_slug as string
		const rawPath = args.path as string
		const content = args.content as string
		const contentEncoding =
			(args.content_encoding as string | undefined) ?? "utf-8"
		// V-03: prefer the canonical `claimed_author_id`; fall back to the
		// legacy `human_author_id` so older callers still work. Either value
		// is recorded as a CLAIM, not an authoritative identity.
		const claimedAuthorId =
			(args.claimed_author_id as string | undefined) ??
			(args.human_author_id as string | undefined) ??
			null
		const rationale = (args.rationale as string | undefined) ?? null
		const userInstructionRaw =
			(args.user_instruction_excerpt as string | undefined) ?? null
		const overwrite = (args.overwrite as boolean | undefined) ?? true
		const createDirs = (args.create_dirs as boolean | undefined) ?? true

		// ── Slug guard ────────────────────────────────────────────────────────
		const slugCheck = validateSlugArgs({ intent: slug })
		if (slugCheck) return slugCheck

		// ── Resolve haiku root + intent dir ───────────────────────────────────
		const root = findHaikuRoot()
		const intentDir = join(root, "intents", slug)
		const intentMd = join(intentDir, "intent.md")

		if (!existsSync(intentMd)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "intent_not_found",
								message: `Intent '${slug}' not found.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Check for archived intent ─────────────────────────────────────────
		// V-06: delegate to the shared `isIntentArchived` helper so both the
		// MCP tool and the SPA upload route agree on intent state semantics.
		// The shared helper parses the YAML frontmatter via gray-matter, so
		// `status: archived` (legacy) and `archived: true` (boolean) classify
		// identically — no substring scans, no false positives on body text.
		if (isIntentArchived(intentDir)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "intent_not_active",
								message: `Intent '${slug}' is archived. Unarchive it first with haiku_intent_unarchive.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Check for locked intent ───────────────────────────────────────────
		// R-03 (V-06 helper coverage gap): the SPA upload routes check both
		// `isIntentArchived` AND `isIntentLocked`. Pre-fix the MCP path checked
		// only archived state, so an operator-locked intent (e.g. mid-revisit
		// freeze) would reject SPA uploads (423 intent_locked) but happily
		// accept `haiku_human_write` MCP calls. Mirror the SPA helper coverage
		// so the V-06 shared-helper rule ("both surfaces use the helpers")
		// holds for locked AND archived state.
		if (isIntentLocked(intentDir)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "intent_locked",
								message: `Intent '${slug}' is locked. Unlock it before issuing human-attributed writes.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Validate content_encoding ─────────────────────────────────────────
		if (contentEncoding !== "utf-8" && contentEncoding !== "base64") {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "invalid_content_encoding",
								message: `Unrecognized content_encoding '${contentEncoding}'. Valid values: 'utf-8', 'base64'.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Decode content ────────────────────────────────────────────────────
		let contentBytes: Buffer
		if (contentEncoding === "base64") {
			contentBytes = Buffer.from(content, "base64")
		} else {
			contentBytes = Buffer.from(content, "utf8")
		}

		// ── Reject empty content ──────────────────────────────────────────────
		if (contentBytes.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "empty_content",
								message:
									"Empty content is not permitted. The file must have at least one byte.",
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Rationale enforcement ─────────────────────────────────────────────
		if (isRationaleRequired(root) && (!rationale || rationale.trim() === "")) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "rationale_required",
								message:
									"Plugin settings require a rationale for human-attributed writes. Provide a short explanation of why the human requested this write in the 'rationale' field.",
								config_key: "human_write_require_rationale",
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Path validation ───────────────────────────────────────────────────
		const intentStages = getIntentStages(intentDir)
		const pathResult = validatePath(rawPath, intentDir, intentStages)

		if (!pathResult.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: pathResult.code,
								path: pathResult.path,
								reason: pathResult.reason,
								...(pathResult.reason === "deny_list_match" &&
								pathResult.deny_rule
									? { deny_rule: pathResult.deny_rule }
									: {}),
								message: pathResult.message,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		const { canonicalPath } = pathResult
		const destAbs = join(intentDir, canonicalPath)
		const parentDir = dirname(destAbs)

		// ── overwrite: false guard ────────────────────────────────────────────
		if (!overwrite && existsSync(destAbs)) {
			// Compute existing file SHA.
			let existingSha = ""
			try {
				const { createHash: ch } = await import("node:crypto")
				const existingBytes = readFileSync(destAbs)
				existingSha = ch("sha256").update(existingBytes).digest("hex")
			} catch {
				// Leave as empty string if we can't read it.
			}
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "path_already_exists",
								path: canonicalPath,
								existing_sha: existingSha,
								message: `Path '${canonicalPath}' already exists and overwrite is false. Set overwrite: true to replace it.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── create_dirs: false guard ──────────────────────────────────────────
		if (!createDirs && !existsSync(parentDir)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "parent_dir_missing",
								path: canonicalPath,
								missing_dir: relative(intentDir, parentDir),
								message: `Parent directory '${relative(intentDir, parentDir)}' does not exist and create_dirs is false.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Track which dirs we'll be creating ────────────────────────────────
		// We compute the list BEFORE calling safeMkdirAndRename so the audit
		// log reflects what was actually created. The helper is responsible
		// for the safe creation; we just enumerate so the audit envelope is
		// correct.
		const dirsCreated: string[] = []
		if (createDirs) {
			let cur = parentDir
			const toCreate: string[] = []
			while (!existsSync(cur)) {
				toCreate.unshift(cur)
				const up = dirname(cur)
				if (up === cur) break
				cur = up
			}
			for (const d of toCreate) {
				dirsCreated.push(relative(intentDir, d))
			}
		}

		// ── Compute SHA-256 over decoded bytes ────────────────────────────────
		const sha = createHash("sha256").update(contentBytes).digest("hex")

		// ── Atomic disk write — V-04 TOCTOU-safe ─────────────────────────────
		// Stream to a tempfile in the intent root (so it's on the same
		// filesystem as the destination — required for atomic rename), then
		// hand the (tempPath, parentDir, destPath, intentRoot) tuple to
		// `safeMkdirAndRename`. The helper:
		//   1. Refuses any pre-existing symlink in the parent chain.
		//   2. Creates missing intermediate dirs one segment at a time
		//      (no `recursive: true`, which would silently follow symlinks).
		//   3. Re-validates `realpath(parent)` against `realpath(intentRoot)`
		//      immediately before the atomic rename.
		//
		// We stage the tempfile in `intentDir` (not in `parentDir`, which
		// may not exist yet) so the rename is filesystem-local even when
		// `parentDir` is brand new.
		const pid = process.pid
		const rnd = randomBytes(6).toString("hex")
		const tmpPath = join(intentDir, `.hwm-tmp-${pid}-${rnd}.tmp`)

		try {
			await writeFile(tmpPath, contentBytes)
		} catch (err) {
			cleanupTempFile(tmpPath)
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: "disk_write_failed",
								path: canonicalPath,
								message: `Failed to write tempfile for '${canonicalPath}': ${String(err)}`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		const safeResult = safeMkdirAndRename(intentDir, parentDir, tmpPath, destAbs)
		if (!safeResult.ok) {
			// V-04 defence triggered, OR rename failed for a benign reason.
			// Either way: clean up the temp file and surface a structured
			// error envelope. Symlink/escape paths return a distinct error
			// code so callers and audits can distinguish a planted attack
			// from an I/O failure.
			cleanupTempFile(tmpPath)
			const isSymlinkAttack =
				safeResult.code === "parent_chain_contains_symlink" ||
				safeResult.code === "parent_chain_escape"
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								error: isSymlinkAttack ? "path_outside_tracked_surface" : "disk_write_failed",
								path: canonicalPath,
								reason: isSymlinkAttack ? safeResult.code : undefined,
								message: isSymlinkAttack
									? `Refused to write '${canonicalPath}': parent directory chain failed symlink-safety check (${safeResult.code}).`
									: `Failed to write '${canonicalPath}': ${safeResult.detail}`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}
		// Tempfile has been atomically moved; nothing to clean up on success.

		// ── Timestamps + entry IDs ────────────────────────────────────────────
		// R-02 (V-05 producer fix on MCP path): mirror the SPA branch.
		// Intent-scope writes (`knowledge/...`, no `stages/` prefix) go
		// through the deterministic `getIntentScopeTickCounter` so two
		// consecutive MCP-side intent-scope writes never share a counter
		// value. Stage-scope writes (`stages/{X}/...`) parse the stage slug
		// out of the canonical path and pass it to `getCurrentTickCounter`
		// so the no-arg `readdirSync` lottery can never pick the wrong
		// stage. `tick_scope` is stamped on both action-log and audit-log
		// entries so the drift-gate consumer's union (per-stage ∪
		// intent-scope) routes the entry into the right read.
		const stageMatch = canonicalPath.match(/^stages\/([^/]+)\//)
		const isIntentScope = stageMatch === null
		const tickCounter = isIntentScope
			? getIntentScopeTickCounter(intentDir)
			: getCurrentTickCounter(intentDir, stageMatch[1])
		const tickScope: "intent" | "stage" = isIntentScope ? "intent" : "stage"
		const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
		const seqNumber = getNextAuditSequenceNumber(intentDir)
		const entryId = nextEntryId(tickCounter, seqNumber)

		// ── Kill-switch check ─────────────────────────────────────────────────
		const driftDisabled = isDriftDetectionDisabled(root)

		// ── Action-log entry (always stamped — even when kill-switch is set) ───
		// Per ARCHITECTURE.md §8.5: "tool still writes the file and stamps the
		// action log, but skips the audit-log append."
		// V-03: write `claimed_author_id` (canonical) AND `human_author_id`
		// (legacy alias) so the rename is non-breaking — readers may pick up
		// either key during the migration window.
		await appendActionLogEntry(intentDir, tickCounter, {
			entry_type: "human_write",
			path: canonicalPath,
			sha,
			author_class: "human-via-mcp",
			timestamp,
			claimed_author_id: claimedAuthorId,
			human_author_id: claimedAuthorId,
			entry_id: entryId,
			tick_counter: tickCounter,
			tick_scope: tickScope,
		})

		// ── Audit-log append (only when drift detection is enabled) ───────────
		let auditLogAppended = false
		let auditSkipReason: string | undefined

		if (driftDisabled) {
			// Kill-switch: skip audit log (MCP-TOOL-CONTRACT.md §8.5 / AC-G1-KS).
			auditSkipReason = "drift_detection_disabled"
		} else {
			const userInstructionExcerpt = userInstructionRaw
				? truncateInstruction(userInstructionRaw)
				: null

			const auditRecord: WriteAuditRecord = {
				timestamp,
				entry_id: entryId,
				path: canonicalPath,
				sha,
				author_class: "human-via-mcp",
				claimed_author_id: claimedAuthorId,
				human_author_id: claimedAuthorId,
				rationale,
				user_instruction_excerpt: userInstructionExcerpt,
				tick_counter: tickCounter,
				session_id: null, // not accessible from tool handler context
				overwrite,
				dirs_created: dirsCreated,
				audit_log_appended: true,
				tick_scope: tickScope,
			}

			const auditResult = await appendWriteAudit(intentDir, auditRecord)
			auditLogAppended = auditResult.ok
		}

		// ── Success response ──────────────────────────────────────────────────
		// V-03: surface BOTH `claimed_author_id` (canonical) and
		// `human_author_id` (legacy alias) so callers using either key see
		// the value the audit log just received.
		const responseBody: Record<string, unknown> = {
			ok: true,
			path: canonicalPath,
			sha,
			author_class: "human-via-mcp",
			timestamp,
			claimed_author_id: claimedAuthorId,
			human_author_id: claimedAuthorId,
			dirs_created: dirsCreated,
			action_log_entry_id: entryId,
			audit_log_appended: auditLogAppended,
		}

		if (auditSkipReason) {
			responseBody.reason = auditSkipReason
		}

		return text(JSON.stringify(responseBody, null, 2))
	},
})
