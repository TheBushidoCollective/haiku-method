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
import { basename, join, relative } from "node:path"
import matter from "gray-matter"
import { readStageArtifactDefs } from "../../studio-reader.js"
import { isDriftDetectionDisabled } from "./drift-baseline.js"
import {
	bodyMatchesStoredHash,
	bodySha256,
	fileSha256,
	normalizeInputPath,
	outputSha256,
} from "./sign-slot.js"

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

/**
 * Intent-relative paths the CURRENT stage itself produces: every
 * discovery/output template's declared `location:` plus every current-
 * stage unit's `outputs:`. A witnessed INPUT that matches one of these is
 * the stage's OWN output evolving inside the loop — e.g. a shared baton
 * (`knowledge/DESIGN-SYSTEM-ANCHOR.md`) that every `designer-prep` hat
 * appends its per-unit section to, which is ALSO a drift-witnessed input
 * for the pre-execute review slots. Firing `input_mutation` on it creates
 * an input==output cycle: each hat append changes the hash, drift
 * re-fires against every witnessing slot, the fix loop runs, the next
 * prep appends again, and it never converges (2026-05-20
 * drift-input-output-loop report — six findings on two baton files, one
 * misclassified as a "material deletion" against a 393-insertion / 0-
 * deletion append). The premise-witness model already exempts OUTPUT
 * witnesses from drift ("outputs are downstream of the signature and
 * allowed to evolve"); this extends the same logic to a file that is
 * simultaneously an input-witness AND a current-stage output.
 */
