// orchestrator/workflow/heal-optional-stage-divergence.ts
//
// Pre-tick self-repair for a plan divergence left by the pre-2026-05-28 buggy
// `haiku_drop_stage`, which wrote an optional-stage drop to whatever branch
// was checked out (the optional stage's own branch) instead of intent main.
//
// Symptom (the deadlock, reported on `release-healthy-signals`): intent main's
// `intent.stages` still lists an optional stage (e.g. `design`) that the
// stage-branch checkout already dropped. The cursor reads main, so it keeps
// arriving at the still-listed stage and re-offering the keep-or-drop; the
// drop guard (pre-fix, reading the branch) saw it as non-active and refused
// with `drop_stage_not_active`. Loop → deadlock-halt.
//
// Layer 2 already lets the agent's explicit drop succeed (the guard now reads
// the canonical main plan). This gate closes the loop WITHOUT the agent
// re-calling the tool: on tick, it detects the divergence and propagates the
// drop UP to main. The existing downstream sync (mainline → intent main →
// stage) then re-propagates the corrected plan to every branch.
//
// Detection is cheap (two plan reads, no checkout). The write only fires when
// a divergence is actually present, the diverged stage is `optional: true`,
// AND it is unstarted everywhere on disk (no units, no elaboration.md —
// guaranteed for a never-started dropped stage). Idempotent; a no-op for
// healthy intents and in filesystem mode.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { dropStageFromMainPlan, readIntentFileAtMain } from "../../git-worktree.js"
import { intentDir, parseFrontmatter } from "../../state-tools.js"
import { resolveIntentStages, resolveStageOptional } from "../studio.js"

/** Detect + heal an optional-stage plan divergence between intent main and the
 *  current (stage-branch) checkout. Returns the list of stages it healed
 *  (usually empty). Safe to call every tick. */
export function healOptionalStageDivergence(
	slug: string,
	studio: string,
): string[] {
	if (!studio) return []
	const mainRaw = readIntentFileAtMain(slug)
	if (!mainRaw) return [] // fs mode / main unreadable — nothing canonical to heal
	let mainPlan: string[]
	try {
		mainPlan = resolveIntentStages(parseFrontmatter(mainRaw).data, studio)
	} catch {
		return []
	}
	if (mainPlan.length === 0) return []

	const iDir = intentDir(slug)
	const wtFile = join(iDir, "intent.md")
	if (!existsSync(wtFile)) return []
	let wtPlan: string[]
	try {
		wtPlan = resolveIntentStages(
			parseFrontmatter(readFileSync(wtFile, "utf8")).data,
			studio,
		)
	} catch {
		return []
	}
	const wtSet = new Set(wtPlan)

	// Stages present on main but absent from the working-tree plan: the drop
	// landed on a branch and never propagated to main.
	const diverged = mainPlan.filter((s) => !wtSet.has(s))
	if (diverged.length === 0) return []

	const healed: string[] = []
	for (const stage of diverged) {
		// Only OPTIONAL stages are droppable — a mandatory stage missing from a
		// branch plan is a different (corruption) problem, not a buggy drop.
		if (!resolveStageOptional(studio, stage)) continue
		// Unstarted everywhere: a dropped optional stage never ran, so it has no
		// units and no elaboration.md. If either exists the stage carries real
		// work — NOT the buggy-drop case; leave it for the cursor.
		const stageDir = join(iDir, "stages", stage)
		const unitsDir = join(stageDir, "units")
		const hasUnits =
			existsSync(unitsDir) &&
			readdirSync(unitsDir).some((f) => f.endsWith(".md"))
		if (hasUnits || existsSync(join(stageDir, "elaboration.md"))) continue
		if (dropStageFromMainPlan(slug, stage)) healed.push(stage)
	}
	return healed
}
