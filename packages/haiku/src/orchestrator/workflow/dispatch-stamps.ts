// orchestrator/workflow/dispatch-stamps.ts — Side-effect handlers for
// the cursor's review/approval dispatch actions and feedback closure
// invalidations.
//
// Four gaps the cursor's prompt promised but no engine code fulfilled
// before this module landed:
//
//   1. `dispatch_review { stage, role, units }` — the prompt told the
//      review-agent subagent to "stamp reviews.<role> by calling
//      haiku_run_next; the engine sees you've finished and stamps the
//      sigs." No engine code stamped.
//   2. `dispatch_approval { stage, role, units }` — same gap.
//   3. `intent_review { role }` (non-user roles) — the prompt promised
//      "the engine signs `approvals.<role>` automatically when the
//      subagent terminates clean." No engine code stamped. (User-role
//      intent_review goes through haiku_await_gate which IS wired.)
//   4. `close_feedback` with `targets.invalidates: [<role>]` — the
//      `start_feedback_hat` prompt promises "the engine ... applies
//      `targets.invalidates` to the targeted unit's approvals — the
//      cursor on the next tick will route through the invalidated
//      roles to re-run them." Closure stamped `closed_at` but never
//      cleared the named role keys.
//
// Without these the workflow loops forever: cursor returns
// dispatch_review → agent runs the review subagent → if no FBs were
// filed, cursor still sees `reviews.<role>` missing → re-emits
// dispatch_review → infinite loop. Same for dispatch_approval. And
// fix-loops never invalidate the role they were filed against, so the
// closed FB doesn't reroute the cursor through the affected slot.
//
// Tracking shape on intent.md:
//   _pending_review_dispatches:
//     <stage>:
//       <role>:
//         dispatched_at: <iso>
//         units: [<unit-name>, ...]
//   _pending_approval_dispatches: <same shape>
//
// Lifecycle:
//   Tick N: cursor returns dispatch_review { stage, role, units }
//     → engine stashes _pending_review_dispatches[stage][role]
//     → returns action to agent
//   Agent dispatches review subagent. Subagent files FBs (if any).
//   Tick N+1: cursor walks Track B first; if any FBs were filed by
//     the review pass they pre-empt and Track A doesn't fire.
//   Tick N+M (after Track B drains): engine drains pending dispatches
//     → stamps reviews.<role> on each unit in the pending list
//     → clears _pending_review_dispatches[stage][role]
//     → re-walks cursor; cursor advances past the now-stamped reviews
//
// FBs filed during the review pass invalidate the role on close
// (applyFeedbackInvalidations below). After invalidation the cursor
// sees reviews.<role> missing again on the targeted unit and re-emits
// dispatch_review just for that unit, restarting the cycle.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { isFixBlockingSeverity } from "../../state/schemas/index.js"
import {
	findHaikuRoot,
	parseFrontmatter,
	setFrontmatterField,
} from "../../state-tools.js"
import { buildApprovalRecord, buildReviewRecord } from "./sign-slot.js"

const PENDING_REVIEW_FIELD = "_pending_review_dispatches"
const PENDING_APPROVAL_FIELD = "_pending_approval_dispatches"
const PENDING_INTENT_REVIEW_FIELD = "_pending_intent_review_dispatches"

type PendingMap = Record<
	string, // stage
	Record<
		string, // role
		{ dispatched_at: string; units: string[] }
	>
>

type PendingIntentMap = Record<
	string, // role
	{ dispatched_at: string }
>

function readIntentFm(slug: string): {
	path: string
	fm: Record<string, unknown>
} | null {
	const intentPath = join(findHaikuRoot(), "intents", slug, "intent.md")
	if (!existsSync(intentPath)) return null
	const raw = readFileSync(intentPath, "utf8")
	const parsed = parseFrontmatter(raw)
	return {
		path: intentPath,
		fm: (parsed.data as Record<string, unknown>) || {},
	}
}

