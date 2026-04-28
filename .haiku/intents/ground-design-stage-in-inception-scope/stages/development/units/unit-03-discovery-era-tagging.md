---
title: Era tagging in inception's DISCOVERY.md template
model: sonnet
depends_on: []
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - plugin/studios/ARCHITECTURE.md
  - plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - plugin/studios/software/stages/inception/hats/researcher.md
outputs:
  - plugin/studios/software/stages/inception/discovery/DISCOVERY.md
quality_gates:
  - name: discovery-template-has-existing-code-structure-section
    command: >-
      grep -qE '^### Existing Code Structure'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: discovery-template-defines-era-tags
    command: >-
      grep -qE '\(active\)'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md && grep
      -qE '\(dormant\)'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md && grep
      -qE '\(deprecated\)'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md && grep
      -qE '\(in-flight\)'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: discovery-template-shows-era-tagged-bullet-example
    command: >-
      grep -qE '^- \`[^\`]+\`\s+\((active|dormant|deprecated|in-flight)\)'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: discovery-out-of-scope-carves-era-tagged-exception
    command: >-
      grep -qE 'era.tagged|era-tagged|Existing Code Structure'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: haiku-tests-still-pass
    command: cd packages/haiku && node test/run-all.mjs
  - name: biome-lint-clean
    command: bun x biome check plugin/studios/software/stages/inception/
status: completed
bolt: 5
hat: reviewer
started_at: '2026-04-28T21:57:47Z'
hat_started_at: '2026-04-28T23:45:05Z'
iterations:
  - hat: planner
    started_at: '2026-04-28T21:57:47Z'
    completed_at: '2026-04-28T22:01:49Z'
    result: advance
  - hat: builder
    started_at: '2026-04-28T22:01:49Z'
    completed_at: '2026-04-28T22:05:45Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:05:45Z'
    completed_at: '2026-04-28T22:12:01Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:12:01Z'
    completed_at: '2026-04-28T22:19:47Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:19:47Z'
    completed_at: '2026-04-28T22:27:17Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:27:17Z'
    completed_at: '2026-04-28T23:45:05Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-28T23:45:05Z'
    completed_at: '2026-04-28T23:46:45Z'
    result: advance
completed_at: '2026-04-28T23:46:45Z'
---
## Goal

Close issue #263 item 5 by extending the inception stage's `DISCOVERY.md` discovery template to require an **era / status tag** on prior-art file references inside a new `### Existing Code Structure` subsection of the content guide. The reporter described an incident where the inception doc's prior-art references conflated Stripe-era (dormant) and Branch-era (active) code paths without distinguishing them, and the design hat conflated patterns from both. A simple `(active)` / `(dormant)` / `(deprecated)` / `(in-flight)` tag on each cited code reference is enough to prevent the conflation at the source.

This is **content-guide level only** — no frontmatter schema change, no orchestrator code change. Per `plugin/studios/ARCHITECTURE.md` §1.1, frontmatter is workflow-engine territory; era is body annotation the inception agent populates per discovery.

## Architectural reconciliation (REQUIRED — pre-execute review surfaced this)

The current `plugin/studios/software/stages/inception/discovery/DISCOVERY.md` includes an explicit "Out of Scope for Inception" rule:

> **Code-archaeology summaries** ("this lives at `packages/foo/src/bar.ts`") — design pulls these as needed; inception should not pre-bind them

Adding a new section that instructs the inception agent to list per-file code references (with era tags) directly contradicts that rule as written. The implementing agent **MUST** resolve this contradiction explicitly. The two sections cannot coexist verbatim — the template would tell the agent both "list code paths" and "do not list code paths."

