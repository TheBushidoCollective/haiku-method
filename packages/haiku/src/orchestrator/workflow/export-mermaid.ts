// orchestrator/workflow/export-mermaid.ts — Render a StudioConfig as a
// Mermaid stateDiagram-v2 source string.
//
// Why Mermaid? Two reasons:
// 1. Static export — drops straight into markdown / the website
//    docs / prototype-stage-flow.html without any runtime JS.
// 2. The architecture-prototype-sync rule (in CLAUDE.md) calls out
//    that the prototype is hand-maintained today. The StudioConfig
//    + this exporter together close that sync gap: every studio
//    change regenerates its diagram automatically.
//
// What's preserved in the diagram:
// - Top-level state nodes (one per stage + setup + terminals)
// - Per-stage phase progression (start_stage → elaborate →
//   elaborate_review → decompose → execute → review → review_fix →
//   gate). The 2026-05-08 elaborate split shows up here as two new
//   states (elaborate = conversation gate; decompose = unit-spec
//   writing) plus the verifier dispatch.
// - Per-hat sub-states inside execute (the studio's actual hat
//   sequence)
// - Per-bolt × per-fix-hat sub-states inside review_fix
// - Transitions: phase advances, gate routes (advance / changes /
//   external), fix-loop bolt routing
// - Final-state markers ([*] arrows + the `final` keyword)
//
// What's elided to keep the diagram readable:
// - Action names on transitions (would clutter — the per-state
//   handler files in handlers/ document them)
// - Meta fields (gate type, hat lists — visible via the per-state
//   handler comments)

import type { StudioConfig } from "./studio-config.js"

/** Mermaid state-diagram identifiers must be alphanumeric +
 *  underscore, no dots, no hyphens. Sanitize stage / hat names so
 *  studios with kebab-case hats render. */
function sanitizeId(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, "_")
}

/** Build the Mermaid lines for a single stage's sub-machine. */
function renderStageBlock(
	stageName: string,
	hats: readonly string[],
	fixHats: readonly string[],
	maxBolts: number,
): string[] {
	const sid = sanitizeId(stageName)
	const lines: string[] = []
	lines.push(`  state ${sid} {`)
	lines.push(`    [*] --> ${sid}_start_stage`)
	lines.push(`    ${sid}_start_stage --> ${sid}_elaborate : tick`)
	lines.push(
		`    ${sid}_elaborate --> ${sid}_elaborate_review : record.advance`,
	)
	lines.push(`    ${sid}_elaborate_review --> ${sid}_decompose : verifier.pass`)
	lines.push(`    ${sid}_elaborate_review --> ${sid}_elaborate : verifier.fail`)
	lines.push(`    ${sid}_decompose --> ${sid}_execute : decompose.advance`)
	lines.push(`    ${sid}_decompose --> ${sid}_review_fix : feedback.pending`)

	// Execute sub-machine — hat enumeration.
	if (hats.length > 0) {
		lines.push(`    state ${sid}_execute {`)
		lines.push(`      [*] --> ${sid}_execute_${sanitizeId(hats[0])}`)
		for (let i = 0; i < hats.length; i++) {
			const hatId = `${sid}_execute_${sanitizeId(hats[i])}`
			const isLast = i === hats.length - 1
			const next = isLast
				? `${sid}_execute_done`
				: `${sid}_execute_${sanitizeId(hats[i + 1])}`
			const prev = i === 0 ? hatId : `${sid}_execute_${sanitizeId(hats[i - 1])}`
			lines.push(`      ${hatId} --> ${next} : hat.advance`)
			if (i > 0) {
				lines.push(`      ${hatId} --> ${prev} : hat.reject`)
			}
		}
		lines.push(`      ${sid}_execute_done --> [*]`)
		lines.push(`    }`)
	} else {
		lines.push(`    state ${sid}_execute {`)
		lines.push(`      [*] --> ${sid}_execute_done`)
		lines.push(`      ${sid}_execute_done --> [*]`)
		lines.push(`    }`)
	}
	lines.push(`    ${sid}_execute --> ${sid}_review`)
	lines.push(`    ${sid}_review --> ${sid}_gate : review.clean`)
	lines.push(`    ${sid}_review --> ${sid}_review_fix : review.findings`)

	// Review-fix sub-machine — bolt × fix-hat enumeration.
	if (fixHats.length > 0) {
		lines.push(`    state ${sid}_review_fix {`)
		lines.push(`      [*] --> ${sid}_review_fix_bolt_1`)
		for (let bolt = 1; bolt <= maxBolts; bolt++) {
			const boltId = `${sid}_review_fix_bolt_${bolt}`
			lines.push(`      state ${boltId} {`)
			lines.push(`        [*] --> ${boltId}_${sanitizeId(fixHats[0])}`)
			for (let i = 0; i < fixHats.length; i++) {
				const hatId = `${boltId}_${sanitizeId(fixHats[i])}`
				const isLast = i === fixHats.length - 1
				const next = isLast
					? `${boltId}_validated`
					: `${boltId}_${sanitizeId(fixHats[i + 1])}`
				lines.push(`        ${hatId} --> ${next} : fix.advance`)
			}
			lines.push(`        ${boltId}_validated --> [*]`)
			lines.push(`      }`)

			// Cross-bolt routing.
			const nextBoltOrEscalate =
				bolt < maxBolts
					? `${sid}_review_fix_bolt_${bolt + 1}`
					: `${sid}_review_fix_escalated`
			lines.push(`      ${boltId} --> ${sid}_review_fix_done : feedback.closed`)
			lines.push(`      ${boltId} --> ${nextBoltOrEscalate} : feedback.open`)
		}
		lines.push(`      ${sid}_review_fix_done --> [*]`)
		lines.push(`      ${sid}_review_fix_escalated --> [*]`)
		lines.push(`    }`)
		lines.push(`    ${sid}_review_fix --> ${sid}_gate`)
	} else {
		lines.push(`    state ${sid}_review_fix {`)
		lines.push(`      [*] --> ${sid}_review_fix_escalated`)
		lines.push(`      ${sid}_review_fix_escalated --> [*]`)
		lines.push(`    }`)
		lines.push(`    ${sid}_review_fix --> ${sid}_gate`)
	}

	lines.push(`    ${sid}_gate --> [*]`)
	lines.push(`  }`)
	return lines
}

