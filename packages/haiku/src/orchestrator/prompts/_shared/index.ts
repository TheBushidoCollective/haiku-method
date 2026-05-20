// orchestrator/prompts/_shared/index.ts — Shared prompt blocks
// reused by multiple prompt builders.
//
// Each block lives as a sibling `.md` (or `.eta.md`) file. The
// `loadTemplate` helper reads the file at module load in dev/test
// (tsx, bun, plain node); the `canonicalize-prompt-templates` esbuild
// plugin rewrites every loadTemplate call to a `@canon:<rel>` sentinel
// at bundle time, and the canonical template body ships at
// `plugin/prompts/<rel>` for the runtime cascade to read.
//
// Token-optimization layer (2026-05-19): the per-tick prompts no
// longer inline these blocks. They live on disk under
// `~/.haiku/projects/<key>/shared/<name>.md` (project-scoped — same
// content across every intent in the project) and prompts reference
// them by absolute path. The agent reads the file once per session
// and retains the rules in context for subsequent ticks. The
// constants below are kept exported so any caller that genuinely
// needs the inline content (e.g. tests asserting on prose) still has
// it; new callers should use `sharedBlockRef` instead.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { Eta } from "eta"
import { MAX_STAGE_ITERATIONS } from "../../../state-tools.js"
import { findHaikuRoot } from "../../../state/shared.js"
import { loadTemplate } from "../_load-template.js"

// Every shared block loads its template LAZILY (on first access),
// memoized thereafter. Module-init must do NO filesystem I/O: this
// module sits in `state-tools.js`'s transitive import graph, so any
// subcommand that imports state-tools (the status line, migrate, etc.)
// would otherwise fire these `loadTemplate` calls at import time —
// before `resolvePluginRoot()` can reliably resolve the plugin root in
// a non-MCP process — and throw. Deferring to use time means the
// template is read only when a prompt builder actually renders, where
// the project→plugin cascade root is known. (It also avoids the TDZ on
// `MAX_STAGE_ITERATIONS` for the review block.)
const eta = new Eta({ autoEscape: false, useWith: true })

function memoTemplate(name: string): () => string {
	let cached: string | null = null
	return () => {
		if (cached === null) cached = loadTemplate(import.meta.url, name)
		return cached
	}
}

const announcementBlock = memoTemplate("announcement.md")
const subagentErrorRecovery = memoTemplate("subagent-error-recovery.md")
const elaborateBlock = memoTemplate("workflow-contracts-elaborate.md")
const executeBlock = memoTemplate("workflow-contracts-execute.md")
const fixLoopBlock = memoTemplate("workflow-contracts-fix-loop.md")
const runtimeVerificationBlock = memoTemplate("runtime-verification.md")

// Review block has one substitution (MAX_STAGE_ITERATIONS) — render
// lazily on first access. Eta is heavy for a single substitution but
// keeps the templating mechanism uniform with the per-action prompts.
let _reviewBlockCached: string | null = null
export function getWorkflowContractsReviewBlock(): string {
	if (_reviewBlockCached === null) {
		_reviewBlockCached = eta.renderString(
			loadTemplate(import.meta.url, "workflow-contracts-review.eta.md"),
			{ maxStageIterations: MAX_STAGE_ITERATIONS },
		)
	}
	return _reviewBlockCached
}

// ── Reference-by-path layer ──────────────────────────────────────

type SharedBlockId =
	| "workflow-contracts-elaborate"
	| "workflow-contracts-execute"
	| "workflow-contracts-review"
	| "workflow-contracts-fix-loop"
	| "workflow-contracts-announcement"
	| "subagent-error-recovery"
	| "runtime-verification"

interface SharedBlockEntry {
	/** Getter rather than eager string — the review block reads
	 *  `MAX_STAGE_ITERATIONS` from `state-tools.js`, which imports back
	 *  through this module. Evaluating at use time avoids the TDZ. */
	content: () => string
	title: string
	summary: string
}

