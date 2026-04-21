---
title: 'unit-03: compare-bundle.mjs exits non-zero — no-regression proof missing'
status: pending
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-04-21T05:51:14Z'
iteration: 0
visit: 0
source_ref: unit-03-extract-haiku-ui-package/reviewer/bolt-1
closed_by: null
bolt: 0
upstream_stage: null
---

## Finding (confidence: high)

Hard completion criterion:

> Completion requires: `node scripts/compare-bundle.mjs stages/development/artifacts/bundle-baseline.html packages/haiku-ui/dist/index.html` exits 0.

Actual behavior (verified by running the script after a clean build):

```
$ node packages/haiku/scripts/compare-bundle.mjs \
    .haiku/intents/universal-feedback-model-and-review-recovery/stages/development/artifacts/bundle-baseline.html \
    packages/haiku-ui/dist/index.html
DIFF: ... (4963 vs N lines, first diff at line 1)
$ echo $?
1
```

The builder's own notes (`unit-03-extract-haiku-ui-notes.md` §"Byte-identical bundle comparison — spec contradiction") call this an "intentional fail" and argue the spec has an internal contradiction: rAF coalescing + `ApiClient` + `WsServerMessageSchema` validation are new bytes that can't byte-match the pre-move baseline.

The builder may be correct that the spec has an internal contradiction — but the reviewer cannot approve on "intentional fail." The resolution channels are:

1. If the contradiction is real, file it as an **upstream finding** against product/design (`upstream_stage:` on the feedback), and let the FSM surface it to the human. Do not approve the unit on the builder's self-certification that the criterion was wrong.
2. If the new behaviors (rAF, ApiClient, zod validation) actually *don't* change the compiled bundle's observable semantics, widen `compare-bundle.mjs`'s volatile-line regex to tolerate them — but that's a real diff, not a hand-wave.
3. If byte-identical is impossible-by-design for this unit, the spec needs to be amended (via planner/refiner), not sidestepped.

## Evidence

- `packages/haiku/scripts/compare-bundle.mjs:54-82` — correctly `process.exit(1)` on divergence
- `packages/haiku-ui/tests/parity.spec.ts` — is NOT a DOM parity test (see separate finding); the builder's "the real no-regression proof lives in the DOM-parity test" claim does not hold up
- Builder notes explicitly classify this criterion as `INTENTIONAL FAIL`

## Suggested fix

Either:
1. File an `upstream_stage: inception` (or wherever the 500 KB / byte-identical criteria were authored) feedback and reject the unit for cross-stage resolution, or
2. Broaden the volatile-line stripper in `compare-bundle.mjs` so the new rAF/ApiClient/zod code paths are tolerated (carefully — this is a real scope expansion), then re-run and attach passing output to the unit.

Confidence: **high** — exit code is 1, builder admits it.

