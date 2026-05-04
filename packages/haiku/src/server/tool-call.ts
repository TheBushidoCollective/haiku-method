// server/tool-call.ts — MCP CallTool dispatch + the review-gate
// handler the orchestrator invokes for `gate_ask`. Together these
// own every blocking interactive tool path: ad-hoc reviews, gate
// reviews, visual questions, and design-direction pickers.
//
// Why one module: each path needs the same plumbing — start the
// HTTP server, open a tunnel (when remote-review is on), launch a
// browser, bind session cancellation to the MCP signal, then block
// on `waitForSession`. Keeping them adjacent makes the lifecycle
// invariants (`try { … } finally { closeSessionConnection… }`)
// visually consistent.

import { spawn } from "node:child_process"
import { appendFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { z } from "zod"
import { ensureOnStageBranch } from "../git-worktree.js"
import { closeSessionConnection, startHttpServer } from "../http.js"
import {
	buildDAG,
	parseAllUnits,
	parseCriteria,
	parseIntent,
	parseKnowledgeFiles,
	parseOutputArtifacts,
	parseStageArtifacts,
	parseStageStates,
	toMermaidDefinition,
} from "../index.js"
import { handleOrchestratorTool } from "../orchestrator.js"
import { isSentryConfigured, reportFeedback } from "../sentry.js"
import type { DesignArchetypeData, QuestionDef } from "../sessions.js"
import {
	clearHeartbeat,
	createDesignDirectionSession,
	createQuestionSession,
	createSession,
	deleteSession,
	getPreviousReviewSnapshot,
	getSession,
	hasPresenceLost,
	waitForSession,
} from "../sessions.js"
import {
	findHaikuRoot,
	handleStateTool,
	intentDir,
	intentFromCurrentBranch,
	listVisibleIntents,
	parseFrontmatter,
} from "../state-tools.js"
import { orchestratorToolHandlers } from "../tools/orchestrator/index.js"
import {
	buildReviewUrl,
	clearE2EKey,
	closeTunnel,
	isRemoteReviewEnabled,
	openTunnel,
} from "../tunnel.js"

const AskVisualQuestionInput = z.object({
	questions: z
		.array(
			z.object({
				question: z.string().describe("The question text"),
				header: z
					.string()
					.optional()
					.describe("Optional header/subtitle for the question"),
				options: z.array(z.string()).describe("Answer options to choose from"),
				multiSelect: z
					.boolean()
					.optional()
					.describe("Allow multiple selections (default: single)"),
			}),
		)
		.describe("Array of questions to present"),
	context: z
		.string()
		.optional()
		.describe("Optional markdown context to display above questions"),
	title: z
		.string()
		.optional()
		.describe("Optional page title (default: 'Question')"),
	image_paths: z
		.array(z.string())
		.optional()
		.describe(
			"Optional array of local image file paths to display alongside the questions. " +
				"Images are displayed in pairs (ref on left, built on right) for visual comparison.",
		),
})

const DesignArchetypeSchema = z.object({
	name: z.string().describe("Archetype name"),
	description: z.string().describe("Brief description of this archetype"),
	preview_html: z.string().describe("HTML snippet to render as a preview"),
})

const PickDesignDirectionInput = z.object({
	intent_slug: z.string().describe("The intent slug this direction applies to"),
	archetypes: z
		.array(DesignArchetypeSchema)
		.optional()
		.describe("Inline array of design archetypes to choose from"),
	archetypes_file: z
		.string()
		.optional()
		.describe(
			"Path to a JSON file containing the archetypes array (alternative to inline archetypes)",
		),
	title: z
		.string()
		.optional()
		.describe("Optional page title (default: 'Design Direction')"),
})

/**
 * Launch the OS default browser at `url`. Best-effort — a failure HERE
 * never advances a review gate on its own (the caller still `await`s
 * `waitForSession` which either hears a real decision or times out),
 * but we log loudly so the reviewer has a visible URL they can paste
 * manually. The previous implementation swallowed all three failure
 * modes (sync throw, async 'error', non-zero exit) silently, which
 * left the workflow engine "waiting quietly" with no UI hint anywhere.
 *
 * `label` lands in log lines so operators can tell which surface
 * tried to open — review gate, question, direction, or the always-on
 * review pane.
 */
export function launchBrowserBestEffort(url: string, label: string): void {
	console.error(
		`[haiku] ${label} ready → ${url}\n` +
			`         Share this URL with the reviewer if the browser didn't auto-open.`,
	)
	// On Windows we use PowerShell `Start-Process` rather than `cmd /c start`.
	// cmd.exe interprets `&`, `|`, `^`, `<`, `>`, `%`, `!` even in argv-passed
	// args, which would mangle a URL like `?session=a&token=b` (everything
	// after `&` would be parsed as a separate command). PowerShell does not
	// share that hazard. We still escape embedded single quotes by doubling
	// them — the only character `Start-Process '...'` is sensitive to.
	const cmd: string[] =
		process.platform === "darwin"
			? ["open", url]
			: process.platform === "win32"
				? [
						"powershell",
						"-NoProfile",
						"-NonInteractive",
						"-Command",
						`Start-Process '${url.replace(/'/g, "''")}'`,
					]
				: ["xdg-open", url]
	try {
		const child = spawn(cmd[0], cmd.slice(1), {
			stdio: "ignore",
			detached: true,
		})
		child.unref()
		child.on("error", (err) => {
			console.error(
				`[haiku] Browser launcher ${cmd[0]} failed: ${err.message}. Paste ${url} into a browser to continue.`,
			)
		})
		child.on("exit", (code, signal) => {
			if (code !== null && code !== 0) {
				console.error(
					`[haiku] Browser launcher ${cmd[0]} exited with code ${code}. Paste ${url} into a browser to continue.`,
				)
			}
			if (signal) {
				console.error(
					`[haiku] Browser launcher ${cmd[0]} terminated by signal ${signal}. Paste ${url} into a browser to continue.`,
				)
			}
		})
	} catch (err) {
		console.error(
			`[haiku] Browser launcher threw synchronously: ${err instanceof Error ? err.message : String(err)}. Paste ${url} into a browser to continue.`,
		)
	}
}

const SESSION_CANCEL_LOG = "/tmp/haiku-session-cancel.log"

function logCancel(msg: string): void {
	try {
		appendFileSync(SESSION_CANCEL_LOG, `${new Date().toISOString()} ${msg}\n`)
	} catch {
		/* best-effort — don't crash the tool handler over a log write */
	}
	process.stderr.write(`[haiku-mcp] ${msg}\n`)
}

/**
 * Close the session's WebSocket when the given AbortSignal fires.
 * Used by every tool handler that creates an interactive session so
 * the SPA sees an immediate `SessionEndedOverlay` if the user cancels
 * the originating MCP tool call.
 */
export function bindSessionCancellation(
	sessionId: string,
	signal: AbortSignal | undefined,
): void {
	if (!signal) {
		logCancel(
			`bindSessionCancellation(${sessionId}): no signal passed — cancel will not fire`,
		)
		return
	}
	logCancel(
		`bindSessionCancellation(${sessionId}): signal attached, aborted=${signal.aborted}`,
	)
	if (signal.aborted) {
		logCancel(
			`bindSessionCancellation(${sessionId}): signal was already aborted, closing immediately`,
		)
		closeSessionConnection(sessionId, "tool call cancelled")
		return
	}
	signal.addEventListener(
		"abort",
		() => {
			logCancel(
				`abort fired for session ${sessionId} — closing WS (reason: ${signal.reason})`,
			)
			closeSessionConnection(sessionId, "tool call cancelled")
		},
		{ once: true },
	)
}

export async function handleToolCall(
	request: {
		params: { name: string; arguments?: Record<string, unknown> }
	},
	signal?: AbortSignal,
) {
	const { name, arguments: args } = request.params

	// Orchestration tools. The set is sourced from the registry
	// (`orchestratorToolHandlers`) so any new tool added under
	// tools/orchestrator/ auto-routes here without a second
	// registration. `haiku_await_gate` is the only tool here that
	// blocks for an extended period (waits on the gate-review session
	// for up to 30 minutes); the others return promptly.
	if (orchestratorToolHandlers.has(name)) {
		return handleOrchestratorTool(
			name,
			(args ?? {}) as Record<string, unknown>,
			signal,
		)
	}

	// Report tool — submit user feedback/bug reports to Sentry
	if (name === "haiku_report") {
		if (!isSentryConfigured()) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Feedback is not available in this installation (Sentry DSN not configured).",
					},
				],
			}
		}
		const typedArgs = (args ?? {}) as Record<string, unknown>
		const message = typedArgs.message as string | undefined
		if (!message) {
			return {
				content: [
					{ type: "text" as const, text: "Error: message is required" },
				],
				isError: true,
			}
		}
		const contactEmail = typedArgs.contact_email as string | undefined
		const userName = typedArgs.name as string | undefined
		const sessionCtx = typedArgs._session_context as
			| Record<string, string>
			| undefined
		reportFeedback(message, sessionCtx, contactEmail, userName)
		return {
			content: [
				{ type: "text" as const, text: "Feedback submitted. Thank you!" },
			],
		}
	}

	// Ad-hoc review pane — create a fresh session-scoped review bound to
	// the active intent + stage, open the browser, return the URL. Does
	// NOT block the tool call; does NOT call run_next. The session lives
	// until the usual TTL / presence sweep evicts it. Feedback the
	// reviewer leaves routes through the normal feedback API; the workflow engine
	// picks it up via run_next's fix-loop/revisit path.
	if (name === "haiku_review_open") {
		const a = (args ?? {}) as Record<string, unknown>
		let slug = (a.intent as string) || ""
		if (!slug) {
			const branchMatch = intentFromCurrentBranch()
			if (branchMatch) {
				slug = branchMatch.slug
			} else {
				const root = findHaikuRoot()
				const intentsDir = join(root, "intents")
				const active = listVisibleIntents(intentsDir).filter(
					(i) => (i.data.status as string) !== "completed",
				)
				if (active.length === 1) {
					slug = active[0].slug
				} else if (active.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No active intents found. Start one with /haiku:start, or pass `intent` explicitly.",
							},
						],
						isError: true,
					}
				} else {
					return {
						content: [
							{
								type: "text" as const,
								text: `Multiple active intents (${active.map((i) => i.slug).join(", ")}). Pass \`intent\` explicitly, or checkout an intent branch so the tool can auto-resolve.`,
							},
						],
						isError: true,
					}
				}
			}
		}

		const intentDirAbs = intentDir(slug)
		const intent = await parseIntent(intentDirAbs)
		if (!intent) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Could not parse intent "${slug}" — .haiku/intents/${slug}/intent.md missing or malformed.`,
					},
				],
				isError: true,
			}
		}

		const stageArg = (a.stage as string) || ""
		const frontmatter = intent.frontmatter as unknown as Record<string, unknown>
		const activeStage =
			stageArg || ((frontmatter.active_stage as string | undefined) ?? "")

		const units = await parseAllUnits(intentDirAbs)
		const dag = buildDAG(units)
		const mermaid = toMermaidDefinition(dag, units)
		const criteriaSection = intent.sections.find(
			(s) =>
				s.heading?.toLowerCase().includes("completion criteria") ||
				s.heading?.toLowerCase().includes("success criteria"),
		)
		const criteria = criteriaSection
			? parseCriteria(criteriaSection.content)
			: []

		const session = createSession({
			intent_dir: intentDirAbs,
			intent_slug: slug,
			target: "",
		})
		session.ad_hoc = true
		session.stage = activeStage || undefined

		Object.assign(session, {
			parsedIntent: intent,
			parsedUnits: units,
			parsedCriteria: criteria,
			parsedMermaid: mermaid,
		})

		const stageStates = await parseStageStates(intentDirAbs)
		const knowledgeFiles = await parseKnowledgeFiles(intentDirAbs)
		const stageArtifacts = await parseStageArtifacts(intentDirAbs)
		const outputArtifacts = await parseOutputArtifacts(intentDirAbs)
		for (const oa of outputArtifacts) {
			if (oa.type === "image" && oa.relativePath) {
				oa.relativePath = `/stage-artifacts/${session.session_id}/stages/${oa.relativePath}`
			}
		}
		Object.assign(session, {
			stageStates,
			knowledgeFiles,
			stageArtifacts,
			outputArtifacts,
		})

		// (Legacy server-rendered review HTML removed — the live route
		// at /review/:sessionId serves HAIKU_UI_HTML, the React/Tanstack
		// SPA. session.html was written here for years but never read
		// by any handler; templates/ was dead code.)

		const port = await startHttpServer()
		const base = isRemoteReviewEnabled()
			? buildReviewUrl(session.session_id, await openTunnel(port), "intent")
			: `http://127.0.0.1:${port}/review/${session.session_id}`
		const stageSuffix = activeStage ? `/stages/${activeStage}` : ""
		const reviewUrl = `${base}${stageSuffix}`

		bindSessionCancellation(session.session_id, signal)

		launchBrowserBestEffort(reviewUrl, "Ad-hoc review")

		// Block until the reviewer hits Done or Request Changes (or the
		// pane times out). The UI posts a decide frame with decision set
		// to "approved" (Done) or "changes_requested" (Request Changes),
		// which flips session.status to "decided" and wakes
		// waitForSession. The tool return then relays a concrete
		// instruction to the agent so run_next / revisit is the obvious
		// next step, not a guess.
		try {
			while (true) {
				let timedOut = false
				try {
					await waitForSession(session.session_id, 30 * 60 * 1000, signal)
				} catch (err) {
					if (signal?.aborted) throw err
					timedOut = true
				}

				const updated = getSession(session.session_id)
				if (
					updated &&
					updated.session_type === "review" &&
					updated.status === "decided"
				) {
					if (updated.decision === "changes_requested") {
						return {
							content: [
								{
									type: "text" as const,
									text: `Ad-hoc review closed with Request Changes on stage "${activeStage || "(unspecified)"}". Pending feedback is already persisted on disk — call \`haiku_run_next\` to route it through the normal fix-loop / revisit path.`,
								},
							],
						}
					}
					return {
						content: [
							{
								type: "text" as const,
								text: `Ad-hoc review closed with Done — no changes requested. No workflow action needed.`,
							},
						],
					}
				}

				if (timedOut) break
				if (hasPresenceLost(session.session_id)) {
					console.error(
						`[haiku] Ad-hoc review ${session.session_id} lost presence — continuing to wait (no reopen)`,
					)
				}
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Ad-hoc review pane at ${reviewUrl} timed out after 30 minutes without a Done or Request Changes click. Any feedback the reviewer typed is still persisted on disk; the next \`haiku_run_next\` will see it if present.`,
					},
				],
			}
		} finally {
			closeSessionConnection(session.session_id, "ad-hoc review closed")
			clearHeartbeat(session.session_id)
			if (isRemoteReviewEnabled()) {
				clearE2EKey(session.session_id)
				closeTunnel()
			}
			deleteSession(session.session_id)
		}
	}

	// State management tools
	if (name.startsWith("haiku_")) {
		return handleStateTool(name, (args ?? {}) as Record<string, unknown>)
	}

	if (name === "open_review") {
		// open_review is blocked — the workflow engine (setOpenReviewHandler) has its own code path.
		// Direct agent calls would bypass unit naming validation, type validation, and
		// discovery artifact checks that the orchestrator enforces before opening a review.
		return {
			content: [
				{
					type: "text" as const,
					text: "Error: open_review cannot be called directly. Use haiku_run_next to advance — it validates units and opens the review automatically when ready.",
				},
			],
			isError: true,
		}
	}

	if (name === "ask_user_visual_question") {
		const input = AskVisualQuestionInput.parse(args)
		const title = input.title ?? "Question"
		const context = input.context ?? ""
		const questions: QuestionDef[] = input.questions
		const imagePaths = input.image_paths ?? []

		// Derive per-path base directories for path validation (defense-in-depth in the HTTP handler)
		const imageBaseDirs = imagePaths.map((p) => dirname(resolve(p)))

		// Create question session
		const session = createQuestionSession({
			title,
			questions,
			context,
			imagePaths,
			imageBaseDirs,
		})

		// Build image URLs for the template (served via /question-image/:sessionId/:index)
		const imageUrls = imagePaths.map(
			(_, i) => `/question-image/${session.session_id}/${i}`,
		)
		void imageUrls

		// Start HTTP server (idempotent)
		const port = await startHttpServer()
		let questionUrl: string
		if (isRemoteReviewEnabled()) {
			const tunnelUrl = await openTunnel(port)
			questionUrl = buildReviewUrl(session.session_id, tunnelUrl, "question")
		} else {
			questionUrl = `http://127.0.0.1:${port}/question/${session.session_id}`
		}

		// Non-blocking — return URL + session_id; agent posts the URL
		// to the user, then calls haiku_await_visual_answer to block
		// on the response. Same motivation as the gate-review split:
		// remote control / headless / SSH / mobile-chat hosts can't
		// auto-launch browsers, so the URL must travel through chat.
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							status: "session_ready",
							session_id: session.session_id,
							url: questionUrl,
							next_tool: "haiku_await_visual_answer",
							message: `Question session created. Tell the user the URL above (post it in chat — essential for headless / remote-control / mobile setups), then call haiku_await_visual_answer { session_id: "${session.session_id}" } to block on their answer. The await tool also tries to open the URL in the default browser; pass auto_open: false to skip.`,
						},
						null,
						2,
					),
				},
			],
		}
	}

	if (name === "haiku_await_visual_answer") {
		const a = (args ?? {}) as Record<string, unknown>
		const sessionId = (a.session_id as string) || ""
		if (!sessionId) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: session_id is required. Use the session_id returned by ask_user_visual_question.",
					},
				],
				isError: true,
			}
		}
		const autoOpen = a.auto_open !== false
		const url = (a.url as string) || ""
		const existing = getSession(sessionId)
		if (!existing || existing.session_type !== "question") {
			return {
				content: [
					{
						type: "text" as const,
						text: `Question session ${sessionId} not found or wrong type — call ask_user_visual_question to create a new one.`,
					},
				],
				isError: true,
			}
		}

		bindSessionCancellation(sessionId, signal)
		if (autoOpen && url) launchBrowserBestEffort(url, "Question session")

		const MAX_WAIT_Q = 30 * 60 * 1000
		try {
			await waitForSession(sessionId, MAX_WAIT_Q, signal)
		} catch {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								status: "timeout",
								url,
								session_id: sessionId,
								message:
									"User did not respond within 30 minutes. Call haiku_await_visual_answer again to keep waiting, or ask_user_visual_question to start a new session.",
							},
							null,
							2,
						),
					},
				],
			}
		}

		const updatedQuestionSession = getSession(sessionId)
		if (
			updatedQuestionSession &&
			updatedQuestionSession.session_type === "question" &&
			updatedQuestionSession.status === "answered" &&
			updatedQuestionSession.answers
		) {
			const annotationsForJson: Record<string, unknown> = {}
			const ann = updatedQuestionSession.annotations
			if (ann?.comments?.length) annotationsForJson.comments = ann.comments
			if (ann?.pins?.length) annotationsForJson.pins = ann.pins
			if (ann?.screenshots?.length)
				annotationsForJson.screenshot_count = ann.screenshots.length
			const questionResult: Record<string, unknown> = {
				status: "answered",
				url,
				answers: updatedQuestionSession.answers,
			}
			if (updatedQuestionSession.feedback) {
				questionResult.feedback = updatedQuestionSession.feedback
			}
			if (Object.keys(annotationsForJson).length > 0) {
				questionResult.annotations = annotationsForJson
			}

			type ContentBlock =
				| { type: "text"; text: string }
				| { type: "image"; data: string; mimeType: string }
			const content: ContentBlock[] = [
				{
					type: "text" as const,
					text: JSON.stringify(questionResult, null, 2),
				},
			]

			const screenshots = ann?.screenshots ?? []
			if (screenshots.length > 0) {
				content.push({
					type: "text" as const,
					text: `\n${screenshots.length} screenshot annotation${screenshots.length === 1 ? "" : "s"} attached below — each pair is the reviewer's note + the captured surface they were drawing on.`,
				})
				for (let i = 0; i < screenshots.length; i++) {
					const s = screenshots[i]
					content.push({
						type: "text" as const,
						text: `\nAnnotation ${i + 1} (image ${s.image_index + 1}): ${s.comment}`,
					})
					const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(
						s.screenshot_data_url,
					)
					if (match) {
						content.push({
							type: "image" as const,
							mimeType: match[1],
							data: match[2],
						})
					} else {
						content.push({
							type: "text" as const,
							text: `(screenshot for annotation ${i + 1} could not be decoded)`,
						})
					}
				}
			}

			return { content }
		}

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							status: "timeout",
							url,
							session_id: sessionId,
							message:
								"User did not respond within 30 minutes. Call haiku_await_visual_answer again to keep waiting.",
						},
						null,
						2,
					),
				},
			],
		}
	}

	if (name === "pick_design_direction") {
		const input = PickDesignDirectionInput.parse(args)
		const _title = input.title ?? "Design Direction"

		// Resolve archetypes: inline or from file
		let archetypes: DesignArchetypeData[]
		if (input.archetypes) {
			archetypes = input.archetypes
		} else if (input.archetypes_file) {
			// `archetypes_file` is agent-controlled. Acceptable in the
			// current local threat model — the Claude Code agent already
			// has full filesystem access, so this read is no
			// privilege-escalation. TODO: scope to the active intent
			// directory if this MCP server is ever exposed remotely
			// (tunnel mode) so a prompt-injected agent cannot exfiltrate
			// arbitrary files.
			const raw = await readFile(resolve(input.archetypes_file), "utf-8")
			archetypes = z.array(DesignArchetypeSchema).parse(JSON.parse(raw))
		} else {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: provide either archetypes or archetypes_file",
					},
				],
			}
		}

		const session = createDesignDirectionSession({
			intent_slug: input.intent_slug,
			archetypes,
		})

		const port = await startHttpServer()
		let directionUrl: string
		if (isRemoteReviewEnabled()) {
			const tunnelUrl = await openTunnel(port)
			directionUrl = buildReviewUrl(session.session_id, tunnelUrl, "direction")
		} else {
			directionUrl = `http://127.0.0.1:${port}/direction/${session.session_id}`
		}

		// Non-blocking — return URL + session_id; agent posts the URL
		// to the user, then calls haiku_await_design_direction to
		// block on the response. Same motivation as the gate-review
		// and visual-question splits: the URL travels through chat
		// regardless of whether the MCP host can launch a browser.
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							status: "session_ready",
							session_id: session.session_id,
							intent_slug: input.intent_slug,
							url: directionUrl,
							archetype_count: archetypes.length,
							next_tool: "haiku_await_design_direction",
							message: `Design-direction session created. Tell the user the URL above (post it in chat — essential for headless / remote / mobile setups), then call haiku_await_design_direction { session_id: "${session.session_id}", intent_slug: "${input.intent_slug}" } to block on their selection. Pass auto_open: false on the await call when the user will open the URL on a different device.`,
						},
						null,
						2,
					),
				},
			],
		}
	}

	if (name === "haiku_await_design_direction") {
		const a = (args ?? {}) as Record<string, unknown>
		const sessionId = (a.session_id as string) || ""
		const intentSlug = (a.intent_slug as string) || ""
		if (!sessionId) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: session_id is required. Use the session_id returned by pick_design_direction.",
					},
				],
				isError: true,
			}
		}
		const autoOpen = a.auto_open !== false
		const url = (a.url as string) || ""
		const existing = getSession(sessionId)
		if (!existing || existing.session_type !== "design_direction") {
			return {
				content: [
					{
						type: "text" as const,
						text: `Design-direction session ${sessionId} not found or wrong type — call pick_design_direction to create a new one.`,
					},
				],
				isError: true,
			}
		}

		// NOTE: deliberately not propagating `signal` into the session.
		// The HTTP submit route persists the selection (+ screenshots) to
		// disk before waking us, so even if the MCP client times out the
		// request and discards our response, the next haiku_run_next will
		// emit a `design_direction_complete` action that surfaces the
		// selection from durable state. Forwarding the abort here only
		// short-circuits the wait without producing a usable response.
		bindSessionCancellation(sessionId, undefined)

		if (autoOpen && url) launchBrowserBestEffort(url, "Direction session")

		const MAX_WAIT_DD = 30 * 60 * 1000
		try {
			await waitForSession(sessionId, MAX_WAIT_DD)
		} catch {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								status: "timeout",
								url,
								session_id: sessionId,
								message:
									"User did not respond within 30 minutes. Call haiku_await_design_direction again to keep waiting, or haiku_run_next to advance from durable state if a selection landed.",
							},
							null,
							2,
						),
					},
				],
			}
		}

		// All durable persistence (state.json + PNG sidecars) happened on
		// the HTTP submit route in `session-routes.ts`; this handler just
		// returns a short ack so the agent knows to advance. The next
		// `haiku_run_next` emits `design_direction_complete` with the
		// archetype, comments, and screenshot paths read from disk.
		const updatedDirectionSession = getSession(sessionId)
		if (
			updatedDirectionSession &&
			updatedDirectionSession.session_type === "design_direction" &&
			updatedDirectionSession.status === "answered" &&
			updatedDirectionSession.selection
		) {
			const sel = updatedDirectionSession.selection

			if (sel.mode === "regenerate") {
				const parts: string[] = [
					sel.keep.length > 0
						? `The user wants more variants. They'd like to keep: **${sel.keep.join("**, **")}**.`
						: `The user wants more variants. None of the current archetypes are keepers.`,
					`Generate replacement archetype(s) for the dropped slot(s) and call \`pick_design_direction\` again with the merged set.`,
				]
				if (sel.comments) {
					parts.push(`\nSteering notes from the user: ${sel.comments}`)
				}
				return {
					content: [{ type: "text" as const, text: parts.join("\n") }],
				}
			}

			// Select path — selection persisted by the HTTP submit route.
			// Re-enforce stage branch since the user may have checked out
			// another branch during the (up to 30-min) wait. Failures are
			// non-fatal — branch state is reconciled by `haiku_run_next`'s
			// own enforcement on the next tick — but we surface them so a
			// debug-mode log shows when reconciliation will be needed.
			if (intentSlug) {
				try {
					const intentRaw = await readFile(
						join(findHaikuRoot(), "intents", intentSlug, "intent.md"),
						"utf-8",
					)
					const activeStage =
						(parseFrontmatter(intentRaw).data.active_stage as string) || ""
					if (activeStage) {
						const guard = ensureOnStageBranch(intentSlug, activeStage)
						if (!guard.ok) {
							console.warn(
								`[haiku_await_design_direction] stage-branch enforcement failed: ${guard.message}`,
							)
						}
					}
				} catch (err) {
					console.warn(
						`[haiku_await_design_direction] post-wait branch reconciliation skipped: ${err instanceof Error ? err.message : String(err)}`,
					)
				}
			}

			const ackParts: string[] = [
				`The user selected the **${sel.archetype}** direction.`,
			]
			if (sel.comments) {
				ackParts.push(`\nComments: ${sel.comments}`)
			}
			if (sel.annotations?.pins?.length) {
				ackParts.push(`\nPin annotations (${sel.annotations.pins.length}):`)
				for (const pin of sel.annotations.pins) {
					ackParts.push(
						`  - [${pin.x.toFixed(1)}%, ${pin.y.toFixed(1)}%]: ${pin.text || "(no text)"}`,
					)
				}
			}
			ackParts.push(
				`\nCall \`haiku_run_next\` to continue — the workflow will surface any screenshot annotations the user attached.`,
			)
			return {
				content: [{ type: "text" as const, text: ackParts.join("\n") }],
			}
		}

		return {
			content: [
				{
					type: "text" as const,
					text: "The user did not select a design direction within the time limit. Ask them how they'd like to proceed.",
				},
			],
		}
	}

	return {
		content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
		isError: true,
	}
}

