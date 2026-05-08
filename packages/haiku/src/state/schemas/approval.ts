// state/schemas/approval.ts — TypeBox shapes for the two witness
// records that drive the cursor's review/approval walk:
//
//   - REVIEW: agent read the SPEC, confirmed alignment with intent.
//   - APPROVAL: agent read the OUTPUTS, confirmed alignment with spec.
//
// Discovery is NOT a witness record — its signal is the artifact's
// existence on disk at the studio template's `location:`. FM state is
// reserved for actions that don't produce a file.
//
// Each record carries only a timestamp `at` — git is the byte witness.
// Drift sweep walks `git log --since=<at> -- <path>` to detect
// out-of-band edits to the artifact since the record was signed.
//
// The primary protection against signed-then-edited specs/outputs is
// tool-level: `haiku_unit_write` and `haiku_unit_set` clear `reviews.*`
// and `approvals.*` on the touched unit. The drift sweep is the
// secondary catch for edits that bypassed the tools (e.g. a user
// editing `unit-NN.md` directly in their editor or a manual git
// commit on the stage branch).
//
// `migrated: true` is a forensic breadcrumb when the v0→v4 soft-scrub
// migrator synthesizes a record from legacy state (e.g. an old unit
// with `status: completed` becomes `approvals.user = { at, migrated }`).
// Real signatures never carry `migrated`.

import { type Static, Type } from "@sinclair/typebox"

export const REVIEW_SCHEMA = Type.Object(
	{
		at: Type.String({
			description:
				"ISO 8601 timestamp the spec review was signed. Drift sweep walks `git log --since=<at>` against the unit spec to detect out-of-band edits.",
		}),
		migrated: Type.Optional(
			Type.Boolean({
				description:
					"True when synthesized by the v0→v4 migrator from legacy state. Real reviews omit this field.",
			}),
		),
	},
	{ additionalProperties: false },
)

export type Review = Static<typeof REVIEW_SCHEMA>

export const APPROVAL_SCHEMA = Type.Object(
	{
		at: Type.String({
			description:
				"ISO 8601 timestamp the approval was signed. Drift sweep walks `git log --since=<at>` against declared output paths to detect out-of-band edits.",
		}),
		migrated: Type.Optional(
			Type.Boolean({
				description:
					"True when synthesized by the v0→v4 migrator from a legacy `status: completed` unit. Real approvals omit this field.",
			}),
		),
	},
	{ additionalProperties: false },
)

export type Approval = Static<typeof APPROVAL_SCHEMA>
