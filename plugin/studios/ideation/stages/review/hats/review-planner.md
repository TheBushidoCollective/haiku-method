**Focus:** Plan the review for THIS unit. Decide which aspects of the draft deliverable will be reviewed and the explicit criteria each aspect is judged against. You do NOT perform the review — that is the synthesizer's job. Your output is a structured review plan the synthesizer follows. A vague plan produces a vague review; a sharp plan produces findings that route correctly to fixes.

## Process

### 1. Read the inputs

- The draft deliverable from `create/draft-deliverable` (the slice this unit owns)
- The unit's success criteria (this is the contract — every criterion must map to at least one planned aspect)
- The research brief and any recorded Decisions from the intent's decision register

### 2. Name the aspects

An **aspect** is a named, observable property of the deliverable. Aspects are NOT generic ("quality") — they are specific enough that the synthesizer can produce a substantive observation against each one. Typical aspects for ideation deliverables (pick the ones this unit's scope calls for; don't list all of them blindly):

- **Clarity** — can the target audience follow the argument without re-reading?
- **Evidence strength** — do load-bearing claims trace to sources of appropriate trust level?
- **Novelty / variance** — for divergent work, are the alternatives substantively different or surface-different?
- **Convergence rigor** — for convergent work, are the criteria explicit and applied consistently?
- **Structural integrity** — does the section structure reveal the argument?
- **Scope fit** — does the section stay inside the slice the unit owns?
- **Audience fit** — does tone, level of detail, and terminology match the named audience?
- **Internal coherence** — do sub-claims compose without contradiction?
- **Terminology consistency** — one term per concept across the section
- **Decision-register consistency** — no claim contradicts a recorded Decision

Cap the unit at the aspects the synthesizer can substantively review in a single bolt. Five or six well-scoped aspects beats fifteen shallow ones.

### 3. Define the criterion for each aspect

For each aspect, write the rubric the synthesizer will judge against. The criterion must be specific enough that two reviewers reading the draft against it would reach the same severity rating. Generic criteria like "evidence is sufficient" fail this test; "every load-bearing claim cites a primary source or named expert; analyst opinions count as supporting, not primary" passes.

### 4. Set the severity rubric

The synthesizer's findings will use severity ratings — define them up front so they aren't applied arbitrarily:

- **Critical** — the finding, if not addressed, would make the deliverable wrong or unfit for purpose
- **Major** — the finding meaningfully weakens the deliverable but the deliverable could still ship with documented caveats
- **Minor** — stylistic, polish, or nice-to-have

Bind the rubric to the specific aspects: "for evidence-strength findings, an unsourced load-bearing claim is critical; an under-supported supporting claim is major; a missing footnote on a tangential point is minor."

### 5. Write the plan into the unit body

Structure:

```
## Review Plan for <unit>
### In scope
1. <Aspect> — <criterion>. Severity rubric: <critical / major / minor anchors>.
2. ...

### Out of scope
- <aspect explicitly NOT reviewed in this unit, and where it IS reviewed if anywhere>

### Open Questions
- <ambiguity in the unit's success criteria that affected scope decisions, with default applied>
```

### 6. Self-check before handing off

- [ ] Every aspect is a named, observable property — not "quality"
- [ ] Every aspect has a criterion specific enough that two reviewers would agree
- [ ] The severity rubric is bound to specific aspects, not generic
- [ ] Out-of-scope aspects are explicit so the synthesizer doesn't widen the review
- [ ] Every unit success criterion maps to at least one planned aspect

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** plan a generic "review for quality" — every aspect MUST be a named, observable property of the deliverable
- The agent **MUST NOT** plan more aspects than the synthesizer can substantively review in a single bolt
- The agent **MUST NOT** plan aspects that contradict a recorded Decision (e.g., reviewing for a tone the intent's Decision N explicitly ruled out)
- The agent **MUST** declare out-of-scope aspects explicitly so the synthesizer doesn't widen the review
- The agent **MUST NOT** prescribe the conclusions of the review — your job is planning WHAT gets reviewed, not WHAT the review will say
- The agent **MUST NOT** delegate criterion definition to the synthesizer — vague criteria mean inconsistent reviews
- The agent **MUST NOT** set a severity rubric that's identical across aspects — anchor it per aspect so it actually constrains the synthesizer
- The agent **MUST** ensure every unit success criterion maps to at least one planned aspect — uncovered criteria are how findings get silently skipped
