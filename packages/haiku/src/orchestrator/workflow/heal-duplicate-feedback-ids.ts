// orchestrator/workflow/heal-duplicate-feedback-ids.ts — pre-tick gate that
// renumbers feedback files which collide on their numeric prefix, so every
// FB carries a UNIQUE id.
//
// Root cause (worker-new-badge, 2026-05-28): `nextFeedbackNumber` is
// local-max+1. When two intent-completion reviewers create feedback in
// parallel against an intent-main that's behind origin (a CI auto-fix commit
// moved origin), both allocate the same number; the non-fast-forward rebase
// recovery (git-worktree `commitAndPush`) then keeps BOTH files —
// `003-cross-stage-….md` AND `003-runtime-….md`. Same numeric prefix,
// different slug → `readFeedbackFiles` returns two items with id `FB-003` and
// `findFeedbackFile` resolves only one. The shadowed one (a delivery-branch
// net-delete BLOCKER) was nearly lost; it had to be re-filed by hand.
//
// This gate makes that self-healing: within each feedback scope (intent root
// + every stage), files sharing a numeric prefix are reduced to one keeper
// (the earliest-created — it owns the id other state may already reference)
// and the rest are renumbered to fresh ids, carrying their sidecar
// attachment and rewriting the body's attachment URL. Best-effort,
// idempotent: a single-file prefix is untouched; a healed tree re-runs to a
// no-op.

import {
	existsSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { feedbackDir } from "../../state-tools.js"

export interface HealResult {
	/** `{ scope, from, to }` for each file renumbered this tick. */
	renamed: Array<{ scope: string; from: string; to: string }>
}

function numericPrefix(filename: string): number | null {
	const m = filename.match(/^(\d+)-/)
	return m ? Number.parseInt(m[1], 10) : null
}

/** Renumber duplicate-prefix feedback files across the intent root + every
 *  given stage. Returns the renames performed. Never throws — a read/parse
 *  failure on one scope is skipped so the tick proceeds. */
export function healDuplicateFeedbackIds(
	slug: string,
	stages: string[],
): HealResult {
	const renamed: HealResult["renamed"] = []
	const scopes = ["", ...stages]

	for (const stage of scopes) {
		const dir = feedbackDir(slug, stage)
		if (!existsSync(dir)) continue

		let entries: string[]
		try {
			entries = readdirSync(dir)
		} catch {
			continue
		}
		const mdFiles = entries.filter((f) => f.endsWith(".md"))

		// Group .md files by numeric prefix.
		const byNum = new Map<number, string[]>()
		for (const f of mdFiles) {
			const n = numericPrefix(f)
			if (n === null) continue
			const arr = byNum.get(n)
			if (arr) arr.push(f)
			else byNum.set(n, [f])
		}

		// Highest prefix currently in use across ALL files — the renumber
		// floor. Track it locally so successive renames don't re-collide.
		let maxNum = 0
		for (const n of byNum.keys()) if (n > maxNum) maxNum = n

		const createdAt = (filename: string): string => {
			try {
				const fm = matter(readFileSync(join(dir, filename), "utf8")).data
				return typeof fm.created_at === "string" ? fm.created_at : ""
			} catch {
				return ""
			}
		}

		for (const [, group] of byNum) {
			if (group.length < 2) continue
			// Keeper = earliest created_at; tiebreak on filename so the choice
			// is deterministic across runs. The keeper retains its id (other
			// engine state may reference it); the rest get fresh ids.
			const sorted = [...group].sort((a, b) => {
				const ca = createdAt(a)
				const cb = createdAt(b)
				if (ca !== cb) return ca < cb ? -1 : 1
				return a < b ? -1 : 1
			})
			const losers = sorted.slice(1)
			for (const loser of losers) {
				maxNum += 1
				const renamedFile = renumberFeedbackFile(dir, loser, maxNum)
				if (renamedFile)
					renamed.push({ scope: stage, from: loser, to: renamedFile })
			}
		}
	}

	return { renamed }
}

/** Rename `NNN-slug.md` (+ any same-stem sidecar) to `MMM-slug.md`, rewriting
 *  the body's `/api/feedback-attachment/.../NNN-slug.<ext>` URL + the
 *  `attachment:` FM field to the new basename. Returns the new .md filename,
 *  or null on failure (best-effort — the caller's tick continues). */
function renumberFeedbackFile(
	dir: string,
	filename: string,
	newNum: number,
): string | null {
	try {
		const oldStem = filename.replace(/\.md$/, "")
		const slugPart = oldStem.replace(/^\d+-/, "")
		const newNn = newNum.toString().padStart(3, "0")
		const newStem = `${newNn}-${slugPart}`
		const newFilename = `${newStem}.md`

		// Move any same-stem sidecar (e.g. the annotation PNG) first, so the
		// body-URL rewrite below points at a file that exists.
		let oldSidecar: string | null = null
		let newSidecar: string | null = null
		for (const entry of readdirSync(dir)) {
			if (entry === filename) continue
			if (entry.startsWith(`${oldStem}.`)) {
				const ext = entry.slice(oldStem.length) // includes leading "."
				oldSidecar = entry
				newSidecar = `${newStem}${ext}`
				renameSync(join(dir, entry), join(dir, newSidecar))
				break
			}
		}

		const raw = readFileSync(join(dir, filename), "utf8")
		const parsed = matter(raw)
		// Fresh data object — never mutate gray-matter's cached parse.
		const data: Record<string, unknown> = { ...parsed.data }
		let body = parsed.content
		if (oldSidecar && newSidecar) {
			if (data.attachment === oldSidecar) data.attachment = newSidecar
			// The body carries `/api/feedback-attachment/<slug>/<stage>/<base>`;
			// rewriting the basename is enough (slug/stage are unchanged).
			body = body.split(oldSidecar).join(newSidecar)
		}
		// Write the new file, then remove the original (new name always differs
		// — newNum is above the current max).
		writeFileSync(join(dir, newFilename), matter.stringify(body, data))
		rmSync(join(dir, filename))
		return newFilename
	} catch {
		return null
	}
}
