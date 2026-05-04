// guard-workflow-fields — PreToolUse hook for Read/Write/Edit/MultiEdit
//
// Enforces the workflow engine-ownership boundary on H·AI·K·U state files. Generic
// file Read/Write/Edit on workflow-managed paths is denied; agents must use
// the MCP tools (haiku_unit_*, haiku_feedback_*, haiku_run_next).
//
// Scope:
//   - units/*.md   — created/read/updated only via haiku_unit_*  tools
//   - feedback/*.md — created/read/updated only via haiku_feedback_* tools
//   - intent.md, stages/*/state.json, iteration files — workflow engine-internal
//
// Why this is broader than the prior "block status=completed" check:
// the old check fired on any edit whose post-edit content contained
// `status: completed`, which incorrectly blocked legitimate edits to
// other frontmatter fields on already-completed units. It also could
// be bypassed by writing the file via Bash (cat/sed/python). The path-
// boundary approach is both narrower (only fires on genuinely off-limit
// operations) and stronger (agents are funnelled through MCP tools that
// enforce lifecycle, FM validity, and integrity sealing in one place).
//
// Bash bypass is acknowledged but not blocked here — see the soft Bash
// warn rule below. The threat model is "honest agent reaches for the
// wrong tool by habit," not "adversarial agent tries to subvert the
// workflow engine." For honest agents, the redirect message in the denial output
// names the right MCP tool to use.

import { resolve } from "node:path"

function out(s: string): void {
	process.stderr.write(s)
}

interface WorkflowPathClassification {
	kind:
		| "unit"
		| "feedback"
		| "intent"
		| "stage_state"
		| "settings"
		| "baseline_ack"
		| "baseline_thrash"
		| null
	intent?: string
	stage?: string
	name?: string // unit name or feedback id (without .md)
}

/**
 * Classify a file path relative to .haiku/intents/ structure. Returns
 * `kind: null` when the path is not workflow-managed.
 */
function classifyPath(absPath: string): WorkflowPathClassification {
	const unitMatch = absPath.match(
		/\.haiku\/intents\/([^/]+)\/stages\/([^/]+)\/units\/([^/]+)\.md$/,
	)
	if (unitMatch) {
		return {
			kind: "unit",
			intent: unitMatch[1],
			stage: unitMatch[2],
			name: unitMatch[3],
		}
	}
	const fbMatch = absPath.match(
		/\.haiku\/intents\/([^/]+)\/(?:stages\/([^/]+)\/)?feedback\/([^/]+)\.md$/,
	)
	if (fbMatch) {
		return {
			kind: "feedback",
			intent: fbMatch[1],
			stage: fbMatch[2] || undefined,
			name: fbMatch[3],
		}
	}
	if (/\.haiku\/intents\/[^/]+\/intent\.md$/.test(absPath)) {
		return { kind: "intent" }
	}
	if (/\.haiku\/intents\/[^/]+\/stages\/[^/]+\/state\.json$/.test(absPath)) {
		return { kind: "stage_state" }
	}
	// V-11: operator-only baseline-corrupt acknowledgement marker. Only
	// /haiku:repair --confirm-baseline-reset (operator-driven) may
	// place this; the agent has no path. Block both reads and writes
	// — a reader could leak the diff hash to an attacker chain.
	if (/\.haiku\/intents\/[^/]+\/stages\/[^/]+\/\.baseline-ack$/.test(absPath)) {
		return { kind: "baseline_ack" }
	}
	// V-11: baseline-corruption thrash counter. Workflow-engine-managed.
	if (
		/\.haiku\/intents\/[^/]+\/stages\/[^/]+\/baseline-thrash\.json$/.test(
			absPath,
		)
	) {
		return { kind: "baseline_thrash" }
	}
	// `.haiku/settings.yml` (project root config) — and anchor on the
	// trailing segment to avoid false positives on `.haiku/intents/<x>/settings.yml`
	// or unrelated paths that happen to contain "settings.yml".
	if (/(?:^|\/)\.haiku\/settings\.yml$/.test(absPath)) {
		return { kind: "settings" }
	}
	return { kind: null }
}

/**
 * Build the redirect message that points the agent at the correct MCP
 * tool. Different kinds of files have different tool surfaces; we name
 * the specific call shape so the agent doesn't have to guess.
 */
