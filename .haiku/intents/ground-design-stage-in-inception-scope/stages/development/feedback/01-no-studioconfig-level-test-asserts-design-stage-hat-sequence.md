---
title: >-
  No StudioConfig-level test asserts design stage hat sequence after
  designer-prep insertion
status: closed
origin: adversarial-review
author: test-quality
author_type: agent
created_at: '2026-04-28T23:51:14Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-01:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:51:14Z'
resolution: null
replies: []
---

## Finding

The design stage's `hats:` list was changed from `[designer, design-reviewer]` to `[designer-prep, designer, design-reviewer]` in `plugin/studios/software/stages/design/STAGE.md`. This is a structural change to the studio config that the workflow engine reads at dispatch time — but no test in the automated suite asserts the parsed hat sequence for the design stage.

**What exists:** `packages/haiku/test/studio-config.test.mjs:80` asserts:
```js
test("development stage hats are [planner, builder, reviewer]", () => {
    const hatNames = software.stages.development.hats.map((h) => h.name)
    assert.deepStrictEqual(hatNames, ["planner", "builder", "reviewer"])
})
```
There is no equivalent for the design stage.

**What the quality gate uses instead:** Unit-01's `stage-hats-list-prepends-designer-prep` gate is a grep regex against the raw STAGE.md text:
```
grep -qE '^hats:\s*\[\s*designer-prep\s*,\s*designer\s*,\s*design-reviewer\s*\]\s*$' plugin/studios/software/stages/design/STAGE.md
```

This tests the raw file content but does NOT test the parsed `StudioConfig` object the workflow engine actually builds and uses. If `buildStudioConfig` or `readHatDefs` has a parsing edge case that silently drops or mis-orders the new hat, the grep gate passes while the runtime is broken.

**Spirit of the mandate:** Tests should assert on behavior and outcomes, not just exercise code paths (or in this case, check raw file content). The behavioral outcome here is: "when the workflow engine loads the design stage, the hat chain is [designer-prep, designer, design-reviewer] in that order." That assertion belongs in `studio-config.test.mjs` using `buildStudioConfig`, same pattern as the development stage hat test.

## Required fix

Add a test to `packages/haiku/test/studio-config.test.mjs` asserting the design stage hat sequence:
```js
test("design stage hats are [designer-prep, designer, design-reviewer]", () => {
    const hatNames = software.stages.design.hats.map((h) => h.name)
    assert.deepStrictEqual(hatNames, ["designer-prep", "designer", "design-reviewer"])
})
```
This test would have caught any regression in `buildStudioConfig`'s parsing of the updated STAGE.md, and will guard against future hat-order regressions on the design stage.
