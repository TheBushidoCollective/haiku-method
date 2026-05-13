// orchestrator/workflow/run-tick.ts — v4 workflow tick.
//
// One-time idempotent fixups only: read disk → run migrators if
// needed → run pre-tick self-repair → call cursor.derivePosition →
// map CursorAction to OrchestratorAction → return. The migrator and
// the self-repair gate both write to disk, but they're idempotent:
// repeated ticks against the same disk state produce the same answer
// (and skip the writes if there's nothing to fix). The cursor walk
// itself never mutates.
//
// Replaces v3's "derive-state → handler dispatch with mutating
// pre-tick repair" chain. The cursor walks Track C (drift) → Track B
// (feedback) → Track A (intent) on every call and returns the next
// instruction. Bolt counts, status flags, and hat positions are all
// derived from on-disk frontmatter.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { broadcastIntent } from "../../intent-broadcaster.js"
import type { OrchestratorAction } from "../../orchestrator.js"
import { intentDir } from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import { getPluginVersion } from "../../version.js"
import { migrateIntent } from "../migrate-registry.js"
// Importing the migrator files for their side effect:
// registerMigrator runs at module load and adds edges to the
// registry. v0→v4 covers pre-v4 intents; v4→v5 is a schema-noop
// stamp for the 4.x → 5.0.0 user-facing-only major bump (see
// v4-to-v5.ts for the why).
import "../migrations/v0-to-v4.js"
import "../migrations/v4-to-v5.js"
import { hasV3CruftInIntent } from "../migrations/v0-to-v4.js"
import {
	type CursorAction,
	type CursorPosition,
	derivePosition,
} from "./cursor.js"
import { recordTickResult } from "./deadlock-detector.js"
import { selfRepairMissingApprovals } from "./self-repair-approvals.js"

/** Result of a single workflow tick. */
export interface WorkflowTickResult {
	readonly position: CursorPosition
	readonly action: OrchestratorAction | null
}

/**
 * Drive one workflow tick and return the next OrchestratorAction.
 * Disk writes are bounded to the migrator (v3 → v4 fixup) and the
 * pre-tick self-repair gate (stamps missing review/approval fields
 * on partially-migrated intents). Both are idempotent — re-running
 * on already-fixed disk state is a no-op.
 */
