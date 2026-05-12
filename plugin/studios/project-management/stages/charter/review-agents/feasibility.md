---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the charter is operationally feasible — scope is bounded explicitly, success criteria are measurable, the governance structure can actually make decisions, and the resource envelope is real. A charter that's aspirational rather than operational sets up `plan` to fail in week one.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Scope boundary integrity** — scope has both in-scope items (specific enough to decompose into work packages) and out-of-scope items (with rationale for each exclusion). A scope expressed only as inclusions is incomplete.
- **Measurable success criteria** — every success criterion has metric + target + measurement method + named owner. Qualitative-only criteria (`"users will be happy"`, `"the system will be reliable"`) without operational definition are rejected.
- **Single accountable sponsor** — the governance section names exactly one role with sponsor authority. Committees, "the leadership team," or unnamed groups are rejected.
- **Decision-rights coverage** — decision rights are enumerated by category (scope, schedule, budget, technical approach, hiring, vendor) — not implicit. A category without a named decision-maker is rejected.
- **Resource envelope explicit** — the charter names a budget envelope, headcount envelope, or duration envelope (whichever the org uses) — not just "appropriate resources."
- **Assumptions with falsification triggers** — every assumption has a named owner and a trigger condition that would mark it false. Assumptions stated as facts are rejected.
- **Stakeholder map completeness** — each stakeholder has interest, influence, position, and engagement defined. Names without engagement plans are rejected.

## Common failure modes to look for

- Success criteria stated in solution language (`"migrate to the new platform"`) instead of outcome language (`"reduce checkout latency to < 200ms p95"`)
- Out-of-scope section missing or trivial — the most-likely sources of scope debate aren't named
- "TBD" or "to be determined" in a governance, sponsor, or decision-rights field — close the gap before approving
- Stakeholders listed by title but not by named role-holder, leaving authority ambiguous
- Constraints stated without a source (`"$500K budget"` with no name on who set the envelope)
- Assumptions phrased as facts (`"users will adopt the feature"`) rather than as testable propositions with owners
- A single accountable sponsor combined with a committee that the sponsor has to "consult" on every decision — that's a committee, not a sponsor
