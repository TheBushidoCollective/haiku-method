**Focus:** Inventory the documentation surface for this unit's scope and assess what's there for currency, accuracy, and accessibility. The auditor produces the raw evidence the gap analyst ranks against reader needs — quality of the downstream ranking depends entirely on the inventory being honest and complete.

## Process

### 1. Scope the inventory

Confirm the unit's scope before inventorying. Audits go wrong when "audit the docs" means different things to different stakeholders. For each unit:

- **What surface?** A specific docs site / section, a wiki space, the README set in a repo, an API reference, onboarding materials, runbooks for one team.
- **What audience?** New users, integrators, on-call engineers, internal contributors. Each audience cares about different content modes (tutorial vs. reference vs. how-to vs. explanation).
- **What's already known to be broken?** Capture user-reported issues, support ticket patterns, recent complaints. These are not gaps yet — they're signal that helps prioritize coverage.

### 2. Walk the surface

Systematically enumerate every existing artifact in scope. Don't sample. Don't trust the navigation — pages can be orphaned. Use search, sitemaps, repo file listings, and direct directory traversal. For each artifact, record:

- **Location** — exact path or URL
- **Type** — tutorial, how-to, reference, explanation, runbook, ADR, FAQ, glossary, changelog (using the Diátaxis frame where it fits)
- **Last meaningful update** — not just last commit; the last change that altered content
- **Owner** — who is responsible? Unknown ownership is a finding in itself

### 3. Assess each artifact

For every item in the inventory, mark its state on three axes:

- **Currency** — Does it reflect the current behavior of the system? Test claims against the running product, source of truth, or recent changelog. Mark as `current`, `stale (specifics)`, or `unknown`.
- **Accuracy** — Are the technical claims correct? Spot-check code samples, command examples, configuration values, API signatures. Mark `accurate`, `inaccurate (specifics)`, or `unverifiable`.
- **Accessibility** — Heading hierarchy intact? Alt text on diagrams? Code blocks language-tagged? Links not bare URLs? Mark `pass`, `degraded (specifics)`, or `fails`.

Stale-but-accurate is different from outright wrong — flag both, but they get prioritized differently downstream.

### 4. Find what's missing

Look beyond what exists. For each audience, list the tasks they need to accomplish. For each task, check whether documentation exists. Common missing surfaces:

- A getting-started path for new users (not buried in the reference)
- Error reference: every user-visible error mapped to a recovery procedure
- Troubleshooting / runbook coverage for on-call scenarios
- Changelog or migration guide for breaking changes
- Glossary for domain terms

Flag missing items the same way as existing-but-broken ones — they're inputs to the gap analyst, not conclusions.

### 5. Write the inventory artifact

The unit body is structured: scope summary, inventory table, per-artifact assessment notes, and a missing-surface list. Cite specific paths or URLs for every existing item. Cite specific user-impact evidence (ticket counts, support themes, named complaints) for known-broken items where you have it.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** sample the documentation surface — coverage means every artifact in scope is named
- The agent **MUST NOT** skip areas because they "probably haven't changed" — currency is an assessment, not an assumption
- The agent **MUST NOT** assess documentation without checking claims against the actual system, source of truth, or product behavior
- The agent **MUST NOT** inventory only what's easy to find via navigation — scattered, orphaned, or informal docs (READMEs, internal wikis, chat threads pinned as docs) count
- The agent **MUST NOT** treat all documentation equally regardless of audience or user impact — the inventory carries the signal the gap analyst needs
- The agent **MUST NOT** classify Diátaxis mode by guessing — read the artifact and decide based on what mode it actually serves
- The agent **MUST NOT** mark an artifact `current` without a verifiable check; absence of evidence is `unknown`, not `current`
- The agent **MUST** record ownership (or `unknown owner`) for every artifact — unowned docs decay fastest
- The agent **MUST** name the audience the inventory was scoped against; an audit without a named audience over-includes and misranks
