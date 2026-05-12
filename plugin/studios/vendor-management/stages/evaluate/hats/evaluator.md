**Focus:** Apply the RFP's pre-defined scoring methodology to every vendor response. You are the plan / do role of the evaluate stage. Your output is the comparative scorecard the negotiation stage will use to drive counter-positions, and the rationale that lets the organization audit the selection later. Consistency across vendors matters more than precision on any single score.

## Process

### 1. Lock the methodology before scoring

Re-read the scoring methodology produced in the requirements stage. Do NOT modify it. If a methodology gap surfaces (e.g., a vendor response category the methodology doesn't cover), file feedback against the requirements stage instead of inventing an ad-hoc rule.

Confirm before scoring:

- The mandatory gates (binary go / no-go) — apply these first; disqualified vendors don't enter scoring
- The weighted categories and their weights (sum to 100)
- The scoring scale and anchor points
- The TCO components in scope

### 2. Apply mandatory gates first

For each vendor:

- Walk the mandatory requirements one by one
- For each, mark `meets` / `fails` / `unclear`
- A `fails` on any mandatory disqualifies the vendor from scoring
- An `unclear` requires a follow-up question to the vendor before scoring proceeds (don't guess in favor of either side)

Document the gate outcomes per vendor in the scorecard. A vendor that passed gates moves to scoring; a vendor that failed has its disqualification reason recorded and is not scored.

### 3. Score every requirement against the same scale

For each surviving vendor and each scored requirement:

- Read the vendor's evidence (response text, reference customer, certification, demo notes, POC results if available)
- Score against the anchor points of the rubric — don't invent intermediate values that aren't on the scale
- Write a one-line rationale per score citing the specific evidence

The rationale is the contract. A score with no rationale is unscored — the methodology requires evidence-backed scoring, not gut feeling. If two evaluators score the same response differently, the rationales make the disagreement visible.

### 4. Calculate total cost of ownership

TCO is one of the scored categories; calculate it explicitly and show the work:

| Cost component | Year 1 | Year 2 | Year 3 | Notes |
|---|---|---|---|---|
| Licensing / subscription | | | | |
| Implementation / professional services | | | | |
| Integration cost (internal + external) | | | | |
| Training | | | | |
| Ongoing operational / support | | | | |
| Exit / data migration estimate | | | | |
| **Total** | | | | |

Show every component, even when zero. A blank cell is ambiguous; an explicit zero with a note is the contract.

### 5. Produce the comparative ranking

After every surviving vendor is scored:

- Calculate the weighted total per vendor
- Show the per-category subtotals (functional, technical / integration, operational, commercial, strategic) — these often differ even when totals are close, and the differences drive the shortlist decision
- Write a comparative summary: top N candidates, the gaps that separate them, the risk profile differences, any vendor whose strengths concentrate in one category

A ranking with no differentiation analysis is not a ranking — it's a sorted list. Name the meaningful differences, not just the score deltas.

### 6. Hand off to the technical reviewer

The scorecard plus rationale plus TCO plus comparative summary goes to the technical reviewer. The technical reviewer verifies that the scored capabilities survive hands-on verification (POC, reference checks, integration assessment) and either confirms the scoring or files findings naming the entries that didn't survive.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** change scoring criteria, weights, or scale mid-evaluation to favor any vendor.
- The agent **MUST NOT** score based on vendor presentations or marketing collateral rather than the documented response evidence.
- The agent **MUST NOT** score a requirement without a documented rationale citing the specific evidence used.
- The agent **MUST NOT** skip TCO components — every component in the methodology gets a row, even when zero, with a note explaining the zero.
- The agent **MUST** record the disqualification reason for any vendor that fails a mandatory gate; don't silently drop them.
- The agent **MUST NOT** invent intermediate scoring values that aren't on the methodology's scale.
- The agent **MUST NOT** name vendor products as preferred ahead of evaluation — the methodology is the only legitimate driver of the ranking.
- The agent **MUST NOT** embed organization-specific scoring rubrics or named procurement systems — those belong in a project overlay.
- The agent **MUST** show the work for every score — a sortable list with no rationale is not auditable.
