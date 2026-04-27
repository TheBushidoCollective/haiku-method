// orchestrator/units.ts — Unit listing + DAG wave computation.
//
// Reads each unit's frontmatter, builds a UnitInfo[] with dependency
// status resolved, and computes DAG waves so the workflow handler
// can fan out parallel work per wave.
//
// Contents:
//   - UnitInfo                 — shape returned to handlers
//   - listUnits                — read all units in a stage
//   - isStagePreExecute        — "no unit has ever completed"
//   - cleanupPreExecuteFeedback — remove legacy FB files in pre-execute
//   - computeUnitWaves         — DAG → wave assignment
//   - currentWaveNumber        — lowest incomplete wave

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { computeWaves } from "../dag.js"
import { parseFrontmatter } from "../state-tools.js"
import type { DAGGraph } from "../types.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

export interface UnitInfo {
	name: string
	status: string
	hat: string
	bolt: number
	dependsOn: string[]
	depsComplete: boolean
}

/** Pre-execute means no unit in the stage has ever reached
 *  `completed`. Semantically: "nothing has been built yet."
 *  Feedback files do not apply here — they track defects on
 *  artifacts that exist, and pre-exec has no artifacts. Any review
 *  rejection at this phase goes inline, not through the persistent
 *  feedback model. */
export function isStagePreExecute(
	intentDirPath: string,
	stage: string,
): boolean {
	const units = listUnits(intentDirPath, stage)
	if (units.length === 0) return true
	return !units.some((u) => u.status === "completed")
}

/** Clean up any legacy feedback files in a pre-execute stage's
 *  feedback/ directory. Intents created before pre-exec-feedback was
 *  removed may have FB-NN.md files left behind; deleting them makes
 *  the state consistent with the new invariant (no FB persistence
 *  pre-execute) and prevents the workflow from re-triggering old
 *  pre-review code paths. */
export function cleanupPreExecuteFeedback(
	intentDirPath: string,
	stage: string,
): string[] {
	if (!isStagePreExecute(intentDirPath, stage)) return []
	const feedbackDir = join(intentDirPath, "stages", stage, "feedback")
	if (!existsSync(feedbackDir)) return []
	const removed: string[] = []
	for (const f of readdirSync(feedbackDir)) {
		if (f.endsWith(".md") && /^\d+-/.test(f)) {
			try {
				rmSync(join(feedbackDir, f), { force: true })
				removed.push(f)
			} catch {
				/* best-effort */
			}
		}
	}
	return removed
}

export function listUnits(intentDirPath: string, stage: string): UnitInfo[] {
	const unitsDir = join(intentDirPath, "stages", stage, "units")
	if (!existsSync(unitsDir)) return []

	const files = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
	const units: UnitInfo[] = files.map((f) => {
		const fm = readFrontmatter(join(unitsDir, f))
		return {
			name: f.replace(".md", ""),
			status: (fm.status as string) || "pending",
			hat: (fm.hat as string) || "",
			bolt: (fm.bolt as number) || 0,
			dependsOn: (fm.depends_on as string[]) || [],
			depsComplete: false,
		}
	})

	const statusMap = new Map(units.map((u) => [u.name, u.status]))
	for (const unit of units) {
		unit.depsComplete = unit.dependsOn.every(
			(dep) => statusMap.get(dep) === "completed",
		)
	}

	return units
}

/** Build a DAGGraph from UnitInfo[] and compute wave assignments.
 *  Returns { waves, unitWave, totalWaves }. */
export function computeUnitWaves(units: UnitInfo[]): {
	waves: Map<number, string[]>
	unitWave: Map<string, number>
	totalWaves: number
} {
	const nodes = units.map((u) => ({ id: u.name, status: u.status }))
	const edges: Array<{ from: string; to: string }> = []
	const adjacency = new Map<string, string[]>()

	for (const u of units) {
		adjacency.set(u.name, [])
	}
	for (const u of units) {
		for (const dep of u.dependsOn) {
			if (!adjacency.has(dep)) continue // cross-stage dep — skip
			edges.push({ from: dep, to: u.name })
			const existing = adjacency.get(dep)
			if (existing) {
				existing.push(u.name)
			}
		}
	}

	const dag: DAGGraph = { nodes, edges, adjacency }
	let waves: Map<number, string[]>
	try {
		waves = computeWaves(dag)
	} catch {
		// Cycle — put all in wave 0 as fallback (cycle should be
		// caught earlier at elaborate→execute via DAG validation)
		waves = new Map([[0, units.map((u) => u.name)]])
	}

	const unitWave = new Map<string, number>()
	let totalWaves = 0
	for (const [wave, names] of waves) {
		for (const name of names) {
			unitWave.set(name, wave)
		}
		if (wave + 1 > totalWaves) totalWaves = wave + 1
	}

	return { waves, unitWave, totalWaves }
}

/** Find the current wave: the lowest wave number that still has
 *  pending units. */
export function currentWaveNumber(
	units: UnitInfo[],
	unitWave: Map<string, number>,
	totalWaves: number,
): number {
	for (let w = 0; w < totalWaves; w++) {
		const hasIncomplete = units.some(
			(u) => unitWave.get(u.name) === w && u.status !== "completed",
		)
		if (hasIncomplete) return w
	}
	return 0
}
