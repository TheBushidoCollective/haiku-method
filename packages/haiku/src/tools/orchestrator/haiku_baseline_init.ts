// tools/orchestrator/haiku_baseline_init.ts — Operator-callable MCP tool that
// explicitly establishes baselines for an intent.
//
// Used by haiku_repair, the kill-switch re-arm flow (AC-G1-KS), and the
// manual rollout path. It is the explicit counterpart to the gate's
// first-tick auto-establish (AC-G8 / unit-04).
//
// DATA-CONTRACTS.md §4.2 governs the input/output shape.
//
// Modes:
//   "establish-all"   — enumerate the entire tracked surface for every stage
//                       in the intent, hash every file, write baseline.json
//                       per stage. Idempotent: files whose SHA already matches
//                       the stored baseline are left untouched.
//   "establish-paths" — baseline only the listed paths. Validates each path
//                       against the tracked surface allow-list. Rejects with
//                       `path_outside_tracked_surface` if a path is
//                       workflow-managed, drift-subsystem-internal, or outside
//                       the intent directory.
//
// No new external dependencies — uses node:crypto, node:fs/promises, node:path
// (already required by drift-baseline.ts) and existing gray-matter.

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import matter from "gray-matter"
import {
	type Baseline,
	type BaselineEntry,
	canonicalisePath,
	computeFileSha256,
	enumerateTrackedSurface,
	getIntentStages,
	isBinary,
	isDriftDetectionDisabled,
	readBaseline,
	type TrackingClass,
	writeBaseline,
} from "../../orchestrator/workflow/drift-baseline.js"
import {
	bodySha256,
	outputSha256,
} from "../../orchestrator/workflow/sign-slot.js"
import { findHaikuRoot } from "../../state-tools.js"
import { defineTool, validateSlugArgs } from "../define.js"
import { text } from "./_text.js"

// ── Internal helpers ───────────────────────────────────────────────────────

/** Check whether a path relative to the intent directory is inside the
 *  tracked surface (same allow-list as haiku_human_write). Returns
 *  `{ ok: true }` on pass or `{ ok: false, reason }` on denial. */
function validateTrackedSurfacePath(
	pathRel: string,
	intentDir: string,
): { ok: true } | { ok: false; reason: "deny_list_match" | "path_escape" } {
	const canonical = canonicalisePath(pathRel)

	// Guard against path traversal / escape.
	const abs = resolve(join(intentDir, canonical))
	const intentAbs = resolve(intentDir)
	if (!abs.startsWith(`${intentAbs}/`) && abs !== intentAbs) {
		return { ok: false, reason: "path_escape" }
	}

	// Reject workflow-managed and drift-subsystem-internal paths.
	const denyPatterns = [
		// Workflow-managed files
		/(?:^|\/)intent\.md$/,
		/(?:^|\/)state\.json$/,
		/(?:^|\/)units\/[^/]+\.md$/,
		/(?:^|\/)feedback\/[^/]+\.md$/,
		// Drift-subsystem internal files (ARCHITECTURE.md §3.1)
		/(?:^|\/)baseline\.json$/,
		/(?:^|\/)drift-markers\.json$/,
		/(?:^|\/)write-audit\.jsonl$/,
		/(?:^|\/)drift-assessments\//,
	]
	for (const pat of denyPatterns) {
		if (pat.test(canonical)) {
			return { ok: false, reason: "deny_list_match" }
		}
	}

	return { ok: true }
}

/** Build a BaselineEntry for a file at `absPath` with canonical key `pathRel`. */
async function buildEntry(
	pathRel: string,
	absPath: string,
	stageOwner: string | null,
	trackingClass: TrackingClass,
): Promise<BaselineEntry> {
	const [sha256, binary] = await Promise.all([
		computeFileSha256(absPath),
		isBinary(absPath),
	])
	const stat = statSync(absPath)
	return {
		path: pathRel,
		sha256,
		bytes: stat.size,
		mtime_ns: Math.round(stat.mtimeMs * 1_000_000),
		is_binary: binary,
		author_class: "agent",
		acknowledged_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
		acknowledged_via: "baseline-init",
		stage: stageOwner,
		tracking_class: trackingClass,
	}
}

