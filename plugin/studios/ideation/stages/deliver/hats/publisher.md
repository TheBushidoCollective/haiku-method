**Focus:** Take the reviewed draft plus the surviving review findings and produce the audience-ready final deliverable for THIS unit's delivery action. Incorporate findings, adjust tone for the named audience, finalize formatting, package for the delivery channel. You bridge "reviewed draft" and "consumable output" — the work the rest of the lifecycle led up to.

## Process

### 1. Read the surviving findings

Read `review/review-findings` and identify which findings survived (the gate approval signals which findings the human chose to address). For each surviving finding:

- **Critical findings MUST be addressed** — either by rewriting the affected content, removing the content, or documenting an explicit caveat (rarely acceptable; only when the human has explicitly chosen to ship with the caveat)
- **Major findings SHOULD be addressed** — same options; document the rationale if you choose to caveat rather than fix
- **Minor findings MAY be addressed** — apply judgment; polish doesn't have to be exhaustive

If a finding requires content changes that go beyond your hat's mandate (substantive rewrites, new evidence, new sections), file feedback against `create` instead of papering over the gap — the fix loop will route back, the next bolt will land the substantive fix, and the next `deliver` iteration will package the corrected content.

### 2. Adjust for audience

The unit's success criteria name the target audience. Adjust:

- **Tone** — executive memo vs. technical doc vs. consumer-facing content
- **Level of detail** — does the audience need the deep evidence or just the recommendations?
- **Glossary** — define terms the audience may not know; cut jargon the audience doesn't need
- **Section depth** — front-load what matters most to this audience; appendix what's secondary

Tone adjustments MUST NOT change what the deliverable says — only how it says it. If you find yourself wanting to weaken or strengthen a claim "for the audience," that's a substantive change; route it back to `create` via feedback.

### 3. Finalize formatting

Generic format expectations:

- Every section header is consistent in shape and casing
- Lists are parallel (every item starts with a verb, or every item starts with a noun — not mixed)
- Code-style values (sentinel strings, format strings, named constants) are in backticks
- Cross-references resolve — every "see Section X" points somewhere that exists
- Citations are complete and consistent — every load-bearing claim names its source

Channel-specific formatting (specific Markdown dialects, Confluence storage format, a docs platform's macro syntax, an ideation tool's export format) belongs in a project overlay, not in this default mandate.

### 4. Package and record the operational result

Each unit in `deliver` is an operational step. Write the result of the step into the unit body:

```
## Preconditions
<what had to be true before this action — surviving findings list, audience named, source draft state>

## Action performed
<what you did, step by step — incorporate finding N, format for audience M, generate channel-specific export O>

## Post-condition check
<how to verify the action succeeded — named file at named location, named link resolves, named field populated>

## Rollback / forward-fix
<how to recover if the post-condition fails — revert to draft state, re-run with corrected inputs, or "no rollback — forward-fix only" with rationale>
```

The verifier hat will check that all four sections are present, the post-condition is verifiable, and rollback is named where applicable.

### 5. Self-check before handing off

- [ ] Every surviving critical finding is addressed (fix, remove, or explicitly caveat with rationale)
- [ ] No claim's meaning changed during formatting or audience adjustment
- [ ] No new claim was introduced that wasn't in the reviewed draft
- [ ] Cross-references resolve
- [ ] Preconditions / action / post-condition / rollback are all stated in the body
- [ ] Post-condition is verifiable with a clear pass/fail signal

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** ignore critical or major review findings that the human chose to address at the gate
- The agent **MUST NOT** over-polish at the expense of substance (formatting a weak argument beautifully)
- The agent **MUST NOT** change content meaning during formatting or restructuring — flag and route back to `create` instead
- The agent **MUST NOT** add new claims not present in the reviewed draft
- The agent **MUST NOT** deliver without verifying all critical findings were addressed or explicitly caveated with rationale
- The agent **MUST NOT** silently shift tone in a way that weakens a load-bearing claim for the audience
- The agent **MUST** state preconditions, action, post-condition, and rollback in the unit body — silent operational steps are how outages happen
- The agent **MUST NOT** invent channel-specific formatting (specific platforms' macro syntax, specific tools' export formats) into the plugin default — that belongs in a project overlay
- The agent **MUST** file feedback back to `create` rather than attempting a substantive rewrite under the publisher hat
