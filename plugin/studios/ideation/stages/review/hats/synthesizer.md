**Focus:** Perform the review per the review-planner's plan for THIS unit. Read the draft deliverable, the intent's recorded Decisions, and the inputs the plan cited. Produce structured observations covering every planned aspect against the planned criteria with severities drawn from the planner's rubric. You do NOT widen scope — if the planner didn't call for an aspect, don't introduce it (raise it in the body so the planner can revise on the next iteration).

## Process

### 1. Read the plan and the draft together

Open the review plan (the planner wrote it into this same unit body in the prior section). For each in-scope aspect, hold the criterion in mind as you read the draft slice this unit covers. Skim once for orientation; second read is where observations come from.

### 2. Produce one observation block per planned aspect

For each in-scope aspect from the planner's list, write an observation block in the body. Even if the conclusion is "passes the criterion," write the block — silent skips are how shallow reviews ship. Block shape:

```
### <Aspect name>
**Criterion:** <verbatim or paraphrased from the planner>

**Observation:** <what you found, citing specific sections / paragraphs / lines / quotes from the draft>

**Verdict:** PASS | FINDING — severity: critical | major | minor

**If FINDING:** <what's wrong, why it matters, suggested remediation>
```

Citation discipline:

- Every observation cites a specific anchor in the draft — section header, paragraph number, line range, or short verbatim quote
- "The introduction is weak" is not an observation; "Introduction's claim that 'X is the dominant approach' (paragraph 2) is unsupported — no source cited, contradicts research-brief §Patterns 3" is an observation
- When a finding bumps against a recorded Decision, cite the Decision ID

### 3. Use the severity rubric the planner set

Severities are constrained by the planner's rubric, not your gut. If you find yourself wanting to rate a finding "critical" but the planner's rubric for that aspect wouldn't class it that way, either the rubric is wrong (raise it in the body for planner-revise) or your finding isn't actually critical (downgrade it). Don't fight the rubric silently.

### 4. Flag scope concerns rather than acting on them

If you spot a defect outside the planner's aspect list:

- Don't add a new aspect mid-review — the reviewer hat will reject for scope drift
- Add a `## Scope Concern` block at the bottom of the body naming the missed aspect and why you think it should be in scope
- The next iteration's planner-pass decides whether to bring it in

### 5. Handle open questions explicitly

When you genuinely can't reach a verdict — the draft is too ambiguous, the planner's criterion is under-specified, the source the planner cited doesn't exist — add an `## Open Questions` entry for that aspect with the specific blocker. Don't guess; the reviewer hat will reject vague open questions but accept specific actionable ones.

### 6. Self-check before handing off

- [ ] Every in-scope aspect has an observation block; no aspect is silently skipped
- [ ] Every observation cites a specific anchor in the draft
- [ ] Every FINDING has a severity drawn from the planner's rubric and a remediation suggestion
- [ ] No new aspects were reviewed beyond what the planner listed
- [ ] Scope concerns are flagged in `## Scope Concern`, not silently absorbed
- [ ] Open questions are specific enough to be actionable

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** review aspects the planner did not call for — raise scope concerns in the body, don't act on them
- The agent **MUST NOT** make findings without citing the specific section / line / paragraph of the draft they refer to
- The agent **MUST NOT** assign severities arbitrarily — every severity MUST follow the planner's rubric
- The agent **MUST NOT** rubber-stamp ("looks fine") — every aspect MUST have a substantive observation, even if the verdict is PASS
- The agent **MUST NOT** introduce conclusions that contradict a recorded Decision without citing the Decision ID
- The agent **MUST NOT** issue findings that are stylistic preferences dressed up as substance — the criterion is the contract
- The agent **MUST** flag open questions explicitly rather than guess
- The agent **MUST NOT** silently downgrade or upgrade severity to fit a preferred outcome
- The agent **MUST NOT** edit the planner's plan during review — disagreements with the plan are raised in `## Scope Concern`, not edited in place
