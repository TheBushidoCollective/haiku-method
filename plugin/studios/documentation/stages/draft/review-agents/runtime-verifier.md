---
interpretation: lens
---
**Mandate:** The agent **MUST** be the reader's eyes for documentation drafts — render every drafted page in a real browser (or the rendered preview surface the project uses) and verify the page reads, navigates, and references resolve the way the author intended. Static review of a markdown file cannot catch broken internal links, missing images, code blocks that fail to syntax-highlight, table-of-contents entries that point to non-existent anchors, or examples that won't copy-paste cleanly. The screenshots ARE the proof the page reads correctly.

## Check

Open a view session via `haiku_view({ stage: "draft" })`. When the project includes a docs site (Astro / Hugo / Docusaurus / Next.js etc.) with a `dev` script in package.json, `auto` mode boots it; navigate to each drafted page. Otherwise viewer mode renders each markdown file through the SPA's artifact browser. Call `browser_take_screenshot` for every page and assertion. **Save each screenshot** to disk under `.haiku/intents/<intent>/stages/draft/proof/<page-slug>-<viewport>.png` using the `Write` tool.

The agent **MUST** verify each of the following:

- **Every drafted page renders.** No broken markdown that produces a blank page or a syntax-error stack trace. Frontmatter parses cleanly. The page title appears in the rendered output.
- **Every internal link resolves.** Click each in-doc link (or sample a representative set when the page is link-dense). Links to non-existent pages, dead anchors, or pages that 404 after publish-time slug changes are findings.
- **Every image / asset loads.** Inline images in the rendered page resolve through the asset pipeline. A broken-image icon in the rendered output is a finding even when the markdown reference looks correct.
- **Code blocks syntax-highlight and copy cleanly.** For every code block in the page, confirm the syntax theme applied (the language label resolved). Try the page's "copy" button (when present) and verify what reaches the clipboard matches the rendered block — a copy button that strips indentation or adds prompt characters is a finding.
- **Headings render with the right hierarchy.** H1 visibly larger than H2, no skipped levels (`h2` → `h4` without an `h3`), table of contents (when present) matches the rendered heading sequence.
- **Examples actually work.** When the page shows a command, an API call, or a snippet of code, sample-verify against the actual behavior — does the documented command exist? Does the API call return the documented shape? Does the snippet compile? Docs that drift from the code they claim to describe is the highest-cost class of documentation bug.
- **Per-unit claims hold.** Read every draft unit body. Each unit's claimed deliverable — a particular section, a specific example, a named page — MUST be visible in the rendered draft. A unit that promised "added a Quickstart with five steps" but whose rendered output only has four is a finding.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- Markdown link to `[other-page](other-page.md)` that renders as plain text because the docs framework rewrote the URL convention to `/other-page` and the `.md` suffix was never updated
- Image referenced via relative path that worked locally but breaks under the publish-time URL rewrite
- Code block with no language tag — syntax-highlight fails, copy button (if any) misbehaves
- Table of contents that lists `## Quickstart` but the heading was renamed to `## Getting started` — TOC entry points at a dead anchor
- Documented command (`haiku_view`) that's spelled `haiku-view` in the prose — readers who copy-paste hit "command not found"
- Page that frontmatter-renders correctly but the body content was accidentally truncated by a Markdown linter that escaped a list marker — half the page silently disappears
