# Architecture

Architecture map for the work in this intent. The intent ships **three small framework changes** to the `software` studio (one workstream per concern), each landing in pre-existing extension points the plugin already supports — no new orchestrator code paths, no new MCP tools, no schema migrations. The "system shape" relevant here is therefore the studio-content boundary plus the file-system protocols the workflow engine reads at runtime.

## Module Map

The intent's three units land in three distinct, well-isolated locations under `plugin/studios/software/`. Each location is read by an existing workflow-engine code path; the units are pure additions.

### Unit 1 — Designer-prep hat + DESIGN-SYSTEM-ANCHOR.md discovery template

| Touchpoint | Path | Role |
|---|---|---|
| New hat mandate | `plugin/studios/software/stages/design/hats/designer-prep.md` | Plan-class hat that reads source (atorasu tokens/atoms) and produces the anchor artifact |
| Existing hat mandate (consumes anchor) | `plugin/studios/software/stages/design/hats/designer.md` | Updated to declare `DESIGN-SYSTEM-ANCHOR.md` as a required pre-read |
| New discovery template | `plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md` | Schema for the per-intent anchor artifact (location, content guide, quality signals) |
| Stage spec (orchestrates the hat sequence) | `plugin/studios/software/stages/design/STAGE.md` | `hats:` list updated to insert `designer-prep` before `designer` |

