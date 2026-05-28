// orchestrator/studio.ts — Studio + stage + hat resolution.
//
// Pure read helpers that take a studio identifier (dir / name / slug /
// alias — any will resolve via studio-reader's cache) and return:
//   - resolveStudioFilePath        — first existing path in the studio
//                                    search order (project overrides plugin)
//   - resolveIntentStages          — effective stage list (intersection
//                                    of intent.stages allow-list with
//                                    skip_stages deny-list)
//   - resolveStudioStages          — full stage list from STUDIO.md
//   - resolveStageHats             — hat sequence from STAGE.md
//   - resolveStageFixHats          — fix_hats list (private — used here
//                                    + workflow handler imports inline copy)
//   - resolveUnitHatsInStudio      — stage hats + auto-injected
//                                    feedback-assessor when unit has closes:
//   - resolveStageReview           — review-gate type ("auto" / "ask" /
//                                    "external" / compound CSV)
//   - resolveStageMetadata         — STAGE.md description + body

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { resolvePluginRoot } from "../config.js"
import { intentDir, parseFrontmatter } from "../state-tools.js"
import { resolveStudio, studioSearchPaths } from "../studio-reader.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

/** Resolve a studio-scoped file path. Returns the first existing
 *  path found in the studio search order (project overrides plugin),
 *  or null if nothing matches. The path returned is what a subagent
 *  should open — NOT the file content. */
export function resolveStudioFilePath(subpath: string): string | null {
	for (const base of studioSearchPaths()) {
		const full = join(base, subpath)
		if (existsSync(full)) return full
	}
	return null
}

/** Compute the effective stage list for an intent.
 *
 *  `intent.stages` is the CANONICAL, materialized, ordered plan — the
 *  studio's `stages:` is the superset *template*; the intent owns the live
 *  list. It's stamped at mode selection (`haiku_select_mode`) and mutated
 *  only by the engine (e.g. `haiku_drop_stage` removing an optional stage).
 *
 *  Resolution:
 *    1. If `intent.stages` is a non-empty array, it IS the plan — ordered
 *       by itself (drops preserve studio order, so it stays pipeline-valid).
 *       Each entry is guarded against the studio's current stage set: a
 *       stage the studio no longer defines (renamed/removed) is dropped
 *       rather than emitted as a phantom the cursor can't resolve
 *       hats/gates for. This is the tick-time stale-stage guard.
 *    2. If absent/empty (legacy / pre-materialization), fall back to the
 *       studio's full stage list.
 *
 *  The old `skip_stages` deny-list was removed 2026-05-27 — one canonical
 *  list, no second filter. "What got dropped" = `studio.stages − stages`.
 *
 *  Callers that need the full studio list (not intent-filtered) should
 *  call `resolveStudioStages` directly. */
export function resolveIntentStages(
	intent: Record<string, unknown>,
	studio: string,
): string[] {
	const studioStages = resolveStudioStages(studio)
	const explicit = Array.isArray(intent.stages)
		? (intent.stages as string[]).filter((s) => typeof s === "string")
		: []
	if (explicit.length > 0) {
		const studioSet = new Set(studioStages)
		return explicit.filter((s) => studioSet.has(s))
	}
	return studioStages
}

/** Read the intent's CANONICAL stage plan — `intent.stages` as it exists on
 *  intent main (`haiku/<slug>/main`), the fork source every stage branch is
 *  cut from. A diverged stage-branch checkout can carry a stale plan (e.g. the
 *  old buggy `haiku_drop_stage` that wrote the drop to the stage branch instead
 *  of main); main is authoritative. In filesystem mode (no branches) or when
 *  main can't be read, falls back to the working-tree intent.md so behavior is
 *  identical for healthy intents. */
export function resolveCanonicalIntentStages(
	slug: string,
	studio: string,
	workingTreeFm: Record<string, unknown>,
): string[] {
	// Lazy require avoids a static cycle (git-worktree → state-tools → …).
	const { readIntentFileAtMain } = require("../git-worktree.js") as {
		readIntentFileAtMain: (s: string) => string | null
	}
	const mainRaw = readIntentFileAtMain(slug)
	if (mainRaw) {
		const mainFm = parseFrontmatter(mainRaw).data
		return resolveIntentStages(mainFm, studio)
	}
	return resolveIntentStages(workingTreeFm, studio)
}