/** Re-stamp v4 witness hashes (the drift-sweep signal source) on every
 *  signed slot whose witnessed file matches one of `targetPaths`. The
 *  drift-baseline subsystem (this tool's primary purpose) and the v4
 *  drift-sweep subsystem use independent signals — the baseline tracks
 *  raw file SHAs in baseline.json, the drift-sweep compares
 *  per-slot witness hashes stamped at sign-time (`reviews.<role>.body_sha256`,
 *  `approvals.<role>.witnesses[<path>]`, `discovery.<agent>.{output,mandate}_sha256`).
 *  An agent calling `haiku_baseline_init` after a drift event is
 *  declaring "the current file content IS the new baseline." For that
 *  declaration to silence the drift-sweep gate too, we need to bump the
 *  witness hashes as well. Without this step, baseline_init was a
 *  surface-level acknowledgement that the cursor's Track C kept
 *  ignoring, producing the repeat-drift loop seen in production on
 *  2026-05-12.
 *
 *  Returns a count of slots restamped, for the response payload. The
 *  caller can include this in the user-facing summary so operators
 *  can see whether anything was actually re-stamped.
 */
function restampWitnessesForPaths(
	intentDir: string,
	targetPaths: string[],
): { units_touched: number; slots_restamped: number } {
	if (targetPaths.length === 0) {
		return { units_touched: 0, slots_restamped: 0 }
	}
	// Canonicalise once. The drift-sweep stores witness keys exactly as
	// they were declared on the unit's `outputs:` array — typically
	// either intent-relative (`stages/<X>/.../foo.md`) or repo-relative
	// (`src/components/Foo.tsx`). The target paths passed to this tool
	// are intent-relative (validateTrackedSurfacePath enforces that).
	// We match witness keys against the target set as-is and against
	// their basenames for the rare case where output declarations got
	// abbreviated.
	const targetSet = new Set(targetPaths.map(canonicalisePath))
	const targetBasenames = new Set(
		Array.from(targetSet).map((p) => p.split("/").pop() ?? p),
	)

	let units_touched = 0
	let slots_restamped = 0

	const stagesDir = join(intentDir, "stages")
	if (!existsSync(stagesDir)) {
		return { units_touched, slots_restamped }
	}

	for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
		if (!stageEntry.isDirectory()) continue
		const stage = stageEntry.name
		const unitsDir = join(stagesDir, stage, "units")
		if (!existsSync(unitsDir)) continue

		for (const fName of readdirSync(unitsDir)) {
			if (!fName.endsWith(".md")) continue
			const unitPath = join(unitsDir, fName)
			const unitTouched = restampWitnessesOnFile({
				absPath: unitPath,
				intentDir,
				targetSet,
				targetBasenames,
				stage,
			})
			if (unitTouched.changed) {
				units_touched++
				slots_restamped += unitTouched.slotsRestamped
			}
		}
	}

	// Intent.md (intent-scope approvals) — body_sha256 witnesses get
	// restamped when intent.md itself is in the target list.
	const intentMdRel = "intent.md"
	if (targetSet.has(intentMdRel)) {
		const intentMdAbs = join(intentDir, intentMdRel)
		if (existsSync(intentMdAbs)) {
			const r = restampIntentMdApprovals(intentMdAbs)
			if (r.changed) {
				units_touched++
				slots_restamped += r.slotsRestamped
			}
		}
	}

	return { units_touched, slots_restamped }
}

/** Re-stamp witnesses on one unit file. Walks every signed slot
 *  (reviews / approvals / discovery) and rewrites the witness hash for
 *  any path matching the target set. */
