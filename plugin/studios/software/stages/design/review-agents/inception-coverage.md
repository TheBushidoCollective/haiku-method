---
interpretation: lens
---
**Mandate:** The agent **MUST** audit design-stage artifacts against inception artifacts to ensure decisions are honored, UI surfaces are covered, and resolved questions are not re-opened.

## Step 1 — Discover inception artifacts

The agent **MUST** dynamically enumerate inception artifacts — do **NOT** hardcode file paths. Perform the following enumeration at the start of every run:

1. Collect all files under `.haiku/intents/{slug}/knowledge/` (recursively).
2. Collect all files under `.haiku/intents/{slug}/stages/inception/` (recursively), if the directory exists.

**Short-circuit on missing inception:** If neither location yields any files, emit a single info-severity note:

> "Inception not run for this intent — coverage audit skipped."

Then return cleanly with **no blocking findings**. This makes the agent safe to use in single-stage / quick-mode intents where inception was not run.

## Step 2 — Classify inception artifacts by content

Read each file in full. **MUST NOT** infer content from filenames — classify by heading scan and section text:

- **Decisions** — any heading or section text containing `decision`, `decided`, `resolved`, or `## Decisions`.
- **Open questions** — any heading or section text containing `open question`, `unresolved question`, or `## Open Questions`.
- **UI surfaces** — any heading or section text containing `ui surface`, `affected surface`, `ui impact`, or `## UI Impact`.
- **Constraints / risks** — any explicit constraint or risk statement.

When `DISCOVERY.md` is the only inception artifact, all four roles will be subsections within it. Extract each role by section — do **NOT** treat the whole file as a single block.

**Short-circuit on unclassifiable inception:** If inception files exist but Step 2's heading scan finds zero hits across all four roles (decisions, open questions, UI surfaces, constraints/risks), emit a single warning-severity note:

> "Inception artifacts present but use non-standard headings — coverage audit cannot classify content. Reviewer recommends running classification heuristics by hand or aligning inception to the canonical DISCOVERY.md template."

Then return cleanly with **no blocker findings** (the warning above is the sole emission). This prevents a flood of false-positive scope-creep findings on intents whose inception used custom heading vocabulary.

## Step 3 — Read design-stage outputs

The agent **MUST** dynamically enumerate the following design output locations and read each that exists:

- Every file under `.haiku/intents/{slug}/stages/design/artifacts/`
- `.haiku/intents/{slug}/stages/design/DESIGN-BRIEF.md`
- `.haiku/intents/{slug}/knowledge/DESIGN-TOKENS.md`
- `.haiku/intents/{slug}/knowledge/DESIGN-SYSTEM-ANCHOR.md`

**Short-circuit on no design output:** If none of the above paths exist, emit a single info-severity note:

> "Design stage has produced no readable artifacts yet — coverage audit skipped."

Then return cleanly with no blocker findings. This is the safe state for an intent that has not yet executed the design stage.

**MUST NOT** summarize inception artifacts — read them in full on each audit pass.

## Step 4 — Emit findings

When inception artifacts ARE present, emit a `haiku_feedback` finding for each of the following failure modes:

### Decision violation — severity: **blocker**
The design contradicts a decision extracted from inception.

Every finding body **MUST** include:
- Inception artifact path + line range (or `(decision: <text>)` for inline-extracted decisions)
- Design artifact path + line range (or screen ID) where the violation occurs
- One-line recommendation: revisit inception decision, revise design, or escalate to human review

### Surface gap — severity: **blocker**
A UI surface listed in inception is not represented in the design artifacts.

Every finding body **MUST** include:
- Inception artifact path + the passage that names the surface
- What design artifacts were checked and which surface is absent
- One-line recommendation: add the missing surface or confirm it is intentionally deferred

### Resolved-question regression — severity: **blocker**
The design re-introduces a question that was already settled in inception.

Every finding body **MUST** include:
- Inception artifact path + the passage where the question was resolved
- Design artifact path + the passage that re-opens it
- One-line recommendation: align design with the settled answer or escalate for explicit re-decision

### Scope creep — severity: **warning**
The design covers a surface or feature that inception did NOT list. May be legitimate but requires human triage.

Every finding body **MUST** include:
- The specific inception artifact passage that omits the surface (do **NOT** flag scope creep without naming this passage)
- Design artifact path + the passage that introduces the unlisted surface
- One-line recommendation: confirm alignment with inception scope or create a follow-on intent

## Anti-patterns (RFC 2119)

- `MUST NOT` hardcode **inception** artifact filenames — Step 1 discovers them dynamically because inception's filenames are agent-authored and vary per intent. (Design-side artifact paths in Step 3 are stable by contract — those listed paths are the canonical locations declared by their discovery templates and may be referenced directly.)
- `MUST NOT` summarize inception artifacts — read them in full per audit pass
- `MUST NOT` infer coverage from titles or filenames — diff actual content
- `MUST NOT` flag scope-creep without naming the specific inception artifact passage that omits the surface
- `MUST` short-circuit cleanly when inception is absent
