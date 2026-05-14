// orchestrator/workflow/drift-sweep.ts — Drift detection by content hash.
//
// 2026-05-07: collapsed from the old sidecar-baseline + git-log model
// to a pure content-hash compare. Sign-time records the body sha256
// (for spec witnesses) or a witnesses map of sha256s (for output
// witnesses). The sweep hashes what's there now and compares.
//
// Key invariant: we hash the BODY of unit specs, not the whole file.
// The frontmatter is workflow-managed (every advance_hat appends to
// iterations[], every signing stamps a slot). If we hashed the whole
// file, every engine fm mutation would trip drift on its own
// previously-signed reviews. The body-only hash decouples
// agent/human authored prose from engine bookkeeping.
//
// Output and discovery witnesses use `outputSha256`, which body-hashes
// markdown / text-with-FM extensions and full-file-hashes everything
// else. The sign-time helper picks the same strategy per-extension, so
// the sign-time and check-time hashes always line up regardless of
// whether the engine has stamped FM on the file in the meantime. Pure
// content drift, no state-of-file noise.
//
// Backward-compat: in-flight intents may have witnesses stamped before
// 2026-05-07 with the old whole-file hash strategy. The check-time
// helper `outputMatchesAnyStrategy` accepts EITHER hash — body-only
// (new) OR whole-file (legacy) — as a non-drift signal. This makes the
// common transition path migration-free: pre-change witnesses where
// the file is unchanged keep validating against their original
// whole-file hash, post-change witnesses validate against the
// body-only hash, and real content changes break both. Once every
// active intent re-signs at least once, the legacy fallback is dead
// code we can drop.
//
// Narrow edge case: a pre-change whole-file witness on a markdown
// file whose FM (NOT body) was mutated out-of-band before the next
// sign cycle will report a one-time false drift event — the legacy
// hash includes FM, so it stops matching once FM changes; the new
// hash compares body-only against an FM-inclusive stored hash, so it
// can't match either. Acceptable cost: the engine doesn't mutate
// output FM (only unit FM), so this only fires when a human edits
// an output's FM by hand between the upgrade and the next sign.
// One drift event, dedup'd by source_ref against any open FB, cleared
// by the next sign cycle. The alternative (dual-stamping at sign
// time or a dedicated migration pass) is more complexity than the
// case warrants.
//
// Filesystem-only. The sweep hashes files on disk and compares against
// stored witnesses; it does not consult git history. (Earlier passes
// included a `commits: <SHAs>` enrichment from `git log --since=<at>`,
// but it was load-bearing for nothing — the detection signal is the
// hash mismatch alone — and was a source of subtle path-resolution
// bugs in worktrees. Filesystem-as-source-of-truth, applied here too.)

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import matter from "gray-matter"
import { primaryRepoRoot } from "../../state-tools.js"
import { isDriftDetectionDisabled } from "./drift-baseline.js"
import { bodySha256, fileSha256, outputSha256 } from "./sign-slot.js"

export type DriftKind =
	| "spec"
	| "output"
	| "discovery_output"
	| "discovery_mandate"

export type DriftEvent = {
	unit: string
	role: string
	kind: DriftKind
	/** Intent-relative path to the drifted file. Used in the FB body
	 *  and source_ref; no longer fed to git. */
	file: string
	since: string
}

export type DriftSweepResult = {
	events: DriftEvent[]
	scanned: number
	skipped: number
}

function readFm(path: string): Record<string, unknown> | null {
	if (!existsSync(path)) return null
	try {
		const raw = readFileSync(path, "utf8")
		const parsed = matter(raw)
		return parsed.data as Record<string, unknown>
	} catch {
		return null
	}
}

function pickAt(record: unknown): string | null {
	if (record === null || typeof record !== "object") return null
	const r = record as Record<string, unknown>
	return typeof r.at === "string" && r.at.length > 0 ? r.at : null
}

function pickBodySha(record: unknown): string | null {
	if (record === null || typeof record !== "object") return null
	const r = record as Record<string, unknown>
	return typeof r.body_sha256 === "string" && r.body_sha256.length === 64
		? r.body_sha256
		: null
}

function pickWitnesses(record: unknown): Record<string, string> | null {
	if (record === null || typeof record !== "object") return null
	const r = record as Record<string, unknown>
	const w = r.witnesses
	if (w === null || typeof w !== "object" || Array.isArray(w)) return null
	const out: Record<string, string> = {}
	for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
		if (typeof v === "string" && v.length === 64) out[k] = v
	}
	return out
}

