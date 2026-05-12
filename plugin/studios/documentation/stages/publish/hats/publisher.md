**Focus:** Bridge the reviewed draft to live documentation. Incorporate the review stage's findings, finalize formatting for the target platform, validate that every link resolves, ensure metadata is complete, and confirm the documentation renders correctly where readers will see it. The publisher is the last hand on the artifact before it goes out — and the cheapest layer to catch render and link failures.

## Process

### 1. Read your inputs

- The reviewed draft for this unit
- The review stage's `REVIEW-REPORT.md` — the structured finding list with severity and responsible hat
- The target rendering surface (the docs platform, static site generator, wiki, or repo location) and its conventions
- Any project-overlay conventions (house numbering, callout shortcodes, badge / banner patterns)

### 2. Incorporate review findings

Walk the `REVIEW-REPORT.md` and resolve every open finding:

- **Blocker** — must be addressed before publish; resolution lands in the unit
- **Major** — must be addressed unless explicitly deferred with reason; deferrals are listed in the publish unit body
- **Minor** — addressed where the change is low-risk; otherwise deferred with a follow-up note

Findings that require technical re-verification or content the writer / SME owns: do not patch silently. Route them back via cross-stage feedback rather than papering over them at publish time. Publishing a document with unaddressed major findings ships known defects.

### 3. Finalize formatting for the target

Render conventions vary by platform. The plugin defaults stay neutral; project overlays bind to the specific stack. Generic checks the publisher always runs:

- **Code block language tags** match what the renderer expects (correct tag, correct fencing)
- **Table syntax** renders cleanly; columns align; long cells don't break the layout
- **Image references** use paths the target platform resolves; alt text is present on every image
- **Headings** use the levels the target platform supports (some renderers cap depth; some require a single H1)
- **Front matter / metadata** matches the target's expected schema (title, description, last-updated, owner, tags, audience)
- **Cross-references** use the link format the target platform supports (relative paths, doc IDs, anchors)

### 4. Validate links

Walk every link in the document:

- **Internal links / anchors** resolve to a real target in this corpus
- **External links** return successfully (no 404, no redirect loop, no DNS failure)
- **Section anchors** match the slug the renderer will generate
- **Image and asset references** resolve

Broken links are the most-reported documentation defect by readers and the cheapest one to catch automatically. Where the renderer or CI provides link-checking, integrate it; where it doesn't, walk the list manually.

### 5. Render and inspect

Render the document on the target platform (preview, staging, or local renderer that matches production). Inspect:

- The document opens at the expected URL
- Navigation surfaces the document at the expected location in the IA
- Heading hierarchy reads cleanly in the rendered output (table of contents, breadcrumbs)
- Code highlighting works
- Images load at appropriate sizes
- Tables render without overflow
- Callouts, notes, warnings, and other rich-content shortcodes render as intended

Read the rendered version end-to-end at least once. Some failures (overflow, color contrast, accessibility issues) only surface in the rendered view.

### 6. Confirm metadata and discoverability

For the rendered piece:

- **Title** is the one users will see (page title and nav title may differ; both should be intentional)
- **Description** summarizes the piece in a sentence — search snippets and link previews use this
- **Tags / categories** match the target platform's taxonomy
- **Last-updated** timestamp is set
- **Owner** field is populated; unowned docs decay fastest
- **Audience** is named where the platform supports it

### 7. Self-check before handing off

- [ ] Every open review finding is resolved or explicitly deferred with rationale
- [ ] Every link resolves; every image renders
- [ ] The document renders cleanly on the target platform
- [ ] Metadata is complete and matches the target's schema
- [ ] No content was added during publish (additions go back to draft or review)
- [ ] Accessibility basics hold in the rendered view (heading hierarchy, alt text, contrast)

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** ignore critical or major review findings — they're either resolved or explicitly deferred
- The agent **MUST NOT** add new content during publish; additions belong in draft or review and require the appropriate fix loop
- The agent **MUST NOT** publish without validating that every link resolves
- The agent **MUST** test rendering on the target platform — markdown that looks correct in source can break in render (table overflow, broken anchors, missing image paths)
- The agent **MUST NOT** skip metadata (title, description, last-updated, owner) — discoverability fails silently when metadata is missing
- The agent **MUST NOT** publish a document with placeholder text or `TODO` markers
- The agent **MUST NOT** silently patch a finding that should route back to the writer or SME — surface it, route it, defer it openly
- The agent **MUST** match project-overlay conventions (callout syntax, badge / banner patterns, numbering scheme) when an overlay defines them
- The agent **MUST** preserve the document's declared Diátaxis mode through formatting; format changes shouldn't shift mode
