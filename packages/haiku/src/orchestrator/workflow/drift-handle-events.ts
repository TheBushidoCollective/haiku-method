// orchestrator/workflow/drift-handle-events.ts — Engine-internal
// drift handling.
//
// The model (replaces the pre-2026-05-17 "engine emits drift_detected
// → agent files FBs → fix_hats" path):
//
//   1. The engine detects drift (mechanical SHA compare in
//      `runDriftSweep`).
//   2. The engine immediately restamps every affected witness with the
//      CURRENT on-disk SHA. This closes the drift loop — the same
//      signal can never re-fire on a subsequent sweep, because
//      witness == current.
//   3. The engine deduplicates events by (file, kind) — collapsing
//      per-(unit, role) fan-out into a single FB target list — then
//      checks whether an open FB already exists for that (file, kind,
//      new-sha) tuple. If yes, no new FB. If no, the engine files a
//      single FB carrying the diff context and the full list of
//      affected (unit, role) slots.
//   4. The agent NEVER sees a `drift_detected` action. The FB queue
//      IS the agent's todo surface for drift. The FB enters the
//      stage's normal `fix_hats:` chain on the next tick — classifier
//      reads the diff, decides cosmetic vs material, advances or sets
//      `targets.invalidates` for material classification.
//
// Why this shape:
//
//   - Drift CANNOT re-fire on a tick following an emit. Witnesses are
//     current before the FB is even written. The whole class of
//     "closed an FB and drift fired again" bugs (2026-05-01 through
//     2026-05-17, multiple sessions) goes away because the engine no
//     longer depends on the agent's close handler to neutralize the
//     signal — it neutralizes at detect time.
//
//   - The agent's per-event judgment burden collapses. A 110-event
//     drift sweep against 9 units × 5 roles for 3 files becomes 3
//     FBs (one per file), each with all 45 affected (unit, role)
//     slots listed in `targets`. The agent classifies once per file,
//     not once per slot.
//
//   - Same-sweep dedup: emit one FB per unique (file, kind), never
//     one per (file, kind, unit, role).
//
//   - Cross-sweep dedup via `source_ref: drift:<kind>:<file>:<new-sha>`.
//     If the FB is still open when the next sweep runs, the witnesses
//     have already been restamped to <new-sha>, so the sweep emits no
//     events for that file at all. Belt-and-suspenders: the source_ref
//     check catches the edge case where a different unit signed
//     against the same file between sweeps.
//
//   - When the agent classifies the FB material via fix_hats and sets
//     `targets.invalidates: [role]`, the existing close hook
//     (`applyFeedbackInvalidations`) deletes those slots → cursor
//     re-emits `dispatch_review` → role re-signs against the current
//     premise → witnesses refreshed again (no-op since already
//     current). Material classification still works; it just doesn't
//     have to fight the engine to neutralize the signal.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	setFrontmatterField,
	writeFeedbackFile,
} from "../../state-tools.js"
import type { DriftEvent } from "./drift-sweep.js"
import { bodySha256, buildReviewRecord, outputSha256 } from "./sign-slot.js"

/** Mirror of `isInTrackedSurface` from stamp-agent-write.ts.
 *
 *  Drift FBs are only fileable when the path lives somewhere the agent
 *  has a tool to clear the witness — i.e., somewhere `haiku_record_agent_write`
 *  will stamp a baseline. The tracked surface is:
 *    - `stages/<X>/{artifacts,outputs,knowledge,discovery}/...`
 *    - `knowledge/...` at intent root
 *
 *  Paths outside this set (e.g., stage-root spec files like
 *  `stages/<X>/DESIGN-BRIEF.md`, or anywhere under `stages/<X>/units/`)
 *  cannot have a baseline written against them. Filing a drift FB for
 *  such a path produces an unresolvable finding — the classifier hat
 *  has no way to advance closure because the underlying mechanism
 *  (re-baseline via `haiku_record_agent_write`) refuses with
 *  `not_in_tracked_surface`.
 *
 *  Duplicated rather than imported because pulling `stamp-agent-write`'s
 *  helper would drag in the action-log machinery this file deliberately
 *  doesn't touch. Keep the regex in sync with stamp-agent-write.ts. */
