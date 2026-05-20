# Blog: visual flair to break the text wall

Long-form prose without visual landmarks reads as a wall, and walls are where readers bounce. Posts under `website/content/blog/**/*.{md,mdx}` should use MDX components to give the eye somewhere to land, surface the load-bearing claims, and turn parallel structures into things the reader can scan rather than parse.

This rule sits alongside `.claude/rules/content-voice.md`, `.claude/rules/blog-humanize.md`, and `.claude/rules/blog-general-audience.md`. Voice and general-audience win on conflicts; this rule is about the rhythm and density of the visual presentation.

## The bar

A well-flaired post:

1. Opens with prose, not a component. The first 1–3 paragraphs set the scene in plain text.
2. Drops the first visual landmark by the time the reader has scrolled once — a Callout, a Card grid, a Compare block, a TickSequence, a Mermaid.
3. Has at least one visual landmark per major section thereafter, but never two components back-to-back without prose between them.
4. Uses prose to introduce each component, not the other way around. The reader knows what they're looking at before they hit it.

A failing post:

- Is one continuous text block from intro to closer.
- Has three Compare blocks in a row with no prose between them (a "comparison stack" that reads as a table dump).
- Uses a component as the entire section (KeyPoints with no prose before it, Card grid as the whole point).

## Density target (load-bearing)

**Aim for one visual landmark per 12–18 lines of content for essay posts. Aim for one per 6–10 lines for comparison posts.** The earlier version of this rule said "2–3 landmarks per post" — that's wrong for anything over 60 lines. A 100-line essay with only 2 landmarks is a text wall with garnish.

Concretely:

- A 60-line post should have 4–5 landmarks (Callouts, KeyPoints, Grids, Compares).
- A 100-line post should have 6–9.
- A 150-line post should have 9–12.
- A 200-line comparison post should have 15–20 (mostly Compare blocks).

If your post has long runs of unbroken prose between landmarks, the reader's eye has nowhere to land and the post reads as a wall regardless of how good the prose is. Density is not optional — it's the difference between "engaging" and "I'll come back to this later."

## Where to find more landmarks (re-read your draft with these eyes)

When you've added the obvious Callout and KeyPoints and still don't have density, look for these hidden conversion targets:

1. **Any sentence that lists 3+ things in the same shape.** "It manages the routes, the components, the styling, and the network calls" → Card grid (4 cards, one per item) or KeyPoints (numbered).
2. **Any paragraph that walks through "first X, then Y, then Z."** → TickSequence with 3–6 TickCards.
3. **Any paragraph that contrasts "before vs after" or "their way vs our way."** → Compare with 2 Sides.
4. **Any subsection that's a short paragraph under an `<h3>`.** → Card inside a Grid; group 2 or 4 of them together.
5. **Any sentence with a long parenthetical list.** → Pull the parenthetical into a KeyPoints block above the sentence.
6. **Any "the X is the Y" thesis sentence at the end of a section.** → Wrap in a Callout (`tone="info"` for thesis, `tone="good"` for wins, `tone="warn"` for failure modes).
7. **Any paragraph that names 3+ named entities (tools, files, concepts) in a row.** → Use Pills inline OR convert to a Card grid.

If after one pass you still see a paragraph longer than ~6 lines with no visual landmark nearby, find a sentence inside it that's begging to be promoted.

## The components and when to reach for them

These are the building blocks. Each has a default use case; deviate only when the default would fight the post.

### `Callout`

```mdx
<Callout tone="info|good|warn|bad" title="Short label">
Body prose. One short paragraph. Cite a specific thing.
</Callout>
```

Reach for it when you need to:
- Set up the failure mode the post is about (`tone="warn"`).
- Lock in the thesis once it's been earned (`tone="info"` or `tone="good"`).
- Pull a load-bearing quote or admission out of running prose so it doesn't get lost (`tone="info"`).
- Surface a real, dated incident grounding the argument (`tone="warn"` or `tone="bad"`).

One per post is typical. Two is fine if they earn distinct beats. Three is almost always too many — Callouts lose punch when stacked.

### `Card` + `Grid`

```mdx
<Grid>
  <Card eyebrow="Optional" title="Name the thing" accent="info|good|bad|warn|alert">
    One short paragraph or a 2–4 item list. Prose, not pseudo-code.
  </Card>
  <Card title="Parallel item" accent="info">
    Same length and shape as its sibling.
  </Card>
</Grid>
```

Reach for it when you have 2–4 genuinely parallel concepts the reader benefits from seeing side by side. Common shapes:
- Two failure modes the post will address.
- Three layers of a discipline (what the user sees, what the engine does, what gets written down).
- Four roles or hats with distinct mandates.

Cards inside a Grid should be roughly the same length. A Grid with one paragraph in the left card and a five-item list in the right card reads as broken.

### `KeyPoints`

```mdx
<KeyPoints title="OPTIONAL EYEBROW">
1. **The claim.** One sentence elaborating it.
2. **The next claim.** Same shape.
3. **The third.** Three to seven items is the sweet spot.
</KeyPoints>
```

