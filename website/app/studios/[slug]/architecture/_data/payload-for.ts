// haiku_run_next payload registry — what the cursor returns at each
// visual transition point in a stage's lifecycle. Distilled from
// `packages/haiku/src/orchestrator/workflow/cursor.ts` and
// `run-tick.ts`.
//
// v4 model: the cursor (`derivePosition`) walks Track C (drift) → Track B
// (feedback) → Track A (intent) on every `haiku_run_next` tick. Each
// entry below describes a visual position in the map and what the
// cursor would emit at that point — one of the v4 CursorAction kinds:
// `select_studio` / `select_mode` / `select_stage` / `drift_detected` /
// `elaborate_loop` / `start_unit_hat` /
// `start_feedback_hat` / `feedback_question` / `close_feedback` /
// `dispatch_review` / `dispatch_quality_gates` / `dispatch_approval` /
// `user_gate` / `complete_stage` / `intent_review` / `seal_intent` /
// `sealed`.
//
// 2026-05-17 — pre/post review/approve split. `dispatch_review` is now
// PRE-execute (audits the SPEC before any code lands); fires between
// elaborate_loop completion and wave-ready hat dispatch. `dispatch_approval`
// stayed POST-execute (audits the WORK against the already-approved spec);
// fires after every unit's hat sequence completes. Engine-built roles
// (`spec`, `continuity`, `cross-stage-consistency`) fire in BOTH walks
// with phase-appropriate mandate bodies, rendered from
// `prompts/stage/{review,approve}/{dispatch_review,dispatch_approval}/engine-bodies/<role>.eta.md`.
// Studio review-agent, hat, and fix-hat mandates resolve via the three-tier
// cascade: `project/.haiku/.../<role>.md` → `plugin/studios/<studio>/stages/<stage>/.../<role>.md`
// → `plugin/studios/<studio>/.../<role>.md` → `plugin/.../<role>.md`. First hit wins.
//
// 2026-05-14 (Option A, GAPS § 1a): the elaborate state is a single
// `elaborate_loop` cursor kind whose payload `signals_unmet[]`
// enumerates every currently-unmet completion signal —
// `conversation` / `verify_conversation` / `discovery` (one entry per
// missing template, carries `agent` + representative `units`) /
// `decompose` / `verify_decompose`. The agent may make progress on
// any subset of them in one tick; the cursor recomputes on the next
// tick and either returns the still-unmet subset or falls through
// past the loop into the pre-execution review track.
//
// Verifier signals (`verify_conversation` / `verify_decompose`)
// surface a one-time `verifier_nonce` on the action payload at
// `verifier_nonces.<signal>`. The verifier subagent threads the
// nonce through to the matching seal tool
// (`haiku_intent_seal` / `haiku_stage_elaboration_seal` /
// `haiku_stage_decompose_seal`); without a valid nonce the seal
// returns `verifier_nonce_invalid` (the runtime gate that replaces
// the old "instruction-gated" trust contract — GAPS § 3).
//
// The drafting → pending transition is stage-scope: while
// `decompose_verified_at` is absent, the loop carries
// `verify_decompose` and blocks wave dispatch from the stage; once
// the seal stamps, the next tick walks past `elaborate_loop` into the
// pre-execution review track.
//
// 2026-05-08: `design_direction_required` / `_complete` / `_uploaded`
// and `clarify_required` were collapsed into the discovery-agent
// model — studios declare a discovery template with `tool:` and the
// cursor's existence check on the artifact's `location:` is the
// gate. The pre-intent verifier is the same `elaborate_loop` shape
// with no `stage` field and a single `verify_conversation` entry in
// `signals_unmet[]`.
//
// The TransitionKey enum is the map's visual vocabulary; it does NOT
// match cursor `kind` values 1:1. Each visual position chooses the
// most-likely cursor action it represents. See architecture §5.5 for
// the full action surface and §5.4 for the per-stage walk order.

import type { DerivedStage, ExecutionMode, PayloadModalData } from "./types.js"

export type TransitionKey =
	| "preelab-to-stage1"
	| "elab-to-prereview"
	| "prereview-to-gate"
	| "elab-to-gate"
	| "hat-to-hat"
	| "wave-to-wave"
	| "execute-to-review"
	| "review-spec-to-agents"
	| "gate-spec-reset-to-review"
	| "review-quality-to-agents"
	| "review-to-gate"
	| "gate-to-next-stage"
	| "feedback-dispatch"
	| "drift-detected"

export interface TransitionOpts {
	from?: string
	to?: string
	unit?: string
	units?: string[]
	isLast?: boolean
	nextStageName?: string | null
}

export type PayloadResult = Omit<PayloadModalData, "stage" | "key">