const REGISTRY: Record<SharedBlockId, SharedBlockEntry> = {
	"workflow-contracts-elaborate": {
		content: () => elaborateBlock(),
		title: "Universal workflow contracts (elaborate)",
		summary:
			"unit-file naming, the same-stage `depends_on:` DAG, executable `quality_gates:`, per-unit `model:` selection, revisit `closes:`, the elaborate-phase MCP tool surface, unit-content validation, and authoring discipline.",
	},
	"workflow-contracts-execute": {
		content: () => executeBlock(),
		title: "Universal workflow contracts (execute)",
		summary:
			"the per-hat advance/reject contract, bolt count limits, and the engine-owned fields (`bolt`, `hat`, `status`, `iterations`) hats must NOT mutate directly.",
	},
	"workflow-contracts-review": {
		content: () => getWorkflowContractsReviewBlock(),
		title: "Universal workflow contracts (review)",
		summary:
			"the review/approval role split, when to file feedback vs sign-off, and the iteration cap that drives gate-blocking escalation.",
	},
	"workflow-contracts-fix-loop": {
		content: () => fixLoopBlock(),
		title: "Universal workflow contracts (fix-loop)",
		summary:
			"how fix hats edit feedback bodies (NOT unit specs), the per-finding bolt cap, the advance vs reject vs reject_hat distinction, and feedback-assessor's closure authority.",
	},
	"workflow-contracts-announcement": {
		content: () => announcementBlock(),
		title: "Subagent-announce discipline",
		summary:
			"how to announce a subagent dispatch in the same response as the spawn — one sentence on WHAT is starting and HOW MANY agents, no jargon.",
	},
	"subagent-error-recovery": {
		content: () => subagentErrorRecovery(),
		title: "Subagent error-recovery contract",
		summary:
			"how to handle subagent failures — rescue attempts before declaring blocked, the diagnostic that goes in the bolt summary, and the workflow tool surface for failure reporting.",
	},
	"runtime-verification": {
		content: () => runtimeVerificationBlock(),
		title: "Runtime-verification doctrine",
		summary:
			"that verification is runtime observation (NOT running tests/typecheck); how to find the change's surface and route to a handle (web/GUI → `haiku_view` boot + `haiku-playwright`; CLI → run the command; server → the socket; library → the public export); the `.haiku/boot.md` project boot recipe; how to drive the smallest path, probe around the change, capture evidence under `proof/`; and the PASS/FAIL/BLOCKED/SKIP verdict that drives sign-off vs. feedback.",
	},
}

// Tracks the last directory we wrote shared blocks into. Stays in sync
// with sharedDir()'s current return; if the env-var redirect or cwd
// changes (tests switching tmpdirs), the materialize gate re-fires for
// the new location. Holding a `sharedDirCache` instead would silently
// keep writing to the stale location.
let materializedAt = ""

/** Resolve the canonical project root. Mirrors the helper in
 *  `subagent-prompt-file.ts` so linked git worktrees collapse to the
 *  MAIN worktree's path — all worktrees on the same repo share one
 *  `<base>/<key>/shared/` tree. The work is a single git invocation +
 *  a couple of fs checks; cheap enough to redo per call so tests that
 *  change cwd / env vars get the new result immediately. */
