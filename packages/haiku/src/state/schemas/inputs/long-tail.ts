// state/schemas/inputs/long-tail.ts — TypeBox input schemas for
// the remaining state-tool family beyond unit / intent / stage /
// feedback. Nineteen tools total: registry reads, settings, decision
// recording, reports, repair / seed / backlog.
//
// Most are read-mostly with one or two args. We keep them in one
// file rather than fragmenting further — the surface is too small
// to justify per-tool files, and grouping them under a common
// `long-tail` heading mirrors the call site in state-tools.ts.
//
// Conditional substance checks (e.g. decision_record's
// no_decisions / decision / options / choice mutual exclusivity)
// stay in the handlers — the AJV gate enforces shape +
// additionalProperties: false, and the handler returns a stable
// named code (`decision_invalid`, etc.) when the conditional rule
// fires.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

const stateFile = Type.Optional(Type.String())
const empty = Type.Object(
	{ state_file: stateFile },
	{ additionalProperties: false },
)

// ── haiku_reconciliation_acknowledge ──────────────────────────────

export const HAIKU_RECONCILIATION_ACKNOWLEDGE_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		stage: Type.Optional(
			Type.String({
				description:
					"Stage name. Defaults to the intent's active_stage when omitted.",
			}),
		),
		// Handler enforces ≥10 chars with a precise named code; the
		// gate just enforces non-empty so the call shape is sound.
		rationale: Type.String({
			minLength: 1,
			description:
				"Rationale (≥10 chars in handler check) explaining why this divergence is intentional.",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuReconciliationAcknowledgeInput = Static<
	typeof HAIKU_RECONCILIATION_ACKNOWLEDGE_INPUT_SCHEMA
>
export const validateHaikuReconciliationAcknowledgeInputSchema =
	stateAjv.compile(HAIKU_RECONCILIATION_ACKNOWLEDGE_INPUT_SCHEMA)

// ── haiku_decision_record ─────────────────────────────────────────
//
// Conditional contract — when `no_decisions=true`, `rationale` is
// required and decision/options/choice must be absent. When
// `no_decisions` is false/absent, decision/options/choice are
// required. Enforcing that with if/then/else here would split the
// error shape across two paths; the handler already returns
// stable named codes for each combination.

export const HAIKU_DECISION_RECORD_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		stage: Type.Optional(Type.String()),
		no_decisions: Type.Optional(Type.Boolean()),
		decision: Type.Optional(Type.String()),
		options: Type.Optional(Type.Array(Type.String())),
		choice: Type.Optional(Type.String()),
		source: Type.Optional(
			Type.String({
				enum: ["user", "autonomous-acknowledged"],
				description:
					"Who made the call. user = user picked from agent-presented options. autonomous-acknowledged = agent chose and surfaced for veto-style approval.",
			}),
		),
		rationale: Type.Optional(Type.String()),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuDecisionRecordInput = Static<
	typeof HAIKU_DECISION_RECORD_INPUT_SCHEMA
>
export const validateHaikuDecisionRecordInputSchema = stateAjv.compile(
	HAIKU_DECISION_RECORD_INPUT_SCHEMA,
)

// ── haiku_knowledge_list ──────────────────────────────────────────

export const HAIKU_KNOWLEDGE_LIST_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuKnowledgeListInput = Static<
	typeof HAIKU_KNOWLEDGE_LIST_INPUT_SCHEMA
>
export const validateHaikuKnowledgeListInputSchema = stateAjv.compile(
	HAIKU_KNOWLEDGE_LIST_INPUT_SCHEMA,
)

// ── haiku_knowledge_read ──────────────────────────────────────────

export const HAIKU_KNOWLEDGE_READ_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		name: Type.String({ minLength: 1 }),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuKnowledgeReadInput = Static<
	typeof HAIKU_KNOWLEDGE_READ_INPUT_SCHEMA
>
export const validateHaikuKnowledgeReadInputSchema = stateAjv.compile(
	HAIKU_KNOWLEDGE_READ_INPUT_SCHEMA,
)

// ── haiku_skill_list / haiku_studio_list /
// haiku_version_info — empty inputs ──────────────────────────────
//
// All three are no-arg tools. Sharing one schema keeps the SSOT
// honest (additionalProperties: false rejects accidental garbage
// from any of them).

export const HAIKU_EMPTY_INPUT_SCHEMA = empty
export type HaikuEmptyInput = Static<typeof HAIKU_EMPTY_INPUT_SCHEMA>
export const validateHaikuEmptyInputSchema = stateAjv.compile(empty)

// ── haiku_studio_get ──────────────────────────────────────────────

export const HAIKU_STUDIO_GET_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1 }),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuStudioGetInput = Static<typeof HAIKU_STUDIO_GET_INPUT_SCHEMA>
export const validateHaikuStudioGetInputSchema = stateAjv.compile(
	HAIKU_STUDIO_GET_INPUT_SCHEMA,
)