/**
 * Backward-compat output hash check. Returns true when the file's
 * current content matches the stored witness under EITHER hashing
 * strategy:
 *   - `outputSha256` (post-2026-05-07): body-only for markdown / text,
 *     full-file for binaries.
 *   - `fileSha256` (legacy): full-file regardless of extension.
 *
 * Both hashes are computed eagerly so the call shape is the same in
 * either branch — premature optimisation here would just complicate
 * the comparator without a measurable saving (witnesses are O(declared
 * outputs per unit), and SHA-256 of small markdown files is sub-ms).
 *
 * Returns null when the file doesn't exist on disk (caller treats that
 * as "not a drift signal here" — deletion is reported elsewhere). The
 * empty-string return from `outputSha256` / `fileSha256` for a missing
 * file is the trigger; both helpers behave the same way in that case.
 */
function outputMatchesAnyStrategy(
	absolutePath: string,
	storedHash: string,
): { matches: boolean; current: string | null } | null {
	const current = outputSha256(absolutePath)
	if (!current) return null // file gone
	if (current === storedHash) return { matches: true, current }
	const legacy = fileSha256(absolutePath)
	if (legacy === storedHash) return { matches: true, current: legacy }
	return { matches: false, current }
}

function listUnitsInStage(stageDir: string): string[] {
	const unitsDir = join(stageDir, "units")
	if (!existsSync(unitsDir)) return []
	return readdirSync(unitsDir, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => join(unitsDir, e.name))
}

function discoveryOutputPath(
	intentDir: string,
	stage: string,
	agent: string,
): string {
	return join(intentDir, "stages", stage, "discovery", `${agent}.md`)
}

function discoveryMandatePath(
	repoRoot: string,
	studio: string,
	stage: string,
	agent: string,
): string {
	return join(
		repoRoot,
		"plugin",
		"studios",
		studio,
		"stages",
		stage,
		"discovery",
		`${agent}.md`,
	)
}

/**
 * Walk all signed reviews/approvals/discovery on every unit in the
 * active stage, plus intent-scope approvals on intent.md. For each
 * signed slot, hash the witnessed body/files and compare to the
 * stored hash. Mismatch = drift.
 */
