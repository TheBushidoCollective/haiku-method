// orchestrator/workflow/sign-slot.ts — Sign-time witness stamping.
//
// When a review/approval/discovery role signs a unit (or intent.md),
// we stamp not just `at: <ISO>` but also a content hash of the
// PREMISES the signature depended on. The drift sweep later compares
// "what's there now" against "what was signed against" — a pure
// sha256 compare, no git dependency.
//
// A witness is a snapshot of *premises*, not deliverables. The
// reviewer signed off saying "given this spec body and these inputs,
// I approve." Drift detects when those premises change after the
// fact. Outputs (what the unit produces) are downstream of the
// signature, allowed to evolve, and intentionally NOT witnessed —
// see DRIFT-CLEANUP.md for the rationale.
//
// What gets witnessed per signed review:
//   - `body_sha256` — the unit's body (FM stripped) at sign time
//   - `input_witnesses.files` — every declared input path that
//     resolves to a regular file, SHA'd at sign time
//   - `input_witnesses.dirs`  — every declared input path that
//     resolves to a directory, with a full inventory of {filename: sha}
//     so the sweep can detect file additions / deletions inside, not
//     just edits to known files
//   - `intent.md` is an IMPLICIT input on every unit review — every
//     unit's premise IS the intent; no need to make every unit
//     declare it
//
// Why hash the BODY (not the whole file)? The unit's frontmatter is
// workflow-managed: every hat advance, every iteration append, every
// review/approval stamp mutates the fm. If we hashed the whole file,
// every engine FM mutation would trip drift on its own previously-
// signed reviews. By hashing just the post-frontmatter body, we
// decouple "what the human/agent wrote" from "what the workflow
// engine bookkeeps."

import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"

/** sha256 of just the post-frontmatter body of a markdown file.
 *  Empty string when the file doesn't exist (rare edge case where the
 *  signing happens before the body is written; the sweep treats an
 *  empty hash as "no witness" and will not flag drift).
 *
 *  CRITICAL: the body is canonicalized to always end with a single `\n`
 *  before hashing. `matter.stringify(content, data)` — used by every
 *  engine FM write (setFrontmatterField, migrations, sign/stamp paths)
 *  — appends a trailing newline to bodies that don't already have one.
 *  Without this canonicalization, witnesses stamped on a body lacking
 *  the trailing `\n` drift the moment ANY FM mutation runs through
 *  matter.stringify, even though the human/agent body is unchanged.
 *  This was the v9 "drift can't clear" loop: migration stamped
 *  witnesses, then bumped plugin_version on the same file, normalizing
 *  the body and orphaning every witness it had just stamped. */
export function bodySha256(absolutePath: string): string {
	if (!existsSync(absolutePath)) return ""
	const raw = readFileSync(absolutePath, "utf8")
	let body = raw
	try {
		const parsed = matter(raw)
		body = parsed.content
	} catch {
		// Malformed frontmatter — fall back to whole-file hash so we
		// still detect drift, just less precisely.
		body = raw
	}
	if (!body.endsWith("\n")) body = `${body}\n`
	return createHash("sha256").update(body, "utf8").digest("hex")
}

/** sha256 of the entire file contents (binary-safe). Used internally
 *  for binary outputs; callers should prefer `outputSha256` which picks
 *  body-vs-binary hashing per file extension. */
export function fileSha256(absolutePath: string): string {
	if (!existsSync(absolutePath)) return ""
	const buf = readFileSync(absolutePath)
	return createHash("sha256").update(buf).digest("hex")
}

/** Check whether a markdown file's current body matches a stored
 *  witness hash under EITHER hashing strategy:
 *
 *    - Canonicalized (post-fix): body ends with a single `\n` before
 *      hashing. This is what `bodySha256` produces today and what every
 *      future signed slot will witness.
 *    - Legacy (pre-fix): raw `matter().content` bytes, no canonicalization.
 *      Witnesses stamped before the canonicalization fix carry these
 *      hashes. After any engine FM write the on-disk body acquires a
 *      trailing `\n`, so naive comparison with the legacy hash would
 *      drift even though no human/agent body change occurred.
 *
 *  Why the dual-check is necessary: every in-flight intent across every
 *  user has witnesses stamped with the legacy hash. Without the legacy
 *  fallback, the canonicalization fix would force a one-time
 *  fleet-wide `reset_drift` on every upgrade. With the fallback, the
 *  next sign cycle restamps with the canonicalized hash and the legacy
 *  witnesses age out naturally.
 *
 *  Returns true when the file doesn't exist (caller treats deletion
 *  as a separate signal — `input_deletion` — not as body drift). */