export function runWorkflowTick(
	slug: string,
	root?: string,
): WorkflowTickResult | null {
	// `intentDir` resolves against the current haiku root (cwd-driven).
	// `root` is forwarded to migrateIntent below as repoRoot for ctx;
	// the cursor walk itself is cwd-driven via intentDir. Tests typically
	// chdir into a fixture root before calling runWorkflowTick.
	// Sad-path guard: `intentDir(slug)` walks up from cwd to find a
	// `.haiku/` directory and throws if none exists. Return null so
	// `dispatchOrchestratorAction` can surface a structured "intent
	// not found" error instead of letting a stray throw bubble out
	// of every haiku_run_next call placed outside an initialized
	// project.
	let iDir: string
	try {
		iDir = intentDir(slug)
	} catch {
		return null
	}
	const intentMdPath = join(iDir, "intent.md")
	if (!existsSync(intentMdPath)) return null

	// Migrators: stamp the intent at the current plugin version, run
	// any needed transforms. Idempotent — once stamped, this is a no-op.
	//
	// Gating rule: only run migrators when the running plugin is v4 or
	// later. Pre-v4 plugin builds (3.x) coexist with un-migrated v0
	// intents and should leave them alone. CI auto-bumps the plugin
	// version on merge to main; once a v4.x build ships, this gate
	// flips and every intent gets migrated on first read.
	const target = getPluginVersion()
	const targetMajor = Number(target.split(".")[0] ?? "0")
	let intentFm = parseIntentFm(intentMdPath)
	if (targetMajor >= 4) {
		const sourceVersion =
			typeof intentFm.plugin_version === "string"
				? (intentFm.plugin_version as string)
				: "0"
		// Compare by major version only. The migrate registry has edges
		// keyed by major (`"0" → "4.0.0"`), not full semver. CI auto-
		// bumps the patch on every merge to main, so an exact compare
		// (`sourceVersion !== target`) would fire `migrateIntent("4.0.0",
		// "4.0.1")` after the first post-ship bump → `findChain` finds
		// no edge → throws → every tick on every v4 intent returns
		// `action: "error"`. Compare majors and skip migration when
		// they match. This means a same-major intent stays on disk with
		// `plugin_version: "4.0.0"` even when the running plugin is
		// `4.0.1`; that's intentional — the FM stamp marks the schema
		// generation, not the build that last touched it.
		const sourceMajor = Number(sourceVersion.split(".")[0] ?? "0") || 0
		// Force re-migration when the major matches but v3 cruft survived
		// into the tree. This catches the post-merge case where a stage
		// branch's v4 intent.md merges into main but v3 unit/feedback/
		// state.json files come back from main's pre-migration state.
		// Without this branch, intent.md's `plugin_version: "4.0.0"`
		// would short-circuit the gate and the v3 files would sit forever.
		// hasV3CruftInIntent scans intent.md, every unit file under
		// every stage, and the state.json sentinel — the per-tick cost
		// is bounded by the intent's unit count. We walk every unit
		// (not just the first) so a partial migration that stamped
		// some units v4 but left others v3 still triggers re-migration.
		const v3CruftPresent =
			sourceMajor === targetMajor && hasV3CruftInIntent(iDir)
		if (sourceMajor !== targetMajor || v3CruftPresent) {
			// Use the major's canonical schema anchor (e.g. "4.0.0"),
			// not the running build version (e.g. "4.0.2"). The
			// migration registry edges are keyed by schema generation
			// (one edge per schema bump), not by build patch — CI
			// auto-bumps the patch on every merge to main but those
			// don't change the schema. Without this, users upgrading
			// from v3 on any v4.0.x build > 4.0.0 hit "no migration
			// path from 0 to 4.0.x" and the migration fails entirely.
			// Reported 2026-05-08 by a user upgrading on v4.0.2.
			const schemaTarget = `${targetMajor}.0.0`
			// When forcing re-migration due to v3 cruft, override
			// sourceVersion to "0". The migrate registry indexes edges
			// by version pair; with `from === to` (e.g. "4.0.0" → "4.0.0")
			// findChain returns no migrators and the cleanup never runs.
			// Treating the cruft-bearing tree as if it were on "0"
			// re-fires the v0→4.0.0 edge — which is idempotent on
			// already-migrated files (writing v4 fields to a v4 file is
			// a no-op) but cleans up any stranded v3 fields.
			const effectiveSourceVersion = v3CruftPresent ? "0" : sourceVersion
			try {
				const migrateResult = migrateIntent(
					{ intentDir: iDir, repoRoot: root ?? "" },
					effectiveSourceVersion,
					schemaTarget,
				)
				intentFm = parseIntentFm(intentMdPath)
				// Surface what the migrator did to the agent BEFORE the
				// next cursor walk. Without this, the agent sees deleted
				// state.json / baseline.json / drift-markers.json files in
				// `git status` and incorrectly tells the user data was
				// lost — when in reality the relevant signals (completed-
				// unit approvals, iteration history, feedback closure) are
				// preserved in unit/feedback frontmatter, and the deleted
				// files are v3-only artifacts v4 doesn't read or write.
				if (migrateResult.steps > 0) {
					const d = migrateResult.details
					const lines: string[] = []
					if (v3CruftPresent) {
						lines.push(
							`Re-migrated intent '${slug}' to '${schemaTarget}' — v3-shape frontmatter survived a merge into the otherwise-migrated tree (likely a stage merge into intent main from a pre-migration branch). The migrator is idempotent on already-v4 files; the v3 cruft has been cleaned up.`,
						)
					} else {
						lines.push(
							`Migrated intent '${slug}' from plugin_version='${sourceVersion}' to '${schemaTarget}'.`,
						)
					}
					lines.push("")
					lines.push("**What changed on disk** (this is intentional):")
					if (d.intent_md_migrated) {
						lines.push(
							"- `intent.md` frontmatter rewritten — deprecated v3 fields stripped, v4 schema applied",
						)
					}
					if (d.units_migrated > 0) {
						const synth =
							d.units_with_synthesized_approval > 0
								? ` (${d.units_with_synthesized_approval} had \`status: completed\` → backfilled \`reviews.<role>.at\` and \`approvals.<role>.at\` stamps so the cursor treats them as fully done — without these stamps the cursor would re-emit per-role review/approval actions on every tick. Discovery is NOT backfilled: the cursor reads the artifact on disk, and v3 already wrote it.)`
								: ""
						lines.push(`- ${d.units_migrated} unit file(s) migrated${synth}`)
					}
					if (d.feedback_migrated > 0) {
						const synth =
							d.feedback_with_synthesized_closure > 0
								? `; ${d.feedback_with_synthesized_closure} had a terminal v3 status → synthesized \`closed_at\``
								: ""
						const reloc =
							d.feedback_relocated > 0
								? `; ${d.feedback_relocated} relocated to their upstream stage (v4 routes feedback by file location, not by frontmatter hint)`
								: ""
						lines.push(
							`- ${d.feedback_migrated} feedback file(s) migrated${synth}${reloc}`,
						)
					}
					if (d.state_json_deleted > 0) {
						lines.push(
							`- ${d.state_json_deleted} stage \`state.json\` file(s) deleted — v4 derives stage position from disk (unit files on intent main in git mode, per-unit signature state in fs mode), not from state.json`,
						)
					}
					if (d.drift_artifacts_deleted > 0) {
						lines.push(
							`- ${d.drift_artifacts_deleted} drift artifact(s) deleted (\`baseline.json\` / \`drift-markers.json\` / \`baseline-content/\`) — v4 uses \`body_sha256\` stamped on each signed slot's frontmatter, no separate baseline manifest needed`,
						)
					}
					lines.push("")
					lines.push("**What was preserved**:")
					lines.push(
						"- Intent: title, description, mode, studio, started_at, follows",
					)
					lines.push(
						"- Units: title, body, inputs, outputs, depends_on, quality_gates, model, started_at, **iterations[]** (the bolt/hat history)",
					)
					lines.push(
						"- Feedback: title, body, origin, author, source_ref, attachment, **iterations[]**, **replies[]**",
					)
					lines.push("")
					lines.push("**What v4 derives instead of stores**:")
					lines.push(
						"- Active stage: derived by walking intent main's filesystem (`findCurrentStage` reads per-stage unit FM)",
					)
					lines.push("- Current phase: decided per-tick by the cursor walk")
					lines.push(
						"- Unit progress: read from `iterations[]` (the last entry's `result` and `hat`)",
					)
					lines.push("")
					lines.push(
						`If anything looks broken, run \`haiku_run_next { intent: "${slug}" }\` again — the cursor will pick up where v3 left off. The downgrade-or-redrive advice you might be tempted to give the user is wrong: the data is intact in the new shape.`,
					)
					return broadcastTick(slug, {
						position: { track: "intent", action: null },
						action: {
							action: "migrated",
							intent: slug,
							message: lines.join("\n"),
						},
					})
				}
			} catch (err) {
				emitTelemetry("haiku.migrate.failed", {
					intent: slug,
					from: sourceVersion,
					to: schemaTarget,
					error: String((err as Error)?.message ?? err),
				})
				return {
					position: {
						track: "intent",
						// Migration error path — `role` is required by the
						// CursorAction shape but the outer `action: "error"`
						// is what the agent actually surfaces. "spec" is the
						// most generic role and never targets per-stage work.
						action: { kind: "intent_review", role: "spec" },
					},
					action: {
						action: "error",
						intent: slug,
						message: `Migration from plugin_version='${sourceVersion}' to '${schemaTarget}' failed: ${String((err as Error)?.message ?? err)}. Resolve manually before continuing.`,
					},
				}
			}
		}
	}

	// Pre-cursor selection gates. Each emits a structured `select_*`
	// action when the corresponding field is missing on intent.md.
	// haiku_run_next intercepts these, runs the SPA picker inline,
	// writes the chosen value, and re-ticks — so the agent never sees
	// a "Call haiku_select_*" instruction. The tick simply blocks until
	// the user picks. Direct callers (tests, foreign callers of
	// runWorkflowTick) get the structured action and can decide how to
	// handle it.
	const studio = (intentFm.studio as string) || ""
	if (!studio) {
		return {
			position: { track: "intent", action: null },
			action: {
				action: "select_studio",
				intent: slug,
				message: `Intent '${slug}' has no studio.`,
			},
		}
	}

	const mode = (intentFm.mode as string) || ""
	if (!mode) {
		return {
			position: { track: "intent", action: null },
			action: {
				action: "select_mode",
				intent: slug,
				message: `Intent '${slug}' has no mode.`,
			},
		}
	}

	const stages = Array.isArray(intentFm.stages)
		? (intentFm.stages as unknown[])
		: []

	if (mode === "quick" && stages.length === 0) {
		return {
			position: { track: "intent", action: null },
			action: {
				action: "select_stage",
				intent: slug,
				message: `Intent '${slug}' is in quick mode with no stage selected.`,
			},
		}
	}

	// Pre-tick self-repair: synthesize missing review/approval stamps
	// on stages whose units look iteration-complete but carry no
	// approval bookkeeping AND have demonstrably been moved past
	// (later stage has on-disk work). This catches migrated intents
	// whose v0→v4 backfill never landed on the cursor-reachable copy
	// of the unit files (e.g., migration ran on intent main but the
	// writes were scattered to another branch by an auto-commit during
	// stage-branch alignment, never reaching the disk view the cursor
	// walks). Without this, the cursor pins on stage N forever,
	// re-emitting `dispatch_review(spec)` while the agent has nowhere
	// to land the stamps.
	//
	// Safe to run every tick — no-op when stamps are already present
	// or when no later stage has work.
	try {
		const repairResult = selfRepairMissingApprovals(iDir, studio, mode)
		if (repairResult.stagesRepaired.length > 0) {
			emitTelemetry("haiku.self_repair.applied", {
				intent: slug,
				stages_repaired: repairResult.stagesRepaired.join(","),
				units_touched: String(repairResult.unitsTouched),
				reviews_added: String(repairResult.reviewsAdded),
				approvals_added: String(repairResult.approvalsAdded),
			})
		}
	} catch (err) {
		// Self-repair is opportunistic; if it fails (corrupt unit FM,
		// studio config gone), let the cursor walk surface the real
		// error.
		emitTelemetry("haiku.self_repair.failed", {
			intent: slug,
			error: String((err as Error)?.message ?? err),
		})
	}

	// Cursor walk — pure read of the current working tree. Pre-tick
	// branch reconciliation has already aligned the tree to the active
	// stage branch (with main merged in), so the walk's disk view IS
	// the authoritative state.
	const position = derivePosition({
		slug,
		intentDir: iDir,
		studio,
	})
	const action = position.action
		? cursorActionToOrchestratorAction(slug, position.action)
		: null

	return broadcastTick(slug, { position, action })
}

