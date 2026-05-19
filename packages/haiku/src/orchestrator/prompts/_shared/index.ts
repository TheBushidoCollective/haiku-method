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

import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { Eta } from "eta"
import { MAX_STAGE_ITERATIONS } from "../../../state-tools.js"
import { findHaikuRoot } from "../../../state/shared.js"
import { loadTemplate } from "../_load-template.js"

export const WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK = loadTemplate(
	import.meta.url,
	"announcement.md",
)

export const SUBAGENT_ERROR_RECOVERY = loadTemplate(
	import.meta.url,
	"subagent-error-recovery.md",
)

export const WORKFLOW_CONTRACTS_ELABORATE_BLOCK = loadTemplate(
	import.meta.url,
	"workflow-contracts-elaborate.md",
)

export const WORKFLOW_CONTRACTS_EXECUTE_BLOCK = loadTemplate(
	import.meta.url,
	"workflow-contracts-execute.md",
)

export const WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK = loadTemplate(
	import.meta.url,
	"workflow-contracts-fix-loop.md",
)

// Review block has one substitution (MAX_STAGE_ITERATIONS) — render
// once at module load. Eta is heavy for a single substitution but
// keeps the templating mechanism uniform with the per-action prompts.
const REVIEW_TEMPLATE = loadTemplate(
	import.meta.url,
	"workflow-contracts-review.eta.md",
)
const eta = new Eta({ autoEscape: false, useWith: true })
export const WORKFLOW_CONTRACTS_REVIEW_BLOCK = eta.renderString(
	REVIEW_TEMPLATE,
	{ maxStageIterations: MAX_STAGE_ITERATIONS },
)

// ── Reference-by-path layer ──────────────────────────────────────

type SharedBlockId =
	| "workflow-contracts-elaborate"
	| "workflow-contracts-execute"
	| "workflow-contracts-review"
	| "workflow-contracts-fix-loop"
	| "workflow-contracts-announcement"
	| "subagent-error-recovery"

interface SharedBlockEntry {
	content: string
	title: string
	summary: string
}

const REGISTRY: Record<SharedBlockId, SharedBlockEntry> = {
	"workflow-contracts-elaborate": {
		content: WORKFLOW_CONTRACTS_ELABORATE_BLOCK,
		title: "Universal workflow contracts (elaborate)",
		summary:
			"unit-file naming, the same-stage `depends_on:` DAG, executable `quality_gates:`, per-unit `model:` selection, revisit `closes:`, the elaborate-phase MCP tool surface, unit-content validation, and authoring discipline.",
	},
	"workflow-contracts-execute": {
		content: WORKFLOW_CONTRACTS_EXECUTE_BLOCK,
		title: "Universal workflow contracts (execute)",
		summary:
			"the per-hat advance/reject contract, bolt count limits, and the engine-owned fields (`bolt`, `hat`, `status`, `iterations`) hats must NOT mutate directly.",
	},
	"workflow-contracts-review": {
		content: WORKFLOW_CONTRACTS_REVIEW_BLOCK,
		title: "Universal workflow contracts (review)",
		summary:
			"the review/approval role split, when to file feedback vs sign-off, and the iteration cap that drives gate-blocking escalation.",
	},
	"workflow-contracts-fix-loop": {
		content: WORKFLOW_CONTRACTS_FIX_LOOP_BLOCK,
		title: "Universal workflow contracts (fix-loop)",
		summary:
			"how fix hats edit feedback bodies (NOT unit specs), the per-finding bolt cap, the advance vs reject vs reject_hat distinction, and feedback-assessor's closure authority.",
	},
	"workflow-contracts-announcement": {
		content: WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK,
		title: "Subagent-announce discipline",
		summary:
			"how to announce a subagent dispatch in the same response as the spawn — one sentence on WHAT is starting and HOW MANY agents, no jargon.",
	},
	"subagent-error-recovery": {
		content: SUBAGENT_ERROR_RECOVERY,
		title: "Subagent error-recovery contract",
		summary:
			"how to handle subagent failures — rescue attempts before declaring blocked, the diagnostic that goes in the bolt summary, and the workflow tool surface for failure reporting.",
	},
}

let materializedAt = ""
let sharedDirCache = ""

/** Resolve `~/.haiku/projects/<project-key>/shared/`. Project-scoped:
 *  the same rules apply across every intent in the project, so we
 *  write the files once and reference them from every prompt. */
function sharedDir(): string {
	if (sharedDirCache) return sharedDirCache
	let projectRoot: string
	try {
		projectRoot = dirname(findHaikuRoot())
	} catch {
		projectRoot = process.cwd()
	}
	const key = projectRoot.replace(/\//g, "-")
	sharedDirCache = join(homedir(), ".haiku", "projects", key, "shared")
	return sharedDirCache
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
			writeFileSync(join(dir, `${id}.md`), entry.content, "utf8")
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
const materializedProviders = new Set<string>()

/** Write a provider doc's body to the per-project shared/providers/
 *  directory once per process. Path is stable
 *  (`<key>/shared/providers/<kind>.md`), so the agent's earlier-read
 *  context stays valid across ticks. */
function materializeProviderDoc(kind: string, body: string): string {
	const dir = providersDir()
	mkdirSync(dir, { recursive: true })
	const path = join(dir, `${kind}.md`)
	if (!materializedProviders.has(kind)) {
		try {
			writeFileSync(path, body, "utf8")
		} catch {
			/* best-effort */
		}
		materializedProviders.add(kind)
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
