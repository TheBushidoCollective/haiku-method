// orchestrator/workflow/studio-config.ts — In-memory shape of a studio's
// workflow-relevant configuration.
//
// Built once at server boot from the existing studio-reader output
// (STUDIO.md, stages/*/STAGE.md, hats/*.md, review-agents/*.md,
// fix-hats/*.md, plus .haiku/studios/{name}/... project overrides).
// No new disk format — this is a normalization step on top of files
// already on disk.
//
// `exportStudioMermaid()` consumes this shape to render a Mermaid
// stateDiagram-v2 source for the studio's workflow. The config
// itself is regenerated whenever the underlying disk files change
// (cleared via clearStudioCache()).
//
// Shape choices:
// - Stage names are duplicated (top-level `defaultStages` array AND
//   `stages` record) so consumers can iterate the canonical order
//   without sorting the record's keys.
// - HatConfig / ReviewAgentConfig carry the mandate path, NOT the
//   inlined body. The runtime reads the path on demand. Inlining
//   bodies would bloat the machine and break visualization.
// - GateType is a discriminated union — single string for
//   simple gates, array for compound gates like `[external, ask]`.

import type { ModelTier } from "../../model-selection.js"

export type GateType = "auto" | "ask" | "external" | "await"

/** Compound gate — user picks between paths at the gate. Always at
 *  least 2 entries; the runtime renders a chooser UI when this is
 *  set. */
export type CompoundGate = readonly GateType[]

/** Stage gate is either a single type or a compound list. */
export type StageGate = GateType | CompoundGate

/** Mandate-mode (lens vs strict) carried on hat / review-agent /
 *  fix-hat frontmatter. Default is unset — the dispatch prompt
 *  doesn't emit an interpretive block. */
export type Interpretation = "lens" | "strict"

/** Reference to a hat mandate — the file body lives at `mandatePath`,
 *  read on demand. */
export interface HatConfig {
	readonly name: string
	readonly mandatePath: string
	readonly agentType?: string
	readonly model?: ModelTier
	readonly runQualityGates?: boolean
	readonly interpretation?: Interpretation
}

/** Reference to a review-agent mandate. Same shape as HatConfig but
 *  semantically distinct: review-agents log feedback, hats produce
 *  artifacts. */
export interface ReviewAgentConfig {
	readonly name: string
	readonly mandatePath: string
	readonly appliesTo?: readonly string[]
	readonly model?: ModelTier
	readonly interpretation?: Interpretation
}

/** Cross-stage input declared in STAGE.md `inputs:` — a discovery
 *  artifact or output from a prior stage. */
export interface StageInputConfig {
	readonly stage: string
	readonly discovery?: string
	readonly output?: string
}

/** A discovery artifact this stage produces — defined as a
 *  `stages/{stage}/discovery/{name}.md` template. The runtime reads
 *  the template's `location:` frontmatter to know where the
 *  populated artifact lands. */
export interface DiscoveryTemplateConfig {
	readonly name: string
	readonly templatePath: string
	/** Resolved absolute output path from the template's `location:`
	 *  frontmatter, or null if the template predates the field. */
	readonly outputPath: string | null
}

/** Stage output template — `stages/{stage}/outputs/{name}.md`.
 *  Carries `location:` (where the artifact lands), `scope:` (intent
 *  vs repo), and required-flag metadata. */
export interface OutputTemplateConfig {
	readonly name: string
	readonly templatePath: string
	readonly location: string
	readonly scope: "intent" | "repo"
	readonly required: boolean
}

/** Cross-stage review-agent inclusion — stage X's review can include
 *  stage Y's named agents. */
export interface ReviewAgentInclude {
	readonly stage: string
	readonly agents: readonly string[]
}

/** Per-stage configuration. */
export interface StageConfig {
	readonly name: string
	/** What the stage produces, from STAGE.md `produces:`. `"build"` stages
	 *  ship executable artifacts and require a `quality_gates:` field on every
	 *  producing unit (enforced at `haiku_unit_write`); `"knowledge"` stages
	 *  produce docs judged on substance/citation and carry no such requirement.
	 *  Defaults to `"knowledge"` when absent — the lenient default, so only
	 *  stages that explicitly opt in to `produces: build` change behavior. */
	readonly produces: "build" | "knowledge"
	/** Hat sequence executed during the execute phase. The fix loop
	 *  uses `fixHats` instead. */
	readonly hats: readonly HatConfig[]
	/** Hat sequence dispatched against open feedback during the fix
	 *  loop. Empty when the stage doesn't opt in to fix-loop dispatch
	 *  — feedback is surfaced to the human instead. */
	readonly fixHats: readonly HatConfig[]
	/** Adversarial review agents that run at the end of the execute
	 *  phase. */
	readonly reviewAgents: readonly ReviewAgentConfig[]
	/** Cross-stage agent inclusions from this stage's STAGE.md
	 *  `review-agents-include:`. */
	readonly reviewAgentsInclude: readonly ReviewAgentInclude[]
	/** Stage inputs — cross-stage discovery / output references. */
	readonly inputs: readonly StageInputConfig[]
	/** Gate type — auto / ask / external / await, or compound. */
	readonly gate: StageGate
	/** Stage-level model default — falls through to studio default. */
	readonly defaultModel?: ModelTier
	/** Stage elaboration guidance body, when the stage ships a custom
	 *  ELABORATION.md — additive prompt content spliced into the elaborate
	 *  prompt, not an engine phase override. */
	readonly elaborationOverride?: string
	/** Discovery templates — one subagent per template fan-out during
	 *  the elaborate phase. */
	readonly discoveryTemplates: readonly DiscoveryTemplateConfig[]
	/** Stage output templates — what the execute phase MUST produce. */
	readonly outputTemplates: readonly OutputTemplateConfig[]
	/** Stage body (STAGE.md content after frontmatter) — used as
	 *  inline context in elaborate / execute prompts. */
	readonly body: string
}

/** Top-level config for a single studio. */
export interface StudioConfig {
	/** Canonical display name (e.g., "application-development"). */
	readonly name: string
	/** Short alias / slug from STUDIO.md frontmatter. */
	readonly slug: string
	/** Directory name on disk — the stable identifier for file
	 *  operations. May differ from name/slug. */
	readonly dir: string
	/** Studio description from STUDIO.md frontmatter. */
	readonly description: string
	/** Default ordered list of stages (intent.md `stages:` can
	 *  override per-intent). */
	readonly defaultStages: readonly string[]
	/** Per-stage configuration, keyed by stage name. */
	readonly stages: Readonly<Record<string, StageConfig>>
	/** Studio-level review agents that run on intent_completion_review
	 *  (after the final stage gate). */
	readonly studioReviewAgents: readonly ReviewAgentConfig[]
	/** Studio-level fix hats that run on intent_completion_fix
	 *  against intent-scope feedback. */
	readonly studioFixHats: readonly HatConfig[]
	/** Studio-wide model default — bottom of the cascade. */
	readonly defaultModel?: ModelTier
	/** Studio body (STUDIO.md content after frontmatter). */
	readonly body: string
	/** Path to STUDIO.md — for help links, error messages. */
	readonly studioFile: string
}
