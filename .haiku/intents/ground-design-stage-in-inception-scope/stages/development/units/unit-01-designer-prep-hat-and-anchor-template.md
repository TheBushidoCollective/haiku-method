---
title: Designer-prep hat + DESIGN-SYSTEM-ANCHOR.md template
model: sonnet
depends_on: []
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - knowledge/CONVERSATION-CONTEXT.md
  - plugin/studios/ARCHITECTURE.md
  - plugin/studios/software/stages/design/STAGE.md
  - plugin/studios/software/stages/design/hats/designer.md
  - plugin/studios/software/stages/design/discovery/DESIGN-BRIEF.md
  - plugin/studios/software/stages/design/discovery/DESIGN-TOKENS.md
  - packages/haiku/src/studio-reader.ts
  - packages/haiku/src/orchestrator/workflow/handlers/elaborate.ts
outputs:
  - plugin/studios/software/stages/design/hats/designer-prep.md
  - plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md
  - plugin/studios/software/stages/design/hats/designer.md
  - plugin/studios/software/stages/design/STAGE.md
quality_gates:
  - name: designer-prep-hat-exists
    command: '[ -f plugin/studios/software/stages/design/hats/designer-prep.md ]'
  - name: anchor-template-exists
    command: >-
      [ -f
      plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md ]
  - name: designer-hat-references-anchor
    command: >-
      grep -q 'DESIGN-SYSTEM-ANCHOR.md'
      plugin/studios/software/stages/design/hats/designer.md
  - name: stage-hats-list-prepends-designer-prep
    command: >-
      grep -qE
      '^hats:\s*\[\s*designer-prep\s*,\s*designer\s*,\s*design-reviewer\s*\]\s*$'
      plugin/studios/software/stages/design/STAGE.md
  - name: anchor-template-location-canonical
    command: >-
      grep -qE
      '^location:\s+\.haiku/intents/\{intent-slug\}/knowledge/DESIGN-SYSTEM-ANCHOR\.md\s*$'
      plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md
  - name: anchor-template-scope-intent
    command: >-
      grep -qE '^scope:\s+intent\s*$'
      plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md
  - name: haiku-tests-still-pass
    command: cd packages/haiku && node test/run-all.mjs
  - name: biome-lint-clean
    command: bun x biome check plugin/studios/software/stages/design/
status: completed
bolt: 5
hat: reviewer
started_at: '2026-04-28T21:57:33Z'
hat_started_at: '2026-04-28T23:43:23Z'
iterations:
  - hat: planner
    started_at: '2026-04-28T21:57:33Z'
    completed_at: '2026-04-28T22:09:18Z'
    result: advance
  - hat: builder
    started_at: '2026-04-28T22:09:18Z'
    completed_at: '2026-04-28T22:12:33Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:12:33Z'
    completed_at: '2026-04-28T22:17:57Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:17:57Z'
    completed_at: '2026-04-28T22:22:38Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:22:38Z'
    completed_at: '2026-04-28T22:27:49Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:27:49Z'
    completed_at: '2026-04-28T23:43:23Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-28T23:43:23Z'
    completed_at: '2026-04-28T23:46:58Z'
    result: advance
completed_at: '2026-04-28T23:46:58Z'
---
## Goal

Close issue #263 items 1, 3, 4, and 6 by adding a plan-class **designer-prep** hat that runs before the designer hat in the design stage. The hat reads source code (atorasu tokens / atoms / quarks) and produces a `DESIGN-SYSTEM-ANCHOR.md` discovery artifact with concrete specs (real button heights, real radii, real spacing scale, real color tokens). Downstream, the designer hat declares the anchor as a required pre-read so its mockups are grounded in real values rather than guesses.

This also brings the design stage into compliance with `plugin/studios/ARCHITECTURE.md` §3 (plan → do → verify). Today's `[designer, design-reviewer]` is missing the plan slot; `designer-prep` fills it.

## Files Touched

| Action | Path | Role |
|---|---|---|
| Create | `plugin/studios/software/stages/design/hats/designer-prep.md` | Plan-class hat: read source, emit anchor artifact |
| Create | `plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md` | Per-intent discovery template — schema/location/content guide for the anchor artifact |
| Edit | `plugin/studios/software/stages/design/hats/designer.md` | Declare `DESIGN-SYSTEM-ANCHOR.md` as a required pre-read at the top of the "During execute" section |
| Edit | `plugin/studios/software/stages/design/STAGE.md` | Update `hats:` list from `[designer, design-reviewer]` to `[designer-prep, designer, design-reviewer]` |

All four paths are declared in this unit's `outputs:` frontmatter so the workflow engine's write-scope enforcement covers every file the implementing agent will touch (not just the two it creates).

## Why this plugs into existing extension points (no engine code change)

- `readHatDefs` in `packages/haiku/src/studio-reader.ts` enumerates `hats/*.md`. Adding `designer-prep.md` and listing it in `STAGE.md`'s `hats:` is enough to make the workflow engine dispatch it.
- The discovery scan in `packages/haiku/src/orchestrator/workflow/handlers/elaborate.ts:131-149` enumerates every `.md` under the stage's `discovery/` dir and dispatches one subagent per template during the elaborate phase. Adding `DESIGN-SYSTEM-ANCHOR.md` plugs into this fan-out automatically — no orchestrator code change required.