/** Render a StudioConfig as a Mermaid stateDiagram-v2 source. The
 *  result drops straight into a fenced ```mermaid block in
 *  markdown, or into a `<div class="mermaid">` for the docs site.
 *
 *  maxBolts defaults to 3 (matches MAX_FIX_LOOP_BOLTS in
 *  state/feedback.ts). Override only for documentation that wants
 *  a different cap displayed. */
export function exportStudioMermaid(
	studio: StudioConfig,
	maxBolts = 3,
): string {
	const lines: string[] = []
	lines.push("stateDiagram-v2")
	lines.push(`  %% Auto-generated from StudioConfig for: ${studio.dir}`)
	lines.push(`  %% Do not edit by hand — regenerate via export-mermaid.ts.`)
	lines.push("")
	lines.push("  [*] --> select_studio")

	// First stage from select_studio.
	const firstStage = studio.defaultStages[0]
	if (firstStage) {
		lines.push(
			`  select_studio --> ${sanitizeId(firstStage)} : studio.selected`,
		)
	}

	// Per-stage advancement.
	for (let i = 0; i < studio.defaultStages.length; i++) {
		const cur = studio.defaultStages[i]
		const isLast = i === studio.defaultStages.length - 1
		const next = isLast
			? studio.studioReviewAgents.length > 0
				? "intent_completion_review"
				: "complete"
			: studio.defaultStages[i + 1]
		lines.push(`  ${sanitizeId(cur)} --> ${sanitizeId(next)}`)
	}

	// Intent-completion review/fix layer.
	if (studio.studioReviewAgents.length > 0) {
		lines.push(
			`  intent_completion_review --> intent_completion_gate : review.clean`,
		)
		lines.push(
			`  intent_completion_review --> intent_completion_fix : review.findings`,
		)
	}
	if (studio.studioFixHats.length > 0) {
		lines.push(
			`  intent_completion_fix --> intent_completion_gate : feedback.closed`,
		)
		lines.push(
			`  intent_completion_fix --> intent_completion_fix : feedback.open`,
		)
	}
	if (studio.studioReviewAgents.length > 0) {
		lines.push(`  intent_completion_gate --> complete : gate.approved`)
		const lastStage = studio.defaultStages[studio.defaultStages.length - 1]
		if (lastStage) {
			lines.push(
				`  intent_completion_gate --> ${sanitizeId(lastStage)} : gate.changes_requested`,
			)
		}
	}

	// Per-stage sub-machine bodies.
	lines.push("")
	for (const stageName of studio.defaultStages) {
		const stage = studio.stages[stageName]
		if (!stage) continue
		lines.push(
			...renderStageBlock(
				stageName,
				stage.hats.map((h) => h.name),
				stage.fixHats.map((h) => h.name),
				maxBolts,
			),
		)
		lines.push("")
	}

	// Terminals.
	lines.push("  complete --> [*]")
	lines.push("  error --> [*]")
	lines.push("  escalate --> [*]")
	lines.push("  blocked --> [*]")

	return lines.join("\n")
}