export function runDriftSweep(args: {
	intentDir: string
	stage: string
	studio: string
	repoRoot?: string
}): DriftSweepResult {
	const repoRoot = args.repoRoot ?? primaryRepoRoot()
	const haikuRoot = join(repoRoot, ".haiku")
	if (isDriftDetectionDisabled(haikuRoot)) {
		return { events: [], scanned: 0, skipped: 0 }
	}
	const events: DriftEvent[] = []
	let scanned = 0
	let skipped = 0

	const stageDir = join(args.intentDir, "stages", args.stage)
	const unitPaths = listUnitsInStage(stageDir)

	for (const unitPath of unitPaths) {
		const fm = readFm(unitPath)
		if (!fm) continue
		const unitName = (() => {
			const base = unitPath.split("/").pop() ?? ""
			return base.replace(/\.md$/, "")
		})()
		if (fm.started_at == null) {
			skipped++
			continue
		}
		// All drift-event paths are intent-relative. The intent dir is
		// the natural unit of reference for FB bodies + source_refs;
		// rooting events here also means the path resolves the same way
		// regardless of whether the intent lives in the primary repo or
		// a linked worktree (no `.claude/worktrees/<name>/` prefix to
		// strip downstream).
		const unitRel = relative(args.intentDir, unitPath)

		// reviews.<role> witnesses the unit body. Hash it now and
		// compare to the stored body_sha256. When the slot has no
		// body_sha256 (legacy intent or pre-refactor stamp), we treat
		// this tick as a baseline-set: skip drift detection for that
		// slot. The next sign call will populate the hash.
		const reviews = (fm.reviews as Record<string, unknown>) ?? {}
		for (const [role, record] of Object.entries(reviews)) {
			scanned++
			const at = pickAt(record)
			if (!at) continue
			const stored = pickBodySha(record)
			if (!stored) continue // legacy slot, no baseline yet
			const current = bodySha256(unitPath)
			if (current && current !== stored) {
				events.push({
					unit: unitName,
					role,
					kind: "spec",
					file: unitRel,
					since: at,
				})
			}
		}

		// approvals.<role> witnesses declared output paths. The slot
		// stores a `witnesses: { <relPath>: <sha256> }` map. For each
		// entry: hash the file now, compare to stored. Mismatch =
		// drift on that specific output. Files declared in fm.outputs
		// but absent from witnesses (e.g. created after sign) are
		// ignored — they'll show up next time the slot is re-signed.
		const approvals = (fm.approvals as Record<string, unknown>) ?? {}
		for (const [role, record] of Object.entries(approvals)) {
			scanned++
			const at = pickAt(record)
			if (!at) continue
			const witnesses = pickWitnesses(record)
			if (!witnesses) continue // legacy slot, no baseline yet
			for (const [outRel, storedHash] of Object.entries(witnesses)) {
				// Output paths come in two shapes:
				//   - intent-relative: `stages/design/foo.md` — joined
				//     against intentDir.
				//   - repo-relative: `src/components/Button.tsx` — joined
				//     against repoRoot.
				// `join(intentDir, "src/components/Button.tsx")` resolves
				// to `<intentDir>/src/components/Button.tsx`, which doesn't
				// exist, so the file-not-found path was silently skipping
				// drift detection for the most important artifact (real
				// code). Distinguish by leading segment: anything starting
				// with `stages/` is intent-relative; everything else is
				// repo-relative.
				// Repo-scoped paths (no leading `stages/`) live outside the
				// intent dir — they're rooted at the intent's repo root,
				// which is whatever git considers the toplevel here.
				// `repoRoot` was reasonable in the primary repo and wrong
				// in a linked worktree; the safer move is to keep the
				// stored path verbatim in the event payload (it's already
				// the agent's reference shape) and only resolve it to an
				// absolute path for the hash compare.
				const outAbs = outRel.startsWith("stages/")
					? join(args.intentDir, outRel)
					: join(repoRoot, outRel)
				const cmp = outputMatchesAnyStrategy(outAbs, storedHash)
				if (!cmp) continue // file deleted; not a drift signal here
				if (!cmp.matches) {
					events.push({
						unit: unitName,
						role,
						kind: "output",
						file: outRel,
						since: at,
					})
				}
			}
		}

		// discovery.<agent> witnesses the discovery output file plus
		// the studio mandate. Same hash-compare model. Both witnessed
		// files run through `outputSha256`, which body-hashes markdown
		// (the common case for both discovery outputs and plugin-source
		// mandates) and falls back to full-file hashes for any other
		// extension. Sign-time and check-time pick the same strategy.
		const discovery = (fm.discovery as Record<string, unknown>) ?? {}
		for (const [agent, record] of Object.entries(discovery)) {
			scanned++
			const at = pickAt(record)
			if (!at) continue
			const r = record as Record<string, unknown>
			const outputAbs = discoveryOutputPath(args.intentDir, args.stage, agent)
			const outputStored =
				typeof r.output_sha256 === "string" ? r.output_sha256 : null
			if (outputStored) {
				const cmp = outputMatchesAnyStrategy(outputAbs, outputStored)
				if (cmp && !cmp.matches) {
					events.push({
						unit: unitName,
						role: agent,
						kind: "discovery_output",
						file: relative(args.intentDir, outputAbs),
						since: at,
					})
				}
			}
			const mandateAbs = discoveryMandatePath(
				repoRoot,
				args.studio,
				args.stage,
				agent,
			)
			const mandateStored =
				typeof r.mandate_sha256 === "string" ? r.mandate_sha256 : null
			if (mandateStored) {
				const cmp = outputMatchesAnyStrategy(mandateAbs, mandateStored)
				if (cmp && !cmp.matches) {
					// Discovery mandates live under the studio plugin root
					// inside the primary repo, so the natural relativization
					// is against `repoRoot` here — it's the same path shape
					// the studio reader uses elsewhere.
					events.push({
						unit: unitName,
						role: agent,
						kind: "discovery_mandate",
						file: relative(repoRoot, mandateAbs),
						since: at,
					})
				}
			}
		}
	}

	// Intent-scope approvals on intent.md — body-hash witness. Same
	// rules as unit reviews: hash the body (post-frontmatter), skip
	// if no stored hash.
	const intentMdPath = join(args.intentDir, "intent.md")
	const intentFm = readFm(intentMdPath)
	if (intentFm) {
		const intentApprovals =
			(intentFm.approvals as Record<string, unknown>) ?? {}
		const intentRel = relative(args.intentDir, intentMdPath)
		for (const [role, record] of Object.entries(intentApprovals)) {
			scanned++
			const at = pickAt(record)
			if (!at) continue
			const stored = pickBodySha(record)
			if (!stored) continue
			const current = bodySha256(intentMdPath)
			if (current && current !== stored) {
				events.push({
					unit: "(intent)",
					role,
					kind: "spec",
					file: intentRel,
					since: at,
				})
			}
		}
	}

	// Dedup against open drift FBs. Once an agent files an FB for a
	// drift event, we suppress re-emission until the FB closes —
	// otherwise Track C (drift) would always win over Track B (the fix
	// loop) and the loop could never complete.
	//
	// Two-layer dedup:
	//   1. EXACT source_ref match — `drift:<kind>:<file>` against the
	//      FB's `source_ref` frontmatter. The fast path when the agent
	//      followed the drift_detected prompt's instructions verbatim.
	//   2. PATH-based fallback — any open drift FB whose source_ref or
	//      body mentions the event's file path. Catches the case where
	//      the agent filed an FB but the source_ref shape drifted
	//      (different kind classification, missing `drift:` prefix,
	//      hand-typed source_ref, etc.). Without this, a single file
	//      could re-emit drift_detected on every tick despite an open
	//      FB, because the dedup key didn't quite match. Observed in
	//      production 2026-05-12: drift on `SEMANTIC-TOKENS.md` fired
	//      12 times in a row even though the agent had already filed an
	//      FB about it.
	const filed = collectOpenDriftFbDedup(args.intentDir)
	const filtered = events.filter((e) => {
		const ref = `drift:${e.kind}:${e.file}`
		if (filed.refs.has(ref)) return false
		if (filed.paths.has(e.file)) return false
		// File path is sometimes recorded as basename or as a
		// stage-relative path. Match on basename as a final fallback —
		// any open drift FB whose source_ref or body mentions the file's
		// basename is treated as "agent already knows about this drift."
		const basename = e.file.split("/").pop() ?? ""
		if (basename && filed.basenames.has(basename)) return false
		return true
	})

	return { events: filtered, scanned, skipped }
}

