import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

const pluginStudiosDir = path.join(process.cwd(), "..", "plugin", "studios")

export interface HatDefinition {
	name: string
	stage: string
	studio: string
	content: string
}

export interface ReviewAgentDefinition {
	name: string
	stage: string
	studio: string
	content: string
}

/**
 * Generic markdown artifact (discovery template, output template, phase
 * override, fix-hat, reflection dimension, operation, intent template, etc.).
 * Carries the raw frontmatter so callers can surface a name/description without
 * a bespoke parser per file type.
 */
export interface ArtifactDef {
	name: string
	content: string
	data: Record<string, unknown>
}

export interface StageDefinition {
	name: string
	description: string
	hats: string[]
	fixHats: string[]
	review: string
	elaboration: string
	inputs: Array<{ stage: string; output: string; kind: "discovery" | "output" }>
	reviewAgentsInclude: Array<{ stage: string; agents: string[] }>
	content: string
	hatDefinitions: HatDefinition[]
	reviewAgentDefinitions: ReviewAgentDefinition[]
	// Elaborate-phase artifacts
	discoveryDefinitions: ArtifactDef[]
	outputDefinitions: ArtifactDef[]
	phaseDefinitions: ArtifactDef[]
	// Fix-loop hats, resolved from `fix_hats` in declared order. Each name is
	// resolved through the same precedence the engine uses (`resolveFixHatPath`):
	// stage fix-hat override → stage hat → studio hat → global hat. A name with
	// no resolvable mandate still appears (body empty) so the chain stays whole.
	fixHatChain: ArtifactDef[]
}

export interface StudioDefinition {
	slug: string
	name: string
	description: string
	stages: string[]
	content: string
	stageDefinitions: StageDefinition[]
	category: string
	// Intent-level lifecycle artifacts (studio scope, not per-stage)
	intentReviewAgentDefinitions: ArtifactDef[]
	studioFixHatDefinitions: ArtifactDef[]
	reflectionDefinitions: ArtifactDef[]
}

// Categorize studios by domain
const categoryLabels: Record<string, string> = {
	engineering: "Engineering",
	"go-to-market": "Go-to-Market",
	operations: "Operations",
	"back-office": "Back Office",
	product: "Product",
	general: "General Purpose",
}

function categorizeStudio(slug: string, rawCategory?: string): string {
	if (rawCategory && categoryLabels[rawCategory])
		return categoryLabels[rawCategory]
	if (rawCategory)
		return rawCategory
			.split("-")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ")
	// Legacy fallback for studios without category field
	const engineering = [
		"software",
		"data-pipeline",
		"security-assessment",
		"documentation",
	]
	const gtm = ["sales", "marketing", "customer-success"]
	const ops = [
		"incident-response",
		"migration",
		"project-management",
		"quality-assurance",
	]
	if (engineering.includes(slug)) return "Engineering"
	if (gtm.includes(slug)) return "Go-to-Market"
	if (ops.includes(slug)) return "Operations"
	return "General Purpose"
}

/** Load a single `*.md` file as a generic artifact, or null if absent. */
function loadArtifactFile(filePath: string): ArtifactDef | null {
	if (!fs.existsSync(filePath)) return null
	const raw = fs.readFileSync(filePath, "utf8")
	const { data, content } = matter(raw)
	return {
		name: (data.name as string) || path.basename(filePath, ".md"),
		content: content.trim(),
		data: data as Record<string, unknown>,
	}
}

/** Merge artifact lists by name; later lists override earlier ones (more
 *  specific tier wins). Result is sorted by name. */
