import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
	CallToolRequestSchema,
	CompleteRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import {
	execNewBinary,
	hasPendingUpdate,
	startUpdateChecker,
	stopUpdateChecker,
} from "./auto-update.js"
import { stripWildcardAllowedOrigins } from "./config.js"
import { stopHttpServer } from "./http.js"
import { flush as flushSentry, reportError } from "./sentry.js"

const server = new Server(
	{ name: "haiku-review", version: "0.1.0" },
	{
		capabilities: {
			tools: {},
			prompts: { listChanged: true },
			completions: {},
		},
	},
)

import { getCapabilities, isClaudeCode } from "./harness.js"
import {
	orchestratorToolDefs,
	setElicitInputHandler,
	setOpenReviewHandler,
} from "./orchestrator.js"
// Prompts: for Claude Code, skills are native; for other harnesses, we bridge
// skills → MCP prompts so they surface as invocable actions.
import { completeArgument, getPrompt, listPrompts } from "./prompts/index.js"
import { registerSkillPrompts } from "./prompts/skill-bridge.js"
import { createReviewGateHandler, handleToolCall } from "./server/tool-call.js"
import { stateToolDefs } from "./state-tools.js"

// Bridge skills to MCP prompts for harnesses that lack native skill support.
// For Claude Code this is a no-op (skills are native). For Gemini CLI, prompts
// surface as slash commands. For Cursor/Windsurf/Kiro, prompts appear in the
// prompt UI. For OpenCode, prompts support is partial but growing.
if (!isClaudeCode()) {
	const caps = getCapabilities()
	if (caps.mcpPrompts) {
		registerSkillPrompts()
	}
}

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
	prompts: listPrompts(),
}))

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
	return getPrompt(request.params.name, request.params.arguments)
})

server.setRequestHandler(CompleteRequestSchema, async (request) => {
	return completeArgument(request.params)
})

