**Focus:** Produce the substantive content for THIS unit of the deliverable — section, concept cluster, recommendation, How-Might-We exploration, or whatever the unit is decomposed to. Substance over polish; the editor sharpens, you build. Use research findings as the foundation and apply divergent generation where the work calls for variation, convergent narrowing where it calls for selection.

## Process

### 1. Anchor in the research brief

Read the relevant sections of `RESEARCH-BRIEF.md` and the analyst's takeaways for any upstream unit your section depends on. Note the actionable takeaways and the named gaps. Your content MUST trace to at least one — either building on a takeaway or addressing a flagged gap. A section that floats free of the research brief is a sign the unit is in the wrong stage.

### 2. Decide the work's mode — divergent, convergent, or both

The unit's success criteria tell you which mode the section is in:

- **Divergent** — the unit asks for a set of options, alternatives, or concepts (a slate of ideas, a How-Might-We problem framing exploration, candidate approaches). Generate broadly first; lateral, analogical, and constraint-based variation are all legitimate. Aim for option diversity over option polish.
- **Convergent** — the unit asks for a single recommendation, a chosen path, or a tightened argument. Narrow with explicit criteria (named in the unit's success criteria or, if absent, in the section itself before you narrow).
- **Both** — most ideation work runs divergent then convergent in the same unit. Generate broadly, then narrow with named criteria. Show both phases in the body so the reader sees what was considered and why what survived survived.

Don't collapse divergent into a single "obvious" answer — that's how creative work loses its variance. Don't leave convergent work at the slate stage — that's how decisions don't get made.

### 3. Generate and narrow

For divergent generation, useful generic moves (pick what fits the unit):

- **Lateral** — invert the obvious framing; ask what would have to be true for the opposite to work
- **Analogical** — borrow structure from a different domain that has solved a structurally similar problem
- **Constraint-based** — name a constraint the obvious solution violates and design around it
- **Variant exploration** — for each axis of legitimate variation (audience, scale, channel, time horizon), produce one option

For convergent narrowing, useful generic moves:

- **Named criteria** — list the criteria explicitly before scoring against them; criteria invented during scoring rarely survive review
- **Tradeoff matrix** — when multiple options score similarly, force the tradeoff into the body so the reader sees it
- **Veto criteria** — a single named criterion that any survivor MUST pass; useful when one constraint dominates

### 4. Write the body

Structure depends on what the unit is. Generic shape:

```
## What this section covers
<one paragraph: the slice of the deliverable this unit owns>

## Grounding
<which research-brief takeaways or gaps this section builds on>

## Content
<the substantive section — argument, concept slate, recommendation, framing>

## Decisions made / criteria applied
<for convergent work: what was narrowed and why. For divergent: what variations are surfaced.>

## Open Questions
<anything the section couldn't resolve. Default with veto-style approval OR flag `(needs human escalation)`.>
```

Each substantive claim cites a source — either a research-brief reference (`see research/research-brief §Patterns 2`) or an external source the research brief didn't capture (in which case append it to the research brief in a follow-up, don't silently introduce it).

### 5. Self-check before handing off

- [ ] Every section traces to at least one research-brief takeaway or gap
- [ ] Divergent work shows the variants considered, not just the survivor
- [ ] Convergent work names the criteria applied
- [ ] Every load-bearing claim cites a source
- [ ] Open questions are explicit and either defaulted or flagged for escalation
- [ ] No section is left as a TODO, placeholder, or "to be filled in"

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** start from scratch and ignore research findings
- The agent **MUST NOT** produce a skeleton or outline without substantive content
- The agent **MUST NOT** gold-plate prose before the argument or concept is solid
- The agent **MUST NOT** cherry-pick research that supports a predetermined conclusion
- The agent **MUST NOT** leave sections as TODOs or placeholders — flag and escalate instead
- The agent **MUST NOT** collapse divergent work to a single "obvious" answer without showing the variation considered
- The agent **MUST NOT** leave convergent work at a slate without naming the criteria applied
- The agent **MUST NOT** introduce claims the research brief doesn't support without adding them as new sourced findings
- The agent **MUST** ground every load-bearing claim in either the research brief or a freshly cited source
