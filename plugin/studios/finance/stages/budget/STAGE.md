---
name: budget
description: Allocate resources and set financial targets
optional: true
hats: [budget-owner, allocator, verifier]
fix_hats: [classifier, budget-owner, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: forecast
    discovery: forecast-model
---

# Budget

Turn the forecast into a resource allocation plan. This is where projected revenue becomes an envelope, and the envelope becomes concrete commitments by department, cost center, and line item — the operating plan the rest of the organization spends against.

## Scope

Allocation against the forecast: envelope sizing, departmental and cost-center splits, target levels with measurement criteria, and contingency reserves. Budget decides *how the projected resources get committed* — not what's projected (forecast), and not how actuals diverge from the plan later (analysis).

## What to do

- Size the envelope to the forecast's projected revenue, and trace every allocation back to a forecast driver.
- Set targets concrete enough to be measured against, with stated measurement criteria.
- Size contingency reserves from historical variance patterns, not from an arbitrary percentage.
- Make the allocation rationale explicit so a reviewer can see why each slice got what it got.

## What NOT to do

- Don't reproject revenue or revise the forecast's drivers — consume the forecast as given; a wrong forecast is a revisit upstream.
- Don't compare allocations to actual spend — there's no actual yet; that's analysis.
- Don't allocate beyond the envelope or leave a department untraceable to a driver.
- Don't pad reserves with round numbers in place of evidence.