Reach for it when you have a sequence the reader needs to remember:
- The N load-bearing claims of a methodology.
- A diagnostic checklist.
- The phases of a process, in order.

The bold-then-elaborate shape is the convention; the bold is the takeaway, the rest is the support. Use ordered (`1. 2. 3.`) when order matters; otherwise bullet-friendly prose still works inside.

### `Compare` + `Side`

```mdx
<Compare verdict="match|diverge|gap|win" title="What's being compared">
  <Side label="Their thing">
    One short paragraph from their perspective.
  </Side>
  <Side label="Our thing">
    One short paragraph from ours.
  </Side>
</Compare>
```

Reach for it when contrasting two approaches to the same problem. The verdict pill carries a lot of the meaning — `match` for convergent answers, `diverge` for genuine differences in bet, `gap` for places one approach falls short, `win` for things only one approach addresses. A `win` block can have one `Side` without a label.

Three or more Sides per Compare is allowed but rare; usually one or two is the right call.

In a comparison post, expect 5–15 Compare blocks broken up by section headers — that's the entire structure. In an essay-style post, one or two Compare blocks within an otherwise prose-heavy piece is plenty.

### `TickSequence` + `TickCard`

```mdx
<TickSequence>
  <TickCard label="Tick 1" title="What happens">
    Plain prose describing the action.
  </TickCard>
  <TickCard label="Tick 2" title="Next">
    What the agent or engine does next.
  </TickCard>
</TickSequence>
```

Reach for it when stepping the reader through a multi-step interaction — typically how the engine and the agent take turns over time. Three to six ticks is the sweet spot. More than six and the reader loses the thread; collapse to KeyPoints or prose.

### `Mermaid` and `ExpandableDiagram`

Use sparingly. A Mermaid diagram is right when the relationships ARE the point and prose can't carry them — e.g., a state machine with branches, a workflow with merge points, a dependency graph. If you can write the same information as a 3-item KeyPoints list, do that instead; a Mermaid diagram costs reader attention.

`ExpandableDiagram` is for diagrams that need full-screen room — collapse them by default so they don't dominate the page when the reader doesn't need the detail.

### `Pill`

```mdx
A typical run goes: <Pill>elaborate</Pill> → <Pill>execute</Pill> → <Pill>review</Pill>.
```

Inline tag, monospace, neutral background. Reach for it when naming a small set of things the reader should think of as labels rather than as code. Don't use it as a substitute for backticked identifiers in body prose — that just trades one tic for another.

## Patterns that work

These shapes consistently land:

1. **Hook → first Callout (`tone="warn"`) grounding the failure mode → prose section → first Compare/Card/KeyPoints landmark → prose → closing visual or callback to the opening scene.**
2. **A comparison post is mostly Compare blocks, broken into sections by `## Where we landed in the same place` / `## Where we go different directions` / `## What we have that they don't address`.**
3. **An essay-style post uses one or two visual landmarks, picked for maximum punch — usually a `Callout` for the thesis and a `Grid` of `Card`s for parallel observations.**

## Patterns that don't

These reliably misfire:

1. **Stacking three Compare blocks back-to-back without prose** — reads as a table the reader has to parse all at once.
2. **Opening with a component** — robs the post of its hook. Readers need prose to commit.
3. **Putting the thesis inside a Callout in paragraph 1** — same problem; the post has to earn the framing before the framing means anything.
4. **Using a Callout for every aside** — Callouts become noise when there are five of them.
5. **`KeyPoints` with two items** — looks like an incomplete list. Use prose with two items; reserve KeyPoints for 3–7.
6. **`Grid` with three cards** — sm:grid-cols-2 layout leaves the third card alone on its own row. Use 2 or 4, not 3.
7. **Self-audit appendices, "what the humanize pass changed" notes, "deliberate kept choices" lists** — these are internal artifacts. NEVER ship them in the published post.

## What to remove from existing posts

When refactoring an existing post for visual flair:

- Cut any "Self-audit" / "Humanize pass" / "Deliberate kept choices" appendix sections — those are reports to me, not blog content.
- Cut any "Implementation:" tail sentences that name files or functions — the linked PR or commit is the verification surface.
- Convert any 4+ item bulleted list that's parallel into either a `KeyPoints` (numbered claims) or a `Grid` of `Card`s (concept comparisons).
- Convert any section that's all `<h3>` subheaders with one paragraph each into a `Grid` of `Card`s — same content, scannable shape.
- A long prose paragraph that lists 3+ examples in the same sentence shape is begging for a `KeyPoints` or `Grid`.

## What to keep as prose

Some content stays prose, always:

- The hook (first 2 paragraphs).
- The reframe or thesis statement — the sentence the reader is supposed to take away. Coined names earn their place mid-paragraph, not in a Callout.
- Connective tissue between sections — the "so what" sentence that bridges one section to the next.
- The closer — a callback to the opening scene, a question, or a direct challenge. Visual components close the door on reader thought; prose keeps it open.

## Scope

Applies only to `website/content/blog/**`. This rule runs alongside `blog-humanize.md`, `content-voice.md`, and `blog-general-audience.md`: write the prose, apply voice + general-audience cuts, add visual landmarks, run the humanize self-audit, ship.