/** Derive the active stage from the CANONICAL (intent-main) plan, walking it
 *  against on-disk stage-completion. This is the branch-agnostic analog of
 *  `findCurrentStage`: it reads the plan from main so a diverged stage-branch
 *  checkout can't produce a contradictory active stage, but it still judges
 *  completion from the working-tree (fast-forwarded) stage dirs the same way
 *  the cursor does. Returns null when every canonical stage is complete (the
 *  intent is at completion) or the plan is empty. */
export function findCurrentStageFromMain(
	slug: string,
	studio: string,
): string | null {
	const iDir = intentDir(slug)
	const intentFile = join(iDir, "intent.md")
	const workingTreeFm = existsSync(intentFile)
		? parseFrontmatter(readFileSync(intentFile, "utf8")).data
		: {}
	const stages = resolveCanonicalIntentStages(slug, studio, workingTreeFm)
	if (stages.length === 0) return null
	const mode =
		typeof workingTreeFm.mode === "string" && workingTreeFm.mode.length > 0
			? (workingTreeFm.mode as string)
			: "continuous"
	const { isStageComplete } = require("./workflow/cursor.js") as {
		isStageComplete: (
			dir: string,
			studio: string,
			stage: string,
			mode: string,
		) => boolean
	}
	for (const stage of stages) {
		if (!isStageComplete(iDir, studio, stage, mode)) return stage
	}
	return null
}

/** Filter cross-stage references (a stage's `inputs:` entries) to those whose
 *  source stage is still in the intent's plan — the auto-ignore that lets an
 *  optional stage be dropped without orphaning a downstream dependency.
 *
 *  Most downstream paths handle a dropped stage WITHOUT this, because a dropped
 *  optional stage never ran (haiku_drop_stage refuses a started stage) so it
 *  has no artifacts and no `stages/<stage>/` dir: the coverage gate skips a
 *  prior stage whose dir is absent, and `start_unit` injects only resolved
 *  inputs that `.exists`. The one path that needs the explicit filter is the
 *  decompose builder's found/missing split — a dropped-stage input would
 *  otherwise fall into "missing" and emit a false "⚠ Missing Upstream
 *  Artifacts" warning telling the agent to file a stage_revisit at a stage
 *  that isn't in the plan. Filtering by plan first drops it from BOTH sets. */
export function filterInputsByPlanStages<T extends { stage: string }>(
	inputs: readonly T[],
	planStages: readonly string[] | ReadonlySet<string>,
): T[] {
	const set =
		planStages instanceof Set ? planStages : new Set<string>(planStages)
	return inputs.filter((r) => set.has(r.stage))
}

export function resolveStudioStages(studio: string): string[] {
	// Accept any identifier (dir, name, slug, alias); fall back to direct
	// lookup for robustness with legacy callers that pass a dir name already.
	const info = resolveStudio(studio)
	if (info) return info.stages
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const studioFile = join(base, studio, "STUDIO.md")
		if (existsSync(studioFile)) {
			const fm = readFrontmatter(studioFile)
			return (fm.stages as string[]) || []
		}
	}
	return []
}

export function resolveStageHats(studio: string, stage: string): string[] {
	const info = resolveStudio(studio)
	const dir = info ? info.dir : studio
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const stageFile = join(base, dir, "stages", stage, "STAGE.md")
		if (existsSync(stageFile)) {
			const fm = readFrontmatter(stageFile)
			return (fm.hats as string[]) || []
		}
	}
	return []
}

/** Read a stage's STAGE.md frontmatter (project override → plugin). */
function readStageFrontmatter(
	studio: string,
	stage: string,
): Record<string, unknown> {
	const info = resolveStudio(studio)
	const dir = info ? info.dir : studio
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const stageFile = join(base, dir, "stages", stage, "STAGE.md")
		if (existsSync(stageFile)) return readFrontmatter(stageFile)
	}
	return {}
}

