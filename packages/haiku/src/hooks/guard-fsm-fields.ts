// guard-fsm-fields — PreToolUse hook for Read/Write/Edit/MultiEdit
//
// Enforces the FSM-ownership boundary on H·AI·K·U state files. Generic
// file Read/Write/Edit on FSM-managed paths is denied; agents must use
// the MCP tools (haiku_unit_*, haiku_feedback_*, haiku_run_next).
//
// Scope:
//   - units/*.md   — created/read/updated only via haiku_unit_*  tools
//   - feedback/*.md — created/read/updated only via haiku_feedback_* tools
//   - intent.md, stages/*/state.json, iteration files — FSM-internal
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
// FSM." For honest agents, the redirect message in the denial output
// names the right MCP tool to use.

import { resolve } from "node:path"

function out(s: string): void {
	process.stderr.write(s)
}

interface FsmPathClassification {
	kind: "unit" | "feedback" | "intent" | "stage_state" | null
	intent?: string
	stage?: string
	name?: string // unit name or feedback id (without .md)
}

/**
 * Classify a file path relative to .haiku/intents/ structure. Returns
 * `kind: null` when the path is not FSM-managed.
 */
function classifyPath(absPath: string): FsmPathClassification {
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
	return { kind: null }
}

/**
 * Build the redirect message that points the agent at the correct MCP
 * tool. Different kinds of files have different tool surfaces; we name
 * the specific call shape so the agent doesn't have to guess.
 */
function redirectMessage(toolName: string, cls: FsmPathClassification): string {
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
			`Unit files are FSM-managed — use the MCP tool instead:\n` +
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
			`Feedback files are FSM-managed and act as the unit-of-work for fix-loop hats — use the MCP tool instead:\n` +
			`  ${tool}\n` +
			`Generic file access bypasses fix-loop lifecycle and worktree isolation.`
		)
	}
	if (cls.kind === "intent") {
		return (
			`BLOCKED: Cannot ${op} intent.md via generic ${toolName}. Intent files ` +
			`are FSM-managed — use haiku_intent_get to read fields, haiku_run_next ` +
			`to drive the lifecycle, or call /haiku:repair if state is genuinely corrupted. ` +
			`Direct edits skip the integrity checksum and the FSM's invariants.`
		)
	}
	if (cls.kind === "stage_state") {
		return (
			`BLOCKED: Cannot ${op} stage state.json via generic ${toolName}. Stage state ` +
			`is FSM-internal — every legitimate write happens via haiku_run_next or a ` +
			`dedicated MCP tool. Hand-editing breaks the integrity checksum and the ` +
			`forward-only lifecycle invariants.`
		)
	}
	return ""
}

export async function guardFsmFields(
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
