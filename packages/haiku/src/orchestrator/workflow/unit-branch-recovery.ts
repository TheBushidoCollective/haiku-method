// orchestrator/workflow/unit-branch-recovery.ts — pickup recovery for
// worktree-isolated units whose branch was lost.
//
// A unit's hat loop runs on its own branch `haiku/<slug>/<unit>` in a
// worktree; the work isn't on the stage branch until the terminal merge.
// `createUnitWorktree` recreates the worktree from an existing local or
// pushed-remote branch (resume). But if the worktree is gone AND the branch
// survives neither locally nor on origin — a fresh clone of a no-remote
// project, or a remote ref that was deleted — the loop's code is truly lost.
// In that case the unit's `iterations[]` (on the stage branch, showing a later
// hat) point at code that no longer exists, so we RESET the unit (clear
// iterations + started_at) and let the cursor re-dispatch the first hat into a
// fresh worktree.
//
// This is a best-effort pre-tick gate (NOT the cursor — it reads git, which
// Rule 1 forbids the cursor from doing). Push-on-advance makes the lost case
// rare; the common pickup is handled by createUnitWorktree's remote recreate.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	hasGitRemote,
	unitBranchExists,
	unitWorktreePath,
} from "../../git-worktree.js"
import {
	intentDir,
	isGitRepo,
	parseFrontmatter,
	setFrontmatterField,
	unitOutputExists,
} from "../../state-tools.js"
import { resolveStageHats } from "../studio.js"
import { findCurrentStage } from "./cursor.js"

export function resetLostUnits(
	slug: string,
	studio: string,
): { reset: string[] } {
	const reset: string[] = []
	try {
		// Recovery is only meaningful on a CROSS-MACHINE pickup — the sole way
		// a unit's worktree branch goes missing in a way reset must repair —
		// and that requires a remote (it's how the work crossed machines). On a
		// no-remote repo a started unit's branch is always local (recoverable in
		// place) or the work never left this machine, so resetting would be
		// wrong. `hasGitRemote()` is also false in filesystem mode (no git), so
		// this one guard keeps the gate inert both for fs-mode and for the
		// simulation-shaped state the cursor/e2e fixtures produce (mid-loop
		// units with no worktree, no branch, no remote).
		if (!hasGitRemote()) return { reset }
		const iDir = intentDir(slug)
		const stage = findCurrentStage(slug, studio, iDir)
		if (!stage) return { reset }
		const unitsDir = join(iDir, "stages", stage, "units")
		if (!existsSync(unitsDir)) return { reset }
		const hats = resolveStageHats(studio, stage)
		const lastHat = hats[hats.length - 1] ?? ""
		for (const f of readdirSync(unitsDir).filter((n) => n.endsWith(".md"))) {
			const path = join(unitsDir, f)
			let fm: Record<string, unknown>
			try {
				fm = parseFrontmatter(readFileSync(path, "utf8")).data
			} catch {
				continue
			}
			const started =
				typeof fm.started_at === "string" &&
				(fm.started_at as string).length > 0
			const iters = Array.isArray(fm.iterations)
				? (fm.iterations as Array<Record<string, unknown>>)
				: []
			if (!started || iters.length === 0) continue // not in-flight
			const last = iters[iters.length - 1]
			// Terminal-complete (advance on the last hat) → its code already
			// merged onto the stage branch; nothing to recover.
			if (last && last.result === "advance" && last.hat === lastHat) continue
			const unit = f.replace(/\.md$/, "")
			// Worktree present → genuinely in-flight; leave it.
			if (existsSync(unitWorktreePath(slug, unit))) continue
			// Branch survives (local or pushed) → createUnitWorktree will
			// recreate + resume; don't reset.
			const { local, remote } = unitBranchExists(slug, unit)
			if (local || remote) continue
			// Migration safety: a unit run under the PRE-isolation in-place
			// model has no worktree and no branch, but its work lives on the
			// stage branch — so its declared outputs exist on the main tree.
			// A genuinely-lost worktree unit's outputs lived only in the lost
			// worktree (mid-loop work never reaches the stage branch until the
			// terminal merge), so none exist on the main tree. Outputs-on-disk
			// is therefore the clean discriminator: present → don't reset (the
			// work is recoverable in place), absent → lost, reset.
			const outputs = Array.isArray(fm.outputs)
				? (fm.outputs as unknown[]).filter(
						(o): o is string => typeof o === "string" && o.length > 0,
					)
				: []
			// Outputs-on-disk is the recoverability discriminator. A unit
			// that COMPLETED in-place is already exempted above (terminal
			// advance on the last hat). What's left here is a mid-loop unit
			// with no worktree and no branch: if a declared output survives
			// on the tree its work is recoverable in place (don't reset); a
			// unit declaring NO outputs has no recoverable signal and is
			// genuinely lost mid-loop — reset so the cursor re-dispatches
			// the first hat fresh (pinned by unit-branch-recovery.test.mjs).
			if (outputs.some((o) => unitOutputExists(slug, unit, o))) continue
			// Lost: reset so the cursor re-dispatches the first hat fresh.
			setFrontmatterField(path, "iterations", [])
			setFrontmatterField(path, "started_at", null)
			reset.push(unit)
		}
	} catch {
		/* best-effort — recovery never blocks the tick */
	}
	return { reset }
}