function redirectMessage(
	toolName: string,
	cls: WorkflowPathClassification,
): string {
	const op =
		toolName === "Read"
			? "read"
			: toolName === "Write"
				? "create or overwrite"
				: "edit"
	const intent = cls.intent ?? "<slug>"
	const stage = cls.stage ?? "<stage>"
	const name = cls.name ?? "<name>"

	if (cls.kind === "unit") {
		const tool =
			op === "read"
				? `haiku_unit_read { intent: "${intent}", stage: "${stage}", unit: "${name}" }`
				: op === "create or overwrite"
					? `haiku_unit_write { intent: "${intent}", stage: "${stage}", unit: "${name}", body: "...", frontmatter: { ... } }`
					: `haiku_unit_set { intent: "${intent}", stage: "${stage}", unit: "${name}", field: "...", value: "..." }`
		return (
			`BLOCKED: Cannot ${op} unit file '${name}.md' via generic ${toolName}. ` +
			`Unit files are workflow-managed — use the MCP tool instead:\n` +
			`  ${tool}\n` +
			`Generic file access bypasses lifecycle enforcement (pending → active → completed), ` +
			`frontmatter validation (DAG, schema, cross-references), and integrity sealing.`
		)
	}
	if (cls.kind === "feedback") {
		const stagePart = cls.stage ? `stage: "${stage}", ` : ""
		const tool =
			op === "read"
				? `haiku_feedback_read { intent: "${intent}", ${stagePart}feedback_id: "${name}" }`
				: op === "create or overwrite"
					? // Existing FB → rewrite body via haiku_feedback_write.
						// Brand-new FB → use haiku_feedback (omit feedback_id).
						`haiku_feedback_write { intent: "${intent}", ${stagePart}feedback_id: "${name}", body: "..." }\n  (or haiku_feedback { intent: "${intent}", ${stagePart}title: "...", body: "...", origin: "...", author: "..." } if you're creating a brand-new finding)`
					: `haiku_feedback_write { intent: "${intent}", ${stagePart}feedback_id: "${name}", body: "..." }`
		return (
			`BLOCKED: Cannot ${op} feedback file '${name}.md' via generic ${toolName}. ` +
			`Feedback files are workflow-managed and act as the unit-of-work for fix-loop hats — use the MCP tool instead:\n` +
			`  ${tool}\n` +
			`Generic file access bypasses fix-loop lifecycle and worktree isolation.`
		)
	}
	if (cls.kind === "intent") {
		return (
			`BLOCKED: Cannot ${op} intent.md via generic ${toolName}. Intent files ` +
			`are workflow-managed — use haiku_intent_get to read fields, haiku_run_next ` +
			`to drive the lifecycle, or call /haiku:repair if state is genuinely corrupted. ` +
			`Direct edits skip the integrity checksum and the workflow engine's invariants.`
		)
	}
	if (cls.kind === "stage_state") {
		return (
			`BLOCKED: Cannot ${op} stage state.json via generic ${toolName}. Stage state ` +
			`is workflow engine-internal — every legitimate write happens via haiku_run_next or a ` +
			`dedicated MCP tool. Hand-editing breaks the integrity checksum and the ` +
			`forward-only lifecycle invariants.`
		)
	}
	if (cls.kind === "baseline_ack") {
		return (
			`BLOCKED: Cannot ${op} .baseline-ack via generic ${toolName}. This is the V-11 ` +
			`operator-only baseline-corrupt acknowledgement marker. Only ` +
			`/haiku:repair --confirm-baseline-reset --diff-shown --confirm-diff-hash <sha> ` +
			`(operator-driven) may write it; the agent has no path here. Reads are also ` +
			`blocked because the diff hash leaking to an attacker chain would let them ` +
			`forge a valid-looking ack.`
		)
	}
	if (cls.kind === "baseline_thrash") {
		return (
			`BLOCKED: Cannot ${op} baseline-thrash.json via generic ${toolName}. This is the ` +
			`V-11 baseline-corruption circuit-breaker counter — workflow-engine-managed. ` +
			`Letting the agent reset it would let an attacker zero out the thrash detector ` +
			`right before each corruption attempt.`
		)
	}
	if (cls.kind === "settings") {
		const tool =
			op === "read"
				? `haiku_settings_get { field: "..." }`
				: `haiku_settings_set { field: "...", value: ... }`
		return (
			`BLOCKED: Cannot ${op} .haiku/settings.yml via generic ${toolName}. Settings ` +
			`are schema-managed against plugin/schemas/settings.schema.json — use the MCP tool instead:\n` +
			`  ${tool}\n` +
			`Generic file access skips schema validation and can drop settings into a shape ` +
			`the engine refuses to load.`
		)
	}
	return ""
}

export async function guardWorkflowFields(
	input: Record<string, unknown>,
): Promise<void> {
	const toolName = (input.tool_name as string) || ""
	if (
		toolName !== "Read" &&
		toolName !== "Write" &&
		toolName !== "Edit" &&
		toolName !== "MultiEdit"
	)
		return

	const toolInput = (input.tool_input || {}) as Record<string, unknown>
	const filePath = (toolInput.file_path as string) || ""
	if (!filePath) return

	const absPath = resolve(process.cwd(), filePath)
	const cls = classifyPath(absPath)
	if (cls.kind === null) return

	out(redirectMessage(toolName, cls))
	process.exit(2)
}

import { defineHook } from "./define.js"

export default defineHook({
	name: "guard-workflow-fields",
	description:
		"PreToolUse Read/Write/Edit/MultiEdit: enforce workflow-ownership boundary on .haiku state files (units, feedback, intent.md, stage state.json) — agents must use the corresponding MCP tools.",
	async handle(input, _ctx) {
		await guardWorkflowFields(input)
	},
})
