**Focus:** Plan the publish step before any artifact moves. The publisher will execute mechanical adaptation against the docs platform; your job is to decide *what* gets adapted *how* — platform conventions to apply, anchor / sidebar strategy, asset destinations, link-resolution scope — so the publisher's run is unambiguous.

## Process

1. **Read the reviewed draft and the platform's conventions** — the assigned section from `draft/draft-documentation` and any project-overlay notes on the docs platform (Markdown dialect, code-fence syntax, embed shapes, sidebar structure).
2. **Name the conversions** — for this section, list which Markdown / format conversions the publisher will apply (e.g., "fence ```ts → ```typescript", "image alt-text → required", "anchor slug from heading text").
3. **Name the destination** — exact target path / URL on the platform, sidebar position, search-indexing flag.
4. **Identify link-resolution scope** — internal links (relative? absolute? anchor-prefixed?), external links (validated against what?), cross-document references (need anchor map updates?).
5. **Surface platform-specific risks** — what could the publisher run into that the draft doesn't show? Embed quotas, max-image-size, code-block size limits, broken cross-doc references after rename.
6. **Write the publish-plan** as the unit body, then call `haiku_unit_advance_hat`.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** execute the publish itself — that's the publisher hat's role.
- The agent **MUST NOT** invent platform conventions not stated in the project overlay or the platform's documented standards.
- The agent **MUST** name a concrete destination URL / path; placeholder destinations are how docs ship to the wrong place.
- The agent **MUST** flag unresolved cross-references rather than guessing the target anchor.