export function bodyMatchesStoredHash(
	absolutePath: string,
	storedHash: string,
): boolean {
	if (!existsSync(absolutePath)) return true
	const canonical = bodySha256(absolutePath)
	if (canonical && canonical === storedHash) return true
	// Recompute under the pre-fix strategy: raw `matter().content`,
	// THEN strip any trailing \n that matter.stringify may have added
	// after the witness was stamped. The legacy hash was taken before
	// any FM write normalized the body; recovering the
	// pre-normalization shape lets the dual-strategy compare match
	// witnesses signed pre-fix on bodies that originally lacked a
	// trailing newline.
	//
	// Cheap (one read + one hash) and only runs when the canonical
	// hash missed — the common path stays single-hash.
	const raw = readFileSync(absolutePath, "utf8")
	let body = raw
	try {
		body = matter(raw).content
	} catch {
		body = raw
	}
	const legacyOnDisk = createHash("sha256")
		.update(body, "utf8")
		.digest("hex")
	if (legacyOnDisk === storedHash) return true
	// Strip a single trailing newline (matter.stringify always adds
	// AT MOST one), then re-hash.
	const stripped = body.endsWith("\n") ? body.slice(0, -1) : body
	if (stripped === body) return false
	const legacyPreStringify = createHash("sha256")
		.update(stripped, "utf8")
		.digest("hex")
	return legacyPreStringify === storedHash
}

/** Extensions whose drift signal should ignore frontmatter — only the
 *  content body matters. Adding an extension here means the drift sweep
 *  treats engine FM mutations (stage rebinding, signed_at restamps, hat
 *  bumps, etc.) as no-op for that file type, only flagging real
 *  human / agent prose changes. */
const TEXT_BODY_EXTENSIONS: ReadonlySet<string> = new Set([
	".md",
	".markdown",
	".mdx",
	".txt",
	".rst",
	".adoc",
])

/** Pick the right sha strategy for a declared output:
 *    - markdown / text-with-FM extensions → body hash (strips FM)
 *    - everything else (images, PDFs, JSON, etc.) → full-file binary
 *      hash
 *
 *  Drift is about content drift, not state drift. The cursor tracks
 *  workflow state (FM mutations) independently of the witness; mixing
 *  them into the witness was the noise that scared reviewers in v3 +
 *  early v4 sessions. Stripping FM from text outputs aligns the
 *  witness with what humans actually changed. */
export function outputSha256(absolutePath: string): string {
	if (!existsSync(absolutePath)) return ""
	const ext = absolutePath.slice(absolutePath.lastIndexOf(".")).toLowerCase()
	if (TEXT_BODY_EXTENSIONS.has(ext)) {
		return bodySha256(absolutePath)
	}
	return fileSha256(absolutePath)
}

/** Build the witnesses map for an approvals slot: { <relPath>: <sha256> }
 *  for every declared output that exists on disk at sign time. Outputs
 *  the unit declares but doesn't produce yet are simply omitted from
 *  the map (the sweep will treat their later appearance as drift on
 *  the unit owner's part — by then the slot should be re-signed).
 *
 *  Uses `outputSha256` so markdown / text outputs are body-hashed (FM
 *  stripped) and binary outputs get full-file hashes. The drift sweep
 *  uses the same picker, so sign-time and check-time hashes line up
 *  per-file regardless of whether the engine has touched the FM since.
 */
export function buildOutputWitnesses(
	intentDir: string,
	outputs: string[],
	repoRoot?: string,
): Record<string, string> {
	const map: Record<string, string> = {}
	// Output paths come in two shapes (mirrors drift-sweep.ts):
	//   - `stages/...` → intent-relative, joined against intentDir
	//   - everything else → repo-relative, joined against repoRoot
	// Falling back to intentDir for repo-relative paths produces a
	// witness for `<intentDir>/src/components/Button.tsx` (which never
	// exists). At drift-check time the file-not-found path silently
	// skips, so the most important artifact (real code) loses its
	// drift signal entirely.
	const root = repoRoot ?? deriveRepoRootFromIntentDir(intentDir)
	for (const out of outputs) {
		const abs = out.startsWith("stages/")
			? join(intentDir, out)
			: join(root, out)
		const sha = outputSha256(abs)
		if (sha) map[out] = sha
	}
	return map
}