/**
 * Two-step gate review protocol — replaces the previous
 * `createReviewGateHandler` callback that wrapped session-create +
 * blocking-wait in a single MCP tool call.
 *
 * Step 1 — `prepareGateReviewSession` (non-blocking): create the
 *   review session, build the URL, return both. Called by
 *   `haiku_run_next` when the workflow engine reports `gate_review`,
 *   so the orchestrator can surface the URL to the agent → user.
 *   Essential for headless / SSH / web-client setups, and for remote
 *   control where the MCP host can't auto-open the user's browser.
 *
 * Step 2 — `awaitGateReviewSession` (blocking): take a session ID,
 *   open the browser best-effort, block on `waitForSession`, return
 *   the user's raw decision. Called by `haiku_await_gate`. Cleanup
 *   (WS close, tunnel close, session delete) lives in the finally so
 *   it always runs.
 */
export type GateMeta = {
	gateContext?: string
	stage?: string
	nextStage?: string | null
	nextPhase?: string | null
}

export type GateReviewPrepared = {
	session_id: string
	review_url: string
	use_remote: boolean
}

export type GateReviewDecision = {
	decision: string
	feedback: string
	annotations?: unknown
}

export async function prepareGateReviewSession(
	intentDirRel: string,
	gateType: string | undefined,
	gateMeta: GateMeta | undefined,
): Promise<GateReviewPrepared> {
	const intentDirAbs = resolve(process.cwd(), intentDirRel)
	const intent = await parseIntent(intentDirAbs)
	if (!intent) throw new Error("Could not parse intent")

	const units = await parseAllUnits(intentDirAbs)
	const dag = buildDAG(units)
	const mermaid = toMermaidDefinition(dag, units)
	const criteriaSection = intent.sections.find(
		(s) =>
			s.heading?.toLowerCase().includes("completion criteria") ||
			s.heading?.toLowerCase().includes("success criteria"),
	)
	const criteria = criteriaSection ? parseCriteria(criteriaSection.content) : []

	const session = createSession({
		intent_dir: intentDirAbs,
		intent_slug: intent.slug,
		gate_type: gateType,
		target: "",
	})
	if (gateMeta?.gateContext) session.gate_context = gateMeta.gateContext
	if (gateMeta?.stage) session.stage = gateMeta.stage
	if (gateMeta?.nextStage !== undefined) session.next_stage = gateMeta.nextStage
	if (gateMeta?.nextPhase !== undefined) session.next_phase = gateMeta.nextPhase

	Object.assign(session, {
		parsedIntent: intent,
		parsedUnits: units,
		parsedCriteria: criteria,
		parsedMermaid: mermaid,
	})

	const prevSnapshot = getPreviousReviewSnapshot(intentDirAbs)
	if (prevSnapshot) session.previousReview = prevSnapshot

	const stageStates = await parseStageStates(intentDirAbs)
	const knowledgeFiles = await parseKnowledgeFiles(intentDirAbs)
	const stageArtifacts = await parseStageArtifacts(intentDirAbs)
	const outputArtifacts = await parseOutputArtifacts(intentDirAbs)

	for (const oa of outputArtifacts) {
		if (oa.type === "image" && oa.relativePath) {
			oa.relativePath = `/stage-artifacts/${session.session_id}/stages/${oa.relativePath}`
		}
	}

	Object.assign(session, {
		stageStates,
		knowledgeFiles,
		stageArtifacts,
		outputArtifacts,
	})

	void mermaid

	const port = await startHttpServer()
	const useRemote = isRemoteReviewEnabled()
	const reviewUrl = useRemote
		? buildReviewUrl(session.session_id, await openTunnel(port), "intent")
		: `http://127.0.0.1:${port}/review/${session.session_id}`

	return {
		session_id: session.session_id,
		review_url: reviewUrl,
		use_remote: useRemote,
	}
}