**Resolution direction (chosen):** carve out a narrow exception. The "Out of Scope" rule is preserved for **forward-looking implementation choices** (binding "feature X will live at packages/foo/bar.ts" — that's a design-stage call, inception MUST NOT pre-commit). The new exception is for **backward-looking inventory** of what currently exists in the tree, with era tags that classify each entry's role at the moment inception runs. These are categorically different — one is a future commitment (out of scope), the other is a factual snapshot (in scope). Era tags exist *because* the snapshot is non-trivial and downstream stages need the disambiguation.

The implementing agent **MUST** edit the existing "Out of Scope for Inception" bullet so it reads (or equivalent):

> - **Code-archaeology summaries that pre-bind future implementation locations** ("the new auth module will live at `packages/foo/src/bar.ts`") — design owns implementation locations; inception MUST NOT pre-commit. **Backward-looking inventory of existing code with era tags** under `## Existing Code Structure` is the explicit exception (see content guide).

If the implementing agent leaves the original prohibition unchanged, the spec is self-contradictory and any later revisit will surface this as feedback. The `discovery-out-of-scope-carves-era-tagged-exception` gate enforces that a reconciliation happened.

## Files Touched

| Action | Path | Role |
|---|---|---|
| Edit | `plugin/studios/software/stages/inception/discovery/DISCOVERY.md` | Add `### Existing Code Structure` subsection under `## Content Guide`; add a worked example with era-tagged bullets; reconcile the existing "Out of Scope" prohibition |

## Edit specification

The edit is additive plus one targeted reconciliation — do not remove or restructure existing sections beyond the "Out of Scope" entry above.

### 1. New `### Existing Code Structure` subsection under `## Content Guide`

Insert this subsection (in the order: Business Context → Competitive Landscape → Considerations & Risks → UI Impact → **Existing Code Structure** new):

> ### Existing Code Structure
>
> A backward-looking inventory of code paths the new work will interact with — what already exists in the tree at the moment inception runs. This grounds downstream stages in real source rather than guesses. Tag every cited reference with its era / status so design and development can tell active from dormant patterns.
>
> **Tag values (one per reference, inline parenthetical):**
>
> - `(active)` — code that runs in the current production path and is the source-of-truth for new work
> - `(dormant)` — code that exists in the tree but is feature-flagged off, behind a deprecated provider, or otherwise not exercised in current production. Reference for context only — do NOT treat as ground truth for new work.
> - `(deprecated)` — code being actively phased out. Note the migration target on the same line.
> - `(in-flight)` — code under active development on a non-merged branch. Cite the branch.
>
> Tags MUST appear inline with the file reference, not in a separate legend, so the tag survives excerpt-into-subagent-prompt operations. Untagged references are ambiguous and downstream stages will treat them as `active` — which is wrong by default in any codebase that has both legacy and current paths coexisting.
>
> **Worked example:**
>
> ```markdown
> ## Existing Code Structure
>
> - `apps/worker/src/wallet/PayoutProvidersSection.tsx` (active) — current production payout flow; gates `AccountBalanceCard` off when Branch is active (L34-44)
> - `apps/worker/src/wallet/account-balance.tsx` (dormant) — Stripe-era Transfer button. Hidden under Branch; reference for context only.
> - `apps/worker/src/wallet/BranchWalletCard.tsx` (active) — Branch destination card; current source of truth for the wallet surface
> - `apps/worker/src/wallet/legacy-payout.tsx` (deprecated) — being removed in INTENT-XXX. Migration target: `PayoutProvidersSection`.
> ```

### 2. Reconcile the "Out of Scope for Inception" entry

Edit the bullet that currently reads:

> - **Code-archaeology summaries** ("this lives at `packages/foo/src/bar.ts`") — design pulls these as needed; inception should not pre-bind them

to read (matching language of section 1):

> - **Code-archaeology summaries that pre-bind future implementation locations** ("the new auth module will live at `packages/foo/src/bar.ts`") — design owns implementation locations; inception MUST NOT pre-commit. **Backward-looking inventory of existing code with era tags** under `## Existing Code Structure` is the explicit exception — see content guide.

### 3. Anti-pattern note

Add to the "Quality Signals" section at the bottom (or to the inception researcher's anti-patterns):

> Untagged file references in `## Existing Code Structure` are a spec gap. Either tag every reference, or surface the era ambiguity as an open question for the user to resolve.

## Why no frontmatter change

Per `plugin/studios/ARCHITECTURE.md` §1.1, frontmatter is workflow-engine territory and additions cost discovery + validator + downstream-consumer work. The era tag is a body-level annotation the inception agent emits as part of the markdown. No code reads it programmatically; downstream hats read it visually as part of grounding their work. That's the right boundary.

## Completion criteria

Each criterion is paired with the executable gate that proves it.

1. **The new `### Existing Code Structure` subsection is present in the content guide.**
   - `discovery-template-has-existing-code-structure-section` — anchored heading regex `^### Existing Code Structure`

2. **All four era tag values are defined (in inline parenthetical form so the example shows their canonical shape).**
   - `discovery-template-defines-era-tags` — chained greps that all four of `(active)`, `(dormant)`, `(deprecated)`, `(in-flight)` appear

3. **A worked example exists in the inline-tag bullet format.** This catches a "mention without example" failure mode.
   - `discovery-template-shows-era-tagged-bullet-example` — regex matches `^- \`<path>\` (era)` shape (backtick-bullet, code-span path, parenthetical era)

4. **The "Out of Scope" prohibition is reconciled** so the template is no longer self-contradictory. Verified by checking that the literal phrase `era-tagged` (or equivalent) plus `Existing Code Structure` appear somewhere — both must be in the file for the carve-out to read coherently.
   - `discovery-out-of-scope-carves-era-tagged-exception` — `grep -qE 'era.tagged|era-tagged|Existing Code Structure'`

5. **The full haiku MCP test suite still passes.**
   - `haiku-tests-still-pass` — `cd packages/haiku && node test/run-all.mjs`

6. **Inception stage content lints clean.**
   - `biome-lint-clean` — `bun x biome check plugin/studios/software/stages/inception/`

## Out of scope

- Adding era tagging to studios beyond `software`. Each studio's inception variant defines its own DISCOVERY.md; only `software`'s is in scope here.
- Migrating existing intents' DISCOVERY.md files. New intents inherit the updated template; existing intents are not retroactively re-annotated.
- Programmatic enforcement (a review-agent that fails when references are untagged). That's a follow-up — this unit only updates the content guide so future inception runs author the tags.
- Adding a frontmatter `era_inventory:` field. Decision recorded in this stage's decision_log: era is a body annotation, not a frontmatter field.