// ── haiku_studio_stage_get ────────────────────────────────────────

export const HAIKU_STUDIO_STAGE_GET_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1 }),
		stage: Type.String({ minLength: 1 }),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuStudioStageGetInput = Static<
	typeof HAIKU_STUDIO_STAGE_GET_INPUT_SCHEMA
>
export const validateHaikuStudioStageGetInputSchema = stateAjv.compile(
	HAIKU_STUDIO_STAGE_GET_INPUT_SCHEMA,
)

// ── haiku_settings_get ────────────────────────────────────────────

export const HAIKU_SETTINGS_GET_INPUT_SCHEMA = Type.Object(
	{
		field: Type.String({
			minLength: 1,
			description:
				"Dot-separated path (e.g. 'studio', 'providers.ticketing.type', 'providers.spec.config.space')",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuSettingsGetInput = Static<
	typeof HAIKU_SETTINGS_GET_INPUT_SCHEMA
>
export const validateHaikuSettingsGetInputSchema = stateAjv.compile(
	HAIKU_SETTINGS_GET_INPUT_SCHEMA,
)

// ── haiku_settings_set ────────────────────────────────────────────
//
// `value` is multi-type — same Type.Unsafe escape hatch as
// haiku_unit_set / haiku_intent_set. The handler validates per-
// field against settings.schema.json after the gate.

export const HAIKU_SETTINGS_SET_INPUT_SCHEMA = Type.Object(
	{
		field: Type.String({ minLength: 1 }),
		value: Type.Unsafe<unknown>({
			type: ["string", "array", "number", "boolean", "null", "object"],
			description:
				"New value. Must validate against the field's declared shape in settings.schema.json. Pass null to delete.",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuSettingsSetInput = Static<
	typeof HAIKU_SETTINGS_SET_INPUT_SCHEMA
>
export const validateHaikuSettingsSetInputSchema = stateAjv.compile(
	HAIKU_SETTINGS_SET_INPUT_SCHEMA,
)

// ── haiku_capacity ────────────────────────────────────────────────

export const HAIKU_CAPACITY_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.Optional(
			Type.String({ description: "Optional: filter to a specific studio" }),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuCapacityInput = Static<typeof HAIKU_CAPACITY_INPUT_SCHEMA>
export const validateHaikuCapacityInputSchema = stateAjv.compile(
	HAIKU_CAPACITY_INPUT_SCHEMA,
)

// ── haiku_zap ─────────────────────────────────────────────────────
//
// Stateless zero-ceremony single-task run through a stage's hat
// loop. No `.haiku/` files, no workflow tick — the tool resolves
// studio/stage, reads STAGE.md + each hat body via the cascade, and
// returns ready-to-run markdown instructions (per-hat subagent
// prompts + the run/verify/commit procedure). The agent drives the
// sequential loop; the tool never writes prompt files or tracks
// state. Studio/stage validation is handler-side (against the real
// studio list + stage list), surfacing `zap_studio_not_found` /
// `zap_stage_not_found` with the valid options the agent can re-pick.

export const HAIKU_ZAP_INPUT_SCHEMA = Type.Object(
	{
		task: Type.String({
			minLength: 1,
			description: "The work to run through the stage's hat loop.",
		}),
		studio: Type.Optional(
			Type.String({
				description:
					"Studio slug (e.g. `software`). Defaults to `software` when omitted and present.",
			}),
		),
		stage: Type.Optional(
			Type.String({
				description:
					"Stage within the studio (e.g. `development`). Defaults to the studio's build-class execution stage when omitted.",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuZapInput = Static<typeof HAIKU_ZAP_INPUT_SCHEMA>
export const validateHaikuZapInputSchema = stateAjv.compile(
	HAIKU_ZAP_INPUT_SCHEMA,
)

// ── haiku_reflect ─────────────────────────────────────────────────

export const HAIKU_REFLECT_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuReflectInput = Static<typeof HAIKU_REFLECT_INPUT_SCHEMA>
export const validateHaikuReflectInputSchema = stateAjv.compile(
	HAIKU_REFLECT_INPUT_SCHEMA,
)

// ── haiku_review ──────────────────────────────────────────────────

export const HAIKU_REVIEW_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.Optional(
			Type.String({ description: "Optional: intent slug for context" }),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuReviewInput = Static<typeof HAIKU_REVIEW_INPUT_SCHEMA>
export const validateHaikuReviewInputSchema = stateAjv.compile(
	HAIKU_REVIEW_INPUT_SCHEMA,
)

// ── haiku_review_open ─────────────────────────────────────────────

export const HAIKU_REVIEW_OPEN_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.Optional(
			Type.String({
				description:
					"Optional intent slug. Defaults to the sole active intent.",
			}),
		),
		stage: Type.Optional(
			Type.String({
				description:
					"Optional stage name. Defaults to the intent's active_stage.",
			}),
		),
		// Cursor-driven user_gate sessions pass gate_kind ("spec" or
		// "approval") and the units list. When gate_kind is set, the tool
		// switches from ad-hoc semantics to a workflow-bound gate session:
		// it writes gate_review_session_id / url / context to stage state
		// so haiku_await_gate finds and resumes the session, AND it returns
		// immediately (no blocking) — the agent calls haiku_await_gate
		// next to block + dispatch the user's decision + stamp
		// reviews.user / approvals.user on the listed units.
		//
		// Without these fields the call rejects (additionalProperties:
		// false) — which is the exact failure the v4 user_gate prompt was
		// hitting before this schema entry existed.
		gate_kind: Type.Optional(
			Type.String({
				enum: ["spec", "approval"],
				description:
					"When set, opens the review pane as a workflow-bound gate session (vs. ad-hoc). 'spec' = pre-execute spec review (stamps reviews.user). 'approval' = post-execute output approval (stamps approvals.user).",
			}),
		),
		units: Type.Optional(
			Type.Array(Type.String(), {
				description:
					"Unit identifiers the user is gating. Surfaced by the cursor's user_gate action; ignored when gate_kind is unset.",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuReviewOpenInput = Static<typeof HAIKU_REVIEW_OPEN_INPUT_SCHEMA>
export const validateHaikuReviewOpenInputSchema = stateAjv.compile(
	HAIKU_REVIEW_OPEN_INPUT_SCHEMA,
)

// ── haiku_backlog ─────────────────────────────────────────────────

export const HAIKU_BACKLOG_INPUT_SCHEMA = Type.Object(
	{
		action: Type.Optional(
			Type.String({
				enum: ["list", "add", "review", "promote"],
				description: "Defaults to `list`.",
			}),
		),
		description: Type.Optional(
			Type.String({
				description:
					"Description for the new backlog item (used with action=add).",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuBacklogInput = Static<typeof HAIKU_BACKLOG_INPUT_SCHEMA>
export const validateHaikuBacklogInputSchema = stateAjv.compile(
	HAIKU_BACKLOG_INPUT_SCHEMA,
)

// ── haiku_seed ────────────────────────────────────────────────────

export const HAIKU_SEED_INPUT_SCHEMA = Type.Object(
	{
		action: Type.Optional(
			Type.String({
				enum: ["list", "plant", "check"],
				description: "Defaults to `list`.",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuSeedInput = Static<typeof HAIKU_SEED_INPUT_SCHEMA>
export const validateHaikuSeedInputSchema = stateAjv.compile(
	HAIKU_SEED_INPUT_SCHEMA,
)

// ── haiku_release_notes ───────────────────────────────────────────

export const HAIKU_RELEASE_NOTES_INPUT_SCHEMA = Type.Object(
	{
		version: Type.Optional(
			Type.String({
				description: "Optional: specific version to extract (e.g. '1.2.0')",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuReleaseNotesInput = Static<
	typeof HAIKU_RELEASE_NOTES_INPUT_SCHEMA
>
export const validateHaikuReleaseNotesInputSchema = stateAjv.compile(
	HAIKU_RELEASE_NOTES_INPUT_SCHEMA,
)

// ── haiku_stage_reset ─────────────────────────────────────────────

export const HAIKU_STAGE_RESET_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		stage: Type.String({
			minLength: 1,
			description: "Stage name to reset (e.g. 'product')",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuStageResetInput = Static<typeof HAIKU_STAGE_RESET_INPUT_SCHEMA>
export const validateHaikuStageResetInputSchema = stateAjv.compile(
	HAIKU_STAGE_RESET_INPUT_SCHEMA,
)

// ── haiku_repair ──────────────────────────────────────────────────

export const HAIKU_REPAIR_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.Optional(
			Type.String({
				description:
					"Specific intent slug to scan in cwd (skips multi-branch mode)",
			}),
		),
		apply: Type.Optional(Type.Boolean()),
		skip_branches: Type.Optional(Type.Boolean()),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuRepairInput = Static<typeof HAIKU_REPAIR_INPUT_SCHEMA>
export const validateHaikuRepairInputSchema = stateAjv.compile(
	HAIKU_REPAIR_INPUT_SCHEMA,
)

// ── haiku_view ───────────────────────────────────────────────────
// Opens a tunnelled URL pointing at the SPA's artifact-browser route
// (viewer mode) or a spawned project dev server (boot mode). Returns
// the URL for the agent to hand to the playwright MCP. Lifecycle is
// managed via `haiku_view_close` + the standard session TTL.

export const HAIKU_VIEW_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description:
				"Intent slug to scope the view session. The SPA will only serve files under this intent's directory.",
		}),
		stage: Type.Optional(
			Type.String({
				description:
					"Optional stage name to narrow the artifact list. Defaults to the intent's active_stage when omitted.",
			}),
		),
		artifact: Type.Optional(
			Type.String({
				description:
					"Optional intent-relative path to deep-link the SPA to a single artifact file (e.g. `stages/design/artifacts/wireframe.svg`). When omitted the SPA lists every artifact in scope.",
			}),
		),
		mode: Type.Optional(
			Type.String({
				enum: ["auto", "viewer", "boot"],
				description:
					"Mode preference. `auto` (default) tries boot first and falls back to viewer. `boot` forces a spawned dev server and hard-fails when no `command` is supplied and no fast-path is detected. `viewer` forces the SPA artifact-browser route.",
			}),
		),
		command: Type.Optional(
			Type.Array(Type.String({ minLength: 1 }), {
				minItems: 1,
				description:
					"Single-process boot — explicit command argv (e.g. `[\"uvicorn\", \"app:main\"]`, `[\"bin/dev\"]`, `[\"go\", \"run\", \"./cmd/server\"]`). Engine spawns with `PORT` + `HOST` env vars set so the dev server binds where the supervisor expects. Use this for one-process apps. For monorepos / stacks (api + frontend + db + worker), use `processes` instead.",
			}),
		),
		cwd: Type.Optional(
			Type.String({
				description:
					"Working directory for `command`, relative to the intent dir. Defaults to the intent dir when omitted. Ignored when `processes` is supplied (each process declares its own cwd).",
			}),
		),
		processes: Type.Optional(
			Type.Array(
				Type.Object(
					{
						name: Type.String({
							minLength: 1,
							pattern: "^[a-zA-Z][a-zA-Z0-9_-]*$",
							description:
								"Identifier for this process. Used to build service-discovery env vars (`<NAME>_PORT`, `<NAME>_URL`) injected into dependents, and as the `primary` selector. Lowercase letters / digits / `-` / `_`; must start with a letter.",
						}),
						command: Type.Array(Type.String({ minLength: 1 }), {
							minItems: 1,
							description:
								"Argv for this process (e.g. `[\"npm\", \"run\", \"api\"]`, `[\"redis-server\"]`, `[\"docker\", \"compose\", \"up\", \"postgres\"]`).",
						}),
						cwd: Type.Optional(
							Type.String({
								description:
									"Working directory for this process, relative to the intent dir. Defaults to the intent dir when omitted (e.g. `\"backend\"` for `packages/backend/` in a monorepo).",
							}),
						),
						port_env: Type.Optional(
							Type.String({
								minLength: 1,
								description:
									"Env-var name the engine assigns the allocated ephemeral port to. Defaults to `PORT`. Override when the process expects a different name (e.g. `\"RAILS_PORT\"`, `\"API_PORT\"`).",
							}),
						),
						ready_url: Type.Optional(
							Type.String({
								description:
									"Optional HTTP URL the supervisor polls to confirm this process is ready before starting dependents (e.g. `\"http://127.0.0.1:{port}/healthz\"`). Use `{port}` as the placeholder for the allocated port. Falls back to TCP port-bind detection when omitted.",
							}),
						),
						depends_on: Type.Optional(
							Type.Array(Type.String({ minLength: 1 }), {
								description:
									"Names of processes that must be ready before this one starts. The supervisor topologically sorts the graph and starts processes in dependency order. Each dependency's `<NAME>_PORT` and `<NAME>_URL` env vars are injected into this process's env so the runtime can do service discovery (e.g. an API depending on `db` sees `DB_PORT` + `DB_URL`).",
							}),
						),
						no_port: Type.Optional(
							Type.Boolean({
								description:
									"Set true for processes that don't listen on a TCP port (queue workers, background daemons, schedulers). The supervisor still tracks lifecycle but skips port allocation and readiness checking.",
							}),
						),
					},
					{ additionalProperties: false },
				),
				{
					minItems: 1,
					description:
						"Process group — boot multiple coordinated processes (api + frontend + db + worker etc.). The supervisor allocates an ephemeral port per process (unless `no_port`), starts them in dependency order, waits for each to be ready, and exposes `<NAME>_PORT` + `<NAME>_URL` env vars to every dependent. Killing the session kills the whole group. Mutually exclusive with `command`.",
				},
			),
		),
		primary: Type.Optional(
			Type.String({
				minLength: 1,
				description:
					"Name of the process whose URL is returned as the top-level `url` field — i.e., the one Playwright drives. Required when `processes` has more than one port-bound entry. Ignored for single-process boots.",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuViewInput = Static<typeof HAIKU_VIEW_INPUT_SCHEMA>
export const validateHaikuViewInputSchema = stateAjv.compile(
	HAIKU_VIEW_INPUT_SCHEMA,
)

// ── haiku_view_close ─────────────────────────────────────────────
// Explicit shutdown for a view session. Boot-mode sessions also
// terminate the spawned dev server. Idempotent — closing an unknown
// or already-closed session returns success.

export const HAIKU_VIEW_CLOSE_INPUT_SCHEMA = Type.Object(
	{
		session_id: Type.String({
			minLength: 1,
			description: "Session ID returned by `haiku_view`.",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuViewCloseInput = Static<typeof HAIKU_VIEW_CLOSE_INPUT_SCHEMA>
export const validateHaikuViewCloseInputSchema = stateAjv.compile(
	HAIKU_VIEW_CLOSE_INPUT_SCHEMA,
)
