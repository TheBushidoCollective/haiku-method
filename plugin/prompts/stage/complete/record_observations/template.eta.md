## Record stage observations

The **<%= it.stage %>** stage of intent **<%= it.slug %>** has every approval signed. Before the engine merges the stage and advances, write a brief reflection at `.haiku/intents/<%= it.slug %>/stages/<%= it.stage %>/observations.md` that captures the parts of this stage that **artifacts on disk don't already show**.

What's already captured elsewhere — don't repeat it:

- Which hats fired and how many bolts they took → **`iterations` on each unit's FM**
- What each hat produced → **the unit body + declared `outputs`**
- Every formal "this needed another turn" → **feedback files** in `stages/<%= it.stage %>/feedback/` and intent-scope `feedback/`

What only you saw — capture this:

- **Mandate ambiguity** — places where a hat's mandate (in `plugin/hats/<hat>.md`, `plugin/studios/.../hats/<hat>.md`, or your project overlay) read multiple ways and you had to pick an interpretation
- **Engine friction** — orchestrator actions or cursor decisions that felt wrong (e.g. dispatched a hat against the wrong artifact, looped on a state the cursor should have advanced past)
- **Discovery dead-ends** — research paths you explored that didn't pan out and what made them dead-ends
- **Surprise** — anything in the stage's outputs that surprised you given the inputs (good or bad surprise both count)
- **Out-of-band thrashing** — re-reading the same mandate multiple times, second-guessing a verifier's pass, hitting a quality-gate failure that wasn't obvious from the unit body

## Format

Free-form markdown. A few paragraphs is enough. Use this skeleton if helpful:

```markdown
# Stage <%= it.stage %> — Observations

## Where the mandates were ambiguous
- ...

## Where the engine felt wrong
- ...

## Surprises
- ...

## What I'd want the next contributor (or the next intent) to know
- ...
```

Keep it short — quality over quantity. The reflection pass at intent close reads this alongside the FBs / outputs / iterations to synthesize the run and land any project-local overlays or engine-class reports. Empty observations.md is fine if there's nothing notable; a one-line "stage ran clean, no observations" beats inventing fluff.

## When you're done

Use the `Write` tool to create the file. The next `haiku_run_next` tick sees observations.md on disk and falls straight through to `complete_stage` — no extra tool call needed.
