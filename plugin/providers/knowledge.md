---
provider_kind: knowledge
category: source
always_on: false
splices_into:
  - elaborate
  - decompose
description: Knowledge source provider — organizational memory, patterns, decisions; pulled in to inform elaboration and decomposition.
---

# Knowledge Provider — Behavior Contract

A knowledge provider is configured (Confluence, Notion, internal wiki) when `providers.knowledge.*` is set in `.haiku/settings.yml`. Distinct from the spec provider: **spec** handles per-intent documents (PRDs, RFCs); **knowledge** handles cross-intent organizational memory (patterns, anti-patterns, decisions, prior art).

This is a **source** provider — read-only by default. Push back only on reflection (and only when explicitly enabled).

## What you, the agent, must do

### At session start
- Pull organizational patterns relevant to the current studio + stage.
- Load prior-art entries: has similar work been done before in this codebase or org?
- Load decision records that constrain the current work (architectural decisions, security policies, naming conventions).

### At elaborate
- Search the knowledge base for the intent's problem space. Surface what's already known so the conversation builds on prior context rather than rediscovering it.
- Cite knowledge entries you pulled as `external_refs.knowledge_*` on the relevant unit or in the intent's Context section.

### At decompose
- If a unit conceptually re-implements something already documented as a pattern, name the pattern and link to it from the unit body.
- If a unit conflicts with a documented anti-pattern, surface the conflict to the user before drafting — don't paper over it.

### At reflect (optional, opt-in)
- Distill intent learnings into knowledge entries when `providers.knowledge.config.push_learnings: true`.
- Format: pattern (what worked + when to apply), anti-pattern (what failed + context), decision (choice + rationale + consequences).

## What NOT to do

- Don't load the entire knowledge base into context — search/filter to what's relevant to the current stage.
- Don't push raw H·AI·K·U artifacts to the knowledge provider. Translate to the org's format (a `reflection.md` becomes a retrospective in the team's format).
- Don't write to the knowledge provider unless `push_learnings: true` is explicitly set.

## Translation map

| External concept | H·AI·K·U concept |
|---|---|
| Pattern library entry | Elaboration constraint |
| Anti-pattern entry | Decomposition red flag |
| Architectural decision record | Intent / unit constraint |
| Cross-intent reference | Stage `inputs:` |