function readPendingMap(
	fm: Record<string, unknown>,
	field: string,
): PendingMap {
	const value = fm[field]
	if (!value || typeof value !== "object" || Array.isArray(value)) return {}
	return value as PendingMap
}

function readPendingIntentMap(
	fm: Record<string, unknown>,
	field: string,
): PendingIntentMap {
	const value = fm[field]
	if (!value || typeof value !== "object" || Array.isArray(value)) return {}
	return value as PendingIntentMap
}

/**
 * Stash a dispatch_review or dispatch_approval action's (stage, role,
 * units) tuple on intent.md so the next tick can drain it. Idempotent
 * — re-stashing the same (stage, role) overwrites with the latest
 * units list, which is the right behavior when the cursor narrows
 * after some units' reviews got invalidated and re-stamped.
 */
export function stashPendingDispatch(
	slug: string,
	kind: "review" | "approval",
	stage: string,
	role: string,
	units: string[],
): void {
	const intent = readIntentFm(slug)
	if (!intent) return
	const field =
		kind === "review" ? PENDING_REVIEW_FIELD : PENDING_APPROVAL_FIELD
	const pending = { ...readPendingMap(intent.fm, field) }
	const perStage = { ...(pending[stage] ?? {}) }
	perStage[role] = {
		dispatched_at: new Date().toISOString(),
		units: [...units],
	}
	pending[stage] = perStage
	setFrontmatterField(intent.path, field, pending)
}

/**
 * Stash an intent_review action's role on intent.md. The user role is
 * NEVER stashed — it routes through haiku_await_gate which stamps
 * `intent.approvals.user` directly. Agent roles (spec, continuity,
 * studio review-agents) need this engine-side stamp because nothing
 * else writes their slot.
 */
export function stashPendingIntentReview(slug: string, role: string): void {
	if (role === "user") return
	const intent = readIntentFm(slug)
	if (!intent) return
	const pending = {
		...readPendingIntentMap(intent.fm, PENDING_INTENT_REVIEW_FIELD),
	}
	pending[role] = { dispatched_at: new Date().toISOString() }
	setFrontmatterField(intent.path, PENDING_INTENT_REVIEW_FIELD, pending)
}

/**
 * Drain stashed dispatches: stamp reviews.<role> / approvals.<role>
 * on each unit listed in the pending entries, then clear the entries.
 *
 * Returns true iff anything was stamped. The boolean is informational
 * — `haiku_run_next` calls `dispatchOrchestratorAction(slug)` after
 * this regardless, so the cursor always re-walks the fresh state.
 *
 * Skips units that have an open feedback file targeting them with
 * `targets.invalidates: [<role>]` filed AFTER the dispatch — those
 * are the units the review pass actually flagged, and they need to
 * stay un-stamped so the cursor reroutes through them once the FB
 * closes (which clears nothing because the stamp was never set).
 *
 * Pending entries are cleared in full at the end of each tick, even
 * for units that were skipped — the cursor on the next tick re-emits
 * `dispatch_review` / `dispatch_approval` for whichever units still
 * lack the witness, which calls `stashPendingDispatch` again and
 * restarts the loop. A future reader might see the unconditional
 * clear and read it as a bug; it isn't, the re-emit covers it.
 *
 * The "open FB filed after dispatch" check is loose intentionally:
 * the FB filer (the review-subagent) writes the FB before terminating;
 * the engine reads the FB at drain time and trusts the file's
 * `targets.invalidates`. If the FB closed before drain time (a
 * fast-running fix loop), the close handler already cleared any
 * pre-existing stamp via applyFeedbackInvalidations and the unit
 * legitimately deserves the fresh stamp.
 *
 * FBs with missing or empty `created_at` are treated conservatively
 * as "filed since dispatch" — they block stamping. In practice every
 * FB the engine writes carries a `created_at`; this branch only
 * matters for hand-edited or migrator-skipped FBs, where blocking
 * the stamp is the safe default (the unit stays un-witnessed until
 * the FB is properly resolved).
 */
