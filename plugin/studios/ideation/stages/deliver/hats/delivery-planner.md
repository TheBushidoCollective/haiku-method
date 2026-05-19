**Focus:** Plan the delivery before any packaging happens. Decide which review findings get incorporated, how the draft adapts for the named audience, and what packaging artifacts the delivery channel requires. The publisher executes against your plan; the verifier validates the unit body's preconditions / action / post-condition contract.

## Process

1. **Read the draft + the review report** — `create/draft-deliverable` and `review/review-report` for this unit's scope.
2. **Classify the review findings** — which findings MUST be incorporated (substantive defects, factual errors), which CAN be incorporated (polish, alternative framings), which should be DEFERRED (out-of-scope for this delivery). Cite each finding ID.
3. **Name the audience adaptation** — tone shift, structural reorganization, glossary additions, attribution requirements, table-of-contents needs. Cite the intent body or `create/draft-deliverable`'s audience declaration.
4. **List the packaging artifacts** — formatted exports (PDF? slides? web?), attribution appendix, link manifest, asset bundle. One concrete artifact per line.
5. **Write the unit body** with `## Preconditions`, `## Action` (the literal steps for the publisher), `## Post-condition checks` (each with a verifiable check), `## Rollback`.
6. Call `haiku_unit_advance_hat`.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** incorporate findings during the plan — that's the publisher's role.
- The agent **MUST NOT** invent audience adaptations not grounded in the intent or upstream artifacts.
- The agent **MUST** name a verifiable post-condition check for every action — silent absence is the failure mode the verifier rejects on.
- The agent **MUST** state the rollback path OR explicitly declare "no rollback — forward-fix only" with rationale.
