---
title: "The Continuity Contract"
description: "H·AI·K·U promised that downstream stages would execute what upstream stages designed. The promise was a vibe. Three new engine gates make it a contract."
date: 2026-05-04
---

I ran an intent end-to-end. Six stages, thirty-odd units, an adversarial review with five critics, a clean intent-completion review. The PR opened, CI went green, the gates signed off.

Three of the SPA components the design stage spec'd never rendered. Not in production. Not in tests. Not anywhere. The `.tsx` files existed. The unit tests passed. No other file in the repo imported them. They were ghosts.

The methodology promised that every downstream stage would execute what every upstream stage designed. The engine never enforced it. That's a vibe, not a contract.

## How a ghost ships

The dev stage authored thirteen units. The first nine were backend — drift gates, MCP tools, audit logs, upload routes. The last four were frontend — `KnowledgeUploadPanel`, `DriftBanner`, `DriftAssessmentsView`, `OutputCardMenu`. Each frontend unit's `outputs:` listed a `.tsx` file. The execute phase produced those files. The unit tests that covered each component in isolation passed. The verifier hat advanced each unit. The review phase ran adversarial critics against the work. They found 39 issues — every one of them about something that *was* there.

Nobody asked "is the component actually rendered."

The integration is a separate skill from the build. Building `<DriftBanner />` and *putting `<DriftBanner />` somewhere a user can see it* are two different commits. The first is in scope for "build the component." The second is in scope for "wire the component into the existing screens." If no unit names the second, the second doesn't happen. The work is done according to its own spec, and useless according to the user's experience.

The same shape, one layer up: design's `SPA-UI-SPECS.md` enumerated every component the dev stage was supposed to build. Dev's units referenced *some* of those design artifacts in `inputs:` and skipped others. The skipped ones were silently dropped. The agent built what it found exciting. The pipeline's continuity was performative.

## What every gate did and didn't audit

Every existing gate audited the *interior* of what shipped. Did the unit have inputs? Did it have outputs? Did the outputs exist? Did the quality gates pass? Did the adversarial reviewers find vulnerabilities, contradictions, or coverage gaps in the artifacts the agent produced?

Nothing audited the *boundary* between stages. Nothing said "design produced these eight artifacts; show me where each is used in dev." Nothing said "you declared `DriftBanner.tsx` as an output; show me a JSX usage of it somewhere downstream." Coverage was assumed, never proven.

That's how the ghost shipped. Five reviewers spent hours arguing about the security posture of the upload routes. Zero reviewers asked whether anyone could actually upload anything from the UI.

## Three gates that make it a contract

The fix lands as three pre-tick validators that fail the workflow until the agent either does the work or admits in writing it didn't.

**Cumulative input coverage.** At every stage's elaborate-phase exit, before adversarial review fires, the engine walks every prior stage. It collects every unit's `outputs:` plus every file under `artifacts/`, `outputs/`, `knowledge/`, `discovery/`. Then it walks the current stage's units and unions their `inputs:`. Anything in the prior set that's not in the current set fails the gate. The agent has two responses per file: add it to a unit's inputs, or call `haiku_coverage_acknowledge` and explain in plain prose why this artifact is not relevant to this stage. The acknowledgment lives in `coverage-decisions.json` and reviewers can challenge it. There is no third option. Every prior deliverable gets named, or its absence gets justified.

**Output liveness.** At every stage's review-phase exit and again at intent completion, the engine walks every code-output every unit ever declared. For each `.tsx`, `.ts`, `.jsx`, `.js`, it runs `git grep -lw <stem>` against the repo and asks: does any other file reference this? If nothing does, the gate fails. Same response shape — wire it, or acknowledge it. The acknowledgment is durable, the rationale is challengeable. A defined-but-never-rendered component cannot pass intent completion.

**Mode taxonomy.** Per-stage gates under autopilot collapse to `auto`. The methodology used to mix two ideas in the same dial: "pause for human review" and "produce a delivery PR." Under `discrete`, every stage gets a per-stage PR. Under `continuous`, each stage's `review:` setting is honored verbatim. Under `autopilot`, every per-stage gate auto-advances and the *only* PR is the intent-completion delivery PR. The merge into mainline is the approval signal. No SPA pane. No 30-minute timeout for nobody to click. No double-tick to advance. The user's only post-completion action is the merge.

## What changes for the user

You write a stage that produces an artifact. Some downstream stage either uses it or admits it didn't. You write a unit that produces a `.tsx`. Some other file renders it or you admit it's a placeholder. You enable autopilot on an intent. The engine does not stop until the intent is delivered as a PR, and the PR has the *completed* intent state on it before you ever read the title.

The promise is the same. The promise is now enforced. Coverage by gate, not by promise.
