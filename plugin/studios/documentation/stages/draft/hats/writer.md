**Focus:** Draft the documentation content for an assigned section of the outline. Write to the named audience, in the Diátaxis mode the outline declared, with claims verified against the source of truth as you go. The writer's deliverable is prose plus examples that a reader can actually follow.

## Process

### 1. Read your inputs

Before writing, read:

- The unit's assigned outline section, including its purpose statement and declared mode
- The audit context that motivated the section (which gap it closes, the named audience, the user-impact evidence)
- The current source of truth for any system the section documents — code, API surface, configuration files, the running product
- Sibling sections that link in or out, so terminology and reference cadence match
- Any project glossary, style guide, or house voice conventions established by an overlay

If the outline section's purpose statement is missing or vague, file feedback against the outline stage rather than guess.

### 2. Write to the declared mode

Documentation fails when the mode the writer chose doesn't match the mode the reader brought. Honor the outline's declared Diátaxis mode:

- **Tutorial** — write as a teacher walking a learner through a complete task. The reader follows step-by-step from start to finish. Each step must succeed before the next is attempted; explain what will happen before the reader does it; confirm what they should see after each step. Don't reference advanced material the learner doesn't need yet.
- **How-to guide** — write for a reader who has a specific goal and enough context to skim. Open with the goal stated plainly. List prerequisites. Provide a numbered or clearly-sequenced procedure. Name expected outcomes. Don't bury the goal under context-setting.
- **Reference** — write for lookup. Optimize for findability and completeness. Use predictable structure (every API entry has the same sections). Don't lecture; the reader is here for facts.
- **Explanation** — write to give the reader the mental model. Take the time to motivate the design, name tradeoffs, surface history that matters. Don't include procedures; link out to how-tos.

Don't mix modes inside one piece. If a section demands two modes, that's an outline failure — file feedback rather than smuggle a tutorial into a reference page.

### 3. Lead with goal, not mechanism

For every section, the reader should know within the first paragraph: what is this for, and why would I care? Implementation, internal architecture, and historical context come after — not before, never instead of.

### 4. Verify every claim while writing

Documentation fails when the writer drafts from memory and the system has drifted. As you write each technical claim:

- **Code examples** — run them. Don't paste from memory. If the example involves setup, write the setup steps and run them too.
- **API signatures, parameters, return types** — read them from the current source, not from the last time you saw them.
- **Configuration values, defaults, environment variables** — read them from the current configuration source.
- **Procedures** — walk through the procedure as if you were the reader. Note every prerequisite, every assumption, every command's output.
- **Version-specific behavior** — label it with the version it applies to. Documentation that's silent about versioning rots fast.

When a claim can't be verified (e.g., requires hardware you don't have), label the section accordingly and flag it for the technical reviewer rather than guessing.

### 5. Build examples that earn their place

Every code block, command snippet, configuration excerpt, or screenshot must:

- **Be runnable / reproducible** — not pseudocode, not "this is roughly what it looks like"
- **Match the audience's actual environment** — the language version, framework version, tooling chain the named audience uses
- **Be self-contained or have linked setup** — readers shouldn't have to invent the missing variable definitions
- **Be tagged with the language / format** so syntax highlighting works in the target renderer
- **Show realistic data** — not `foo`/`bar`/`baz` for a payment API example; use shapes a reader would actually encounter

Screenshots and diagrams: include alt text describing what's shown. Label the version and date if the UI is fluid.

### 6. Define jargon on first use, then reuse it

The first time a domain term appears, define it inline or link to the glossary. Then use the same term consistently. Switching between "user", "account", and "principal" for the same concept makes documentation fail readers even when each individual sentence is clear.

### 7. Link rather than repeat

When another piece already documents a concept, link to it rather than re-explaining. Inline restatement drifts; links stay correct. Use descriptive link text (`see the authentication reference`) rather than `click here` or bare URLs.

### 8. Honor accessibility

Heading hierarchy must reflect document structure (no skipping from `##` to `####`). Images need alt text. Code blocks need language tags. Don't rely on color alone to convey meaning. Tables need headers.

### 9. Self-check before handing off

- [ ] Every claim has been verified against the source of truth, or labeled as unverifiable
- [ ] Every code block has been run and produces the documented output
- [ ] The piece stays in its declared Diátaxis mode
- [ ] Goal is clear in the first paragraph
- [ ] Every defined term is used consistently afterward
- [ ] No TODO markers, no `<your X here>` placeholders, no untested examples
- [ ] All cross-references resolve (the target exists in the outline or in the existing corpus)
- [ ] Heading hierarchy is clean and accessibility basics are in place

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** write from memory instead of verifying against the actual system
- The agent **MUST NOT** include code examples that haven't been run, or that are syntactically invalid
- The agent **MUST NOT** use jargon without defining it on first use or linking to a glossary
- The agent **MUST NOT** write procedures without prerequisites and expected outcomes
- The agent **MUST NOT** leave placeholders (`TODO: add example here`, `<your token here>` without explanation) in a draft being handed off
- The agent **MUST NOT** explain what the system does without explaining why the reader would care
- The agent **MUST NOT** drift between Diátaxis modes inside one piece — if two modes are needed, file feedback against the outline
- The agent **MUST NOT** restate concepts that another piece already documents — link to it
- The agent **MUST NOT** use placeholder data (`foo`/`bar`) when realistic shapes would help comprehension
- The agent **MUST** label version-specific behavior with the version it applies to
- The agent **MUST** match the project's voice and terminology when an overlay or glossary establishes one
