// orchestrator/prompts/intent_completion_fix.ts — Studio-level fix
// loop. Per-finding chain: studio fix-hats run serially within a
// chain; chains run in parallel across findings. Each chain's final
// hat validates closure (two-stage: spec match + regression check)
// and either closes the feedback or leaves it open for the next
// bolt. Findings still open after MAX_FIX_LOOP_BOLTS escalate.

import { existsSync } from "node:fs"
import { join } from "node:path"
import {
	findHaikuRoot,
	isGitRepo,
	MAX_FIX_LOOP_BOLTS,
} from "../../state-tools.js"
import { readStudioFixHatPaths } from "../../studio-reader.js"
import {
	batchDispatchDirective,
	buildInterpretationBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	readInterpretation,
	resolveReviewAgentModel,
} from "./_helpers.js"
import { definePromptBuilder } from "./define.js"
import { WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK } from "./WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK.js"

interface FixItem {
	feedback_id: string
	feedback_file: string
	feedback_title: string
	bolt: number
	worktree?: string | null
	branch?: string | null
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const fixHatsList = (action.fix_hats as string[]) || []
	const fixMaxBolts = (action.max_bolts as number) || MAX_FIX_LOOP_BOLTS
	const items = (action.items as FixItem[]) || []
	const totalPending = (action.total_pending as number) || items.length
	const escalatedCount = (action.escalated_count as number) || 0
	const haikuRoot = findHaikuRoot()
	const fixHatPaths = readStudioFixHatPaths(studio)

	const sections: string[] = []
	sections.push(WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK)

	const icHeader = [
		`## Intent-Completion Fix Loop: ${items.length} finding(s) in parallel`,
		"",
		`Studio-level findings will be addressed by dispatching the studio's \`fix-hats/\` sequence against each finding. Per-finding sequence: ${fixHatsList.join(" → ")} (serial within chain). Chains run in parallel across findings.`,
	]
	if (escalatedCount > 0) {
		icHeader.push(
			"",
			`> ⚠ ${escalatedCount} additional finding(s) are at the bolt cap and will escalate after this batch completes.`,
		)
	}
	if (totalPending !== items.length + escalatedCount) {
		icHeader.push(
			"",
			`> Total pending: ${totalPending}. Dispatching: ${items.length}. At cap: ${escalatedCount}.`,
		)
	}
	sections.push(icHeader.join("\n"))

	sections.push(
		'### Parallel Fix-Chain Dispatch\n\nEach finding below has its own hat chain. **Within a chain, hats run serially.** **Across chains, findings run in parallel.** The final hat in each chain validates closure and calls `haiku_feedback_update { status: "closed" }` (omit `stage`). If a chain leaves its feedback open, the workflow engine loops that finding again on the next `haiku_run_next` — up to the bolt cap.\n',
	)