/** Derive repo root from a given intent dir path. The on-disk layout is
 *  `<repoRoot>/.haiku/intents/<slug>/`, so peel off three segments. */
function deriveRepoRootFromIntentDir(intentDir: string): string {
	// `dirname` walks up: <slug> → intents → .haiku → <repoRoot>
	return join(intentDir, "..", "..", "..")
}

/** Canonicalize an input path against an intent dir. The witness key
 *  format is "intent-relative when possible, repo-relative otherwise."
 *  Three input shapes the engine has historically produced, all of
 *  which must resolve to the same canonical key:
 *
 *    1. `stages/design/artifacts/X.md` — already intent-relative. Pass through.
 *    2. `.haiku/intents/<slug>/stages/design/artifacts/X.md` — repo-rooted
 *       path pointing back INTO the intent dir (the dominant shape on
 *       in-flight intents pre-2026-05-17). Strip the prefix.
 *    3. `libraries/atorasu/jest.config.js` — repo-relative, points OUTSIDE
 *       the intent dir. Pass through (resolves against repoRoot at lookup).
 *
 *  Shape 2 was producing runaway `input_deletion` drift events because:
 *    - `join(intentDir, shape2Path)` double-nests
 *    - `join(primaryRepoRoot, shape2Path)` misses when the intent lives
 *      in a linked worktree (primary HEAD doesn't carry the intent branch)
 *  Normalizing to shape 1 makes the witness resolve against intentDir
 *  regardless of worktree/primary repo discrepancies. */
export function normalizeInputPath(
	inputPath: string,
	intentDir: string,
): string {
	// Derive slug from intentDir basename. `basename` of
	// `<root>/.haiku/intents/<slug>` is `<slug>`.
	const slug = intentDir.split("/").filter(Boolean).pop() ?? ""
	if (!slug) return inputPath
	const prefix = `.haiku/intents/${slug}/`
	if (inputPath.startsWith(prefix)) {
		return inputPath.slice(prefix.length)
	}
	// Also handle the absolute-path form (rare but produced by some
	// legacy code paths that joined intentDir into the rel before
	// passing it through).
	const absPrefix = `${intentDir}/`
	if (inputPath.startsWith(absPrefix)) {
		return inputPath.slice(absPrefix.length)
	}
	return inputPath
}

/** Input-witness block on a signed review. `files` covers paths the
 *  unit declares as inputs that resolve to a regular file. `dirs`
 *  covers paths that resolve to a directory — the inner record is
 *  the full inventory at sign time, which lets the sweep detect
 *  additions and deletions inside the directory, not just edits to
 *  known files. */
export interface InputWitnesses {
	files: Record<string, string>
	dirs: Record<string, Record<string, string>>
}

/** Files inside a witnessed directory we always skip — engine-internal
 *  bookkeeping (action-log, drift-markers from the legacy layer) and
 *  OS / VCS noise. Their presence/edit/deletion is never "drift" in
 *  any meaningful sense. */
const DIR_INVENTORY_SKIP = new Set<string>([
	".DS_Store",
	"Thumbs.db",
	".git",
	".gitignore",
	"action-log.jsonl",
	"drift-markers.json",
	"baseline.json",
	"baseline-content",
	".baseline-ack",
	"baseline-thrash.json",
])

/** Walk a directory one level deep, returning { filename: sha256 }
 *  for every regular file that isn't in the skip list or a dotfile.
 *  Non-recursive on purpose — directories declared as inputs are
 *  typically discovery/knowledge dirs with a flat layout. Recursive
 *  walks would over-witness (.git internals, nested build artifacts)
 *  and inflate the witness payload without adding signal. */
function dirInventory(absDir: string): Record<string, string> {
	const out: Record<string, string> = {}
	let names: string[] = []
	try {
		names = readdirSync(absDir)
	} catch {
		return out
	}
	for (const name of names) {
		if (name.startsWith(".")) continue
		if (DIR_INVENTORY_SKIP.has(name)) continue
		const abs = join(absDir, name)
		try {
			if (!statSync(abs).isFile()) continue
		} catch {
			continue
		}
		const sha = fileSha256(abs)
		if (sha) out[name] = sha
	}
	return out
}

