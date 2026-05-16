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
	setUnitIterations,
} from "../../orchestrator/workflow/debug-ops.js"
import { runPicker } from "../../server/picker.js"
import {
	HAIKU_DEBUG_INPUT_SCHEMA,
	HAIKU_DEBUG_SUPPORTED_OPS,
	validateHaikuDebugInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { defineTool, validateSlugArgs } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_debug",
	description:
		"ADMIN: bypass-the-FSM tools to unstick corrupt intents. Force a stage complete (signs all reviews/approvals/QGs for units that have moved through every hat), set an intent field (mode, etc.), reset drift (re-stamp witnesses), mutate any feedback frontmatter, or preview the next cursor head after edits. Every mutation requires SPA-picker confirmation — the agent cannot act unilaterally. Use only when the normal workflow can't recover (corrupt FM, stuck loop, lost stamps).",
	// Single source of truth for both the MCP advertisement (re-imported
	// in `tool-defs.ts`) and the per-op dispatch below.
	inputSchema: jsonSchemaOf(HAIKU_DEBUG_INPUT_SCHEMA),
	async handle(args, signal) {
		// Shape gate first — yields the stable named code
		// `haiku_debug_input_invalid` with structured `errors[]` instead of
		// the MCP runtime's generic shape error. Same pattern as
		// `haiku_select_mode` and the rest of the validated state-tools.
		const inputErr = validateToolInput(
			args,
			validateHaikuDebugInputSchema,
			"haiku_debug",
		)
		if (inputErr) return inputErr
		// Path-traversal guard for every slug-shaped arg the dispatch
		// touches. This MUST run before any debug-op is reached — debug-ops
		// pass `intent` / `stage` / `feedback_id` straight into `intentDir()`
		// + `join()`, so a crafted `"../../etc"` would otherwise resolve
		// outside `.haiku/intents/`. Mirrors every other orchestrator tool.
		const slugCheck = validateSlugArgs({
			intent: args.intent,
			stage: args.stage,
			feedback_id: args.feedback_id,
			unit: args.unit,
		})
		if (slugCheck) return slugCheck
		// Batch path: check each feedback_id in the array against the same
		// path-traversal rules.
		if (Array.isArray(args.feedback_ids)) {
			for (const fid of args.feedback_ids as unknown[]) {
				const batchCheck = validateSlugArgs({ feedback_id: fid })
				if (batchCheck) return batchCheck
			}
		}
		const slug = args.intent as string
		const op = args.op as string

		if (
			!HAIKU_DEBUG_SUPPORTED_OPS.includes(
				op as (typeof HAIKU_DEBUG_SUPPORTED_OPS)[number],
			)
		) {
			return errorResponse({
				error: "unsupported_op",
				message: `Unknown op '${op}'. Supported: ${HAIKU_DEBUG_SUPPORTED_OPS.join(", ")}.`,
			})
		}

		// Read-only path: no picker required. Wrapped in its own try/catch
		// because callers reach for this op precisely when an intent is
		// corrupted enough that `derivePosition()` may throw — and the
		// outer try/catch only wraps the post-picker dispatch.
		if (op === "preview_cursor") {
			try {
				const r = previewCursor({ slug })
				return text(JSON.stringify(r))
			} catch (err) {
				return errorResponse({
					error: "preview_cursor_threw",
					detail: err instanceof Error ? err.message : String(err),
				})
			}
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
					const r = forceStageComplete({
						slug,
						targetStage: stage,
						closeOpenFeedback: args.close_open_feedback === true,
					})
					return text(JSON.stringify(r))
				}
				case "set_intent_field": {
					// Batch form: caller passed `fields: { key: value, ... }` —
					// apply all in one call so the picker confirms the whole set
					// once.
					if (args.fields && typeof args.fields === "object") {
						const fields = args.fields as Record<string, unknown>
						const results: Array<{ field: string; result: unknown }> = []
						for (const [field, value] of Object.entries(fields)) {
							results.push({
								field,
								result: setIntentField({ slug, field, value }),
							})
						}
						return text(
							JSON.stringify({ batch: true, count: results.length, results }),
						)
					}
					const field = args.field as string
					const value = args.value
					if (!field) {
						return errorResponse({
							error: "missing_field",
							message: "set_intent_field requires `field` or `fields`",
						})
					}
					const r = setIntentField({ slug, field, value })
					return text(JSON.stringify(r))
				}
				case "reset_drift": {
					const r = resetDrift({ slug })
					return text(JSON.stringify(r))
				}
				case "set_unit_iterations": {
					const stage = args.stage as string
					const unit = args.unit as string
					if (!stage || !unit) {
						return errorResponse({
							error: "missing_stage_or_unit",
							message: "set_unit_iterations requires `stage` and `unit`",
						})
					}
					const iterations = Array.isArray(args.iterations)
						? (args.iterations as Array<{
								hat: string
								result: "advance" | "reject"
								at?: string
							}>)
						: undefined
					const r = setUnitIterations({ slug, stage, unit, iterations })
					return text(JSON.stringify(r))
				}
				case "mutate_feedback": {
					const patch = (args.patch as Record<string, unknown>) ?? {}
					const stage = (args.stage as string) || null
					// Batch form: caller passed `feedback_ids: [...]` — apply the
					// same patch to every FB in one call so the picker confirms
					// the whole set once.
					if (
						Array.isArray(args.feedback_ids) &&
						args.feedback_ids.length > 0
					) {
						const ids = args.feedback_ids as string[]
						const results: Array<{ feedback_id: string; result: unknown }> = []
						for (const fid of ids) {
							results.push({
								feedback_id: fid,
								result: mutateFeedback({
									slug,
									stage,
									feedbackId: fid,
									patch,
								}),
							})
						}
						return text(
							JSON.stringify({ batch: true, count: results.length, results }),
						)
					}
					const feedback_id = args.feedback_id as string
					if (!feedback_id) {
						return errorResponse({
							error: "missing_feedback_id",
							message:
								"mutate_feedback requires `feedback_id` or `feedback_ids`",
						})
					}
					const r = mutateFeedback({
						slug,
						stage,
						feedbackId: feedback_id,
						patch,
					})
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
			if (args.fields && typeof args.fields === "object") {
				return `Set ${Object.keys(args.fields as Record<string, unknown>).length} intent.md frontmatter fields in one call: ${JSON.stringify(args.fields)}.`
			}
			return `Set intent.md frontmatter field '${args.field}' to ${JSON.stringify(args.value)}.`
		case "reset_drift":
			return `Re-stamp every witnessed slot (reviews + approvals on every unit) with the CURRENT on-disk SHA. Drift sweep will stop firing on the same SHA mismatch.`
		case "set_unit_iterations":
			if (Array.isArray(args.iterations) && args.iterations.length > 0) {
				return `Hand-write iterations[] on unit '${args.unit}' in stage '${args.stage}' (${(args.iterations as unknown[]).length} entries). This is the FSM-driven field agents normally cannot touch — the debug op bypasses the schema gate.`
			}
			return `Synthesize iterations[] on unit '${args.unit}' in stage '${args.stage}' — one 'advance' entry per hat in the stage's hats sequence. Use to mark a legacy/partial unit as "moved through every hat" so force_stage_complete will sign it.`
		case "mutate_feedback":
			if (Array.isArray(args.feedback_ids) && args.feedback_ids.length > 0) {
				return `Apply FM patch to ${(args.feedback_ids as string[]).length} feedback records (${(args.feedback_ids as string[]).join(", ")}): ${JSON.stringify(args.patch)}. Bypasses lifecycle guards.`
			}
			return `Apply FM patch to feedback ${args.feedback_id}: ${JSON.stringify(args.patch)}. Bypasses lifecycle guards.`
		default:
			return op
	}
}
