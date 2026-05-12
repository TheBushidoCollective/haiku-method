---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the documentation fully addresses the gaps identified in the audit, with no silent omissions and no placeholders.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every prioritized audit gap is addressed** — Every top-tier gap (blocker / major, frequent / occasional) from the audit stage has corresponding documentation in the draft. Deferred items are explicitly listed with rationale; silent deferral is a coverage failure.
- **No placeholder content** — No `TODO`, `<your X here>`, `[insert example]`, or other placeholder markers remain. Untouched scaffold sections count as placeholders.
- **All cross-references resolve** — Internal anchors, section references, and links to sibling documents resolve to real targets.
- **Self-contained for the named audience** — A reader from the named audience does not need tribal knowledge, internal channel access, or undocumented prerequisites to follow the documentation.
- **Every flow has happy + error + edge coverage** — Documented procedures cover the happy path, at least one error path the audience will plausibly hit, and at least one boundary condition.
- **Prerequisites are documented** — Procedures name what the reader must have or know before starting. Documents that depend on external setup (accounts, credentials, environments) call that out at the top.
- **Glossary / first-use definitions present** — Domain terms are defined the first time they appear, or linked to the glossary if one exists.
- **Version coverage** — Behavior that varies across supported versions is labeled with the version. Documents intended to be evergreen are marked as such.

## Common failure modes to look for

- A draft that addresses the easy gaps from the audit and silently drops the harder ones
- A `TODO: add error case` left in a section that ships otherwise polished
- Cross-references that worked when written but no longer match the outline's section structure
- A how-to that assumes the reader already has a credentialed environment, without saying so anywhere
- A reference that only documents the happy path, leaving every error response undocumented
- A tutorial that requires tribal knowledge ("ask in the team channel for the dev key") that the named audience can't acquire
- A glossary missing from a document that introduces five new domain terms
- A document silent about which versions it applies to, when behavior is known to vary
