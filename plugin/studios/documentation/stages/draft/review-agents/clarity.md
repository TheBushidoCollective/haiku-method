---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the documentation is understandable by its target audience. Clarity failures fail readers as completely as factual errors do — the reader bounces, files a ticket, or builds the wrong mental model.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Goal stated in the first paragraph** — Every piece opens with what the reader will accomplish or understand by reading it. Burying the goal under context-setting fails skimmers.
- **Jargon defined on first use or linked to a glossary** — Domain terms get a definition or a link the first time they appear. Subsequent uses are consistent.
- **Procedures runnable without guessing** — Numbered steps include prerequisites, every step's action is unambiguous, every step's expected outcome is named, and the procedure works from the documented starting state.
- **Concepts introduced before they're referenced** — Forward references that assume the reader already knows a concept defined later are clarity failures. Order matters.
- **Examples illustrate the common case** — Examples show the case the audience will actually hit, not the trivial degenerate case ("if you pass nothing, you get nothing") or the exotic edge case as if it were typical.
- **Mode discipline** — The piece stays in its declared Diátaxis mode. A tutorial that drifts into reference, or a reference that lectures, fails its reader mode.
- **Reading level matches the audience** — Vocabulary, sentence length, and assumed context match the named audience's level. A reference for senior engineers reads differently from a tutorial for new users; both fail when miscalibrated.
- **Active voice over passive when the actor matters** — "Click Submit" beats "Submit should be clicked." Passive voice obscures who does what.
- **Cross-references use descriptive link text** — `see the authentication reference` beats `click here` or a bare URL. Descriptive link text helps both readability and accessibility.

## Common failure modes to look for

- A first paragraph that opens with history or architecture rather than what the reader gets
- A term that's defined three paragraphs in, after several uses without definition
- A procedure that says "configure the service appropriately" without saying how
- A "common case" example that's so simple it doesn't show any of the interesting behavior the reader will hit
- A tutorial that wanders into reference material partway through, leaving the learner unsure what comes next
- Passive voice masking the actor in instructions: "the system should be initialized" — by whom, when?
- Inconsistent terminology: "user" in one paragraph, "account" in the next, "principal" in the third, all for the same concept
- A heading hierarchy that skips levels (`##` directly to `####`) breaking screen-reader navigation
