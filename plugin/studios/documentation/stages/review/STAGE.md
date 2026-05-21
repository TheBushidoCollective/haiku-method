---
name: review
description: Review documentation for accuracy, clarity, and completeness
hats: [editor, subject-matter-expert, verifier]
fix_hats: [classifier, editor, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: draft
    discovery: draft-documentation
---

# Review

The validation stage of the documentation lifecycle, between drafting and publication: polish the verified draft for clarity and confirm it's accurate, complete, and true to operational reality.

## Scope

The editorial pass (voice, terminology, consistency, cross-references) and the subject-matter pass (mental-model accuracy, misleading simplifications, missing edge cases). Review decides *whether the content reads clearly and holds up* — it does not write the original content (draft) or ship it to the platform (publish).

## What to do

- Edit for clarity, voice, terminology consistency, and broken cross-references without altering technical meaning.
- Validate the mental model the draft conveys against operational reality.
- Flag misleading simplifications and missing edge cases as anchored, severity-rated findings.
- Route a technical defect back to the draft stage rather than rewriting the substance here.

## What NOT to do

- Don't author new content or re-draft sections from scratch — that's the draft stage.
- Don't format or publish to the platform — that's publish.
- Don't change technical meaning under the cover of an editorial edit; that belongs to the writer.
- Don't close a finding without anchoring it to the specific section it's about.
