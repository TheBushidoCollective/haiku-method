---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the information architecture supports how readers actually look for information — by task and by audience, not by system structure.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Task orientation, not code structure** — Top-level grouping follows what readers are trying to do (onboarding, integrating, troubleshooting, looking up reference). Outlines organized by internal modules / packages / services typically fail every audience except the team that built them.
- **Heading hierarchy is logical and consistent** — Depth stays around three levels or less; nesting matches the conceptual model; sibling sections are at compatible levels of abstraction.
- **Section sizing balanced** — No section is too small to need its own heading and no section is too large to be navigated. Sections that exceed reasonable navigation depth should split into siblings.
- **Diátaxis mode integrity** — Every piece has a declared mode (tutorial / how-to / reference / explanation). No piece mixes modes inside one document.
- **Purpose statement per section** — Every section has its one-sentence statement of what the reader gets there. Sections without one signal undefined scope.
- **Navigation completeness** — Every page has at least one inbound path (it's reachable) and a deliberate outbound path or terminal status (it's not a dead end without intent).
- **Cross-references resolve within the outline** — No `See Section X` pointing at a section that isn't in the outline.
- **Entry point per audience** — Each named audience has an obvious starting page; outlines without entry points fail new users no matter how complete the rest is.
- **Audit coverage** — Every prioritized gap from the audit appears in the outline or is explicitly deferred with rationale.

## Common failure modes to look for

- Top-level grouping mirrors the code's module names ("Auth Service", "Billing Service") when readers are searching by task ("How do I sign up?", "How do I cancel my subscription?")
- A four- or five-level deep nesting where every leaf is one sentence — flatten or merge
- A "Getting Started" section that's actually a reference page in disguise (or vice versa)
- An outline that lists every page but never names how a reader arrives there
- Orphaned reference pages with no inbound paths from the tutorials or how-to clusters that should link to them
- Top-tier audit gaps silently dropped from the outline with no deferral rationale
- Sections labeled with internal jargon the named audience wouldn't recognize
