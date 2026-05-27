// stage-internal-entries.ts — Canonical list of engine-internal entries
// at the root of a stage directory (`.haiku/intents/{slug}/stages/{stage}/`).
//
// Anything that walks a stage tree to surface user-facing artifacts
// MUST consult this set so engine plumbing (drift baselines, drift
// snapshots, drift acks, drift assessments, workflow state, the units
// and feedback subdirs that have their own renderers) does not leak
// into the Outputs tab, the diff view, the artifacts walker, or any
// other reviewer-facing surface.
//
// The names live here — separate from any one walker — so a new walker
// added later cannot silently regress the exclusion. Import this set,
// don't redeclare it.

/**
 * Engine-internal entries that live at the stage-root level. A walker
 * over `stages/{stage}/**` should skip these at depth 0 only — once
 * descended into a non-internal subtree, every file under it is fair
 * game.
 *
 * Notes per entry:
 * - `STAGE.md` — stage-definition copy (rendered separately).
 * - `state.json` — pre-v4 workflow state record. Dead in v4 but kept
 *   here so any leftover migrator-deletion misses don't leak into the
 *   Outputs tab.
 * - `units/` — unit specs (rendered by the Units tab).
 * - `feedback/` — feedback items (rendered by the Feedback tab).
 * - `baseline.json` — drift-baseline manifest
 *   (`packages/haiku/src/orchestrator/workflow/drift-baseline.ts:111`).
 * - `baseline-content/` — sha256-addressed content snapshots used by
 *   the diff renderer (same module, line 670).
 * - `.baseline-ack` — operator-acknowledgment marker for re-establish
 *   gating (same module, line 1082).
 * - `baseline-thrash.json` — thrash counter for re-establish backoff
 *   (same module, line 1431).
 * - `drift-assessments/` — drift assessment records (`run-tick.ts:502`,
 *   `tools/orchestrator/haiku_classify_drift.ts:141`).
 * - `iterations.jsonl` — DEPRECATED 2026-05-13. The stage-level
 *   iteration log was a second source of truth; stage iteration
 *   history is now derived from closed feedback files in the
 *   stage's `feedback/` dir. The entry stays in this set so legacy
 *   files (from pre-2026-05-13 intents) are still skipped by
 *   parsers — they're harmless if present but should never be
 *   written or read going forward.
 * - `decisions.jsonl` — v4 per-stage decision log
 *   (`state-tools.ts:appendDecisionLogLine`, written by
 *   `haiku_decision_record` and `haiku_reconciliation_acknowledge`).
 * - `no-decisions.json` — v4 marker for the `no_decisions: true`
 *   branch of `haiku_decision_record`.
 * - `upstream-reconciliation.json` — v4 marker for
 *   `haiku_reconciliation_acknowledge`.
 * - `gate-session.json` — LEGACY. A pre-v9 per-stage gate-review
 *   session-pointer sidecar. Nothing writes it (the v8→v9 migrator
 *   deletes it); gate sessions are now resolved from the in-memory
 *   registry keyed by intent slug, with NO repo-persisted pointer.
 *   Kept in this set so a downgrade-created stray is still treated as
 *   engine-owned and swept rather than surfaced as user output.
 * - `elaboration.md` — v4 per-stage elaborate-gate artifact. Read by
 *   `derived-stage-state` to gate the `elaborate` phase. NOT
 *   internal — it's user-visible content (the captured conversation),
 *   so it's NOT in this set; the artifacts walker surfaces it.
 *
 * `artifacts/` is the canonical user-output dir and is walked separately
 * by the artifacts scan; callers exclude it explicitly so users see
 * artifacts under the right reviewer-facing path conventions.
 */
export const STAGE_INTERNAL_ENTRIES: ReadonlySet<string> = new Set([
	"STAGE.md",
	"state.json",
	"units",
	"feedback",
	"baseline.json",
	"baseline-content",
	".baseline-ack",
	"baseline-thrash.json",
	"drift-assessments",
	"iterations.jsonl",
	"decisions.jsonl",
	"no-decisions.json",
	"upstream-reconciliation.json",
	"gate-session.json",
])

/**
 * Engine-internal entries at the INTENT-root level
 * (`.haiku/intents/{slug}/`). A walker that surfaces intent-root files as
 * the catch-all "Other" tab (intent scope) MUST skip these at depth 0 so
 * the intent spec, the category dirs that have their own renderers, and —
 * critically — SYSTEM bookkeeping files (`action-log.jsonl`,
 * `write-audit.jsonl`, the drift baseline/tick journals) never leak into a
 * reviewer-facing surface. The action/audit logs are append-only system
 * journals, not user artifacts; they are hidden from the SPA by design.
 *
 * Notes per entry:
 * - `intent.md` — the intent spec (rendered on the intent Overview tab).
 * - `stages/` — per-stage trees (rendered by the stage views).
 * - `knowledge/` — intent-scope knowledge (the Knowledge tab).
 * - `feedback/` — intent-scope feedback (the Feedback surface).
 * - `reflection.md` — the synthesized intent reflection (surfaced
 *   separately, not an unknown stray).
 * - `intent-tick.json` — the intent-scope tick counter (bookkeeping).
 * - `action-log.jsonl` / `write-audit.jsonl` — append-only system journals
 *   (write attribution + audit). NEVER shown in the SPA.
 * - baseline / drift sidecars — drift bookkeeping, mirrors the stage set.
 * - `.gitattributes` / `.gitkeep` — VCS plumbing.
 */
export const INTENT_ROOT_INTERNAL_ENTRIES: ReadonlySet<string> = new Set([
	"intent.md",
	"stages",
	"knowledge",
	"feedback",
	"reflection.md",
	"intent-tick.json",
	"action-log.jsonl",
	"write-audit.jsonl",
	"baseline.json",
	"baseline-content",
	".baseline-ack",
	"baseline-thrash.json",
	"drift-markers.json",
	"drift-assessments",
	".gitattributes",
	".gitkeep",
])
