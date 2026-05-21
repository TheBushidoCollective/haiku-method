// orchestrator/prompts/intent/reflection/record_reflection/index.ts —
// reflection intent-close prompt.
//
// Cursor returns `record_reflection {}` once at intent close, after
// every intent-scope approval is signed and before seal_intent
// advances, when no `reflection.md` has been written yet for this
// intent. The agent synthesizes the run from on-disk signal (per-stage
// observations.md + every FB + unit iterations/outputs), writes
// `reflection.md` at intent root, lands any project-local overlays
// directly under `.haiku/`, fires `haiku_report` for engine-class
// findings, and commits the whole batch with an `autotune:` prefixed
// message. The next tick sees `reflection.md` and falls through to
// seal_intent.
//
// The studio's `reflections/*.md` dimension files (resolved through the
// project→plugin cascade) are injected as analytical lenses: they tell
// the agent WHAT to look at (e.g. quality, velocity, architecture), and
// the autotune machinery decides WHERE the finding lands (overlay vs
// engine-report). A studio with no dimension files falls back to the
// generic synthesis sections in the template.

import { Eta } from "eta"
import { readReflectionDefs } from "../../../../../studio-reader.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

/** Strip a leading YAML frontmatter block so the prompt shows only the body. */
function stripFrontmatter(raw: string): string {
	const m = raw.match(/^---\n[\s\S]*?\n---\n?/)
	return (m ? raw.slice(m[0].length) : raw).trim()
}

export default definePromptBuilder(({ slug, studio }) => {
	const dimensions = studio
		? Object.entries(readReflectionDefs(studio)).map(([name, raw]) => ({
				name,
				body: stripFrontmatter(raw),
			}))
		: []
	return eta.renderString(TEMPLATE, { slug, dimensions })
})