/** Whether a stage is optional (STAGE.md `optional: true`). An optional
 *  stage is offered for keep-or-drop the first time the cursor arrives at
 *  it; dropping removes it from `intent.stages` via haiku_drop_stage. */
export function resolveStageOptional(studio: string, stage: string): boolean {
	return readStageFrontmatter(studio, stage).optional === true
}

/** Whether a stage's review gate routes to EXTERNAL review (STAGE.md
 *  `review: external`, or a compound list like `[external, ask]` that
 *  includes it). In `discrete-hybrid` mode this is what marks a stage as
 *  "gets its own PR" — only external-review stages open a per-stage draft
 *  PR; the continuous stages keep their work on the intent-main PR. In
 *  plain `discrete` mode every stage gets one regardless. */
export function stageRequiresExternalReview(
	studio: string,
	stage: string,
): boolean {
	const review = readStageFrontmatter(studio, stage).review
	if (typeof review === "string") return review === "external"
	if (Array.isArray(review)) return review.includes("external")
	return false
}

/** Downstream in-plan stages that reference `stage` via their `inputs:` or
 *  `review-agents-include:`. Drives the "what you're severing" summary shown
 *  when an optional stage is offered for drop — so the decision isn't blind to
 *  the cross-stage references the drop will auto-ignore. */
export function computeStageDependents(
	studio: string,
	stage: string,
	planStages: readonly string[],
): Array<{ stage: string; inputs: string[]; reviewAgents: string[] }> {
	const idx = planStages.indexOf(stage)
	if (idx < 0) return []
	const out: Array<{
		stage: string
		inputs: string[]
		reviewAgents: string[]
	}> = []
	for (const ds of planStages.slice(idx + 1)) {
		const fm = readStageFrontmatter(studio, ds)
		const inputs = Array.isArray(fm.inputs)
			? (
					fm.inputs as Array<{
						stage?: string
						discovery?: string
						output?: string
					}>
				)
					.filter((i) => i.stage === stage)
					.map((i) => i.discovery ?? i.output ?? "?")
			: []
		const reviewAgents = Array.isArray(fm["review-agents-include"])
			? (
					fm["review-agents-include"] as Array<{
						stage?: string
						agents?: string[]
					}>
				)
					.filter((r) => r.stage === stage)
					.flatMap((r) => (Array.isArray(r.agents) ? r.agents : []))
			: []
		if (inputs.length > 0 || reviewAgents.length > 0)
			out.push({ stage: ds, inputs, reviewAgents })
	}
	return out
}

/** Read the ordered studio-level `fix_hats:` list (intent-scope fix
 *  loop). Source order: explicit `fix_hats:` on STUDIO.md frontmatter
 *  if present (so a studio can pin the chain), otherwise alphabetical
 *  filename order from `studios/<studio>/fix-hats/`. Empty result
 *  means the studio doesn't define an intent-scope fix loop and the
 *  cursor cannot dispatch — it surfaces a `user_gate` instead so the
 *  human resolves the finding. */
export function resolveStudioFixHats(studio: string): string[] {
	const info = resolveStudio(studio)
	const dir = info ? info.dir : studio
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const studioFile = join(base, dir, "STUDIO.md")
		if (existsSync(studioFile)) {
			const fm = readFrontmatter(studioFile)
			const declared = fm.fix_hats
			if (Array.isArray(declared) && declared.length > 0) {
				return declared.filter((h): h is string => typeof h === "string")
			}
			break
		}
	}
	// Fallback: enumerate the fix-hats cascade and return the names
	// alphabetically. MUST walk the SAME tiers as `readStudioFixHatPaths`
	// (the per-hat-mandate-file resolver): the global tier (`plugin/fix-hats/`,
	// project `.haiku/fix-hats/`) PLUS the studio tier (`studios/<studio>/
	// fix-hats/`). A global-only fix hat (e.g. the shared `validator` /
	// `reconciler`) must show up in the chain for studios that ship no local
	// copy — otherwise the dispatch sees an empty chain and surfaces a
	// `user_gate` instead of running the intent-completion fix loop. Order is
	// alphabetical regardless of which tier supplied the file, matching the
	// pre-consolidation behavior when every studio carried its own copies.
	const names: string[] = []
	for (const fixHatsDir of [
		join(pluginRoot, "fix-hats"),
		join(process.cwd(), ".haiku", "fix-hats"),
		join(pluginRoot, "studios", dir, "fix-hats"),
		join(process.cwd(), ".haiku", "studios", dir, "fix-hats"),
	]) {
		if (!existsSync(fixHatsDir)) continue
		for (const f of readdirSync(fixHatsDir).filter((f) => f.endsWith(".md"))) {
			const name = f.replace(/\.md$/, "")
			if (!names.includes(name)) names.push(name)
		}
	}
	return names.sort()
}

