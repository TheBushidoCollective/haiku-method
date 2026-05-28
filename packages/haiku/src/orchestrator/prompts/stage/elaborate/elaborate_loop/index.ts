// orchestrator/prompts/elaborate_loop/index.ts — Multi-signal
// elaborate-loop prompt. The cursor's per-stage and pre-intent
// elaborate phase now emits a single `elaborate_loop` action whose
// `signals_unmet[]` enumerates every currently-unmet completion
// signal (GAPS § 1a → Option A, 2026-05-14).
//
// This builder is the router: it walks `signals_unmet[]`, builds the
// per-signal guidance via the existing signal-specific builders, and
// concatenates them under a single "Elaborate Loop" framing. The
// agent is invited to act on any subset of the signals in this tick.
//
// Per-signal builders (kept intact from the pre-Option-A layout) own
// the heavy content for their signal — the conversation gate copy,
// the discovery fan-out, the unit-decomposition mechanics, the
// verifier subagent prompts. The router just composes.

import { readIntentMode } from "../../../_helpers.js"
import { definePromptBuilder } from "../../../define.js"
import type { PromptBuilder, PromptBuilderContext } from "../../../types.js"
import decomposeBuilder from "../decompose/index.js"
import decomposeReviewBuilder from "../decompose_review/index.js"
import discoveryRequiredBuilder from "../discovery_required/index.js"
import elaborateBuilder from "../elaborate/index.js"
import elaborateReviewBuilder from "../elaborate_review/index.js"

type SignalEntry = {
	signal:
		| "conversation"
		| "verify_conversation"
		| "discovery"
		| "decompose"
		| "verify_decompose"
	agent?: string
	units?: string[]
}

type ElaborateLoopAction = {
	action: string
	stage?: string
	intent?: string
	signals_unmet?: SignalEntry[]
	verifier_nonces?: Record<string, string>
	prompt_file?: string
	optional_offer?: boolean
	dependents?: Array<{ stage: string; inputs: string[]; reviewAgents: string[] }>
	[key: string]: unknown
}

// Translate an unmet signal into the synthesized per-signal action
// that the matching builder expects. The builders were originally
// written against per-kind cursor actions (e.g. `kind: "elaborate"`,
// `kind: "discovery_required"`); they ignore the outer `kind` and
// only care about `action.stage`, `action.intent`, and the
// signal-specific fields (`agent`, `units`, `verifier_nonce`,
// `prompt_file`). The router synthesizes those.
function synthesizedAction(
	parent: ElaborateLoopAction,
	entry: SignalEntry,
): Record<string, unknown> {
	const base: Record<string, unknown> = {
		stage: parent.stage,
		intent: parent.intent,
	}
	const nonces = parent.verifier_nonces ?? {}
	switch (entry.signal) {
		case "conversation":
			return { ...base, action: "elaborate", signal: "conversation" }
		case "verify_conversation":
			return {
				...base,
				action: "elaborate_review",
				signal: "verify_conversation",
				verifier_nonce: nonces.verify_conversation ?? "",
			}
		case "discovery":
			return {
				...base,
				action: "discovery_required",
				signal: "discovery",
				agent: entry.agent ?? "",
				units: entry.units ?? [],
			}
		case "decompose":
			// `decompose` is the heavy unit-spec writer. Do NOT forward
			// `parent.prompt_file` — at sub-builder invocation time the
			// parent prompt_file is still undefined (the orchestrator's
			// file-backed dispatch stamps it AFTER buildRunInstructions
			// returns the full body). Forwarding `undefined` here keeps
			// `decompose.ts`'s short-circuit path off and renders inline,
			// which is what we want — the COMPOSITE body is what
			// orchestrator.ts writes to the elaborate_loop prompt file.
			return {
				...base,
				action: "decompose",
				signal: "decompose",
			}
		case "verify_decompose":
			return {
				...base,
				action: "decompose_review",
				signal: "verify_decompose",
				verifier_nonce: nonces.verify_decompose ?? "",
			}
	}
}

function builderFor(signal: SignalEntry["signal"]): PromptBuilder {
	switch (signal) {
		case "conversation":
			return elaborateBuilder
		case "verify_conversation":
			return elaborateReviewBuilder
		case "discovery":
			return discoveryRequiredBuilder
		case "decompose":
			return decomposeBuilder
		case "verify_decompose":
			return decomposeReviewBuilder
	}
}

