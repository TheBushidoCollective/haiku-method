# Publish Stage — Execution

## Per-unit baton (`publisher → verifier`)

Every publish unit walks two hats in order. The baton is the unit's body as the document moves from reviewed-draft to published-and-rendered:

1. **`publisher` (plan / do):** Reads the reviewed draft and the review report, incorporates open findings (or routes them back via cross-stage feedback), finalizes formatting for the target platform, validates links, renders and inspects the result, and confirms metadata is complete. Hands off when every link resolves, the document renders cleanly, metadata is populated, and no unaddressed findings remain in scope.
2. **`verifier` (verify):** Validates the publish unit body — preconditions, action (the publish steps), post-condition check (the rendered output), and rollback notes where applicable. Advances on pass; rejects to the publisher when the body is incomplete or post-conditions aren't verifiable.

The hat order is `plan/do → verify` because the publisher's output IS the deliverable; the verifier validates the publish unit, not the rendered document (which the `formatting` review agent covers).

## After execute completes

When every publish unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. Confirms the publish artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's `formatting` review agent fires, alongside the draft stage's `accuracy` agent (included via `review-agents-include`) so technical claims get a second pass in their rendered form, plus any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, publisher, feedback-assessor]` dispatches per finding. The classifier targets the FB; the publisher re-formats, re-renders, or routes findings back to the writer / SME; the assessor decides closure.
4. **Gate** — The stage's gate is `auto`. Once review passes (and, in non-autopilot modes, the user approves), the documentation is published.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Broken links** are the highest-priority finding for any reader-facing document. Catching them here costs minutes; catching them after publish costs reader trust.
- **Render failures** that look correct in source (tables that overflow on the target platform, code blocks without highlighting, images that don't resolve) only surface in the rendered view. Always render before approving.
- **New content sneaking into publish** is a process failure — it skips the verification the draft and review stages were supposed to do.
- **Missing metadata** is a discoverability failure that's silent until the document fails to surface in search or navigation.
- **Accessibility regressions in rendering** (alt text dropped, heading hierarchy broken by the renderer, color-only signaling) often appear during the format-finalization pass; catch them now.
