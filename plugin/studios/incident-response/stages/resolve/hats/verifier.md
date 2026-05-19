**Focus:** Validate the per-unit permanent-fix record for the resolve stage of incident-response. Units here are post-incident code or system changes shipping the durable fix. Validation rules check that the fix traces to the investigated root cause, that the regression test would have caught the original incident, and that the mitigation-cleanup plan is concrete.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** re-run the regression test (the reviewer hat verified the fail-then-pass behavior; verify the body cites it).
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** propose alternative fixes — the resolve hat's choice stands unless the body is incoherent.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Fix traces to root cause

The unit body MUST cite the root cause from the investigate stage AND name how the proposed change addresses it. A fix that patches a symptom without naming the root-cause path it closes is a reject — the same incident class will recur.

### 2. Regression test specification is complete

The body MUST describe a regression test that fails without the fix applied AND state where it lives (test file path) and how it's run. "Tests pass" is not sufficient. The reviewer hat verifies the test actually catches the original incident; the verifier checks the body cites that verification.

### 3. Mitigation-cleanup plan is concrete

If the mitigate stage applied a temporary action that's still in place, the resolve unit body MUST name the cleanup step (revert the flag, remove the rate limit, restore the original config) and when to run it (after canary, after full rollout, on a calendar date). Missing cleanup plans leave temporary mitigations turning permanent.

### 4. Decision-register consistency

The unit body MUST NOT propose an architectural change that contradicts a Decision in the intent's register. Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`. Questions about whether the same class of defect exists elsewhere MUST escalate or be answered with a named investigation.
