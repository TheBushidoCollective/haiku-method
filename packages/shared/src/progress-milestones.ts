// shared/src/progress-milestones.ts — Pure builder for the granular
// per-stage progress track (the milestone strip the status line and both
// review surfaces render).
//
// The ORDER (elaborate → each pre-execute review role → execute → each
// post-execute approval role → observations), the LABELS, and the
// done→active→pending finalize live here so the MCP engine's status-line
// track (`progress-track.ts`, disk-driven, precise) and the website
// browse UI (VCS-API-driven, role-list inferred from per-unit FM) can't
// drift on what the milestones ARE or how they read.
//
// What does NOT live here: the done-flag computation. Each caller gathers
// its own flags from its own data source — the engine reads cursor
// signals + studio config off disk, the website unions `reviews.*` /
// `approvals.*` keys across the stage's units. Same split as
// `deriveStageStatePure`: shared decides, caller supplies the inputs.
//
// **Pure**: no I/O, no globals. Same input → same answer.

export type StepStatus = "done" | "active" | "pending"

export interface ProgressStep {
	/** Stable key, e.g. `review:spec`, `execute`, `approve:quality_gates`.
	 *  Keyed so live updates reconcile in place without remounting. */
	key: string
	/** Human label for the phase word, e.g. "spec review", "quality gates". */
	label: string
	status: StepStatus
}

/** Label a review role for the phase word. Engine + agent roles read as
 *  "<role> review"; the human `user` gate reads as "spec gate" (it gates
 *  the pre-execute spec). */
export function reviewMilestoneLabel(role: string): string {
	if (role === "user") return "spec gate"
	if (role === "cross-stage-consistency") return "cross-stage review"
	return `${role} review`
}

/** Label an approval role. `quality_gates` and the human `user` gate get
 *  their own words; everything else reads as "<role> approval". */
export function approvalMilestoneLabel(role: string): string {
	if (role === "user") return "approval gate"
	if (role === "quality_gates") return "quality gates"
	if (role === "cross-stage-consistency") return "cross-stage approval"
	return `${role} approval`
}

/** Convert a done-flagged list into status-marked steps: every done step
 *  is `done`, the first not-done is `active`, the rest `pending`. */
export function finalizeSteps(
	raw: { key: string; label: string; done: boolean }[],
): ProgressStep[] {
	let activeAssigned = false
	return raw.map((s) => {
		if (s.done) return { key: s.key, label: s.label, status: "done" as const }
		if (!activeAssigned) {
			activeAssigned = true
			return { key: s.key, label: s.label, status: "active" as const }
		}
		return { key: s.key, label: s.label, status: "pending" as const }
	})
}

/** Per-role done flag the caller supplies: the role name + whether every
 *  unit in the stage has stamped it. */
export interface MilestoneRoleFlag {
	role: string
	/** True when every unit in the stage has stamped this role's
	 *  `reviews.<role>` / `approvals.<role>` slot. */
	stamped: boolean
}

export interface StageMilestoneInputs {
	/** Elaborate-loop done (no unmet elaborate signals). */
	elaborateDone: boolean
	/** Pre-execute review roles, in walk order. */
	reviewRoles: ReadonlyArray<MilestoneRoleFlag>
	/** Execute done (every unit past its terminal hat). */
	executeDone: boolean
	/** Post-execute approval roles, in walk order. */
	approvalRoles: ReadonlyArray<MilestoneRoleFlag>
	/** Observations milestone — pass `null`/omit when the caller has no
	 *  observations signal (the website never does; the engine only adds
	 *  it when reflection is enabled for the intent). */
	observationsDone?: boolean | null
	/** Collapse the parallel adversarial reviewers into one
	 *  `adversarial review (signed/total)` pip (default `true`). The compact
	 *  pip bar and both SPA review surfaces want this. Pass `false` to expand
	 *  each reviewer into its own pip — the status line's second line uses
	 *  this so every reviewing agent shows as its own chip. */
	groupAdversarial?: boolean
}

/** Build the ordered stage milestone list with each marked
 *  done/active/pending. A review/approval role only counts as done once
 *  its gating phase is done too (`elaborateDone &&` for reviews,
 *  `executeDone &&` for approvals) — mirrors the cursor's walk, where a
 *  role can't be signed before its phase is reached. */
export function buildStageMilestones(
	inputs: StageMilestoneInputs,
): ProgressStep[] {
	const {
		elaborateDone,
		reviewRoles,
		executeDone,
		approvalRoles,
		observationsDone = null,
		groupAdversarial = true,
	} = inputs
	const raw: { key: string; label: string; done: boolean }[] = []

	raw.push({ key: "elaborate", label: "elaborate", done: elaborateDone })
	raw.push(...rolePips(reviewRoles, "review", elaborateDone, groupAdversarial))
	raw.push({ key: "execute", label: "execute", done: executeDone })
	raw.push(...rolePips(approvalRoles, "approve", executeDone, groupAdversarial))

	if (observationsDone != null) {
		raw.push({
			key: "observations",
			label: "observations",
			done: observationsDone,
		})
	}

	return finalizeSteps(raw)
}

/** Roles that keep their own pip — they're not adversarial peers:
 *  `spec` is the serial conformance gate that fires first, `quality_gates`
 *  is the engine-run gate, `user` is the human gate. */
const DISTINCT_MILESTONE_ROLES = new Set(["spec", "quality_gates", "user"])

/** Turn a walk's role list into milestone steps. Distinct roles
 *  (spec/quality_gates/user) always get their own pip. The adversarial
 *  reviewers (continuity, cross-stage-consistency, studio agents) fan out in
 *  parallel against the same spec/work, so by default they collapse into a
 *  single "adversarial review/approval" pip with a `(signed/total)` count —
 *  a count reflects progress without faking an order between them. When
 *  `group` is false, each reviewer keeps its own `<walk>:<role>` pip instead
 *  (the status line's second line wants one chip per agent). Either way a pip
 *  is done only once its gating phase is done AND its role(s) have signed. */
function rolePips(
	roles: ReadonlyArray<MilestoneRoleFlag>,
	walk: "review" | "approve",
	phaseDone: boolean,
	group = true,
): { key: string; label: string; done: boolean }[] {
	const out: { key: string; label: string; done: boolean }[] = []
	let pending: MilestoneRoleFlag[] = []
	let groupIndex = 0
	const noun = walk === "review" ? "adversarial review" : "adversarial approval"

	const roleLabel = (role: string) =>
		walk === "review"
			? reviewMilestoneLabel(role)
			: approvalMilestoneLabel(role)

	const flush = () => {
		if (pending.length === 0) return
		if (group) {
			const signed = pending.filter((r) => r.stamped).length
			const total = pending.length
			out.push({
				key: `${walk}:adversarial:${groupIndex}`,
				label: total > 1 ? `${noun} (${signed}/${total})` : noun,
				done: phaseDone && pending.every((r) => r.stamped),
			})
			groupIndex += 1
		} else {
			for (const r of pending) {
				out.push({
					key: `${walk}:${r.role}`,
					label: roleLabel(r.role),
					done: phaseDone && r.stamped,
				})
			}
		}
		pending = []
	}

	for (const r of roles) {
		if (DISTINCT_MILESTONE_ROLES.has(r.role)) {
			flush()
			out.push({
				key: `${walk}:${r.role}`,
				label: roleLabel(r.role),
				done: phaseDone && r.stamped,
			})
		} else {
			pending.push(r)
		}
	}
	flush()
	return out
}