/**
 * Stamp `reviews.<role>` / `approvals.<role>` on each unit in a single
 * pending (stage, role) dispatch entry. Skips units the review pass
 * flagged with a still-open invalidating FB (filed after dispatch) — they
 * stay un-stamped so the cursor reroutes through the slot once the FB
 * closes. Returns the per-unit stamped / skipped split.
 *
 * Shared by `drainPendingDispatches` (the bulk fallback path) and
 * `stampSingleDispatch` (the per-role synchronous closure — see
 * `haiku_review_stamp`). The two must stamp identically; pulling the
 * per-unit body into one function is the only way to guarantee that.
 */
function stampUnitsForDispatch(opts: {
	intentDir: string
	stage: string
	role: string
	units: string[]
	dispatchedAt: string | undefined
	kind: "review" | "approval"
}): { stamped: string[]; skipped: string[] } {
	const { intentDir, stage, role, units, dispatchedAt, kind } = opts
	const stamped: string[] = []
	const skipped: string[] = []
	for (const unitName of units) {
		const unitPath = join(intentDir, "stages", stage, "units", `${unitName}.md`)
		if (!existsSync(unitPath)) continue

		if (
			dispatchedAt &&
			hasOpenInvalidatingFeedback({
				intentDir,
				stage,
				targetUnit: unitName,
				role,
				sinceIso: dispatchedAt,
			})
		) {
			// Review pass found an issue against this unit. Skip stamping;
			// the FB's close handler will re-route the cursor through the
			// slot once it's resolved.
			skipped.push(unitName)
			continue
		}

		const raw = readFileSync(unitPath, "utf8")
		const parsed = parseFrontmatter(raw)
		const fm = parsed.data as Record<string, unknown>

		if (kind === "review") {
			const reviews =
				fm.reviews && typeof fm.reviews === "object"
					? { ...(fm.reviews as Record<string, unknown>) }
					: {}
			// Pass intentDir + unitInputs so the signed record includes the
			// input_witnesses block — the premise snapshot drift uses to
			// detect input changes.
			const unitInputs = Array.isArray(fm.inputs) ? (fm.inputs as string[]) : []
			reviews[role] = buildReviewRecord(unitPath, { intentDir, unitInputs })
			setFrontmatterField(unitPath, "reviews", reviews)
		} else {
			const outputs = Array.isArray(fm.outputs) ? (fm.outputs as string[]) : []
			const approvals =
				fm.approvals && typeof fm.approvals === "object"
					? { ...(fm.approvals as Record<string, unknown>) }
					: {}
			approvals[role] = buildApprovalRecord(intentDir, outputs)
			setFrontmatterField(unitPath, "approvals", approvals)
		}
		stamped.push(unitName)
	}
	return { stamped, skipped }
}

/**
 * Stamp ONE (stage, role) dispatch entry synchronously and remove just
 * that entry from the pending map (NOT the whole field). This is the
 * decoupled review/approval closure: a review-agent subagent calls
 * `haiku_review_stamp` when it finishes, the engine stamps its role's
 * units here, and the subagent terminates — WITHOUT a `haiku_run_next`
 * tick.
 *
 * Why it exists (the loop-halt false positive, automated-starlink-rental-
 * platform 2026-05-22): review agents used to self-stamp by calling
 * `haiku_run_next`, which ALSO computes and returns the global next
 * action. In a parallel review fan-out, every sibling's self-stamp tick
 * returned the SAME `start_feedback_hat` fix dispatch (the findings the
 * wave just filed) — returned but never consumed, because spawning the
 * fix hats is the PARENT's job after the whole wave closes. Four such
 * pulls tripped the inter-tick loop guard on a perfectly healthy
 * review→fix transition. Stamping a single role here, with no cursor
 * walk, removes both the false signature and the coordination smell:
 * only the parent's wave-level tick pulls the fix dispatch, and it pulls
 * it once.
 *
 * Returns `found: false` when there's no pending entry for (stage, role)
 * — the dispatch was never stashed, or a sibling/bulk drain already
 * stamped it. Idempotent: a second call is a clean no-op.
 */