export function payloadFor(
	stage: DerivedStage,
	idx: number,
	mStage: ExecutionMode,
	key: TransitionKey,
	opts: TransitionOpts = {},
): PayloadResult | null {
	const stageLower = stage.name.toLowerCase()
	const isFirst = idx === 0
	const isAutopilot = mStage === "auto"

	const map: Partial<Record<TransitionKey, PayloadResult>> = {
		"preelab-to-stage1": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result` content",
					what: "the pre-cursor selection chain emits one action at a time — `select_studio` → `select_mode` → (mode='quick' ? `select_stage`) — until every orientation field is set on `intent.md`. `haiku_run_next` blocks on the SPA picker inline; the agent never sees `select_*` in chat unless a non-haiku_run_next caller bypassed the gate.",
				},
				{
					hook: "inject-state-file",
					target: "MCP `_session_context` arg",
					what: "PreToolUse hook injects `state_file` (session metadata persistence path) and `_session_context` (CLAUDE_SESSION_ID, harness, model, etc.) so the orchestrator sees env it can't read directly.",
				},
				{
					hook: "v0→v4 migrator",
					target: "intent.md, every unit.md, every feedback.md (one-time)",
					what: "`run-tick.ts` runs the migrator on first read of any pre-v4 intent: strips deprecated fields (`active_stage`, `phase`, `status`, `triaged_at`, `upstream_stage`, etc.), deletes `state.json`, deletes pre-v4 drift sidecars, stamps `plugin_version: \"4.0.0\"`, synthesizes `approvals.user` for previously-completed units. Idempotent.",
				},
				{
					hook: "readStudio() / readStageDef()",
					target: "`start_stage` prompt body",
					what: "once orientation is complete and the cursor walks Track A on the first stage, `start_stage` inlines the studio body + STAGE.md body so the agent has the full mandate up front.",
				},
			],
			action: "select_studio → select_mode → (quick? select_stage) → elaborate_loop",
			summary: `pre-cursor selection chain → first stage (${stage.name}) elaborate_loop`,
			payload: {
				action: "select_studio",
				intent: "{slug}",
				message: "Intent has no studio. Engine pops the SPA picker.",
				next_actions_after_orientation: [
					"select_mode (continuous | discrete | discrete-hybrid | autopilot | quick)",
					"select_stage (only when mode='quick' and intent.stages[] is empty)",
					"elaborate_loop { stage: '" +
						stageLower +
						"', signals_unmet: [{ signal: 'conversation' }] }",
				],
			},
			validations: [
				"`intent.md` exists with valid frontmatter (created by `haiku_intent_create`)",
				"`intent.studio` is the trigger for `select_studio` (unset → emit)",
				"`intent.mode` is the trigger for `select_mode` (unset → emit; engine-only field, agents cannot write directly)",
				"For `mode: quick` only: `intent.stages[]` empty → `select_stage`",
				"`plugin_version` major < 4 → migrator runs once before the cursor walks",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/intent.md",
					change:
						"frontmatter: `studio`, `mode`, optionally `stages[]` written by engine after each picker resolves; `plugin_version: \"4.0.0\"` stamped by the migrator on first v4 read.",
				},
			],
			instructions: `The pre-cursor gates in \`run-tick.ts\` emit one \`select_*\` action at a time when the corresponding \`intent.md\` field is missing. \`haiku_run_next\` intercepts each, blocks on the SPA picker, writes the chosen value, and re-ticks. Once orientation is complete, the cursor walks Track A on the first stage (\`${stage.name}\`) — initially the stage has no units, so the cursor returns \`elaborate_loop { stage: "${stageLower}", signals_unmet: [{signal: "conversation"}] }\` and the agent begins collaborative drafting. As the agent makes progress (records the elaboration, dispatches discovery subagents, drafts units), subsequent ticks return \`elaborate_loop\` with whichever signals remain unmet until the loop falls through to execute.`,
		},
		"elab-to-prereview": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`action: dispatch_review` — once `elaborate_loop` falls through (all signals met, decompose verified), the cursor walks the PRE-execute review track. One action per missing role per tick — engine-built `spec` → `continuity` → `cross-stage-consistency` first, then each studio-declared review-agent in sequence, then `user`. Reviewers audit the SPEC; no code exists yet.",
				},
				{
					hook: "readReviewAgentPaths() — three-tier cascade",
					target: "subagent prompt",
					what: "engine roles render mandate prose from sibling `prompts/stage/review/dispatch_review/engine-bodies/<role>.eta.md`. Studio roles resolve via the cascade: `project/.haiku/studios/<studio>/stages/<stage>/review-agents/<role>.md` → `plugin/studios/<studio>/stages/<stage>/review-agents/<role>.md` → `plugin/studios/<studio>/review-agents/<role>.md` → `plugin/review-agents/<role>.md`. First hit wins.",
				},
			],
			action: "dispatch_review",
			summary:
				"elaborate done — cursor walks the PRE-execute review track per role (one tick = one role); audits the SPEC before any code lands",
			payload: {
				action: "dispatch_review",
				intent: "{slug}",
				stage: stageLower,
				role: "<next-missing-review-role>",
				units: ["<units-where-reviews.<role>-is-missing>"],
			},
			validations: [
				"`elaborate_loop` has fallen through (all completion signals met, decompose verified)",
				"Units exist with valid DAG (validated at `haiku_unit_write` time)",
				"Some unit has `reviews.<role>` missing for the next role in the cursor's reviewRoles list",
				"reviewRoles order: `spec` → `continuity` → `cross-stage-consistency` (engine-built, render from engine-bodies/) → studio review-agents (resolved via 3-tier cascade) → `user`",
				`Mode shaping: ${isAutopilot ? "autopilot trims to `[spec, continuity, cross-stage-consistency]` only — no studio agents, no user role" : "full role list applies"}`,
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change:
						"after the review-agent subagent terminates clean, the engine signs `reviews.<role>: { at, body_sha256, ... }` on each reviewed unit (the witness for Track C drift). Findings flow through `haiku_feedback` (origin: `adversarial-review`).",
				},
			],
			instructions:
				"Cursor's PRE-execute review track (audits SPEC before any code lands). Each tick returns `dispatch_review { role, units }` for the next missing role. Agent dispatches the review-agent subagent with a tool whitelist of `haiku_unit_read` + `haiku_feedback`. The subagent files findings (which Track B picks up on the next tick via `start_feedback_hat`); when the subagent terminates clean, the engine stamps `reviews.<role>` on each listed unit. Once every non-user role is signed, the cursor advances to `user_gate { gate_kind: \"spec\" }` (skipped under autopilot). Only after this whole walk completes does the cursor advance to `start_unit_hat` for wave dispatch.",
		},
		"prereview-to-gate": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: isAutopilot
						? "autopilot mode: spec gate is auto. Reviews collapse to engine roles `[spec, continuity, cross-stage-consistency]`; once all three are signed the cursor advances directly to `start_unit_hat` for the first wave."
						: "non-autopilot: `dispatch_review` for the next missing role until every studio agent signs, then the cursor emits `user_gate { gate_kind: \"spec\" }` and the engine opens the SPA review session inline.",
				},
			],
			action: isAutopilot ? "start_unit_hat" : "user_gate",
			summary: isAutopilot
				? "spec reviews collapsed to `[spec]` — auto-advance to first wave"
				: `spec reviews complete — open user_gate { gate_kind: "spec" }`,
			payload: isAutopilot
				? {
						action: "start_unit_hat",
						intent: "{slug}",
						stage: stageLower,
						hat: "<first-hat>",
						units: ["<wave-1-units>"],
						terminal: false,
					}
				: {
						action: "user_gate",
						intent: "{slug}",
						stage: stageLower,
						gate_kind: "spec",
						units: ["<units-where-reviews.user-is-missing>"],
					},
			validations: [
				"Every unit's hat sequence has terminal-advanced",
				isAutopilot
					? "autopilot trimmed reviewRoles to `[spec, continuity, cross-stage-consistency]`; once all three engine roles sign, no further review track work"
					: "Every engine role and studio-declared review agent has signed `reviews.<role>` on every listed unit",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change: isAutopilot
						? "no write at this transition — the wave dispatch is the next mainline action"
						: "after the user approves via the SPA, the engine signs `reviews.user` on every listed unit and the cursor advances to the approval track. On request_changes, the engine writes the user's annotations as feedback files; the cursor walks Track B on the next tick.",
				},
			],
			instructions: isAutopilot
				? "Autopilot mode: the cursor's reviewRoles list is `[spec, continuity, cross-stage-consistency]`, so once all three engine subagents sign there's no more PRE-execute spec-review work. The next tick returns `start_unit_hat` for the first wave-ready batch."
				: "The cursor returns `user_gate { gate_kind: \"spec\" }` and `haiku_run_next` opens the review SPA session inline (via `haiku_review_open`), then blocks on `haiku_await_gate`. On approve, the engine stamps `reviews.user` on every unit; on request_changes, the engine writes the annotations as feedback files and Track B walks them on the next tick.",
		},
		"elab-to-gate": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`user_gate { gate_kind: \"spec\" }` — the cursor's reviewRoles loop reached the `user` role. `haiku_run_next` calls `haiku_review_open` inline (creates or reuses a session) and blocks on `haiku_await_gate`.",
				},
				{
					hook: "haiku_review_open / _prepareGateReview",
					target: "Review web UI session record",
					what: "creates (or REUSES, when a live SPA tab exists for this intent) the review session; refreshes the unit set + gate metadata on every prepare; returns `{session_id, review_url, reused, browser_attached}`.",
				},
				{
					hook: "intent-broadcaster",
					target: "every WS subscriber on this intent",
					what: "fires a `gate_prepared` event so the SPA tab refreshes into the gate view without polling.",
				},
				{
					hook: "haiku_await_gate (engine-internal in v4)",
					target: "agent's `tool_use_result` (post-decision)",
					what: "drains `pending_decision` on entry; otherwise blocks on `waitForSession` (up to 30 min). Forwards the MCP abort signal so cancel unwinds promptly. Session lives across awaits — WS, tunnel, and pointers persist.",
				},
			],
			action: "user_gate",
			summary: "spec reviews signed by every agent → user_gate { gate_kind: \"spec\" } (engine-side blocking)",
			payload: {
				action: "user_gate",
				intent: "{slug}",
				stage: stageLower,
				gate_kind: "spec",
				units: ["<units-where-reviews.user-is-missing>"],
				review_url: "https://...",
				session_id: "<session-id>",
				reused: false,
				browser_attached: false,
			},
			validations: [
				"DAG is acyclic and every unit's `depends_on` references existing units (validated at `haiku_unit_write` time)",
				"Unit naming follows `unit-NN-slug.md`",
				"Every unit's hat sequence has terminal-advanced",
				"Every non-user review role has signed `reviews.<role>` on every unit",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change:
						"on approve: `reviews.user: { at, body_sha256, ... }` stamped on every listed unit (the witness Track C will sweep against). On request_changes: engine writes user's annotations as `feedback/<NN>-*.md` files; cursor walks Track B on the next tick.",
				},
			],
			instructions: `The cursor reached the user's spec review. \`haiku_run_next\` opens the review session inline and blocks on \`haiku_await_gate\` — single tool call, no URL+await two-step. On approve → engine stamps \`reviews.user\` on every listed unit; the next tick returns \`start_unit_hat\` for the first wave. On request_changes → engine writes feedback files and Track B walks them on the next tick. **The review UI does NOT re-open while open feedback is pending** — Track B walks before Track A on every tick, so the cursor dispatches fix-hats against the FB until it closes.`,
		},
		"hat-to-hat": {
			injection: [
				{
					hook: "MCP tool result",
					target: "subagent's `tool_use_result`",
					what: `next hat name (\`${opts.to ?? "?"}\`), \`hats/${opts.to ?? "?"}.md\` content. The cursor groups units by hat-index; the parent dispatches one subagent per unit per hat in parallel batches.`,
				},
				{
					hook: "stamp-agent-write (PostToolUse)",
					target: "intent action log",
					what: "agent edits inside tracked drift surfaces stamp `entry_type: \"agent_write\"` so the next drift sweep attributes the change to the agent rather than firing `drift_detected` against the agent's own work.",
				},
			],
			action: "haiku_unit_advance_hat",
			summary: `subagent calls advance_hat → ${opts.from ?? "?"} done, next: ${opts.to ?? "?"}`,
			payload: {
				tool_called_by_subagent: "haiku_unit_advance_hat",
				input: {
					intent: "{slug}",
					stage: stageLower,
					unit: opts.unit ?? "?",
					hat: opts.from ?? "?",
				},
				output_for_next_tick: "the cursor walks `nextHatForUnit` on the next `haiku_run_next` tick and either returns `start_unit_hat` for the next hat or moves on to the spec-review track when every hat sequence has terminal-advanced.",
			},
			validations: [
				`Current hat (\`${opts.from ?? "?"}\`) iterations[-1].result === null at advance time (in-flight, can advance)`,
				"The advancing subagent owns the unit's worktree (the agent's tool whitelist enforces scope)",
			],
			writes: [
				{
					path: `.haiku/intents/{slug}/stages/${stageLower}/units/${opts.unit ?? "?"}.md`,
					change: `frontmatter: append \`{ hat: "${opts.from ?? "?"}", started_at, completed_at, result: "advance" }\` to \`iterations[]\`. The cursor's \`nextHatForUnit\` reads this on the next tick to derive the next hat.`,
				},
			],
			instructions: `**Not a \`haiku_run_next\` tick.** The subagent calls \`haiku_unit_advance_hat\` when it finishes the current hat. The orchestrator records the iteration; the cursor on the next \`haiku_run_next\` tick reads \`iterations[]\` and either returns \`start_unit_hat\` for hat \`${opts.to ?? "?"}\` (if any hats remain) or moves on. On failure the subagent calls \`haiku_unit_reject_hat\` instead — the next \`nextHatForUnit\` walk rewinds one hat (or re-dispatches the first hat if reject was on hat[0]).`,
		},
		"wave-to-wave": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: `\`start_unit_hat { stage, hat, units: [...], terminal }\` — newly-eligible unit batch (${(opts.units ?? []).join(", ")}). The parent dispatches ONE subagent per unit, in parallel.`,
				},
				{
					hook: "start_unit_hat prompt builder",
					target: "next agent prompt",
					what: "each unit gets a self-contained `<subagent>` block with the hat instructions, unit spec, model tier (resolved via per-unit > hat > stage > studio cascade), and tool whitelist embedded inside the block.",
				},
			],
			action: "start_unit_hat",
			summary: `wave ${opts.from ?? "?"} complete → start wave ${opts.to ?? "?"} (${(opts.units ?? []).join(", ")})`,
			payload: {
				action: "start_unit_hat",
				intent: "{slug}",
				stage: stageLower,
				hat: "<first-hat-of-wave>",
				units: opts.units,
				terminal: false,
			},
			validations: [
				"Cursor's wave-ready predicate: `started_at == null` AND every entry in `depends_on` has terminal-advanced (`iterations[-1].result === 'advance'` on the last configured hat)",
				"No in-flight units in the previous wave (cursor returns null = mid-wave noop while any unit's iterations[-1].result is null)",
			],
			writes: [
				{
					path: `.haiku/intents/{slug}/stages/${stageLower}/units/<unit>.md`,
					change: 'frontmatter: `started_at` stamped on each newly-dispatched unit by `haiku_unit_start` (called by the subagent on entry).',
				},
				{
					path: `.haiku/worktrees/<unit>/`,
					change: "git worktree created for each newly-eligible unit by the engine.",
				},
			],
			instructions:
				"There is no 'wave' tool — `haiku_run_next` returns `start_unit_hat` for whichever units satisfy the wave-ready predicate at this tick. The cursor groups by hat-index; the parent dispatches the whole batch in one response. Wave numbers, hat sequences, and slot management are all engine-internal — derived from FM, not tracked by the agent.",
		},
		"execute-to-review": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`dispatch_quality_gates { stage, units }` — every unit's hat sequence has terminal-advanced AND `reviews.<role>` is signed for every spec-review role. The cursor advances to the approval track; the engine-built `quality_gates` role is first.",
				},
				{
					hook: "dispatch_quality_gates prompt builder",
					target: "agent prompt",
					what: "instructs the agent to run `runQualityGates()` (configured tests / lint / typecheck per studio settings); on success the engine signs `approvals.quality_gates` on every listed unit, on failure the agent fixes in place and re-runs.",
				},
			],
			action: "dispatch_quality_gates",
			summary:
				"all unit hat sequences done + every spec review signed → dispatch_quality_gates",
			payload: {
				action: "dispatch_quality_gates",
				intent: "{slug}",
				stage: stageLower,
				units: ["<units-where-approvals.quality_gates-is-missing>"],
			},
			validations: [
				"Every unit's hat sequence terminal-advanced (all post-execute work is done)",
				"Every reviewRole has signed `reviews.<role>` on every unit (PRE-execute spec review walk completed before this point)",
				"`approvals.quality_gates` is missing on at least one unit",
				"approvalRoles order: `spec` → `continuity` → `cross-stage-consistency` (engine-built, render from `prompts/stage/approve/dispatch_approval/engine-bodies/`) → `quality_gates` (engine-run) → studio approval agents (resolved via 3-tier cascade) → `user`",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change:
						"on `runQualityGates()` success the engine signs `approvals.quality_gates: { at, body_sha256, witnesses: [...output paths...] }` on each unit. The witnesses become the drift surface Track C will sweep on every subsequent tick.",
				},
			],
			instructions:
				"The cursor walks the POST-execute approval track per role (audits the WORK against the SPEC the pre-execute review already approved). Engine-built `spec`, `continuity`, `cross-stage-consistency` and engine-run `quality_gates` come before any studio agent. On quality-gate failure the agent fixes the code in place and re-runs — failures don't roll the workflow back, they stay on the approval track until the gates pass. After `quality_gates` is signed, the cursor returns `dispatch_approval { role: <next> }` for each studio approval agent in turn, then `user_gate { gate_kind: \"approval\" }` (skipped under autopilot).",
		},
		"review-spec-to-agents": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`dispatch_review { role: \"spec\" }` — every stage's PRE-execute review track always starts with the engine-built `spec` role (cross-unit acceptance criteria coverage, scope creep, cross-unit drift on the planned spec). Then `continuity`, then `cross-stage-consistency`. All three render from sibling `engine-bodies/<role>.eta.md` files; no per-studio mandate, no opt-out.",
				},
			],
			action: "dispatch_review",
			summary:
				"engine-built `spec` → `continuity` → `cross-stage-consistency` lead every stage's PRE-execute review walk (no per-studio mandate)",
			payload: {
				action: "dispatch_review",
				intent: "{slug}",
				stage: stageLower,
				role: "spec",
				units: ["<units-where-reviews.spec-is-missing>"],
			},
			validations: [
				"`reviews.spec` is missing on at least one unit",
				"reviewRoles list (from cursor) puts engine roles first; even autopilot mode keeps `[spec, continuity, cross-stage-consistency]` (autopilot trims OUT studio agents and user, not engine roles)",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change:
						"after the engine-role subagent terminates clean, the engine signs `reviews.<role>: { at, body_sha256, ... }` on each listed unit. Findings flow through `haiku_feedback` (origin: `adversarial-review`).",
				},
			],
			instructions:
				"A perfect implementation of the wrong thing is still wrong — the engine's spec / continuity / cross-stage-consistency subagents run first on every stage, in that order, on the planned SPEC before any code lands. No per-studio mandate file, no opt-out. Findings flow through Track B (next tick → `start_feedback_hat`); a clean run signs `reviews.<role>` on every listed unit and the cursor advances to the next role.",
		},
		"gate-spec-reset-to-review": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "after engine roles all sign, the cursor advances to studio review-agents (resolved via 3-tier cascade), one role per tick.",
				},
			],
			action: "dispatch_review",
			summary:
				"engine roles signed → cursor advances to the next studio review-agent (cascade-resolved); same PRE-execute review track.",
			payload: {
				action: "dispatch_review",
				intent: "{slug}",
				stage: stageLower,
				role: "<next-studio-review-agent>",
				units: ["<units-where-reviews.<role>-is-missing>"],
			},
			validations: [
				"`reviews.spec`, `reviews.continuity`, `reviews.cross-stage-consistency` all signed on every unit",
				"At least one unit is missing `reviews.<next-role>`",
				"reviewRoles list is the cursor's source of role order",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change:
						"after each studio review-agent terminates clean, `reviews.<role>` is signed by the engine. Findings file via `haiku_feedback` and route through Track B on the next tick.",
				},
			],
			instructions:
				"v4's cursor walks one reviewRole per tick — engine roles (`spec`, `continuity`, `cross-stage-consistency`) first, then each studio review-agent in declared order (resolved via the project → stage → studio → global cascade), then `user`. Mode-shaped: autopilot trims to engine roles only. After every non-user role signs, the cursor returns `user_gate { gate_kind: \"spec\" }` (skipped under autopilot); only after that does the cursor advance to `start_unit_hat` for wave dispatch.",
		},
		"review-quality-to-agents": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`dispatch_approval { role }` — engine roles (`spec`, `continuity`, `cross-stage-consistency`) and `quality_gates` are signed; the cursor walks approvalRoles for each remaining studio approval agent. One role per tick.",
				},
				{
					hook: "readReviewAgentPaths() — three-tier cascade",
					target: "subagent prompt",
					what: "engine roles render mandate prose from sibling `prompts/stage/approve/dispatch_approval/engine-bodies/<role>.eta.md` (POST-execute prose: audit the built work). Studio roles resolve via the cascade: `project/.haiku/.../<role>.md` → `plugin/studios/<studio>/stages/<stage>/.../<role>.md` → `plugin/studios/<studio>/.../<role>.md` → `plugin/review-agents/<role>.md`.",
				},
			],
			action: "dispatch_approval",
			summary:
				"engine roles + quality_gates signed → cursor walks the POST-execute approval track per studio role (one tick per role)",
			payload: {
				action: "dispatch_approval",
				intent: "{slug}",
				stage: stageLower,
				role: "<next-studio-approval-agent>",
				units: ["<units-where-approvals.<role>-is-missing>"],
			},
			validations: [
				"`approvals.spec`, `approvals.continuity`, `approvals.cross-stage-consistency`, `approvals.quality_gates` all signed on every unit",
				"Some unit has `approvals.<role>` missing for the next role in approvalRoles",
				`Mode shaping: ${isAutopilot ? "autopilot trims approvalRoles to `[spec, continuity, cross-stage-consistency, quality_gates]` — no studio agents, no user role" : "full role list applies"}`,
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change:
						"after the approval agent terminates clean, the engine signs `approvals.<role>: { at, body_sha256, witnesses: [<output paths>] }`. Witnesses are the drift surface Track C sweeps every subsequent tick.",
				},
			],
			instructions:
				"Approval agents focus on built artifacts (architecture, performance, security, test coverage) — they audit the WORK, not the spec (the pre-execute review walk already approved the spec). Each role gets its own tick. After every studio approval signs, the cursor returns `user_gate { gate_kind: \"approval\" }` (skipped under autopilot, where `complete_stage` auto-fires once the engine-role and quality_gates set is signed).",
		},
		"review-to-gate": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: isAutopilot
						? "autopilot: approvalRoles trimmed to `[spec, continuity, cross-stage-consistency, quality_gates]`. Once all four engine entries sign the cursor returns `complete_stage` directly — no user gate, no studio agents."
						: "every studio approval agent has signed → `user_gate { gate_kind: \"approval\" }`. `haiku_run_next` opens the review SPA inline and blocks on `haiku_await_gate`.",
				},
			],
			action: isAutopilot ? "complete_stage" : "user_gate",
			summary: isAutopilot
				? "autopilot: every required approval signed → complete_stage"
				: "every studio approval signed → user_gate { gate_kind: \"approval\" }",
			payload: isAutopilot
				? {
						action: "complete_stage",
						intent: "{slug}",
						stage: stageLower,
					}
				: {
						action: "user_gate",
						intent: "{slug}",
						stage: stageLower,
						gate_kind: "approval",
						units: ["<units-where-approvals.user-is-missing>"],
					},
			validations: [
				"`approvals.<role>` signed on every unit for every approvalRole except the next one",
				isAutopilot
					? "autopilot: engine roles + `quality_gates` signed → no further approval work; cursor returns `complete_stage`"
					: "non-autopilot: every studio approval agent has signed; cursor returns `user_gate { gate_kind: \"approval\" }`",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/units/<unit>.md",
					change: isAutopilot
						? "no write at this transition — `complete_stage` is the next mainline action"
						: "on approve: engine signs `approvals.user` on every listed unit; on request_changes: engine writes annotations as feedback files and Track B walks them on the next tick.",
				},
			],
			instructions: isAutopilot
				? "Autopilot: cursor returns `complete_stage` directly. The engine merges the stage branch into intent main under `withIntentMainLock`."
				: "Cursor returns `user_gate { gate_kind: \"approval\" }`. `haiku_run_next` opens the SPA review session inline and blocks on `haiku_await_gate`. On approve, the cursor advances to `complete_stage`. On request_changes, engine writes feedback and Track B walks the fix loop. **In `discrete` mode, the user gate dispatches differently — the engine opens a real PR/MR for the stage branch and the merge into intent main IS the approval signal.**",
		},
		"gate-to-next-stage": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: opts.isLast
						? "every stage merged → cursor walks intent-scope approvals (`spec`, `continuity`, `user`) and emits `intent_review { role }` per missing role, then `seal_intent`, then `sealed`."
						: "stage merged into intent main; cursor's next tick walks the next stage (the new `firstUnmergedStage`).",
				},
				{
					hook: "withIntentMainLock",
					target: "merge serialization",
					what: "every stage→main merge runs under the lock so concurrent stages can't race the merge into intent main.",
				},
			],
			action: opts.isLast ? "seal_intent" : "complete_stage",
			summary: opts.isLast
				? "final stage merged → walk intent-scope approvals → seal_intent → sealed"
				: `merge stage \`${stageLower}\` into intent main → next stage (${opts.nextStageName ?? "?"})`,
			payload: opts.isLast
				? {
						action: "seal_intent",
						intent: "{slug}",
					}
				: {
						action: "complete_stage",
						intent: "{slug}",
						stage: stageLower,
					},
			validations: [
				"Every approval signed for every unit on the stage (mode-shaped)",
				opts.isLast
					? "every stage's branch is merged into intent main (`firstUnmergedStage` returns null)"
					: "stage's branch is ahead of intent main and ready to merge",
			],
			writes: opts.isLast
				? [
						{
							path: ".haiku/intents/{slug}/intent.md",
							change:
								"after intent-scope approvals all sign and `seal_intent` runs, the engine stamps `sealed_at`. The next tick returns `sealed` (terminal).",
						},
					]
				: [
						{
							path: "git refs",
							change:
								"`haiku/{slug}/{stage}` merged into `haiku/{slug}/main` under `withIntentMainLock`. Stages are NEVER sealed — only intents are; corrective work on a previously-merged stage rewinds the cursor automatically (`firstUnmergedStage` returns it on the next tick).",
						},
					],
			instructions: opts.isLast
				? "Final stage's branch is merged. The cursor now walks intent-scope approvals from `intent.md.approvals`: `spec`, `continuity`, `cross-stage-consistency` (engine-built), studio intent-completion review agents (from `plugin/studios/<studio>/intent-review-agents/`, renamed 2026-05-17), and `user` (gated through SPA). Mode-shaped: autopilot trims to engine roles only. Each missing role → `intent_review { role }` (one tick per role). Once every intent-scope approval signs → `seal_intent` (engine performs final rebase + stamps `sealed_at`) → `sealed`."
				: `Cursor returns \`complete_stage { stage: "${stageLower}" }\`. Semantic action ("stage is done") — under a git-backed portfolio the engine merges the stage branch into intent main under \`withIntentMainLock\` as an implementation detail; under filesystem-only backings it transitions stage state. The next instruction is most commonly the next stage's first action (e.g. \`elaborate\` for the conversation gate, or \`discovery_required\` if the next stage declares a tool-driven discovery template). Renamed 2026-05-12 from \`merge_stage\` per the principle "no engine action reflects a git or VCS operation."`,
		},
		"feedback-dispatch": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`start_feedback_hat { stage, hat, feedback_ids, terminal }` — Track B walks open FBs in stage order (0..active) plus intent-scope, returns the next fix-hat dispatch. `close_feedback` lands when the terminal hat advances.",
				},
				{
					hook: "start_feedback_hat prompt builder",
					target: "subagent prompt",
					what: "the fix-hat's mandate (`hats/<hat>.md`), the FB body, and a tool whitelist (`haiku_feedback_read`, `haiku_feedback_write`, `haiku_unit_read` for context, `haiku_feedback_advance_hat` / `_reject_hat`, optionally `haiku_feedback_set_targets` for the classifier hat).",
				},
			],
			action: "start_feedback_hat",
			summary:
				"Track B: open FB → cursor returns `start_feedback_hat` for the next fix-hat in the stage's `fix_hats:` chain (or `close_feedback` on terminal advance)",
			payload: {
				action: "start_feedback_hat",
				intent: "{slug}",
				stage: stageLower,
				hat: "<next-fix-hat>",
				feedback_ids: ["FB-001"],
				terminal: false,
			},
			validations: [
				"Stage declares `fix_hats:` (typically `[<implementer>, feedback-assessor]` minimum)",
				"FB has `closed_at == null` (open)",
				"Cursor walks Track B BEFORE Track A on every tick — open FB blocks forward motion",
				"Cross-stage routing: FBs in `stages/<earlier>/feedback/` rewind the cursor to that stage's fix loop on the next tick (purely by file location, no `upstream_stage:` field in v4)",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/feedback/<NN>-*.md",
					change:
						"fixer hats edit the FB BODY via `haiku_feedback_write`; the flagged unit is read-only context (`haiku_unit_read`). Hat progression via `haiku_feedback_advance_hat` / `_reject_hat`. The terminal hat's advance triggers `close_feedback` on the next tick — engine stamps `closed_at` and applies `targets.invalidates` (clearing approvals on the targeted unit, which routes the cursor back through those approval roles).",
				},
			],
			instructions:
				"FB-as-unit fix loop. The first hat in `fix_hats:` is conventionally a classifier — it reads the FB body, decides which unit (if any) the finding targets and which approval roles to invalidate on closure, and calls `haiku_feedback_set_targets`. Subsequent hats execute the fix; the terminal hat (typically `feedback-assessor`) validates and calls `haiku_feedback_advance_hat`. Engine auto-stamps `closed_at` and applies invalidations on the next tick. Closed FBs become input to the next iteration of the upstream stage's elaborate phase — completed units are never modified (forward-only).",
		},
		"drift-detected": {
			injection: [
				{
					hook: "MCP tool result",
					target: "agent's `tool_use_result`",
					what: "`drift_detected { events }` — Track C ran a content-hash sweep over every signed witness on the active stage and at least one mismatched. Dedup'd against open drift FBs by `source_ref` so a fired FB suppresses re-emission until it closes.",
				},
				{
					hook: "runDriftSweep()",
					target: "Track C of the cursor",
					what: "for each signed `reviews.<role>` / `approvals.<role>` on every unit on the active stage, re-hashes the unit body / declared outputs and compares against `body_sha256` + `witnesses[]`. v4 dropped `baseline.json` / `baseline-content/` / `drift-markers.json`; the witness lives directly on FM. Pre-v4 sidecars are deleted by the v0→v4 migrator.",
				},
				{
					hook: "stamp-agent-write (PostToolUse)",
					target: "intent action log",
					what: "agent edits get an `entry_type: \"agent_write\"` stamp so the next sweep attributes the change to the agent and does NOT emit drift. The `drift_detected` action only fires for genuinely out-of-band edits.",
				},
			],
			action: "drift_detected",
			summary:
				"Track C content-hash sweep found out-of-band edits to a witnessed artifact",
			payload: {
				action: "drift_detected",
				intent: "{slug}",
				events: [
					{
						unit: "<unit>",
						role: "<reviews|approvals.<role>>",
						kind: "body | output",
						file: "<path>",
						since: "<witness ISO timestamp>",
						commits: ["<sha1>", "<sha2>"],
					},
				],
			},
			validations: [
				"Drift sweep kill-switch (`drift_detection: false`) is OFF",
				"Active stage exists (sweep is gated on `firstUnmergedStage`)",
				"At least one signed witness's content hash no longer matches",
				"No open drift FB with the same `source_ref` (dedup)",
			],
			writes: [
				{
					path: ".haiku/intents/{slug}/stages/{stage}/feedback/<NN>-drift-*.md",
					change:
						"the agent files one FB per drift event via `haiku_feedback` with `origin: \"drift\"`, `source_ref: \"drift:<kind>:<file>\"`, `target_unit: <named unit>`, `target_invalidates: []`. The classifier hat decides whether the drift is material; closure with empty invalidates means \"cosmetic, no action,\" a non-empty list re-routes the cursor through the named approval roles.",
				},
			],
			instructions:
				"Track C is the engine's reconciliation against forward-only. Completed work is not edited in place — out-of-band edits surface as drift FBs, the fix loop assesses materiality, and corrective work (when needed) becomes new pending units in a future iteration of the upstream stage's elaborate phase. The drift FB itself follows the FB-as-unit pattern: fixers edit the FB body to record diagnosis and root cause; the terminal hat decides invalidations.",
		},
	}
	return map[key] ?? null
}
