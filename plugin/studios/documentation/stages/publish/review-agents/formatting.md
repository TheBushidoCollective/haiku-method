---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the published documentation renders correctly on the target platform and is navigable by the named audience.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every link resolves** — Internal links, anchors, cross-references, external links, and image references all resolve. No 404s, no redirect loops, no broken anchors. Link rot at publish time becomes reader friction immediately.
- **Images and diagrams render at appropriate sizes** — Images aren't cut off, distorted, or oversized for the layout. Alt text is present and meaningful — not just `image` or the filename.
- **Code blocks render with correct syntax highlighting** — Language tags match the renderer's expected vocabulary; tagged blocks highlight; untagged blocks are intentional (not accidents).
- **Table of contents and navigation reflect the actual content** — The auto-generated TOC matches the heading hierarchy; the platform's navigation surfaces the document at the expected location.
- **Heading hierarchy is clean** — Levels don't skip (`##` to `####`); the renderer's TOC reads coherently; screen-reader navigation works.
- **Metadata is complete** — Title, description, last-updated, owner, and audience tags are populated and match the target platform's schema.
- **Accessibility holds in the rendered view** — Alt text present, color contrast adequate, no reliance on color alone for meaning, headings semantic.
- **Platform-specific conventions honored** — Callout shortcodes, banner patterns, and house numbering match the project overlay (if one exists) or the platform's defaults.
- **No placeholder content** — `TODO`, `<your X here>`, `[insert example]`, untouched scaffolds, or other placeholders don't ship.

## Common failure modes to look for

- A link that resolved when written but broke when the target document was renamed or moved
- An image referenced by an absolute path that works locally but breaks in the rendered output
- A code block with no language tag, displayed as plain text in the rendered output
- A document missing from the navigation because the front matter didn't declare the right category
- A heading hierarchy with skipped levels that breaks the auto-generated TOC and screen-reader navigation
- An image with alt text `image` or `screenshot` rather than a description of what's shown
- A page that renders cleanly on desktop but breaks on narrow viewports (table overflow, untruncated code, broken layout)
- A `last-updated` timestamp that was never set, so the platform shows the document as ancient
- Color used as the sole signal (red error text, green success text) with no accessible alternative