/** Read the ordered `fix_hats:` list declared on a stage. When set,
 *  pending feedback findings are routed through this sequence
 *  instead of the legacy "draft new units that close feedback" path.
 *  Empty list (or missing field) keeps the legacy behavior. Each
 *  named hat must have a real `hats/{hat}.md` mandate file (validated
 *  at dispatch time); fix hats may live OUTSIDE the main `hats:`
 *  rotation so a `feedback-assessor` hat can exist solely for
 *  fix-mode use without intruding on the execute loop. */
export function resolveStageFixHats(studio: string, stage: string): string[] {
	const info = resolveStudio(studio)
	const dir = info ? info.dir : studio
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const stageFile = join(base, dir, "stages", stage, "STAGE.md")
		if (existsSync(stageFile)) {
			const fm = readFrontmatter(stageFile)
			const fixHats = fm.fix_hats
			if (Array.isArray(fixHats)) return fixHats as string[]
			return []
		}
	}
	return []
}

/** Append `feedback-assessor` as the terminal hat when a unit
 *  declares `closes:` items. Mirrors state-tools.ts's
 *  resolveUnitHats. */
export function resolveUnitHatsInStudio(
	studio: string,
	stage: string,
	slug: string,
	unit: string,
): string[] {
	const stageHats = resolveStageHats(studio, stage)
	const dir = intentDir(slug)
	const unitFile = join(
		dir,
		"stages",
		stage,
		"units",
		unit.endsWith(".md") ? unit : `${unit}.md`,
	)
	if (!existsSync(unitFile)) return stageHats
	try {
		const { data } = parseFrontmatter(readFileSync(unitFile, "utf8"))
		const closes = (data.closes as string[]) || []
		if (closes.length > 0 && !stageHats.includes("feedback-assessor")) {
			return [...stageHats, "feedback-assessor"]
		}
	} catch {
		/* non-fatal */
	}
	return stageHats
}

export function resolveStageReview(studio: string, stage: string): string {
	const info = resolveStudio(studio)
	const dir = info ? info.dir : studio
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const stageFile = join(base, dir, "stages", stage, "STAGE.md")
		if (existsSync(stageFile)) {
			const fm = readFrontmatter(stageFile)
			const review = fm.review
			// Return every declared review kind joined with commas so
			// downstream callers (which use `.includes("external")`,
			// `.includes("ask")`, etc.) see all kinds. Previously this
			// collapsed `[external, ask]` to just `"external"`, silently
			// dropping the "ask" half of the gate.
			if (Array.isArray(review)) return (review as string[]).join(",")
			return (review as string) || "auto"
		}
	}
	return "auto"
}

export function resolveStageMetadata(
	studio: string,
	stage: string,
): {
	description: string
	body: string
} | null {
	const info = resolveStudio(studio)
	const dir = info ? info.dir : studio
	const pluginRoot = resolvePluginRoot()
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const stageFile = join(base, dir, "stages", stage, "STAGE.md")
		if (existsSync(stageFile)) {
			const raw = readFileSync(stageFile, "utf8")
			const fm = readFrontmatter(stageFile)
			const { content } = matter(raw)
			return {
				description: (fm.description as string) || stage,
				body: content.trim(),
			}
		}
	}
	return null
}
