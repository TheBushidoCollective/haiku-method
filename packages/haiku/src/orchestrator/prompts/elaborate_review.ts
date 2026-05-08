// orchestrator/prompts/elaborate_review.ts — Substance verifier for
// captured elaboration artifacts. Fires whenever the cursor sees
// `stages/<stage>/elaboration.md` exists but no `verified_at` stamp
// on its frontmatter.
//
// The verifier exists because the agent's incentive is to ship —
// "I asked one question, user said go" can clear a procedural gate
// but not a substantive one. An independent verifier reads the
// captured conversation, the intent, and STAGE.md, and answers one
// question: did this exchange engage substantively with *this*
// intent's goals on *this* stage's scope?
//
// Mechanically:
//   - The agent dispatches a subagent (Task tool) with the verifier
//     prompt below.
//   - The verifier reads three files: the elaboration artifact, the
//     intent body, and STAGE.md.
//   - Pass: verifier calls `haiku_stage_elaboration_seal` which
//     stamps `verified_at` on the artifact's frontmatter. Cursor's
//     next tick advances to discovery / decompose.
//   - Fail: verifier surfaces the specific gaps. The outer agent
//     re-engages the user, calls `haiku_stage_elaboration_record`
//     again (overwriting the artifact, clearing any stale
//     verified_at), and the cursor re-emits this action for another
//     verification pass.

import { join } from "node:path"
import { definePromptBuilder } from "./define.js"

