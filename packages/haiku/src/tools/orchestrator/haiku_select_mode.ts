// tools/orchestrator/haiku_select_mode.ts — Pick a mode for an
// intent. Mirrors haiku_select_studio's three-resolution-path shape:
//   1. Single explicit option → auto-select.
//   2. Elicitation handler available → render a picker (with
//      "Show all..." escape if the supplied options are a strict
//      subset of available modes).
//   3. No elicitation → return action: select_mode_conversational
//      so the agent asks the user via chat.
//
// Mode is engine-managed. The agent never types `mode: <value>` into
// any frontmatter writer — the value flows through this elicitation
// tool only. /haiku:start drives a fresh selection; /haiku:change-mode
// drives a mid-flight change against an already-started intent.
//
// Side effects:
//   - Writes `mode` to intent.md.
//   - For non-quick modes, ALSO writes `stages` to the studio's full
//     stage list (engine-derived, never agent-set). This is what makes
//     the next derive-state tick fall through to `intent_review`
//     instead of dead-ending on `select_stage`.
//   - For quick mode, leaves `stages` empty so the workflow routes
//     to `select_stage` next.
//
// Constraints when called against an already-started intent
// (active_stage set):
//   - Cannot transition INTO quick (would amputate later stages).
//   - Cannot transition OUT OF quick (would suddenly add stages
//     mid-flight, the inverse problem).
// /haiku:change-mode hides the `quick` option from the elicit list
// when the intent has started; /haiku:start only fires before any
// stage starts so this constraint is not load-bearing there.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { getElicitInput, resolveStudioStages } from "../../orchestrator.js"
import {
	HAIKU_SELECT_MODE_INPUT_SCHEMA,
	type HaikuSelectModeInput,
	validateHaikuSelectModeInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { INTENT_MODES } from "../../state/schemas/intent.js"
import {
	deleteFrontmatterFields,
	findHaikuRoot,
	gitCommitState,
	parseFrontmatter,
	setFrontmatterField,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

const MODE_DESCRIPTIONS: Record<string, string> = {
	continuous:
		"Stages auto-advance through the studio. Reviewer approves each gate; the engine drives forward without per-stage PRs.",
	discrete:
		"Every stage opens an external PR/MR. The merge IS the approval signal — the workflow waits at each gate until merged.",
	autopilot:
		"Per-stage gates auto-approve. The pre-stage intent_review gate (one-time, before any stage starts) and the final intent-completion gate (single delivery PR) both still require human review — autopilot trades per-stage friction for a single delivery PR, not zero human gates.",
	"discrete-hybrid":
		"Continuous within most stages, but specific stages declared with external review still pop a per-stage PR.",
	quick:
		"Single stage only. Operates like continuous but the workflow runs exactly one studio stage and stops. Not changeable mid-flight.",
}

export default defineTool({
	name: "haiku_select_mode",
	description:
		"Select an execution mode for an intent. Pass the intent slug and optionally a list of mode names to limit the selection. If only one option is provided, auto-selects it. If elicitation is available, prompts the user; otherwise returns the mode list for conversational selection. Side effects: writes `mode` to intent.md; for non-quick modes also writes `stages` (the studio's full stage list). For quick mode, leaves `stages` empty so the workflow routes to select_stage next. Refuses transitions into or out of `quick` once the intent has started a stage.",
	inputSchema: jsonSchemaOf(HAIKU_SELECT_MODE_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuSelectModeInputSchema,
			"haiku_select_mode",
		)
		if (inputErr) return inputErr
		const validated = args as HaikuSelectModeInput
		const slug = validated.intent
		const root = findHaikuRoot()
		const iDir = join(root, "intents", slug)
		const intentFile = join(iDir, "intent.md")

		if (!existsSync(intentFile)) {
			return text(
				JSON.stringify({
					error: "not_found",
					message: `Intent '${slug}' not found`,
				}),
			)
		}

		const intentFm = readFrontmatter(intentFile)
		const studio = (intentFm.studio as string) || ""
		if (!studio) {
			return text(
				JSON.stringify({
					error: "studio_not_selected",
					message: `Intent '${slug}' has no studio selected. Call haiku_select_studio first.`,
				}),
			)
		}
		const currentMode = ((intentFm.mode as string) || "").toLowerCase()
		const activeStage = (intentFm.active_stage as string) || ""
		const intentStarted = !!activeStage

		// Filter the mode option list:
		//   - Drop `quick` once the intent has started a stage (can't
		//     amputate mid-flight) AND when the current mode is not
		//     quick (can't grow mid-flight either).
		//   - Drop `discrete-hybrid` from the user-facing picker since
		//     it's a derived/virtual mode (per project memory) — the
		//     engine computes hybrid behavior from `continuous` + per-
		//     stage external gates, no need to ask the user for it.
		const allModes = INTENT_MODES.filter((m) => m !== "discrete-hybrid")
		const modesAvailable = allModes.filter((m) => {
			if (m === "quick") {
				if (intentStarted && currentMode !== "quick") return false
				if (intentStarted && currentMode === "quick") return false
				// pre-start: quick is allowed
				return !intentStarted
			}
			// Non-quick modes are always available, but if currentMode is
			// quick and intent has started, refuse to leave quick (would
			// suddenly grow stages mid-flight).
			if (currentMode === "quick" && intentStarted) return false
			return true
		})

		if (modesAvailable.length === 0) {
			return text(
				JSON.stringify({
					error: "no_modes_available",
					message: `Intent '${slug}' is in mode '${currentMode}' and has started — no other mode is reachable from here without resetting.`,
				}),
			)
		}

		const optionsRaw = validated.options ?? []
		const options = optionsRaw.map((o) => o.toLowerCase())

		// Validate any explicit options against the filtered availability.
		if (options.length > 0) {
			const invalid = options.filter(
				(o) => !modesAvailable.includes(o as (typeof modesAvailable)[number]),
			)
			if (invalid.length > 0) {
				return text(
					JSON.stringify({
						error: "invalid_mode_options",
						message: `Mode option(s) [${invalid.join(", ")}] are not available for intent '${slug}'. Available: ${modesAvailable.join(", ")}.`,
					}),
				)
			}
		}

		const elicit = getElicitInput()
		let chosenMode = ""

		if (options.length === 1) {
			chosenMode = options[0]
		} else if (elicit) {
			let elicitChoices: string[]
			let showAllOption = false
			if (options.length === 0 || options.length >= modesAvailable.length) {
				elicitChoices = [...modesAvailable]
			} else {
				elicitChoices = [...options, "Show all modes..."]
				showAllOption = true
			}

			const descriptionLines = elicitChoices
				.filter((m) => m !== "Show all modes...")
				.map((m) => `${m}: ${MODE_DESCRIPTIONS[m] || m}`)
				.join("\n")

			try {
				const result = await elicit({
					message: `Select an execution mode for intent "${slug}":\n\n${descriptionLines}`,
					requestedSchema: {
						type: "object" as const,
						properties: {
							mode: {
								type: "string",
								title: "Mode",
								description: "Which execution mode to use",
								enum: elicitChoices,
							},
						},
						required: ["mode"],
					},
				})
				if (result.action === "accept" && result.content) {
					const content = result.content as Record<string, string>
					if (content.mode === "Show all modes..." && showAllOption) {
						const reElicit = await elicit({
							message: `All available modes:\n\n${modesAvailable
								.map((m) => `${m}: ${MODE_DESCRIPTIONS[m] || m}`)
								.join("\n")}`,
							requestedSchema: {
								type: "object" as const,
								properties: {
									mode: {
										type: "string",
										title: "Mode",
										enum: [...modesAvailable],
									},
								},
								required: ["mode"],
							},
						})
						if (reElicit.action === "accept" && reElicit.content) {
							chosenMode =
								(reElicit.content as Record<string, string>).mode || ""
						} else {
							return text(
								JSON.stringify({
									action: "cancelled",
									message: "Mode selection cancelled by user",
								}),
							)
						}
					} else {
						chosenMode = content.mode || ""
					}
				} else {
					return text(
						JSON.stringify({
							action: "cancelled",
							message: "Mode selection cancelled by user",
						}),
					)
				}
			} catch {
				return {
					content: [
						{
							type: "text" as const,
							text: "Elicitation failed. Pass a single mode in the options array to auto-select.",
						},
					],
					isError: true,
				}
			}
		} else {
			const modeDescriptions = modesAvailable
				.map((m) => `- **${m}**: ${MODE_DESCRIPTIONS[m] || m}`)
				.join("\n")
			return text(
				JSON.stringify(
					{
						action: "select_mode_conversational",
						intent: slug,
						available_modes: modesAvailable,
						message: `Elicitation unavailable. Ask the user which mode to use, then call haiku_select_mode { intent: "${slug}", options: ["<chosen-mode>"] } with a single option to auto-select.\n\nAvailable modes:\n${modeDescriptions}`,
					},
					null,
					2,
				),
			)
		}

		chosenMode = chosenMode.toLowerCase()
		if (
			!modesAvailable.includes(chosenMode as (typeof modesAvailable)[number])
		) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Selected mode '${chosenMode}' is not available for intent '${slug}'. Available: ${modesAvailable.join(", ")}.`,
					},
				],
				isError: true,
			}
		}

		// Re-enforce branch after elicitation completed (the user may have
		// flipped branches while the picker was open).
		const guard = ensureOnStageBranch(slug, undefined)
		if (!guard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed after mode selection for intent '${slug}' — ${guard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		setFrontmatterField(intentFile, "mode", chosenMode)

		// Stages bookkeeping. For non-quick modes, set stages to the
		// studio's full list (engine-derived, never agent-set). For
		// quick, clear stages so the workflow routes to select_stage.
		if (chosenMode === "quick") {
			deleteFrontmatterFields(intentFile, ["stages"])
		} else {
			const studioStages = resolveStudioStages(studio)
			setFrontmatterField(intentFile, "stages", studioStages)
		}

		gitCommitState(`haiku: select mode ${chosenMode} for intent ${slug}`)
		emitTelemetry("haiku.mode.selected", {
			intent: slug,
			mode: chosenMode,
			previous_mode: currentMode || "(none)",
			intent_started: String(intentStarted),
		})

		return text(
			JSON.stringify(
				{
					action: "mode_selected",
					intent: slug,
					mode: chosenMode,
					previous_mode: currentMode || null,
					message:
						chosenMode === "quick"
							? `Mode 'quick' selected for intent '${slug}'. Call haiku_run_next { intent: "${slug}" } — the workflow engine will elicit which single stage next.`
							: `Mode '${chosenMode}' selected for intent '${slug}'. Call haiku_run_next { intent: "${slug}" } to continue.`,
				},
				null,
				2,
			),
		)
	},
})
