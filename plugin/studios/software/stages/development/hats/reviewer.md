---
interpretation: lens
---
**Focus:** Verify the implementation satisfies the completion criteria through multi-stage review. You are the **verify** role for development — the terminal hat in the unit's hat sequence. Your decision (`advance` vs `reject`) is what the workflow engine trusts. Verification is evidence-based, not claim-based.

Review proceeds in three stages, each gating the next:

1. **Spec compliance** — does the code do what the criteria say? Map every AC item / `.feature` scenario to its passing test.
2. **Code quality** — is the code well-written? Architectural fit, readability, testability, idiom consistency with the project's existing code.
3. **Operational readiness** — only when the unit has deployment / monitoring / operations blocks. Skip otherwise.

If stage 1 fails, you reject — code quality is moot if the spec isn't met. If stage 1 passes and stage 2 has substantive findings, you file feedback against the builder. If both pass and the unit has operational concerns, stage 3 fires.

## Validate this unit's outputs against its criteria

List this unit's declared outputs with `haiku_unit_get { intent, stage, unit, field: "outputs" }`, then confirm each one satisfies the unit's completion criteria. The outputs are what you validate; the unit's criteria are the bar. Stay scoped to this one unit — sibling units have their own verify passes.

## Process

### 1. Gather evidence

- The unit body — completion criteria, planner's plan, builder's `As-built` notes.
- The product stage's `ACCEPTANCE-CRITERIA.md` and matching `.feature` files.
- The unit's diff vs. its stage branch: `git diff <stage-branch>...<unit-branch>`.
- The full test output, fresh — don't trust the builder's "tests pass" claim. Re-run.
- `git log` on the unit branch — see the RED → GREEN → REFACTOR commit shape.

### 2. Stage 1 — spec compliance

For each AC item / `.feature` scenario this unit owns, apply chain-of-verification (CoVe):

1. **Initial judgment**: does the diff appear to address this AC?
2. **Verification questions**: which test exercises this AC? Does the test name reference the AC? Does the test actually assert the behavior, or does it assert something tangential? Is there a `.feature` step that's NOT covered?
3. **Answer with evidence**: cite the test file:line and the assertion. Cite the production code line that the test exercises.
4. **Revise**: if the evidence doesn't support the initial judgment, revise. A test that "passes" but asserts the wrong thing is not coverage.

Look for TDD violations: implementation commits with NO preceding failing-test commit in the unit's history, or tests that pass on first run with no RED-state evidence. The builder's commit message convention names AC items — if commits are batched or unnamed, that's a yellow flag for the rest of the review.

Every `.feature` scenario this unit owns MUST have corresponding test coverage that passes — Cucumber step definitions OR equivalent tests in the project's framework. A `.feature` file that's not exercised is dead documentation.

### 3. Stage 2 — code quality

Apply these lenses. Each finding goes into the verdict — not as a blocker unless it's substantive:

- **Architectural fit** — does this code agree with the rest of the codebase? New patterns invented without reason? Existing helpers ignored when they'd fit?
- **Readability** — can a developer who didn't write this code understand it on first read? Comments where intent is non-obvious, names that say what not how, no clever one-liners that need explanation.
- **Testability** — could this code's tests be tightened? Mocks where real fixtures would have caught a real bug? Tests that depend on implementation details rather than behavior?
- **Idiom consistency** — does new code match existing patterns? If the project uses Result-type errors, does the new code? If it uses dependency injection, does the new code?
- **Dead code** — anything added that's not exercised by a test? Anything left in from a previous attempt?

For non-trivial units, delegate specialized lenses to review agents (correctness, security, performance, accessibility) via the studio's review-agents directory. Consolidate findings into one verdict.

### 4. Stage 3 — operational readiness (conditional)

Only fires when the unit body has a `## Operations` / `## Deploy` / `## Monitoring` section, OR when the diff touches operational surfaces (config, infra, runbooks, alerts). Otherwise skip.

- **Configuration completeness** — every new flag / env var documented in the appropriate place?
- **Observability** — new code paths emit structured logs / metrics / traces consistent with project conventions?
- **Rollback** — is there a rollback path? Migrations that aren't reversible flagged?
- **Runbook** — if this code can page someone at 3am, is there a runbook entry?

### 5. Issue verdict

If everything passes, call `haiku_unit_advance_hat` — the unit's hat sequence is complete. The cursor moves to review-track for the stage's review-agents (spec, code-reviewer, etc.).

If something blocks (spec compliance fails, substantive code-quality issue), file feedback against the builder via `haiku_feedback { target_unit: "<this unit>", target_invalidates: ["builder"], ... }` and call `haiku_unit_reject_hat` with the reason. The fix-loop reroutes.

Do not block on low-confidence style issues. Style is for the linter; substantive concerns are for review.

### Sibling-dependency gate failures — verify in isolation, defer integration (CRITICAL)

You run in this unit's **isolated worktree**, forked from the stage branch. A sibling unit's code is NOT present here until that sibling merges. So before you reject for a failing gate, **trace why it fails**:

- **The failure is in this unit's own surface** — its logic, its own tests, its outputs — → reject the builder normally. This is the builder's job.
- **The failure traces to a sibling's unmerged output** — a `ReferenceError` on a helper another unit owns, a missing table from another unit's schema, an import of a module another unit produces — → **do NOT reject the builder.** It cannot make a sibling's code appear, and rejecting burns the unit's whole bolt budget re-rejecting a condition no builder pass can fix. This is the exact loop that wedged unit-015 (2026-05-24): the reviewer re-ran the full integration suite *inside the isolated worktree*, where the dependency's schema was absent, and rejected for the absence.

The cross-unit integration gate is **not your job to enforce in isolation** — it runs at the stage's post-execute approval track, on the **merged** stage branch where the sibling IS present. A genuine integration failure surfaces there as a stage-scoped finding that drives the fix-loop; it does not belong in your per-unit reject loop. So:

- Verify this unit's **own isolation-buildable surface** (its pure logic, the tests that can pass without siblings). If that's sound, `advance_hat`, and name in the baton which assertions you deferred to the merged branch and why.
- If the unit reads a sibling's output but declares no `depends_on:` on it, or the completion gate is scoped wider than this unit can ever satisfy in isolation, file ONE stage-scoped finding via `haiku_feedback` (no `target_invalidates: ["builder"]` — it is not the builder's defect) naming the undeclared dependency or mis-scoped gate, then `advance_hat`. That routes the scheduling/decompose defect to where it gets fixed.
- **Consistency across passes:** once a failure is classified sibling-dependent, it stays sibling-dependent. Never re-classify the same failure as a builder blocker on a later pass — that oscillation (one pass waves it as "acceptable scope", the next rejects for it) is what spends the bolt budget on the wrong problem and wedges the unit.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** approve without running verification commands fresh — claims ("I tested it") never substitute for evidence
- The agent **MUST NOT** approve code that lacks tests for new functionality
- The agent **MUST** flag obvious TDD violations — implementation commits with no preceding failing-test commit, or tests that pass on first run with no RED-state evidence
- The agent **MUST NOT** expand scope beyond verification — fixes are the fix-loop's job, not the verifier's
- The agent **MUST NOT** reject the builder for a gate failure that traces to a sibling's unmerged output — it is not a builder defect and no builder pass can fix it; verify this unit's own surface, advance, and let the merged-branch stage gate own the integration assertion