export default definePromptBuilder((ctx) => {
	const action = ctx.action as { stage?: string; intent?: string }
	const stageRaw = action.stage
	const intentSlug = action.intent ?? ctx.slug
	const isPreIntent = !stageRaw

	const intentMdPath = join(ctx.dir, "intent.md")

	if (isPreIntent) {
		const sections: string[] = []
		sections.push(`## Pre-Intent Elaborate Review (Substance Verifier)`)
		sections.push("")
		sections.push(
			`The conversation that produced \`intent.md\` for ${intentSlug} hasn't been verified. Dispatch a verifier subagent to grade the intent for substance before any stage walk fires.`,
		)
		sections.push(`### Dispatch the verifier`)
		sections.push(
			`Use the Task tool to spawn one subagent with the prompt below. Wait for it to return, then call \`haiku_run_next { intent: "${intentSlug}" }\` to re-tick.`,
		)
		sections.push("```")
		sections.push(
			`You are the pre-intent elaboration verifier for intent ${intentSlug}.`,
		)
		sections.push("")
		sections.push(
			`Your single job: read \`${intentMdPath}\` and decide whether its body reflects a meaningful conversation between the user and the originating agent.`,
		)
		sections.push("")
		sections.push(`Pass criteria (ALL must be true):`)
		sections.push(
			`- The body describes a specific goal, not a generic placeholder.`,
		)
		sections.push(
			`- The scope reflects real choices the user made (what's in, what's explicitly out).`,
		)
		sections.push(
			`- Constraints, integrations, audience, and surfaces are concrete enough that a stage's elaborate phase can anchor on them.`,
		)
		sections.push(
			`- The intent is differentiated from "build a generic X" — it has the texture of THIS user wanting THIS thing.`,
		)
		sections.push("")
		sections.push(`Fail signals:`)
		sections.push(
			`- One-paragraph generic "build a SaaS app" body with no scoping.`,
		)
		sections.push(`- No mention of audience, constraints, or non-goals.`)
		sections.push(
			`- Body looks like the agent guessed at requirements without conversation.`,
		)
		sections.push("")
		sections.push(
			`On pass: call \`haiku_intent_seal\` with { intent: "${intentSlug}" } (and optional \`notes\`). The tool stamps \`verified_at\` on intent FM.`,
		)
		sections.push("")
		sections.push(
			`On fail: do NOT call seal. Return a structured response with the specific gaps the outer agent must address — quote the lines from intent.md that are thin, name what's missing. The outer agent re-engages the user and updates the intent body before the verifier re-tries.`,
		)
		sections.push("```")
		sections.push(`### When the verifier returns`)
		sections.push(
			`- Pass → call \`haiku_run_next\`. Cursor will advance into the first stage's elaborate gate.`,
		)
		sections.push(
			`- Fail → take the verifier's gap list back to the user. Update intent.md (re-record via the intent_create flow or via direct body update). Then call \`haiku_run_next\` for another verification pass.`,
		)
		return sections.join("\n")
	}

	const stage = stageRaw as string
	const stageMdPath = join(ctx.dir, "stages", stage, "STAGE.md")
	const elabPath = join(ctx.dir, "stages", stage, "elaboration.md")

	const sections: string[] = []

	sections.push(`## Elaborate Review (Substance Verifier) — ${stage}`)
	sections.push("")
	sections.push(
		`The conversation artifact at \`${elabPath}\` exists but is unverified. Dispatch a verifier subagent to grade it for substance before the cursor can advance to \`decompose\`.`,
	)

	sections.push(`### Dispatch the verifier`)
	sections.push(
		`Use the Task tool to spawn one subagent with the prompt below. Wait for it to return, then call \`haiku_run_next { intent: "${intentSlug}" }\` to re-tick.`,
	)

	sections.push("```")
	sections.push(
		`You are the elaboration verifier for intent ${intentSlug}, stage ${stage}.`,
	)
	sections.push("")
	sections.push(
		`Your single job: read three files and decide whether the captured conversation engaged substantively with *this* intent's goals as they bear on *this* stage's scope.`,
	)
	sections.push("")
	sections.push(`Files to read (in order):`)
	sections.push(`1. ${elabPath} — the captured conversation artifact.`)
	sections.push(`2. ${intentMdPath} — the intent (FM and body).`)
	sections.push(`3. ${stageMdPath} — the stage's scope and outputs.`)
	sections.push("")
	sections.push(`Pass criteria (ALL must be true):`)
	sections.push(
		`- The conversation references specific content from the intent body, not just the FM.`,
	)
	sections.push(
		`- The questions surfaced are tied to ambiguities in *this* intent on *this* stage's scope. Generic questions ("what do you want?") fail.`,
	)
	sections.push(
		`- The agreement captured at the end is concrete enough that downstream unit decomposition could anchor on it.`,
	)
	sections.push(
		`- The conversation surfaces at least one decision point or clarification, not just acknowledgment.`,
	)
	sections.push("")
	sections.push(`Fail signals:`)
	sections.push(`- One-line "user said go" with no preceding exchange.`)
	sections.push(`- Generic agent monologue with no user voice captured.`)
	sections.push(`- Conversation about a different intent or stage.`)
	sections.push(
		`- No reference to specific intent content (mobile, desktop, integrations, named features, etc.).`,
	)
	sections.push("")
	sections.push(
		`On pass: call \`haiku_stage_elaboration_seal\` with { intent: "${intentSlug}", stage: "${stage}" }. The tool stamps \`verified_at\` on the artifact's frontmatter.`,
	)
	sections.push("")
	sections.push(
		`On fail: do NOT call seal. Return a structured response with the specific gaps the outer agent must address — quote the lines from the artifact that are thin, name what's missing, and suggest what the next conversation turn should cover. The outer agent will overwrite the artifact and re-verify.`,
	)
	sections.push("```")

	sections.push(`### When the verifier returns`)
	sections.push(
		`- Pass → call \`haiku_run_next\`. Cursor will advance to \`decompose\`.`,
	)
	sections.push(
		`- Fail → take the verifier's gap list back to the user. Have the missing conversation. Call \`haiku_stage_elaboration_record\` again with the updated body — this overwrites the artifact and clears the (still-missing) \`verified_at\`. Then call \`haiku_run_next\` for another verification pass.`,
	)

	return sections.join("\n")
})
