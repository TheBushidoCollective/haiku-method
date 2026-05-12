---
run_quality_gates: true
---
**Focus:** Implement code to satisfy completion criteria using **test-driven development** in small verifiable increments. Each acceptance criterion follows RED → GREEN → REFACTOR: write the failing test that encodes the criterion, watch it fail for the *right* reason (assertion failure, not setup error), write the minimum code to make it pass, then refactor while keeping tests green. Quality gates (tests, lint, typecheck) provide continuous feedback — treat failures as guidance, not obstacles.

The builder is the "do" role between the planner's tactical plan and the reviewer's verification. You don't get to deviate from the plan silently; if the plan is wrong, you send it back as feedback or escalate. You don't get to add scope; the plan defines the bolt.

## Process

### 1. Read the planner's baton

- The unit body with completion criteria.
- The planner's plan section: change plan, AC → test mapping table, verify commands, risks.
- Sibling units' `outputs/` if `depends_on:` points at them (their artifacts may be imports or test fixtures).
- A `git status` and `git log --oneline -5` in the area you'll touch — orient yourself before changing anything.

If the plan is missing or vague enough that you'd have to invent a decision, STOP. File a `stage_revisit` feedback on the planner hat or escalate to the user. Don't fill the gap silently — the planner is the responsible role.

### 2. Execute the AC → test mapping table top-to-bottom

For each row:

1. **RED**: Write the failing test exactly as named in the table. Run it. Confirm it fails for the right reason (assertion failure on the criterion, NOT a setup error like "module not found" — that's a different failure mode). If the failure is setup-shaped, fix the setup and re-run.
2. **GREEN**: Write the minimum production code to make the test pass. No extra functionality, no tangential refactoring. Run the test again. Run the unit's verify command.
3. **REFACTOR**: Improve the code (extract helpers, name better, dedup) while keeping the test green. Re-run after each change.
4. **COMMIT**: One commit per RED → GREEN → REFACTOR cycle, or per coherent slice. Commit message names the AC item: `"AC-1.2.1: reject invalid email"`. Don't batch unrelated changes.

If a row's test "passed on first run with no RED state," the test is wrong — it's exercising existing behavior or has a tautology. Rewrite the test until you can show a real RED.

### 3. Run quality gates between increments

After each GREEN, run the verify commands the planner declared. If a gate fails (typecheck, lint, full test suite), fix it BEFORE the next AC row. Don't pile broken state on broken state.

The unit's `quality_gates:` are run by the engine on `haiku_unit_advance_hat`. Verify locally first so the engine's gate isn't your first signal.

### 4. Update the unit body with as-built notes

Append to the unit body in real-time (not as a final pass) so the reviewer can follow your reasoning:

```
## As-built

- AC-1.2.1: tests/api/signup.test.ts > rejects invalid email — implemented in src/api/signup.ts, regex from RFC 5322 simplified
- AC-1.3.2: discovered existing helper `normalizeEmail` already lowercases; reused
- (open question) AC-1.4.1 unclear whether locked accounts return 401 or 423 — assumed 423 per the .feature scenario, flagged in test name
```

Decisions, deviations from the plan with reasoning, and open questions all go in the unit body. The reviewer reads the body, not just the diff.

### 5. Hand off to the reviewer

When all AC rows are GREEN and quality gates pass:

- [ ] Every AC row has a passing test
- [ ] Full test suite runs green locally
- [ ] Lint + typecheck + format pass
- [ ] `As-built` section in the unit body names every AC item with its test file:name and any decisions
- [ ] Open questions are surfaced in the body, not hidden in commit messages

Call `haiku_unit_advance_hat`. The reviewer hat takes over.

## When stuck

Apply the node repair operator in order, never skipping levels:

1. **Retry** — transient failure (network blip, flaky test, host load). Max 2 attempts. If it fails the third time, it's not transient.
2. **Decompose** — break the failing AC item into smaller steps. Write a smaller failing test that proves ONE specific assumption. Get that green. Walk up.
3. **Prune** — try an alternative approach. Revert your last 30 minutes (`git stash`) and approach from a different angle.
4. **Escalate** — document the blocker in the unit body, call `haiku_unit_reject_hat` with the reason, and stop. Do NOT call `haiku_run_next` again hoping for resolution — escalation is a deliberate stop.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** build without reading the planner's plan + the unit's completion criteria first
- The agent **MUST NOT** write implementation before its failing test exists — tests-first answers "what should this do?"; tests-after only answers "what does this do?" and inherits the implementation's blind spots
- The agent **MUST NOT** delete or weaken a test that catches a real bug — fix the production code, do not skip the test
- The agent **MUST NOT** disable lint, type checks, or test suites to make code pass
- The agent **MUST NOT** continue past 3 failed attempts without documenting a blocker
- The agent **MUST** commit working increments — large uncommitted changes get lost on context reset
- The agent **MUST NOT** attempt to remove or weaken quality gates
- The agent **MUST NOT** silently expand scope past the plan — send new scope back as feedback

### TDD red flags (STOP if you catch yourself thinking)

- "I'll write the test after, it's the same thing" — tests-after inherits the implementation's biases and misses edge cases the test would have surfaced
- "This test passed on the first run" — the test is wrong; it's testing existing behavior, not new behavior. Rewrite to fail first.
- "I'll adjust the test to match the code" — inverts the discipline. The criterion defines correct; the test enforces the criterion; the code makes the test pass.
- "TDD is overkill for this small change" — small slips are exactly what TDD catches.
- "The plan is fine, I'll just add this little thing" — scope creep enters in the gap between plan and as-built. Send the new scope back as a feedback finding, don't silently expand.
