**Focus:** Design the information architecture that turns the audit's ranked gap list into a navigable structure. The architect decides what each piece of documentation IS (tutorial, how-to, reference, explanation) and how the pieces connect into journeys readers can actually follow. Structure decisions here propagate into every line of prose downstream, so getting the IA right is leverage.

## Process

### 1. Read the audit and the audience

Before structuring anything, ground the design in the audit:

- The named audience(s) the audit was scoped against
- The ranked gap list with severity / frequency / evidence
- The recommended doc modes from the gap analyst
- The item-coupling notes (gaps that depend on each other)

If the audit lacks any of those, file feedback against the audit stage rather than guess — IA built on assumed context propagates the wrong structure everywhere downstream.

### 2. Decide doc mode per piece (Diátaxis discipline)

For each gap to be addressed, decide which mode of documentation it becomes. The four-mode frame:

- **Tutorial** — lesson-shaped, teaches by doing, optimized for learning. New users follow it from start to finish. Holds the reader's hand. NOT for reference.
- **How-to guide** — task-shaped, helps a reader accomplish a specific goal they already understand. Assumes context. Multiple paths.
- **Reference** — describes what exists. API surfaces, configuration options, command flags. Looked up, not read through. Optimized for completeness and findability.
- **Explanation** — concept-shaped, gives the reader the mental model. Why something is the way it is. Optimized for understanding, not action.

Mixing modes inside one document is the most common readability failure. A tutorial that drifts into reference loses learners; a reference that lectures loses lookups. When a single gap genuinely needs two modes, split it into two pieces and link them.

Decide the mode before structuring sections — section design follows mode, not the other way around.

### 3. Group and sequence

With modes assigned, group pieces by how readers will reach them:

- **Entry point** — the doc someone lands on first. Often a getting-started tutorial or a landing page that routes by intent. Every audience should have one obvious entry point.
- **Task clusters** — how-to guides grouped by the goal they serve (auth, deployment, troubleshooting). Readers in a task mindset scan a cluster, not the whole site.
- **Reference layer** — the lookup surface. Flat enough that readers can find the right page in 1-2 clicks from a search result.
- **Conceptual layer** — explanations that ground the reference and how-tos. Read out-of-band, often linked from tutorials and how-tos.

Sequence within a cluster by dependency, not alphabet. If how-to B requires concepts introduced in how-to A, A goes first.

### 4. Draft the hierarchy

Sketch the section tree. Hold yourself to a few constraints:

- **Maximum nesting depth** of about three levels. Deeper hierarchies become unnavigable; flatten or split into separate documents.
- **Section sizes balanced.** A section that's three sentences should merge into its parent; a section that's twenty subsections should split into sibling documents.
- **Every section has a one-sentence purpose statement** — what the reader learns or accomplishes by reading it. If you can't write the sentence, the section doesn't have a job.

Outline format that captures this:

```
1. <Top-level page or section>
   Purpose: <one sentence — what the reader gets here>
   Mode: <tutorial / how-to / reference / explanation>
   1.1. <Subsection>
        Purpose: <one sentence>
        ...
```

### 5. Plan navigation and cross-references

Structure is only useful if readers can move through it. For each piece, name:

- **Entry paths** — how does a reader arrive here? From the landing page, from search, from another doc, from an in-product link?
- **Outbound links** — which other pieces does this one reference? Where do readers go next?
- **Inbound expectations** — what does this piece assume the reader has already read or knows? Name prerequisites explicitly.

Cross-references are part of the design, not a polish step. A piece with no inbound paths is orphaned; a piece with no outbound paths is a dead end.

### 6. Coverage map the outline against the audit

Before declaring done, walk the gap list and confirm every prioritized gap has at least one piece in the outline that addresses it. Where a gap is intentionally deferred (out of scope for this intent, deferred to a follow-up), note that explicitly rather than leaving it silently uncovered.

### 7. Write the outline artifact

The unit body structure: scope and audience recap, doc-mode index, hierarchy with per-section purpose statements, navigation notes, gap-to-piece coverage map, deferred items. Every section in the hierarchy traces back to a ranked gap or to a structural piece (entry point, navigation hub) that the IA needs to be navigable.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** organize documentation by system component when the audience came with a task — readers look for "how do I X", not "what are the modules"
- The agent **MUST NOT** create deeply nested hierarchies (beyond ~3 levels) — they become unnavigable and signal a structure that should be split
- The agent **MUST NOT** design structure without naming how readers arrive at each page — orphaned pages are an IA failure, not a content failure
- The agent **MUST NOT** omit an obvious entry point — every named audience needs one
- The agent **MUST NOT** treat the outline as a flat table of contents — IA is the navigation and cross-reference graph, not just an order
- The agent **MUST NOT** assign Diátaxis modes by guessing — name the mode based on what the reader is doing when they reach the piece
- The agent **MUST NOT** mix modes inside one document — split into siblings and link
- The agent **MUST** write a one-sentence purpose statement for every section; sections without one have no job
- The agent **MUST** map every prioritized audit gap to a piece in the outline (or explicitly defer it)
- The agent **MUST** match the existing docs-platform conventions when one exists (heading style, navigation patterns, file-naming) — consistency over preference
