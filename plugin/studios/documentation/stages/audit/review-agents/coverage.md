---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the audit identified the full documentation surface in scope and that priorities reflect real reader impact, not internal preference.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Surface completeness** — Every user-facing surface in the unit's scope (public APIs, supported workflows, onboarding paths, on-call runbook areas) is named in the inventory, not just the artifacts that were easy to find. Orphaned pages, scattered READMEs, and informal docs (wikis, pinned chat threads) count as part of the surface.
- **Audience explicit** — Each unit names the audience(s) it inventoried against. An audit with no named audience over-includes and misranks; flag it as a coverage gap.
- **Currency assessments are backed** — Every item marked `current` or `stale` is backed by a verifiable check (a citation to source-of-truth, a tested example, a dated complaint). Items with no backing are marked `unverified` or the assessment is rejected.
- **Outdated and inaccurate docs flagged, not just missing** — Outdated and inaccurate content is often more harmful than absence. The audit must surface both.
- **Severity / frequency ratings cite evidence** — Every priority rating in the gap analysis cites the inventory row or user-impact signal that justifies it. Fabricated or unmotivated rankings get flagged.
- **Audience-driven prioritization** — Rankings reflect reader impact, not internal preference (what's easiest to fix, what the loudest stakeholder asked for).
- **Coupling identified** — Gaps that depend on each other (a glossary needed before several how-tos can land, a reference rebuild that blocks tutorials) are noted so downstream stages can sequence them together.

## Common failure modes to look for

- An inventory that lists only the official docs site, missing READMEs, wikis, and informal docs that real users rely on
- An audit scoped to "the docs" with no named audience, producing rankings that prioritize tidy-up over user-blocking gaps
- A priority list where every item is `blocker × frequent` because severity wasn't actually assessed
- A gap labeled "missing" that is actually outdated and live, which is the more dangerous case
- Recommended doc modes that don't fit the audience's task (a reference where a tutorial belongs)
- Items marked `current` based on the artifact's last commit date alone, with no behavioral check against the system
