// tools/orchestrator/haiku_write_brief.ts — write the current stage's
// user-facing BRIEF.md.
//
// The briefer subagent calls this during the `write_brief` cursor action and
// supplies ONLY the prose body. EVERYTHING else is engine-owned — this tool is
// only ever called in-flow, so the engine already knows where it is:
//   - intent: resolved from the current branch (`haiku/<slug>/…`), or the sole
//     active intent in filesystem mode.
//   - stage: the branch's stage segment when on a stage branch, else the
//     cursor's current stage (`findCurrentStage`).
//   - phase: `pre` when no BRIEF.md exists yet ("what I'm going to do"), `post`
//     when rewriting the existing one ("what I did" — the closing brief). This
//     mirrors the two-gate model: `stageOwesBrief` fires only when BRIEF.md is
//     ABSENT, `stageOwesClosingBrief` only when it EXISTS with `phase != post`.
//
// Frontmatter is written via gray-matter (`matter.stringify`) — never a
// hand-rolled `---` block.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { findCurrentStage } from "../../orchestrator/workflow/cursor.js"
import {
	HAIKU_WRITE_BRIEF_INPUT_SCHEMA,
	validateHaikuWriteBriefInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import {
	findHaikuRoot,
	gitCommitState,
	intentFromCurrentBranch,
	isGitRepo,
	listVisibleIntents,
	parseFrontmatter,
} from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

function err(code: string, message: string) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{ error: code, tool: "haiku_write_brief", message },
					null,
					2,
				),
			},
		],
		isError: true,
	}
}

export default defineTool({
	name: "haiku_write_brief",
	description:
		"Write the current stage's user-facing BRIEF.md. Supply ONLY the markdown body (no frontmatter, no intent, no stage). The engine resolves the intent + stage from the current cursor position and stamps the `phase:` frontmatter itself — `pre` for the first write (the plan) and `post` when rewriting the existing brief at stage finish (what shipped). Called in-flow during the `write_brief` cursor action; the action's `phase` tells you which prose to write, but you never specify it.",
	inputSchema: jsonSchemaOf(HAIKU_WRITE_BRIEF_INPUT_SCHEMA),
	handle(args) {
		const validation = validateToolInput(
			args as Record<string, unknown>,
			validateHaikuWriteBriefInputSchema,
			"haiku_write_brief",
		)
		if (validation) return validation

		const body = args.body as string

		// Resolve the intent from the current cursor position — the branch in a
		// git repo, the sole active intent in filesystem mode. The engine never
		// takes intent/stage from the agent here.
		const branchInfo = intentFromCurrentBranch()
		let slug = branchInfo?.slug ?? ""
		if (!slug && !isGitRepo()) {
			const intentsDir = join(findHaikuRoot(), "intents")
			const active = existsSync(intentsDir)
				? listVisibleIntents(intentsDir).filter(
						(i) => (i.data.status as string) !== "completed",
					)
				: []
			if (active.length === 1) slug = active[0].slug
		}
		if (!slug) {
			return err(
				"write_brief_no_active_intent",
				"Could not resolve the active intent. haiku_write_brief is only called in-flow — switch to the intent branch (`haiku/<slug>/main` or `haiku/<slug>/<stage>`) and let the engine drive the write_brief action.",
			)
		}

		const root = findHaikuRoot()
		const intentDir = join(root, "intents", slug)
		const intentMd = join(intentDir, "intent.md")
		if (!existsSync(intentMd)) {
			return err("intent_not_found", `Intent '${slug}' not found.`)
		}

		// Resolve the stage: the branch's stage segment when on a stage branch,
		// else the cursor's current stage.
		const intentFm = parseFrontmatter(readFileSync(intentMd, "utf8")).data ?? {}
		const studio = (intentFm.studio as string) || ""
		const stage = branchInfo?.stage ?? findCurrentStage(slug, studio, intentDir)
		if (!stage) {
			return err(
				"write_brief_no_active_stage",
				`Could not resolve the active stage for intent '${slug}'. The cursor drives the brief's stage — this tool is only called in-flow during a write_brief action.`,
			)
		}

		const stageDir = join(intentDir, "stages", stage)
		const briefPath = join(stageDir, "BRIEF.md")

		// Engine-owned phase: absent → pre (the plan), present → post (the
		// closing rewrite). Same signal stageOwesClosingBrief gates on, so the
		// file's frontmatter can never disagree with the cursor.
		const phase: "pre" | "post" = existsSync(briefPath) ? "post" : "pre"

		// Stage-scoped artifact → lands on the stage branch, like every other
		// engine-managed per-stage file.
		const branchGuard = ensureOnStageBranch(slug, stage)
		if (!branchGuard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed for brief on '${slug}/${stage}' — ${branchGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		mkdirSync(stageDir, { recursive: true })

		// Preserve any frontmatter the prior (pre) brief carried, then set the
		// engine-owned phase. gray-matter caches parse results by content and
		// returns a SHARED object, so build a fresh data object via spread
		// rather than mutating parsed.data in place.
		let priorData: Record<string, unknown> = {}
		if (existsSync(briefPath)) {
			priorData = { ...(matter(readFileSync(briefPath, "utf8")).data ?? {}) }
		}
		const fm = { ...priorData, phase }
		writeFileSync(briefPath, matter.stringify(body, fm))

		gitCommitState(`haiku: write ${phase} brief for ${slug}/${stage}`)

		return text(
			JSON.stringify(
				{
					action: "brief_written",
					slug,
					stage,
					phase,
					path: briefPath,
					message: `Wrote the ${phase}-execute brief for '${slug}/${stage}'.`,
				},
				null,
				2,
			),
		)
	},
})
