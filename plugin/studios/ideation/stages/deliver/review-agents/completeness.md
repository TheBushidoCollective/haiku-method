---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the final package is complete, audience-ready, and free of draft residue. Completeness is the lens — partial deliverables that ship with placeholders, broken links, or unresolved findings damage the deliverable's credibility before the substance is even read. This is the last lens before the deliverable becomes the work-of-record.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **No placeholder content** — No `TODO`, `FIXME`, `<bracketed placeholder>`, or "to be added" markers remain in the deliverable. Draft-only annotations were left behind.
- **All sections referenced exist** — Every "see Section X" / table-of-contents entry / appendix reference resolves to a section that actually exists in the final form.
- **All citations resolve** — Every external link is reachable (not 404, not behind broken auth), every internal cross-reference points somewhere valid, every cited source's named anchor exists.
- **Formatting consistent and channel-appropriate** — Header casing, list parallelism, code-style values in backticks, image alt text, anchor IDs — all consistent across the deliverable. Channel-specific formatting matches what the delivery channel actually renders.
- **Surviving review findings addressed** — Every critical or major review finding that the human chose to address at the gate is either resolved in the final deliverable or explicitly caveated with rationale in the body.
- **Attribution complete** — Every load-bearing claim has its source in a citation, footnote, or attribution appendix per the delivery channel's conventions.
- **Per-unit operational completeness** — Each `deliver` unit body has preconditions, action, post-condition, and rollback (or explicit "no rollback" rationale) populated.

## Common failure modes to look for

- A "TBD: insert chart here" placeholder that survived because the draft chart was incomplete in `create`
- A table of contents entry that points to a section that was renamed or removed during `deliver`
- A reference to a research source whose URL stopped working between research and delivery (the brief was retrieved at date X, the link rotted by date Y)
- A formatting inconsistency where the first three sections use sentence-case headers and the rest use title-case
- A surviving critical finding that the publisher quietly applied a tone adjustment to instead of actually fixing
- A post-condition check that says "verify the file looks right" instead of naming what specifically the verifier should see