	for (const {
		feedback_id: fbId,
		feedback_file: fbFile,
		feedback_title: fbTitle,
		bolt: fixBolt,
		worktree: fbWorktree,
		branch: fbBranch,
	} of items) {
		const fbAbsPath = join(haikuRoot, fbFile)
		sections.push(
			`\n### Finding \`${fbId}\` — _${fbTitle}_ (bolt ${fixBolt}/${fixMaxBolts})\n`,
		)

		for (const hat of fixHatsList) {
			const hatPath = fixHatPaths[hat]
			if (!hatPath) {
				sections.push(
					`\n> **Warning:** studio fix-hat \`${hat}\` has no mandate file in \`plugin/studios/${studio}/fix-hats/${hat}.md\`. The subagent will run without a mandate — this is likely a studio bug.\n`,
				)
			}
			const isLast = hat === fixHatsList[fixHatsList.length - 1]

			const promptLines: string[] = [
				`You are the **${hat}** studio fix-hat running against intent-scope feedback **${fbId}** (bolt ${fixBolt} of ${fixMaxBolts}) for intent **${slug}**.`,
				"",
			]
			if (fbWorktree) {
				promptLines.push(
					"## Isolation worktree (REQUIRED)",
					`Do ALL work for this chain inside the dedicated worktree at:`,
					``,
					`    ${fbWorktree}`,
					``,
					`This worktree is on branch \`${fbBranch}\`, forked from intent main at dispatch time. It exists so parallel fix chains cannot clobber each other.`,
					"",
					`**Rules:**`,
					`- All file edits, reads, and git operations MUST happen inside this path.`,
					`- Use \`git -C "${fbWorktree}" <cmd>\` or \`cd\` into the worktree once. Do NOT run bare \`git\` in the parent tree.`,
					`- Commit frequently with \`haiku: intent-fix ${fbId} bolt ${fixBolt} (${hat})\`. Do NOT push.`,
					`- Do NOT run \`git worktree remove\`, \`git branch -d\`, or \`git merge\` — the workflow engine owns merge-back on the next \`haiku_run_next\` after the assessor closes the finding.`,
					"",
				)
			} else {
				promptLines.push(
					"## Parallel-batch warning",
					`This fix loop is running in parallel with other findings. Multiple chains may edit the **same files** at overlapping times (no isolation worktree is allocated in this environment). When you edit, read the file immediately before writing so you don't clobber another chain's change. The assessor will catch incomplete fixes and the workflow engine will retry on the next bolt.`,
					"",
				)
			}
			promptLines.push(
				"## Required context (inlined below)",
				"You are addressing ONE whole-intent finding. Your mandate is studio-wide, not stage-specific — you reconcile artifacts across the whole intent against studio standards.",
				"",
			)
			if (hatPath && existsSync(hatPath)) {
				promptLines.push(inlineFile(hatPath, `Fix-hat mandate: ${hat}`))
				const studioFixInterp = buildInterpretationBlock(
					readInterpretation(hatPath),
				)
				if (studioFixInterp) promptLines.push("", studioFixInterp)
			}
			if (existsSync(fbAbsPath)) {
				promptLines.push(
					inlineFile(fbAbsPath, `Feedback: ${fbId} — ${fbTitle}`),
				)
			}
			promptLines.push(
				"",
				"## Fix-mode scope (STRICT)",
				`- You are addressing ONE finding: **${fbId}** — _${fbTitle}_.`,
				`- The artifact(s) the feedback flags live under \`.haiku/intents/${slug}/stages/*/\` — edit them in place.`,
				"- Do NOT create a new unit spec. Do NOT modify unit workflow fields. Do NOT touch unrelated artifacts.",
				"- Do NOT call `haiku_unit_advance_hat` or `haiku_unit_reject_hat`.",
				"",
				"## Instructions",
				"",
			)
			let step = 1
			if (isGitRepo()) {
				const commitTarget = fbWorktree
					? `the isolation worktree (\`git -C "${fbWorktree}" add -A && git -C "${fbWorktree}" commit -m "..."\`)`
					: "the current branch"
				promptLines.push(
					`${step++}. Work on ${commitTarget}. Commit with a message like \`haiku: intent-fix ${fbId} bolt ${fixBolt} (${hat})\` — do NOT push.`,
				)
			}
			if (isLast) {
				promptLines.push(
					`${step++}. **Assess closure (two-stage, both must pass).**`,
					`   - **Stage A — Spec match.** Does the edit make the finding's requirement true as written?`,
					`   - **Stage B — Quality / regression.** Inspect the diff (\`git show HEAD\`). Does the edit introduce a regression — broken neighboring behavior, scope creep, or violations of studio-wide standards?`,
					`${step++}. **Decide:**`,
					`   - **A passes AND B passes** → call \`haiku_feedback_update { intent: "${slug}", feedback_id: "${fbId}", status: "closed", closed_by: "intent-fix:${fbId}:bolt-${fixBolt}" }\` — omit \`stage\`.`,
					`   - **A fails** → leave status unchanged (the workflow engine counts this bolt).`,
					`   - **A passes, B fails** → leave the original open AND log the regression as a new finding via \`haiku_feedback({ intent: "${slug}", title: "<regression from intent-fix:${fbId}>", body: "<diff hunk + impact>", origin: "studio-review", author: "fix-assessor" })\`. Omit \`stage\` (intent scope).`,
					`   - **Finding is invalid** → call \`haiku_feedback_reject { intent: "${slug}", feedback_id: "${fbId}", reason: "<concrete reason>" }\` — omit \`stage\`.`,
					`${step++}. Return \`fix-assessor: closed | open | rejected — <reason>\`. Verb of completed action; zero hedging.`,
				)
			} else {
				promptLines.push(
					`${step++}. **Verify the finding before editing.** Read the flagged artifact(s) and check three failure modes routing to \`haiku_feedback_reject\` (omit \`stage\` — intent scope) instead of an edit:\n   - **Stale / misread**: the artifact no longer matches what the reviewer flagged, or the citation points at the wrong location → reason: \`"stale — <what changed>"\` or \`"misread — <what they cited vs. what's there>"\`.\n   - **Ambiguous / unclear** — *high bar*: rejection is **terminal and permanent**, the finding is gone with no in-band channel for the reviewer to clarify. Reject for ambiguity ONLY when NO charitable interpretation exists OR multiple equally-plausible interpretations would require materially different cross-stage fixes. On close calls — when one interpretation is clearly the most charitable given the reviewer's mandate, the surrounding artifact context, and how the concern surfaces across stages — proceed with that interpretation, state it as an explicit assumption in your bolt summary, and let the assessor's two-stage closure check catch wrong interpretations on the next bolt (cap: ${MAX_FIX_LOOP_BOLTS}). When you DO reject for true ambiguity, structure the reason as a clarification request the reviewer can act on: \`"needs clarification — original concern: <one-line restate>; specific ambiguity: <what's unclear>; suggested clarification format: <example>"\`.\n   - **Invalid**: the finding describes correct cross-stage behavior or doesn't identify a real defect → reason: \`"<concrete reason invalid>"\`.\n\n   Otherwise the finding is actionable — proceed. Do NOT acknowledge the finding in prose ("good catch", "you're right").`,
					`${step++}. **Investigate.**\n   - Read the flagged artifact(s). Establish the **current state** — what makes the finding true right now.\n   - Establish the **desired state** — what specifically would make the finding false.\n   - State the **gap** in one sentence. That's the root cause; the fix is a transition from current to desired across whichever stages the finding spans.\n   - Look for a **comparable working sibling** — another stage's artifact that already meets the studio-wide standard, an approved template, a previously-shipped intent that handled this concern correctly. Note the relevant differences. Skip this substep only if the concern is genuinely novel with no comparable reference.${fixBolt > 1 ? `\n   - Bolt ${fixBolt} > 1: read \`git show HEAD\` for the prior bolt's edit. **Did you find a meaningfully different root cause from the prior attempt?** If yes, plan a different shape and proceed. If no, call \`haiku_feedback_reject\` with reason "needs human escalation — N attempts converged on same surface fix" instead of editing.` : ""}`,
					`${step++}. **Apply the fix** within your mandate. Edit ONLY the artifact(s) the finding flags — out-of-scope edits are a scope violation; log unrelated issues via \`haiku_feedback\` rather than editing them now. Save changes.`,
					`${step++}. Return a one-line summary using a verb of completed action. Zero hedging (\`should\`, \`seems\`, \`probably\`, \`might\`).`,
				)
			}

			const fixHatModel = hatPath
				? resolveReviewAgentModel({ mandatePath: hatPath, studio })
				: undefined
			sections.push(
				`${emitSubagentDispatchBlock({
					unit: `intent-fix-${fbId}`,
					hat,
					bolt: fixBolt,
					agentType: "general-purpose",
					model: fixHatModel,
					promptBody: promptLines.join("\n"),
					heading: `#### Subagent: \`${hat}\`${isLast ? " (final — validates closure)" : ""}`,
				})}\n`,
			)
		}
	}

	const icWaveLines: string[] = [
		"### Parent Instructions (do NOT include in subagent prompts)",
		"",
		`**Dispatch by wave.** The hat sequence is \`${fixHatsList.join(" → ")}\`. For each hat in the sequence, run the full fan-out of ${items.length} fix chain(s) under the concurrency cap, then advance to the next hat.`,
		"",
		batchDispatchDirective(items.length, "fix chains"),
		"",
		`After the FINAL wave completes for all findings, call \`haiku_run_next { intent: "${slug}" }\` — the workflow engine decides: advance to gate, loop still-open findings, or escalate.`,
	]
	if (items.length > 1) {
		icWaveLines.push(
			"",
			`**Conflict note:** ${items.length} chains will be editing artifacts concurrently. Unresolved findings loop with an incremented bolt rather than drop.`,
		)
	}
	sections.push(icWaveLines.join("\n"))

	return sections.join("\n\n")
})