Boundary: this is studio content only. The workflow engine already iterates `hats/*.md` (via `readHatDefs` in `studio-reader.ts`) and `discovery/*.md` (via the discovery scan in `orchestrator/workflow/handlers/elaborate.ts:131-149` which reads every `.md` under the stage's `discovery/` dir and dispatches one subagent per template). Adding a new file in either directory plugs into the existing fan-out without code changes.

### Unit 2 — Inception coverage review-agent for the design stage

| Touchpoint | Path | Role |
|---|---|---|
| New per-stage review-agent | `plugin/studios/software/stages/design/review-agents/inception-coverage.md` | Adversarial reviewer that audits design artifacts against inception's `DECISIONS.md` resolutions, `OPEN-QUESTIONS.md` resolved items, and UI-surfaces coverage |
| Existing peers (no change) | `plugin/studios/software/stages/design/review-agents/{accessibility,consistency}.md` | Run alongside the new agent at the design stage's review phase |

Boundary: this is studio content only. `readReviewAgentPaths(studio, stage)` in `studio-reader.ts:126-141` scans the stage's `review-agents/*.md` directory and returns name → path pairs. Adding a new file is sufficient; the orchestrator's review handler already dispatches one subagent per file.

### Unit 3 — Era / status field on inception's DISCOVERY.md template

| Touchpoint | Path | Role |
|---|---|---|
| Existing inception discovery template | `plugin/studios/software/stages/inception/discovery/DISCOVERY.md` | Content guide updated to add an `era`/`status` tag (active / dormant / Stripe-era / Branch-era) on prior-art file references in the "Existing Code Structure" section |

Boundary: pure markdown content edit. The DISCOVERY.md template is consumed by the inception stage's elaborate-phase agent as a content guide (the discovery scan reads its frontmatter for `location:` and uses the body as the per-template authoring contract). No frontmatter schema change, no validator change — only the body's "Content Guide" section gains a new sub-field that the inception agent is asked to populate when listing prior-art files.

## Data Flow

The runtime data flow that this intent affects is the **discovery-template fan-out** during a stage's elaborate phase. The change adds one more fan-out leg in the design stage and adds one more reviewer in the design stage's review phase. Nothing else moves.

```
Design stage elaborate phase (today, after intent merges):
  parent agent
    ├─ Read /haiku:research instructions (existing fan-out injection)
    ├─ Spawn Task subagent for DESIGN-BRIEF.md template
    ├─ Spawn Task subagent for DESIGN-TOKENS.md template
    └─ Spawn Task subagent for DESIGN-SYSTEM-ANCHOR.md template   ← NEW (Unit 1, leg of existing fan-out)
         │
         └─ writes .haiku/intents/{slug}/knowledge/DESIGN-SYSTEM-ANCHOR.md
            (per the template's `location:` frontmatter — consumed by both
             designer-prep and designer hats during execute)

Design stage execute phase (per-unit hat chain):
  designer-prep   (NEW — plan class)
    │  reads DESIGN-SYSTEM-ANCHOR.md, atorasu source files
    │  baton: real token specs + prior-art reads, recorded in unit body
    ▼
  designer        (existing — do class)
    │  consumes the anchor + atorasu reads, produces hi-fi mockups
    ▼
  design-reviewer (existing — verify class)

Design stage review phase (parallel adversarial reviewers):
  parent
    ├─ accessibility  (existing)
    ├─ consistency    (existing)
    └─ inception-coverage (NEW — Unit 2)
         │
         └─ writes FB-NN files under .haiku/intents/{slug}/stages/design/feedback/
            when artifacts contradict DECISIONS.md or omit UI surfaces
```

## Key Abstractions

The intent leans on three pre-existing abstractions; understanding their contracts is essential to landing the work without breaking sibling stages.

### 1. Discovery template as fan-out unit

A discovery template is a markdown file under `plugin/studios/{studio}/stages/{stage}/discovery/{NAME}.md` with:

- Frontmatter: `name`, `location` (where the populated artifact lives — typically `.haiku/intents/{intent-slug}/knowledge/{NAME}.md`), `scope` (`intent` or `stage`), `format`, `required`.
- Body: a "Content Guide" section that the discovery subagent uses as its authoring contract, plus "Quality Signals" as the acceptance bar.

The orchestrator's elaborate handler (`packages/haiku/src/orchestrator/workflow/handlers/elaborate.ts:131-149`) walks the directory at dispatch time, lower-cases each filename minus `.md`, and emits one fan-out leg per template into the elaborate prompt. The integrator merges each subagent's worktree back to the stage branch (`elaborate.ts:167-235`).

**Implication for Unit 1:** dropping `DESIGN-SYSTEM-ANCHOR.md` into `plugin/studios/software/stages/design/discovery/` is sufficient to wire the fan-out. No code change required.

### 2. Per-stage review agent registry

Per-stage review agents live at `plugin/studios/{studio}/stages/{stage}/review-agents/{NAME}.md`. `studio-reader.ts:126-141` (`readReviewAgentPaths`) returns a name → path mapping for the orchestrator to dispatch in parallel during the review phase. Optional `applies_to:` frontmatter scopes the agent by output kind (the existing `accessibility.md` uses this — its glob list of `*.html`, `*.tsx`, etc. skips backend-only stages). `interpretation: lens` frontmatter is conventional for adversarial reviewers (compare to `consistency.md` and `accessibility.md`).

**Implication for Unit 2:** dropping `inception-coverage.md` into `plugin/studios/software/stages/design/review-agents/` is sufficient to wire the dispatch. The `review-agents-include:` block in downstream stages' STAGE.md (e.g. `development` includes design's `consistency` and `accessibility`) does NOT need to be updated unless we want the new reviewer to run in development too — which is **out of scope** for this intent (the intent is design-stage scoped; including in development would be a separate decision).

### 3. Stage hat sequence and `STAGE.md` contract

The stage's `hats:` frontmatter list defines the per-unit hat chain. Per the canonical architecture document (`plugin/studios/ARCHITECTURE.md`), the chain MUST be plan → do → verify in that order. Today the design stage's `hats:` is `[designer, design-reviewer]`, which is **non-conformant** with the canonical pattern (no explicit plan-class hat, only do + verify).

**Implication for Unit 1:** inserting `designer-prep` as a plan-class hat ahead of `designer` simultaneously closes the issue #263 prior-art-grounding gap **and** brings the design stage into compliance with the canonical plan → do → verify pattern. The new `hats:` list will be `[designer-prep, designer, design-reviewer]`. The hat name `designer-prep` is distinct from phase names (`elaborate`, `execute`, `review`, `gate`) per the §3.1 hat-name discipline rule.

