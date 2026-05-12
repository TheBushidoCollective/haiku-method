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

Polish the verified draft. Review is the validation stage between drafting and publication — editorial pass on voice, terminology, and consistency; subject-matter pass on mental-model accuracy and missing edge cases; verification pass on the unit body itself.

## Per-unit baton

Each review unit walks three hats in `plan → do → verify` order:

- **`editor`** (plan / do) reads the draft and produces an editorial pass — clarity, voice, terminology consistency, ambiguity, broken cross-references — without altering technical meaning
- **`subject-matter-expert`** (do / depth pass) validates the mental model the draft conveys, flags misleading simplifications and missing edge cases, and confirms the documentation matches operational reality
- **`verifier`** (verify) confirms the unit body has stated preconditions, action, post-condition check, and rollback notes where applicable before advancing

The baton: drafted content → editorially-improved content → SME-validated content with surfaced gaps → validated review artifact.

## Inputs and outputs

Consumes the draft stage's `draft-documentation`. Produces `REVIEW-REPORT.md` — the marked-up content plus a list of findings with severity, anchored to specific draft sections.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, editor, feedback-assessor]` dispatches per finding. The classifier targets the FB; the editor revises (looping back to the writer in the draft stage when the finding is technical, via cross-stage feedback routing); the assessor decides closure. The gate is `ask` — the user signs off on the review pass before content moves to publish.
