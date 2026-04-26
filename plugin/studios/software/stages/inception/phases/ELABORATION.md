# Inception Stage — Elaboration

Inception is a **research / distillation** stage. Its units are knowledge topics, not execution specs. Each unit produces one knowledge artifact that downstream stages (`product`, `design`, `development`, etc.) consume as input.

## What a unit IS in this stage

One investigable knowledge topic. Examples:
- "Competitive landscape for the addressed problem"
- "Existing user persona and pain map"
- "Technical landscape: relevant existing systems and their constraints"
- "Origin and business motivation"
- "Success criteria — outcome metrics and functional capabilities"
- "Risk inventory and mitigation surfaces"

What a unit is **NOT** in this stage:
- ❌ A code module to build (those are execution specs — `software/development` authors them in its own elaborate phase)
- ❌ A database schema, API endpoint, or migration plan (technical-design artifacts — `software/design` owns these)
- ❌ A Gherkin scenario or acceptance-criteria spec (PRD-style artifacts — `software/product` owns these)

If you find yourself drafting `depends_on:`-heavy execution DAGs or `quality_gates:` with shell commands, you're authoring the wrong stage's units. Stop and ask whether the work belongs downstream.

## What "completion criteria" means here

Knowledge-artifact criteria are about **substance and accountability**, not executability. Acceptable shapes:

### Good criteria — substantive and checkable

- "Document names ≥3 alternatives the user could buy instead, with a one-paragraph differentiation per alternative"
- "Persona section names primary user, secondary user, and one user explicitly out of scope"
- "Risk inventory lists ≥5 distinct failure modes with severity (low/med/high) and detection signal"
- "Each cited source is a specific URL, doc path, or stakeholder conversation date — not 'industry common knowledge'"
- "Open questions section has ≥0 entries; each open question has a proposed default for veto-style approval OR a `(needs human escalation)` flag"

### Bad criteria — vague or build-class language wrongly applied

- ❌ "Domain is understood" (no concrete check; "understood" by whom?)
- ❌ "Discovery is complete" (tautological)
- ❌ "Each unit has 3-5 completion criteria, each verifiable by a specific command or test" — execution-spec language; inception artifacts are not testable by command
- ❌ "Database schema is defined" — wrong stage; defer to design/development
- ❌ "Implementation passes the test suite" — there is no implementation in inception

## How verification happens

Knowledge artifacts are validated by the verifier hat (see `hats/verifier.md` once added). The verifier checks **substance, completeness, citation quality, and internal consistency** — body-content checks only, no frontmatter interpretation.

Frontmatter for inception units stays minimal — `depends_on:` is allowed when one knowledge topic genuinely informs another (e.g., "competitive landscape" feeds "differentiation analysis"), but most inception units are independent and run in parallel.

## Anti-patterns

- **Mixing knowledge and execution specs in one stage.** If you find a unit drifting into "implement X" language, split it: keep the inception unit at the knowledge level ("specify what X needs to do at a behavior level") and let the downstream stage author the execution spec.
- **Single-document syndrome.** Producing one giant "discovery document" with 7 sections defeats the per-unit model — each section can't be revisited or rejected independently. One topic per unit.
- **Skipping citation.** Knowledge artifacts without sources are opinions; the verifier rejects them.
