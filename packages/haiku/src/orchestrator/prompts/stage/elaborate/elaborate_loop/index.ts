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

	for (const entry of signals) {
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
			'When you need to surface a user decision (e.g. discovery turned up two viable forks), file `origin: "discovery", resolution: "question"` feedback via `haiku_feedback` instead of guessing. The next tick will route the FB through `feedback_question` so the user picks before the loop continues.',
		].join("\n"),
	)

	return sections.join("\n\n")
})