/** Open-drift-FB dedup index. Built by walking every feedback dir in
 *  the intent and collecting three views of every open FB with
 *  `origin: "drift"`:
 *
 *  - `refs` — the literal `source_ref` value (e.g. `drift:spec:foo.md`).
 *    Fast exact match for FBs the agent filed via the drift_detected
 *    prompt's instructions verbatim.
 *  - `paths` — the file path extracted from `source_ref` (third segment
 *    after `drift:<kind>:`). Catches FBs where the kind drifted but the
 *    file matches.
 *  - `basenames` — basename of every collected path AND every path-like
 *    token in the FB body. Final fallback for FBs whose source_ref shape
 *    is unrecognised but the file is mentioned in the body.
 *
 *  Closed FBs (`closed_at` set) are ignored — once closure ships, the
 *  drift loop is allowed to re-arm on the same file. */
function collectOpenDriftFbDedup(intentDir: string): {
	refs: Set<string>
	paths: Set<string>
	basenames: Set<string>
} {
	const refs = new Set<string>()
	const paths = new Set<string>()
	const basenames = new Set<string>()
	const fbDirs: string[] = []
	const stagesDir = join(intentDir, "stages")
	if (existsSync(stagesDir)) {
		for (const entry of readdirSync(stagesDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			fbDirs.push(join(stagesDir, entry.name, "feedback"))
		}
	}
	fbDirs.push(join(intentDir, "feedback"))
	for (const dir of fbDirs) {
		if (!existsSync(dir)) continue
		for (const f of readdirSync(dir)) {
			if (!f.endsWith(".md")) continue
			const fbPath = join(dir, f)
			const fm = readFm(fbPath)
			if (!fm) continue
			if (fm.origin !== "drift") continue
			if (typeof fm.closed_at === "string" && fm.closed_at.length > 0) continue
			const ref = fm.source_ref
			if (typeof ref === "string" && ref.length > 0) {
				refs.add(ref)
				// Extract file path from `drift:<kind>:<file>`. We allow
				// kind to be anything (or empty); the path is whatever
				// follows the second colon.
				const m = ref.match(/^drift:[^:]*:(.+)$/)
				if (m?.[1]) {
					const filePath = m[1]
					paths.add(filePath)
					const base = filePath.split("/").pop() ?? ""
					if (base) basenames.add(base)
				}
			}
			// Body scan: any token that looks like a basename mentioned
			// in the FB body counts as "agent acknowledged this file."
			// Cheap regex over file extensions we care about — markdown
			// outputs and common source files. This is a fallback only;
			// the source_ref path above is the primary signal.
			try {
				const raw = readFileSync(fbPath, "utf8")
				const body = matter(raw).content
				for (const match of body.matchAll(
					/[\w.-]+\.(?:md|mdx|markdown|tsx?|jsx?|css|scss|json|ya?ml)/g,
				)) {
					basenames.add(match[0])
				}
			} catch {
				// FB body parse failure — skip body scan, keep refs/paths.
			}
		}
	}
	return { refs, paths, basenames }
}
