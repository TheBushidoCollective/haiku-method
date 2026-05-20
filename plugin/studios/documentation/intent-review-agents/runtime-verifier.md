---
interpretation: lens
---
**Mandate:** The agent **MUST** be the reader's eyes at documentation intent close — render the entire published site (or the rendered final output for the project's chosen format) and verify the reader can actually navigate from entry point through the documented journey end to end. Per-page checks catch broken markdown; this lens catches the seams — broken cross-page navigation, search that doesn't find the new content, sitemap entries that were never added, the new section that's invisible because it's not linked from anywhere.

## Check

Prefer `haiku_view({ intent: "<this-intent>", mode: "boot" })` to boot the docs site and drive the published surface. If no boot target detected, that's typically a finding for a documentation intent — the site should be runnable by close. Use the bundled `haiku-playwright` MCP. Call `browser_take_screenshot` at every meaningful step. **Save each screenshot** to disk under `.haiku/intents/<intent>/proof/<page-or-flow>-<step>.png` using the `Write` tool.

The agent **MUST** verify each of the following:

- **The site builds and serves.** No build errors. The landing page renders. Search (when present) is indexed against the new content — a search for a heading the intent added MUST return that page.
- **Navigation reaches every new page.** The intent's new pages MUST be discoverable from the site's primary navigation — sidebar, top nav, or a section index. A page that publishes but isn't linked from anywhere is functionally invisible.
- **Cross-references between new and existing pages resolve.** Every link from a new page to an existing page lands on the existing page (not a 404 or a redirect to home). Every link from an existing page that was updated to reference new pages lands on the new pages.
- **Sitemap / robots / SEO surface includes the new pages.** When the project publishes a sitemap.xml, the new pages are listed. Title and description meta-tags render. Social-card images load.
- **The headline reader journey works end to end.** Pick the journey the intent set out to enable ("a new user can install and run their first request in under five minutes," "a developer can find the API reference for the new endpoint and copy a working example"). Walk it through Playwright start to finish. Screenshot every step. A journey that breaks anywhere — broken link, missing section, search miss, copyable example that doesn't work when pasted — is the headline finding.
- **Per-unit claims hold across every stage.** Walk every unit body across draft / outline / review / publish. Each unit's claimed deliverable MUST be visible in the published site, not just in the staged outputs at the time the unit closed.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- New documentation pages that publish but never get added to the sidebar — discoverable only by direct URL guess
- Search index that rebuilds on deploy but doesn't include the new pages because the search config has an explicit allow-list that wasn't updated
- A documented `Quickstart` that worked when each step was reviewed in isolation but breaks end-to-end because step 3's command depends on step 2's output and step 2's output changed
- Sitemap that lists 47 pages, page count after this intent should be 50, but it still says 47 because the build script hardcoded the count
- A linked example repo that the docs reference no longer exists — the docs publish clean, the user follows the link, hits a 404
