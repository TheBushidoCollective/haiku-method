// tools/orchestrator/haiku_select_studio.ts — Pick a studio for an
// intent.
//
// Refuses if the intent has already entered any stage. Two
// resolution paths:
//   1. Single explicit option → auto-select.
//   2. Otherwise → open the SPA picker and block on the user's
//      choice. Picker is the ONLY interactive path (2026-05-07);
//      MCP elicitation has been removed entirely.
//
// In path 2 the picker is pre-narrowed: a shortlist (explicit
// `options`, else the `studio_candidates` the agent stamped on
// intent.md at create time) renders first, and every other studio is
// flagged `secondary` so the SPA tucks it behind a "Show all"
// expansion. The full registry always rides along — narrowing is
// never lossy. No shortlist → all studios render as primaries.
//
// On selection, writes studio to intent.md and re-enforces the
// branch guard. Studio is locked once written — every other tool
// that mutates intent state refuses to change it.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { resolveStudioStages } from "../../orchestrator.js"
import { runPicker } from "../../server/picker.js"
import {
	HAIKU_SELECT_STUDIO_INPUT_SCHEMA,
	type HaikuSelectStudioInput,
	validateHaikuSelectStudioInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import {
	findHaikuRoot,
	gitCommitState,
	parseFrontmatter,
	readJson,
	setFrontmatterField,
} from "../../state-tools.js"
import { listStudios, resolveStudio } from "../../studio-reader.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { withAnnouncement } from "./_announce.js"
import { text } from "./_text.js"
import { buildStudioPickerOptions } from "./studio-picker-options.js"

export default defineTool({
	name: "haiku_select_studio",
	description:
		"Select a studio for an intent. Pass the intent slug and optionally a list of studio names to limit the selection. If only one option is provided, auto-selects it. Otherwise opens a SPA picker and blocks on the user's selection. Refuses if the intent has already entered a stage. The studio is locked once written — it cannot be changed later.",
	inputSchema: jsonSchemaOf(HAIKU_SELECT_STUDIO_INPUT_SCHEMA),
	async handle(args, signal) {
		const inputErr = validateToolInput(
			args,
			validateHaikuSelectStudioInputSchema,
			"haiku_select_studio",
		)
		if (inputErr) return inputErr
		const validated = args as HaikuSelectStudioInput
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

		// Refuse if intent has entered any stage.
		const stagesDir = join(iDir, "stages")
		if (existsSync(stagesDir)) {
			for (const entry of readdirSync(stagesDir, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue
				const statePath = join(stagesDir, entry.name, "state.json")
				if (existsSync(statePath)) {
					const state = readJson(statePath)
					if (state.status && state.status !== "pending") {
						return {
							content: [
								{
									type: "text" as const,
									text: "Cannot change studio after intent has entered a stage. Studio is locked at start.",
								},
							],
							isError: true,
						}
					}
				}
			}
		}

		// Hide deprecated studios from the new-intent picker. They stay
		// resolvable by name (resolveStudio) so in-flight intents on a
		// deprecated studio keep working — they just can't be picked anew.
		const allStudios = listStudios().filter((s) => s.data.deprecated !== true)
		if (allStudios.length === 0) {
			return {
				content: [{ type: "text" as const, text: "No studios available." }],
				isError: true,
			}
		}

		const options = validated.options ?? []
		let selectedStudio = ""

		// Path 1: single option → auto-select.
		if (options.length === 1) {
			const resolved = resolveStudio(options[0])
			if (!resolved) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Studio '${options[0]}' not found. Available: ${allStudios.map((s) => s.name).join(", ")}`,
						},
					],
					isError: true,
				}
			}
			selectedStudio = resolved.dir
		} else {
			// Path 2: open SPA picker. Build the shortlist the user sees
			// first. Two sources, in priority order:
			//   1. Explicit `options` passed by the caller (e.g. a direct
			//      `/haiku:haiku-change-mode`-style invocation).
			//   2. `studio_candidates` stamped on intent.md at create time
			//      — the agent's semantic 2–4 pick from the description.
			// The picker ALWAYS carries every studio so "Show all" never
			// needs a re-elicitation round trip; shortlist studios render
			// up front, the rest are flagged `secondary` and tucked behind
			// the SPA's expansion. An empty shortlist (no options, no
			// candidates, or none resolve) → every studio renders as a
			// primary, exactly like before.
			const mappedOptions = options
				.map((o) => resolveStudio(o))
				.filter((s): s is NonNullable<typeof s> => s !== null)
				.map((s) => s.name)
			let shortlistNames = mappedOptions
			if (shortlistNames.length === 0) {
				let fmCandidates: unknown = []
				try {
					const { data } = parseFrontmatter(readFileSync(intentFile, "utf8"))
					fmCandidates = data.studio_candidates
				} catch {
					/* missing/unreadable FM → no shortlist, fall through to all */
				}
				if (Array.isArray(fmCandidates)) {
					shortlistNames = fmCandidates
						.filter((c): c is string => typeof c === "string")
						.map((c) => resolveStudio(c))
						.filter((s): s is NonNullable<typeof s> => s !== null)
						.map((s) => s.name)
				}
			}
			const pickerOptions = buildStudioPickerOptions(allStudios, shortlistNames)

			const result = await runPicker({
				intentSlug: slug,
				kind: "studio",
				title: `Pick a studio for "${slug}"`,
				prompt:
					"Studios are locked once chosen — pick the lifecycle that matches the work. You can adjust the mode mid-flight, but not the studio.",
				options: pickerOptions,
				signal,
			})

			if (result.timedOut || !result.selection) {
				return text(
					JSON.stringify({
						action: "cancelled",
						message: withAnnouncement(
							"Studio picker timed out without a selection.",
							"Ask the user how they'd like to proceed — retry the picker or abandon the intent.",
						),
					}),
				)
			}
			selectedStudio = result.selection.id
		}

		if (!selectedStudio) {
			return {
				content: [{ type: "text" as const, text: "No studio selected." }],
				isError: true,
			}
		}

		// Re-enforce branch after the picker session — user may have
		// flipped checkouts while the picker was open.
		const postStudioGuard = ensureOnStageBranch(slug, undefined)
		if (!postStudioGuard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed after studio selection for intent '${slug}' — ${postStudioGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		const allStudioStages = resolveStudioStages(selectedStudio)
		setFrontmatterField(intentFile, "studio", selectedStudio)
		gitCommitState(`haiku: select studio ${selectedStudio} for intent ${slug}`)
		emitTelemetry("haiku.studio.selected", {
			intent: slug,
			studio: selectedStudio,
		})

		return text(
			JSON.stringify(
				{
					action: "studio_selected",
					intent: slug,
					studio: selectedStudio,
					all_studio_stages: allStudioStages,
					message: withAnnouncement(
						`The user selected the **${selectedStudio}** studio for "${slug}". Studio is now locked.`,
						`Continue the tick — the engine will drive the next selection (mode, then stage if quick) automatically.`,
					),
				},
				null,
				2,
			),
		)
	},
})
