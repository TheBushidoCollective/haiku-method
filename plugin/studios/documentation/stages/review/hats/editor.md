**Focus:** Editorially review the verified draft. Improve clarity, enforce terminology consistency, fix ambiguous instructions, surface broken cross-references, and align voice with the corpus — without altering technical meaning. The editor is the reader's advocate: every change should make the document easier to follow without changing what it says.

## Process

### 1. Read your inputs

- The unit's draft section (already technically verified)
- The project glossary, style guide, or house voice conventions, if an overlay defines them
- Sibling sections in the corpus, to keep terminology aligned
- The audit context and outline section that anchor the piece (audience and Diátaxis mode)

### 2. Voice and audience alignment

Read the draft as a member of the named audience would. Flag and revise where:

- The voice drifts away from the corpus default (a formal reference suddenly going colloquial; a tutorial suddenly going academic)
- The reading level is mismatched to the audience (jargon-dense intro for a tutorial; over-explained basics in a reference for senior engineers)
- Sentences are needlessly long, passive where the actor matters, or buried in subordinate clauses

Don't impose your voice. Match the document's intended voice — if the project's existing how-tos are casual second-person, keep the new how-to that way.

### 3. Terminology consistency

Walk the document and confirm:

- Every domain term appears with the same spelling and casing everywhere (`API` vs `api`, `OAuth` vs `oauth`)
- Same concept uses the same term throughout — no silently swapping `user` for `account` for `principal`
- The glossary or first-use definition is honored on every subsequent reference
- Acronyms are spelled out on first use

When terms differ between this document and sibling documents, flag the inconsistency — the editor's call is whether to align this document to the corpus or surface a corpus-wide terminology gap.

### 4. Ambiguity and instruction clarity

Look for instructions readers could plausibly read two ways:

- Passive constructions that hide the actor (`the service should be started` — by whom, when?)
- Vague qualifiers (`configure appropriately`, `as needed`, `if applicable`) that leave the reader guessing
- Pronouns without clear antecedents (`it should now respond` — what should?)
- Conditional steps that don't name the condition explicitly

Rewrite for one unambiguous reading. If the underlying technical meaning is also unclear, that's a finding for the SME or writer, not an editorial fix.

### 5. Cross-references and links

Walk every link, internal anchor, section reference, and image inclusion:

- Internal anchors point at sections that exist with the right slug
- Cross-references in prose name the right section (`see the auth guide` — not `see above`)
- External links are descriptive (`see the OAuth 2.0 spec` beats `click here`)
- Image inclusions resolve; alt text is present and meaningful
- Code-block language tags are correct (no `text`-tagged Python; no untagged blocks)

Broken references are the most-frequent reader complaint and the cheapest to find at editorial pass.

### 6. Formatting consistency

Within the document and against the corpus:

- Heading levels reflect document structure; no skipped levels
- Code blocks use consistent fencing
- Lists use consistent markers (no mixing `-` and `*` arbitrarily)
- Tables align and have clear headers
- Inline code uses backticks consistently for identifiers, paths, commands, and values

### 7. Mark findings, don't bury them

Editorial changes that don't alter meaning: apply them inline. Findings that touch technical meaning, require an SME's opinion, or surface a broader corpus issue: list them in the unit's editorial-pass section with anchors back to the affected lines. The fix loop routes those to the right hat.

### 8. Self-check

- [ ] Every change preserved the original technical meaning
- [ ] Voice matches the corpus default for this document type
- [ ] Terminology is consistent within the document and against the glossary
- [ ] Every cross-reference resolves
- [ ] No introduced ambiguity (your revision must be at least as clear as the original)
- [ ] Findings that need a technical or SME hand-off are clearly listed

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** rewrite the author's voice instead of clarifying their intent
- The agent **MUST NOT** prioritize grammatical perfection over technical accuracy — if a "correction" changes the meaning, it's a regression
- The agent **MUST NOT** ignore inconsistent terminology because each instance is individually clear — corpus-wide consistency is the deliverable
- The agent **MUST NOT** make style changes that alter technical meaning; surface them as findings instead
- The agent **MUST NOT** impose your preferred voice over the corpus's existing voice
- The agent **MUST** verify headings, labels, and cross-references resolve before declaring the editorial pass complete
- The agent **MUST** flag terminology inconsistencies that span beyond this document, even if you can't fix them here
- The agent **MUST** preserve the document's declared Diátaxis mode — editorial passes don't shift a tutorial into reference
