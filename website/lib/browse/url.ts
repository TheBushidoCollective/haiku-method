// lib/browse/url.ts — parse + build /browse/... deep-link URLs.
//
// URL shape:
//   /browse/{host}/{...project}/intent/{slug}/{stage}/{unit}
//   /browse/{host}/{...project}/intent/{slug}/feedback/{id}            (intent-scoped FB)
//   /browse/{host}/{...project}/intent/{slug}/{stage}/feedback/{id}    (stage-scoped FB)
//
// Examples:
//   /browse/github.com/acme/widgets
//     → host=github.com, project=acme/widgets
//   /browse/github.com/acme/widgets/intent/my-feature
//     → + intent=my-feature
//   /browse/github.com/acme/widgets/intent/my-feature/design
//     → + stage=design
//   /browse/github.com/acme/widgets/intent/my-feature/design/unit-01-foo
//     → + stage=design, unit=unit-01-foo
//   /browse/github.com/acme/widgets/intent/my-feature/design/feedback/FB-007
//     → + stage=design, feedback=FB-007
//   /browse/github.com/acme/widgets/intent/my-feature/feedback/FB-007
//     → + feedback=FB-007 (intent-scoped, no stage)
//
// The {...project} part is variable-length (host + org + repo, or deeper for
// self-hosted GitLab subgroups), so we anchor on the literal `intent`
// segment: everything before it (after host) is the project path, the
// segment after it is the slug, then optional stage + (unit | feedback/{id}).
// The `feedback` keyword is a second anchor inside the post-intent tail so a
// feedback id can't be mistaken for a unit name.

export interface BrowseLocation {
	host: string
	project: string
	intent?: string
	stage?: string
	unit?: string
	/** Feedback finding id (e.g. `FB-007`) for a feedback deep link. When set,
	 *  `stage` is the finding's stage scope (absent for an intent-scoped FB). */
	feedback?: string
	branch?: string
}

export function parseBrowsePath(pathname: string): BrowseLocation | null {
	const prefix = "/browse/"
	if (!pathname.startsWith(prefix)) return null
	const rest = pathname.slice(prefix.length).replace(/\/+$/, "")
	if (!rest) return null
	const segments = rest.split("/").map(decodeURIComponent)

	const intentIdx = segments.indexOf("intent")
	if (intentIdx === -1) {
		// No intent marker → the whole tail is the project path.
		return { host: segments[0], project: segments.slice(1).join("/") }
	}

	const host = segments[0]
	const project = segments.slice(1, intentIdx).join("/")
	const afterIntent = segments.slice(intentIdx + 1)
	const [intent, ...tail] = afterIntent

	// `feedback` anchor: `<slug>/[<stage>/]feedback/<id>`. The segment AFTER
	// `feedback` is the id; the segment BEFORE it (when present) is the stage.
	const fbIdx = tail.indexOf("feedback")
	if (fbIdx !== -1) {
		const feedback = tail[fbIdx + 1]
		const stage = fbIdx > 0 ? tail[fbIdx - 1] : undefined
		return {
			host,
			project,
			...(intent ? { intent } : {}),
			...(stage ? { stage } : {}),
			...(feedback ? { feedback } : {}),
		}
	}

	// No feedback marker → the classic `<slug>/[<stage>/[<unit>]]` tail.
	const [stage, unit] = tail
	return {
		host,
		project,
		...(intent ? { intent } : {}),
		...(stage ? { stage } : {}),
		...(unit ? { unit } : {}),
	}
}

export function buildBrowseUrl(loc: {
	host: string
	project: string
	intent?: string
	stage?: string
	unit?: string
	feedback?: string
	branch?: string
}): string {
	const parts = ["/browse", loc.host, loc.project]
	if (loc.intent) {
		parts.push("intent", loc.intent)
		if (loc.feedback) {
			// Feedback deep link: optional stage scope, then `feedback/<id>`.
			if (loc.stage) parts.push(loc.stage)
			parts.push("feedback", loc.feedback)
		} else {
			if (loc.stage) parts.push(loc.stage)
			if (loc.unit) parts.push(loc.unit)
		}
	}
	const url = `${parts.join("/")}`
	const q = loc.branch ? `?branch=${encodeURIComponent(loc.branch)}` : ""
	return `${url}${q}`
}
