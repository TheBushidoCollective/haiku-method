---
title: Era tagging in inception's DISCOVERY.md template
model: haiku
depends_on: []
outputs:
  - plugin/studios/software/stages/inception/discovery/DISCOVERY.md
quality_gates:
  - name: discovery-template-has-era-section
    command: >-
      grep -qE 'era|Era|status:'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: discovery-template-explains-active-vs-dormant
    command: >-
      grep -qiE 'active|dormant|deprecated'
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: discovery-template-shows-example
    command: >-
      grep -qE '^- \['
      plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - name: haiku-tests-still-pass
    command: cd packages/haiku && node test/run-all.mjs
  - name: biome-lint-clean
    command: bun x biome check plugin/studios/software/stages/inception/
status: pending
inputs: >-
  ["intent.md", "knowledge/ARCHITECTURE.md", "plugin/studios/ARCHITECTURE.md",
  "plugin/studios/software/stages/inception/discovery/DISCOVERY.md",
  "plugin/studios/software/stages/inception/hats/researcher.md"]
---
## Goal

Close issue #263 item 5 by extending the inception stage's `DISCOVERY.md` discovery template to require an **era / status tag** on prior-art file references. The reporter described an incident where the inception doc listed both Stripe-era (dormant) and Branch-era (active) code paths without distinguishing them, and the design hat conflated patterns from both. A simple `(active)` / `(dormant)` / `(deprecated)` tag on each cited code reference is enough to prevent the conflation at the source.

This is **content-guide level only** — no frontmatter schema change, no orchestrator code change. Per `plugin/studios/ARCHITECTURE.md` §1.1, frontmatter is workflow-engine territory; era is body annotation the inception agent populates per discovery.

## Files Touched

| Action | Path | Role |
|---|---|---|
| Edit | `plugin/studios/software/stages/inception/discovery/DISCOVERY.md` | Add an "Era / status tagging" section to the content guide; add a worked example in the existing-code-structure section |

## Edit specification

The edit is additive — do not remove or restructure existing sections. Add the following:

### 1. New content-guide subsection under "Existing Code Structure" (or equivalent prior-art section)

Insert after the existing instructions for citing files:

> **Tag every cited code reference with its era / status.** Use one of:
>
> - `(active)` — code that runs in the current production path and is the source-of-truth for new work
> - `(dormant)` — code that exists in the tree but is feature-flagged off, behind a deprecated provider, or otherwise not exercised in current production. Reference for context only — do NOT treat as ground truth for new work.
> - `(deprecated)` — code being actively phased out. Note the migration target on the same line.
> - `(in-flight)` — code under active development on a non-merged branch. Cite the branch.
>
> Tags MUST appear inline with the file reference, not in a separate legend, so the tag can never be lost when content is excerpted into a downstream subagent prompt. Untagged references are ambiguous and downstream stages will treat them as `active` — which is wrong by default in any codebase that has both legacy and current paths coexisting.

### 2. Worked example (added to the existing "Example Discovery" section, or a new minimal example)

Show the format clearly so the inception agent has a pattern to copy:

```markdown
## Existing Code Structure

- `apps/worker/src/wallet/PayoutProvidersSection.tsx` (active) — current production payout flow; gates `AccountBalanceCard` off when Branch is active (L34-44)
- `apps/worker/src/wallet/account-balance.tsx` (dormant) — Stripe-era Transfer button. Hidden under Branch; reference for context only.
- `apps/worker/src/wallet/BranchWalletCard.tsx` (active) — Branch destination card; current source of truth for the wallet surface
- `apps/worker/src/wallet/legacy-payout.tsx` (deprecated) — being removed in INTENT-XXX. Migration target: PayoutProvidersSection.
```

### 3. Anti-pattern note (in the inception researcher hat's anti-patterns or in DISCOVERY.md)

Add a single bullet to the inception template's anti-patterns section, OR (preferred — single edit point) into DISCOVERY.md's content guide:

> Untagged file references in `## Existing Code Structure` are a spec gap. Either tag every reference, or surface the era ambiguity as an OPEN-QUESTION for the user to resolve.

## Why no frontmatter change

Per `plugin/studios/ARCHITECTURE.md` §1.1, frontmatter is workflow-engine territory and additions cost discovery + validator + downstream-consumer work. The era tag is a body-level annotation the inception agent emits as part of the markdown. No code reads it programmatically; downstream hats read it visually as part of grounding their work. That's the right boundary.

## Completion criteria

1. `DISCOVERY.md` template includes a content-guide section that names era / status / active / dormant / deprecated as required tags.
   - Verified by gates `discovery-template-has-era-section` and `discovery-template-explains-active-vs-dormant`.
2. The template includes at least one worked example showing the tag in inline format (e.g. a bulleted file reference with parenthetical era).
   - Verified by gate `discovery-template-shows-example`.
3. The full haiku MCP test suite still passes (no regression in studio-config / discovery-template loading).
   - Verified by gate `haiku-tests-still-pass`.
4. Inception stage content lints clean.
   - Verified by gate `biome-lint-clean`.

## Out of scope

- Adding era tagging to studios beyond `software`. Each studio's inception variant defines its own DISCOVERY.md; only `software`'s is in scope here.
- Migrating existing intents' DISCOVERY.md files. New intents inherit the updated template; existing intents are not retroactively re-annotated.
- Programmatic enforcement (a review-agent that fails when references are untagged). That's a follow-up — this unit only updates the content guide so future inception runs author the tags.
