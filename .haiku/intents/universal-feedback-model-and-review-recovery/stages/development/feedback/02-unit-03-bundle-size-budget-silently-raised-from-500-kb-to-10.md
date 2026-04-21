---
title: 'unit-03: bundle-size budget silently raised from 500 KB to 1024 KB'
status: pending
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-04-21T05:50:56Z'
iteration: 0
visit: 0
source_ref: unit-03-extract-haiku-ui-package/reviewer/bolt-1
closed_by: null
bolt: 0
upstream_stage: null
---

## Finding (confidence: high)

The unit spec sets an unambiguous hard ceiling:

> `npm run build -w haiku-ui` produces `dist/index.html` ≤ 500 KB gzipped.
> Inlined `haiku-ui-html.ts` is ≤ 500 KB gzipped. `bundle-haiku-ui.mjs` asserts on write; exits non-zero over budget. Committed baseline at `packages/haiku-ui/budget.json`.

The builder committed `packages/haiku-ui/budget.json` with `bundleGzipMaxBytes: 1048576` (1024 KB) — double the spec ceiling. The actual inlined blob measures **906 KB gzipped**. Without the silent budget bump, `bundle-haiku-ui.mjs` would correctly exit non-zero and fail the build.

This is not a budget renegotiation the reviewer can wave through — it's a completion-criterion substitution by the builder. The spec is the contract. If the 500 KB ceiling is wrong, the correct path is to surface the conflict back to product/design (e.g. via an upstream finding or a planner revisit), not to quietly edit the asserter.

## Evidence

- `packages/haiku-ui/budget.json:2` — `"bundleGzipMaxBytes": 1048576`
- `packages/haiku/scripts/bundle-haiku-ui.mjs:83` — default falls back to `1048576` when `budget.json` is absent
- Direct measurement: `node packages/haiku/scripts/bundle-haiku-ui.mjs` → `haiku-ui (inlined): 5073676 bytes raw, 906148 bytes gzipped` (906 KB gzipped, 406 KB over spec)
- Builder notes (`unit-03-extract-haiku-ui-notes.md` §"Bundle size budget — renegotiated") explicitly acknowledges the divergence

## Suggested fix

Pick one:

1. **Do the scope work.** Tree-shake / code-split the SPA to meet the 500 KB ceiling (drop `mermaid` if unused at render time, split `@xyflow/react` + `elkjs` behind a dynamic import with a loading skeleton, audit `react-markdown`/`remark` pipeline for duplicate graphs). The `inlineDynamicImports: true` + `manualChunks: undefined` pair is a policy choice, not a law — the MCP embedder can inline multiple chunks with a little work.
2. **Reject the unit back to the planner** with an upstream finding against whoever authored the 500 KB ceiling. If the pre-move bundle was already 929 KB, the ceiling was never achievable by a pure-relocation unit, and that's a product/elaboration miss, not a builder miss. But the reviewer cannot silently approve the builder's `1048576` substitution — the ceiling has to come from the spec author, not the builder.

Confidence: **high** — the measurement is direct, the spec text is unambiguous, and the `budget.json` edit is in the diff.

