---
title: >-
  No test verifies inception-coverage review agent is discoverable via
  readReviewAgentPaths
status: closed
origin: adversarial-review
author: test-quality
author_type: agent
created_at: '2026-04-28T23:51:30Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-02:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:51:30Z'
resolution: null
replies: []
---

## Finding

A new review agent `plugin/studios/software/stages/design/review-agents/inception-coverage.md` was added. The unit-02 quality gates verify the file's content (that it mentions `knowledge/`, `decision`, `open question`, `surface`, and `short-circuit`) but no automated test verifies that `readReviewAgentPaths("software", "design")` returns `inception-coverage` as a discoverable agent that the orchestrator will actually dispatch.

**What exists:** `packages/haiku/test/studio-config.test.mjs:100–109` tests that the development stage has cross-stage review agent *includes* from the design stage (checking for `consistency` and `accessibility`). The test at line 152–159 checks that studio-level review agents' mandate paths exist. Neither test verifies the per-stage review agent registry for the design stage itself.

**Search confirms zero coverage:**
```
grep -rn "inception-coverage\|design.*review.agent\|review.*agent.*design" packages/haiku/test/
# (no output)
```

**Spirit of the mandate:** Unit-02's grep gates check the mandate file's text content, but the behavioral outcome is: "the review agent is registered and dispatched when the design stage's review phase fires." The test-quality mandate requires verifying that integration boundaries are covered — here the boundary is `readReviewAgentPaths` → orchestrator dispatch. A test that builds the StudioConfig and asserts `software.stages.design.reviewAgents` includes `inception-coverage` (with a mandate path that exists on disk) would catch a silent read failure, a naming mismatch, or a parsing regression.

**What's already tested as a model:** Line 152 in `studio-config.test.mjs` tests that studio-level review agents have existing mandate paths. The pattern is directly reusable.

## Required fix

Add a test to `packages/haiku/test/studio-config.test.mjs` asserting that the design stage's review agent registry includes `inception-coverage` and that its mandate path exists:
```js
test("design stage review agents include inception-coverage", () => {
    const agents = software.stages.design.reviewAgents
    const names = agents.map((a) => a.name)
    assert.ok(names.includes("inception-coverage"), "design stage should include inception-coverage review agent")
    const agent = agents.find((a) => a.name === "inception-coverage")
    assert.ok(existsSync(agent.mandatePath), `inception-coverage mandate path must exist: ${agent.mandatePath}`)
})
```
This test validates the integration boundary — not just that a file exists at a path, but that the studio config builder discovers and loads it correctly as part of the design stage's review registry.
