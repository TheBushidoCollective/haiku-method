# Concept Stage — Execution

## Per-unit baton (`game-designer → creative-director → distiller → verifier`)

Every concept unit walks the four hats in order. The baton is the unit body, growing section by section as each hat appends its contribution:

1. **`game-designer` (plan):** Reads intent, the captured `elaboration.md`, sibling concept units, and any open Decisions. Drafts the unit's `## Plan Artifact` section — pillars / loop / fantasy / audience / scope / risks framed in player-facing terms with concrete references. Hands off when the plan reads as a structured proposal, not a brainstorm.
2. **`creative-director` (plan-refine):** Reads the plan artifact and walks each axis (art, audio, narrative tone, audience overlap) against the proposal. Appends `## Direction Reconciliation` with per-axis CONFIRM / REVISE / ESCALATE verdicts. Surfaces hard contradictions via `ask_user_visual_question` rather than burying them in open questions.
3. **`distiller` (do):** Reads both upstream sections. Writes the **finished per-topic knowledge artifact** — the unit body in its consumable form, with adjectival drift replaced by concrete behaviors, comparable titles named, Decision IDs cited. This is the deliverable downstream stages will read as input.
4. **`verifier` (verify):** Reads every concept unit, validates the body against substance / coherence / decision-register-consistency rules. Either advances (the artifact reads as a finished knowledge document) or rejects with the responsible hat named.

The hat order is `plan → plan-refine → do → verify` because the game-designer's mechanical proposal must be reconciled with creative direction *before* it is distilled — distilling an unreconciled proposal produces an artifact that the creative-director's revisions then have to fight, which is slower and noisier than getting alignment first.

## After execute completes

When every concept unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the concept artifacts conform.
2. **Quality review (parallel)** — The stage's review agents (`pillar-coherence`, `scope-feasibility`) fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The `fix_hats:` chain (`classifier → game-designer → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB to the right concept unit; `game-designer` is the implementer; the assessor decides closure.
4. **Gate** — The stage's gate is `ask` — concept is a creative-direction decision that needs human signoff, not external review submission.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Pillar-loop drift** is the single highest-priority finding — a "co-op trust" pillar with a solo-only loop is a contradiction that production cannot fix.
- **Adjectival drift** ("engaging", "fun", "tight") is the most common drift; it reads as concrete but is unfalsifiable.
- **Scope unvalidated against comparable titles** is gate-blocking — production stage cannot defend a scope concept never defended.
- **Silent abandonment of a pillar** (a pillar named in unit-01 that no other unit references) is a finding worth surfacing even when not strictly out-of-spec.