function mergeByName(...lists: ArtifactDef[][]): ArtifactDef[] {
	const byName = new Map<string, ArtifactDef>()
	for (const list of lists) for (const def of list) byName.set(def.name, def)
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Load every `*.md` in a directory as a generic artifact, sorted by filename. */
function loadArtifactDir(dir: string): ArtifactDef[] {
	if (!fs.existsSync(dir)) return []
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.map((f) => loadArtifactFile(path.join(dir, f)))
		.filter((d): d is ArtifactDef => d !== null)
}

/**
 * Resolve one fix-hat name to its mandate, mirroring the engine's
 * `resolveFixHatPath`: a stage-scoped `fix-hats/` override wins, else the
 * production hat at the most-specific tier (stage → studio → global). Returns
 * a body-less stub if nothing resolves so the chain still lists the step.
 */
function resolveFixHat(stageDir: string, name: string): ArtifactDef {
	const studioDir = path.join(stageDir, "..", "..")
	const globalHatsDir = path.join(pluginStudiosDir, "..", "hats")
	const candidates = [
		path.join(stageDir, "fix-hats", `${name}.md`),
		path.join(stageDir, "hats", `${name}.md`),
		path.join(studioDir, "hats", `${name}.md`),
		path.join(globalHatsDir, `${name}.md`),
	]
	for (const candidate of candidates) {
		const def = loadArtifactFile(candidate)
		if (def) return { ...def, name }
	}
	return { name, content: "", data: {} }
}

/**
 * Best-effort one-line summary for an artifact: the first labelled lead-in
 * (Focus / Mandate / Purpose / Analyze), else the frontmatter description,
 * else the first prose line. Used to keep the browser scannable.
 */
export function artifactSummary(def: {
	content: string
	data?: Record<string, unknown>
}): string {
	const labels = ["Focus", "Mandate", "Purpose", "Analyze", "Goal"]
	for (const label of labels) {
		const m = def.content.match(
			new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?:\\n|$)`),
		)
		if (m) return m[1].trim()
	}
	const desc = def.data?.description
	if (typeof desc === "string" && desc.trim()) return desc.trim()
	const firstProse = def.content
		.split("\n")
		.map((l) => l.trim())
		.find((l) => l && !l.startsWith("#") && !l.startsWith("---"))
	return firstProse || ""
}

function parseHat(hatPath: string): HatDefinition | null {
	if (!fs.existsSync(hatPath)) return null
	const raw = fs.readFileSync(hatPath, "utf8")
	const { data, content } = matter(raw)
	return {
		name: data.name || path.basename(hatPath, ".md"),
		stage: data.stage || "",
		studio: data.studio || "",
		content: content.trim(),
	}
}

function parseReviewAgent(agentPath: string): ReviewAgentDefinition | null {
	if (!fs.existsSync(agentPath)) return null
	const raw = fs.readFileSync(agentPath, "utf8")
	const { data, content } = matter(raw)
	return {
		name: data.name || path.basename(agentPath, ".md"),
		stage: data.stage || "",
		studio: data.studio || "",
		content: content.trim(),
	}
}

function parseStage(stageDir: string): StageDefinition | null {
	const stagePath = path.join(stageDir, "STAGE.md")
	if (!fs.existsSync(stagePath)) return null
	const raw = fs.readFileSync(stagePath, "utf8")
	const { data, content } = matter(raw)

	// Parse hats
	const hatsDir = path.join(stageDir, "hats")
	const hatDefinitions: HatDefinition[] = []
	if (fs.existsSync(hatsDir)) {
		const hatFiles = fs
			.readdirSync(hatsDir)
			.filter((f) => f.endsWith(".md"))
			.sort()
		for (const hatFile of hatFiles) {
			const hat = parseHat(path.join(hatsDir, hatFile))
			if (hat) hatDefinitions.push(hat)
		}
	}

	// Parse review agents
	const reviewAgentsDir = path.join(stageDir, "review-agents")
	const reviewAgentDefinitions: ReviewAgentDefinition[] = []
	if (fs.existsSync(reviewAgentsDir)) {
		const agentFiles = fs
			.readdirSync(reviewAgentsDir)
			.filter((f) => f.endsWith(".md"))
			.sort()
		for (const agentFile of agentFiles) {
			const agent = parseReviewAgent(path.join(reviewAgentsDir, agentFile))
			if (agent) reviewAgentDefinitions.push(agent)
		}
	}

	return {
		name: data.name || path.basename(stageDir),
		description: data.description || "",
		hats: data.hats || [],
		fixHats: data.fix_hats || [],
		review: Array.isArray(data.review)
			? data.review.join(", ")
			: data.review || "ask",
		elaboration: data.elaboration || "",
		inputs: (data.inputs || []).map(
			(i: { stage: string; output?: string; discovery?: string }) => ({
				stage: i.stage,
				output: i.discovery || i.output || "",
				kind: (i.discovery ? "discovery" : "output") as "discovery" | "output",
			}),
		),
		reviewAgentsInclude: (data["review-agents-include"] || []).map(
			(i: { stage: string; agents: string[] }) => ({
				stage: i.stage,
				agents: i.agents || [],
			}),
		),
		content: content.trim(),
		hatDefinitions,
		reviewAgentDefinitions,
		discoveryDefinitions: loadArtifactDir(path.join(stageDir, "discovery")),
		outputDefinitions: loadArtifactDir(path.join(stageDir, "outputs")),
		phaseDefinitions: loadArtifactDir(path.join(stageDir, "phases")),
		fixHatChain: (data.fix_hats || []).map((name: string) =>
			resolveFixHat(stageDir, name),
		),
	}
}

function parseStudio(studioDir: string): StudioDefinition | null {
	const studioPath = path.join(studioDir, "STUDIO.md")
	if (!fs.existsSync(studioPath)) return null
	const raw = fs.readFileSync(studioPath, "utf8")
	const { data, content } = matter(raw)
	const slug = path.basename(studioDir)

	// Parse stages in order defined by frontmatter
	const stageNames: string[] = data.stages || []
	const stageDefinitions: StageDefinition[] = []
	for (const stageName of stageNames) {
		const stageDir = path.join(studioDir, "stages", stageName)
		const stage = parseStage(stageDir)
		if (stage) stageDefinitions.push(stage)
	}

	return {
		slug,
		name: data.name || slug,
		description: data.description || "",
		stages: stageNames,
		content: content.trim(),
		stageDefinitions,
		category: categorizeStudio(slug, data.category as string | undefined),
		// Global tier (sibling of studios/) applies to every studio; the
		// per-studio dir overrides by agent name. Mirrors the engine's
		// readStudioReviewAgentPaths cascade.
		intentReviewAgentDefinitions: mergeByName(
			loadArtifactDir(path.join(pluginStudiosDir, "..", "intent-review-agents")),
			loadArtifactDir(path.join(studioDir, "intent-review-agents")),
		),
		studioFixHatDefinitions: loadArtifactDir(path.join(studioDir, "fix-hats")),
		reflectionDefinitions: loadArtifactDir(path.join(studioDir, "reflections")),
	}
}

export function getAllStudios(): StudioDefinition[] {
	if (!fs.existsSync(pluginStudiosDir)) return []
	const dirs = fs.readdirSync(pluginStudiosDir).filter((d) => {
		const fullPath = path.join(pluginStudiosDir, d)
		return fs.statSync(fullPath).isDirectory()
	})
	return dirs
		.map((d) => parseStudio(path.join(pluginStudiosDir, d)))
		.filter((s): s is StudioDefinition => s !== null)
		.sort((a, b) => {
			const catOrder = [
				"Engineering",
				"Product",
				"Go-to-Market",
				"Operations",
				"Back Office",
				"General Purpose",
			]
			const catDiff =
				catOrder.indexOf(a.category) - catOrder.indexOf(b.category)
			if (catDiff !== 0) return catDiff
			return a.name.localeCompare(b.name)
		})
}

export function getStudioBySlug(slug: string): StudioDefinition | null {
	const studioDir = path.join(pluginStudiosDir, slug)
	return parseStudio(studioDir)
}

export function getStudioSlugs(): string[] {
	return getAllStudios().map((s) => s.slug)
}

export function getStudiosGrouped(): Map<string, StudioDefinition[]> {
	const studios = getAllStudios()
	const groups = new Map<string, StudioDefinition[]>()
	for (const studio of studios) {
		const existing = groups.get(studio.category) || []
		existing.push(studio)
		groups.set(studio.category, existing)
	}
	return groups
}
