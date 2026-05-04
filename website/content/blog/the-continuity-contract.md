---
title: "The Continuity Contract"
description: "H·AI·K·U promised that downstream stages execute what upstream stages designed. The promise was a vibe. Three new engine gates make it a contract."
date: 2026-05-04
---

We ran intent `out-of-band-human-file-modifications` end-to-end last week. Six stages, thirty-something units, an adversarial review with five critics, a clean intent-completion review. PR [#265](https://github.com/gigsmart/haiku-method/pull/265) opened, CI went green, every gate signed off.

Three of the SPA components the design stage spec'd in `SPA-UI-SPECS.md` shipped as `.tsx` files but no other file in the repo rendered them. Not in production. Not in tests. The unit tests for `KnowledgeUploadPanel`, `DriftBanner`, and `DriftAssessmentsView` covered each component in isolation and passed. The verifier hat advanced each unit. Five adversarial reviewers spent hours arguing about the security posture of the upload routes nobody could trigger from the UI. They found 39 issues. Every single one was about something that *was* there.

Pretend a designer dropped a `hero.html` mockup into `stages/design/artifacts/`, the dev stage built `Hero.tsx` per spec, the test suite passed, the PR opened. Now imagine the only thing in production using `Hero` is the test that asserts it renders without errors. Nobody on your team would notice in review, because review reads the diff and the diff looks fine. The component exists. The test runs. Ship it.

That's the failure we just lived through. The methodology promise — "downstream stages execute what upstream stages designed" — held for the *outputs we declared*. It said nothing about the *deliverables we forgot to declare*, or the components we declared but didn't wire in.

## What every gate did and didn't audit

H·AI·K·U has a lot of gates. The pre-tick consistency check rebuilds intent state. The unit-inputs validator blocks execution if any unit has empty `inputs:`. The discovery-artifacts validator refuses to advance until each `discovery/{name}.md` template has produced an artifact. The quality gates run `bunx biome check`, `bunx tsc --noEmit`, and `bun test`. The adversarial review fans out specialist critics. The studio-level intent-completion review audits cross-stage consistency.

Every one of those audited the *interior* of what shipped. None of them audited the *boundary* between stages. Nothing said "design produced these eight artifacts; show me where each is used in dev." Nothing said "you declared `DriftBanner.tsx` as an output of `unit-13`; show me a JSX usage of it somewhere a user might actually see." Coverage was assumed, never proven.

The cross-stage-consistency reviewer almost caught it. It filed FB-01 — "upstream-reconciliation subsystem implemented but absent from inception/product/design specs" — code with no design provenance. Notice the asymmetry: it caught "code with no design" but not "design with no code." The mandate enumerated one direction and missed the inverse. Five critics, none with the brief to ask the simplest question.

## What lands as the contract

Three pre-tick validators landed in this intent's engine work. They fail the workflow until we either do the work or write down why we didn't.

**Cumulative input coverage** runs at every stage's elaborate-phase exit, before adversarial review fires. The validator walks every prior stage. It collects every unit's `outputs:` from frontmatter plus every file under `artifacts/`, `outputs/`, `knowledge/`, `discovery/`. Then it walks the current stage's units and unions their `inputs:`. Anything in the prior set that's not in the current set fails the gate. The agent has two responses per file: add it to a unit's `inputs:`, or call `haiku_coverage_acknowledge` and write down why this artifact is not relevant to this stage. The acknowledgment lands in `coverage-decisions.json` and reviewers can challenge it. There is no third option. Implementation: `validateCumulativeInputCoverage` in `packages/haiku/src/orchestrator/validators.ts`, wired from the elaborate handler at `packages/haiku/src/orchestrator/workflow/handlers/elaborate.ts:673`.

**Output liveness** runs at every stage's review-phase exit and again at intent completion. The validator walks every code-output every unit ever declared. For each `.tsx`, `.ts`, `.jsx`, `.js`, it runs `git grep -lw <stem>` against the repo and asks whether any other file references the basename as a word token. Workflow-meta paths under `.haiku/` are filtered, because a unit's frontmatter naming its own output isn't "wired in." Test files are filtered too. If nothing else references the stem, the gate fails. Same response shape as coverage — wire it, or acknowledge it. Implementation: `validateOutputLiveness` in the same validators file. Eight unit tests in `packages/haiku/test/output-liveness.test.mjs` cover the orphan path, the acknowledged path, the test-file exclusion, and the cross-stage walk.

**Mode taxonomy.** Per-stage gates under autopilot collapse to `auto`. Continuous mode honors each stage's `review:` setting verbatim. Discrete mode coerces every stage to `external`. The methodology used to mix two ideas in the same dial: "pause for human review" and "produce a delivery PR." Now there's one knob per concern. Under autopilot, the *only* PR is the intent-completion delivery PR. The merge into mainline is the approval signal. No SPA pane. No 30-minute timeout for nobody to click. Implementation: `gate.ts` lines 540-585; the [autopilot mode taxonomy memory](https://github.com/gigsmart/haiku-method/blob/main/website/content/blog/quick-mode-and-autopilot.md) we wrote earlier finally has engine teeth.

## What changes for you

Write a stage that produces an artifact. Some downstream stage uses it or admits it didn't. Write a unit that produces a `.tsx`. Some other file renders it or you write down why it's a placeholder. Enable autopilot on an intent. The engine doesn't stop until the intent is delivered as a PR, and the PR has the *completed* intent state on it before you ever open it.

Coverage by gate, not by promise. The methodology was a vibe. The methodology is a contract.

Read the diff that landed it: PR [#265](https://github.com/gigsmart/haiku-method/pull/265). Watch the gate fail on a real intent, then watch what the agent has to write down to make it pass. That's where the trust is.
