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

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import matter from "gray-matter"
import { primaryRepoRoot } from "../../state-tools.js"
import { isDriftDetectionDisabled } from "./drift-baseline.js"
import { bodySha256, fileSha256, outputSha256 } from "./sign-slot.js"

/** Files inside a witnessed directory that the sweep ignores when
 *  diffing inventory. Mirrors sign-slot.ts's DIR_INVENTORY_SKIP — must
 *  stay in sync or sign-time and check-time disagree on what counts as
 *  "in the inventory." */
const DIR_INVENTORY_SKIP_SWEEP: ReadonlySet<string> = new Set([
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

function listDirFiles(absDir: string): string[] {
	if (!existsSync(absDir)) return []
	let names: string[] = []
	try {
		names = readdirSync(absDir)
	} catch {
		return []
	}
	const out: string[] = []
	for (const name of names) {
		if (name.startsWith(".")) continue
		if (DIR_INVENTORY_SKIP_SWEEP.has(name)) continue
		try {
			if (statSync(join(absDir, name)).isFile()) out.push(name)
		} catch {
			// non-fatal
		}
	}
	return out
}

interface InputWitnessesRead {
	files: Record<string, string>
	dirs: Record<string, Record<string, string>>
}

function pickInputWitnesses(record: unknown): InputWitnessesRead | null {
	if (record === null || typeof record !== "object") return null
	const r = record as Record<string, unknown>
	const block = r.input_witnesses
	if (!block || typeof block !== "object" || Array.isArray(block)) return null
	const b = block as Record<string, unknown>
	const filesRaw = b.files
	const dirsRaw = b.dirs
	const files: Record<string, string> = {}
	const dirs: Record<string, Record<string, string>> = {}
	if (filesRaw && typeof filesRaw === "object" && !Array.isArray(filesRaw)) {
		for (const [k, v] of Object.entries(filesRaw as Record<string, unknown>)) {
			if (typeof v === "string" && v.length === 64) files[k] = v
		}
	}
	if (dirsRaw && typeof dirsRaw === "object" && !Array.isArray(dirsRaw)) {
		for (const [dirPath, inv] of Object.entries(
			dirsRaw as Record<string, unknown>,
		)) {
			if (!inv || typeof inv !== "object" || Array.isArray(inv)) continue
			const inventory: Record<string, string> = {}
			for (const [k, v] of Object.entries(inv as Record<string, unknown>)) {
				if (typeof v === "string" && v.length === 64) inventory[k] = v
			}
			dirs[dirPath] = inventory
		}
	}
	// Treat an entirely empty witnesses block as "no input drift
	// coverage" rather than "no inputs declared" — avoid emitting
	// addition drift for every file in the unit just because the
	// block exists but is empty.
	if (Object.keys(files).length === 0 && Object.keys(dirs).length === 0) {
		return null
	}
	return { files, dirs }
}

export type DriftKind =
	| "spec"
	| "discovery_output"
	| "discovery_mandate"
	/** A witnessed input file's SHA changed. The premise the slot was
	 *  signed against shifted; re-evaluation may be needed. */
	| "input_mutation"
	/** A witnessed input directory has a new file inside that wasn't
	 *  in the inventory at sign time. The premise set grew. */
	| "input_addition"
	/** A witnessed input file (or a file inside a witnessed dir) is
	 *  gone. The slot was signed against a premise that's no longer
	 *  available. */
	| "input_deletion"

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
			if (stored) {
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
			// Input premise drift — files+dirs the slot witnessed at
			// sign time. Resolves against intentDir (stages/...) or
			// repoRoot (everything else), mirroring the sign-time
			// resolution in resolveInputWitnesses().
			const inputWitnesses = pickInputWitnesses(record)
			if (inputWitnesses) {
				for (const [path, storedSha] of Object.entries(
					inputWitnesses.files,
				)) {
					// Resolution rule mirrors sign-slot.ts's resolveInputWitnesses:
					// try intent-relative first (covers `stages/`, `knowledge/`,
					// `feedback/`, `intent.md`), fall back to repo-relative
					// for paths that point outside the intent dir.
					const intentRelative = join(args.intentDir, path)
					const repoRelative = join(repoRoot, path)
					let abs: string | null = null
					if (existsSync(intentRelative)) abs = intentRelative
					else if (existsSync(repoRelative)) abs = repoRelative
					if (abs === null) {
						events.push({
							unit: unitName,
							role,
							kind: "input_deletion",
							file: path,
							since: at,
						})
						continue
					}
					// Files were stored with outputSha256 strategy
					// (body-hash for md/text, full-file for binary).
					// Same strategy here so sign-time and check-time
					// hashes align per-extension.
					const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase()
					const currentSha =
						ext === ".md" || ext === ".markdown" || ext === ".mdx"
							? bodySha256(abs)
							: outputSha256(abs)
					if (currentSha && currentSha !== storedSha) {
						events.push({
							unit: unitName,
							role,
							kind: "input_mutation",
							file: path,
							since: at,
						})
					}
				}
				for (const [dirRel, inventory] of Object.entries(
					inputWitnesses.dirs,
				)) {
					// Same intent-vs-repo resolution as for files.
					const intentRelative = join(args.intentDir, dirRel)
					const repoRelative = join(repoRoot, dirRel)
					const dirAbs = existsSync(intentRelative)
						? intentRelative
						: existsSync(repoRelative)
							? repoRelative
							: intentRelative // fallback: report against intent-rel for deletion
					const currentNames = listDirFiles(dirAbs)
					// Check stored entries: mutation or deletion.
					for (const [filename, storedSha] of Object.entries(inventory)) {
						const fileAbs = join(dirAbs, filename)
						if (!existsSync(fileAbs)) {
							events.push({
								unit: unitName,
								role,
								kind: "input_deletion",
								file: join(dirRel, filename),
								since: at,
							})
							continue
						}
						const currentSha = fileSha256(fileAbs)
						if (currentSha && currentSha !== storedSha) {
							events.push({
								unit: unitName,
								role,
								kind: "input_mutation",
								file: join(dirRel, filename),
								since: at,
							})
						}
					}
					// New files inside the dir = addition drift.
					for (const name of currentNames) {
						if (inventory[name] === undefined) {
							events.push({
								unit: unitName,
								role,
								kind: "input_addition",
								file: join(dirRel, name),
								since: at,
							})
						}
					}
				}
			}
		}

		// approvals.<role> is bookkeeping-only under the premise-witness
		// model — output mutation is NOT drift (outputs are downstream
		// of the signature and allowed to evolve). Legacy `witnesses`
		// maps on existing approvals are intentionally ignored here;
		// the v8→v9 migration drops the field entirely.

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