function stageProducedRelPaths(
	intentDir: string,
	studio: string,
	stage: string,
	unitPaths: ReadonlyArray<string>,
): Set<string> {
	const slug = basename(intentDir)
	const out = new Set<string>()
	const toIntentRel = (loc: string): string => {
		const resolved = loc.replace(/\{intent-slug\}/g, slug)
		// Locations are repo-relative (`.haiku/intents/<slug>/...`); the
		// witness keys are intent-relative. Strip the intent-dir prefix so
		// the two compare directly.
		const prefix = `.haiku/intents/${slug}/`
		return resolved.startsWith(prefix) ? resolved.slice(prefix.length) : resolved
	}
	try {
		for (const def of readStageArtifactDefs(studio, stage)) {
			if (def.location) out.add(toIntentRel(def.location))
		}
	} catch {
		/* studio/stage unreadable — produced set stays empty (no exemption) */
	}
	for (const unitPath of unitPaths) {
		const ufm = readFm(unitPath)
		const outputs = ufm && Array.isArray(ufm.outputs) ? ufm.outputs : []
		for (const o of outputs) {
			if (typeof o === "string" && o.length > 0) out.add(o)
		}
	}
	return out
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
	// Default repoRoot to the WORKTREE-aware derivation (peel 3 segments
	// off intentDir → walks past `<slug>/intents/.haiku/`). Earlier
	// implementations defaulted to `primaryRepoRoot()`, which always
	// returned the primary repo even when the intent lived in a linked
	// worktree. Sign-time used the worktree (via sign-slot's
	// `deriveRepoRootFromIntentDir`), so any input pointing OUTSIDE the
	// intent dir got witnessed against the worktree's HEAD but checked
	// against the primary's HEAD — silent drift on every sweep when the
	// two branches diverged. The two sides must use the same root
	// derivation; intentDir-derived is the right one because it works
	// for both topologies. Callers (e.g. workflow tick) can still pass
	// `repoRoot` explicitly when they need the primary.
	const repoRoot = args.repoRoot ?? join(args.intentDir, "..", "..", "..")
	const haikuRoot = join(repoRoot, ".haiku")
	if (isDriftDetectionDisabled(haikuRoot)) {
		return { events: [], scanned: 0, skipped: 0 }
	}
	const events: DriftEvent[] = []
	let scanned = 0
	let skipped = 0

	const stageDir = join(args.intentDir, "stages", args.stage)
	const unitPaths = listUnitsInStage(stageDir)

	// Files the current stage produces (discovery/output `location:` +
	// unit `outputs:`). A witnessed input matching one of these is an
	// in-loop write (the stage's own output), not external/upstream
	// drift — see `stageProducedRelPaths`. Excluded from `input_mutation`
	// so an input==output baton can't re-fire drift on every hat append.
	const stageProducedRel = stageProducedRelPaths(
		args.intentDir,
		args.studio,
		args.stage,
		unitPaths,
	)

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
				// Dual-strategy compare: canonicalized (post-fix) OR
				// legacy raw-body (pre-fix). Avoids false drift on
				// in-flight intents whose witnesses were stamped before
				// the canonicalization fix landed.
				if (existsSync(unitPath) && !bodyMatchesStoredHash(unitPath, stored)) {
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
					// for paths that point outside the intent dir. Then, as a
					// third attempt, normalize away any `.haiku/intents/<slug>/`
					// prefix (legacy bad-shape witnesses produced before
					// 2026-05-17) and resolve THAT intent-relative — primary
					// repo root often misses these because the intent lives in
					// a linked worktree whose branch isn't on primary HEAD.
					const intentRelative = join(args.intentDir, path)
					const repoRelative = join(repoRoot, path)
					let abs: string | null = null
					if (existsSync(intentRelative)) abs = intentRelative
					else if (existsSync(repoRelative)) abs = repoRelative
					else {
						const normalized = normalizeInputPath(path, args.intentDir)
						if (normalized !== path) {
							const normalizedIntentRel = join(args.intentDir, normalized)
							if (existsSync(normalizedIntentRel)) abs = normalizedIntentRel
						}
					}
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
					// hashes align per-extension. For markdown bodies,
					// use the dual-strategy compare so legacy (pre-
					// canonicalization-fix) witnesses don't false-drift.
					const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase()
					const isMarkdown =
						ext === ".md" || ext === ".markdown" || ext === ".mdx"
					const mismatched = isMarkdown
						? !bodyMatchesStoredHash(abs, storedSha)
						: (() => {
								const cur = outputSha256(abs)
								return Boolean(cur) && cur !== storedSha
							})()
					if (mismatched && !stageProducedRel.has(path)) {
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
					// Same three-step resolution as for files (intent-rel,
					// repo-rel, then strip-legacy-prefix-and-retry-intent-rel).
					const intentRelative = join(args.intentDir, dirRel)
					const repoRelative = join(repoRoot, dirRel)
					let dirAbs: string | null = null
					if (existsSync(intentRelative)) {
						dirAbs = intentRelative
					} else if (existsSync(repoRelative)) {
						dirAbs = repoRelative
					} else {
						const normalized = normalizeInputPath(dirRel, args.intentDir)
						const normalizedIntentRel =
							normalized !== dirRel ? join(args.intentDir, normalized) : ""
						if (normalizedIntentRel && existsSync(normalizedIntentRel)) {
							dirAbs = normalizedIntentRel
						}
					}
					// Dir-witness missing-directory FAN-OUT bug (2026-05-18):
					// the prior version fell back to `dirAbs = intentRelative`
					// when the dir didn't resolve, then iterated the stored
					// inventory and emitted `input_deletion` for EVERY file
					// inside (line 437 pre-fix). One missing-dir witness
					// produced N false-positive FBs per sweep, where N was
					// the inventory size at sign time. With the v8→v9
					// migration leaving inventories of ~6 files per affected
					// dir witness, every tick generated ~6 fresh drift FBs
					// that the fix loop closed cosmetically — exactly the
					// "infinite cascade" reported in the
					// haiku-drift-loop-bug bundle. Fix: when the dir doesn't
					// resolve, emit ONE deletion event for the dir itself,
					// not N for its contents. The engine handler then
					// restamps the slot's witness via `buildReviewRecord`
					// which rebuilds from the unit's current `inputs:` —
					// the missing dir gets skipped (resolveInputWitnesses
					// line 359), the inventory is cleared, no further drift.
					if (dirAbs === null) {
						events.push({
							unit: unitName,
							role,
							kind: "input_deletion",
							file: dirRel,
							since: at,
						})
						continue
					}
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
			// Dual-strategy compare for intent.md approvals — same
			// rationale as unit body witnesses above.
			if (!bodyMatchesStoredHash(intentMdPath, stored)) {
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

	// Return EVERY detected event — no FB dedup here.
	//
	// Pre-2026-05-17 this returned a filtered list to suppress
	// re-emission while an open drift FB existed. That belonged to the
	// "agent files the FB" era, where filtering events at sweep time
	// prevented the agent from being re-prompted to file a duplicate.
	//
	// Under engine-internal drift handling, every event has TWO
	// engine-side effects: (a) restamp the witness on the affected
	// (unit, role) slot, and (b) maybe file an FB. The restamp must
	// run on every event — even if an FB is already open for the same
	// (file, kind) — because the file may have shifted again since
	// the FB was filed, and leaving the witness stale would re-trip
	// drift the moment the FB closes. The FB-emit dedup belongs to the
	// engine handler (`engineHandleDriftEvents`), which keys on
	// (file, kind) and skips emission when an open FB matches.
	return { events, scanned, skipped }
}

// Open-drift-FB dedup helper retired 2026-05-17 — moved into
// `drift-handle-events.ts` alongside the FB-emit path, where dedup
// belongs under the engine-internal handling model.