function isInDriftTrackedSurface(pathRel: string): boolean {
	if (
		/^stages\/[^/]+\/(?:artifacts|outputs|knowledge|discovery)\//.test(pathRel)
	) {
		return true
	}
	if (/^knowledge\//.test(pathRel)) return true
	return false
}

/** Group key for FB dedup: one FB per (file, kind) per intent. The
 *  per-(unit, role) fan-out is collapsed into the FB's targets list,
 *  not multiplied into N separate FBs. */
type GroupKey = string // `<kind>:<file>`

function groupKey(kind: string, file: string): GroupKey {
	return `${kind}:${file}`
}

/** Affected slot: a (unit, role) pair touched by a single drift
 *  group. Used to (a) restamp the witness on that slot and (b)
 *  populate the FB body's "affected slots" list. */
interface AffectedSlot {
	unit: string // unit slug, or "(intent)" for intent.md approvals
	role: string
}

interface GroupedDriftEvent {
	kind: DriftEvent["kind"]
	file: string
	since: string // earliest `since` across the group's events
	slots: AffectedSlot[]
}

function groupDriftEvents(events: DriftEvent[]): GroupedDriftEvent[] {
	const map = new Map<GroupKey, GroupedDriftEvent>()
	for (const e of events) {
		const key = groupKey(e.kind, e.file)
		const existing = map.get(key)
		if (existing) {
			existing.slots.push({ unit: e.unit, role: e.role })
			// Keep the EARLIEST `since` — the first time this premise
			// shifted. Useful for the FB body's audit trail.
			if (e.since < existing.since) existing.since = e.since
		} else {
			map.set(key, {
				kind: e.kind,
				file: e.file,
				since: e.since,
				slots: [{ unit: e.unit, role: e.role }],
			})
		}
	}
	return Array.from(map.values())
}

/** Walk every open FB (stage-scope + intent-scope) and return the set
 *  of (kind, file) tuples already covered. Cross-sweep dedup: if the
 *  agent hasn't gotten to the FB yet, the engine must not file a
 *  second one for the same shift. */
function collectOpenDriftFbKeys(intentDir: string): Set<GroupKey> {
	const out = new Set<GroupKey>()
	const dirs: string[] = []
	const stagesDir = join(intentDir, "stages")
	if (existsSync(stagesDir)) {
		for (const entry of readdirSync(stagesDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			dirs.push(join(stagesDir, entry.name, "feedback"))
		}
	}
	dirs.push(join(intentDir, "feedback"))
	for (const dir of dirs) {
		if (!existsSync(dir)) continue
		for (const f of readdirSync(dir)) {
			if (!f.endsWith(".md")) continue
			let raw: string
			try {
				raw = readFileSync(join(dir, f), "utf8")
			} catch {
				continue
			}
			let fm: Record<string, unknown>
			try {
				fm = matter(raw).data as Record<string, unknown>
			} catch {
				continue
			}
			if (fm.origin !== "drift") continue
			// Closure detection — same multi-signal logic as the cursor's
			// `isFbClosed` (cursor.ts). The pre-2026-05-18 typeof check
			// missed Date-typed `closed_at` (unquoted ISO timestamps in
			// YAML), which let closed drift FBs re-fire on every sweep.
			const closedAt = fm.closed_at
			if (
				closedAt instanceof Date ||
				(typeof closedAt === "string" && closedAt.length > 0)
			)
				continue
			if (typeof fm.status === "string" && fm.status === "closed") continue
			if (
				typeof fm.closed_by === "string" &&
				(fm.closed_by as string).startsWith("fix-loop:")
			)
				continue
			const ref = fm.source_ref
			if (typeof ref !== "string" || ref.length === 0) continue
			// source_ref shape: `drift:<kind>:<file>` (legacy) or
			// `drift:<kind>:<file>:<sha>` (new). Match on (kind, file)
			// regardless of sha tail.
			const m = ref.match(/^drift:([^:]+):([^]+)$/)
			if (!m) continue
			const kind = m[1] ?? ""
			let rest = m[2] ?? ""
			// Strip a trailing `:<64-hex-sha>` if present.
			const shaMatch = rest.match(/^(.*):([0-9a-f]{64})$/)
			if (shaMatch?.[1]) rest = shaMatch[1]
			out.add(groupKey(kind, rest))
		}
	}
	return out
}

/** Hash the current on-disk content of a witnessed file, picking the
 *  right strategy per kind. Used for both (a) restamping the witness
 *  to current and (b) including in source_ref for cross-sweep dedup. */
function currentShaForWitness(absPath: string, file: string): string {
	const ext = file.slice(file.lastIndexOf(".")).toLowerCase()
	if (ext === ".md" || ext === ".markdown" || ext === ".mdx") {
		return bodySha256(absPath)
	}
	return outputSha256(absPath)
}

/** Resolve the witnessed file's absolute path. Mirrors the three-step
 *  resolution from `runDriftSweep` so the restamp targets the same
 *  file the sweep saw — under any topology (intent dir + repo root +
 *  legacy bad-prefix witness). */
function resolveWitnessedFile(
	file: string,
	intentDir: string,
	repoRoot: string,
): string | null {
	const intentRel = join(intentDir, file)
	if (existsSync(intentRel)) return intentRel
	const repoRel = join(repoRoot, file)
	if (existsSync(repoRel)) return repoRel
	// Strip `.haiku/intents/<slug>/` prefix if present (legacy
	// bad-shape witness recovery — see normalizeInputPath in sign-slot.ts).
	const slug = intentDir.split("/").filter(Boolean).pop() ?? ""
	if (slug) {
		const prefix = `.haiku/intents/${slug}/`
		if (file.startsWith(prefix)) {
			const stripped = file.slice(prefix.length)
			const altIntentRel = join(intentDir, stripped)
			if (existsSync(altIntentRel)) return altIntentRel
		}
	}
	return null
}

/** Restamp the witness on a single (unit, role) slot for a single
 *  file. This is what closes the drift loop — after this call the
 *  next sweep will see witness == current and emit nothing. */
function restampUnitSlot(args: {
	intentDir: string
	stage: string
	unit: string
	role: string
	file: string
	currentSha: string
	kind: DriftEvent["kind"]
}): void {
	const unitPath = join(
		args.intentDir,
		"stages",
		args.stage,
		"units",
		`${args.unit}.md`,
	)
	if (!existsSync(unitPath)) return
	const raw = readFileSync(unitPath, "utf8")
	const parsed = matter(raw)
	const fm = parsed.data as Record<string, unknown>

	if (args.kind === "spec") {
		// Spec drift = the unit body itself shifted. Restamp every
		// signed review's body_sha256 to current — these all witness
		// the same body and must agree.
		const reviews = (fm.reviews as Record<string, unknown> | undefined) ?? {}
		const updated: Record<string, unknown> = { ...reviews }
		let changed = false
		for (const [role, slot] of Object.entries(updated)) {
			if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue
			const slotRec = slot as Record<string, unknown>
			if (typeof slotRec.at !== "string") continue
			if (slotRec.body_sha256 !== args.currentSha) {
				updated[role] = { ...slotRec, body_sha256: args.currentSha }
				changed = true
			}
		}
		if (changed) setFrontmatterField(unitPath, "reviews", updated)
		return
	}

	// Input drift (mutation/addition/deletion). Restamp the named
	// role's input_witnesses block in place. We rebuild the entire
	// block from the unit's current `inputs:` field because adding/
	// removing one file may have changed the dir inventory shape too.
	const reviews = (fm.reviews as Record<string, unknown> | undefined) ?? {}
	const slot = reviews[args.role]
	if (!slot || typeof slot !== "object" || Array.isArray(slot)) return
	const unitInputs = Array.isArray(fm.inputs) ? (fm.inputs as string[]) : []
	const rebuilt = buildReviewRecord(unitPath, {
		intentDir: args.intentDir,
		unitInputs,
	})
	// Preserve the original `at` so the audit trail of "who signed
	// when" stays intact. Restamping the witness is engine bookkeeping;
	// it doesn't replace the human/agent's signature timestamp.
	const slotRec = slot as Record<string, unknown>
	const merged = {
		...slotRec,
		body_sha256: rebuilt.body_sha256,
		input_witnesses: rebuilt.input_witnesses,
	}
	const updated = { ...reviews, [args.role]: merged }
	setFrontmatterField(unitPath, "reviews", updated)
}

/** Restamp intent.md approvals.body_sha256 for the (intent) drift
 *  case. Same forward-only audit-trail rules as unit reviews — keep
 *  the existing `at`, refresh the SHA. */
function restampIntentApprovalSlot(args: {
	intentDir: string
	role: string
	currentSha: string
}): void {
	const intentMdPath = join(args.intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return
	const raw = readFileSync(intentMdPath, "utf8")
	const parsed = matter(raw)
	const fm = parsed.data as Record<string, unknown>
	const approvals =
		(fm.approvals as Record<string, unknown> | undefined) ?? {}
	const slot = approvals[args.role]
	if (!slot || typeof slot !== "object" || Array.isArray(slot)) return
	const slotRec = slot as Record<string, unknown>
	if (slotRec.body_sha256 === args.currentSha) return
	const merged = { ...slotRec, body_sha256: args.currentSha }
	const updated = { ...approvals, [args.role]: merged }
	setFrontmatterField(intentMdPath, "approvals", updated)
}

/** Render the engine-authored FB body. Carries the diff context and
 *  the full list of affected slots so the classifier hat can read
 *  once and decide for the whole fan-out. */
function renderDriftFbBody(args: {
	group: GroupedDriftEvent
	currentSha: string | null
}): string {
	const slots = args.group.slots
		.map((s) => `- \`${s.unit}\` / role \`${s.role}\``)
		.join("\n")
	const fileLine =
		args.group.kind === "input_deletion" || args.currentSha === null
			? `**File**: \`${args.group.file}\` (no longer present on disk)`
			: `**File**: \`${args.group.file}\``
	const shaLine = args.currentSha
		? `**Current SHA**: \`${args.currentSha}\``
		: ""
	const sinceLine = `**Witnessed at**: ${args.group.since}`
	return `_Engine-authored drift FB. The premise that ${args.group.slots.length} signed slot(s) depended on has shifted. Read the file at the path below and classify._

${fileLine}
**Kind**: \`${args.group.kind}\`
${sinceLine}
${shaLine}

**Affected slots** (witnesses already restamped to current SHA — drift cannot re-fire):
${slots}

---

## What to do (classifier hat)

Read the file body and the slots' specs. Decide:

- **Cosmetic** — the premise shifted but the consumers' reasoning is unaffected (e.g., whitespace, comments, doc reword that doesn't change the contract). Advance the hat without setting \`targets.invalidates\`. Closure is a no-op; the witnesses are already current.
- **Material** — the shift invalidates one or more consumers' signoff. Call \`haiku_feedback_set_targets\` with \`invalidates: [<role>, ...]\` listing the roles whose signature can no longer stand. The close hook will delete those slots; the cursor's next tick will re-emit \`dispatch_review\` for them.

This FB will NOT be re-emitted by the next drift sweep — the witness restamp at file time made the SHA mismatch impossible to detect twice.`
}

/** What this fn was asked to do this tick. Returned to the caller
 *  (the workflow tick) for telemetry / logs. The agent never sees
 *  this — the FBs ARE the agent-facing surface. */
export interface DriftHandleSummary {
	groups_total: number
	fbs_filed: number
	fbs_dedup_skipped: number
	fbs_cascade_skipped: number
	/** Groups whose witnessed path lives outside the drift-tracked
	 *  surface. The restamp ran (engine bookkeeping cleared the stale
	 *  inventory entry), but no agent-facing FB was filed because the
	 *  agent has no tool to clear a baseline against an untrackable
	 *  path. Catches the v8→v9 migration footprint where stage-root
	 *  spec files (DESIGN-BRIEF.md, THREAT-MODEL.md, etc.) were
	 *  witnessed at their pre-migration location. */
	fbs_untracked_skipped?: number
	slots_restamped: number
	cascade_alarm_tripped: boolean
}

/** Circuit-breaker threshold for the drift cascade alarm. When the
 *  count of open drift FBs in a single stage exceeds this number, the
 *  engine stops filing new drift FBs and surfaces the cascade via
 *  telemetry + the run_next response. Prevents the runaway-loop class
 *  reported 2026-05-18 (haiku-drift-loop-bug bundle) where the witness
 *  baseline was stale from a v8→v9 migration and produced an effectively
 *  infinite stream of false-positive `input_deletion` FBs faster than
 *  agents could close them.
 *
 *  10 is the default: roughly 2 hat chains' worth of FBs (3 hats × 3
 *  bolts), above which any pattern of "fresh drift FBs every tick"
 *  almost certainly indicates a baseline problem, not real drift. The
 *  env var lets operators tune for unusually-active studios. */
const DRIFT_CASCADE_THRESHOLD = (() => {
	const raw = process.env.HAIKU_DRIFT_CASCADE_THRESHOLD
	if (!raw) return 10
	const n = Number.parseInt(raw, 10)
	return Number.isFinite(n) && n > 0 ? n : 10
})()

/** Engine-internal drift handler. Called from the workflow tick after
 *  `runDriftSweep` returns events. Performs (1) per-slot witness
 *  restamp, (2) per-group FB emit with cross-sweep dedup. Never
 *  returns an agent-facing action. */
export function engineHandleDriftEvents(args: {
	events: DriftEvent[]
	intentDir: string
	stage: string
	slug: string
	repoRoot?: string
}): DriftHandleSummary {
	const repoRoot = args.repoRoot ?? join(args.intentDir, "..", "..", "..")
	const summary: DriftHandleSummary = {
		groups_total: 0,
		fbs_filed: 0,
		fbs_dedup_skipped: 0,
		fbs_cascade_skipped: 0,
		slots_restamped: 0,
		cascade_alarm_tripped: false,
	}
	if (args.events.length === 0) return summary

	const groups = groupDriftEvents(args.events)
	summary.groups_total = groups.length
	const openFbKeys = collectOpenDriftFbKeys(args.intentDir)
	// Circuit breaker — when the open drift FB count is already over
	// the threshold, refuse to file more. Slots still get restamped
	// (engine bookkeeping); only the new-FB write is suppressed so the
	// agent's fix loop can drain what's already queued without piling on.
	const cascadeAlarmTripped = openFbKeys.size >= DRIFT_CASCADE_THRESHOLD
	if (cascadeAlarmTripped) {
		summary.cascade_alarm_tripped = true
		// Surface to operators via stderr — gives visibility without
		// coupling the engine handler to a telemetry channel. Mirrors
		// the format `[haiku]` other engine surfaces use (config.ts, etc.).
		console.error(
			`[haiku] drift cascade alarm tripped for ${args.slug}/${args.stage}: ` +
				`${openFbKeys.size} open drift FBs ≥ threshold ${DRIFT_CASCADE_THRESHOLD}. ` +
				`Suppressing new drift FBs this tick. Consider running /haiku:haiku-repair ` +
				`if this pattern repeats — the witness baseline may be stale.`,
		)
	}

	for (const group of groups) {
		// (1) Restamp every affected slot first. Engine bookkeeping;
		// happens regardless of FB dedup outcome — keeps witness state
		// internally consistent even when an FB is already open for
		// this group.
		const absFile = resolveWitnessedFile(
			group.file,
			args.intentDir,
			repoRoot,
		)
		const currentSha = absFile ? currentShaForWitness(absFile, group.file) : ""
		for (const slot of group.slots) {
			if (slot.unit === "(intent)") {
				if (currentSha) {
					restampIntentApprovalSlot({
						intentDir: args.intentDir,
						role: slot.role,
						currentSha,
					})
					summary.slots_restamped++
				}
				continue
			}
			restampUnitSlot({
				intentDir: args.intentDir,
				stage: args.stage,
				unit: slot.unit,
				role: slot.role,
				file: group.file,
				currentSha,
				kind: group.kind,
			})
			summary.slots_restamped++
		}

		// (2) Cascade alarm — when the open drift FB count is over
		// the threshold, refuse to file more even if this group is
		// novel. The agent's fix loop needs room to drain existing
		// FBs; piling on adds tokens without progress. The bookkeeping
		// restamp above already neutralized the (file, kind) shift —
		// the next sweep won't re-emit it.
		if (cascadeAlarmTripped) {
			summary.fbs_cascade_skipped++
			continue
		}

		// (2b) Untrackable-surface suppression for INPUT-class drift
		// (2026-05-18 reported as haiku-fix-loop-bug on
		// admin-portal-reimagine/design). When an input-class drift
		// event (`input_mutation` / `input_deletion`) names a path
		// outside the drift-tracked surface
		// (`stages/<X>/{artifacts,outputs,knowledge,discovery}/...` and
		// intent-root `knowledge/...`), `haiku_record_agent_write`
		// refuses to baseline against it (`not_in_tracked_surface`), so
		// the agent has no tool to clear the drift FB. Filing the FB
		// anyway produces findings the fix loop CAN'T close — the
		// classifier rejects (no actionable target), the cursor
		// re-dispatches, the classifier rejects again. The
		// stuck-reject escalation now catches the loop, but the real
		// fix is not filing the FB at all. The restamp above already
		// cleared the stale witness inventory entry; the path drops
		// out naturally on the next sweep.
		//
		// Specifically catches the v8→v9 migration footprint: stage-root
		// spec files (`DESIGN-BRIEF.md`, `THREAT-MODEL.md`, etc.) that
		// were declared as inputs pre-migration and now resolve to a
		// new location. The migration left stale witness inventories
		// pointing at the old stage-root path; the engine self-heals
		// silently rather than dispatching a fix loop that can't fix
		// anything.
		//
		// `spec` drift (unit body shifted out-of-band) is NOT filtered
		// — the unit body lives at `stages/<X>/units/<unit>.md` (also
		// outside the tracked surface as defined for record_agent_write),
		// but spec drift IS the FB. The fix path for spec drift is
		// `targets.invalidates: [<role>]` clearing the relevant review,
		// which re-dispatches the role to re-sign against the new body
		// — no baseline-write needed. Filtering spec drift here would
		// silently swallow out-of-band edits to in-flight units.
		const isInputClassDrift =
			group.kind === "input_mutation" || group.kind === "input_deletion"
		if (isInputClassDrift && !isInDriftTrackedSurface(group.file)) {
			summary.fbs_untracked_skipped =
				(summary.fbs_untracked_skipped ?? 0) + 1
			continue
		}

		// (3) Dedup against open drift FBs by (kind, file). If one's
		// already open and waiting on the agent, don't pile on.
		const dedupKey = groupKey(group.kind, group.file)
		if (openFbKeys.has(dedupKey)) {
			summary.fbs_dedup_skipped++
			continue
		}

		// (4) File one FB for the whole group. Stage-scope for unit
		// reviews; intent-scope when the only affected slot is
		// `(intent)`.
		const isIntentScope = group.slots.every((s) => s.unit === "(intent)")
		const fbStage = isIntentScope ? "" : args.stage
		const title = (() => {
			const basename = group.file.split("/").pop() ?? group.file
			return `${group.kind} drift on ${basename}`
		})()
		const sourceRef = `drift:${group.kind}:${group.file}${currentSha ? `:${currentSha}` : ""}`
		try {
			writeFeedbackFile(args.slug, fbStage, {
				title,
				body: renderDriftFbBody({
					group,
					currentSha: currentSha || null,
				}),
				origin: "drift",
				author: "engine",
				authorType: "system",
				source_ref: sourceRef,
				triaged_at: new Date().toISOString(),
				// Engine-emitted drift FBs default to empty invalidates.
				// The agent's classifier hat sets it explicitly when the
				// shift is material — see writeFeedbackFile's
				// targets.invalidates handling.
				targetInvalidates: [],
				// targetUnit is left null — multi-unit fan-out is carried
				// in the FB body's "affected slots" list. The close hook's
				// applyFeedbackInvalidations runs per-unit; for engine
				// drift FBs targets.invalidates is [] by default so this
				// is a no-op unless the agent escalates.
				targetUnit: null,
			})
			summary.fbs_filed++
			openFbKeys.add(dedupKey)
		} catch {
			// Defensive: a write failure shouldn't block the rest of
			// the tick. Telemetry would normally fire here; left
			// silent for now to avoid coupling the engine-handler to
			// the telemetry layer.
		}
	}

	return summary
}

// Re-export helpers used by tests; not part of the public engine API.
export const _internal = {
	groupDriftEvents,
	collectOpenDriftFbKeys,
	renderDriftFbBody,
	resolveWitnessedFile,
}