## Hat content requirements (designer-prep.md)

- **Focus** statement: ground the design stage in real source. Read the project's design system (e.g. `atorasu/style/theme/colors.ts`, `atorasu/atoms/Button.tsx`, `atorasu/atoms/Surface.tsx`, `atorasu/quarks/Spacer.tsx`) and produce the anchor doc.
- **During elaborate** instructions: enumerate prior-art files referenced by inception's `DISCOVERY.md` `## Existing Code Structure` section (added by unit-03). Read each. Extract concrete tokens.
- **During execute** instructions: write the anchor artifact at the location declared by `DESIGN-SYSTEM-ANCHOR.md` (intent-relative path).
- **Anti-patterns (RFC 2119)**: at minimum
  - `MUST NOT` produce mockups (that's the designer's job)
  - `MUST NOT` summarize tokens — record concrete values from source
  - `MUST` cite source-file line numbers for every token recorded

## Anchor template content (DESIGN-SYSTEM-ANCHOR.md)

Discovery template frontmatter — match the canonical form used by every other discovery template in the studio (`DISCOVERY.md`, `DESIGN-BRIEF.md`, `DESIGN-TOKENS.md`):

```yaml
---
name: design-system-anchor
location: .haiku/intents/{intent-slug}/knowledge/DESIGN-SYSTEM-ANCHOR.md
scope: intent
format: text
required: true
purpose: Concrete design-system specs extracted from real source — button heights, radii, color tokens, spacing scale — cited to file:line.
---
```

The `location:` MUST use the full `.haiku/intents/{intent-slug}/knowledge/...` prefix (not a shortened `knowledge/...` form) — `computeStageScope` in `packages/haiku/src/state-tools.ts` strips that prefix to derive the per-intent path, so anything else mis-resolves. `scope: intent` MUST be present so the field doesn't default silently.

Body sections (content guide, not literal output):

1. **Atoms** — every reusable atomic component, its real spec (heights / radii / paddings), cited to source file:line
2. **Tokens** — color, spacing, typography, radius scales pulled from the project's tokens module
3. **Active vs dormant patterns** — flag any era-tagged patterns (cross-references to inception's DISCOVERY.md era tags from unit-03)
4. **Open questions** — anything ambiguous from source that needs designer judgment

## designer.md edit

At the top of the "During execute (your phase):" section, prepend a bullet:

> - **Read `knowledge/DESIGN-SYSTEM-ANCHOR.md` first** — the designer-prep hat extracted real specs from source. Use those values, not guesses.

## STAGE.md edit

Change:
```yaml
hats: [designer, design-reviewer]
```

to:
```yaml
hats: [designer-prep, designer, design-reviewer]
```

## Completion criteria

Each criterion is paired with the executable gate that proves it. The full `quality_gates:` list lives in this unit's frontmatter (the workflow engine runs each at advance time).

1. **The two new files exist and are well-formed markdown.**
   - `designer-prep-hat-exists` — `[ -f plugin/studios/software/stages/design/hats/designer-prep.md ]`
   - `anchor-template-exists` — `[ -f plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md ]`

2. **The anchor template's `location:` uses the canonical full-prefix form, and `scope: intent` is explicit.**
   - `anchor-template-location-canonical` — exact match against `^location:\s+\.haiku/intents/\{intent-slug\}/knowledge/DESIGN-SYSTEM-ANCHOR\.md\s*$`
   - `anchor-template-scope-intent` — exact match against `^scope:\s+intent\s*$`

3. **The designer hat references the anchor as a required pre-read** (specifically the literal string `DESIGN-SYSTEM-ANCHOR.md`).
   - `designer-hat-references-anchor` — `grep -q 'DESIGN-SYSTEM-ANCHOR.md' plugin/studios/software/stages/design/hats/designer.md`

4. **The design stage's `hats:` list is exactly `[designer-prep, designer, design-reviewer]` — designer-prep first, no extra whitespace tolerated.**
   - `stage-hats-list-prepends-designer-prep` — anchored regex `^hats:\s*\[\s*designer-prep\s*,\s*designer\s*,\s*design-reviewer\s*\]\s*$`

5. **The full haiku MCP test suite still passes** (no regressions in studio-config or hat-resolution tests).
   - `haiku-tests-still-pass` — `cd packages/haiku && node test/run-all.mjs`

6. **The design stage's content lints clean.**
   - `biome-lint-clean` — `bun x biome check plugin/studios/software/stages/design/`

## Out of scope

- Wiring designer-prep into other studios (libdev, gamedev). This unit only touches the `software` studio.
- Re-running an existing intent through the new hat. Existing intents that completed design before this change are not retroactively re-grounded.
- Era-tagging of prior-art references in inception's `DISCOVERY.md` — that's unit-03's job. This unit may reference the era tags but does not introduce them.
- Adding a new test in `studio-config.test.mjs` that asserts the new design hats list. The grep-based gate above is sufficient enforcement; expanding test coverage on the design stage's hat sequence is a separate concern outside this intent.
