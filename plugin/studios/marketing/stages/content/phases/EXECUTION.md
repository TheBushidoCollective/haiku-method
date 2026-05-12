# Content Stage — Execution

## Per-unit baton (`content-creator → copy-editor → verifier`)

Every content unit walks the three hats in order. The baton is the asset family the unit owns — copy, landing pages, emails, social posts, ad creative — accumulating in the unit body:

1. **`content-creator` (plan + do):** Reads the messaging framework for the segment and channel this unit serves, identifies each asset's job, drafts the full content. Hands off when every asset is fully drafted (no placeholders), each CTA is specific, and tone matches the framework for this segment and channel category.
2. **`copy-editor` (do — refinement):** Sharpens the creator's draft across four passes — clarity, tone fit, CTA strength, cross-asset consistency. Edits in place, preserves the creator's voice, does not introduce new messaging. Hands off when the asset family is consistent, the CTAs are sharp, and edits are noted inline so the creator can audit.
3. **`verifier` (verify):** Reads the asset family body and runs the substance / coherence / upstream-trace / decision-register / open-questions checks from `hats/verifier.md`. Advances on pass, rejects to the responsible hat on fail.

The hat order is `plan → do → verify` because the creator produces the framework-grounded draft, the copy-editor sharpens (do — refinement), and the verifier validates substance. The rally-race test (architecture §2.3) is met because each hat's output is meaningfully different from the prior hat's: the creator's draft is messaging adapted to channel; the editor's output is the same messaging tuned for clarity and CTA strength; the verifier's output is the validated artifact.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `brand-alignment` review agent fires, plus any studio-level review agents.
3. **Fix loop** — `fix_hats: [classifier, content-creator, feedback-assessor]` dispatches per finding. The copy-editor is intentionally not in the fix loop because the creator owns the underlying messaging choices; the editor's sharpening pass naturally re-applies on the next iteration of the artifact.
4. **Gate** — `ask`. The user approves assets locally before distribution, because live channel mistakes are expensive to retract.

## Reviewer guidance specific to this stage

- **Drift between the framework's value proposition and the asset's lead message** is the highest-priority finding. The framework is the contract; assets that quietly paraphrase the value prop into something with different meaning corrupt every downstream channel.
- **Invented claims, statistics, or customer quotes** that aren't in the framework or its cited evidence are the most legally and reputationally expensive failure mode. Treat as a hard block.
- **Multiple competing CTAs in a single asset** is the most reliable signal of unclear thinking about the asset's job. One asset, one primary action — exceptions need explicit framework support.
- **Channel-agnostic copy reused verbatim across channels** is the most common drift. Tone and format should differ across owned, paid, earned, and direct channel categories.
