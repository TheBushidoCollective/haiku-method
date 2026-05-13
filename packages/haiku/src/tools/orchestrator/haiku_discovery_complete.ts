// tools/orchestrator/haiku_discovery_complete.ts — Discovery
// subagent's merge-back hand-off.
//
// Why this exists:
//   Discovery subagents work in isolation worktrees (one per template
//   so parallel agents don't race on the stage tree). When the subagent
//   finishes writing + committing its artifact, *someone* has to merge
//   that worktree's branch into the stage branch so the next
//   `haiku_run_next` tick sees the file on disk and the cursor's
//   existence check passes. Before this tool existed, the engine ran a
//   pre-cursor sweep on every tick — that approach re-merged leftover
//   worktrees from completed stages and trapped haiku_run_next in
//   `merge_stage` loops (see gigsmart/haiku-method#333). The subagent
//   itself is the right actor to trigger the merge: it knows it just
//   completed work, and the engine can take the per-stage lock so
//   parallel siblings serialize cleanly.
//
// Contract:
//   - Subagent calls with `{ intent, stage, template }` matching the
//     dispatch fan-out it ran under.
//   - The engine grabs `withStageLock(slug, stage)` so two siblings
//     completing simultaneously can't race on the stage branch's index.
//   - `mergeDiscoveryWorktree` ff-merges intent main into the discovery
//     worktree (engine branch enforcement), merges the discovery
//     branch into the stage branch via temp worktree, then removes the
//     worktree + deletes the discovery branch.
//   - Conflicts surface as `discovery_merge_conflict` with the file
//     list so the agent can dispatch the integrator. Non-conflict
//     failures surface as `discovery_merge_failed` with the error
//     message.
//
// What this tool does NOT do:
//   - Sweep all worktrees on disk. It operates only on the named
//     `{stage, template}` pair the caller passed.
//   - Run on every tick. The engine no longer auto-merges discovery
//     work; only this explicit call does.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	discoveryWorktreePath,
	mergeDiscoveryWorktree,
} from "../../git-worktree.js"
import { withStageLock } from "../../locks.js"
import {
	HAIKU_DISCOVERY_COMPLETE_INPUT_SCHEMA,
	type HaikuDiscoveryCompleteInput,
	validateHaikuDiscoveryCompleteInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { findHaikuRoot, parseFrontmatter } from "../../state-tools.js"
import { readStageArtifactDefs } from "../../studio-reader.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

/** Resolve the discovery template's `location:` field to an absolute
 *  path INSIDE the discovery worktree (mirror of decompose.ts:455-468).
 *
 *  - `.haiku/...` paths are repo-root relative → `<worktree>/<loc>`
 *  - `/abs/...` paths stay absolute (rare; discovery templates
 *    shouldn't declare absolute paths but support them for parity).
 *  - Anything else is intent-relative → `<worktree>/.haiku/intents/<slug>/<loc>`
 *
 *  Substitutes `{intent-slug}` token like the cursor does.
 *
 *  Returns `null` when `location` is empty. The caller's
 *  artifact-presence gate short-circuits on null, which means
 *  templates without a `location:` field are NOT protected by the
 *  presence gate — they pre-date the `location:` convention and the
 *  gate has no path to check. New templates should always declare a
 *  `location:` so the gate fires. */
function resolveArtifactPathInWorktree(
	worktree: string,
	slug: string,
	location: string,
): string | null {
	if (!location) return null
	const resolved = location.replace(/\{intent-slug\}/g, slug)
	if (resolved.startsWith(".haiku/")) return join(worktree, resolved)
	if (resolved.startsWith("/")) return resolved
	return join(worktree, ".haiku", "intents", slug, resolved)
}

export default defineTool({
	name: "haiku_discovery_complete",
	description:
		"Discovery subagent's completion hand-off. Merges the discovery worktree's branch back into its stage branch under a per-stage lock. Call AFTER committing your artifact inside the isolation worktree. Returns `{ ok: true }` on clean merge, `discovery_artifact_missing` with `expected_path` when the template's `location:` file isn't present in the worktree (you skipped or misplaced the write), `discovery_merge_conflict` with conflict_files on real conflict, `discovery_merge_failed` with the git error on other failures, `intent_not_found` when the intent dir is missing, `worktree_not_found` when the discovery worktree doesn't exist (already merged or never created).",
	inputSchema: jsonSchemaOf(HAIKU_DISCOVERY_COMPLETE_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuDiscoveryCompleteInputSchema,
			"haiku_discovery_complete",
		)
		if (inputErr) return inputErr
		const validated = args as HaikuDiscoveryCompleteInput
		const { intent: slug, stage, template } = validated

		// Intent existence check up front so we don't merge against a
		// branch tree that has no owning intent dir.
		const root = findHaikuRoot()
		const intentDir = join(root, "intents", slug)
		if (!existsSync(intentDir)) {
			return text(
				JSON.stringify({
					ok: false,
					error: "intent_not_found",
					message: `Intent '${slug}' not found at ${intentDir}.`,
				}),
			)
		}

		// Worktree presence check: a subagent calling this after the
		// engine already merged (e.g. via the deprecated sweep) sees the
		// worktree gone. Surface as a non-fatal signal so the agent can
		// re-tick — the cursor will pick up wherever the workflow is.
		const worktreePath = discoveryWorktreePath(slug, stage, template)
		if (!existsSync(worktreePath)) {
			return text(
				JSON.stringify({
					ok: false,
					error: "worktree_not_found",
					message: `No discovery worktree at ${worktreePath}. The worktree may have been merged or never created — re-tick haiku_run_next; if the cursor still requests this discovery, redispatch the subagent.`,
				}),
			)
		}

		// ARTIFACT-PRESENCE GATE (added 2026-05-13 — closes the
		// "discovery_complete returns ok: true 3× but the cursor still
		// flags it as missing" loop reported on `coverage-mapping`).
		//
		// The merge below was previously the first place anything
		// checked disk — it would happily ff-merge an empty commit if
		// the subagent claimed completion without writing the file.
		// Now we look up the studio's discovery template definition,
		// resolve its `location:` to the absolute path INSIDE the
		// worktree, and require the file to exist there before the
		// merge runs. If it doesn't, we surface the expected path so
		// the subagent (or the parent agent reading the error) knows
		// exactly what to write.
		try {
			const intentFm = parseFrontmatter(
				readFileSync(join(intentDir, "intent.md"), "utf8"),
			).data
			const studio = typeof intentFm.studio === "string" ? intentFm.studio : ""
			if (studio) {
				// Case-insensitive name match: `readStageArtifactDefs`
				// preserves the template filename's case (e.g.
				// `DISCOVERY.md` → name `"DISCOVERY"`), but the
				// dispatch flow normalizes to lowercase (see
				// `decompose.ts`), and the subagent passes the
				// lowercased form as `template`. Compare lowercase on
				// both sides so the lookup matches regardless of
				// filename casing convention.
				const want = template.toLowerCase()
				const def = readStageArtifactDefs(studio, stage)
					.filter((d) => d.kind === "discovery")
					.find((d) => d.name.toLowerCase() === want)
				if (def) {
					const expectedPath = resolveArtifactPathInWorktree(
						worktreePath,
						slug,
						def.location,
					)
					if (expectedPath && !existsSync(expectedPath)) {
						const stageRelPath = expectedPath.startsWith(worktreePath)
							? expectedPath.slice(worktreePath.length + 1)
							: expectedPath
						return text(
							JSON.stringify({
								ok: false,
								error: "discovery_artifact_missing",
								intent: slug,
								stage,
								template,
								expected_path: expectedPath,
								location: def.location,
								message: [
									`Discovery template '${template}' declares location '${def.location}', but no file exists at the expected path inside your isolation worktree.`,
									``,
									`Expected (absolute):  ${expectedPath}`,
									`Expected (worktree-relative):  ${stageRelPath}`,
									``,
									`Before calling haiku_discovery_complete you MUST:`,
									`  1. Write the populated discovery artifact to the path above.`,
									`  2. \`git -C "${worktreePath}" add -A && git -C "${worktreePath}" commit -m "..."\``,
									`  3. Re-call \`haiku_discovery_complete { intent: "${slug}", stage: "${stage}", template: "${template}" }\`.`,
									``,
									`If you wrote the file somewhere else (intent main, the stage branch directly, or another path), move it into the worktree at the expected path and commit there — haiku_discovery_complete only merges from the isolation worktree.`,
								].join("\n"),
							}),
						)
					}
				}
			}
		} catch {
			// Best-effort presence check. If reading intent.md or the
			// studio's artifact defs throws (corrupt frontmatter, studio
			// renamed, etc.), fall through to the merge — the merge will
			// surface a more specific git error and we don't want this
			// check to be the thing that blocks recovery.
		}

		try {
			const merged = withStageLock(slug, stage, () =>
				mergeDiscoveryWorktree(slug, stage, template),
			)
			if (merged.success) {
				emitTelemetry("haiku.discovery.merged", {
					intent: slug,
					stage,
					template,
				})
				return text(
					JSON.stringify({
						ok: true,
						intent: slug,
						stage,
						template,
						message: merged.message,
					}),
				)
			}
			if (merged.isConflict) {
				return text(
					JSON.stringify({
						ok: false,
						error: "discovery_merge_conflict",
						intent: slug,
						stage,
						template,
						conflict_files: merged.conflictFiles ?? [],
						message: merged.message,
					}),
				)
			}
			return text(
				JSON.stringify({
					ok: false,
					error: "discovery_merge_failed",
					intent: slug,
					stage,
					template,
					message: merged.message,
				}),
			)
		} catch (err) {
			return text(
				JSON.stringify({
					ok: false,
					error: "discovery_merge_threw",
					intent: slug,
					stage,
					template,
					message: err instanceof Error ? err.message : String(err),
				}),
			)
		}
	},
})
