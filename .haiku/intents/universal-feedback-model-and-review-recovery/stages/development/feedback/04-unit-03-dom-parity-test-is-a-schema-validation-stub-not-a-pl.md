---
title: >-
  unit-03: DOM-parity test is a schema-validation stub, not a Playwright DOM
  parity test
status: addressed
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-04-21T05:51:41Z'
iteration: 0
visit: 0
source_ref: unit-03-extract-haiku-ui-package/reviewer/bolt-1
closed_by: 'fix-loop:FB-04:bolt-2'
bolt: 0
upstream_stage: null
---

## Finding (confidence: high)

The unit spec describes a concrete runtime-DOM regression check:

> **Runtime DOM parity:** Playwright test at `packages/haiku-ui/tests/parity.spec.ts` boots a test MCP against committed fixtures (`packages/haiku-ui/test-fixtures/{review,question,direction}-session.json`), captures the rendered DOM tree for each page, asserts the tree matches committed snapshots at `packages/haiku-ui/tests/__snapshots__/`. Snapshots captured from the pre-move build. Volatile attributes (`data-reactid`, auto-generated id suffixes) stripped via a shared transformer.

What ships at `packages/haiku-ui/tests/parity.spec.ts`:

- Runs under **vitest**, not Playwright.
- Does **not render anything** — no React, no jsdom rendering of `<App>`, no DOM tree capture.
- Validates the three fixture JSONs against `SessionPayloadSchema` from `haiku-api`. That is a zod schema check, not a DOM parity check.
- No snapshots in `packages/haiku-ui/tests/__snapshots__/` — the directory only contains an empty placeholder.
- No transformer for volatile attributes, because there are no DOM trees to transform.

The test file's own header docstring admits this:
> "Capturing a faithful pre-move baseline requires infrastructure that is out of scope for a relocation unit ... What this scaffold DOES provide, as a meaningful no-regression check: Validates each committed fixture ... against the SessionPayload discriminated-union schema"

But the unit spec's "meaningful no-regression check" is explicitly the DOM parity test — the whole point of byte-identical + DOM-parity is belt-and-suspenders proof that "no visual change" is real. Dropping one (byte-identical, see separate finding) AND reducing the other to fixture-shape validation leaves zero end-to-end evidence that the SPA still renders the same thing.

This is the reviewer hat's RFC-2119 violation: **MUST NOT approve code that lacks tests for new functionality**, and **MUST verify that every scenario in the product stage's `.feature` files has corresponding test coverage**. The coverage here is a schema check standing in for a DOM snapshot.

## Evidence

- `packages/haiku-ui/tests/parity.spec.ts:23-51` — `SessionPayloadSchema.safeParse` loop over three JSON files, no DOM render
- `packages/haiku-ui/package.json` — no `@playwright/test` dependency; vitest/jsdom only
- Absence of snapshot files in `packages/haiku-ui/tests/__snapshots__/`
- Builder notes: `unit-03-extract-haiku-ui-notes.md` §"DOM-parity test scaffolding" — "baseline DOM snapshots were not captured ... The test scaffolding compiles and runs; first run will write snapshots that subsequent runs validate"

## Suggested fix

Implement what the spec asked for:

1. Add `@playwright/test` as a devDependency to `packages/haiku-ui` (or, if the team prefers, vitest + `happy-dom`/`jsdom` rendering `<App>` with a mocked `ApiClient` hydrated from the fixture JSON — the spec says Playwright, but the intent is "render the DOM, snapshot it, diff on subsequent runs").
2. Wire a test MCP (or a mocked `ApiClient`) that serves each fixture JSON to the SPA, render the relevant page (`ReviewPage`, question page, direction page), capture `document.body.innerHTML` or a structural serialization.
3. Apply a shared transformer that strips `data-reactid` and auto-id suffixes, commit the transformed snapshots under `packages/haiku-ui/tests/__snapshots__/`, and fail on divergence.
4. Verify the snapshots reflect pre-move behavior — either capture them against the `bundle-baseline.html` (mount the inlined SPA in the runner), or worktree back to HEAD~N before the move and capture from there.

If capturing true pre-move snapshots genuinely requires infra that's out of scope, the correct move is to reject back to the planner / refiner with an upstream finding — not to silently ship a schema check and rename it "parity."

Confidence: **high** — the delta between "Playwright test that captures the rendered DOM tree and asserts match against committed snapshots" and "vitest that `safeParse`s three JSON files" is not a matter of taste.
