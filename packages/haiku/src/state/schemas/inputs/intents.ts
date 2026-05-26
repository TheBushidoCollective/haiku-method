// state/schemas/inputs/intents.ts — TypeBox input schemas for the
// haiku_intent_* tool family.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

const stateFile = Type.Optional(Type.String())

// ── haiku_intent_create ───────────────────────────────────────────
// Single source of truth for the advertised tool surface (tool-defs.ts)
// AND the handler's ToolDef shape (haiku_intent_create.ts) — both feed
// `jsonSchemaOf(...)` this same object so they can never drift. (Before
// 2026-05-26 they were two hand-written inline copies; `studio_candidates`
// got added to the handler's copy but not the advertised one, so the
// agent never saw the param.) No compiled AJV validator is exported: the
// handler runs bespoke semantic validation (title pollution, studio
// resolution, slug derivation) the gate can't express, so it does NOT use
// the validate-gate path. Required fields are the non-Optional ones, in
// declaration order: title, description, studio_candidates.
export const HAIKU_INTENT_CREATE_INPUT_SCHEMA = Type.Object(
	{
		title: Type.String({
			description:
				'Short human-readable title (3–8 words, max 80 chars, single line, no trailing period). Must be a deliberate summary — NOT the first 80 chars of the description. Good: "Add archivable intents". Bad: "Add archivable intents to H·AI·K·U. Users need a way to soft-hide…".',
		}),
		description: Type.String({
			description:
				"Full description of what the intent is about (2–5 sentences covering scope, motivation, and constraints). Stored verbatim in the intent body.",
		}),
		studio_candidates: Type.Array(Type.String(), {
			description:
				"REQUIRED. The 2–4 studios (canonical name, slug, or alias) that best fit the description — pre-narrows the studio picker. Fetch the options from `haiku_studio_list` (name + description per studio) and pick the closest matches. At least one must resolve; the picker still shows the rest behind a 'Show all studios…' expansion. Omitting it is rejected with instructions to fetch the list and retry.",
		}),
		slug: Type.Optional(
			Type.String({
				description:
					"URL-friendly slug for the intent (auto-generated from title if not provided)",
			}),
		),
		context: Type.Optional(
			Type.String({
				description:
					"Conversation context summary — highlights from the conversation that led to this intent",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuIntentCreateInput = Static<
	typeof HAIKU_INTENT_CREATE_INPUT_SCHEMA
>

// ── haiku_intent_get ──────────────────────────────────────────────

export const HAIKU_INTENT_GET_INPUT_SCHEMA = Type.Object(
	{
		slug: Type.String({ minLength: 1, description: "Intent slug" }),
		field: Type.String({
			minLength: 1,
			description: "Frontmatter field name to read",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuIntentGetInput = Static<typeof HAIKU_INTENT_GET_INPUT_SCHEMA>
export const validateHaikuIntentGetInputSchema = stateAjv.compile(
	HAIKU_INTENT_GET_INPUT_SCHEMA,
)

// ── haiku_intent_list ─────────────────────────────────────────────

export const HAIKU_INTENT_LIST_INPUT_SCHEMA = Type.Object(
	{
		include_archived: Type.Optional(
			Type.Boolean({
				description:
					"When true, include archived intents in the result and add an 'archived' field to each response object. Defaults to false.",
			}),
		),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuIntentListInput = Static<typeof HAIKU_INTENT_LIST_INPUT_SCHEMA>
export const validateHaikuIntentListInputSchema = stateAjv.compile(
	HAIKU_INTENT_LIST_INPUT_SCHEMA,
)

// ── haiku_intent_set ──────────────────────────────────────────────

export const HAIKU_INTENT_SET_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		field: Type.String({ minLength: 1 }),
		// Multi-type — handler validates per-field against
		// INTENT_FRONTMATTER_SCHEMA. See note on haiku_unit_set's
		// `value` for why we use Type.Unsafe with a JSONSchema
		// `type: [...]` array.
		value: Type.Unsafe<unknown>({
			type: ["string", "array", "number", "boolean", "null", "object"],
			description:
				"New value. Must match the field's declared type in INTENT_FRONTMATTER_SCHEMA. Mismatches return `intent_field_type_mismatch`.",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuIntentSetInput = Static<typeof HAIKU_INTENT_SET_INPUT_SCHEMA>
export const validateHaikuIntentSetInputSchema = stateAjv.compile(
	HAIKU_INTENT_SET_INPUT_SCHEMA,
)
