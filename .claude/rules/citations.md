---
description: Citation rules for blog content that references external sources or repository artifacts
globs:
  - "website/content/blog/**/*.md"
  - "website/content/blog/**/*.mdx"
---

# Citation Requirements

## Rule

When a post references an external source (article, report, study, announcement, interview) or a specific repository artifact (commit, file, PR, issue, test), it MUST include a citation. External sources get hyperlinks; repository artifacts get exact paths or refs.

## What requires citation

- Named external surveys, reports, or studies — link to the source.
- Specific company announcements — link to the announcement.
- Articles being responded to or built on — link the original.
- Direct or indirect quotes from external sources — link the source.
- Specific statistics or data points from third parties — link the source.
- A specific PR, commit SHA, or GitHub issue we're discussing — link or name it.
- A specific file path mentioned by name — name it precisely (`packages/haiku/src/orchestrator/validators.ts`, not "the validator file").
- A specific test that proves a claim — name the test file and case (`packages/haiku/test/output-liveness.test.mjs > orphan output flagged`).

## How to cite

- External sources: inline markdown links — `[descriptive text](URL)`. The link text should be natural and descriptive. Never bare URLs or "click here".
- Repository artifacts: backticked paths, sometimes with line numbers — `packages/haiku/src/orchestrator/workflow/handlers/intent-completion.ts:84`. Sometimes a commit SHA — ``commit `effa7c783` ``. PR numbers as `#265`.

## Examples

Good:

```
The pre-tick drift gate fires from `runWorkflowTick` (`packages/haiku/src/orchestrator/workflow/run-tick.ts:29`).
```

```
A [recent Klarna analysis](https://example.com/klarna-ai-walkback) walked back the AI-headcount decision after the metrics didn't hold.
```

Bad:

```
According to a recent industry report, drift detection is critical.
```
(No link. No source. Empty.)

```
The drift gate fires somewhere in run-tick.
```
(No file, no line number. Vague.)

## Verification

Before publishing, grep for "according to", "research", "study", "analysis", "announced", "report" — verify each has a citation. Grep for vague file references like "the validator", "the handler" — replace with specific paths.

Internal cross-references between posts also get linked — if the new post references "The Continuity Contract", link to it: `[The Continuity Contract](/blog/the-continuity-contract)`.
