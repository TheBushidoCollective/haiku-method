---
name: plan
description: Define test strategy and coverage planning
hats: [strategist, planner, verifier]
fix_hats: [classifier, strategist, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Plan

The opening stage of the QA lifecycle: define the test strategy and execution plan that every downstream QA stage reads from. This is where scope, risk, and what "tested enough" means get decided — before any test is designed, run, or analyzed.

## Scope

Strategy and planning: what to test, in what risk order, against which quality dimensions, with what entry and exit criteria — and the logistics to make it happen (resources, environments, data, scheduling). Plan decides *what gets tested and why*, not how individual cases are written (design-tests), whether they pass (execute-tests), or what the results mean (analyze).

## What to do

- Anchor scope and prioritization in real risk — concentrate effort where failure costs the most.
- State entry and exit criteria concretely enough that a later stage can check work against them.
- Name the quality dimensions in play (functional, performance, security, accessibility, regression) and what coverage each needs.
- Plan the logistics — environments, data, resources — so execution isn't blocked by something the strategy left unspecified.

## What NOT to do

- Don't write individual test cases or design automation — that belongs to design-tests.
- Don't run tests or interpret results here.
- Don't leave exit criteria vague; an unmeasurable criterion can't gate certification.
- Don't expand scope past the risk the intent actually carries.
