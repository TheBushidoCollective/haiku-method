// tools/orchestrator/haiku_debug.ts — Admin/recovery operations for
// corrupt intents (PR adding /haiku:debug skill, 2026-05-15).
//
// Every op routes through `runPicker` for SPA-confirmation BEFORE
// any state mutation runs. The user explicitly required this:
// "they MUST require elicitation. An agent SHOULD not be able to
// make the choice on its own." The picker call is the gate; the
// user clicks through; only then does the underlying op fire.
//
// For an immediate read-only check (preview_cursor), no picker is
// needed — observation is safe.

import {
	forceStageComplete,
	mutateFeedback,
	previewCursor,
	resetDrift,
	setIntentField,
} from "../../orchestrator/workflow/debug-ops.js"
import { runPicker } from "../../server/picker.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

const SUPPORTED_OPS = [
	"force_stage_complete",
	"set_intent_field",
	"reset_drift",
	"mutate_feedback",
	"preview_cursor",
] as const

export default defineTool({
	name: "haiku_debug",
	description:
		"ADMIN: bypass-the-FSM tools to unstick corrupt intents. Force a stage complete (signs all reviews/approvals/QGs for units that have moved through every hat), set an intent field (mode, etc.), reset drift (re-stamp witnesses), mutate any feedback frontmatter, or preview the next cursor head after edits. Every mutation requires SPA-picker confirmation — the agent cannot act unilaterally. Use only when the normal workflow can't recover (corrupt FM, stuck loop, lost stamps).",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string", description: "Intent slug" },
			op: {
				type: "string",
				enum: [...SUPPORTED_OPS],
				description:
					"Which admin op to run: force_stage_complete, set_intent_field, reset_drift, mutate_feedback, preview_cursor.",
			},
			// op-specific args. Loose schema — the dispatch below validates per-op.
			stage: {
				type: "string",
				description: "Target stage (force_stage_complete, mutate_feedback).",
			},
			field: {
				type: "string",
				description: "intent.md FM key (set_intent_field).",
			},
			value: {
				type: ["string", "array", "number", "boolean", "null", "object"],
				description: "intent.md FM value (set_intent_field).",
			},
			feedback_id: {
				type: "string",
				description: "Feedback ID to mutate (mutate_feedback).",
			},
			patch: {
				type: "object",
				description:
					"FB FM keys to set (mutate_feedback). Example: { status: 'closed', closed_at: '2026-...' }.",
			},
		},
		required: ["intent", "op"],
	},
	async handle(args, signal) {
		const slug = args.intent as string
		const op = args.op as string

		if (!SUPPORTED_OPS.includes(op as (typeof SUPPORTED_OPS)[number])) {
			return errorResponse({
				error: "unsupported_op",
				message: `Unknown op '${op}'. Supported: ${SUPPORTED_OPS.join(", ")}.`,
			})
		}

		// Read-only path: no picker required.
		if (op === "preview_cursor") {
			const r = previewCursor({ slug })
			return text(JSON.stringify(r))
		}

		// All mutating ops require SPA-picker confirmation.
		const description = describeOp(op, args)
		const picker = await runPicker({
			intentSlug: slug,
			kind: "confirm",
			title: `DEBUG: ${op} on ${slug}`,
			prompt: `${description}\n\nThis is an ADMIN op that BYPASSES the normal workflow engine. It mutates state in ways the cursor would not. Confirm only if you understand the consequences.`,
			options: [
				{
					id: "confirm",
					label: `Yes, run ${op}`,
					description:
						"Proceed with the admin op. State will be mutated immediately.",
				},
				{
					id: "cancel",
					label: "Cancel",
					description: "Abort. No state changes.",
				},
			],
			signal,
		})
		if (
			picker.timedOut ||
			!picker.selection ||
			picker.selection.id !== "confirm"
		) {
			return text(
				JSON.stringify({
					action: "cancelled",
					message: `Debug op '${op}' cancelled — no state mutated.`,
				}),
			)
		}

		// User confirmed. Dispatch.
		try {
			switch (op) {
				case "force_stage_complete": {
					const stage = args.stage as string
					if (!stage) {
						return errorResponse({
							error: "missing_stage",
							message: "force_stage_complete requires `stage`",
						})
					}
					const r = forceStageComplete({ slug, targetStage: stage })
					return text(JSON.stringify(r))
				}
				case "set_intent_field": {
					const field = args.field as string
					const value = args.value
					if (!field) {
						return errorResponse({
							error: "missing_field",
							message: "set_intent_field requires `field`",
						})
					}
					const r = setIntentField({ slug, field, value })
					return text(JSON.stringify(r))
				}
				case "reset_drift": {
					const r = resetDrift({ slug })
					return text(JSON.stringify(r))
				}
				case "mutate_feedback": {
					const feedback_id = args.feedback_id as string
					const patch = (args.patch as Record<string, unknown>) ?? {}
					const stage = (args.stage as string) || null
					if (!feedback_id) {
						return errorResponse({
							error: "missing_feedback_id",
							message: "mutate_feedback requires `feedback_id`",
						})
					}
					const r = mutateFeedback({ slug, stage, feedbackId: feedback_id, patch })
					return text(JSON.stringify(r))
				}
				default:
					return errorResponse({ error: "unhandled_op", op })
			}
		} catch (err) {
			return errorResponse({
				error: "debug_op_threw",
				op,
				detail: err instanceof Error ? err.message : String(err),
			})
		}
	},
})

function errorResponse(payload: Record<string, unknown>) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(payload) }],
		isError: true as const,
	}
}

function describeOp(op: string, args: Record<string, unknown>): string {
	switch (op) {
		case "force_stage_complete":
			return `Sign every review + approval + intent_quality_gates for every unit in stages up to and including '${args.stage}'. Refuses units that haven't reached terminal hat advance.`
		case "set_intent_field":
			return `Set intent.md frontmatter field '${args.field}' to ${JSON.stringify(args.value)}.`
		case "reset_drift":
			return `Re-stamp every witnessed slot (reviews + approvals on every unit) with the CURRENT on-disk SHA. Drift sweep will stop firing on the same SHA mismatch.`
		case "mutate_feedback":
			return `Apply FM patch to feedback ${args.feedback_id}: ${JSON.stringify(args.patch)}. Bypasses lifecycle guards.`
		default:
			return op
	}
}
