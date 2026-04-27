// orchestrator/workflow/build-studio-config.ts — Build the in-memory
// StudioConfig from the existing studio-reader output.
//
// Responsibilities:
// - Resolve the studio identifier to its on-disk dir.
// - For each stage in the studio's default list, read STAGE.md +
//   hats/*.md + review-agents/*.md + discovery/*.md + outputs/*.md +
//   phase override files. Normalize into StageConfig.
// - Read studio-level review-agents/*.md and fix-hats/*.md.
// - Compose into StudioConfig.
//
// Caching is owned by the studio-reader's listStudios cache. This
// shaper just re-runs on every call; consumers cache their machine
// instance to avoid re-running it per request.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ModelTier } from "../../model-selection.js"
import { parseFrontmatter } from "../../state-tools.js"
import {
	readPhaseOverride,
	readReviewAgentPaths,
	readStageArtifactDefs,
	readStageDef,
	readStudio,
	readStudioFixHatPaths,
	readStudioReviewAgentPaths,
	resolveStudio,
	studioSearchPaths,
} from "../../studio-reader.js"
import type {
	DiscoveryTemplateConfig,
	HatConfig,
	Interpretation,
	OutputTemplateConfig,
	ReviewAgentConfig,
	ReviewAgentInclude,
	StageConfig,
	StageGate,
	StageInputConfig,
	StudioConfig,
} from "./studio-config.js"

const VALID_GATES = new Set(["auto", "ask", "external", "await"])

function parseInterpretation(value: unknown): Interpretation | undefined {
	if (value === "lens" || value === "strict") return value
	return undefined
}

function parseModel(value: unknown): ModelTier | undefined {
	if (value === "haiku" || value === "sonnet" || value === "opus") {
		return value as ModelTier
	}
	return undefined
}

function parseGate(value: unknown): StageGate {
	// Compound: array of valid gate strings.
	if (Array.isArray(value)) {
		const items = value.filter((v): v is string => typeof v === "string")
		const valid = items.filter((v) => VALID_GATES.has(v)) as Array<
			"auto" | "ask" | "external" | "await"
		>
		if (valid.length >= 2) return valid as StageGate
		if (valid.length === 1) return valid[0]
	}
	if (typeof value === "string" && VALID_GATES.has(value)) {
		return value as StageGate
	}
	// Default: ask. Matches runNext's fallback when `review:` is missing.
	return "ask"
}

function parseAppliesTo(value: unknown): readonly string[] | undefined {
	if (Array.isArray(value)) {
		const out = value.filter((v): v is string => typeof v === "string")
		return out.length > 0 ? out : undefined
	}
	return undefined
}

/** Read a hat or fix-hat mandate's frontmatter and assemble HatConfig. */
function buildHatConfig(name: string, mandatePath: string): HatConfig {
	if (!existsSync(mandatePath)) {
		return { name, mandatePath }
	}
	try {
		const { data } = parseFrontmatter(readFileSync(mandatePath, "utf8"))
		return {
			name,
			mandatePath,
			agentType:
				typeof data.agent_type === "string" ? data.agent_type : undefined,
			model: parseModel(data.model),
			runQualityGates: data.run_quality_gates === true,
			interpretation: parseInterpretation(data.interpretation),
		}
	} catch {
		return { name, mandatePath }
	}
}

/** Same idea for review-agent mandates — reads `applies_to:` too. */
function buildReviewAgentConfig(
	name: string,
	mandatePath: string,
): ReviewAgentConfig {
	if (!existsSync(mandatePath)) {
		return { name, mandatePath }
	}
	try {
		const { data } = parseFrontmatter(readFileSync(mandatePath, "utf8"))
		return {
			name,
			mandatePath,
			appliesTo: parseAppliesTo(data.applies_to),
			model: parseModel(data.model),
			interpretation: parseInterpretation(data.interpretation),
		}
	} catch {
		return { name, mandatePath }
	}
}