export async function awaitGateReviewSession(
	sessionId: string,
	opts: {
		autoOpen?: boolean
		signal?: AbortSignal
		reviewUrl?: string
		timeoutMs?: number
	} = {},
): Promise<GateReviewDecision> {
	const {
		autoOpen = true,
		signal,
		reviewUrl,
		timeoutMs = 30 * 60 * 1000,
	} = opts
	const existing = getSession(sessionId)
	if (!existing || existing.session_type !== "review") {
		throw new Error(
			`Gate review session ${sessionId} not found or wrong type — call haiku_run_next to recreate.`,
		)
	}
	const useRemote = isRemoteReviewEnabled()

	bindSessionCancellation(sessionId, signal)
	if (autoOpen && reviewUrl) launchBrowserBestEffort(reviewUrl, "Review gate")

	try {
		while (true) {
			let timedOut = false
			try {
				await waitForSession(sessionId, timeoutMs, signal)
			} catch (err) {
				if (signal?.aborted) throw err
				timedOut = true
			}

			const updated = getSession(sessionId)
			if (
				updated &&
				updated.session_type === "review" &&
				updated.status === "decided"
			) {
				return {
					decision: updated.decision ?? "",
					feedback: updated.feedback ?? "",
					annotations: updated.annotations,
				}
			}

			if (timedOut) break

			if (hasPresenceLost(sessionId)) {
				console.error(
					`[haiku] Review session ${sessionId} lost presence — continuing to wait (no reopen)`,
				)
			}
		}

		throw new Error("Review timeout after 30 minutes")
	} finally {
		closeSessionConnection(sessionId, "tool call complete")
		clearHeartbeat(sessionId)
		if (useRemote) {
			clearE2EKey(sessionId)
			closeTunnel()
		}
		deleteSession(sessionId)
	}
}
