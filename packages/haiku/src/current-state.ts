// current-state.ts — Unified current-state resolver.
//
// Single source of truth for "where is this intent right now?". Every
// consumer (orchestrator pre-tick, HTTP API, browse SPA via the API)
// reads through this function so the displayed stage and the workflow
// engine can never disagree.
//
// **Stage selection delegates to `findCurrentStage` in cursor.ts** —
// the same function the workflow engine uses to walk its per-stage
// track. This is the contract: whatever stage the cursor sits on is
// the stage the API surfaces. Pre-2026-05-19 this function ran a
// parallel walk based on `deriveStageState` + branch-merge state,
// which produced a *stricter* "done" check than the cursor (the cursor
// moves past a fully-signed stage; the SPA pinned on it until merge).
// Reported in haiku-bug-report-2026-05-19 (round 3) — the stepper
// diamond highlighted INCEPTION while the engine was working on
// DEVELOPMENT.
//
// Phase comes from `deriveStageState` against the active stage —
// elaborate / execute / review / gate. That derivation is also the
// signal the cursor's per-phase handlers route on, so the SPA's
// phase indicator never disagrees with what the cursor will emit next.
//
// intent.md.active_stage is intentionally not read here. It is a
// write-only cache that pre-tick keeps in sync with this derivation
// for legacy shell tooling. Reading it would re-introduce the
// divergence this function exists to eliminate.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	resolveIntentStages,
	resolveStudioStages,
} from "./orchestrator/studio.js"
import {
	computeElaborateSignals,
	findCurrentStage,
	serializeElaborateSignals,
} from "./orchestrator/workflow/cursor.js"
import { deriveStageState } from "./orchestrator/workflow/derived-stage-state.js"
import { intentDir, parseFrontmatter } from "./state-tools.js"
import type { IntentCurrentState, IntentPhase } from "./types.js"

const VALID_PHASES = new Set<IntentPhase>([
	"elaborate",
	"execute",
	"review",
	"gate",
])

function resolveIntentDir(slug: string, root?: string): string {
	return root ? join(root, "intents", slug) : intentDir(slug)
}

function readIntentFm(
	slug: string,
	root?: string,
): Record<string, unknown> | null {
	const intentFile = join(resolveIntentDir(slug, root), "intent.md")
	if (!existsSync(intentFile)) return null
	const { data } = parseFrontmatter(readFileSync(intentFile, "utf8"))
	return data
}

// readStageState removed (v4): per-stage state is derived from
// per-unit FM + branch-merge state via `deriveStageState`. The
// state.json file is migrator-deleted and the engine no longer
// recreates it.

/** Resolve the current state of an intent from per-stage derived state
 *  (v4: per-unit FM + branch-merge state via `deriveStageState`).
 *  Returns null when the intent does not exist or has no studio set
 *  (callers can treat this as "intent not found").
 *
 *  `root` is an optional override used by the test fixture machinery —
 *  production callers omit it and the function reads from the project's
 *  default `.haiku/` location via intentDir(). */
export function getCurrentState(
	slug: string,
	root?: string,
): IntentCurrentState | null {
	const intent = readIntentFm(slug, root)
	if (!intent) return null
	const studio = (intent.studio as string) || ""
	if (!studio) return null
	// Composite intents have their own per-studio state machinery in
	// runNextComposite — this resolver doesn't model that shape. Mirror the
	// pre-tick guard (orchestrator/workflow/pre-tick.ts) and bail out so
	// the API doesn't return a stage from a single-studio walk that
	// doesn't apply.
	if (intent.composite) return null

	const stages = resolveIntentStages(intent, studio)
	const fallbackStages =
		stages.length > 0 ? stages : resolveStudioStages(studio)
	if (fallbackStages.length === 0) {
		return { studio, stage: "", phase: "" }
	}

	const intentMode =
		typeof intent.mode === "string" && (intent.mode as string).length > 0
			? (intent.mode as string)
			: "continuous"
	// Delegate stage selection to the cursor's `findCurrentStage`. Same
	// signal — first stage where `isStageComplete` (every unit's FM signed
	// + every approval role stamped) is false — so the SPA's diamond and
	// the cursor's per-stage track can never disagree. When every stage is
	// complete (intent in completion review or sealed), `findCurrentStage`
	// returns null; surface the final stage so the SPA still has a target
	// stage to render under `/stages/<last>`.
	const cursorStage = findCurrentStage(slug, studio, resolveIntentDir(slug, root))
	const current = cursorStage ?? fallbackStages[fallbackStages.length - 1]

	const derivedCurrent = deriveStageState({
		slug,
		studio,
		stage: current,
		intentDir: resolveIntentDir(slug, root),
		intentMode,
	})
	const rawPhase = derivedCurrent.phase ?? ""
	const phase: IntentPhase | "" = VALID_PHASES.has(rawPhase as IntentPhase)
		? (rawPhase as IntentPhase)
		: ""

	// When the stage is in the elaborate phase, surface the same
	// `signals_unmet[]` list the cursor would emit so the SPA can show
	// the reviewer which sub-signal (conversation / verify_conversation /
	// discovery / decompose / verify_decompose) is currently blocking
	// loop progress.
	let pending_signals: string[] | undefined
	if (phase === "elaborate") {
		const stageDir = join(resolveIntentDir(slug, root), "stages", current)
		const unitsDir = join(stageDir, "units")
		const unitNames = existsSync(unitsDir)
			? readdirSync(unitsDir)
					.filter((n) => n.endsWith(".md"))
					.map((n) => n.replace(/\.md$/, ""))
			: []
		const signals = computeElaborateSignals({
			slug,
			studio,
			stage: current,
			stageDir,
			unitNames,
			mode: intentMode,
		})
		if (signals.length > 0) pending_signals = serializeElaborateSignals(signals)
	}

	return {
		studio,
		stage: current,
		phase,
		...(pending_signals ? { pending_signals } : {}),
	}
}