function headingFor(signal: SignalEntry["signal"]): string {
	switch (signal) {
		case "conversation":
			return "Signal: `conversation` — capture the stage's human-conversation outcome"
		case "verify_conversation":
			return "Signal: `verify_conversation` — dispatch the elaboration substance verifier"
		case "discovery":
			return "Signal: `discovery` — produce a missing discovery artifact"
		case "decompose":
			return "Signal: `decompose` — draft unit specs for this stage"
		case "verify_decompose":
			return "Signal: `verify_decompose` — dispatch the decompose coverage verifier"
	}
}

export default definePromptBuilder((ctx) => {
	const parent = ctx.action as unknown as ElaborateLoopAction
	const signals = parent.signals_unmet ?? []
	const stage = parent.stage
	const intentSlug = parent.intent ?? ctx.slug
	const isAutopilot = readIntentMode(ctx.dir) === "autopilot"

	if (signals.length === 0) {
		// Defensive — cursor never returns elaborate_loop with empty
		// signals_unmet (walk falls through instead), but if a caller
		// constructs one by hand keep the prompt non-empty.
		return [
			"## Elaborate Loop",
			"",
			"Every elaborate-loop completion signal is currently met — call `haiku_run_next` to advance.",
		].join("\n")
	}

	const sections: string[] = []
	const header = stage
		? `## Elaborate Loop — \`${stage}\``
		: "## Elaborate Loop — pre-intent"
	sections.push(header)

	// Optional-stage keep-or-drop offer (first arrival at an optional stage).
	// Lead with the decision so it's settled before any elaborate work is done
	// — a drop here skips this stage's entire elaborate/execute cost. Decision
	// criteria only (does this intent need this phase?); the drop tool's return
	// carries the next step. Keeping needs no action — just elaborate below.
	if (parent.optional_offer && stage) {
		const deps = parent.dependents ?? []
		const severs =
			deps.length === 0
				? "Nothing downstream references this stage — dropping it severs no inputs or review agents."
				: `Dropping it severs these downstream references (they auto-ignore once dropped, so downstream proceeds without them):\n${deps
						.map((d) => {
							const parts: string[] = []
							if (d.inputs.length > 0)
								parts.push(`inputs ${d.inputs.map((i) => `\`${i}\``).join(", ")}`)
							if (d.reviewAgents.length > 0)
								parts.push(
									`review agents ${d.reviewAgents.map((a) => `\`${a}\``).join(", ")}`,
								)
							return `> - \`${d.stage}\` — ${parts.join("; ")}`
						})
						.join("\n")}`
		sections.push(
			[
				`> **\`${stage}\` is an OPTIONAL stage.** It applies to some intents and not others. Decide whether THIS intent needs it before doing any elaboration work below:`,
				">",
				`> - **If it doesn't apply** to this intent's goals, drop it: \`haiku_drop_stage { intent: "${intentSlug}", stage: "${stage}" }\`. The plan advances to the next stage and this stage's elaborate/execute work is skipped entirely.`,
				"> - **If it applies**, just proceed with the elaboration below — keeping the stage needs no separate action.",
				">",
				`> ${severs}`,
			].join("\n"),
		)
	}

	const signalList = signals
		.map((s) =>
			s.signal === "discovery" && s.agent
				? `\`${s.signal}\` (template: \`${s.agent}\`)`
				: `\`${s.signal}\``,
		)
		.join(", ")
	sections.push(
		`The cursor's elaborate-loop has **${signals.length}** completion signal${
			signals.length === 1 ? "" : "s"
		} unmet for ${stage ? `stage \`${stage}\`` : `intent \`${intentSlug}\``}: ${signalList}. You may make progress on any subset of them in this tick — they are concurrent, not ordered. Each signal carries its own sub-instructions below.`,
	)
	sections.push(
		"Read each block, decide which signals you can move forward this tick (often more than one), execute, then call `haiku_run_next` to re-evaluate the loop. The cursor stays in `elaborate_loop` until every signal flips on disk.",
	)

	// Autopilot no-stop directive — hoisted to the TOP of the loop framing
	// (not buried in a sub-signal section) so it governs the whole phase.
	// Without this the agent treats stop-triggers below — a missing upstream
	// artifact, an ambiguous fork, the closing "surface a user decision"
	// note — as cues to yield the turn and ask. In autopilot there is no
	// human in the loop after the pre-intent conversation; every such
	// decision is resolved autonomously (file a feedback and re-tick; the
	// engine routes it) and the turn ALWAYS ends by calling haiku_run_next.
	if (isAutopilot) {
		sections.push(
			[
				"> **⚠ AUTOPILOT — THIS PHASE DOES NOT STOP TO ASK.**",
				">",
				'> Make progress on every signal you can this tick, then end your turn by calling `haiku_run_next`. Do **NOT** yield the turn to ask the user anything — not for a missing upstream artifact, not for an ambiguous scope or a fork between approaches, not for "should I continue?". Resolve it autonomously: pick the path the intent\'s goals imply, or file a `haiku_feedback` (`resolution: "stage_revisit"` for a missing upstream, `resolution: "question"` for a genuine fork) and immediately call `haiku_run_next` — the engine routes it on the next tick without a turn handoff. The ONLY human touchpoint in autopilot was the pre-intent conversation; there is no one to answer a question now.',
				">",
				"> **DO THE WORK before you re-tick.** This phase is your work, not a transition to tick past: dispatch the discovery subagents and DRAFT the unit specs (`haiku_unit_write`) THIS turn. A signal clears only when you change disk state — calling `haiku_run_next` WITHOUT first drafting/dispatching returns the SAME elaborate-loop, and after a few empty ticks the engine HALTS the workflow as a no-progress loop. The escape is always to do the work, never to re-tick harder.",
			].join("\n"),
		)
	}

	// Consolidate every `discovery` signal into ONE discoveryRequiredBuilder
	// call with `dispatches[]` — so the prompt renders ONE "Discovery"
	// section with N subagent blocks (matching the parallel-batched shape of
	// `dispatch_review`), instead of N separate sections. Non-discovery
	// signals keep their per-signal rendering.
	const discoverySignals = signals.filter((s) => s.signal === "discovery")
	const otherSignals = signals.filter((s) => s.signal !== "discovery")

	if (discoverySignals.length > 0) {
		const subAction: Record<string, unknown> = {
			stage,
			intent: intentSlug,
			action: "discovery_required",
			signal: "discovery",
			dispatches: discoverySignals.map((s) => ({
				agent: s.agent ?? "",
				units: s.units ?? [],
			})),
		}
		const subCtx: PromptBuilderContext = {
			...ctx,
			action: subAction as PromptBuilderContext["action"],
			composedMode: true,
		}
		const body = discoveryRequiredBuilder(subCtx) ?? ""
		sections.push(`### ${headingFor("discovery")}\n\n${body.trim()}`)
	}

	for (const entry of otherSignals) {
		const subAction = synthesizedAction(parent, entry)
		const subCtx: PromptBuilderContext = {
			...ctx,
			action: subAction as PromptBuilderContext["action"],
			composedMode: true,
		}
		const body = builderFor(entry.signal)(subCtx) ?? ""
		sections.push(`### ${headingFor(entry.signal)}\n\n${body.trim()}`)
	}

	sections.push(
		[
			"### Concurrent execution reminder",
			"",
			"The signals above are mutually independent unless explicitly noted in a signal block. You can dispatch the discovery subagent AND draft units AND record the elaboration conversation in the same response. The cursor's next tick re-evaluates the loop against the disk and returns whichever signals are still unmet (possibly an empty set, in which case the cursor walks past the loop).",
			"",
			isAutopilot
				? 'A fork in the work (e.g. discovery turned up two viable approaches) is NOT a reason to stop in autopilot. Pick the option the intent\'s goals best support and record the call, or — if it genuinely needs a human later — file `origin: "discovery", resolution: "question"` feedback via `haiku_feedback` and immediately call `haiku_run_next`. Either way the turn ends on `haiku_run_next`; never hand the turn back to ask.'
				: 'When you need to surface a user decision (e.g. discovery turned up two viable forks), file `origin: "discovery", resolution: "question"` feedback via `haiku_feedback` instead of guessing. The next tick will route the FB through `feedback_question` so the user picks before the loop continues.',
		].join("\n"),
	)

	return sections.join("\n\n")
})