/** Resolve a unit's declared inputs into a witnesses block. Every
 *  path is resolved as either a regular file (added to `files`) or
 *  a directory (added to `dirs` with full inventory). Missing paths
 *  are omitted — if they reappear later the sweep treats their
 *  appearance as addition drift on a parent dir witness, or just
 *  ignores them if no dir witness covers them.
 *
 *  `intent.md` is implicitly included on every unit review, regardless
 *  of whether the unit's `inputs:` lists it. Every unit's premise IS
 *  the intent body — making it explicit on every unit's `inputs:`
 *  would be redundant boilerplate.
 *
 *  Paths beginning with `stages/` resolve intent-relative (against
 *  `intentDir`). All other paths resolve repo-relative (against
 *  `repoRoot`). Mirrors the path-shape convention the sweep uses. */
export function resolveInputWitnesses(args: {
	intentDir: string
	repoRoot?: string
	unitInputs: string[]
}): InputWitnesses {
	const root = args.repoRoot ?? deriveRepoRootFromIntentDir(args.intentDir)
	const out: InputWitnesses = { files: {}, dirs: {} }

	// Implicit intent.md witness — always include if present.
	const intentMdAbs = join(args.intentDir, "intent.md")
	if (existsSync(intentMdAbs)) {
		const sha = bodySha256(intentMdAbs)
		if (sha) out.files["intent.md"] = sha
	}

	for (const rawRel of args.unitInputs) {
		if (rawRel === "intent.md") continue // already added implicitly
		// Canonicalize the input path BEFORE storing it as a witness key
		// — any `.haiku/intents/<slug>/` prefix collapses to a clean
		// intent-relative shape. The witness key on disk should be the
		// canonical form so the next sweep can resolve it without
		// guesswork; see normalizeInputPath for the full path-shape table.
		const rel = normalizeInputPath(rawRel, args.intentDir)
		if (rel === "intent.md") continue // post-normalization re-check
		// Resolve intent-relative when the path exists there (covers
		// `stages/...`, `knowledge/...`, `feedback/...`, and ad-hoc
		// intent-scope files). Fall back to repo-relative for paths
		// that point outside the intent dir (e.g. `terraform/...`
		// configs the unit consumes).
		const intentRelative = join(args.intentDir, rel)
		const abs = existsSync(intentRelative) ? intentRelative : join(root, rel)
		if (!existsSync(abs)) continue
		let isDir = false
		try {
			isDir = statSync(abs).isDirectory()
		} catch {
			continue
		}
		if (isDir) {
			out.dirs[rel] = dirInventory(abs)
		} else {
			// Use outputSha256 strategy — body-only for markdown/text,
			// full-file for binaries. Matches sweep-side hashing exactly,
			// independent of any FM the input file may carry.
			const sha = outputSha256(abs)
			if (sha) out.files[rel] = sha
		}
	}
	return out
}

/** Build a signed-review record: stamps the unit-body hash plus the
 *  input_witnesses block so any later premise change trips drift.
 *
 *  When `unitInputs` is omitted (legacy callers), input_witnesses is
 *  not populated — the slot stays body-only-witnessed and the sweep
 *  treats absent input_witnesses as "no input drift coverage" rather
 *  than "no inputs declared." Callers should pass `unitInputs` so
 *  the premise set is recorded. */
export function buildReviewRecord(
	unitPath: string,
	args?: { intentDir: string; unitInputs: string[]; repoRoot?: string },
): {
	at: string
	body_sha256: string
	input_witnesses?: InputWitnesses
} {
	const base = {
		at: new Date().toISOString(),
		body_sha256: bodySha256(unitPath),
	}
	if (!args) return base
	return {
		...base,
		input_witnesses: resolveInputWitnesses({
			intentDir: args.intentDir,
			repoRoot: args.repoRoot,
			unitInputs: args.unitInputs,
		}),
	}
}

/** Build a signed-approval record. Approvals are bookkeeping-only
 *  under the premise-witness model — they record that a role signed,
 *  but they do not witness any file content. Output mutation is NOT
 *  drift (see DRIFT-CLEANUP.md and Phase 6 of the cleanup).
 *
 *  The `intentDir` and `outputs` parameters are retained for caller
 *  back-compat but ignored. They'll be removed once every call site
 *  is updated (Phase 8).
 */
export function buildApprovalRecord(
	_intentDir?: string,
	_outputs?: string[],
): {
	at: string
} {
	return {
		at: new Date().toISOString(),
	}
}
