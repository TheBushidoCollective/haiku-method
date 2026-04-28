// current-state.ts — Unified current-state resolver.
//
// Single source of truth for "where is this intent right now?". Every
// consumer (orchestrator pre-tick, HTTP API, browse SPA via the API)
// reads through this function so the displayed stage and the workflow
// engine can never disagree.
//
// Resolution rule (matches preTickConsistency#syncActiveStageFromStateJson):
//   - Walk the studio-declared stage list in order
//   - First stage whose state.json is NOT done is the current stage
//   - "Done" means status === "completed" AND gate_outcome !== "blocked"
//     (a stage with gate_outcome=blocked is awaiting external review;
//     completion lives in the merge, so the stage is still active per
//     the project's external-gate contract)
//   - If every stage is done, the last stage is current (intent
//     awaiting completion review or fully complete)
//
// intent.md.active_stage is intentionally not read here. It is a
// write-only cache that pre-tick keeps in sync with this derivation
// for legacy shell tooling. Reading it would re-introduce the
// divergence this function exists to eliminate.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	resolveIntentStages,
	resolveStudioStages,
} from "./orchestrator/studio.js"
import { intentDir, parseFrontmatter, readJson } from "./state-tools.js"
import type { IntentCurrentState, IntentPhase, StageState } from "./types.js"

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

function readStageState(
	slug: string,
	stage: string,
	root?: string,
): Partial<StageState> {
	const path = join(resolveIntentDir(slug, root), "stages", stage, "state.json")
	if (!existsSync(path)) return {}
	try {
		return readJson(path) as Partial<StageState>
	} catch {
		return {}
	}
}

/** Resolve the current state of an intent from per-stage state.json.
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

	let current = fallbackStages[fallbackStages.length - 1]
	for (const stage of fallbackStages) {
		const st = readStageState(slug, stage, root)
		const status = (st.status as string) || "pending"
		const gateOutcome = (st.gate_outcome as string) || ""
		const isDone = status === "completed" && gateOutcome !== "blocked"
		if (!isDone) {
			current = stage
			break
		}
	}

	const stageState = readStageState(slug, current, root)
	const rawPhase = (stageState.phase as string) || ""
	const phase: IntentPhase | "" = VALID_PHASES.has(rawPhase as IntentPhase)
		? (rawPhase as IntentPhase)
		: ""

	return {
		studio,
		stage: current,
		phase,
	}
}