/** Generous default lease TTL: longer than any plausible single-hat runtime.
 *  A subagent holding a lease past this is presumed dead. Env-overridable. */
const STALE_LEASE_TTL_MS =
	Number.parseInt(process.env.HAIKU_UNIT_LEASE_TTL_MS ?? "", 10) || 45 * 60_000

/** Clear stale dispatch leases so the cursor's `needNextHat` re-dispatches a
 *  unit whose leased subagent died. The lease (`dispatched_at` on the open
 *  iter) makes `needNextHat` skip an in-flight unit so a mid-wave run_next
 *  can't double-dispatch it — but a subagent that dies mid-hat (worktree
 *  intact, so `resetLostUnits` doesn't catch it) would otherwise be skipped
 *  forever, wedging the wave. Two clear signals, both pre-tick (Rule 1: the
 *  cursor must not write):
 *
 *   1. Worktree GONE (git mode) — the subagent is dead; clear the lease so the
 *      open hat re-dispatches (createUnitWorktree recreates from the surviving
 *      branch, or resetLostUnits already reset it when branch is gone too).
 *      Timer-free and primary. Complements resetLostUnits, which leaves the
 *      "worktree gone, branch survives" case for in-place resume.
 *   2. Worktree INTACT but lease older than TTL — the one death timer-free
 *      detection can't see. Bounded wall-clock fallback. A false positive
 *      costs one idempotent re-dispatch into the partial worktree, which is
 *      safe: advance_hat's output gate refuses to merge incomplete work.
 *
 *  Filesystem mode has no worktrees, so the worktree-gone signal is inert
 *  (gated on isGitRepo); fs mode relies on the TTL alone. */
export function recoverStaleLeasedUnits(
	slug: string,
	studio: string,
): { cleared: string[] } {
	const cleared: string[] = []
	try {
		const iDir = intentDir(slug)
		const stage = findCurrentStage(slug, studio, iDir)
		if (!stage) return { cleared }
		const unitsDir = join(iDir, "stages", stage, "units")
		if (!existsSync(unitsDir)) return { cleared }
		const gitMode = isGitRepo()
		const now = Date.now()
		for (const f of readdirSync(unitsDir).filter((n) => n.endsWith(".md"))) {
			const path = join(unitsDir, f)
			let fm: Record<string, unknown>
			try {
				fm = parseFrontmatter(readFileSync(path, "utf8")).data
			} catch {
				continue
			}
			const iters = Array.isArray(fm.iterations)
				? (fm.iterations as Array<Record<string, unknown>>)
				: []
			if (iters.length === 0) continue
			const last = iters[iters.length - 1]
			// Only leased OPEN iters can be stale.
			if (!last || last.result !== null) continue
			const lease =
				typeof last.dispatched_at === "string" ? last.dispatched_at : ""
			if (!lease) continue
			const unit = f.replace(/\.md$/, "")
			const worktreeGone = gitMode && !existsSync(unitWorktreePath(slug, unit))
			const leaseAgeMs = now - Date.parse(lease)
			const ttlExceeded =
				Number.isFinite(leaseAgeMs) && leaseAgeMs > STALE_LEASE_TTL_MS
			if (!worktreeGone && !ttlExceeded) continue // subagent presumed alive
			last.dispatched_at = null
			setFrontmatterField(path, "iterations", iters)
			cleared.push(unit)
		}
	} catch {
		/* best-effort — recovery never blocks the tick */
	}
	return { cleared }
}