export function stampSingleDispatch(
	slug: string,
	kind: "review" | "approval",
	stage: string,
	role: string,
): { found: boolean; stamped: string[]; skipped: string[] } {
	const intent = readIntentFm(slug)
	if (!intent) return { found: false, stamped: [], skipped: [] }
	const field =
		kind === "review" ? PENDING_REVIEW_FIELD : PENDING_APPROVAL_FIELD
	const pending = readPendingMap(intent.fm, field)
	const entry = pending[stage]?.[role]
	if (!entry || !Array.isArray(entry.units)) {
		return { found: false, stamped: [], skipped: [] }
	}
	const intentDir = join(findHaikuRoot(), "intents", slug)
	const { stamped, skipped } = stampUnitsForDispatch({
		intentDir,
		stage,
		role,
		units: entry.units,
		dispatchedAt: entry.dispatched_at,
		kind,
	})
	// Remove just this (stage, role) entry; leave sibling roles' pending
	// entries intact so their own closures still stamp them.
	const perStage = { ...(pending[stage] ?? {}) }
	delete perStage[role]
	if (Object.keys(perStage).length === 0) {
		delete pending[stage]
	} else {
		pending[stage] = perStage
	}
	setFrontmatterField(intent.path, field, pending)
	return { found: true, stamped, skipped }
}

export function drainPendingDispatches(slug: string): boolean {
	const intent = readIntentFm(slug)
	if (!intent) return false
	const root = findHaikuRoot()
	const intentDir = join(root, "intents", slug)
	let stamped = false

	for (const kind of ["review", "approval"] as const) {
		const field =
			kind === "review" ? PENDING_REVIEW_FIELD : PENDING_APPROVAL_FIELD
		const pending = readPendingMap(intent.fm, field)
		if (Object.keys(pending).length === 0) continue

		for (const stage of Object.keys(pending)) {
			const perStage = pending[stage] ?? {}
			for (const role of Object.keys(perStage)) {
				const entry = perStage[role]
				if (!entry || !Array.isArray(entry.units)) continue
				const result = stampUnitsForDispatch({
					intentDir,
					stage,
					role,
					units: entry.units,
					dispatchedAt: entry.dispatched_at,
					kind,
				})
				if (result.stamped.length > 0) stamped = true
			}
		}
		// Clear the field — the next tick will re-stash if the cursor
		// emits another dispatch.
		setFrontmatterField(intent.path, field, {})
	}

	// Drain pending intent_review stamps. Same shape, but the target
	// is intent.md.approvals (not per-unit) and there's no body_sha256
	// witness — intent.md is a prose audit, not a frontmatter-driven
	// signed surface.
	const pendingIntent = readPendingIntentMap(
		intent.fm,
		PENDING_INTENT_REVIEW_FIELD,
	)
	if (Object.keys(pendingIntent).length > 0) {
		const intentApprovals =
			intent.fm.approvals && typeof intent.fm.approvals === "object"
				? { ...(intent.fm.approvals as Record<string, unknown>) }
				: {}
		let intentChanged = false
		for (const role of Object.keys(pendingIntent)) {
			const entry = pendingIntent[role]
			if (!entry?.dispatched_at) continue
			if (
				hasOpenInvalidatingIntentFeedback({
					intentDir,
					role,
					sinceIso: entry.dispatched_at,
				})
			) {
				continue
			}
			intentApprovals[role] = { at: new Date().toISOString() }
			intentChanged = true
			stamped = true
		}
		if (intentChanged) {
			setFrontmatterField(intent.path, "approvals", intentApprovals)
		}
		// Clear the field — same re-stash semantics as the per-stage
		// dispatches above. Roles skipped due to open invalidating FBs
		// get re-stashed by the next intent_review emit.
		setFrontmatterField(intent.path, PENDING_INTENT_REVIEW_FIELD, {})
	}
	return stamped
}

