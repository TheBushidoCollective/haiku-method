// Lazy client loader for bundled studio definitions, used by the sign-off modal
// to show what each review/approval role actually does:
//   - studio review / intent-review agents -> their `*.md` mandate body
//   - engine roles (spec / continuity / cross-stage-consistency) -> the engine
//     prompt body for the phase walk (review / approve / intent)
//   - user -> a description of the human gate
//   - quality_gates -> the unit/intent's gate command list
// All read from the static /prototype-stage-content.json (the same asset the
// architecture map reads), cached module-level. Static-export friendly.

interface AgentDef {
	body?: string
	content?: string
	path?: string
}
interface StageContent {
	reviewAgents?: Record<string, AgentDef>
}
interface StudioContent {
	stages?: Record<string, StageContent>
	intentReviewAgents?: Record<string, AgentDef>
}
interface StageContentRoot {
	studios?: Record<string, StudioContent>
	engineReviewBodies?: Record<string, Record<string, AgentDef>>
	globalIntentReviewAgents?: Record<string, AgentDef>
}

let cache: Promise<StageContentRoot | null> | null = null

function loadStageContent(): Promise<StageContentRoot | null> {
	if (!cache) {
		cache = fetch("/prototype-stage-content.json")
			.then((r) => (r.ok ? (r.json() as Promise<StageContentRoot>) : null))
			.catch(() => null)
	}
	return cache
}

export interface RoleDefBody {
	body: string
	path: string | null
}

export type SignOffScope = "review" | "approve" | "intent"

export interface QualityGate {
	name?: string
	command: string
	dir?: string
}

const ENGINE_BODY_ROLES = new Set([
	"spec",
	"continuity",
	"cross-stage-consistency",
])

function bodyOf(def?: AgentDef): RoleDefBody | null {
	const body = def?.body ?? def?.content
	return body ? { body, path: def?.path ?? null } : null
}

/** Resolve a studio agent's mandate body for (studio, stage, role): a stage
 *  review agent (named stage first, then any stage for a borrowed agent), then
 *  a studio intent-review agent, then a global intent-review agent. */
export async function loadReviewAgentDef(
	studio: string,
	stage: string,
	role: string,
): Promise<RoleDefBody | null> {
	const content = await loadStageContent()
	const sc = content?.studios?.[studio]
	const stages = sc?.stages
	if (stages) {
		const direct = bodyOf(stages[stage]?.reviewAgents?.[role])
		if (direct) return direct
		for (const s of Object.values(stages)) {
			const hit = bodyOf(s?.reviewAgents?.[role])
			if (hit) return hit
		}
	}
	return (
		bodyOf(sc?.intentReviewAgents?.[role]) ??
		bodyOf(content?.globalIntentReviewAgents?.[role])
	)
}

/** The engine prompt body for an engine role at a given phase walk. */
async function loadEngineBody(
	scope: SignOffScope,
	role: string,
): Promise<RoleDefBody | null> {
	const content = await loadStageContent()
	return bodyOf(content?.engineReviewBodies?.[scope]?.[role])
}

const USER_GATE_BODY = `**Mandate:** The \`user\` gate is the one checkpoint where a human — not an agent — signs off.

The engine pauses here and waits for a person to approve the work. It is the human-in-the-loop control point: a reviewer reads what was produced, then approves (advance) or requests changes (which open feedback the fix loop addresses).

Autopilot intents drop this gate — they run without a human approval step — so it won't appear on an autopilot unit.`

function formatQualityGates(gates?: QualityGate[]): RoleDefBody | null {
	const list = (gates ?? []).filter(
		(g) => g && typeof g.command === "string" && g.command.trim().length > 0,
	)
	if (list.length === 0) return null
	const blocks = list
		.map((g) => {
			const head = `### ${g.name?.trim() || "gate"}`
			const dir = g.dir ? `Runs in \`${g.dir}\`\n\n` : ""
			return `${head}\n\n${dir}\`\`\`sh\n${g.command.trim()}\n\`\`\``
		})
		.join("\n\n")
	const body = `**Quality gates** — executable checks run at advance time; a non-zero exit blocks the gate.\n\n${blocks}`
	return { body, path: null }
}

/** Resolve the modal body for any sign-off role:
 *  user -> gate description; quality_gates -> command list; engine roles ->
 *  the phase-appropriate engine prompt; everything else -> the studio agent's
 *  mandate. Returns null when there's nothing to show (e.g. a quality-gate role
 *  with no declared commands). */
export async function loadRoleDef(args: {
	role: string
	studio: string
	stage: string
	scope: SignOffScope
	qualityGates?: QualityGate[]
}): Promise<RoleDefBody | null> {
	const { role, studio, stage, scope, qualityGates } = args
	if (role === "user") return { body: USER_GATE_BODY, path: null }
	if (role === "quality_gates" || role === "intent_quality_gates") {
		return formatQualityGates(qualityGates)
	}
	if (ENGINE_BODY_ROLES.has(role)) return loadEngineBody(scope, role)
	return loadReviewAgentDef(studio, stage, role)
}

/** Whether a role has something to show in the modal — drives whether its
 *  sign-off label renders as a button. Quality-gate roles only open when there
 *  are commands to show. */
export function roleOpensModal(
	role: string,
	studio: string,
	qualityGates?: QualityGate[],
): boolean {
	if (role === "quality_gates" || role === "intent_quality_gates") {
		return (qualityGates?.length ?? 0) > 0
	}
	if (role === "user" || ENGINE_BODY_ROLES.has(role)) return true
	return Boolean(studio)
}
