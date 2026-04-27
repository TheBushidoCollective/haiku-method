// tools/orchestrator/haiku_select_studio.ts — Pick a studio for an
// intent. Refuses if the intent has already entered any stage (any
// state.json exists with status != "pending"). Three resolution
// paths:
//   1. Single explicit option → auto-select.
//   2. Elicitation handler available → render a picker (with
//      "Show all..." escape if the supplied options are a strict
//      subset of available studios).
//   3. No elicitation → return action: select_studio_conversational
//      so the agent asks the user via chat.
//
// On selection, writes studio + (optionally) stages to intent.md and
// re-enforces the branch guard — the user may have flipped branches
// while the picker was open.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { getElicitInput, resolveStudioStages } from "../../orchestrator.js"
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
import { text } from "./_text.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

export default defineTool({
	name: "haiku_select_studio",
	description:
		"Select a studio for an intent. Pass the intent slug and optionally a list of studio names to limit the selection. If only one option is provided, auto-selects it. If elicitation is available, prompts the user; otherwise returns the studio list for conversational selection. Refuses if the intent has already entered a stage.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string" },
			options: { type: "array", items: { type: "string" } },
		},
		required: ["intent"],
	},
	async handle(args) {
		const slug = args.intent as string
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

		// Refuse if intent has entered any stage (any state.json with
		// status != "pending").
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
									text: "Cannot change studio after intent has entered a stage.",
								},
							],
							isError: true,
						}
					}
				}
			}
		}

		const allStudios = listStudios()
		const allStudioNames = allStudios.map((s) => s.name)

		if (allStudios.length === 0) {
			return {
				content: [{ type: "text" as const, text: "No studios available." }],
				isError: true,
			}
		}

		const options = (args.options as string[] | undefined) || []
		// selectedStudio stores the directory name (stable on-disk
		// identifier) — UI displays the canonical `name`, but everything
		// downstream reads by `dir`.
		let selectedStudio = ""

		const elicit = getElicitInput()

		if (options.length === 1) {
			const resolved = resolveStudio(options[0])
			if (!resolved) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Studio '${options[0]}' not found. Available: ${allStudioNames.join(", ")}`,
						},
					],
					isError: true,
				}
			}
			selectedStudio = resolved.dir
		} else if (elicit) {
			let elicitChoices: string[]
			let showAllOption = false

			// Map provided options (which may be any alias form) to canonical names.
			const mappedOptions = options
				.map((o) => resolveStudio(o))
				.filter((s): s is NonNullable<typeof s> => s !== null)
				.map((s) => s.name)

			if (
				!options ||
				options.length === 0 ||
				mappedOptions.length >= allStudioNames.length
			) {
				elicitChoices = allStudioNames
			} else if (mappedOptions.length === 0) {
				elicitChoices = allStudioNames
			} else {
				elicitChoices = [...mappedOptions, "Show all studios..."]
				showAllOption = true
			}

			const descriptionLines = allStudios
				.filter((s) => elicitChoices.includes(s.name))
				.map((s) => {
					const slugPart = s.slug && s.slug !== s.name ? ` (${s.slug})` : ""
					return `${s.name}${slugPart}: ${s.description || s.name}`
				})
				.join("\n")

			try {
				const elicitResult = await elicit({
					message: `Select a studio for intent "${slug}":\n\n${descriptionLines}`,
					requestedSchema: {
						type: "object" as const,
						properties: {
							studio: {
								type: "string",
								title: "Studio",
								description: "Which studio lifecycle to use",
								enum: elicitChoices,
							},
						},
						required: ["studio"],
					},
				})

				if (elicitResult.action === "accept" && elicitResult.content) {
					const content = elicitResult.content as Record<string, string>
					let chosen: string
					if (content.studio === "Show all studios..." && showAllOption) {
						const allDescriptions = allStudios
							.map((s) => {
								const slugPart =
									s.slug && s.slug !== s.name ? ` (${s.slug})` : ""
								return `${s.name}${slugPart}: ${s.description || s.name}`
							})
							.join("\n")
						const reElicit = await elicit({
							message: `All available studios:\n\n${allDescriptions}`,
							requestedSchema: {
								type: "object" as const,
								properties: {
									studio: {
										type: "string",
										title: "Studio",
										enum: allStudioNames,
									},
								},
								required: ["studio"],
							},
						})
						if (reElicit.action === "accept" && reElicit.content) {
							chosen = (reElicit.content as Record<string, string>).studio || ""
						} else {
							return text(
								JSON.stringify({
									action: "cancelled",
									message: "Studio selection cancelled by user",
								}),
							)
						}
					} else {
						chosen = content.studio || ""
					}
					const resolved = resolveStudio(chosen)
					selectedStudio = resolved ? resolved.dir : ""
				} else {
					return text(
						JSON.stringify({
							action: "cancelled",
							message: "Studio selection cancelled by user",
						}),
					)
				}
			} catch {
				return {
					content: [
						{
							type: "text" as const,
							text: "Elicitation failed. Pass a single studio in the options array to auto-select.",
						},
					],
					isError: true,
				}
			}
		} else {
			// No elicitation available — return studio list so agent can ask
			// conversationally.
			const studioDescriptions = allStudios
				.map((s) => {
					const slugPart = s.slug && s.slug !== s.name ? ` _(${s.slug})_` : ""
					return `- **${s.name}**${slugPart}: ${s.description || ""}`
				})
				.join("\n")
			return text(
				JSON.stringify(
					{
						action: "select_studio_conversational",
						intent: slug,
						available_studios: allStudios.map((s) => ({
							name: s.name,
							slug: s.slug,
							aliases: s.aliases,
							description: s.description,
							category: s.category,
						})),
						message: `Elicitation unavailable. Ask the user which studio to use, then call haiku_select_studio { intent: "${slug}", options: ["<chosen-studio>"] } with a single option to auto-select. The option may be the canonical name, slug, or any alias.\n\nAvailable studios:\n${studioDescriptions}`,
					},
					null,
					2,
				),
			)
		}

		if (!selectedStudio) {
			return {
				content: [{ type: "text" as const, text: "No studio selected." }],
				isError: true,
			}
		}

		// Re-enforce branch after the studio-selection elicit(s) completed.
		// Studio selection is pre-stage — the intent has no active_stage
		// yet — so ensureOnStageBranch correctly falls back to intent-main.
		// The user may have flipped branches while the picker was open;
		// subsequent writes to intent.md must land on intent-main.
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

		// Update intent.md with selected studio — only set stages if not
		// already overridden.
		const intentFmCheck = readFrontmatter(intentFile)
		const existingStages = intentFmCheck.stages as string[] | undefined
		const allStudioStages = resolveStudioStages(selectedStudio)

		if (existingStages && existingStages.length > 0) {
			const invalid = existingStages.filter((s) => !allStudioStages.includes(s))
			if (invalid.length > 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Invalid stages for studio '${selectedStudio}': ${invalid.join(", ")}. Available stages: ${allStudioStages.join(", ")}`,
						},
					],
					isError: true,
				}
			}
		}

		const activeStages =
			existingStages && existingStages.length > 0
				? existingStages // stages were set at creation time (e.g. quick mode)
				: allStudioStages
		setFrontmatterField(intentFile, "studio", selectedStudio)
		if (!existingStages || existingStages.length === 0) {
			setFrontmatterField(intentFile, "stages", activeStages)
		}

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
					stages: activeStages,
					all_studio_stages: allStudioStages,
					message: `Studio '${selectedStudio}' selected for intent '${slug}'. Call haiku_run_next { intent: "${slug}" } to begin.`,
				},
				null,
				2,
			),
		)
	},
})
