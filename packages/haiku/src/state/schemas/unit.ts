// state/schemas/unit.ts — JSONSchema source-of-truth for unit
// frontmatter shapes. AJV-validated when an agent calls
// haiku_unit_write. The `propertyNames.not.enum` list rejects
// engine-only fields (status, hat, bolt, iterations, started_at,
// completed_at) the workflow engine owns via haiku_unit_advance_hat /
// _reject_hat / _increment_bolt — those fields are written through
// internal setFrontmatterField calls that bypass the agent-facing
// tools.
//
// What JSONSchema covers (enforced by AJV):
//   - allow-list of properties + per-field types
//   - `model` enum
//   - `quality_gates` inner shape (`{name, command, dir?}` with required keys)
//   - `title` minLength
//   - `propertyNames.not.enum` forbids workflow-driven fields
//
// What JSONSchema can NOT cover (runtime context required, lives in
// validateUnitFrontmatter as additional steps):
//   - depends_on self-reference (needs the unit's own name)
//   - depends_on resolves to actual siblings (needs sibling list)
//   - depends_on doesn't form a cycle (needs full stage DAG)
//   - body placeholder strings (needs body inspection)
//   - ghost-FB closes references (needs FB list)

import { stateAjv } from "./_ajv.js"

export const UNIT_FRONTMATTER_SCHEMA = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			description:
				"Unit title — non-empty string. Defaults to first H1 in the body, or to the unit name.",
		},
		depends_on: {
			type: "array",
			items: { type: "string" },
			description:
				"Names of sibling units in the SAME stage that must complete before this one. Each entry must resolve to an actual sibling. No self-reference. No cycles. (Cross-sibling and cycle checks are runtime — they need the full stage DAG, not expressible in this schema.)",
		},
		inputs: {
			type: "array",
			items: {
				type: "string",
				// Path-shape check: must be a non-empty string with no
				// embedded whitespace, must contain a `/` (any path) or `.`
				// (file extension), and must NOT contain `:` or `,` or
				// sentence-style punctuation. Catches freeform-text entries
				// like "ACCEPTANCE-CRITERIA: must define edge cases" that
				// aren't really paths.
				pattern: "^[^\\s:,]+(?:/[^\\s:,]+)*$",
			},
			description:
				"Cross-stage inputs this unit reads — paths to artifacts produced by prior stages. Each entry MUST be a file/dir path (no whitespace, no colons or commas, no prose).",
		},
		outputs: {
			type: "array",
			items: {
				type: "string",
				// Same path-shape check as inputs. The advance gate verifies
				// each output path actually exists as a file at unit
				// completion (see runInlineQualityGates / outputs-empty
				// check), so freeform sentences would slip past the
				// non-empty check before this pattern-validation gate
				// rejected them.
				pattern: "^[^\\s:,]+(?:/[^\\s:,]+)*$",
			},
			description:
				"Artifacts this unit produces. Each entry MUST be a real file path (no whitespace, no colons or commas, no prose) — the gate verifies the path exists on disk at unit completion. Use `inputs:` if you mean to declare what the unit READS; use the body's `## Completion Criteria` section if you mean to declare prose-style success conditions.",
		},
		quality_gates: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					command: { type: "string" },
					dir: { type: "string" },
				},
				required: ["name", "command"],
			},
			description:
				"Build-class only: list of `{name, command, dir?}` executable gate objects. Run at advance_hat time; non-zero exit blocks. Prose strings are silently skipped — they give no enforcement.",
		},
		model: {
			type: "string",
			enum: ["haiku", "sonnet", "opus"],
			description:
				"Subagent tier for this unit's hats. `haiku` = mechanical, `sonnet` = standard (default), `opus` = deep reasoning. Cascade: unit > hat > stage > studio.",
		},
		closes: {
			type: "array",
			items: { type: "string" },
			description:
				"On revisit iterations, list of FB IDs this unit addresses (e.g. `[FB-01, FB-03]`). Every pending FB must be claimed by some unit's `closes:` to allow advancement.",
		},
		applicable_skills: {
			type: "array",
			items: { type: "string" },
			description:
				"Skill slugs (slash-command names without the leading `/`) identified as relevant for this unit during elaboration. The elaborator populates this from the installed skill registry. Hat subagent prompts surface these automatically so subagents know which skills to reach for.",
		},
	},
	// workflow-driven fields. Agents MUST NOT set these — the workflow engine owns
	// transitions via haiku_unit_advance_hat / haiku_unit_reject_hat /
	// haiku_unit_increment_bolt (which call setFrontmatterField directly,
	// bypassing the agent-facing tools). AJV's propertyNames check rejects
	// any of these at validate time; strict MCP clients reject at parse
	// time before the call goes out. `hat_started_at` and
	// `scope_reject_attempts` are workflow-internal counters touched only
	// by advance_hat / reject_hat — listed here so haiku_unit_write and
	// haiku_unit_set both refuse to set them.
	propertyNames: {
		not: {
			enum: [
				"status",
				"hat",
				"bolt",
				"iterations",
				"started_at",
				"completed_at",
				"hat_started_at",
				"scope_reject_attempts",
			],
		},
	},
	// Stage-specific fields are allowed (per-stage `phases/ELABORATION.md`
	// documents them). Schema can't enumerate stage-specific fields
	// without reading every stage def.
	additionalProperties: true,
}

/** Compiled validator — instantiated once at module load, runs on
 *  every haiku_unit_write call. Returns boolean and populates
 *  `validateUnitFrontmatterSchema.errors` on failure. */
export const validateUnitFrontmatterSchema = stateAjv.compile(
	UNIT_FRONTMATTER_SCHEMA,
)

/** Field names a haiku_unit_write / _set call may legally touch.
 *  Reads directly from the schema — JSONSchema is the SSOT. */
export const AGENT_AUTHORABLE_UNIT_FIELDS = Object.keys(
	UNIT_FRONTMATTER_SCHEMA.properties,
) as ReadonlyArray<string>

/** Field names the workflow engine owns. Agent-facing tools refuse
 *  to set these. Reads directly from the schema. */
export const FSM_DRIVEN_UNIT_FIELDS = UNIT_FRONTMATTER_SCHEMA.propertyNames.not
	.enum as ReadonlyArray<string>