function resolveSharedProjectRoot(): string {
	try {
		const out = execFileSync("git", ["rev-parse", "--git-common-dir"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim()
		if (out) return dirname(resolve(out))
	} catch {
		/* not a git repo */
	}
	try {
		return dirname(findHaikuRoot())
	} catch {
		return process.cwd()
	}
}

/** Resolve `<projects-root>/<project-key>/shared/`. Project-scoped:
 *  the same rules apply across every intent in the project, so we
 *  write the files once and reference them from every prompt. The
 *  base path defaults to `~/.haiku/projects/`; set
 *  `HAIKU_PROJECTS_ROOT` to redirect (tests point this at a tmpdir
 *  to avoid polluting the user's real home). */
function sharedDir(): string {
	const key = resolveSharedProjectRoot().replace(/\//g, "-")
	const base =
		process.env.HAIKU_PROJECTS_ROOT ?? join(homedir(), ".haiku", "projects")
	return join(base, key, "shared")
}

/** Write all shared blocks to disk. Re-runs on every cold start of
 *  the MCP process (cheap — 6 small files) so plugin upgrades that
 *  change the block content take effect without a manual purge. */
function materializeAllSharedBlocks(): void {
	const dir = sharedDir()
	if (materializedAt === dir) return
	mkdirSync(dir, { recursive: true })
	for (const [id, entry] of Object.entries(REGISTRY) as Array<
		[SharedBlockId, SharedBlockEntry]
	>) {
		try {
			writeFileSync(join(dir, `${id}.md`), entry.content(), "utf8")
		} catch {
			/* best-effort */
		}
	}
	materializedAt = dir
}

/** Return a short reference block for the named shared content. The
 *  agent is instructed to Read the file; the engine relies on it
 *  having been read at least once per session, after which the
 *  content is in context for the remaining ticks.
 *
 *  This is the ONLY new way to depend on the universal contracts —
 *  the inline constants stay exported but the prompt builders should
 *  call `sharedBlockRef(...)` so each tick stays light. */
/** Resolve a shared block's raw body (loaded lazily on first access).
 *  Exposed for callers/tests that need the content itself rather than
 *  the "go read this file" reference markup `sharedBlockRef` emits. */
export function sharedBlockContent(id: SharedBlockId): string {
	return REGISTRY[id].content()
}

/** Review-agent roles that DRIVE the live work (runtime observation)
 *  rather than read it statically. They inherit the `runtime-verification`
 *  doctrine and are permitted to write evidence captures under `proof/`
 *  (but never source). Shared by every dispatch builder so the set stays
 *  single-source. */
export const RUNTIME_OBSERVATION_ROLES: ReadonlySet<string> = new Set([
	"runtime-verifier",
])

export function sharedBlockRef(id: SharedBlockId): string {
	materializeAllSharedBlocks()
	const entry = REGISTRY[id]
	const path = join(sharedDir(), `${id}.md`)
	return [
		`### ${entry.title} (REQUIRED reading)`,
		"",
		`**Read** \`${path}\` **before continuing this prompt.** It defines ${entry.summary} These rules are universal — the workflow engine validates against them; non-compliant work blocks at \`haiku_run_next\`. The file is stable across ticks, so once you've read it this session you've got it.`,
	].join("\n")
}

// ── Provider-doc reference layer ─────────────────────────────────

const providersDir = (): string => join(sharedDir(), "providers")
// Keyed by `<path>:<kind>` so a test that switches tmpdirs between
// runs (HAIKU_PROJECTS_ROOT redirect) re-materializes for the new
// location instead of skipping the write.
const materializedProviders = new Set<string>()

/** Write a provider doc's body to the per-project shared/providers/
 *  directory once per process per path. Path is stable
 *  (`<projects-root>/<key>/shared/providers/<kind>.md`), so the
 *  agent's earlier-read context stays valid across ticks. */
function materializeProviderDoc(kind: string, body: string): string {
	const dir = providersDir()
	mkdirSync(dir, { recursive: true })
	const path = join(dir, `${kind}.md`)
	const cacheKey = `${path}:${kind}`
	if (!materializedProviders.has(cacheKey)) {
		try {
			writeFileSync(path, body, "utf8")
		} catch {
			/* best-effort */
		}
		materializedProviders.add(cacheKey)
	}
	return path
}

interface ProviderRefInput {
	kind: string
	category: "source" | "workflow"
	body: string
	description?: string
}

/** Format the per-provider reference block. One reference per provider
 *  per splice point — the prompt builder collects active providers for
 *  the phase, calls this for each, and concatenates. */
export function providerBlockRef(p: ProviderRefInput): string {
	const path = materializeProviderDoc(p.kind, p.body)
	const desc = p.description ? ` ${p.description}` : ""
	return [
		`### Provider: \`${p.kind}\` (${p.category}) — behavior contract`,
		"",
		`**Read** \`${path}\` **before continuing this prompt.**${desc} The contract describes how to operate against the configured \`${p.kind}\` provider in this project — what to read, what to write, what to record in \`external_refs:\`, and how to degrade when the required MCP tools aren't available.`,
	].join("\n")
}