// List tools — filtered by harness capabilities
server.setRequestHandler(ListToolsRequestSchema, async () => {
	const caps = getCapabilities()
	const allTools = [
		// Orchestration tools
		...orchestratorToolDefs,
		// State management tools
		...stateToolDefs,
		// open_review is internal — used by the workflow engine for gate_ask, not exposed to the agent
		{
			name: "ask_user_visual_question",
			description:
				"Ask the user one or more questions via a rich HTML page in the browser. " +
				"Renders questions with selectable options (radio or checkbox) and an optional 'Other' field. " +
				"ALWAYS provide concrete options[] for each question — never leave the user to type freeform when you know the alternatives. " +
				"Use this instead of AskUserQuestion when: (1) questions involve visual artifacts or image_paths, " +
				"(2) you need rich markdown context above the questions, or (3) you have multiple related questions " +
				"that benefit from being presented together (each as a separate entry in the questions[] array). " +
				"For unrelated questions, make separate tool calls instead of bundling them.",
			inputSchema: {
				type: "object" as const,
				properties: {
					questions: {
						type: "array",
						items: {
							type: "object",
							properties: {
								question: { type: "string", description: "The question text" },
								header: {
									type: "string",
									description: "Optional header/subtitle",
								},
								options: {
									type: "array",
									items: { type: "string" },
									description: "Answer options",
								},
								multiSelect: {
									type: "boolean",
									description: "Allow multiple selections",
								},
							},
							required: ["question", "options"],
						},
						description: "Questions to present to the user",
					},
					context: {
						type: "string",
						description: "Optional markdown context above questions",
					},
					title: { type: "string", description: "Optional page title" },
					image_paths: {
						type: "array",
						items: { type: "string" },
						description:
							"Optional local image file paths to display alongside questions",
					},
				},
				required: ["questions"],
			},
		},
		{
			name: "pick_design_direction",
			description:
				"Open a browser-based visual picker for choosing a design direction. " +
				"Presents archetype cards with preview HTML — the user picks one, marks " +
				"some to keep and asks for new variants for the rest, or rejects them all " +
				"and asks for a fresh batch. Visual annotations (pins) can be attached to " +
				"the selected direction for pointed feedback. " +
				"Archetypes can be provided inline or as a path to a JSON file on disk.",
			inputSchema: {
				type: "object" as const,
				properties: {
					intent_slug: {
						type: "string",
						description: "The intent slug this direction applies to",
					},
					archetypes: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string", description: "Archetype name" },
								description: {
									type: "string",
									description: "Brief description",
								},
								preview_html: {
									type: "string",
									description: "HTML preview snippet",
								},
							},
							required: ["name", "description", "preview_html"],
						},
						description: "Inline design archetypes to choose from",
					},
					archetypes_file: {
						type: "string",
						description:
							"Path to a JSON file containing the archetypes array (alternative to inline archetypes)",
					},
					title: {
						type: "string",
						description: "Optional page title",
					},
				},
				required: ["intent_slug"],
			},
		},
		{
			name: "haiku_report",
			description:
				"Submit a bug report or feedback to the H·AI·K·U team via Sentry. " +
				"Use this when a user wants to report an issue, suggest an improvement, or share feedback.",
			inputSchema: {
				type: "object" as const,
				properties: {
					message: {
						type: "string",
						description: "The feedback message or bug report",
					},
					contact_email: {
						type: "string",
						description: "Optional contact email for follow-up",
					},
					name: {
						type: "string",
						description: "Optional name of the person submitting feedback",
					},
				},
				required: ["message"],
			},
		},
	]

	// Harness-aware tool filtering:
	// 1. Remove browser-based UI tools for headless/non-browser harnesses
	// 2. Respect maxTools limit for constrained harnesses (Cursor ~40, Windsurf 100)
	let filteredTools = allTools

	// Step 1: Remove browser-based UI tools for non-Claude harnesses.
	// These tools open a local HTTP server + browser window which won't work
	// in headless IDE environments. Removing them frees tool slots for harnesses
	// with tight limits (Cursor ~40).
	if (!isClaudeCode()) {
		const browserTools = new Set([
			"ask_user_visual_question",
			"pick_design_direction",
		])
		filteredTools = filteredTools.filter((t) => !browserTools.has(t.name))
	}

	// Step 2: Enforce tool count limit
	if (caps.maxTools !== null && filteredTools.length > caps.maxTools) {
		console.error(
			`[haiku] Harness tool limit (${caps.maxTools}) exceeded — exposing ${caps.maxTools} of ${filteredTools.length} tools`,
		)
		filteredTools = filteredTools.slice(0, caps.maxTools)
	}

	return { tools: filteredTools }
})

// Call tools — wrapped to trigger hot-swap after response when an update is staged
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
	let result: Awaited<ReturnType<typeof handleToolCall>>
	try {
		result = await handleToolCall(request, extra?.signal)
	} catch (err) {
		// User cancellation is not a crash — when Claude Code escapes a
		// tool call it fires `notifications/cancelled`, the SDK aborts
		// the signal, and the handler throws out. That's a normal
		// lifecycle event; don't spam Sentry with it and don't write a
		// crash file. Just rethrow so the SDK can suppress the response.
		if (extra?.signal?.aborted) {
			throw err
		}
		// The MCP SDK's request dispatch catches thrown errors and returns
		// them as JSON-RPC InternalError responses, which means they never
		// reach main().catch — and therefore never hit Sentry. Report here
		// so handled-but-thrown tool crashes still get captured alongside
		// the session context the PreToolUse hook injects on every call.
		const toolName = request.params?.name ?? "<unknown>"
		const args = (request.params?.arguments ?? {}) as Record<string, unknown>
		const sessionCtx = args._session_context as
			| Record<string, string>
			| undefined

		// Diagnostic: write a local crash file regardless of Sentry state,
		// so operators can prove whether the wrapper even fired and inspect
		// the stack without needing dashboard access.
		try {
			const { appendFileSync } = await import("node:fs")
			const stamp = new Date().toISOString()
			const stack =
				err instanceof Error ? err.stack || err.message : String(err)
			appendFileSync(
				"/tmp/haiku-mcp-crashes.log",
				`\n--- ${stamp} tool=${toolName} ---\n${stack}\n`,
			)
		} catch {
			/* diagnostic write best-effort */
		}

		reportError(
			err,
			{
				context: "mcp-tool-handler",
				tool_name: toolName,
				// Intentionally omit args — they may carry sensitive payloads
				// (source_ref URLs, feedback bodies). The stack + tool name is
				// enough to locate the crash.
			},
			sessionCtx,
		)
		// Sentry's HTTP transport is fire-and-forget; force a short flush so
		// long-running processes don't drop events when the handler returns
		// before the transport actually ships the envelope.
		try {
			const { flush } = await import("./sentry.js")
			await flush(1000)
		} catch {
			/* flush best-effort */
		}
		console.error(
			`[haiku] Tool handler '${toolName}' threw:`,
			err instanceof Error ? err.stack || err.message : String(err),
		)
		throw err
	}

	// After the response is written, check if we should yield to a new binary.
	// setImmediate ensures the MCP SDK flushes the response first.
	if (hasPendingUpdate()) {
		setImmediate(() => {
			console.error(
				"[haiku] Pending update detected — hot-swapping after response",
			)
			stopUpdateChecker()
			server
				.close()
				.then(() => execNewBinary())
				.catch((err) => console.error("[haiku] Hot-swap failed:", err))
		})
	}

	return result
})

