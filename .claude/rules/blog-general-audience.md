# Blog: write for a general audience, even when the topic is technical

Posts under `website/content/blog/**/*.{md,mdx}` are read by people who are NOT in the codebase. They may be senior engineers from other stacks, technical product leads, founders evaluating a harness, or curious AI-adjacent readers. The post earns their attention by explaining **what** the thing does and **why it matters to them** — not by giving them a guided tour of the implementation.

This rule pairs with `.claude/rules/blog-humanize.md` and `.claude/rules/content-voice.md`. Where they conflict, voice wins; where they agree, this rule fills in the specific "don't tour the codebase" failure mode that humanize and voice don't explicitly cover.

## The bar

A post passes the bar when a reader who has never opened the repo can:

1. Tell you what the feature does in one sentence.
2. Tell you why it would change how they work.
3. Tell you what a reasonable next step would be (read the related post, try the install, look at the linked PR).

A post fails the bar when those three answers require the reader to recognize a function name, a file path, or an internal jargon term.

## Specific bans

These shapes show up over and over and should not pass review:

### "Implementation: `funcName` in `<path>:<line>`" tail sentences

The pattern: a paragraph makes its point in plain language, then closes with `Implementation: validateOutputLiveness in packages/haiku/src/orchestrator/validators.ts`. The tail adds zero value for the general reader. The PR link or commit SHA at the bottom of the post is the verification surface.

- **Wrong**: "The gate refuses to advance until every unit's outputs exist on disk. Implementation: `validateOutputLiveness` in `packages/haiku/src/orchestrator/validators.ts:284`."
- **Right**: "The gate refuses to advance until every unit's outputs exist on disk." (Link the PR or commit at the end of the post if the reader wants to verify.)

### MCP tool names dropped beyond first introduction

Naming the tool once at the moment of introduction is fine and often load-bearing (e.g., "the agent calls `haiku_run_next` to get its next instruction"). Sprinkling it through three more paragraphs reads as engineer-flavoring.

- **Wrong**: "The agent calls `haiku_run_next` to advance. Later, when feedback piles up, it calls `haiku_run_next` again, and `haiku_run_next` returns a `feedback_dispatch` action."
- **Right**: "The agent calls `haiku_run_next` to advance. Later, when feedback piles up, the next tick hands back a feedback dispatch."

### File-path inventories

A bullet list or comma-separated run of file paths reads as "here is the codebase tour I gave myself." The user value is what each file *does*, in one sentence.

- **Wrong**: "The design-stage runtime verifier at `plugin/studios/software/stages/design/review-agents/runtime-verifier.md`, the development-stage runtime verifier at `plugin/studios/software/stages/development/review-agents/runtime-verifier.md`, and the studio-level intent-completion runtime verifier at `plugin/studios/software/intent-review-agents/runtime-verifier.md` each…"
- **Right**: "Runtime verifiers fire at three points: when the design renders, when the build runs, and when the intent closes. Each one drives the page in a browser and judges what it saw."

### Frontmatter field-name lists in prose

Naming the field once when the post is specifically about that field is fine. Listing four or five field names in a sentence to flavor the prose is not.

- **Wrong**: "Every other inheritance-shaped decision lives in the unit's metadata — `model:`, `depends_on:`, `inputs:`, `outputs:`, `quality_gates:`."
- **Right**: "Every other inheritance-shaped decision lives in the unit's metadata. One more field belongs there."

### Internal jargon as if the reader already speaks it

Words like "the cursor," "the FSM," "the orchestrator," "the cascade," "FB-as-unit," "pre-tick," "wave-ready architect," "feedback-assessor hat" are precise inside the team and opaque outside. When you need to use them, define them at first mention with one short clause. If you don't need to use them to make the point, don't.

- **Wrong**: "The wave-ready architect fans out parallel hat invocations against pre-tick-classified feedback in the FB-as-unit fix loop."
- **Right**: "When feedback lands, the engine routes each finding to a specialist agent to fix it, then re-runs the same check that flagged it."

### Hook-name inventories

A reader skimming the page does not gain anything from learning that there are eight named hooks. They gain something from learning that "guardrails fire before the agent moves." Skip the inventory; keep the takeaway.

### `.haiku/intents/<slug>/...` path expansions on repeat

Expanding the path the first time the post discusses the artifact layout is fine. Expanding it three more times in the same post is noise. Refer to "the unit file," "the intent record," "the feedback file" after the first mention.

## What stays

The rule does not ban citation — it bans citation-as-flavoring. These citations earn their place every time and should NOT be cut:

- **A specific commit SHA, PR number, or test path** that the post uses as load-bearing evidence ("PR #265 broke when the design-stage components shipped but never rendered"). This is the No-Empty-Authority rule paying off.
- **A single named file or function** when the post is specifically about what that file or function enforces (and the post uses it once, not three times).
- **The pattern-name coined inside the post** ("the continuity contract", "the workshop has two editors", "the agent in the seat") — those are doing the work the rule is trying to protect.
- **Links to other blog posts** — internal cross-references stay linked.
- **MCP tool names** at the first moment they're introduced as the actor in the sentence.
- **Branch names, skill commands** (`/haiku:haiku-start`, `/haiku:haiku-pickup`) that the reader will type — these are user-surface, not implementation tour.

## The test

Before reporting a blog post done, read it through once with the question: "If I deleted every backticked identifier and every file path from this post, would the argument still land?" If yes, you've succeeded — the backticked identifiers were earning their place by adding precision to an argument that already worked. If no, the argument was leaning on the identifiers, and they were doing the load-bearing work the prose should have done.

A second test: would a senior engineer from a different stack — Python, Go, Rust — finish this post knowing what the feature does and why it matters? If they'd put it down halfway because the paragraph required familiarity with TypeScript file layouts they don't have, you've written for the team, not for the audience.

## Scope

This rule applies only to `website/content/blog/**`. UI copy, internal docs, paper revisions, READMEs, plugin descriptions, and code comments all have a different register and audience — the general-audience rule would fight them.

When writing or editing a blog post, this rule runs alongside `blog-humanize.md`: apply the voice-first pass, the AI-tell sweep, the general-audience cut, and the final self-audit before reporting done.
