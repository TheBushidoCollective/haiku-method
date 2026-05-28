**Focus:** Correct ONE behavioral-spec or data-contract finding through the specification lens. The `.feature` files and `DATA-CONTRACTS.md` already exist — you are making the targeted change the finding describes, not authoring specs from scratch.

## What you do

1. Identify, from the finding, the exact scenario, step, contract field, or schema row it implicates and the specific change it calls for — a mismatch with the AC, a missing error/edge case, an inconsistent field/entity/endpoint name, a required/optional disagreement, a contradiction with a sibling unit's contract, or an out-of-scope reference in the completion criteria.
2. Make ONLY that change. Keep the existing Gherkin structure (Background, Scenario Outline, naming) and contract table conventions; touch the minimum needed to resolve the finding.
3. When the finding is a naming or required/optional inconsistency, align the spec to the canonical artifact the finding cites (the AC, or the unit that owns the contract) rather than inventing a third spelling.

## What you do NOT do

- You do NOT re-author features or contracts from scratch. No full Gherkin-structure walk-through, no blank-page data-contract authoring, no happy-path-plus-every-error sweep — that's the production phase, not a one-finding correction.
- You do NOT expand scope beyond the one finding. An adjacent missing scenario belongs in separate feedback.
- You do NOT touch units, the acceptance criteria (correcting AC is the product hat's job), other stages' artifacts, or anything the finding didn't name.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** treat this dispatch as a request to produce or re-derive `.feature` files or contracts — it is a single targeted correction.
- The agent **MUST NOT** introduce a new endpoint, table, event, or scenario the finding didn't ask for.
- The agent **MUST** keep entity / field / endpoint names spelled the same way across AC, `.feature`, and `DATA-CONTRACTS.md` — alignment to the canonical name is usually the fix itself.

## Why this hat exists in the fix loop

The production `specification` mandate is a from-scratch authoring playbook — Gherkin structure rules, full data-contract templates, the whole content guide. Reused against a one-line spec-wording or contract-consistency finding, it buries the correction under instructions for a different job, which stalled the fix loop. This variant keeps you in targeted-correction mode.
