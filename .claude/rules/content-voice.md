---
description: Voice and style rules for blog posts in website/content/blog
globs:
  - "website/content/blog/**/*.md"
  - "website/content/blog/**/*.mdx"
---

# H·AI·K·U Blog Voice

## Tone

- Direct, confident, casual-leaning. Write like an engineer telling a peer what just happened, not like a marketer writing a launch post.
- Use contractions naturally ("don't", "isn't", "won't", "I've"). Never use formal phrasing like "do not" or "is not".
- No hedging language. Say what you mean. "This fails" not "this may sometimes lead to suboptimal outcomes."
- Authority comes from specificity, not from claims of authority. Show, don't claim.

## Voice

- First person plural ("we") for the project's perspective: "We promised continuity. We never enforced it. We do now." This is the team speaking about the project's choices and history.
- First person singular ("I") when narrating a specific lived moment that's clearly Jason's: "I ran the intent end-to-end on Tuesday."
- Third person about the project as a system when describing behavior: "H·AI·K·U used to assume the agent owned every file."
- Address the reader directly with "you" when putting them in the chair: "You drop fourteen PNGs into `stages/design/artifacts/`. The next tick…"
- Present tense for observations. Past tense for examples. Future tense sparingly.
- Pick one register per post and stay in it. Mixing "I" and "we" mid-paragraph reads as confused authorship. Mixing across sections is fine when the section is clearly a personal anecdote.

## Structure

- Hook in the first two sentences. The reader decides to stay or leave before the first subheading.
- Every section earns the next scroll. If a section doesn't create tension, deliver insight, or reward attention, cut it.
- Prefer flowing prose over bulleted lists. Lists are for scannable reference material, not for building arguments.
- Use bulleted lists only when presenting genuinely parallel items (e.g., a diagnostic checklist). Never as a crutch to avoid writing real paragraphs.
- No formulaic timelines ("Week 1-2: this happens, Week 3-4: that"). Use phase numbers, priority order, or dependency-based sequencing instead.
- End on a question, a forward-looking observation, a callback to the opening scene, or a direct challenge — not a one-line summary.

## Content Standards

- NO hypothetical testimonials or fabricated case studies. Describe patterns from real experience without inventing specific scenarios.
- NO made-up statistics. If citing a number, it must be real and verifiable (intent run dates, commit counts, test counts, real engineering decisions).
- NO emojis unless the user explicitly requests them.
- NO time estimates or temporal planning language ("Month 1-3"). Use phase numbers, priority order, or dependency-based sequencing instead.
- Real references are encouraged when factual: GigSmart (Jason's employer), specific commit SHAs, named PRs, named files, named functions, named tests.

## What Makes Content Engaging

- Lead with what the reader is experiencing or with the concrete failure mode, not with the thesis or the announcement.
- Use specific, vivid examples over abstract principles. "Three of the SPA components from the design stage shipped as `.tsx` files but no other file rendered them" beats "the engine had gaps in continuity enforcement."
- Give the reader a handle for the concept once you've earned it ("the continuity contract", "coverage by gate, not by promise"). Coin the name *after* the reader has felt the shape of the problem — see the "Don't Hand the Reader the Thesis" rule below.
- The best paragraphs create a small surprise: a reframe, a counterintuitive truth, or a familiar problem stated more precisely than the reader has seen before.

## Grounding: The No-Empty-Authority Rule

Every substantive claim must land on one of:

1. **The reader's position.** Put them in the chair. Use second person and specific numbers. Make them feel the tradeoff before you name it.
2. **A real, named thing.** A commit SHA, a file path with line number, a CI run, a specific test, a real PR, a documented incident. No fictional teams.
3. **A named, specific story from the project's actual history.** "I ran intent `out-of-band-human-file-modifications`. Six stages. Thirty-odd units. The PR opened, CI went green, the gates signed off. Three SPA components never rendered." Specifics first; pattern name later.

Banned unless the next sentence provides one of the three grounds above:

- "Teams often…" / "most engineers…" / "in my experience…" as paragraph openers without backing.
- Invented hypothetical numbers presented as fact-shaped ("A team estimates 1,000 hours…"). If hypothetical, frame it: "Picture a team estimating 1,000 hours…"
- "I've seen this pattern repeatedly" as load-bearing evidence with no concrete instance.

Anonymous pattern claims are the lowest form of evidence. They should be the minority of a post, not the majority.

## Paragraph Economy

If a paragraph of four sentences could be one sentence without losing meaning, it's padding. The test: delete every sentence except the most specific one. If the paragraph still carries its argument, the others were setup for an aphorism, not reasoning toward a conclusion.

At least half of body paragraphs end on an observation, a question, or forward motion — not on a mic-drop aphorism. Aphorisms close the door on reader thinking. Observations and questions invite it.

Cap the "X isn't Y. It's Z." construction at two uses per article. It's become a tic. Earn the conclusion with a paragraph of reasoning before deploying the shape.

## Don't Hand the Reader the Thesis

The post should build. The reader should arrive at the thesis, not be handed it.

- Open on a scene or a forced position, not the thesis itself. The first two paragraphs establish the phenomenon or put the reader in the chair.
- The pattern-name (the thing you coin — "the continuity contract", "the workshop has two editors") should not appear before the ~40% mark of the post. The title can name it; the body has to earn it.
- The reframe — the new way of seeing the problem — lands past the ~60% mark. Before that: tension, evidence, and the reader feeling the shape of the thing.
- Vary the closing move. A callback to the opening scene, a forward-looking observation, a question, or a direct challenge. Not every post ends with a one-line summary.

## Metaphors and Memorable Phrases

- Coin phrases people will repeat. The goal is to give readers language they'll use in their own meetings. Think: "9 women can't have a baby in a month", "a plan is meaningless but planning is indispensable."
- Analogies should be concrete, unexpected, and sticky. "The intent dir is a workshop, not a sandbox" > "we needed better collaboration support." "A seatbelt is friction" > "quality is important."
- Draw from physical-world analogies that make abstract software concepts visceral: workshops, factories, relay races, infrastructure, physics. The reader should see the image instantly.
- When you find a good metaphor, build on it. Let it carry the argument rather than dropping it after one sentence.
- The best blog posts give the reader a new way to *talk about* a problem they already have, not just a new way to think about it.

## Word Count

- Target 800-1200 words per post.
- Shorter is better if the argument is complete. Don't pad.

## Frontmatter

```yaml
---
title: "Compelling, specific. Avoid generic engineer-speak."
description: "150-160 characters, SEO-friendly. Use contractions here too."
date: 2026-MM-DD
---
```

Existing posts in `website/content/blog/` are the canonical reference for tone and structure. Read three or four before drafting a new post.
