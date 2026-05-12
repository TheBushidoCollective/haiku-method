// tools/orchestrator/haiku_intent_create.ts — Create a new intent.
// `/haiku:start` always creates a new intent — never resumes. Use
// `/haiku:pickup` to resume an existing one. Forks `haiku/{slug}/main`
// directly off the mainline ref WITHOUT
// checking out the repo mainline (locked / dirty mainline checkouts
// in another worktree don't block intent creation, and intent files
// only ever land on the haiku branch — mainline stays clean). The
// working tree lands on the intent's own branch, so the intent is
// resumable via `git switch`.
//
// Title is required and must be a deliberate 3–8 word summary, not a
// truncated description. Slug auto-derives from title when omitted.

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
	branchExists,
	createIntentBranch,
	detectPrTool,
	openIntentDraftPullRequest,
	pushBranchToOrigin,
	resolveMainlineRef,
} from "../../git-worktree.js"
import { validateIdentifier } from "../../prompts/helpers.js"
import { logSessionEvent } from "../../session-metadata.js"
import {
	findHaikuRoot,
	gitCommitState,
	intentTitleNeedsRepair,
	isGitRepo,
	setFrontmatterField,
	timestamp,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

/**
 * Detect "workflow-meta pollution" in an intent title or description —
 * phrases that name engine-managed configuration (mode, studio, stage,
 * phase) instead of describing what the user wants to build.
 *
 * Failure mode this guards against: the user says "I want to start
 * an intent only with the inception phase." The agent obediently
 * passes that phrasing through as the intent's description. The
 * description ends up as workflow-shape commentary instead of the
 * subject of work the user wanted done. The engine has dedicated
 * selection tools (haiku_select_studio / haiku_select_mode /
 * haiku_select_stage) with elicitation pickers; the description
 * field is reserved for what the user wants to ACCOMPLISH.
 *
 * Patterns flagged:
 *   - "in X mode" / "X-mode" / "only X mode" / "use X mode"
 *   - "use/using the X studio" — directive verbs only; bare nouns
 *     like "the yoga studio" or "the recording studio" pass through
 *   - "only in/with X stage|phase" / "only the X stage|phase"
 *   - References to the studio's stage names (inception, design,
 *     product, development, operations, security) used as workflow
 *     qualifiers, not as domain nouns
 *
 * Returns the matched phrase when polluted; null when clean.
 *
 * Deliberately permissive on domain usage — "build a stage manager"
 * or "develop a design system" should NOT trip the guard. We require
 * the workflow-config phrasing pattern, not just keyword presence.
 */
function detectWorkflowMetaPollution(s: string): string | null {
	const text = s.trim()
	if (!text) return null
	// Known mode names as standalone qualifiers (must be one of these,
	// not arbitrary content).
	const MODE_NAMES = "quick|continuous|discrete|hybrid|autopilot"
	const STAGE_NAMES = "inception|design|product|development|operations|security"
	const patterns: Array<{ re: RegExp; label: string }> = [
		// "in continuous mode" / "using quick mode" / "the autopilot mode"
		{
			re: new RegExp(
				`\\b(?:in|using|use|with|the|a)\\s+(?:${MODE_NAMES})\\s+mode\\b`,
				"i",
			),
			label: "mode reference",
		},
		// "X-mode" hyphenated form
		{
			re: new RegExp(`\\b(?:${MODE_NAMES})-mode\\b`, "i"),
			label: "mode reference",
		},
		// "only in/with/the/a inception phase" / "only the design stage"
		{
			re: new RegExp(
				`\\bonly\\s+(?:in|with|the|a)?\\s*(?:${STAGE_NAMES})\\s+(?:stage|phase)\\b`,
				"i",
			),
			label: "stage / phase restriction",
		},
		// "only with the inception phase" / "only run the inception phase"
		{
			re: new RegExp(
				`\\bonly\\s+(?:run|use|do|in|with)\\s+(?:the\\s+)?(?:${STAGE_NAMES})\\s+(?:stage|phase)?\\b`,
				"i",
			),
			label: "stage / phase restriction",
		},
		// "in inception phase" / "in the design stage" — but NOT
		// "in the development stage of a startup" or "in the inception
		// phase of their project," which are ordinary domain phrases.
		// The trailing negative lookahead for `of` is what splits the
		// workflow-directive form (terse, terminal) from the domain
		// form (genitive, continues with "of X").
		{
			re: new RegExp(
				`\\bin\\s+(?:the\\s+)?(?:${STAGE_NAMES})\\s+(?:stage|phase)\\b(?!\\s+of\\b)`,
				"i",
			),
			label: "stage / phase reference",
		},
		// "use the software studio" / "using the design studio" — flag
		// only directive verbs ("use", "using"). Anchoring on `in`,
		// `with`, or `the` would false-positive on legitimate domain
		// uses like "the yoga studio" / "the recording studio".
		{
			re: /\b(?:use|using)\s+(?:the\s+)?\w+\s+studio\b/i,
			label: "studio reference",
		},
		// Bare "studio:" / "mode:" / "stages:" — looks like the agent
		// tried to bake FM fields into the description.
		{
			re: /\b(?:studio|mode|stages?)\s*:\s*\w+/i,
			label: "raw frontmatter in description",
		},
	]
	for (const { re, label } of patterns) {
		const m = text.match(re)
		if (m) return `${label}: "${m[0]}"`
	}
	return null
}

export default defineTool({
	name: "haiku_intent_create",
	description:
		"Create a new intent. Returns the slug + path. Title is required (crisp 3–8 word summary, ≤80 chars, single line). Studio, mode, and (for quick) stage are selected by the engine on the next haiku_run_next call — the tick blocks on the SPA picker until the user chooses, then continues to real workflow actions. The agent does NOT call select_* tools directly; just call haiku_run_next after creating the intent. Always creates a fresh intent — `/haiku:start` does not resume; use `/haiku:pickup` for that.",
	inputSchema: {
		type: "object" as const,
		properties: {
			title: { type: "string" },
			description: { type: "string" },
			slug: { type: "string" },
			context: { type: "string" },
			state_file: { type: "string" },
		},
		required: ["title", "description"],
		additionalProperties: false,
	},
	handle(args) {
		const description = args.description as string
		const titleInput = args.title as string | undefined
		let slug = args.slug as string | undefined

		// Title is required: must be a crisp, human-readable summary the
		// agent writes deliberately. We do NOT derive it by truncating the
		// description.
		if (!titleInput || typeof titleInput !== "string") {
			return text(
				JSON.stringify({
					error: "missing_title",
					message:
						'haiku_intent_create requires a `title` parameter — a crisp 3–8 word summary (≤80 chars, single line, no trailing period). Write it deliberately; do NOT pass a truncated description. Example: title: "Add archivable intents".',
				}),
			)
		}
		// Reject newlines explicitly before normalization — otherwise `\s+`
		// would collapse them to spaces and hide the intent (a multi-line
		// title input is a sign the agent pasted a paragraph, not wrote a
		// title).
		if (/[\r\n]/.test(titleInput)) {
			return text(
				JSON.stringify({
					error: "invalid_title",
					message:
						"`title` must be a single line — got newlines. Rewrite as a crisp 3–8 word summary (≤80 chars) and call again.",
				}),
			)
		}
		const title = titleInput.trim().replace(/\s+/g, " ")
		if (intentTitleNeedsRepair(title)) {
			return text(
				JSON.stringify({
					error: "invalid_title",
					message: `\`title\` must be non-empty and ≤80 chars after trimming. Got ${title.length} chars. Rewrite as a 3–8 word summary and call again.`,
				}),
			)
		}

		// Reject workflow-meta pollution in title or description. The
		// engine owns studio / mode / stage selection via the SPA
		// elicitation pickers (haiku_select_studio / haiku_select_mode /
		// haiku_select_stage). If the user said "only with the inception
		// phase" or "in quick mode," that's a workflow-config preference,
		// NOT what they want to build — the intent's description should
		// describe substance. Baking the preference into the description
		// loses the actual subject of the work and surfaces as a
		// confused-looking intent. Reject early with a clear redirect.
		const titlePollution = detectWorkflowMetaPollution(title)
		const descPollution = detectWorkflowMetaPollution(
			(description as string) || "",
		)
		if (titlePollution || descPollution) {
			const where =
				titlePollution && descPollution
					? "title and description"
					: titlePollution
						? "title"
						: "description"
			const match = titlePollution || descPollution
			return text(
				JSON.stringify({
					error: "intent_create_meta_pollution",
					where,
					match,
					message:
						`The ${where} contains workflow configuration phrasing (${match}). ` +
						`Studio, mode, and stage are engine-managed — the next haiku_run_next ` +
						`call will run the SPA picker to let the user choose them. The intent's ` +
						`title and description should describe the substance of what to build or ` +
						`accomplish, not the workflow shape. Re-ask the user what they want to ` +
						`BUILD (not how to configure the workflow), then call haiku_intent_create ` +
						`again with that as the description.`,
				}),
			)
		}

		if (!slug) {
			slug = title
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 50)
				.replace(/-$/, "")
		}

		slug = validateIdentifier(slug, "intent slug")

		const stateFile = args.state_file as string | undefined

		// Fork the intent's main branch directly off the mainline ref and
		// switch the working tree to it BEFORE any filesystem checks or
		// writes for the new intent. We never check out the repo mainline:
		//   - `git branch <new> <ref>` forks from any ref without touching
		//     the working tree, so a locked or stale mainline checkout in
		//     another worktree doesn't block us.
		//   - The working tree lands on `haiku/{slug}/main`, the intent's
		//     own branch — making it resumable via plain `git switch`.
		//   - Intent files (intent.md, knowledge/*) only ever land on the
		//     haiku branch; mainline stays clean.
		// The existsSync check on iDir then runs against the intent's
		// branch:
		//   - If `haiku/{slug}/main` already existed, the fork is a no-op,
		//     checkout reveals the existing files, and we return
		//     intent_exists.
		//   - If a legacy intent dir lives on mainline (pre-fix repos), the
		//     fresh fork inherits it, and existsSync still catches it.
		const root = findHaikuRoot()
		const iDir = join(root, "intents", slug)
		const intentMainBranch = `haiku/${slug}/main`
		if (isGitRepo()) {
			try {
				const mainlineRef = resolveMainlineRef()
				if (!branchExists(intentMainBranch)) {
					createIntentBranch(slug, mainlineRef || undefined)
				}
				let currentBranch = ""
				try {
					currentBranch = execFileSync(
						"git",
						["rev-parse", "--abbrev-ref", "HEAD"],
						{ encoding: "utf8", stdio: "pipe" },
					).trim()
				} catch {
					/* non-fatal: detached HEAD or similar */
				}
				if (currentBranch !== intentMainBranch) {
					execFileSync("git", ["checkout", intentMainBranch], {
						encoding: "utf8",
						stdio: "pipe",
					})
				}
			} catch (err) {
				const raw = err instanceof Error ? err.message : String(err)
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: failed to switch to intent branch '${intentMainBranch}'. Stash or commit uncommitted changes, or remove the worktree holding '${intentMainBranch}' if it's checked out elsewhere, then retry. Raw git error: ${raw}`,
						},
					],
					isError: true,
				}
			}
		}

		if (existsSync(join(iDir, "intent.md"))) {
			return text(
				JSON.stringify({
					error: "intent_exists",
					slug,
					message: `Intent '${slug}' already exists`,
				}),
			)
		}

		mkdirSync(join(iDir, "knowledge"), { recursive: true })
		mkdirSync(join(iDir, "stages"), { recursive: true })

		// Build intent.md with frontmatter + body. studio, mode, and
		// stages are all engine-managed and start UNSET — the workflow
		// tick (run-tick.ts) gates on each missing field and emits
		// `select_studio` / `select_mode` / `select_stage`, which
		// haiku_run_next intercepts to run the SPA picker inline. The
		// agent never types these values into a frontmatter writer.
		const context = args.context as string | undefined
		const descriptionBody = (description || "").trim()
		const intentContent = [
			"---",
			`title: "${title.replace(/"/g, '\\"')}"`,
			`studio: ""`,
			"status: active",
			`created_at: ${timestamp()}`,
			"---",
			"",
			`# ${title}`,
			"",
			...(descriptionBody ? [descriptionBody, ""] : []),
			...(context ? [context, ""] : []),
		].join("\n")

		writeFileSync(join(iDir, "intent.md"), intentContent)

		// Seed `.gitattributes` for engine-owned append-only event
		// streams. Both `action-log.jsonl` and `write-audit.jsonl` are
		// written from EVERY branch the engine touches (intent main,
		// stage branches, fix-chain worktrees, discovery worktrees).
		// Without `merge=union`, every fix-chain that ran a workflow
		// tick conflicts with the base on the JSONL append, the
		// integrator can't cleanly resolve the loss-prone "did you
		// mean to drop the other side's events?" question, and the
		// integrator cap eventually trips — leaving the chain's real
		// content stranded on a dead worktree. `merge=union` is the
		// textbook fix for append-only logs: git concatenates both
		// sides' lines automatically, no integrator involvement
		// needed.
		writeFileSync(
			join(iDir, ".gitattributes"),
			[
				"# Engine-owned append-only event streams. `merge=union` tells git",
				"# to concatenate both sides on conflict — these files are pure",
				"# event streams and never benefit from manual conflict resolution.",
				"action-log.jsonl merge=union",
				"write-audit.jsonl merge=union",
				"",
			].join("\n"),
		)

		// Stage + commit `.gitattributes` ON THE INTENT MAIN BRANCH
		// before any stage / unit / fix-chain / discovery worktree
		// can fork from it. The bulk `gitCommitState` call below
		// would normally pick this up, but it swallows errors (e.g.
		// pre-commit hook failure) silently — so attempt an explicit
		// commit here first. Failure is non-fatal: the next commit
		// will retry, and `ensureIntentGitAttributes` is the
		// belt-and-braces auto-repair on legacy intents anyway.
		if (isGitRepo()) {
			try {
				const rel = `.haiku/intents/${slug}/.gitattributes`
				execFileSync("git", ["add", "--", rel], { stdio: "pipe" })
				execFileSync(
					"git",
					[
						"commit",
						"-m",
						`haiku: seed .gitattributes (merge=union for event streams) for ${slug}`,
						"--",
						rel,
					],
					{ stdio: "pipe" },
				)
			} catch {
				// Pre-commit hook, dirty index, etc. — non-fatal. The
				// `gitCommitState` below will pick it up if the user's
				// hook tolerates the bulk add; otherwise the auto-repair
				// in `ensureIntentGitAttributes` fires on the next
				// worktree-creation tick.
			}
		}

		// Also write conversation context to knowledge for
		// discoverability.
		if (context) {
			const knowledgeDir = join(iDir, "knowledge")
			mkdirSync(knowledgeDir, { recursive: true })
			writeFileSync(
				join(knowledgeDir, "CONVERSATION-CONTEXT.md"),
				`# Conversation Context\n\n${context}\n`,
			)
		}

		gitCommitState(`haiku: create intent ${slug}`)

		// Open a draft PR off `haiku/<slug>/main` against the repo
		// mainline so the team has one place to watch the work happen.
		// The engine flips draft → ready in workflowIntentComplete on the
		// final approval. Best-effort: failures stamp draft_pr_status:
		// "failed" but never block intent creation. Skipped silently when
		// the repo has no provider CLI (gh / glab) on PATH.
		let draftPrMessage = ""
		if (isGitRepo() && detectPrTool() !== null) {
			try {
				const intentMdPath = join(iDir, "intent.md")
				const draft = openIntentDraftPullRequest({
					slug,
					title: title ? `H·AI·K·U: ${title}` : `H·AI·K·U: ${slug}`,
					body: description
						? `${description}\n\n---\n\nIntent slug: \`${slug}\`. The H·AI·K·U engine opened this PR as a draft so the work can be watched as stages land. The engine will mark it ready when the intent completes.`
						: undefined,
				})
				if (draft.createdUrl) {
					setFrontmatterField(intentMdPath, "draft_pr_url", draft.createdUrl)
					setFrontmatterField(intentMdPath, "draft_pr_status", "draft")
					draftPrMessage = `\n\nDraft PR opened: ${draft.createdUrl}`
				} else if (draft.compareUrl) {
					setFrontmatterField(intentMdPath, "draft_pr_status", "failed")
					draftPrMessage = `\n\nThe engine couldn't open the draft PR via the CLI (${draft.prError ?? draft.pushError ?? "unknown"}). Open one manually: ${draft.compareUrl}`
				} else {
					setFrontmatterField(intentMdPath, "draft_pr_status", "failed")
					draftPrMessage = `\n\nThe engine couldn't open a draft PR: ${draft.message}`
				}
				gitCommitState(`haiku: stamp draft PR status for ${slug}`)
				// Push the stamp commit so a handoff user's fetchOrigin()
				// sees draft_pr_url. Without this, intent main on origin
				// is one commit behind local — User B picks up, reads
				// intent.md without draft_pr_url, and workflowIntentComplete
				// can't flip the draft to ready. Best-effort: push failures
				// log but don't block intent creation.
				try {
					const push = pushBranchToOrigin(intentMainBranch)
					if (!push.ok && push.error) {
						console.error(
							`[haiku_intent_create] push of ${intentMainBranch} after draft-PR stamp failed: ${push.error}`,
						)
					}
				} catch (pushErr) {
					console.error(
						`[haiku_intent_create] push after stamp threw: ${pushErr instanceof Error ? pushErr.message : String(pushErr)}`,
					)
				}
			} catch (err) {
				console.error(
					`[haiku_intent_create] draft-PR open threw: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		emitTelemetry("haiku.intent.created", { intent: slug })
		if (stateFile)
			logSessionEvent(stateFile, { event: "intent_created", intent: slug })

		return text(
			JSON.stringify(
				{
					action: "intent_created",
					slug,
					path: `.haiku/intents/${slug}`,
					message: `Intent '${slug}' created. Call haiku_run_next { intent: "${slug}" } to begin.${draftPrMessage}`,
				},
				null,
				2,
			),
		)
	},
})
