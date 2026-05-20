// orchestrator/workflow/cursor.ts — The single virtual cursor over an
// intent's aggregate state.
//
// On every haiku_run_next call, derivePosition(slug) reads disk:
//   - intent.md
//   - every unit.md across every stage
//   - every feedback file across every stage + intent-scope
//   - studio config (cached)
//   - drift sweep (Track C)
//
// And returns ONE action describing the next thing the agent should
// do, OR null when there's nothing to do (mid-wave noop, all
// in-flight subagents still working).
//
// No side effects. Anyone can call run_next; same disk → same answer.
//
// Track priority:
//   1. Track C — drift sweep. Engine-internal: events are restamped
//      and (deduped) FBs are filed by `engineHandleDriftEvents`. No
//      agent-facing action emitted; control falls through to Track B
//      so the just-filed FBs get dispatched the same tick.
//   2. Track B — feedback. Any open FB → feedback-cycle action.
//   3. Track A — intent. Walk stages in order; return first non-null
//      action.
//   4. All stages merged into intent main + intent.approvals.* signed
//      → sealed.
//
// Stages are NEVER sealed — only intents are. A previously-merged
// stage that gains a new unit (e.g. because the feedback engine added
// corrective work) becomes ahead-of-main and the cursor automatically
// rewinds to it via findCurrentStage. merge_stage is a recurring
// event, not a terminal one. Forward-only applies to existing units'
// bytes (immutable post-merge), not to whether a stage is "done."
//
// State sources of truth (no state.json anywhere):
//   - "active stage" = first stage whose branch is not merged into
//     intent main (derived from git --is-ancestor)
//   - "in-flight unit" = unit with started_at != null and
//     iterations[-1].result == null
//   - "wave-ready unit" = unit with started_at == null whose
//     depends_on are all merged (their branch is in stage branch)
//   - "stage ready to merge" = every unit merged + every spec review
//     signed + quality_gates signed + every configured agent signed
//     + user signed (mode-dependent — autopilot skips agents and user)
//
// Mode shaping (read from intent.mode):
//   - continuous: full role list [spec, quality_gates, <agents>, user]
//   - discrete:   same role list; user_gate triggers MR opening + wait
//                 for merge into intent main as the approval signal
//   - autopilot:  trimmed role list [spec, quality_gates]; no user
//                 gate, no agent gates, merge_stage auto-fires once
//                 quality_gates is signed

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import matter from "gray-matter"
import { findHaikuRoot, MAX_FIX_LOOP_BOLTS } from "../../state-tools.js"
import {
	readReviewAgentPaths,
	readStageArtifactDefs,
} from "../../studio-reader.js"
import {
	resolveIntentStages,
	resolveStageFixHats,
	resolveStageHats,
	resolveStudioFixHats,
} from "../studio.js"
import { engineHandleDriftEvents } from "./drift-handle-events.js"
import { runDriftSweep } from "./drift-sweep.js"

// ── CursorAction discriminated union ─────────────────────────────────

/**
 * The elaborate-loop's per-signal payload. Each entry in
 * `CursorAction.signals_unmet[]` represents one unmet completion
 * signal the agent should make progress on. The agent may address any
 * subset in one tick — they aren't ordered or mutually exclusive.
 *
 * `discovery` carries per-template fan-out info (which agent template
 * is missing its artifact, plus a representative unit when one exists).
 *
 * Verifier nonces for `verify_conversation` / `verify_decompose` live
 * on the wire payload at `OrchestratorAction.verifier_nonces`, keyed
 * by signal name — not on the signal entries themselves — because the
 * cursor walk is pure (nonce minting is a side effect performed by
 * `run-tick.ts` after the walk returns).
 */
export type ElaborateLoopSignal =
	| { signal: "conversation" }
	| { signal: "verify_conversation" }
	| { signal: "discovery"; agent: string; units: string[] }
	| { signal: "decompose" }
	| { signal: "verify_decompose" }

export type CursorAction =
	// design_direction_* and clarify_required cursor actions deleted
	// 2026-05-08: collapsed into the discovery-agent model. Studios
	// now declare a discovery template with `tool:` (e.g., the
	// software studio's `discovery/DESIGN-DIRECTION.md` declares
	// `tool: pick_design_direction`) and the cursor's existence
	// check on the artifact location passes the gate. See
	// `prompts/elaborate_loop.ts` for the tool-driven branch.
	//
	// ── ELABORATE LOOP — single cursor state, multi-signal payload ─────
	//
	// Per GOALS.md (collapsed 2026-05-14, GAPS § 1a → Option A), the
	// elaborate state is ONE cursor kind. A single emission lists every
	// currently-unmet completion signal in `signals_unmet[]`. The agent
	// may make progress on any/all of them in the same response (the
	// spec's "agent calls several tools per tick" — concurrent activity
	// is invited at the action shape, not just the prompt copy).
	//
	// Signals (per GOALS.md):
	//
	//   Signal 1 — discovery artifacts exist on disk
	//     → `signals_unmet[]` includes one `{ signal: "discovery", … }`
	//       per missing template (carries `agent`, `units`).
	//   Signal 2 — no open `origin: discovery, resolution: question` FBs
	//     → handled by Track B's feedback flow (any open FB preempts
	//       Track A, so a discovery question routes as `feedback_question`).
	//   Signal 3a — conversation captured at stages/<stage>/elaboration.md
	//     → `{ signal: "conversation" }`.
	//   Signal 3b — conversation verified (`verified_at` stamped)
	//     → `{ signal: "verify_conversation", verifier_nonce }`.
	//   Signal 4a — at least one unit drafted
	//     → `{ signal: "decompose" }`.
	//   Signal 4b — units cover the conversation
	//                (`decompose_verified_at` stamped via decompose-verifier)
	//     → `{ signal: "verify_decompose", verifier_nonce }`.
	//
	// (Drafting → pending is stage-scope, not per-unit: while
	// `decompose_verified_at` is absent, the cursor's wave dispatch is
	// blocked, so every unit is implicitly drafting. Once the seal
	// stamps, the next tick walks past elaborate_loop into execute.)
	//
	// `stage` is absent for the pre-intent emission (intent.md substance
	// verifier, before any stage walk).
	| {
			kind: "elaborate_loop"
			stage?: string
			signals_unmet: ReadonlyArray<ElaborateLoopSignal>
	  }
	| {
			kind: "start_unit_hat"
			stage: string
			hat: string
			units: string[]
			terminal: boolean
	  }
	| {
			kind: "start_feedback_hat"
			/** Per-FB dispatch entries. Each entry carries its own
			 *  (stage, hat, terminal) so the batch is heterogeneous:
			 *  different stages, different hat positions in their
			 *  respective fix_hats sequences, different terminal flags.
			 *  The main agent spawns one subagent per entry in a single
			 *  parallel Task batch.
			 *
			 *  Dedup invariant: at most one entry per `targets.unit` per
			 *  batch. Closure of two FBs on the same target unit races
			 *  on the FM write inside `applyFeedbackInvalidations`; the
			 *  cursor serializes by holding back duplicates to the next
			 *  tick. Intent-scope FBs (no `targets.unit`) and
			 *  `targets.invalidates: []` FBs don't race, so they can
			 *  always batch together. */
			dispatches: Array<{
				feedback_id: string
				stage: string
				hat: string
				terminal: boolean
			}>
			/** Legacy aliases mirroring `dispatches[0]`. Pre-2026-05-18 the
			 *  action shape was `{ stage, hat, feedback_ids, terminal }`
			 *  for a single FB; these fields are populated as convenience
			 *  shadows so callers that read the top-level shape keep
			 *  working while the batched `dispatches[]` is the canonical
			 *  source. Empty / unset on batches with zero entries. */
			stage?: string
			hat?: string
			feedback_ids?: string[]
			terminal?: boolean
	  }
	// `feedback_question` is a Track-B preempt for open FBs that carry
	// `resolution: "question"`. These FBs are user-decidable forks the
	// agent can't resolve on its own (most commonly filed by discovery
	// subagents when an artifact's required choice isn't derivable from
	// the codebase). Routing them through `start_feedback_hat` is wrong
	// — the fix-hat chain is for findings, not questions. Instead the
	// engine emits this action so the main agent reads the FB body,
	// asks the user inline via `ask_user_chat`, writes the answer back
	// on the FB body via `haiku_feedback_write`, and closes the FB via
	// `haiku_feedback_update { status: "closed" }`. Closing the FB
	// flips the elaborate-loop's discovery-question completion signal
	// and the cursor falls through to the next signal on the next tick.
	| {
			kind: "feedback_question"
			stage: string
			feedback_id: string
			feedback_path: string
	  }
	| {
			kind: "dispatch_review"
			stage: string
			role: string
			units: string[]
	  }
	| {
			kind: "dispatch_approval"
			stage: string
			role: string
			units: string[]
	  }
	| {
			kind: "dispatch_quality_gates"
			// `stage` is empty for intent-scope dispatches.
			stage: string
			// Empty for intent-scope; the handler walks every stage's
			// units, dedupes by command, runs once.
			units: string[]
			// `"intent"` after the studio's intent-completion review
			// stamps clean; `undefined` (defaults to `"stage"`) for the
			// post-execute approval track. Per GOALS § "Quality gates
			// are one handler at three scopes."
			scope?: "intent"
	  }
	| {
			kind: "user_gate"
			stage: string
			gate_kind: "spec" | "approval"
			units: string[]
	  }
	| { kind: "close_feedback"; stage: string; feedback_id: string }
	| { kind: "complete_stage"; stage: string }
	// Reflection observations (2026-05-18) — fires once per stage,
	// after every approval is signed but before complete_stage
	// advances. The agent writes a free-form observations.md
	// describing where it struggled with mandates, what was
	// ambiguous, and what surprised it. The file is committed with
	// the stage merge so the per-intent reflection pass at intent
	// close sees the full signal across stages.
	| { kind: "record_observations"; stage: string }
	| { kind: "intent_review"; role: string }
	// Reflection (2026-05-19) — fires once at intent close, after
	// every intent-scope approval is signed but before seal_intent.
	// The agent reads every stage's observations.md + the FB stream
	// + unit iterations/outputs, writes a synthesized
	// `reflection.md` at intent root, writes proposed project
	// overlays directly to `.haiku/...` for override-class findings,
	// and calls `haiku_report` (with the `[autotune engine-class]`
	// prefix convention) for engine-class findings. Every change
	// commits with an `autotune:` prefixed message so PR review
	// catches the provenance. Idempotent — skipped when
	// `reflection.md` already exists for this intent.
	| { kind: "record_reflection" }
	| { kind: "seal_intent" }
	| { kind: "sealed" }
	// Pre-dispatch validation — refuse to fire `start_unit_hat` when
	// one or more units in the wave/dispatch set are structurally
	// invalid in ways that `haiku_repair` would otherwise have to flag.
	// Surfaces as a structured action so the agent fixes the unit spec
	// (via `haiku_unit_set` / `haiku_unit_write`) before re-ticking,
	// instead of subagents being dispatched against broken units and
	// then erroring or producing wrong artifacts. Two distinct shapes
	// because the agent's remediation differs:
	//
	//   - `unit_inputs_not_declared`: unit FM has no `inputs:` field at
	//     all. An empty array (`inputs: []`) is a DELIBERATE "no
	//     inputs" declaration and passes; a missing field is structural
	//     drift. Fires only on non-first stages where the upstream-
	//     artifact contract applies. The agent should declare
	//     `inputs:` with the upstream paths the unit depends on (or
	//     `inputs: []` to make "no inputs" explicit) via
	//     `haiku_unit_set { field: "inputs", value: [...] }`.
	//   - `unit_outputs_empty_iterations`: unit declares `outputs:`
	//     (non-empty) but `iterations: []` — the unit was created and
	//     possibly started but never ran a single hat. Spec review
	//     against this state would file `unit_outputs_empty` feedback
	//     N times. The agent should either dispatch the wave-ready /
	//     needs-next-hat tick to build the unit, or — if the unit was
	//     created in error — delete it via `haiku_unit_delete`.
	| {
			kind: "unit_inputs_not_declared"
			stage: string
			units: string[]
	  }
	| {
			kind: "unit_outputs_empty_iterations"
			stage: string
			units: string[]
	  }

