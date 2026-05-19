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

import { existsSync, readFileSync, readdirSync } from "node:fs"
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
 *  Resolution order:
 *    1. Start with the studio's full stage list (from STUDIO.md).
 *    2. If `intent.stages` is an explicit non-empty array, intersect
 *       with studio stages (preserves studio order; rejects unknown
 *       stages). This is how `/haiku:quick` restricts a multi-stage
 *       studio to a single stage without enumerating skip_stages.
 *    3. Apply `intent.skip_stages` filter on the result.
 *
 *  Callers that need the full studio list (not intent-filtered)
 *  should call `resolveStudioStages` directly. */
export function resolveIntentStages(
	intent: Record<string, unknown>,
	studio: string,
): string[] {
	const studioStages = resolveStudioStages(studio)
	const explicit = Array.isArray(intent.stages)
		? (intent.stages as string[])
		: []
	const allowed = explicit.length > 0 ? new Set(explicit) : null
	const skipStages = (intent.skip_stages as string[]) || []
	return studioStages.filter((s) => {
		if (allowed && !allowed.has(s)) return false
		if (skipStages.includes(s)) return false
		return true
	})
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
	// Fallback: enumerate the studio's fix-hats directory and return
	// the names alphabetically. Same source-of-truth as
	// `readStudioFixHatPaths` (the per-hat-mandate-file resolver).
	const names: string[] = []
	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const fixHatsDir = join(base, dir, "fix-hats")
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
