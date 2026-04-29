// orchestrator/tool-defs.ts — MCP tool definitions for orchestration tools.
//
// Pure declaration of name + description + inputSchema for every
// haiku_* tool that drives the workflow engine (intent create, run-next, revisit,
// archive, etc.). Handlers stay in orchestrator.ts (handleOrchestratorTool
// switch).

export const orchestratorToolDefs = [
	{
		name: "haiku_run_next",
		description:
			"Advance an intent through its lifecycle. The workflow engine reads state, determines the next action, " +
			"performs the state mutation (start stage, advance phase, complete stage, etc.), and returns " +
			"the action to the agent. The agent follows the returned action — it never mutates stage or " +
			"intent state directly. " +
			"When `intent` is omitted, the workflow engine auto-resolves it from the current git branch " +
			"(`haiku/<slug>/main` or `haiku/<slug>/<stage>`) — lets pickup/revisit skills be thin " +
			"one-line redirects without asking the user to pick an intent the checkout already names. " +
			"If omitted and no branch match exists, falls back to the single active intent; errors " +
			"when zero or multiple active intents are present.",
		inputSchema: {
			type: "object" as const,
			properties: {
				intent: {
					type: "string",
					description:
						"Intent slug. Omit to auto-resolve from the current git branch or the sole active intent.",
				},
				external_review_url: {
					type: "string",
					description: "URL where stage was submitted for external review",
				},
			},
		},
	},
	// haiku_gate_approve removed — gates are handled by the workflow engine (review UI + elicitation fallback)
	{
		name: "haiku_intent_create",
		description:
			'Create a new H·AI·K·U intent. Studio selection happens separately via haiku_select_studio. You must provide BOTH a crisp `title` (3–8 words, ≤80 chars, single line, no trailing punctuation — e.g. "Add archivable intents") AND a richer `description` (2–5 sentences covering scope, motivation, and constraints). The title is NOT derived from the description — write it deliberately as a human-readable summary.',
		inputSchema: {
			type: "object" as const,
			properties: {
				title: {
					type: "string",
					description:
						'Short human-readable title (3–8 words, max 80 chars, single line, no trailing period). Must be a deliberate summary — NOT the first 80 chars of the description. Good: "Add archivable intents". Bad: "Add archivable intents to H·AI·K·U. Users need a way to soft-hide…".',
				},
				description: {
					type: "string",
					description:
						"Full description of what the intent is about (2–5 sentences covering scope, motivation, and constraints). Stored verbatim in the intent body.",
				},
				slug: {
					type: "string",
					description:
						"URL-friendly slug for the intent (auto-generated from title if not provided)",
				},
				context: {
					type: "string",
					description:
						"Conversation context summary — highlights from the conversation that led to this intent",
				},
				mode: {
					type: "string",
					description:
						"Execution mode: continuous (stages auto-advance) or discrete (pause between stages). Defaults to continuous.",
					enum: ["continuous", "discrete"],
				},
				stages: {
					type: "array",
					items: { type: "string" },
					description:
						"Explicit stage list — overrides the studio's default stages. Use to run a subset of stages (e.g. just ['development'] for quick tasks).",
				},
			},
			required: ["title", "description"],
		},
	},
	{
		name: "haiku_select_studio",
		description:
			"Select or change the studio for an intent. Uses elicitation to present studio options. Cannot be used after the intent has entered any stage.",
		inputSchema: {
			type: "object" as const,
			properties: {
				intent: { type: "string", description: "Intent slug" },
				options: {
					type: "array",
					items: { type: "string" },
					description:
						"Studio names to present. Empty or omitted = all studios. Single item = auto-select.",
				},
			},
			required: ["intent"],
		},
	},
	{
		name: "haiku_intent_reset",
		description:
			"Reset an intent — preserves the description, deletes all state, and recreates the intent from scratch. Asks for confirmation via elicitation before proceeding.",
		inputSchema: {
			type: "object" as const,
			properties: {
				intent: { type: "string", description: "Intent slug to reset" },
			},
			required: ["intent"],
		},
	},
	{
		name: "haiku_intent_archive",
		description:
			"Archive an intent — sets the `archived: true` frontmatter flag so the intent is hidden from default list views. Reversible via haiku_intent_unarchive. Does not prompt for confirmation.",
		inputSchema: {
			type: "object" as const,
			properties: {
				intent: { type: "string", description: "Intent slug to archive" },
			},
			required: ["intent"],
		},
	},
	{
		name: "haiku_intent_unarchive",
		description:
			"Unarchive an intent — clears the `archived` frontmatter flag so the intent reappears in default list views. Reversible via haiku_intent_archive. Does not prompt for confirmation.",
		inputSchema: {
			type: "object" as const,
			properties: {
				intent: { type: "string", description: "Intent slug to unarchive" },
			},
			required: ["intent"],
		},
	},
]