// ── Helpers ──────────────────────────────────────────────────────────

type UnitFm = Record<string, unknown>
type FbFm = Record<string, unknown>

type Iteration = {
	hat: string
	started_at: string
	completed_at: string | null
	// `advance` / `reject` come from unit iterations
	// (`haiku_unit_advance_hat` / `haiku_unit_reject_hat`).
	// `advanced` / `closed` / `rejected` come from FB iterations
	// (`haiku_feedback_advance_hat` writes `advanced` for mid-chain
	// hats and `closed` for the terminal hat;
	// `haiku_feedback_reject_hat` writes `rejected`). Both
	// vocabularies coexist here because units and feedback share the
	// iteration shape on disk.
	result: "advance" | "reject" | "advanced" | "closed" | "rejected" | null
	reason?: string | null
}

// Approval slot shapes the cursor accepts as "stamped":
//   - object `{ at, migrated? }` — production write from a hat advance or
//     a synthesized backfill stamp (the canonical shape).
//   - bare `true` — post-migration backfill (`backfillCompletedUnitStamps`
//     writes plain booleans on v3-shaped units). `isUnitFullyApproved`
//     keys off truthy presence; the SHAPE of the stamp is not the signal.
//   - null — no stamp.
type ApprovalRecord = { at: string; migrated?: boolean } | boolean | null

/** Stamp / clear the drift cascade alarm on intent.md FM. Called from
 *  the cursor's pre-tick drift handler when the open-FB count crosses
 *  the cascade threshold. The flag is read by the run_next response
 *  enrichment in `preview.ts` so the agent sees a "consider
 *  /haiku:haiku-repair — drift baseline may be stale" recommendation. The
 *  flag self-heals: it's stamped on trip AND cleared when the count
 *  drops below threshold on a subsequent tick. */