function restampWitnessesOnFile(args: {
	absPath: string
	intentDir: string
	targetSet: Set<string>
	targetBasenames: Set<string>
	stage: string
}): { changed: boolean; slotsRestamped: number } {
	const { absPath, intentDir, targetSet, targetBasenames, stage } = args
	try {
		const raw = readFileSync(absPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>
		let changed = false
		let slotsRestamped = 0

		// reviews.<role>.body_sha256 witnesses the unit body — restamp
		// when the unit file itself is in the target set.
		const unitRel = canonicalisePath(absPath.slice(intentDir.length + 1))
		const unitMatches =
			targetSet.has(unitRel) ||
			targetBasenames.has(unitRel.split("/").pop() ?? "")
		if (unitMatches && fm.reviews && typeof fm.reviews === "object") {
			const newSha = bodySha256(absPath)
			for (const [role, record] of Object.entries(
				fm.reviews as Record<string, unknown>,
			)) {
				if (record === null || typeof record !== "object") continue
				const r = record as Record<string, unknown>
				if (typeof r.at !== "string" || r.at.length === 0) continue
				if (typeof r.body_sha256 !== "string") continue
				if (r.body_sha256 !== newSha) {
					r.body_sha256 = newSha
					changed = true
					slotsRestamped++
				}
				;(fm.reviews as Record<string, unknown>)[role] = r
			}
		}

		// approvals.<role>.witnesses[<path>] — rewrite any entry whose key
		// matches a target path.
		if (fm.approvals && typeof fm.approvals === "object") {
			for (const [role, record] of Object.entries(
				fm.approvals as Record<string, unknown>,
			)) {
				if (record === null || typeof record !== "object") continue
				const r = record as Record<string, unknown>
				if (typeof r.at !== "string" || r.at.length === 0) continue
				const witnesses = r.witnesses
				if (witnesses === null || typeof witnesses !== "object") continue
				const w = witnesses as Record<string, unknown>
				let witnessChanged = false
				for (const [outRel, _stored] of Object.entries(w)) {
					if (typeof _stored !== "string") continue
					const matches =
						targetSet.has(outRel) ||
						targetBasenames.has(outRel.split("/").pop() ?? "")
					if (!matches) continue
					// Same path resolution as drift-sweep / sign-slot.
					const outAbs = outRel.startsWith("stages/")
						? join(intentDir, outRel)
						: join(intentDir, "..", "..", "..", outRel)
					const newSha = outputSha256(outAbs)
					if (newSha && newSha !== _stored) {
						w[outRel] = newSha
						witnessChanged = true
						slotsRestamped++
					}
				}
				if (witnessChanged) {
					r.witnesses = w
					;(fm.approvals as Record<string, unknown>)[role] = r
					changed = true
				}
			}
		}

		// discovery.<agent> output / mandate hashes. Output paths live
		// under `stages/<stage>/discovery/<agent>.md` — we check whether
		// either file path is in the target set.
		if (fm.discovery && typeof fm.discovery === "object") {
			for (const [agent, record] of Object.entries(
				fm.discovery as Record<string, unknown>,
			)) {
				if (record === null || typeof record !== "object") continue
				const r = record as Record<string, unknown>
				if (typeof r.at !== "string" || r.at.length === 0) continue
				const outputRel = `stages/${stage}/discovery/${agent}.md`
				if (
					(targetSet.has(outputRel) || targetBasenames.has(`${agent}.md`)) &&
					typeof r.output_sha256 === "string"
				) {
					const outputAbs = join(intentDir, outputRel)
					const newSha = outputSha256(outputAbs)
					if (newSha && newSha !== r.output_sha256) {
						r.output_sha256 = newSha
						changed = true
						slotsRestamped++
					}
				}
				// Mandate path is under plugin/studios/.../discovery — we
				// don't restamp mandate hashes here because the plugin
				// source is not part of the intent's tracked surface.
				;(fm.discovery as Record<string, unknown>)[agent] = r
			}
		}

		if (changed) {
			writeFileSync(absPath, matter.stringify(parsed.content, fm))
		}
		return { changed, slotsRestamped }
	} catch {
		return { changed: false, slotsRestamped: 0 }
	}
}

/** Re-stamp intent.md approvals' body_sha256 witnesses. */
function restampIntentMdApprovals(absPath: string): {
	changed: boolean
	slotsRestamped: number
} {
	try {
		const raw = readFileSync(absPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>
		if (!fm.approvals || typeof fm.approvals !== "object") {
			return { changed: false, slotsRestamped: 0 }
		}
		let changed = false
		let slotsRestamped = 0
		const newSha = bodySha256(absPath)
		for (const [role, record] of Object.entries(
			fm.approvals as Record<string, unknown>,
		)) {
			if (record === null || typeof record !== "object") continue
			const r = record as Record<string, unknown>
			if (typeof r.at !== "string" || r.at.length === 0) continue
			if (typeof r.body_sha256 !== "string") continue
			if (r.body_sha256 !== newSha) {
				r.body_sha256 = newSha
				changed = true
				slotsRestamped++
			}
			;(fm.approvals as Record<string, unknown>)[role] = r
		}
		if (changed) {
			writeFileSync(absPath, matter.stringify(parsed.content, fm))
		}
		return { changed, slotsRestamped }
	} catch {
		return { changed: false, slotsRestamped: 0 }
	}
}

// ── Tool definition ────────────────────────────────────────────────────────

export default defineTool({
	name: "haiku_baseline_init",
	description:
		"Establish drift-detection baselines for an intent. Used by haiku_repair, the kill-switch re-arm flow, and the manual rollout path. 'establish-all' mode baselines every tracked file across all stages; 'establish-paths' mode baselines only the listed paths. Idempotent — files whose SHA already matches the stored baseline are skipped.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent_slug: {
				type: "string",
				description: "Slug of the intent to baseline.",
			},
			mode: {
				type: "string",
				enum: ["establish-all", "establish-paths"],
				description:
					"'establish-all': scan all tracked files for every stage. 'establish-paths': baseline only the listed paths.",
			},
			paths: {
				type: "array",
				items: { type: "string" },
				description:
					"Required when mode === 'establish-paths'. Paths relative to the intent directory to baseline.",
			},
		},
		required: ["intent_slug", "mode"],
	},

	async handle(args) {
		// ── Input validation ─────────────────────────────────────────────────
		const slug = args.intent_slug as string
		const mode = args.mode as "establish-all" | "establish-paths"
		const pathsArg = args.paths as string[] | undefined

		// Validate slug for path-traversal characters.
		const slugCheck = validateSlugArgs({ intent: slug })
		if (slugCheck) return slugCheck

		if (mode === "establish-paths" && (!pathsArg || pathsArg.length === 0)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								ok: false,
								code: "paths_required",
								message:
									"'paths' is required and must be non-empty when mode is 'establish-paths'.",
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// ── Resolve intent directory ─────────────────────────────────────────
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
								code: "intent_not_found",
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

		// ── Check for archived intent (409 intent_not_active) ────────────────
		try {
			const { data: intentFm } = matter(readFileSync(intentMd, "utf8"))
			if ((intentFm as Record<string, unknown>).archived === true) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									ok: false,
									code: "intent_not_active",
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
		} catch {
			// Proceed — intent.md parse failure is not a blocking error here.
		}

		// ── Kill-switch awareness (AC-G1-KS) ─────────────────────────────────
		// The tool is safe to call when drift_detection: false.
		// It still establishes the baseline but warns the caller.
		const driftDisabled = isDriftDetectionDisabled(root)

		// ── Shared tracking counters ──────────────────────────────────────────
		let baselines_created = 0
		let baselines_skipped_existing = 0
		const tracking_class_counts: Record<TrackingClass, number> = {
			"stage-output": 0,
			knowledge: 0,
			"unit-output": 0,
			"intent-meta": 0,
		}

		// ── establish-all mode ────────────────────────────────────────────────
		if (mode === "establish-all") {
			const stages = getIntentStages(intentDir)

			if (stages.length === 0) {
				const result: Record<string, unknown> = {
					ok: true,
					intent_slug: slug,
					baselines_created: 0,
					baselines_skipped_existing: 0,
					tracking_classes: {
						"stage-output": 0,
						knowledge: 0,
						"unit-output": 0,
						"intent-meta": 0,
					},
					warning: "tracked_surface_empty: no stages found for this intent.",
				}
				if (driftDisabled) {
					result.drift_disabled_warning =
						"drift_detection is currently false in settings.yml. The baseline was established, but the drift-detection gate remains a no-op until drift_detection is re-enabled."
				}
				return text(JSON.stringify(result, null, 2))
			}

			for (const stage of stages) {
				const surfaceEntries = enumerateTrackedSurface(intentDir, stage)
				if (surfaceEntries.length === 0) continue

				const baseline: Baseline = readBaseline(intentDir, stage) ?? {
					entries: new Map(),
				}

				// Hash all files concurrently.
				const results = await Promise.all(
					surfaceEntries.map(async (entry) => {
						const existing = baseline.entries.get(entry.pathRel)
						if (existing !== undefined) {
							// Already baselined — check current SHA for idempotency.
							try {
								const currentSha = await computeFileSha256(entry.absPath)
								if (currentSha === existing.sha256) {
									return { action: "skipped" as const, entry }
								}
							} catch {
								return { action: "skipped" as const, entry }
							}
						}
						try {
							const newEntry = await buildEntry(
								entry.pathRel,
								entry.absPath,
								entry.stageOwner,
								entry.trackingClass,
							)
							return { action: "created" as const, entry, newEntry }
						} catch {
							return { action: "skipped" as const, entry }
						}
					}),
				)

				let changed = false
				const newEntries = new Map(baseline.entries)
				for (const r of results) {
					if (r.action === "created" && r.newEntry) {
						newEntries.set(r.newEntry.path, r.newEntry)
						baselines_created++
						tracking_class_counts[r.entry.trackingClass]++
						changed = true
					} else {
						baselines_skipped_existing++
					}
				}
				if (changed) {
					await writeBaseline(intentDir, stage, { entries: newEntries })
				}
			}

			const isEmpty =
				baselines_created === 0 && baselines_skipped_existing === 0
			const result: Record<string, unknown> = {
				ok: true,
				intent_slug: slug,
				baselines_created,
				baselines_skipped_existing,
				tracking_classes: tracking_class_counts,
			}
			if (isEmpty) {
				result.warning =
					"tracked_surface_empty: no tracked files found for this intent."
			}
			if (driftDisabled) {
				result.drift_disabled_warning =
					"drift_detection is currently false in settings.yml. The baseline was established, but the drift-detection gate remains a no-op until drift_detection is re-enabled."
			}
			return text(JSON.stringify(result, null, 2))
		}

		// ── establish-paths mode ─────────────────────────────────────────────
		const paths = pathsArg as string[]

		// Validate ALL paths before writing anything (fail-fast).
		for (const p of paths) {
			const check = validateTrackedSurfacePath(p, intentDir)
			if (!check.ok) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									ok: false,
									code: "path_outside_tracked_surface",
									reason: check.reason,
									path: p,
									message:
										check.reason === "path_escape"
											? `Path '${p}' resolves outside the intent directory.`
											: `Path '${p}' is workflow-managed, drift-subsystem-internal, or otherwise not in the tracked surface.`,
								},
								null,
								2,
							),
						},
					],
					isError: true,
				}
			}
		}

		// Group paths by owning stage for efficient baseline updates.
		const stageToUpdates = new Map<
			string,
			Array<{
				pathRel: string
				absPath: string
				trackingClass: TrackingClass
				stageOwner: string | null
			}>
		>()

		const intentStages = getIntentStages(intentDir)
		const fallbackStage = intentStages[0] ?? "development"

		for (const p of paths) {
			const canonical = canonicalisePath(p)
			const absPath = join(intentDir, canonical)

			if (!existsSync(absPath)) continue

			// Infer tracking class and stage owner from canonical path segments.
			let trackingClass: TrackingClass = "knowledge"
			let stageOwner: string | null = null

			const stageMatch = canonical.match(/^stages\/([^/]+)\//)
			if (stageMatch) {
				stageOwner = stageMatch[1]
				// Artifacts (canonical) or outputs (alias already canonicalised).
				if (canonical.includes(`stages/${stageOwner}/artifacts/`)) {
					trackingClass = "stage-output"
				} else {
					trackingClass = "knowledge"
				}
			}

			// Use stageOwner for stage-scoped files; fall back to first stage
			// for intent-scope knowledge/ files.
			const baselineStage = stageOwner ?? fallbackStage

			const group = stageToUpdates.get(baselineStage) ?? []
			group.push({ pathRel: canonical, absPath, trackingClass, stageOwner })
			stageToUpdates.set(baselineStage, group)
		}

		// Restamp v4 drift-sweep witnesses for the listed paths BEFORE
		// the baseline.json writes. The witness re-stamp closes the
		// drift-sweep loop in one call: after this returns, the cursor's
		// Track C compares the witness against current content and finds
		// no mismatch, so it stops emitting `drift_detected` for the
		// listed paths.
		const witnessResult = restampWitnessesForPaths(intentDir, paths)

		// Write each stage's baseline.
		for (const [stage, updates] of stageToUpdates.entries()) {
			const baseline: Baseline = readBaseline(intentDir, stage) ?? {
				entries: new Map(),
			}

			const results = await Promise.all(
				updates.map(async (upd) => {
					const existing = baseline.entries.get(upd.pathRel)
					if (existing !== undefined) {
						try {
							const currentSha = await computeFileSha256(upd.absPath)
							if (currentSha === existing.sha256) {
								return { action: "skipped" as const, upd }
							}
						} catch {
							return { action: "skipped" as const, upd }
						}
					}
					try {
						const newEntry = await buildEntry(
							upd.pathRel,
							upd.absPath,
							upd.stageOwner,
							upd.trackingClass,
						)
						return { action: "created" as const, upd, newEntry }
					} catch {
						return { action: "skipped" as const, upd }
					}
				}),
			)

			const newEntries = new Map(baseline.entries)
			let changed = false
			for (const r of results) {
				if (r.action === "created" && r.newEntry) {
					newEntries.set(r.newEntry.path, r.newEntry)
					baselines_created++
					tracking_class_counts[r.upd.trackingClass]++
					changed = true
				} else {
					baselines_skipped_existing++
				}
			}
			if (changed) {
				await writeBaseline(intentDir, stage, { entries: newEntries })
			}
		}

		const result: Record<string, unknown> = {
			ok: true,
			intent_slug: slug,
			baselines_created,
			baselines_skipped_existing,
			tracking_classes: tracking_class_counts,
			witnesses_restamped: witnessResult.slots_restamped,
			units_touched_by_witness_restamp: witnessResult.units_touched,
		}
		if (driftDisabled) {
			result.drift_disabled_warning =
				"drift_detection is currently false in settings.yml. The baseline was established, but the drift-detection gate remains a no-op until drift_detection is re-enabled."
		}
		return text(JSON.stringify(result, null, 2))
	},
})