/**
 * Convenience entrypoint: drive a tick and surface the OrchestratorAction
 * (or a stable error). Used by haiku_run_next.
 */
export function dispatchOrchestratorAction(
	slug: string,
	root?: string,
): OrchestratorAction {
	const tick = runWorkflowTick(slug, root)
	if (!tick) {
		return { action: "error", message: `Intent '${slug}' not found` }
	}
	if (tick.action) return tick.action
	// null action = mid-wave noop. Surface as a stable "wait for
	// outstanding subagents" signal so the parent doesn't loop on it.
	return {
		action: "noop",
		intent: slug,
		message: `Mid-wave noop. In-flight subagents are still working — wait for them to terminate, then retick.`,
	}
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseIntentFm(path: string): Record<string, unknown> {
	const raw = readFileSync(path, "utf8")
	const parsed = matter(raw)
	return parsed.data as Record<string, unknown>
}

/**
 * Map a CursorAction to the OrchestratorAction shape every legacy
 * caller expects. The `action` field is the cursor's `kind`; the rest
 * of the discriminated union spreads as-is.
 */
function cursorActionToOrchestratorAction(
	slug: string,
	cursor: CursorAction,
): OrchestratorAction {
	return {
		...cursor,
		action: cursor.kind,
		intent: slug,
	} as OrchestratorAction
}

/** Wrap a tick result with a broadcast to the per-intent live-state
 *  pub/sub AND register it with the inter-tick deadlock detector.
 *  Every return path from runWorkflowTick funnels through here, so
 *  the detector sees every action — including early-return paths
 *  (migration banner, select_* gates, sealed shortcut, error paths). */
function broadcastTick(
	slug: string,
	result: WorkflowTickResult,
): WorkflowTickResult {
	if (result.action) {
		broadcastIntent(slug, {
			type: "tick_committed",
			action: (result.action as { action?: string }).action ?? "unknown",
		})
	}
	// Inter-tick deadlock detection. The same OrchestratorAction
	// emitted across consecutive ticks (or an A/B/A/B alternation)
	// surfaces a `haiku.deadlock.suspected` / `haiku.deadlock.churn_suspected`
	// telemetry signal. Doesn't change behavior — pure observability.
	recordTickResult(
		slug,
		result.action as unknown as Record<string, unknown> | null,
	)
	return result
}

// v3 compatibility shims — kept transiently so callers that imported
// these names continue to type-check. M3 prompt audit will remove
// them when the new dispatch tools land.
export const WORKFLOW_STATES: ReadonlyArray<string> = []
export function dispatchHandler(): null {
	return null
}