function stampDriftCascadeAlarm(args: {
	intentDir: string
	stage: string
	tripped: boolean
}): void {
	const intentMdPath = join(args.intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return
	try {
		const raw = readFileSync(intentMdPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>
		const key = "drift_cascade_alarm"
		const stage = args.stage
		const existing = fm[key]
		const alarmMap =
			existing && typeof existing === "object" && !Array.isArray(existing)
				? { ...(existing as Record<string, unknown>) }
				: {}
		const prev = alarmMap[stage]
		if (args.tripped) {
			if (prev !== true) {
				alarmMap[stage] = true
				fm[key] = alarmMap
				writeFileSync(intentMdPath, matter.stringify(parsed.content, fm))
			}
		} else if (prev === true) {
			delete alarmMap[stage]
			if (Object.keys(alarmMap).length === 0) {
				delete fm[key]
			} else {
				fm[key] = alarmMap
			}
			writeFileSync(intentMdPath, matter.stringify(parsed.content, fm))
		}
	} catch {
		/* swallow — alarm is advisory; a write failure shouldn't block
		 * the tick. The next tick will re-attempt. */
	}
}

/**
 * Whether the reflection loop is enabled for the given intent. ON by
 * default (2026-05-19); read `reflection: false` off intent.md FM
 * to disable. The opt-out is for legacy intents and the e2e test
 * suites whose fixtures predate the reflection cursor walk shape;
 * new intents inherit the default-on behavior.
 *
 * Backwards compat: a `autotune: false` field from the brief
 * 2026-05-18 window where this flag was named "autotune" still
 * counts as opt-out.
 */
export function isReflectionEnabled(intentDir: string): boolean {
	const intentMdPath = join(intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return true
	try {
		const raw = readFileSync(intentMdPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as { reflection?: unknown; autotune?: unknown }
		if (fm.reflection === false) return false
		if (fm.autotune === false) return false
		return true
	} catch {
		return true
	}
}

export function readFm(path: string): { data: UnitFm; body: string } | null {
	if (!existsSync(path)) return null
	try {
		const raw = readFileSync(path, "utf8")
		const parsed = matter(raw)
		return { data: parsed.data as UnitFm, body: parsed.content }
	} catch {
		return null
	}
}

/**
 * Terminal-state predicate for FB frontmatter. Returns true when the FB
 * is in any terminal lifecycle state — closure or rejection — and must
 * NEVER be re-dispatched by the fix-hat walker. Any one signal is
 * sufficient:
 *
 *   - `closed_at` is truthy (string OR Date — gray-matter parses
 *     unquoted ISO timestamps as Date objects, and earlier versions
 *     of this guard checked `typeof === "string"` which let Date-typed
 *     closures slip through and triggered the infinite re-dispatch
 *     loop reported 2026-05-18 in `haiku-bug-fb-cursor-stuck`)
 *   - `rejected_at` is truthy (same Date/string handling — caught the
 *     `haiku-bug-fb111-stuck-loop` regression 2026-05-18 where a
 *     terminal-rejected FB kept getting re-dispatched because the
 *     classifier had nothing left to do and both `advance_hat` and
 *     `reject_hat` returned `lifecycle_violation` against terminal
 *     status, leaving the cursor with no on-disk progress to read)
 *   - `status === "closed"` OR `status === "rejected"` (legacy explicit
 *     fields; many on-disk FBs still carry one of these even after
 *     `closed_at` / `rejected_at` write paths landed)
 *   - `closed_by` is set with a `fix-loop:*` prefix (the terminal
 *     advance_hat write — paired with closed_at but checked
 *     independently as a belt-and-suspenders against partial writes)
 *
 * Renamed from `isFbClosed` on 2026-05-18 — closure was always a
 * proxy for "terminal," and conflating the two left rejected FBs in
 * the dispatch queue forever.
 */
function isFbTerminal(fm: UnitFm | FbFm): boolean {
	if (fm.closed_at) {
		// Truthy covers string + Date + any non-empty value. Empty
		// string and null fall through to the other signals.
		if (fm.closed_at instanceof Date) return true
		if (typeof fm.closed_at === "string" && fm.closed_at.length > 0)
			return true
	}
	// Same Date/string handling for the rejection timestamp. v4 FB
	// derivation treats `rejected_at` as the highest-priority terminal
	// signal (deriveFeedbackStatus signal 1 in state-tools.ts) — the
	// cursor must agree.
	const rejectedAt = (fm as Record<string, unknown>).rejected_at
	if (rejectedAt) {
		if (rejectedAt instanceof Date) return true
		if (typeof rejectedAt === "string" && rejectedAt.length > 0) return true
	}
	if (typeof fm.status === "string") {
		if (fm.status === "closed" || fm.status === "rejected") return true
	}
	if (
		typeof fm.closed_by === "string" &&
		fm.closed_by.startsWith("fix-loop:")
	) {
		return true
	}
	return false
}

/** Back-compat alias for the renamed predicate. Internal callers
 *  migrate to `isFbTerminal`; this thin wrapper exists so anything that
 *  still imports the old name (or any unindexed call site) keeps
 *  working until the next refactor sweep. */
function isFbClosed(fm: UnitFm | FbFm): boolean {
	return isFbTerminal(fm)
}

// readClarifyQuestions deleted 2026-05-08 along with the
// clarify_required cursor action. Stages that need pre-decompose Q&A
// now declare a discovery template with `tool:` (any tool that
// captures user input). Zero studios shipped clarify dirs at deletion.

function pickIterations(fm: UnitFm | FbFm): Iteration[] {
	if (!Array.isArray(fm.iterations)) return []
	return (fm.iterations as Iteration[]) ?? []
}

function pickApprovals(fm: UnitFm): Record<string, ApprovalRecord> {
	const a = fm.approvals
	if (a === null || typeof a !== "object" || Array.isArray(a)) return {}
	return a as Record<string, ApprovalRecord>
}

function pickReviews(fm: UnitFm): Record<string, ApprovalRecord> {
	const r = fm.reviews
	if (r === null || typeof r !== "object" || Array.isArray(r)) return {}
	return r as Record<string, ApprovalRecord>
}

export function unitName(unitPath: string): string {
	return basename(unitPath).replace(/\.md$/, "")
}

export function listUnitPaths(stageDir: string): string[] {
	const dir = join(stageDir, "units")
	if (!existsSync(dir)) return []
	return readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => join(dir, e.name))
		.sort()
}

function listFbPaths(scopeDir: string): string[] {
	const dir = join(scopeDir, "feedback")
	if (!existsSync(dir)) return []
	return readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => join(dir, e.name))
		.sort()
}

/**
 * Derive the next-hat instruction for a unit based on its iterations
 * history. Returns null when the unit is past terminal advance (done).
 */
export function nextHatForUnit(
	fm: UnitFm,
	configuredHats: string[],
): { hat: string; terminal: boolean; rejected?: boolean } | null {
	if (configuredHats.length === 0) return null
	const iterations = pickIterations(fm)
	if (iterations.length === 0) {
		// Not started — first hat.
		return {
			hat: configuredHats[0],
			terminal: configuredHats.length === 1,
		}
	}
	const last = iterations[iterations.length - 1]
	if (last.result === null) {
		// Open iter on `last.hat`. Two cases produce this state and
		// the cursor's answer for both is "dispatch the open hat":
		//
		// 1. Mid-chain engine pre-open. `haiku_unit_advance_hat` /
		//    `_reject_hat` close the prior iter (result="advance" /
		//    "rejected") and append a fresh open iter for the next /
		//    previous hat respectively. The subagent that called
		//    advance_hat terminates immediately after; the parent
		//    calls run_next; the open iter sits with no subagent
		//    actually running it. The cursor must emit
		//    `start_unit_hat` for `last.hat` so the parent dispatches
		//    the next subagent.
		//
		// 2. Orphaned fresh open (`haiku_unit_start` ran, subagent
		//    crashed before calling advance_hat / reject_hat). Again,
		//    no subagent is running — re-dispatching is the right
		//    move (idempotent: if the subagent left the unit's
		//    worktree in a partial state, the re-dispatched hat picks
		//    up where it left off; advance_hat's output gate refuses
		//    to merge unless the outputs are present).
		//
		// Pre-2026-05-13 this branch returned `null`, treating the
		// open iter as "in-flight, no new dispatch needed." That
		// assumed the parent only calls run_next while a subagent is
		// running — but the design contract is the OPPOSITE: the
		// parent batches dispatches, waits for ALL subagents to
		// return, THEN calls run_next. At run_next time no subagent
		// is running, so "in-flight" is never the correct read of an
		// open iter. The cursor must dispatch.
		const idx = configuredHats.indexOf(last.hat)
		if (idx < 0) return null // open hat not in configured set — drift
		return {
			hat: last.hat,
			terminal: idx === configuredHats.length - 1,
		}
	}
	// `advance` is the unit-iteration mid-chain/terminal vocab written
	// by `haiku_unit_advance_hat`. `advanced` is the FB-iteration
	// mid-chain vocab written by `haiku_feedback_advance_hat` (terminal
	// FB hat writes `closed` and is handled by the null branch below).
	// Both mean the same thing for cursor walking: "this hat finished
	// successfully, dispatch the next one." Reported 2026-05-13 on
	// `admin-portal-reimagine` design: 23 agent-authored FBs stuck at
	// `addressed` because `nextHatForUnit` only matched the unit form,
	// returned null on every mid-chain FB iteration, and the cursor
	// stopped re-dispatching the fix-hat sequence.
	if (last.result === "advance" || last.result === "advanced") {
		const idx = configuredHats.indexOf(last.hat)
		if (idx < 0) return null // last hat name not in configured set — drift
		const nextIdx = idx + 1
		if (nextIdx >= configuredHats.length) {
			// Terminal advance landed. Unit's hat sequence is done.
			return null
		}
		return {
			hat: configuredHats[nextIdx],
			terminal: nextIdx === configuredHats.length - 1,
		}
	}
	// `reject` is the unit-iteration vocab written by
	// `haiku_unit_reject_hat`. `rejected` is the FB vocab written by
	// `haiku_feedback_reject_hat`. Both mean the same thing: this hat
	// was rejected, re-dispatch the prior hat on a new bolt.
	// Pre-2026-05-13 only `reject` was matched, so FB rejections fell
	// through to `null` and the cursor returned noop after every
	// `feedback-assessor` rejection — the exact failure mode reported
	// in image 4 of the kagami-slice-1-sendgrid-mirror screenshots.
	if (last.result === "reject" || last.result === "rejected") {
		const idx = configuredHats.indexOf(last.hat)
		if (idx <= 0) {
			// Reject on first hat — re-dispatch first hat.
			return {
				hat: configuredHats[0],
				terminal: configuredHats.length === 1,
				rejected: true,
			}
		}
		const prevIdx = idx - 1
		return {
			hat: configuredHats[prevIdx],
			terminal: prevIdx === configuredHats.length - 1,
			rejected: true,
		}
	}
	return null
}

/**
 * Returns the role keys that have NOT been signed yet on the unit.
 */
export function pendingReviewSlots(
	fm: UnitFm,
	configuredRoles: string[],
): string[] {
	const reviews = pickReviews(fm)
	return configuredRoles.filter((r) => !reviews[r])
}

export function pendingApprovalSlots(
	fm: UnitFm,
	configuredRoles: string[],
): string[] {
	const approvals = pickApprovals(fm)
	return configuredRoles.filter((r) => !approvals[r])
}

// activeStageFromBranchOrFilesystem and currentBranchName deleted
// 2026-05-10. Cursor position is filesystem-only, never git topology.
// Callers walk files via `findCurrentStage` regardless of which
// branch they happen to be on — the pre-tick keeps every stage branch
// fast-forwarded to intent main, so unit files for past stages exist
// on disk under every active branch, and the FM walk lands on the
// same answer from anywhere.

// ── Per-unit / per-stage completion predicates ───────────────────────
//
// Each predicate is a small, named yes/no question over disk state.
// `findCurrentStage` composes them as `first stage where !isStageComplete`.
// The names read like English at the call sites: "is this unit complete?",
// "are this stage's units complete?", "is this stage complete?".
//
// "Complete" means "no further cursor work needed at this position."
// The runtime ensures the working tree reflects the latest state by
// merging intent main into the active stage branch before the walk —
// see `haiku_run_next`'s pre-tick branch alignment. The walk just reads
// whatever disk it's given.

function approvalRolesFor(
	studio: string,
	stage: string,
	mode: string,
): string[] {
	const reviewAgents = Object.keys(readReviewAgentPaths(studio, stage)).sort()
	// `isUnitComplete` / `findCurrentStage` use this list to decide
	// whether a unit is past. Engine-built `continuity` and
	// `cross-stage-consistency` are NOT included here — they're
	// auto-managed by the cursor's per-tick dispatch loop and not
	// load-bearing for the "is this unit eligible to be considered
	// done" check. Including them here would make every unit "incomplete"
	// until the cursor stamps the auto-managed roles, which is what the
	// dispatch loop does — circular. Keep this list narrow.
	return mode === "autopilot"
		? ["spec", "quality_gates"]
		: ["spec", "quality_gates", ...reviewAgents, "user"]
}

function hasStarted(fm: UnitFm): boolean {
	return (
		typeof fm.started_at === "string" && (fm.started_at as string).length > 0
	)
}

function isUnitFullyApproved(fm: UnitFm, approvalRoles: string[]): boolean {
	const approvals = pickApprovals(fm)
	for (const role of approvalRoles) {
		// Truthy presence is the signal — same shape that walkIntentTrack
		// step 9's `!approvals[role]` check accepts. The two sides MUST
		// agree on what counts as "approved" or `findCurrentStage` pins
		// on a stage that walkIntentTrack thinks is already past, and
		// the cursor loops on merge_stage. Production stamps are
		// `{at: <timestamp>, ...}` (object with `.at`); post-migration
		// backfill stamps can be bare booleans or `{}`. All three shapes
		// are truthy — we accept all three. The filesystem (FM) is the
		// signal; the SHAPE of the stamp is not. Reported 2026-05-12 on
		// admin-portal-reimagine: pre-fix `.at`-strict check disagreed
		// with step 9's truthy check, producing the merge_stage loop.
		if (!approvals[role]) return false
	}
	return true
}

/**
 * Is this unit past (no longer needing cursor work)?
 *
 * The strongest signal of completion is "every required approval role
 * is stamped." If the user, spec reviewer, quality gates, and every
 * configured review-agent have all signed, the unit is done — full
 * stop. The cursor MUST walk past it regardless of iteration shape.
 *
 * Iteration state is a fallback signal when approvals aren't yet all
 * stamped (mid-flight) and a separate diagnostic for v3-migrated
 * placeholders that have no iteration history at all.
 *
 * A unit is PAST when ANY of:
 *   (a) Every required approval role on `approvals.<role>.at` is
 *       stamped. This trumps everything: a malformed iteration
 *       (missing `result`, wrong hat ordering, etc.) on an otherwise
 *       fully-approved unit is a data inconsistency from migration or
 *       manual edit — the approval stamps are the user's explicit
 *       sign-off and the cursor MUST respect them. This catches the
 *       v3→v4 migration bug where `backfillCompletedUnitStamps`
 *       stamps approvals on units whose v3 iterations left a hat
 *       without a `result:` field; without this branch the cursor
 *       loops on `merge_stage` forever (the unit looks neither
 *       mid-flight nor done).
 *   (b) `started_at` set + no iterations — v3-migrated /
 *       merged-from-elsewhere placeholder. The migrator dropped
 *       per-unit history; file presence with `started_at` is the
 *       proof this stage's work happened.
 *
 * The canonical healthy shape (iterations end in terminal advance on
 * the last hat AND every approval role stamped) lands on branch (a) —
 * the all-approvals check is what makes it complete; the iteration
 * advance is the route most healthy units take to reach that state.
 *
 * Otherwise the unit is CURRENT (pins the cursor):
 *   - `started_at` null → wave-ready, OR
 *   - Iterations exist but not terminal-advance → mid-flight, OR
 *   - Terminal-advance but missing approvals → review/approval phase.
 *
 * **Known blindspot on path (b)**: `haiku_unit_start` stamps
 * `started_at` BEFORE the subagent emits its first iteration. If a
 * subagent crashes between `haiku_unit_start` and the first hat's
 * iteration write, the unit lands in the same FM shape as a v3-migrated
 * placeholder (`started_at` set, no iterations) and this check walks
 * past it. Recovery path for that case is `safe_intent_repair`, which
 * can detect a stranded started-at-without-iterations unit and reset
 * it. The old file-existence walk had the same blindspot; the new
 * check makes the assumption explicit.
 */
function isUnitComplete(fm: UnitFm, approvalRoles: string[]): boolean {
	// (a) Strongest signal: every approval role is stamped. Trusts the
	// user's / engine's explicit sign-off over iteration consistency.
	if (isUnitFullyApproved(fm, approvalRoles)) return true
	const started = hasStarted(fm)
	const its = pickIterations(fm)
	// (b) v3-migrated / merged-from-elsewhere placeholder.
	//
	// Task #28 narrowing (2026-05-13): a unit with `started_at` set and
	// empty iterations is treated as a v3-migrated placeholder ONLY when
	// it does NOT declare non-empty `outputs:`. A unit declaring outputs
	// is a build-class unit with an explicit output contract — if its
	// iterations are empty, the per-unit builder hats never ran and the
	// unit is unbuilt, not migrated. Reported 2026-05-13: 9 simultaneous
	// `unit_outputs_empty` FBs because units 03-11 on a stage had empty
	// `iterations[]` and the cursor walked past the stage as complete.
	// Without this narrowing the cursor advances into spec review and
	// the review-track files findings against empty artifacts.
	if (started && its.length === 0) {
		const outs = Array.isArray(fm.outputs) ? (fm.outputs as unknown[]) : []
		if (outs.length === 0) return true
		// outputs declared + iterations empty → unbuilt; pin cursor here.
		return false
	}
	// Everything else is CURRENT — the cursor pins on this unit:
	//   - `!started` → wave-ready (decompose wrote the spec, wave hasn't fired)
	//   - mid-flight iterations (last result null, or last hat != terminal)
	//   - terminal-advance but approvals incomplete (the review/approval
	//     window; branch (a) catches it once stamps land)
	return false
}

/**
 * Are every unit in this stage complete? "Complete" per `isUnitComplete`.
 * Returns false when no units exist (the stage hasn't been decomposed yet
 * — the cursor pins so `decompose` / `elaborate` can fire).
 */
function areStageUnitsComplete(
	intentDir: string,
	studio: string,
	stage: string,
	mode: string,
): boolean {
	const unitsDir = join(intentDir, "stages", stage, "units")
	if (!existsSync(unitsDir)) return false
	const unitFiles = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
	if (unitFiles.length === 0) return false

	const hats = resolveStageHats(studio, stage)
	// No hats configured = stage definition broken or unloaded. Conservative
	// answer: not complete (don't walk past). Catches the misconfigured-
	// stage class of bug early.
	if (hats.length === 0) return false
	const approvalRoles = approvalRolesFor(studio, stage, mode)

	for (const file of unitFiles) {
		const fm = readFm(join(unitsDir, file))?.data
		if (!fm) return false
		if (!isUnitComplete(fm, approvalRoles)) return false
	}
	return true
}

/**
 * Is this stage complete? Currently equivalent to "all units complete";
 * elaboration / discovery / merge state are handled by the per-stage
 * walk (`walkIntentTrack`), not by the active-stage selector.
 */
export function isStageComplete(
	intentDir: string,
	studio: string,
	stage: string,
	mode: string,
): boolean {
	return areStageUnitsComplete(intentDir, studio, stage, mode)
}

/**
 * Find the stage the cursor is currently positioned in — the first
 * stage that isn't complete on disk.
 *
 * **The signal is per-unit FM, not file existence and not git
 * topology.** For each stage in order, ask `isStageComplete`. The first
 * stage where the answer is "no" is the current one.
 *
 * Why FM and not file existence: a stage's unit files can be present
 * on disk for two distinct reasons —
 *   (a) the stage was previously fully signed and merged into intent
 *       main, bringing the signed unit files with it; OR
 *   (b) feedback / drift / a corrective bolt added new units to a
 *       stage that was previously "done"; the new units exist but
 *       their FM is unsigned.
 * File-existence alone treats (a) and (b) identically and walks past
 * the rewound stage. FM distinguishes them.
 *
 * **Branch-agnostic**: this returns the same answer from any branch
 * because the pre-tick fast-forwards every active stage branch with
 * intent main, so units from past stages are present on disk under
 * every checkout. The walk's signal is per-unit FM, never the branch
 * name. Same semantics in filesystem-only (non-git) mode — there are
 * no branches, so "the tree" IS the working tree.
 *
 * Open feedback and drift events don't enter into this walk — they're
 * handled by Track B and Track C in `derivePosition`, which preempt
 * Track A. A previously-signed stage with an open FB still gets
 * rewound through that path. See gigsmart/haiku-method#333.
 *
 * **Path resolution**: callers should pass `intentDir` (the same value
 * the rest of the engine uses, resolved via `findHaikuRoot()`). When
 * omitted, the fallback walks up from `process.cwd()` via
 * `findHaikuRoot()`. The function used to re-resolve via
 * `primaryRepoRoot()`, which returns the *primary* worktree path even
 * inside a linked worktree where `.haiku/` lives in the linked tree.
 * In that setup the re-resolved path didn't exist, every per-stage
 * `isStageComplete` answered "false", and the walk pinned on the first
 * stage forever — see admin-portal-reimagine merge_stage loop
 * (2026-05-12).
 */
export function findCurrentStage(
	slug: string,
	studio: string,
	intentDir?: string,
): string | null {
	const resolvedIntentDir = intentDir ?? join(findHaikuRoot(), "intents", slug)

	const intentMdPath = join(resolvedIntentDir, "intent.md")
	const intentFm = readFm(intentMdPath)?.data ?? {}
	// Use the intent's effective stage list — intersection of studio
	// stages with `intent.stages` (if set) minus `intent.skip_stages`.
	// Walking the full studio list would surface stages the intent
	// explicitly opted out of (e.g. a `/haiku:haiku-quick` intent that
	// declared only [inception, design, product] in a 6-stage software
	// studio would otherwise loop trying to elaborate `development`).
	const stages = resolveIntentStages(intentFm, studio)
	if (stages.length === 0) return null
	const mode =
		typeof intentFm?.mode === "string" && (intentFm.mode as string).length > 0
			? (intentFm.mode as string)
			: "continuous"
	for (const stage of stages) {
		if (!isStageComplete(resolvedIntentDir, studio, stage, mode)) return stage
	}
	return null
}

// ── Track B: feedback walk ───────────────────────────────────────────

function walkFeedbackTrack(args: {
	intentDir: string
	studio: string
	currentStage: string
	intent: Record<string, unknown>
}): CursorAction | null {
	const { intentDir, studio, currentStage, intent } = args
	// Walk feedback in stage order: every prior stage's open FBs come
	// before the current stage's open FBs come before intent-scope.
	// Use intent-effective stages so an intent scoped to a subset of the
	// studio's stages (e.g. `/haiku:haiku-quick` restricting to 3 stages in a
	// 6-stage studio) doesn't surface FBs from stages the intent opted
	// out of.
	const stages = resolveIntentStages(intent, studio)
	const cutoff = stages.indexOf(currentStage)
	// `cutoff === -1` means `currentStage` isn't in this studio's
	// configured stage list (renamed stage, misconfigured studio).
	// Falling back to `stages.slice()` (all stages) would surface FBs
	// from future stages the agent isn't even working on yet — the
	// opposite of what "walk up to current" means. Walk no stages
	// when we can't locate the current one; the caller can still see
	// intent-scope FBs below.
	const toWalk = cutoff >= 0 ? stages.slice(0, cutoff + 1) : []

	// Collect EVERY open FB whose next action is a fix-hat dispatch,
	// then batch them into a single `start_feedback_hat` carrying N
	// heterogeneous dispatches. Non-dispatch actions (close_feedback,
	// feedback_question, user_gate) preempt as singletons — they're
	// terminal cursor moves that need their own tick to fully resolve
	// before the next batch.
	type FbDispatch = {
		feedback_id: string
		stage: string
		hat: string
		terminal: boolean
		target_unit: string | null
	}
	const dispatches: FbDispatch[] = []

	const collect = (stage: string, fbPath: string): CursorAction | null => {
		const action = nextActionForFeedback(stage, fbPath, studio)
		if (!action) return null
		if (action.kind !== "start_feedback_hat") {
			// Non-dispatch action — return immediately, can't be batched.
			return action
		}
		// Pull the single FB ID out of the action's dispatches array
		// (nextActionForFeedback always returns a single-entry array).
		// Also need the target_unit to enforce the per-unit dedup at
		// batch-flush time.
		const entry = action.dispatches[0]
		if (!entry) return null
		const fm = readFm(fbPath)?.data ?? {}
		const targets = (fm.targets as Record<string, unknown> | undefined) ?? {}
		const targetUnit =
			typeof targets.unit === "string" && targets.unit.length > 0
				? targets.unit
				: null
		dispatches.push({ ...entry, target_unit: targetUnit })
		return null
	}

	for (const stage of toWalk) {
		const fbPaths = listFbPaths(join(intentDir, "stages", stage))
		for (const fbPath of fbPaths) {
			const preempt = collect(stage, fbPath)
			if (preempt) return preempt
		}
	}
	const intentFbPaths = listFbPaths(intentDir)
	for (const fbPath of intentFbPaths) {
		// Intent-scope FBs (originating from intent_review / studio-level
		// reviewers like cross-stage-consistency) route through the
		// studio's `fix_hats:` chain, NOT the current stage's. Pre-2026-
		// 05-19 the cursor passed `currentStage` here, which made the
		// classifier subagent read `{stage: currentStage, feedback_id: N}`
		// — but the FB lives at intent scope, so the read returned
		// not-found and the subagent terminated without closure → infinite
		// re-dispatch loop. Pass empty stage so `nextActionForFeedback`
		// resolves studio fix-hats and the prompt builder's
		// `if (d.stage)` gate uses the intent-scope code paths.
		const preempt = collect("", fbPath)
		if (preempt) return preempt
	}

	if (dispatches.length === 0) return null

	// Dedup by target_unit. At most one FB per unit per batch — closure
	// of two FBs on the same unit races on the FM write inside
	// `applyFeedbackInvalidations` (the close hook's read-modify-write
	// is not atomic across concurrent subagents). Same-target duplicates
	// stay in the queue; the next tick dispatches them in a fresh batch
	// after the prior batch's writes have settled.
	//
	// `null` target_unit means intent-scope or stage-scope-with-no-unit:
	// no per-unit FM write, no race. All such FBs can batch together.
	//
	// Dedup by feedback_id FIRST (fixloop-bug-f4dd5a92 Bug 3). Two
	// dispatch entries for the SAME FB-NN must never both fire — they'd
	// spawn two subagents racing on one feedback body's read-modify-
	// write. This happens when two files in a feedback dir share the
	// same numeric prefix (a numbering collision from create/move), so
	// `nextActionForFeedback` derives the same `FB-NN` for both. The
	// target_unit dedup below does NOT catch this when both are
	// intent-scope (target_unit === null), so a same-id pair slipped
	// through as the duplicate FB-001 dispatch in the bug report.
	const seenUnits = new Set<string>()
	const seenFbIds = new Set<string>()
	const batch: FbDispatch[] = []
	for (const d of dispatches) {
		if (seenFbIds.has(d.feedback_id)) continue // never double-dispatch one FB
		seenFbIds.add(d.feedback_id)
		if (d.target_unit !== null) {
			if (seenUnits.has(d.target_unit)) continue // serialize same-target
			seenUnits.add(d.target_unit)
		}
		batch.push(d)
	}

	// Final defensive re-check against the on-disk state, mirroring the
	// prompt builder's filter in `start_feedback_hat/index.ts` so the
	// action JSON and the agent-facing prompt agree about which FBs are
	// being dispatched. Without this, a closed FB's dispatch entry can
	// survive into the action JSON (e.g. the FB lives at intent scope
	// but `d.stage` was assigned the current stage) while the prompt
	// builder reads the matching stage-scope file and drops it, leaving
	// the agent staring at "no FBs, retick" forever. Reported
	// 2026-05-19 (haiku-bug-report-2026-05-19: stuck loop on closed
	// FB-001 after uncommitted closure metadata + pre-cursor-sync
	// conflict). Reading the FB file by both the dispatch's declared
	// stage AND the intent-scope path so we catch the mismatched-scope
	// case too.
	const verifiedBatch: FbDispatch[] = []
	for (const d of batch) {
		const fbInt = Number.parseInt(d.feedback_id.replace(/^FB-/i, ""), 10)
		const candidateDirs: string[] = []
		if (d.stage) {
			candidateDirs.push(join(intentDir, "stages", d.stage, "feedback"))
		}
		candidateDirs.push(join(intentDir, "feedback"))
		let stillOpen = true
		for (const dir of candidateDirs) {
			if (!existsSync(dir)) continue
			// Match the FB id EXACTLY by its leading integer — `startsWith`
			// on the zero-padded prefix (e.g. "001") also matched "0010-…",
			// and reading only `matches[0]` made the decision depend on
			// readdir order. When a reused/duplicated id leaves two files
			// for the same FB (one open, one closed — the title/body-mismatch
			// state in the 2026-05-20 livelock report), `matches[0]` flapped:
			// some ticks read the closed copy (skip) and some read the open
			// copy (dispatch a CLOSED FB forever). Check EVERY file with this
			// id and treat the FB as terminal if ANY is terminal — a closed
			// FB-NN means NN is done, full stop, regardless of a stray
			// duplicate. Order-independent and correct.
			const matches = readdirSync(dir).filter((f) => {
				if (!f.endsWith(".md")) return false
				const m = /^(\d+)/.exec(f)
				return m != null && Number.parseInt(m[1], 10) === fbInt
			})
			let anyTerminal = false
			for (const f of matches) {
				const fbFm = readFm(join(dir, f))?.data
				if (fbFm && isFbTerminal(fbFm)) {
					anyTerminal = true
					break
				}
			}
			if (anyTerminal) {
				stillOpen = false
				break
			}
		}
		if (stillOpen) verifiedBatch.push(d)
	}
	if (verifiedBatch.length === 0) return null

	const first = verifiedBatch[0]
	return {
		kind: "start_feedback_hat",
		dispatches: verifiedBatch.map((d) => ({
			feedback_id: d.feedback_id,
			stage: d.stage,
			hat: d.hat,
			terminal: d.terminal,
		})),
		// Legacy shadow fields — see CursorAction union docs. Mirror
		// `dispatches[0]` so callers that only read top-level
		// (`action.stage`, `action.hat`, etc.) see the first FB.
		// Heterogeneous batches MUST read `dispatches[]` to act on more
		// than the first entry.
		stage: first?.stage ?? "",
		hat: first?.hat ?? "",
		feedback_ids: verifiedBatch.map((d) => d.feedback_id),
		terminal: first?.terminal ?? false,
	}
}

function nextActionForFeedback(
	stage: string,
	fbPath: string,
	studio: string,
): CursorAction | null {
	const result = readFm(fbPath)
	if (!result) return null
	const fm = result.data
	if (isFbTerminal(fm)) {
		// Terminal (closed OR rejected) — skip. See `isFbTerminal` for
		// the multi-signal terminal-state detection. Covers two
		// 2026-05-18 regression classes: (1) unquoted-ISO `closed_at`
		// parsed as Date that fell through a typeof check, and (2)
		// manually-rejected FBs where both `advance_hat` and
		// `reject_hat` return `lifecycle_violation` so the cursor sees
		// no on-disk progress and re-dispatches forever.
		return null
	}
	const fbId = parseFbIdFromFilename(fbPath)
	if (!fbId) {
		// Filename doesn't follow the `NN(N)-slug.md` convention.
		// Skip rather than emit an unresolvable dispatch ID — see
		// parseFbIdFromFilename's docstring for why this matters.
		return null
	}
	// `resolution: "question"` preempts the fix-hat chain. Question
	// FBs are user-decidable forks the agent can't resolve via a fix
	// loop; the cursor surfaces them as `feedback_question` so the
	// main agent answers them inline rather than dispatching fix-hat
	// subagents against a body that's a question, not a finding.
	// Discovery subagents are the canonical source of these FBs (see
	// prompts/discovery_required.ts), but any code path may file one.
	if ((fm.resolution as string) === "question") {
		return {
			kind: "feedback_question",
			stage,
			feedback_id: fbId,
			feedback_path: fbPath,
		}
	}
	// Bolt-cap escalation guard. Each iteration carries a `bolt` number;
	// one bolt = one full pass through the stage's `fix_hats` chain. When
	// the FB has consumed its full MAX_FIX_LOOP_BOLTS budget without
	// closure, stop dispatching new bolts so the loop can't run forever.
	// The FB's derived status flips to "escalated" via the same signal in
	// `readFeedbackFiles`; the SPA surfaces these so a human can intervene.
	// Human-authored FBs are exempt — humans expect to drive their own
	// resolution, not be told "the agent gave up."
	const isAgentAuthored =
		(fm.author_type as string) === "agent" ||
		(fm.author_type as string) === "system"
	if (isAgentAuthored) {
		const iters = pickIterations(fm)
		const distinctBolts = new Set<number>()
		for (const it of iters) {
			const b = (it as unknown as { bolt?: number }).bolt
			if (typeof b === "number" && b > 0) distinctBolts.add(b)
		}
		if (distinctBolts.size >= MAX_FIX_LOOP_BOLTS) {
			// Cap reached — do not dispatch another bolt. The cursor walk
			// continues; later FBs may still be dispatchable.
			return null
		}
		// Stuck-reject escalation (2026-05-18 reported as
		// haiku-fix-loop-bug: FB-111 in admin-portal-reimagine/design).
		// When the reject chain bubbles to the first hat in fix_hats,
		// `nextHatForUnit` re-dispatches the same first hat (idx=0
		// branch — there's no prior hat to fall back to). Same input,
		// same answer → same reject → infinite loop. The bolt counter
		// increments slowly because the engine assigns a new bolt only
		// on advance, not on every reject-then-redispatch, so the
		// MAX_FIX_LOOP_BOLTS cap takes a long time to fire (the bug
		// report shows bolts 3 and 4 still dispatching).
		//
		// Treat ≥2 immediately-consecutive `rejected` iterations on the
		// SAME hat as terminal-stuck and refuse further dispatch. The FB
		// stays open; the SPA flags it as escalated (same surface as the
		// bolt-cap path); a human breaks the tie. Cosmetic drift FBs
		// that the classifier can't validly classify drop out of the
		// queue immediately instead of burning through three bolts.
		if (iters.length >= 2) {
			const last = iters[iters.length - 1]
			const prev = iters[iters.length - 2]
			const lastRejected =
				last.result === "reject" || last.result === "rejected"
			const prevRejected =
				prev.result === "reject" || prev.result === "rejected"
			if (lastRejected && prevRejected && last.hat === prev.hat) {
				return null
			}
		}
	}
	// Stage-scope FBs use the stage's `fix_hats:` chain. Intent-scope
	// FBs (stage === "") use the studio-level `fix_hats:` chain from
	// `STUDIO.md` frontmatter (or the alphabetical fallback over
	// `studios/<studio>/fix-hats/`). Reported 2026-05-19: cross-stage-
	// consistency intent-completion reviewer files FBs at intent scope;
	// pre-fix the cursor was attributing them to the current stage's
	// fix-hat chain, causing the dispatched classifier subagent to read
	// the FB at stage-scope (where it doesn't exist) and bail without
	// closure, looping forever.
	const fixHats =
		stage === ""
			? resolveStudioFixHats(studio)
			: resolveStageFixHats(studio, stage)
	if (fixHats.length === 0) {
		// No fix-hat chain defined for this scope. The FB is unresolvable
		// without manual intervention. Cursor surfaces it as a
		// review-track signal so the user sees it.
		return {
			kind: "user_gate",
			stage,
			gate_kind: "approval",
			units: [], // FB-only, no unit slots
		}
	}
	const next = nextHatForUnit(fm, fixHats)
	if (next === null) {
		// Either in-flight (no action) or terminal advance landed
		// (close FB with invalidations).
		//
		// FB iterations use a different result vocabulary than unit
		// iterations: `haiku_feedback_advance_hat` writes
		// `result: "advanced"` for mid-chain hats and `result: "closed"`
		// for the terminal hat. Unit-style `result: "advance"` is never
		// written for FBs. Match both forms here so the cursor's
		// terminal-fb detection actually fires:
		//   - `closed`: written by advance_hat on the last fix-hat call
		//     (the canonical terminal signal — matches the
		//     `status: "closed"` write at the same point)
		//   - `advance`: kept for back-compat with any legacy FBs whose
		//     iterations were written before the vocabulary split
		//
		// Pre-2026-05-12: this branch only matched `"advance"` →
		// close_feedback never fired in practice → the close_feedback
		// handler's invalidations (clearing target unit approvals on
		// FB closure) never ran. The FB-as-unit fix loop's load-bearing
		// invalidation contract was silently broken. See
		// V4-ALIGNMENT-AUDIT.md Invariant 2.
		const iterations = pickIterations(fm)
		if (iterations.length === 0) return null
		const last = iterations[iterations.length - 1]
		if (last.result === null) return null // in-flight
		const terminalAdvance =
			(last.result === "closed" || last.result === "advance") &&
			last.hat === fixHats[fixHats.length - 1]
		if (terminalAdvance) {
			return { kind: "close_feedback", stage, feedback_id: fbId }
		}
		return null
	}
	return {
		kind: "start_feedback_hat",
		// Single-FB candidate from `nextActionForFeedback`. The caller
		// (`walkFeedbackTrack`) collects these across every open FB, dedups
		// by target_unit, and emits the final multi-FB batch action. We
		// still return the structured shape so the caller can read
		// (stage, hat, terminal) without re-deriving them.
		dispatches: [
			{
				feedback_id: fbId,
				stage,
				hat: next.hat,
				terminal: next.terminal,
			},
		],
		// Legacy shadow fields — see CursorAction union docs.
		stage,
		hat: next.hat,
		feedback_ids: [fbId],
		terminal: next.terminal,
	}
}

/**
 * Extract the canonical wire-form FB id (`FB-NNN`) from an on-disk
 * filename like `008-some-slug.md`. Returns null when the filename
 * doesn't start with the expected `<digits>-` prefix — a non-numeric
 * fallback (raw basename) would propagate into `start_feedback_hat`
 * actions whose `feedback_id` then fails `findFeedbackFile`'s
 * `^(?:FB-)?(\d+)$` regex, producing `feedback_not_found` errors
 * every tick → cursor re-emits → infinite loop.
 *
 * Width-flexible: 2-digit (`08-…`) and 3-digit (`008-…`) names both
 * resolve, since the regex is `\d+` not `\d{N}`. Padding to 3 digits
 * is the v4 default (numeric-id refactor 2026-05-07).
 */
function parseFbIdFromFilename(fbPath: string): string | null {
	const m = basename(fbPath).match(/^(\d+)-/)
	if (!m) return null
	return `FB-${m[1].padStart(3, "0")}`
}

// ── Track A: intent walk ─────────────────────────────────────────────

function walkIntentTrack(args: {
	slug: string
	intentDir: string
	studio: string
	stage: string
	mode: string
}): CursorAction | null {
	const { slug, intentDir, studio, stage, mode } = args
	const stageDir = join(intentDir, "stages", stage)
	const unitPaths = listUnitPaths(stageDir)
	const units = unitPaths
		.map((p) => ({ path: p, name: unitName(p), fm: readFm(p)?.data ?? {} }))
		.filter((u) => u.fm)

	const hats = resolveStageHats(studio, stage)
	const reviewAgentPaths = readReviewAgentPaths(studio, stage)
	const reviewAgents = Object.keys(reviewAgentPaths).sort()
	// Order of reviewer roles per track. Spec is engine-built (always
	// present). quality_gates is engine-built (post-execute only).
	// Configured agents come from the studio. User is the human gate.
	//
	// Mode-shaped role lists:
	//   - autopilot: minimal — spec only on reviews, [spec, quality_gates]
	//                on approvals. No agent gates, no user gate.
	//   - discrete + continuous: full role lists. Discrete differs only
	//                in HOW the user gate dispatches (MR open vs internal
	//                pop) — handled at dispatch time, not in the role list.
	// Stage-level walks. The two phases are now properly distinct:
	//
	// • reviewRoles  → PRE-execute. Audits the SPEC before any code
	//   lands. Fires between elaborate_loop completion and wave-ready
	//   hat dispatch. Per-unit `reviews.<role>` stamps. Engine-built-in
	//   roles render mandate bodies from
	//   `prompts/stage/review/dispatch_review/engine-bodies/<role>.eta.md`.
	//
	// • approvalRoles → POST-execute. Audits the WORK after every
	//   unit's hat chain completes. Per-unit `approvals.<role>` stamps.
	//   Engine-built-in roles render mandate bodies from
	//   `prompts/stage/approve/dispatch_approval/engine-bodies/<role>.eta.md`.
	//
	// Engine-built-in roles (spec, continuity, cross-stage-consistency)
	// fire in BOTH lists. The same check has cheap pre-execute prose
	// (catch the planning failure before code lands) and a real
	// post-execute prose (verify the built work matches the spec). The
	// per-phase mandate bodies live in different sibling dirs.
	//
	// Order within each list: engine roles first (cheap, mechanical
	// sequential gates), then configured agents (parallel-shaped wave
	// via per-role serial dispatch today), then user. quality_gates is
	// post-execute-only — there's nothing to run pre-execute against.
	const { reviewRoles, approvalRoles } = stageRoleLists(
		studio,
		stage,
		mode,
		reviewAgents,
	)

	// Elaborate loop — single cursor state, multi-signal payload.
	//
	// Per GOALS.md (collapsed 2026-05-14, GAPS § 1a → Option A), the
	// per-stage elaborate phase emits a single `elaborate_loop` action
	// whose `signals_unmet[]` lists every currently-unmet completion
	// signal. The agent may make progress on any subset in one tick.
	//
	// Computation lives in `computeElaborateSignals` so the HTTP API's
	// `getCurrentState` can surface the same signal list to the SPA
	// without duplicating the on-disk derivation.
	const signalsUnmet = computeElaborateSignals({
		slug,
		studio,
		stage,
		stageDir,
		unitNames: units.map((u) => u.name),
		mode,
	})

	if (signalsUnmet.length > 0) {
		return { kind: "elaborate_loop", stage, signals_unmet: signalsUnmet }
	}

	// Pre-review structural-validation gate: `unit_inputs_not_declared`.
	// Non-first stages whose units lack an `inputs:` field entirely fail
	// fast BEFORE the pre-execute review track. Reviewing a spec that
	// can't even be dispatched would burn subagent budget on findings
	// the agent can't act on (the spec ships invalid; reviewers would
	// flag it; the fix is just adding the field, which the structural
	// gate already names). Pre-2026-05-18 this check lived inside the
	// wave-ready dispatch path; the pre/post review split moved
	// `dispatch_review` ahead of wave-ready, so the structural check
	// also has to move forward to keep the same ordering relative to
	// review work. First-stage exemption: nothing upstream to draw
	// inputs from.
	{
		const intentStages = resolveIntentStages(
			readFm(join(intentDir, "intent.md"))?.data ?? {},
			studio,
		)
		const isFirstStage =
			intentStages.length > 0 && intentStages[0] === stage
		if (!isFirstStage) {
			const missingInputs = units
				.filter((u) => !("inputs" in u.fm))
				.map((u) => u.name)
			if (missingInputs.length > 0) {
				return {
					kind: "unit_inputs_not_declared",
					stage,
					units: missingInputs,
				}
			}
		}
	}

	// Every elaborate-loop signal is met → pre-execute review track.
	// Walks reviewRoles per-unit, stamping `reviews.<role>` as each
	// fires. Engine-built-in roles (spec/continuity/cross-stage-
	// consistency) fire first as cheap sequential gates against the
	// unit specs; configured agents follow; user gate (`gate_kind:
	// "spec"`) gates the pre-execute phase. Only when every
	// reviewRoles role is signed does the cursor advance to wave-ready
	// hat dispatch (execute).
	//
	// Why pre-execute: catching a misaligned spec before code lands is
	// vastly cheaper than catching it post-execute. The post-execute
	// `dispatch_approval` walk fires the same engine roles AGAINST THE
	// WORK (different mandate prose, different sibling dir) for the
	// final sign-off before complete_stage.
	for (const role of reviewRoles) {
		const missing = units
			.filter((u) => {
				const reviews = pickReviews(u.fm)
				return !reviews[role]
			})
			.map((u) => u.name)
		if (missing.length === 0) continue
		if (role === "user") {
			return { kind: "user_gate", stage, gate_kind: "spec", units: missing }
		}
		return { kind: "dispatch_review", stage, role, units: missing }
	}

	// 5. Wave logic removed 2026-05-13.
	//
	// The previous version of this clause short-circuited the whole
	// stage walk to `null` whenever ANY unit had an open iteration
	// (last.result === null). That made sense if the parent polled
	// run_next while subagents were running, but the actual contract
	// is the opposite: the parent batches subagent dispatches in
	// parallel, waits for ALL to return, then calls run_next exactly
	// once. At that moment no subagent is actively running, and an
	// open iter is either engine-pre-opened (mid-chain advance_hat
	// closed the prior hat and opened the next) OR orphaned (subagent
	// crashed). Both should re-emit dispatch — exactly what
	// `nextHatForUnit` now returns for `last.result === null`.
	//
	// Reported 2026-05-13 (images 1 & 2 of the
	// kagami-slice-1-sendgrid-mirror screenshots): "engine commits
	// the advance but doesn't auto-dispatch the next hat — manual
	// dispatch is needed." Every wave was a coin flip on whether the
	// agent had to bypass the engine to keep moving.
	//
	// Wave-ready (next clause) still serves its purpose: only units
	// with `started_at == null` AND all `depends_on` completed are
	// candidates for the first hat of the current wave.

	// 6. Wave-ready: started_at == null and all depends_on completed
	//    (their last iteration is terminal advance).
	const completedNames = new Set(
		units
			.filter((u) => {
				if (hats.length === 0) return false
				const its = pickIterations(u.fm)
				if (its.length === 0) return false
				const last = its[its.length - 1]
				return last.result === "advance" && last.hat === hats[hats.length - 1]
			})
			.map((u) => u.name),
	)
	const waveReady = units.filter((u) => {
		if (u.fm.started_at != null) return false
		const deps = Array.isArray(u.fm.depends_on)
			? (u.fm.depends_on as string[])
			: []
		return deps.every((d) => completedNames.has(d))
	})

	// Task #25 pre-dispatch gate: refuse to fire `start_unit_hat` when
	// any wave-ready unit's FM lacks an `inputs:` field entirely on a
	// non-first stage. Empty `inputs: []` is a deliberate "no inputs"
	// declaration and passes (the existing on-disk `unit_inputs_missing`
	// gate in `haiku_unit_start` covers the case where declared paths
	// don't exist). A missing field is structural drift — `haiku_repair`
	// would flag it with `"Unit has no inputs: — execution will be
	// blocked"`, and the user's principle is that repair should never be
	// the normal recovery path. Surface the structured action so the
	// agent fixes the spec via `haiku_unit_set { field: "inputs", ... }`
	// before re-ticking.
	//
	// First-stage exemption: the first stage of an intent has nothing
	// upstream to draw `inputs:` from. The contract only applies to
	// stages that consume prior-stage artifacts.
	const intentStages = resolveIntentStages(
		readFm(join(intentDir, "intent.md"))?.data ?? {},
		studio,
	)
	const isFirstStage = intentStages.length > 0 && intentStages[0] === stage
	if (!isFirstStage && waveReady.length > 0) {
		const missingInputs = waveReady
			.filter((u) => !("inputs" in u.fm))
			.map((u) => u.name)
		if (missingInputs.length > 0) {
			return {
				kind: "unit_inputs_not_declared",
				stage,
				units: missingInputs,
			}
		}
	}

	if (waveReady.length > 0) {
		return {
			kind: "start_unit_hat",
			stage,
			hat: hats[0],
			units: waveReady.map((u) => u.name),
			terminal: hats.length === 1,
		}
	}

	// 7. Units that need their next hat (started but not yet done).
	const needNextHat: { unit: string; hat: string; terminal: boolean }[] = []
	for (const u of units) {
		if (u.fm.started_at == null) continue
		const next = nextHatForUnit(u.fm, hats)
		if (next === null) continue
		needNextHat.push({
			unit: u.name,
			hat: next.hat,
			terminal: next.terminal,
		})
	}

	// Task #25 pre-dispatch gate for the needs-next-hat path. Same
	// rationale as the wave-ready gate above, but applied to units
	// that have already started. A unit with `started_at` set whose
	// `inputs:` field was never declared is the same structural drift
	// — refuse dispatch and surface for spec fix.
	if (!isFirstStage && needNextHat.length > 0) {
		const dispatchNames = new Set(needNextHat.map((r) => r.unit))
		const missingInputs = units
			.filter((u) => dispatchNames.has(u.name) && !("inputs" in u.fm))
			.map((u) => u.name)
		if (missingInputs.length > 0) {
			return {
				kind: "unit_inputs_not_declared",
				stage,
				units: missingInputs,
			}
		}
	}

	if (needNextHat.length > 0) {
		// Group by hat — main agent dispatches all units on the same
		// hat as a parallel batch.
		const byHat = new Map<string, string[]>()
		for (const r of needNextHat) {
			const list = byHat.get(r.hat) ?? []
			list.push(r.unit)
			byHat.set(r.hat, list)
		}
		// Take the first hat (smallest hat-index) in this batch.
		// Subsequent ticks pick up the others.
		const sorted = [...byHat.entries()].sort(
			([a], [b]) => hats.indexOf(a) - hats.indexOf(b),
		)
		const [hat, unitsForHat] = sorted[0]
		const idx = hats.indexOf(hat)
		return {
			kind: "start_unit_hat",
			stage,
			hat,
			units: unitsForHat,
			terminal: idx === hats.length - 1,
		}
	}

	// Task #28 pre-review gate: refuse to advance from execute to the
	// review track when any unit declares non-empty `outputs:` but has
	// `iterations: []` — the per-unit builder hats never ran. Spec
	// review against this state files `unit_outputs_empty` feedback
	// once per affected unit (a session was reported 2026-05-13 with 9
	// simultaneous such FBs on units 03-11 of a single stage).
	//
	// The wave-ready / needs-next-hat clauses above SHOULD have picked
	// these up — a unit with `started_at: null` and outputs declared is
	// wave-ready by definition, and a unit with `started_at` set and
	// empty iterations triggers `nextHatForUnit`'s first-hat branch.
	// This guard catches the case where neither clause fires — for
	// example, a unit blocked by a `depends_on` cycle, or a stranded
	// started-without-iterations unit that `isUnitComplete` path (b)
	// would otherwise treat as a v3-migrated placeholder. Either way,
	// outputs-declared + iterations-empty is unbuilt; refusing review
	// dispatch surfaces the structural problem instead of generating
	// review feedback against empty artifacts.
	{
		const unbuilt = units
			.filter((u) => {
				const outs = Array.isArray(u.fm.outputs)
					? (u.fm.outputs as unknown[])
					: []
				if (outs.length === 0) return false
				const its = pickIterations(u.fm)
				return its.length === 0
			})
			.map((u) => u.name)
		if (unbuilt.length > 0) {
			return {
				kind: "unit_outputs_empty_iterations",
				stage,
				units: unbuilt,
			}
		}
	}

	// 8. All units' hat sequences done → post-execute output approval
	//    track. Walks approvalRoles per-unit, stamping
	//    `approvals.<role>` as each fires. The pre-execute reviewRoles
	//    walk fired earlier (between elaborate completion and execute);
	//    this is the post-execute counterpart that audits the BUILT
	//    work, not the spec. Engine-built-in roles render mandate
	//    bodies from `prompts/stage/approve/dispatch_approval/
	//    engine-bodies/<role>.eta.md` (different prose from the
	//    pre-execute siblings; same three roles).
	//
	//    Walk approvalRoles which may include `quality_gates`
	//    (engine-run, not subagent-dispatched).
	for (const role of approvalRoles) {
		const missing = units
			.filter((u) => {
				const approvals = pickApprovals(u.fm)
				return !approvals[role]
			})
			.map((u) => u.name)
		if (missing.length === 0) continue
		if (role === "user") {
			return {
				kind: "user_gate",
				stage,
				gate_kind: "approval",
				units: missing,
			}
		}
		if (role === "quality_gates") {
			return { kind: "dispatch_quality_gates", stage, units: missing }
		}
		return { kind: "dispatch_approval", stage, role, units: missing }
	}

	// 8a. Reflection observations (2026-05-18). ON by default; opt
	//     out per intent via `reflection: false` on intent.md FM.
	//     When enabled, give the agent one tick before complete_stage
	//     to write a free-form observations.md describing where it
	//     struggled with mandates, what was ambiguous, and what
	//     surprised it. The file is committed with the stage merge
	//     so the per-intent reflection pass at intent close has
	//     signal across every stage. Idempotent — re-ticks after the
	//     agent wrote the file fall through to complete_stage.
	if (isReflectionEnabled(intentDir)) {
		const observationsPath = join(stageDir, "observations.md")
		if (!existsSync(observationsPath)) {
			return { kind: "record_observations", stage }
		}
	}

	// 8b. Every approval signed AND observations recorded. Emit
	//     `complete_stage` — a SEMANTIC action ("this stage is
	//     done"), NOT a VCS verb. The underlying implementation
	//     under a git-backed portfolio happens to merge the stage
	//     branch into intent main, but the action's name doesn't
	//     reflect that — the engine handles git as an
	//     implementation detail. Filesystem-only backings perform
	//     whatever "complete" means there (stamp `completed_at`,
	//     move artifacts, etc.) without touching git.
	return { kind: "complete_stage", stage }
}

// ── Top-level derivePosition ─────────────────────────────────────────

export type CursorPosition = {
	track: "drift" | "feedback" | "intent" | "sealed" | "noop"
	action: CursorAction | null
}

export function derivePosition(args: {
	slug: string
	intentDir: string
	studio: string
}): CursorPosition {
	const { slug, intentDir, studio } = args

	// Read intent.md once — needed for mode (cursor walk shape) and
	// for intent-scope approvals (terminal leg).
	//
	// `mode` is guaranteed to be set by the time the cursor walks: the
	// pre-cursor gates in run-tick.ts emit `select_mode` when missing,
	// and haiku_run_next blocks on the picker until it's set. If we
	// reach here with no mode, a non-haiku_run_next caller bypassed the
	// gate — fall back to "continuous" to keep the walk deterministic
	// rather than crashing, but the gate is the real contract.
	const intentMdPath = join(intentDir, "intent.md")
	const intentResult = readFm(intentMdPath)
	const mode =
		typeof intentResult?.data.mode === "string" &&
		(intentResult.data.mode as string).length > 0
			? (intentResult.data.mode as string)
			: "continuous"

	// Sealed intent short-circuit: once intent.sealed_at is set, the
	// intent is write-locked — no further cursor work. Architectural
	// invariant: sealed = terminal forever, no walk.
	if (
		intentResult &&
		typeof intentResult.data.sealed_at === "string" &&
		(intentResult.data.sealed_at as string).length > 0
	) {
		return { track: "sealed", action: { kind: "sealed" } }
	}

	// Pre-intent verifier (2026-05-08). The conversation that produced
	// intent.md needs the same substance check as per-stage elaborate.
	// Fires right after intent_create on a fresh intent: reads
	// intent.md, grades whether the body reflects a meaningful
	// conversation about what the user wants. Pass stamps `verified_at`
	// on intent FM via `haiku_intent_seal`; fail returns gaps so the
	// agent re-engages the user and re-creates / updates intent.md.
	//
	// Mode bypass: autopilot skips this gate. The user's intent for
	// autopilot is "the agent runs everything autonomously" — there's
	// no human to converse with for the substance check. Pre-intent
	// elaborate still happens (the user creates the intent in chat),
	// but its rigor isn't enforced by an extra verifier seal.
	//
	// Grandfather rule (mirrors per-stage gate): only fire on a truly
	// fresh intent — first stage active, no units written yet. Any
	// existing in-flight intent that was created before this PR
	// (lacking `verified_at`) but has already shipped stage work is
	// grandfathered. Without this, every legacy non-autopilot intent
	// would block permanently at `elaborate_review` on first tick
	// after the plugin upgrade.
	if (intentResult && mode !== "autopilot") {
		const verifiedAt =
			typeof intentResult.data.verified_at === "string"
				? (intentResult.data.verified_at as string)
				: ""
		if (!verifiedAt) {
			const stages = resolveIntentStages(intentResult.data, studio)
			const firstStage = stages[0] ?? ""
			const firstStageDir = firstStage
				? join(intentDir, "stages", firstStage)
				: ""
			const firstStageHasUnits =
				firstStageDir && existsSync(firstStageDir)
					? listUnitPaths(firstStageDir).length > 0
					: false
			const activeForGate = findCurrentStage(slug, studio, intentDir)
			const isTrulyFresh = activeForGate === firstStage && !firstStageHasUnits
			if (isTrulyFresh) {
				return {
					track: "intent",
					action: {
						kind: "elaborate_loop",
						signals_unmet: [{ signal: "verify_conversation" }],
					},
				}
			}
			// Grandfathered — fall through.
		}
	}

	// Active stage. The caller has already merged intent main into the
	// current branch and aligned the working tree to the cursor's named
	// stage (see haiku_run_next's pre-tick branch alignment). The walk
	// here just reads the disk view we were given.
	const activeStage = findCurrentStage(slug, studio, intentDir)

	// Track C — drift sweep, only against the active stage.
	//
	// Engine-internal as of 2026-05-17. The sweep runs, the engine
	// restamps every affected witness to current SHA (closing the
	// drift loop so the same signal can NEVER re-fire), and emits
	// one deduped FB per (file, kind) tuple via writeFeedbackFile.
	// The agent never sees a `drift_detected` action — the FB queue
	// IS the agent-facing surface, processed by the stage's
	// `fix_hats:` chain on the next tick like any other FB.
	//
	// Returning falls through to Track B (feedback) below so the
	// just-filed FB(s) get dispatched without waiting for an extra
	// tick. See drift-handle-events.ts for the rationale and the
	// dedup model.
	if (activeStage) {
		const drift = runDriftSweep({
			intentDir,
			stage: activeStage,
			studio,
		})
		if (drift.events.length > 0) {
			const summary = engineHandleDriftEvents({
				events: drift.events,
				intentDir,
				stage: activeStage,
				slug,
			})
			// Stamp the cascade alarm on the intent FM when tripped so
			// the run_next response (and downstream UIs) can surface a
			// "consider /haiku:haiku-repair" recommendation. Stamp the
			// CLEARED state too when it un-trips, so the flag self-heals
			// once the queue drains below threshold.
			if (intentResult) {
				stampDriftCascadeAlarm({
					intentDir,
					stage: activeStage,
					tripped: summary.cascade_alarm_tripped,
				})
			}
		}
	}

	// Track B — feedback walk across stages 0..currentStage + intent.
	//
	// Also runs when activeStage is null (every stage merged). That's
	// the "user finished the pipeline, then opened an FB on an earlier
	// stage from the post-pipeline review" path. Without this branch,
	// the cursor would fall through to "intent-level approvals" and
	// silently seal over the open FB. We walk every stage in that case
	// so the FB gets dispatched into the owning stage's fix loop. The
	// fix-hat work commits to that stage's branch, naturally putting it
	// ahead of intent main; once the FB closes, the merge_stage tick
	// re-merges it and the cursor resumes downstream walks.
	{
		const intent = intentResult?.data ?? {}
		const fbAction = walkFeedbackTrack({
			intentDir,
			studio,
			intent,
			// When every stage is merged, treat the LAST stage as the
			// cutoff so walkFeedbackTrack walks all of them. When a
			// stage is active, walk 0..active inclusive (existing
			// behaviour). The cutoff uses intent-effective stages so a
			// quick-mode intent's "last stage" is its own last, not the
			// studio's tail (which the intent may have skipped).
			currentStage:
				activeStage ?? resolveIntentStages(intent, studio).slice(-1)[0] ?? "",
		})
		if (fbAction) return { track: "feedback", action: fbAction }
	}

	// Track A — intent track on the active stage.
	if (activeStage) {
		const intentAction = walkIntentTrack({
			slug,
			intentDir,
			studio,
			stage: activeStage,
			mode,
		})
		if (intentAction !== null) {
			return { track: "intent", action: intentAction }
		}
		// walkIntentTrack returned null → mid-wave noop. The active
		// stage exists but everything in flight is still working.
		// Don't fall through to the intent-level walk — that's only
		// reached when there's no active stage (every stage merged).
		return { track: "noop", action: null }
	}

	// All stages merged → intent-level approvals.
	if (intentResult) {
		const intentApprovals = pickApprovals(intentResult.data)
		// Mode-shaped intent role list. All three agent-side roles
		// (spec, continuity, cross-stage-consistency) are engine-built-in
		// — generic enough to apply to every studio, so they live in code
		// rather than as per-studio mandate files. The inline bodies
		// render in `intent_review/index.ts`. Only the human gate
		// (`user`) is mode-conditional: autopilot skips it.
		const intentRoles = intentReviewRoles(mode)
		for (const role of intentRoles) {
			if (!intentApprovals[role]) {
				return {
					track: "intent",
					action: { kind: "intent_review", role },
				}
			}
		}
		// Intent-scope quality_gates re-run. Per GOALS § "Quality gates
		// are one handler at three scopes," the intent-scope set is
		// **derived** from the union of every unit's quality_gates[]
		// across every stage, deduped by command. Fires after every
		// agent + user review approval is signed and before the seal.
		// Stamp lives at intent FM under `approvals.intent_quality_gates`.
		if (!intentApprovals.intent_quality_gates) {
			return {
				track: "intent",
				action: {
					kind: "dispatch_quality_gates",
					stage: "",
					units: [],
					scope: "intent",
				},
			}
		}
		// All intent-level approvals signed → optional reflection
		// pass, then seal. Reflection (2026-05-18) is ON by default;
		// opt out per intent via `reflection: false` on intent.md FM.
		// When enabled, the agent writes `reflection.md` (synthesized
		// recap + project overlays + engine-class reports); the
		// file's existence on disk is the seen-this-cycle signal, so
		// a re-tick after the agent wrote it falls through to
		// seal_intent.
		if (intentResult.data.sealed_at == null) {
			if (isReflectionEnabled(intentDir)) {
				const reflectionPath = join(intentDir, "reflection.md")
				if (!existsSync(reflectionPath)) {
					return {
						track: "intent",
						action: { kind: "record_reflection" },
					}
				}
			}
			return {
				track: "intent",
				action: { kind: "seal_intent" },
			}
		}
	}

	return { track: "sealed", action: { kind: "sealed" } }
}

/** Compute the elaborate-loop's `signals_unmet[]` for a given stage from
 *  on-disk state. Pulled out of `walkIntentTrack` so the HTTP API
 *  (`getCurrentState`) can surface the same list to the SPA without
 *  re-implementing the cursor's signal logic and silently drifting.
 *
 *  Inputs are deliberately lightweight: callers pass the unit name list
 *  (so this helper doesn't reach back into per-unit FM) and the resolved
 *  stage directory. Mode bypass for autopilot mirrors the original
 *  cursor block exactly. */
/** The ordered intent-completion review roles — the engine-built agent
 *  roles (spec, continuity, cross-stage-consistency), plus the human
 *  `user` gate in non-autopilot modes. Source of truth for both the
 *  intent-level cursor walk and the progress track. Done-ness is read
 *  from intent.md `approvals.<role>` (NOT reviews.*). */
export function intentReviewRoles(mode: string): string[] {
	const base = ["spec", "continuity", "cross-stage-consistency"]
	return mode === "autopilot" ? base : [...base, "user"]
}

/** The ordered review + approval role lists for a stage — the SINGLE
 *  source of truth the cursor walks (pre-execute reviews, then
 *  post-execute approvals) and the progress track renders. Engine roles
 *  (`spec`, `continuity`, `cross-stage-consistency`) lead both lists;
 *  `quality_gates` is approval-only (nothing to run pre-execute);
 *  configured review agents follow; `user` is the terminal human gate.
 *  Autopilot trims to engine roles (+ quality_gates on approvals) — no
 *  agent gates, no user gate. Pass `reviewAgents` when the caller has
 *  already read them (the cursor has); omitted, it reads them here. */
export function stageRoleLists(
	studio: string,
	stage: string,
	mode: string,
	reviewAgents?: ReadonlyArray<string>,
): { reviewRoles: string[]; approvalRoles: string[] } {
	const agents =
		reviewAgents ?? Object.keys(readReviewAgentPaths(studio, stage)).sort()
	const engineRoles = ["spec", "continuity", "cross-stage-consistency"] as const
	const isAutopilot = mode === "autopilot"
	const reviewRoles = isAutopilot
		? [...engineRoles]
		: [...engineRoles, ...agents, "user"]
	const approvalRoles = isAutopilot
		? [...engineRoles, "quality_gates"]
		: [...engineRoles, "quality_gates", ...agents, "user"]
	return { reviewRoles, approvalRoles }
}

export function computeElaborateSignals(args: {
	slug: string
	studio: string
	stage: string
	stageDir: string
	unitNames: ReadonlyArray<string>
	mode: string
}): ElaborateLoopSignal[] {
	const { slug, studio, stage, stageDir, unitNames, mode } = args
	const signalsUnmet: ElaborateLoopSignal[] = []
	const elabPath = join(stageDir, "elaboration.md")
	const elabFm = existsSync(elabPath) ? (readFm(elabPath)?.data ?? {}) : null
	const isAutopilotMode = mode === "autopilot"

	// Signal 3a — conversation (per-stage human conversation gate).
	if (!isAutopilotMode && elabFm === null && unitNames.length === 0) {
		signalsUnmet.push({ signal: "conversation" })
	}

	// Signal 3b — verify_conversation.
	if (!isAutopilotMode && elabFm !== null) {
		const verifiedAt =
			typeof elabFm.verified_at === "string" ? elabFm.verified_at : ""
		if (!verifiedAt) {
			signalsUnmet.push({ signal: "verify_conversation" })
		}
	}

	// Signal 1 — discovery (per template).
	const discoveryDefs = readStageArtifactDefs(studio, stage)
		.filter((d) => d.kind === "discovery")
		.sort((a, b) => a.name.localeCompare(b.name))
	for (const def of discoveryDefs) {
		if (unitNames.length === 0 && !def.tool) continue
		if (!def.required) continue
		if (!def.location) {
			console.error(
				`[haiku] Studio configuration error: discovery template '${def.name}' in stage '${stage}' is required but declares no 'location:' field. The gate is being skipped — fix the template.`,
			)
			continue
		}
		const resolved = def.location.replace(/\{intent-slug\}/g, slug)
		const absPath = join(process.cwd(), resolved)
		const exists = resolved.endsWith("/")
			? existsSync(absPath) &&
				readdirSync(absPath).filter((e) => e !== ".gitkeep").length > 0
			: existsSync(absPath)
		if (!exists) {
			signalsUnmet.push({
				signal: "discovery",
				agent: def.name,
				units: unitNames.length > 0 ? [unitNames[0]] : [],
			})
		}
	}

	// Signal 4a — decompose.
	if (unitNames.length === 0) {
		signalsUnmet.push({ signal: "decompose" })
	}

	// Signal 4b — verify_decompose.
	if (!isAutopilotMode && unitNames.length > 0 && elabFm !== null) {
		const decomposeVerifiedAt =
			typeof elabFm.decompose_verified_at === "string"
				? elabFm.decompose_verified_at
				: ""
		if (!decomposeVerifiedAt) {
			signalsUnmet.push({ signal: "verify_decompose" })
		}
	}

	return signalsUnmet
}

/** Stable string serialization of an `ElaborateLoopSignal[]` for wire /
 *  display use. `discovery` entries carry their `agent` name; everything
 *  else is just the signal kind. Order is preserved (cursor's emit order
 *  is the natural workflow order). */
export function serializeElaborateSignals(
	signals: ReadonlyArray<ElaborateLoopSignal>,
): string[] {
	return signals.map((s) =>
		s.signal === "discovery" ? `discovery:${s.agent}` : s.signal,
	)
}

// Exported for `state-tools.ts` so `haiku_feedback_advance_hat` /
// `haiku_unit_advance_hat` can do the same queue walk the cursor would
// after persisting an iteration — and return the next dispatch block as
// a breadcrumb in the tool response. Engine emits the next instruction;
// the agent relays it. See `.claude/rules/no-agent-mechanics-teaching.md`.
export { walkFeedbackTrack }

// Test-only escape hatch.
export const __testOnly = {
	walkIntentTrack,
	walkFeedbackTrack,
	nextActionForFeedback,
	parseFbIdFromFilename,
}