function hasOpenInvalidatingFeedback(args: {
	intentDir: string
	stage: string
	targetUnit: string
	role: string
	sinceIso: string
}): boolean {
	const fbDir = join(args.intentDir, "stages", args.stage, "feedback")
	if (!existsSync(fbDir)) return false
	for (const entry of readdirSync(fbDir, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue
		const path = join(fbDir, entry.name)
		const raw = readFileSync(path, "utf8")
		const parsed = parseFrontmatter(raw)
		const fm = parsed.data as Record<string, unknown>
		// Terminal FBs release any stamp-hold. Both closure AND rejection
		// are terminal: a REJECTED finding has been adjudicated invalid, so
		// it must stop withholding the unit's review stamp — otherwise a
		// rejection (no content edit) leaves the unit un-stamped, the cursor
		// re-reviews byte-identical specs, and the nondeterministic lens
		// emits fresh findings forever (BUG-1 round-3→4 smoking gun: only
		// rejections occurred, yet 8 new findings appeared).
		if (fm.closed_at || fm.rejected_at) continue
		const targets = (fm.targets as Record<string, unknown>) ?? {}
		if (targets.unit !== args.targetUnit) continue
		const invalidates = Array.isArray(targets.invalidates)
			? (targets.invalidates as string[])
			: []
		if (!invalidates.includes(args.role)) continue
		// Severity gate (BUG-1 convergence): only a BLOCKING-severity finding
		// withholds the review/approval stamp. A sub-threshold nit (low/medium
		// under the default `high` threshold) is advisory — the lens still
		// signs off the unit and the nit stays open without blocking the gate.
		// Without this, every finding (even a nondeterministic low) kept the
		// unit un-stamped and forced an endless re-review of byte-identical
		// specs. Unclassified findings are treated as blocking (the classifier
		// must run to rank them).
		if (!isFixBlockingSeverity(fm.severity)) continue
		// Filed since the dispatch landed.
		const createdAt = (fm.created_at as string) ?? ""
		if (createdAt && createdAt < args.sinceIso) continue
		return true
	}
	return false
}

function hasOpenInvalidatingIntentFeedback(args: {
	intentDir: string
	role: string
	sinceIso: string
}): boolean {
	const fbDir = join(args.intentDir, "feedback")
	if (!existsSync(fbDir)) return false
	for (const entry of readdirSync(fbDir, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue
		const path = join(fbDir, entry.name)
		const raw = readFileSync(path, "utf8")
		const parsed = parseFrontmatter(raw)
		const fm = parsed.data as Record<string, unknown>
		// Terminal FBs release any stamp-hold. Both closure AND rejection
		// are terminal: a REJECTED finding has been adjudicated invalid, so
		// it must stop withholding the unit's review stamp — otherwise a
		// rejection (no content edit) leaves the unit un-stamped, the cursor
		// re-reviews byte-identical specs, and the nondeterministic lens
		// emits fresh findings forever (BUG-1 round-3→4 smoking gun: only
		// rejections occurred, yet 8 new findings appeared).
		if (fm.closed_at || fm.rejected_at) continue
		const targets = (fm.targets as Record<string, unknown>) ?? {}
		const invalidates = Array.isArray(targets.invalidates)
			? (targets.invalidates as string[])
			: []
		if (!invalidates.includes(args.role)) continue
		// Severity gate (BUG-1) — see the stage-scope twin above.
		if (!isFixBlockingSeverity(fm.severity)) continue
		const createdAt = (fm.created_at as string) ?? ""
		if (createdAt && createdAt < args.sinceIso) continue
		return true
	}
	return false
}

/**
 * Apply a closing FB's `targets.invalidates` list to the target unit
 * by deleting the named keys from `reviews` / `approvals`. The cursor
 * on the next tick will see the missing keys and re-emit the relevant
 * dispatch action.
 *
 * `invalidates` may name a review role, an approval role, or `user`
 * (which can mean either depending on which side filed it). We try
 * both maps — deleting a non-existent key is a no-op.
 */
export function applyFeedbackInvalidations(args: {
	slug: string
	stage: string
	targetUnit: string
	invalidates: string[]
}): void {
	if (!args.invalidates || args.invalidates.length === 0) return
	const root = findHaikuRoot()
	const unitPath = join(
		root,
		"intents",
		args.slug,
		"stages",
		args.stage,
		"units",
		`${args.targetUnit}.md`,
	)
	if (!existsSync(unitPath)) return
	const raw = readFileSync(unitPath, "utf8")
	const parsed = parseFrontmatter(raw)
	const fm = parsed.data as Record<string, unknown>

	const reviews =
		fm.reviews && typeof fm.reviews === "object"
			? { ...(fm.reviews as Record<string, unknown>) }
			: {}
	const approvals =
		fm.approvals && typeof fm.approvals === "object"
			? { ...(fm.approvals as Record<string, unknown>) }
			: {}
	let changedReviews = false
	let changedApprovals = false
	for (const role of args.invalidates) {
		if (role in reviews) {
			delete reviews[role]
			changedReviews = true
		}
		if (role in approvals) {
			delete approvals[role]
			changedApprovals = true
		}
	}
	if (changedReviews) setFrontmatterField(unitPath, "reviews", reviews)
	if (changedApprovals) setFrontmatterField(unitPath, "approvals", approvals)

	// Task #27 (2026-05-13): also evict this unit from any pending
	// dispatch entry for the same (stage, role). Without this, the
	// drain runs against the stale dispatch entry — when the
	// invalidating FB closes, `hasOpenInvalidatingFeedback` returns
	// false (no open FB after close), drain stamps reviews.<role>
	// using the OLD dispatched_at, and the reviewer subagent never
	// re-ran. The unit ends up witnessed without an actual review.
	//
	// Cleaner than tracking `reviews_invalidated_at` on the unit: the
	// pending entry IS the dispatch contract; if the contract is no
	// longer valid (invalidation happened), drop the entry. The cursor
	// will re-emit dispatch_review next walk, re-stash with a fresh
	// dispatched_at, and the drain will be against the new dispatch
	// after the reviewer subagent actually runs.
	if (changedReviews) {
		evictPendingDispatchEntry({
			slug: args.slug,
			stage: args.stage,
			role: args.invalidates,
			unit: args.targetUnit,
			field: PENDING_REVIEW_FIELD,
		})
	}
	if (changedApprovals) {
		evictPendingDispatchEntry({
			slug: args.slug,
			stage: args.stage,
			role: args.invalidates,
			unit: args.targetUnit,
			field: PENDING_APPROVAL_FIELD,
		})
	}
}

/** Remove a unit from any per-(stage, role) pending dispatch entry on
 *  the intent. Called from `applyFeedbackInvalidations` so the next
 *  `drainPendingDispatches` doesn't stamp a unit with a stale
 *  dispatched_at — see task #27 comment above. Empty role entries are
 *  cleaned up so the drain can short-circuit on empty pending maps. */
function evictPendingDispatchEntry(args: {
	slug: string
	stage: string
	role: string[]
	unit: string
	field: string
}): void {
	const intent = readIntentFm(args.slug)
	if (!intent) return
	const pending = readPendingMap(intent.fm, args.field)
	const perStage = pending[args.stage]
	if (!perStage) return
	let changed = false
	for (const r of args.role) {
		const entry = perStage[r]
		if (!entry || !Array.isArray(entry.units)) continue
		const filtered = entry.units.filter((u) => u !== args.unit)
		if (filtered.length === entry.units.length) continue
		if (filtered.length === 0) {
			delete perStage[r]
		} else {
			perStage[r] = { ...entry, units: filtered }
		}
		changed = true
	}
	if (!changed) return
	if (Object.keys(perStage).length === 0) {
		delete pending[args.stage]
	}
	setFrontmatterField(intent.path, args.field, pending)
}
