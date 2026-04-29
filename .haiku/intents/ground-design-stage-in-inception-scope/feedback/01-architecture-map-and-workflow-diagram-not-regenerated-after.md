---
title: >-
  Architecture map and workflow diagram not regenerated after hat + review-agent
  additions
status: closed
origin: studio-review
author: cross-stage-consistency
author_type: agent
created_at: '2026-04-29T00:52:55Z'
iteration: 0
visit: 0
source_ref: null
closed_by: 'intent-fix:FB-01:bolt-1-manual'
bolt: 0
triaged_at: '2026-04-29T00:52:55Z'
resolution: null
replies: []
---

**Lens:** Cross-stage consistency — declared outputs exist at the paths their unit frontmatter promised; stages collectively deliver the intent's stated goal.

**Finding:** Unit 1 added `designer-prep` as a new hat and `DESIGN-SYSTEM-ANCHOR.md` as a new discovery template; Unit 2 added `inception-coverage` as a new review agent. Per `.claude/rules/architecture-prototype-sync.md`, any change to the studio that adds/removes a stage, hat, review agent, or discovery template requires regenerating two derived artifacts. Neither was regenerated on this branch.

**Evidence:**

1. `website/public/workflow-diagrams/software.mmd` — still shows the old hat sequence:
   ```
   design_execute_designer --> design_execute_design_reviewer : hat.advance
   design_execute_design_reviewer --> design_execute_done : hat.advance
   ```
   `designer-prep` is absent from the state diagram. Command to regenerate: `bun run --cwd packages/haiku export:workflow-diagrams`.

2. `website/public/prototype-stage-content.json` — `stageMd` for the software studio's design stage still reads `hats: [designer, design-reviewer]`; `reviewAgents` keys are `['accessibility', 'consistency']` — `inception-coverage` is absent. Command to regenerate: `node website/_build-prototype-content.mjs`.

The knowledge artifact at `.haiku/intents/ground-design-stage-in-inception-scope/knowledge/ARCHITECTURE.md` (line 156) explicitly notes this sync step and assigns it to the implementing unit: "Sync is owned by the implementing unit; the architectural fact is that the change-surface is one rebuild command."

**What to do:** Run `node website/_build-prototype-content.mjs` to regenerate `prototype-stage-content.json`, then run `bun run --cwd packages/haiku export:workflow-diagrams` (or `bun run --cwd packages/haiku build`, which includes the prebuild hook) to regenerate `software.mmd`. Verify the design stage section of `software.mmd` shows `designer-prep → designer → design-reviewer` and `prototype-stage-content.json` lists all three hats and includes `inception-coverage` in `reviewAgents`.
