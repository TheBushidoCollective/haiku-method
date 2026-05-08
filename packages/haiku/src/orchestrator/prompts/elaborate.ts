// orchestrator/prompts/elaborate.ts — Per-stage human-conversation
// gate. Replaces the legacy elaborate prompt (now `decompose.ts`,
// which handles unit-spec writing). The split landed 2026-05-08 to
// enforce the principle that every non-autopilot stage starts with a
// real conversation before any autonomous decomposition fires. The
// cursor blocks at this action until `stages/<stage>/elaboration.md`
// exists and a verifier has stamped `verified_at` on its frontmatter.
//
// Mode behavior:
//   - All non-autopilot modes (continuous, discrete, discrete-hybrid)
//     emit this action on stage entry. The agent reads context,
//     surfaces informed questions, captures the agreement.
//   - Autopilot bypasses this gate at the cursor level (cursor.ts
//     `walkIntentTrack` skips the elaborate clause when
//     `intent.mode === "autopilot"`). This builder never fires in
//     autopilot.
//
// What "informed" means:
//   - Read the intent's goal and scope (intent.md body, not just FM).
//   - Read STAGE.md so you know what this stage is supposed to
//     produce.
//   - Read prior stages' outputs if any exist (their captured
//     elaboration artifacts and final outputs/) so you don't ask
//     about things already settled.
//   - Surface SPECIFIC questions tied to ambiguity in the intent.
//     "What do you want to do?" is a failure of this gate. "The
//     intent calls out mobile and desktop but doesn't specify which
//     surfaces are in scope for THIS stage — confirm scope?" is the
//     bar.
//
// Capture mechanics:
//   - When the agent and user reach alignment, the agent calls
//     `haiku_stage_elaboration_record` with the captured agreement.
//     That tool writes `stages/<stage>/elaboration.md`. The cursor's
//     next tick fires `elaborate_review` (verifier dispatch).
//   - The verifier independently grades the artifact for substance.
//     Pass stamps `verified_at`; fail returns gaps so the agent can
//     re-engage and overwrite the artifact.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { definePromptBuilder } from "./define.js"

export default definePromptBuilder((ctx) => {
	const action = ctx.action as { stage?: string; intent?: string }
	const stage = action.stage ?? "(unknown)"
	const intentSlug = action.intent ?? ctx.slug

	const intentMdPath = join(ctx.dir, "intent.md")
	const intentExcerpt = readFirstNonEmptyChunk(intentMdPath, 400)

	const stageDir = join(ctx.dir, "stages", stage)
	const stageMdPath = join(stageDir, "STAGE.md")
	const stageScope = readFirstNonEmptyChunk(stageMdPath, 300)

	const sections: string[] = []

	sections.push(`## Elaborate (Conversation Gate) — ${stage}`)
	sections.push("")
	sections.push(
		`This is the per-stage human-conversation gate. Before any unit-spec writing, stage-scoped discovery dispatch, or downstream decomposition can fire, you and the user need to align on what this stage is actually doing for *this* intent. The cursor will not advance to \`decompose\` until you've captured the conversation in \`stages/${stage}/elaboration.md\` AND a verifier has independently confirmed it engaged substantively with the intent's goals on this stage's scope.`,
	)

	sections.push(`### What you must do (in order)`)
	sections.push(
		`1. **Read context first.** Don't open with a question. Open by reading:`,
	)
	sections.push(`   - \`${intentMdPath}\` — the full intent (FM and body).`)
	sections.push(
		`   - \`${stageMdPath}\` — what this stage is supposed to produce.`,
	)
	sections.push(
		`   - Any prior stages' \`elaboration.md\` and \`outputs/\` artifacts so you don't relitigate settled decisions.`,
	)
	sections.push(
		`2. **Identify the real uncertainties.** Specific to *this* intent on *this* stage. Examples of good questions:`,
	)
	sections.push(
		`   - "The intent calls out mobile and desktop but the design stage's scope is ambiguous about which surfaces. Are both in scope here, or is mobile a follow-up?"`,
	)
	sections.push(
		`   - "Prior stage's elaboration captured a Stripe integration. This stage produces the checkout UX — should I assume Stripe Elements, or is the payment surface still open?"`,
	)
	sections.push(
		`   Examples of failures of this gate (the verifier will reject these):`,
	)
	sections.push(`   - "What do you want to do?"`)
	sections.push(
		`   - "I'm starting the design stage — let me know if you have any input."`,
	)
	sections.push(
		`   - One question, generic, with no reference to the intent's actual content.`,
	)
	sections.push(
		`3. **Have the conversation.** Surface the questions to the user via your normal chat surface. Iterate. When you believe alignment is reached, capture the outcome.`,
	)
	sections.push(
		`4. **Capture the agreement.** Call \`haiku_stage_elaboration_record\` with:`,
	)
	sections.push(`   - \`intent\`: \`${intentSlug}\``)
	sections.push(`   - \`stage\`: \`${stage}\``)
	sections.push(
		`   - \`body\`: a markdown summary of the conversation — what you proposed, what the user clarified, what the final agreement is. Cite the intent body where the conversation was anchored.`,
	)
	sections.push(
		`   The tool writes \`stages/${stage}/elaboration.md\`. The cursor's next tick will dispatch the verifier.`,
	)
	sections.push(
		`5. **Re-tick.** After the record call, call \`haiku_run_next { intent: "${intentSlug}" }\` so the cursor moves forward.`,
	)

	if (intentExcerpt) {
		sections.push(`### Intent excerpt (read the full file before responding)`)
		sections.push("```markdown")
		sections.push(intentExcerpt)
		sections.push("```")
	}

	if (stageScope) {
		sections.push(`### STAGE.md excerpt (read the full file before responding)`)
		sections.push("```markdown")
		sections.push(stageScope)
		sections.push("```")
	}

	sections.push(`### Things this gate is NOT`)
	sections.push(
		`- Not a place to dispatch discovery subagents. That's \`decompose\`'s job, and only after this gate passes.`,
	)
	sections.push(
		`- Not a place to write unit specs. Same — \`decompose\` writes specs informed by this conversation.`,
	)
	sections.push(
		`- Not a one-question check-in. The verifier will reject thin conversations. Engage substantively.`,
	)

	return sections.join("\n")
})

function readFirstNonEmptyChunk(path: string, maxLen: number): string {
	if (!existsSync(path)) return ""
	try {
		const raw = readFileSync(path, "utf8")
		const trimmed = raw.trim()
		if (trimmed.length <= maxLen) return trimmed
		return `${trimmed.slice(0, maxLen)}…`
	} catch {
		return ""
	}
}