/** Hat names for a stage come from STAGE.md `hats:` (declared
 *  order). The mandate path is the on-disk hats/{name}.md, resolved
 *  through the studio search paths. */
function resolveHatPath(
	studioDir: string,
	stage: string,
	hatName: string,
): string {
	for (const base of studioSearchPaths()) {
		const candidate = join(
			base,
			studioDir,
			"stages",
			stage,
			"hats",
			`${hatName}.md`,
		)
		if (existsSync(candidate)) return candidate
	}
	// Fallback to the plugin path even if missing — the hat may not
	// have a mandate file yet (rare but legal). HatConfig.mandatePath
	// being non-existent is handled downstream.
	return join(
		studioSearchPaths()[0] ?? "",
		studioDir,
		"stages",
		stage,
		"hats",
		`${hatName}.md`,
	)
}

function buildStageConfig(
	studioDir: string,
	stageName: string,
): StageConfig | null {
	const stageDef = readStageDef(studioDir, stageName)
	if (!stageDef) return null
	const data = stageDef.data
	const body = stageDef.body

	// Hats — order from STAGE.md `hats:`. HatDef metadata via
	// readHatDefs; we re-resolve mandate paths because readHatDefs
	// doesn't expose them.
	const hatNames = Array.isArray(data.hats)
		? (data.hats as unknown[]).filter((v): v is string => typeof v === "string")
		: []
	const hats: HatConfig[] = hatNames.map((name) =>
		buildHatConfig(name, resolveHatPath(studioDir, stageName, name)),
	)

	// Fix hats — same resolution but from `fix_hats:` field. These
	// reuse stage hats/{name}.md files (hats can behave differently
	// in fix-mode via a `## Fix-mode scope` section in the mandate).
	const fixHatNames = Array.isArray(data.fix_hats)
		? (data.fix_hats as unknown[]).filter(
				(v): v is string => typeof v === "string",
			)
		: []
	const fixHats: HatConfig[] = fixHatNames.map((name) =>
		buildHatConfig(name, resolveHatPath(studioDir, stageName, name)),
	)

	// Review agents — name → path map from existing reader, then
	// per-agent frontmatter for applies_to + model.
	const agentPaths = readReviewAgentPaths(studioDir, stageName)
	const reviewAgents: ReviewAgentConfig[] = Object.entries(agentPaths).map(
		([name, path]) => buildReviewAgentConfig(name, path),
	)

	// Cross-stage review-agent inclusions.
	const reviewAgentsInclude: ReviewAgentInclude[] = Array.isArray(
		data["review-agents-include"],
	)
		? (data["review-agents-include"] as unknown[])
				.filter(
					(v): v is { stage: unknown; agents: unknown } =>
						v !== null && typeof v === "object",
				)
				.map((entry) => ({
					stage: typeof entry.stage === "string" ? entry.stage : "",
					agents: Array.isArray(entry.agents)
						? (entry.agents as unknown[]).filter(
								(a): a is string => typeof a === "string",
							)
						: [],
				}))
				.filter((e) => e.stage !== "")
		: []

	// Stage inputs.
	const inputs: StageInputConfig[] = Array.isArray(data.inputs)
		? (data.inputs as unknown[])
				.filter(
					(v): v is { stage: unknown; discovery?: unknown; output?: unknown } =>
						v !== null && typeof v === "object",
				)
				.map((entry) => ({
					stage: typeof entry.stage === "string" ? entry.stage : "",
					discovery:
						typeof entry.discovery === "string" ? entry.discovery : undefined,
					output: typeof entry.output === "string" ? entry.output : undefined,
				}))
				.filter((e) => e.stage !== "")
		: []

	// Discovery templates — walk the discovery/ subdir, parse each
	// template's location: frontmatter into the absolute output path
	// the runtime checks.
	const discoveryTemplates: DiscoveryTemplateConfig[] = []
	{
		const seen = new Set<string>()
		for (const base of [...studioSearchPaths()].reverse()) {
			const dir = join(base, studioDir, "stages", stageName, "discovery")
			if (!existsSync(dir)) continue
			for (const f of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
				if (seen.has(f)) continue
				seen.add(f)
				const templatePath = join(dir, f)
				const tplRaw = readFileSync(templatePath, "utf8")
				const { data: tplFM } = parseFrontmatter(tplRaw)
				const loc = (tplFM as { location?: unknown }).location
				let outputPath: string | null = null
				if (typeof loc === "string" && loc.length > 0) {
					if (loc.startsWith(".haiku/")) {
						outputPath = join(process.cwd(), loc)
					} else if (loc.startsWith("/")) {
						outputPath = loc
					} else {
						// Intent-relative — resolved at runtime per intent.
						// Store the relative form; the runtime joins against
						// the intent dir.
						outputPath = loc
					}
				}
				discoveryTemplates.push({
					name: f.replace(/\.md$/i, "").toLowerCase(),
					templatePath,
					outputPath,
				})
			}
		}
	}

	// Output templates — readStageArtifactDefs already merges
	// discovery + outputs. Filter to outputs only.
	const outputTemplates: OutputTemplateConfig[] = readStageArtifactDefs(
		studioDir,
		stageName,
	)
		.filter((a) => a.kind === "output")
		.map((a) => ({
			name: a.name,
			templatePath: "", // readStageArtifactDefs doesn't expose path; fill in below if needed
			location: a.location,
			scope: a.scope === "repo" ? "repo" : "intent",
			required: a.required,
		}))

	// Phase overrides.
	const elaborationOverride = readPhaseOverride(
		studioDir,
		stageName,
		"ELABORATION",
	)
	const executionOverride = readPhaseOverride(studioDir, stageName, "EXECUTION")
	const reviewOverride = readPhaseOverride(studioDir, stageName, "REVIEW")

	return {
		name: stageName,
		hats,
		fixHats,
		reviewAgents,
		reviewAgentsInclude,
		inputs,
		gate: parseGate(data.review),
		defaultModel: parseModel(data.default_model),
		elaborationOverride: elaborationOverride?.body,
		executionOverride: executionOverride?.body,
		reviewOverride: reviewOverride?.body,
		discoveryTemplates,
		outputTemplates,
		body,
	}
}

