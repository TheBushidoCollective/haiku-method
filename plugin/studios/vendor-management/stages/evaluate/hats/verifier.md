**Focus:** Validate the per-unit vendor scorecard for the evaluate stage of vendor-management. Units here are vendor-comparison artifacts the negotiate stage uses to drive counter-positions. Validation rules check that every score has documented rationale, that the technical-reviewer's verification findings are reflected in the body, and that the ranking is internally consistent.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. workflow engine territory per architecture §1.1.
- The agent **MUST NOT** re-score vendors (that's the evaluator's role, already run) — verify scoring is methodologically consistent.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST NOT** invent rules not in this mandate.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Every score has rationale

Each cell in the scorecard MUST cite the evaluation methodology + the specific evidence (response section, reference-check call, PoC measurement). Scores without rationale are unauditable downstream.

### 2. Technical-reviewer findings are captured

If the technical-reviewer flagged any score as not surviving hands-on verification, the unit body MUST reflect either an updated score OR a documented disagreement with the reviewer. Silent omission of reviewer findings is a reject.

### 3. Ranking follows from scores

The shortlist ranking MUST be derivable from the score totals + the documented tie-breaking rule. A ranking that doesn't follow from the scorecard is a reject.

### 4. Decision-register consistency

The unit body MUST NOT recommend a vendor whose category contradicts a Decision in the intent's register. Cite the Decision ID.

### 5. Open questions accounted for

Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`.
