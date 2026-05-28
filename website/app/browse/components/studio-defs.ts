// Lazy client loader for bundled studio definitions (review-agent + hat
// mandate bodies). They're built from plugin/studios into the static
// /prototype-stage-content.json (the same file the architecture map reads), so
// the browse detail view can open an agent's mandate in a modal without a
// round-trip to the studio stage page. Static-export friendly: a plain fetch
// of a public asset, cached module-level.

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
}
interface StageContentRoot {
	studios?: Record<string, StudioContent>
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

export interface ReviewAgentDef {
	body: string
	path: string | null
}

/** Resolve a review/approval agent's mandate body for (studio, stage, role).
 *  Tries the named stage first, then any stage in the studio (a borrowed
 *  agent's def lives on its home stage). Returns null when the role ships no
 *  def — engine roles (spec/continuity/…) and the user/quality-gate slots. */
export async function loadReviewAgentDef(
	studio: string,
	stage: string,
	role: string,
): Promise<ReviewAgentDef | null> {
	const content = await loadStageContent()
	const stages = content?.studios?.[studio]?.stages
	if (!stages) return null
	const pick = (sc?: StageContent): ReviewAgentDef | null => {
		const def = sc?.reviewAgents?.[role]
		const body = def?.body ?? def?.content
		return body ? { body, path: def?.path ?? null } : null
	}
	const direct = pick(stages[stage])
	if (direct) return direct
	for (const sc of Object.values(stages)) {
		const hit = pick(sc)
		if (hit) return hit
	}
	return null
}