The `fix_hats:` list (`[designer, feedback-assessor]`) does NOT need to include `designer-prep` — fix-loop dispatch operates on FB bodies, not unit re-execution; the implementer per `fix_hats must be implementer` is the right convention.

## Dependency Graph

The intent has **no new external dependencies**. Every change consists of new or modified markdown files inside `plugin/studios/software/`. The implicit dependencies on workflow-engine code paths are:

| Dependency | Where it lives | Why it matters |
|---|---|---|
| Discovery scan | `packages/haiku/src/orchestrator/workflow/handlers/elaborate.ts:131-149` | Picks up new `DESIGN-SYSTEM-ANCHOR.md` template at next elaborate dispatch |
| Hat reader | `packages/haiku/src/studio-reader.ts:53-103` (`readHatDefs`) | Picks up new `designer-prep.md` at next stage execute dispatch |
| Review-agent reader | `packages/haiku/src/studio-reader.ts:126-141` (`readReviewAgentPaths`) | Picks up new `inception-coverage.md` at next stage review dispatch |
| STAGE.md `hats:` parser | `packages/haiku/src/orchestrator/workflow/build-studio-config.ts` (StudioConfig builder) | Uses the updated list when building per-unit hat chains |

These are reads, not validations — the workflow engine does not enforce a schema on individual hat or review-agent files. The validation is the **canonical architecture document** (`plugin/studios/ARCHITECTURE.md`) and the studio-author checklist therein.

## Architectural Decisions

These are non-obvious choices for *this intent*. Rationale lives in the intent's CONVERSATION-CONTEXT.md and issue #263; the entries below are the architectural translations.

### AD-1 — Anchor artifact lives at intent scope, not project scope

The DESIGN-SYSTEM-ANCHOR.md is per-intent (`location: .haiku/intents/{intent-slug}/knowledge/DESIGN-SYSTEM-ANCHOR.md`), not project-wide.

**Why X over Y:** A project-wide anchor would drift across intents because design tokens evolve. Per-intent regeneration forces designer-prep to re-read source on every intent, which is the exact behavior issue #263 #6 is asking for. Shared knowledge across intents already has a venue (`plugin/studios/software/stages/design/discovery/DESIGN-TOKENS.md` is intent-scope but the **content** of the project's design system is read by the elaborator itself — the anchor is the per-intent realized snapshot of those reads).

### AD-2 — `designer-prep` is a hat, not a separate phase

The hat lives inside the per-unit execute chain, not as a stage-level phase.

**Why X over Y:** Stage-level phases are workflow-engine reserved (`elaborate` / `execute` / `review` / `gate`). Per `ARCHITECTURE.md` §2.1 and §3.1, agent-defined work goes in hats. The plan-class slot (designer-prep) was missing in design today — adding it as a hat both grounds the work in source AND brings the stage into canonical plan → do → verify compliance. A new phase would require workflow-engine changes; a new hat does not.

### AD-3 — Inception-coverage runs as a review-agent, not as a hat

The inception-coverage adversarial check runs **after** the per-unit hat chain (in the stage's review phase), not as a verifier hat.

**Why X over Y:** The verifier hat (`design-reviewer`) is body-only per `ARCHITECTURE.md` §3.4 (no FM interpretation, no cross-stage reads). The inception-coverage check explicitly reads cross-stage artifacts (`stages/inception/.../DECISIONS.md`, `OPEN-QUESTIONS.md`, the inception KNOWLEDGE.md output). That cross-stage reading is the **adversarial reviewer's** mandate, not the verifier's. Review agents also run in parallel against finished artifacts, which matches the audit-against-inception pattern more cleanly than a per-unit verify step.

### AD-4 — Era field is content-guide-level, not frontmatter-level

The era / status tag is added as a documented sub-field inside the DISCOVERY.md template's "Existing Code Structure" content guide, not as a new frontmatter field.

**Why X over Y:** The discovery template's frontmatter is workflow-engine territory (`location`, `scope`, `format`, `required`) per `ARCHITECTURE.md` §1.1. The agent populates the body, not the frontmatter. The era tag is a per-file-reference annotation in the body — naturally a content-guide concern. Promoting it to frontmatter would require a workflow-engine schema change with no benefit (the workflow engine doesn't programmatically read prior-art tags; only the downstream design-stage agent does).

