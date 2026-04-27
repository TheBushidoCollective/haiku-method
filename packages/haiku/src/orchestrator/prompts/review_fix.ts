// orchestrator/prompts/review_fix.ts — Stage-scope fix loop. Same
// shape as intent_completion_fix but stage-scoped. Per-finding hat
// chain runs serially; chains run in parallel. Final hat validates
// closure (two-stage: spec match + regression). Findings still open
// after MAX_FIX_LOOP_BOLTS escalate.

import { existsSync } from "node:fs"
import { join } from "node:path"
import { resolvePluginRoot } from "../../config.js"
import { resolveStudioFilePath } from "../../orchestrator.js"
import {
	findHaikuRoot,
	isGitRepo,
	MAX_FIX_LOOP_BOLTS,
} from "../../state-tools.js"
import { readHatDefs, resolveStudio } from "../../studio-reader.js"
import {
	batchDispatchDirective,
	buildInterpretationBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	readInterpretation,
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
	const fixStage = action.stage as string
	const fixHatsList = (action.fix_hats as string[]) || []
	const fixMaxBolts = (action.max_bolts as number) || MAX_FIX_LOOP_BOLTS
	const items = (action.items as FixItem[]) || []
	const totalPending = (action.total_pending as number) || items.length
	const escalatedCount = (action.escalated_count as number) || 0
	const haikuRoot = findHaikuRoot()

	const sections: string[] = []
	sections.push(WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK)

	const headerLines = [
		`## Fix Loop: ${items.length} finding(s) in parallel`,
		"",
		`Dispatching the stage's \`fix_hats:\` sequence against ${items.length} pending finding(s) in stage **${fixStage}**. Each finding's hat chain runs serially (${fixHatsList.join(" → ")}); chains run in parallel across findings.`,
	]
	if (escalatedCount > 0) {
		headerLines.push(
			"",
			`> ⚠ ${escalatedCount} additional finding(s) are at the bolt cap and will escalate after this batch completes.`,
		)
	}
	if (totalPending !== items.length + escalatedCount) {
		headerLines.push(
			"",
			`> Total pending: ${totalPending}. Dispatching: ${items.length}. At cap: ${escalatedCount}.`,
		)
	}
	sections.push(headerLines.join("\n"))

	// Load each fix hat's mandate. Fix hats reuse the stage's
	// hats/{hat}.md files — when a hat wants to behave differently in
	// fix mode, it can include a `## Fix-mode scope` section in its
	// mandate. We do NOT maintain separate fix-mode files to avoid
	// duplication and drift.
	const allHats = readHatDefs(studio, fixStage)
	const studioInfo = resolveStudio(studio)
	const studioDir = studioInfo ? studioInfo.dir : studio
	const pluginRoot = resolvePluginRoot()
	const stageBasePath = resolveStudioFilePath(
		join(studioDir, "stages", fixStage, "STAGE.md"),
	)

	sections.push(
		'### Parallel Fix-Chain Dispatch\n\nEach finding below has its own hat chain. **Within a chain, hats run serially.** **Across chains, findings run in parallel.** The final hat in each chain validates closure and calls `haiku_feedback_update { status: "closed" }`. If a chain leaves its feedback open, the workflow engine loops that finding again on the next `haiku_run_next` — up to the bolt cap.\n',
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
			const hatDef = allHats[hat]
			if (!hatDef) {
				sections.push(
					`\n> **Warning:** hat \`${hat}\` declared in \`fix_hats\` has no mandate file in \`hats/${hat}.md\`. The subagent will run without a mandate — this is likely a studio bug.\n`,
				)
			}
			const hatPath = hatDef
				? join(
						pluginRoot,
						"studios",
						studioDir,
						"stages",
						fixStage,
						"hats",
						`${hat}.md`,
					)
				: null

			const isLast = hat === fixHatsList[fixHatsList.length - 1]
			const promptLines: string[] = [
				`You are the **${hat}** hat running in **fix-mode** against feedback **${fbId}** (bolt ${fixBolt} of ${fixMaxBolts}) in stage **${fixStage}** of intent **${slug}**.`,
				"",
			]
			if (fbWorktree) {
				promptLines.push(
					"## Isolation worktree (REQUIRED)",
					`Do ALL work for this chain inside the dedicated worktree at:`,
					``,
					`    ${fbWorktree}`,
					``,
					`This worktree is on branch \`${fbBranch}\`, forked from the stage branch at dispatch time. It exists so parallel fix chains cannot clobber each other.`,
					"",
					`**Rules:**`,
					`- All file edits, reads of stage artifacts, and git operations MUST happen inside this path.`,
					`- Use \`git -C "${fbWorktree}" <cmd>\` for every git command, or \`cd\` into it once and operate there. Do NOT run bare \`git\` in the parent tree — you will commit on the wrong branch.`,
					`- Commit frequently inside the worktree with messages like \`haiku: fix ${fbId} bolt ${fixBolt} (${hat})\`. Do NOT push.`,
					`- Do NOT run \`git worktree remove\`, \`git branch -d\`, or \`git merge\` — the workflow engine owns the merge-back on the next \`haiku_run_next\` after this chain's final hat closes the finding.`,
					"",
				)
			} else {
				promptLines.push(
					"## Parallel-batch warning",
					`This fix loop is running in parallel with other findings. Multiple chains may edit the **same files** at overlapping times (no isolation worktree is allocated in this environment). When you edit, read the file immediately before writing so you don't clobber another chain's change. If your edit depends on state another chain may have already fixed, verify the current file content rather than trusting the feedback body's line numbers verbatim. The assessor will catch incomplete fixes and the workflow engine will retry on the next bolt.`,
					"",
				)
			}
			promptLines.push(
				"## Required context (inlined below)",
				"You are NOT wearing this hat to build a new unit. You are wearing it to resolve ONE specific feedback finding on artifacts that already exist.",
				"",
			)
			if (stageBasePath) {
				promptLines.push(inlineFile(stageBasePath, `Stage scope: ${fixStage}`))
			}
			if (hatPath && existsSync(hatPath)) {
				promptLines.push(inlineFile(hatPath, `Hat mandate: ${hat}`))
				const fixInterp = buildInterpretationBlock(readInterpretation(hatPath))
				if (fixInterp) promptLines.push("", fixInterp)
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
				`- Read the feedback body (above) carefully. It contains file:line references and the reviewer's concern.`,
				`- The artifact(s) the feedback flags live in \`.haiku/intents/${slug}/stages/${fixStage}/\` — edit them in place.`,
				"- Do NOT create a new unit spec. Do NOT modify unit workflow fields. Do NOT touch unrelated artifacts. Stay in scope.",
				"- Do NOT call `haiku_unit_advance_hat` or `haiku_unit_reject_hat` — this is NOT unit execution.",
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
					`${step++}. Work on ${commitTarget}. Commit the fix with a message like \`haiku: fix ${fbId} bolt ${fixBolt} (${hat})\` — do NOT push.`,
				)
			}
			if (isLast) {
				promptLines.push(
					`${step++}. **Assess closure (two-stage, both must pass).**`,
					`   - **Stage A — Spec match.** Read the edited artifact(s) and the feedback body. Does the edit make the finding's requirement true as written? A partial gesture is not a fix.`,
					`   - **Stage B — Quality / regression.** Inspect the diff (\`git show HEAD\`). Does the edit introduce a regression — broken neighboring behavior, scope creep into unrelated files, banned patterns, or violations of the stage's quality rules?`,
					`${step++}. **Decide:**`,
					`   - **A passes AND B passes** → call \`haiku_feedback_update { intent: "${slug}", stage: "${fixStage}", feedback_id: "${fbId}", status: "closed", closed_by: "fix-loop:${fbId}:bolt-${fixBolt}" }\`.`,
					`   - **A fails** → leave the feedback status as-is (the workflow engine counts this bolt and may dispatch another).`,
					`   - **A passes, B fails** → leave the feedback open AND log the regression as a new finding via \`haiku_feedback({ intent: "${slug}", stage: "${fixStage}", title: "<regression from fix-loop:${fbId}>", body: "<diff hunk + concrete impact>", origin: "adversarial-review", author: "fix-assessor" })\`. Do NOT close the original — the fix is not complete until both stages pass.`,
					`   - **Finding is invalid** (reviewer misread the artifact) → call \`haiku_feedback_reject { intent: "${slug}", stage: "${fixStage}", feedback_id: "${fbId}", reason: "<concrete reason>" }\` INSTEAD of closing.`,
					`${step++}. Return a one-line summary: \`fix-assessor: closed | open | rejected — <reason>\`. Use a verb of completed action; zero hedging words (\`should\`, \`seems\`, \`probably\`).`,
				)
			} else {
				promptLines.push(
					`${step++}. **Verify the finding before editing.** Read the flagged artifact at the file:line refs in the feedback body. Three failure modes route to \`haiku_feedback_reject\` instead of an edit:\n   - **Stale / misread**: the file no longer matches what the reviewer flagged, or the citation points at the wrong location → \`haiku_feedback_reject { intent: "${slug}", stage: "${fixStage}", feedback_id: "${fbId}", reason: "stale — <what changed>" }\` or \`"misread — <what they cited vs. what's there>"\`.\n   - **Ambiguous / unclear** — *high bar*: rejection is **terminal and permanent**, the finding is gone with no in-band channel for the reviewer to clarify. Reject for ambiguity ONLY when (a) NO charitable interpretation exists, OR (b) multiple interpretations are equally plausible AND each requires a *materially different* fix (not just minor variations). On close calls — when one interpretation is clearly the most charitable given the reviewer's mandate, the surrounding artifact context, and the file:line refs — proceed with that interpretation, **state it as an explicit assumption in your bolt summary** ("assumed the finding meant X based on Y"), and let the assessor's two-stage closure check catch wrong interpretations on bolt N+1. The bolt cap (${MAX_FIX_LOOP_BOLTS}) is the safety net.\n     - When you DO reject for true ambiguity, structure the reason as a clarification request the reviewer can act on: \`"needs clarification — original concern: <one-line restate>; specific ambiguity: <what's unclear>; suggested clarification format: <example, e.g. 'name the input field and the validation rule'>"\`.\n     - ✗ Body says: *"the validation is weak"* → genuinely vague; no charitable interpretation isolates a target. Reject with the structured clarification format.\n     - ✗ Body says: *"rename it to foo"* in one place and *"rename it to bar"* elsewhere → two interpretations with materially different fixes. Reject.\n     - ✓ Body says: *"the validation accepts negative quantities; it must reject them with HTTP 400 and message 'quantity must be positive'"* → actionable. Proceed.\n     - ✓ Body says: *"the error handling here is weak"* with a file:line ref pointing at a try/catch swallowing all exceptions → charitable interpretation is clear (swallow → narrow + rethrow). Proceed; state the assumption in your summary.\n   - **Invalid**: the finding describes correct behavior or doesn't identify a real defect → \`haiku_feedback_reject { ... reason: "<concrete reason invalid>" }\`.\n\n   Otherwise the finding is actionable — proceed. Do NOT acknowledge the finding in prose ("good catch", "you're right"); the fix in code is the acknowledgement.`,
					`${step++}. **Investigate.**\n   - Read the flagged artifact at the references in the feedback body. Establish the **current state** — what makes the finding true right now.\n   - Establish the **desired state** — what specifically would make the finding false.\n   - State the **gap** in one sentence. That's the root cause; the fix is a transition from current to desired.\n   - Look for a **comparable working sibling** — another artifact in this stage, an approved template, a passing test, a previously-shipped version, anything that demonstrates the desired state in a related context. Note the relevant differences. Skip this substep only if the artifact is genuinely greenfield with no comparable reference.${fixBolt > 1 ? `\n   - Bolt ${fixBolt} > 1: read \`git show HEAD\` for the prior bolt's edit. **Did you find a meaningfully different root cause from the prior attempt?** If yes, plan a different shape and proceed. If no, you're about to burn a bolt repeating the prior approach — call \`haiku_feedback_reject\` with reason "needs human escalation — N attempts converged on same surface fix" instead of editing.` : ""}`,
					`${step++}. **Apply the fix** within your hat's mandate. Edit ONLY the artifact(s) flagged by the finding — out-of-scope edits are a scope violation; if you notice a separate issue, log it via \`haiku_feedback\` rather than editing it now. Save changes.`,
					`${step++}. Return a one-line summary using a verb of completed action (\`edited X\`, \`added Y\`, \`updated Z\`). Zero hedging words (\`should\`, \`seems\`, \`probably\`, \`might\`).`,
				)
			}

			sections.push(
				`${emitSubagentDispatchBlock({
					unit: `fix-${fbId}`,
					hat,
					bolt: fixBolt,
					agentType: hatDef?.agent_type ?? "general-purpose",
					model: hatDef?.model,
					promptBody: promptLines.join("\n"),
					heading: `#### Subagent: \`${hat}\`${isLast ? " (final — validates closure)" : ""}`,
				})}\n`,
			)
		}
	}

	// Wave-based dispatch: within a finding's chain, hats run serially;
	// across findings, chains run in parallel. The simplest way for the
	// parent to express that is one wave per hat in the sequence,
	// spawning all findings' subagents in a single message.
	const waveLines: string[] = [
		"### Parent Instructions (do NOT include in subagent prompts)",
		"",
		`**Dispatch by wave.** The hat sequence is \`${fixHatsList.join(" → ")}\`. For each hat in the sequence, run the full fan-out of ${items.length} fix chain(s) under the concurrency cap, then advance to the next hat.`,
		"",
		batchDispatchDirective(items.length, "fix chains"),
		"",
		`After the FINAL wave (\`${fixHatsList[fixHatsList.length - 1]}\`) completes for all findings, call \`haiku_run_next { intent: "${slug}" }\` — the workflow engine decides what happens next (advance, loop the still-open findings, or escalate).`,
	]
	if (items.length > 1) {
		waveLines.push(
			"",
			`**Conflict note:** ${items.length} chains will be editing artifacts concurrently. Any two chains may target the same file. Each chain's final hat validates closure independently — unresolved findings simply loop with an incremented bolt rather than silently drop. No serial fallback is needed.`,
		)
	}
	sections.push(waveLines.join("\n"))

	return sections.join("\n\n")
})