/** Build the StudioConfig for a studio identified by name, slug,
 *  alias, or directory. Returns null if the studio doesn't resolve. */
export function buildStudioConfig(
	studioIdentifier: string,
): StudioConfig | null {
	const info = resolveStudio(studioIdentifier)
	if (!info) return null
	const studioDir = info.dir

	const studioFile = readStudio(studioDir)
	if (!studioFile) return null
	const data = studioFile.data
	const body = studioFile.body

	const defaultStages = Array.isArray(data.stages)
		? (data.stages as unknown[]).filter(
				(v): v is string => typeof v === "string",
			)
		: info.stages

	const stages: Record<string, StageConfig> = {}
	for (const stageName of defaultStages) {
		const cfg = buildStageConfig(studioDir, stageName)
		if (cfg) stages[stageName] = cfg
	}

	// Studio-level review agents (intent_completion_review).
	const studioAgentPaths = readStudioReviewAgentPaths(studioDir)
	const studioReviewAgents: ReviewAgentConfig[] = Object.entries(
		studioAgentPaths,
	).map(([name, path]) => buildReviewAgentConfig(name, path))

	// Studio-level fix hats (intent_completion_fix).
	const studioFixHatPaths = readStudioFixHatPaths(studioDir)
	const studioFixHats: HatConfig[] = Object.entries(studioFixHatPaths).map(
		([name, path]) => buildHatConfig(name, path),
	)

	return {
		name: info.name,
		slug: info.slug,
		dir: studioDir,
		description: info.description,
		defaultStages,
		stages,
		studioReviewAgents,
		studioFixHats,
		defaultModel: parseModel(data.default_model),
		body,
		studioFile: info.studioFile,
	}
}
