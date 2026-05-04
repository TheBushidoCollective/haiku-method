// tools/orchestrator/haiku_coverage_acknowledge.ts — Agent-callable MCP tool
// that records an explicit per-file out-of-scope decision for upstream outputs
// the current stage's units do not reference.
//
// Driven by the pre-tick `validateCumulativeInputCoverage` validator: when a
// prior stage's output (unit `outputs:` field or filesystem file under
// `artifacts/`, `outputs/`, `knowledge/`, `discovery/`) is NOT referenced by
// any current-stage unit's `inputs:`, the validator emits a
// `coverage_review_required` action listing the unreferenced files. The agent
// resolves each file by EITHER:
//   (a) calling `haiku_unit_set { unit, field: "inputs", value: [...] }` to
//       add the file to a unit's inputs (the canonical path), OR
//   (b) calling this tool to record an explicit out-of-scope decision +
//       rationale.
//
// Decisions persist to `stages/<stage>/coverage-decisions.json` so the
// validator skips them on subsequent ticks. Reviewers (adversarial spec
// review) can read the decisions file to challenge any out-of-scope call.
//
// This tool is workflow-managed (writes durable engine state) but does NOT
// advance the workflow. The agent calls `haiku_run_next` after acknowledging
// to re-run the validator.

import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { findHaikuRoot } from "../../state-tools.js"
import { defineTool, validateSlugArgs } from "../define.js"

interface CoverageDecisionEntry {
	path: string
	decision: "out-of-scope" | "covered-by-unit"
	rationale: string
	unit?: string
	acknowledged_at: string
}

interface CoverageDecisionsFile {
	stage: string
	decisions: CoverageDecisionEntry[]
}

function coverageDecisionsPath(slug: string, stage: string): string {
	const root = findHaikuRoot()
	return join(root, "intents", slug, "stages", stage, "coverage-decisions.json")
}

function readDecisions(slug: string, stage: string): CoverageDecisionsFile {
	const path = coverageDecisionsPath(slug, stage)
	if (!existsSync(path)) return { stage, decisions: [] }
	try {
		const parsed = JSON.parse(
			readFileSync(path, "utf8"),
		) as Partial<CoverageDecisionsFile>
		return {
			stage: parsed.stage || stage,
			decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
		}
	} catch {
		return { stage, decisions: [] }
	}
}

function writeDecisions(
	slug: string,
	stage: string,
	data: CoverageDecisionsFile,
): void {
	const path = coverageDecisionsPath(slug, stage)
	mkdirSync(dirname(path), { recursive: true })
	const tmp = `${path}.tmp`
	writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`)
	renameSync(tmp, path)
}

function errorResponse(code: string, message: string) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify({ ok: false, code, message }, null, 2),
			},
		],
		isError: true,
	}
}

export default defineTool({
	name: "haiku_coverage_acknowledge",
	description:
		"Record a per-file decision for an upstream output that the current stage's units do not reference. Used to resolve a `coverage_review_required` action emitted by the pre-tick cumulative-input-coverage validator. Decisions persist to `stages/<stage>/coverage-decisions.json`. The decision MUST be either `out-of-scope` (with rationale explaining why this file is not relevant to the current stage's deliverables) or `covered-by-unit` (with the `unit` slug whose `inputs:` field already includes — or will include — the path; redundant for paths added via `haiku_unit_set` but useful when the agent wants to record reasoning). This tool does NOT advance the workflow; call `haiku_run_next` after acknowledging to re-run the validator.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent_slug: {
				type: "string",
				description: "Slug of the active intent.",
			},
			stage: {
				type: "string",
				description:
					"Stage whose coverage decisions are being recorded (the current stage).",
			},
			path: {
				type: "string",
				description:
					"Intent-relative path of the upstream file being acknowledged (e.g., `stages/inception/CONVERSATION-CONTEXT.md` or `stages/design/artifacts/SPA-UI-SPECS.md`). Must match a path enumerated in the `coverage_review_required` action's `unreferenced` list.",
			},
			decision: {
				type: "string",
				enum: ["out-of-scope", "covered-by-unit"],
				description:
					"`out-of-scope`: this file is not relevant to the current stage's deliverables; rationale required. `covered-by-unit`: this file is (or will be) referenced by a unit's `inputs:`; `unit` field required.",
			},
			rationale: {
				type: "string",
				description:
					"Free-text explanation of the decision. Required for `out-of-scope`; recommended for `covered-by-unit`. Reviewers can challenge this rationale during adversarial spec review.",
			},
			unit: {
				type: "string",
				description:
					"Required when `decision` is `covered-by-unit`. The unit slug (e.g., `unit-04-spa-component-security-audit`) whose `inputs:` covers this file.",
			},
		},
		required: ["intent_slug", "stage", "path", "decision", "rationale"],
	},

	async handle(args) {
		const slug = args.intent_slug as string
		const stage = args.stage as string
		const path = args.path as string
		const decision = args.decision as "out-of-scope" | "covered-by-unit"
		const rationale = args.rationale as string
		const unit = args.unit as string | undefined

		const slugCheck = validateSlugArgs({ intent: slug, stage })
		if (slugCheck) return slugCheck

		if (typeof rationale !== "string" || rationale.trim() === "") {
			return errorResponse(
				"empty_rationale",
				"`rationale` must contain at least one non-whitespace character.",
			)
		}

		if (decision === "covered-by-unit" && (!unit || unit.trim() === "")) {
			return errorResponse(
				"unit_required",
				"`unit` is required when decision is `covered-by-unit`.",
			)
		}

		const root = findHaikuRoot()
		const stageDir = join(root, "intents", slug, "stages", stage)
		if (!existsSync(stageDir)) {
			return errorResponse(
				"stage_not_found",
				`Stage '${stage}' not found for intent '${slug}'.`,
			)
		}

		const data = readDecisions(slug, stage)
		// Replace any existing entry for the same path (idempotent re-ack).
		const existingIdx = data.decisions.findIndex((d) => d.path === path)
		const entry: CoverageDecisionEntry = {
			path,
			decision,
			rationale: rationale.trim(),
			acknowledged_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
			...(unit ? { unit } : {}),
		}
		if (existingIdx >= 0) {
			data.decisions[existingIdx] = entry
		} else {
			data.decisions.push(entry)
		}
		writeDecisions(slug, stage, data)

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							ok: true,
							acknowledged: entry,
							total_decisions: data.decisions.length,
							next_step:
								"Call `haiku_run_next` to re-run the cumulative-input-coverage validator. If any files remain unreferenced + unacknowledged, the validator will re-emit `coverage_review_required` with the remaining list.",
						},
						null,
						2,
					),
				},
			],
		}
	},
})
