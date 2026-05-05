// state/schemas/feedback.ts — Reference field-name lists for the FB
// frontmatter shape.
//
// haiku_feedback_write is body-only — there is no AJV input schema for
// FB frontmatter to be the SSOT for. These constants are pure
// documentation, consumed only by the fix-loop dispatch contract so
// fix-mode hats know what FM fields they'll see when reading FB
// context. If a future tool needs to accept FB FM input, it should
// bring its own schema and these constants would derive from it
// (matching the unit pattern in `./unit.ts`).

export const FSM_DRIVEN_FB_FIELDS = [
	"status",
	"hat",
	"bolt",
	"iterations",
	"closed_by",
	"integrator_attempts",
	"replies",
	"triaged_at",
] as const

export const CREATE_TIME_FB_FIELDS = [
	"title",
	"origin",
	"author",
	"author_type",
	"created_at",
	"iteration",
	"visit",
	"source_ref",
	"resolution",
	"attachment",
	"inline_anchor",
] as const