### AD-5 — Single-stage quick intent despite three concerns

The intent uses quick mode (single-stage development-only) with three units instead of three separate intents.

**Why X over Y:** All three changes are small markdown additions in well-isolated paths. They share a common motivation (issue #263) and a common test path (rerun the design stage on a representative intent and observe the prior-art grounding + coverage audit + era tagging). Splitting would triple the orchestration overhead for no additional safety. The architecture-map sync (per `architecture-prototype-sync.md`) is a single update for all three.

## Cross-cutting context boundaries

Per the subagent's strict scope, the following items are noted here but their substance is owned by sibling discovery artifacts:

- **Verification approach for these changes** — depends on the validation/testing axis (sibling artifact). The architecture impact is that the changes are pure additions, so test surface is "does the new fan-out leg fire?" + "does the new reviewer surface findings?" — sibling artifact owns the actual test plan.
- **User-visible documentation impact** — depends on the documentation/website axis (sibling artifact, if dispatched). The architecture impact is the sync-discipline rules in repo-root `CLAUDE.md`: a new hat needs a paper mention, a new review-agent needs a paper mention in Quality Enforcement, a discovery-template change is paper-optional. The sibling owns the actual doc updates.
- **Atorasu / mobile codebase access for the designer-prep hat at runtime** — the hat will be used in *consumer* projects, not in this repo. The architectural assumption is that the designer-prep hat's mandate file references the codebase paths the consumer project's inception captured (e.g. `mobile/apps/worker/src/atorasu/...`); the plugin itself doesn't need access to those files. This is a pure-content authoring concern owned by the hat-mandate authoring step in Unit 1.
- **Architecture-map sync** — the runtime architecture map at `website/app/studios/[slug]/architecture/` (per `.claude/rules/architecture-prototype-sync.md`) needs a re-render of the studio JSON sidecar after Unit 1 lands (new hat, new discovery template change the enumerated structure). Build hook is `node website/_build-prototype-content.mjs`. The map's `_data/payload-for.ts` and `_data/hooks.ts` do NOT change because no new orchestrator action or hook is introduced. Sync is owned by the implementing unit; the architectural fact is that the change-surface is one rebuild command.

## Risk Surfaces

| Risk | Mitigation |
|---|---|
| Adding `designer-prep` to `hats:` shifts the hat chain for in-flight design-stage intents on this branch | Quick mode + plugin repo only — no live consumer intents are mid-flight inside this repo's `.haiku/` (only the bootstrap intent for issue #263 itself, which is on `development` stage and not the design stage) |
| Inception-coverage review-agent fires on artifacts that don't have a corresponding inception (e.g. quick-mode intents that skipped inception entirely) | Use `applies_to:` frontmatter to scope the agent by file kind, OR have the agent's mandate body short-circuit when `stages/inception/` is absent. Implementing unit decides; both are valid. |
| Era field added to DISCOVERY.md content guide is ignored by the inception agent (because content-guide is advisory, not enforced) | The verifier hat at inception (`stages/inception/hats/verifier.md`) consumes the content guide as its acceptance bar. Add an era-tagging quality signal there OR rely on the inception-coverage reviewer (Unit 2) to flag missing era tags downstream — Unit 2's mandate naturally includes this since it audits `DECISIONS.md` and the era-tagging gap was the trigger for Unit 2. |

## Quality Signals (self-audit against template)

- A new developer can understand the intent's shape from this document — yes; module map shows every file and which workflow-engine code path reads it.
- Rationale explains "why" not just "what" — Architectural Decisions section pairs each choice with the rejected alternative and the reason.
- Diagrams use text format — yes, ASCII fan-out + table form throughout.
- Outdated sections updated, not left to accumulate — N/A; this is a living document and this is its first content for this intent.