// Wire up the review handler for the orchestrator's gate_ask flow.
// This lets haiku_run_next open a review and block until the user decides,
// without the agent needing to call open_review separately.
setOpenReviewHandler(createReviewGateHandler())

// Wire up elicitation fallback for when the review UI fails
setElicitInputHandler(async (params) => {
	return server.elicitInput(params as Parameters<typeof server.elicitInput>[0])
})

// Start server
async function main() {
	// FB-36: strip any `*` from HAIKU_REVIEW_ALLOWED_ORIGINS before the
	// HTTP layer starts applying CORS. Wildcard CORS on this server is
	// unsafe because the session-token-in-URL auth cannot defend against
	// cross-origin abuse when any origin is accepted.
	stripWildcardAllowedOrigins()

	const transport = new StdioServerTransport()
	await server.connect(transport)
	const harnessInfo = isClaudeCode()
		? ""
		: ` (harness: ${getCapabilities().displayName})`
	console.error(`H·AI·K·U Review MCP server running on stdio${harnessInfo}`)

	// Start background auto-update checker after the server is live
	startUpdateChecker()
}

// Graceful shutdown
//
// Order matters here:
//   1. Stop the background update checker so it can't start new work.
//   2. Close the MCP stdio `Server` so we stop accepting new MCP calls.
//   3. Close the Fastify HTTP+WebSocket server so in-flight feedback/
//      revisit/review requests get to finish and WS clients see a
//      clean `1001 Going Away` (via `stopHttpServer` → per-session
//      `closeSessionConnection`) instead of a TCP RST. Fastify's
//      `close()` drains pending requests before releasing the socket.
//   4. Flush Sentry so any errors surfaced during (2)/(3) get reported.
//   5. `process.exit(0)`.
//
// We guard against a hung shutdown with a hard timeout — if any phase
// stalls for more than SHUTDOWN_TIMEOUT_MS we fall back to a forced
// exit rather than leaving the process wedged.
const SHUTDOWN_TIMEOUT_MS = 10_000
let shuttingDown = false
async function gracefulShutdown(signal: string): Promise<void> {
	if (shuttingDown) return
	shuttingDown = true
	console.error(`Shutting down (${signal})...`)
	const hardExit = setTimeout(() => {
		console.error(
			`Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`,
		)
		process.exit(1)
	}, SHUTDOWN_TIMEOUT_MS)
	hardExit.unref()
	try {
		stopUpdateChecker()
		await server.close()
		await stopHttpServer()
		await flushSentry()
	} catch (err) {
		console.error(
			`Error during graceful shutdown: ${err instanceof Error ? err.message : String(err)}`,
		)
	} finally {
		clearTimeout(hardExit)
		process.exit(0)
	}
}

process.on("SIGINT", () => {
	void gracefulShutdown("SIGINT")
})

process.on("SIGTERM", () => {
	void gracefulShutdown("SIGTERM")
})

// MCP server entry point — invoked by: haiku mcp
main().catch((err) => {
	reportError(err, { context: "mcp-server-fatal" })
	console.error("Fatal error:", err)
	process.exit(1)
})
