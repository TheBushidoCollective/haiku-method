---
provider_kind: spec
category: source
always_on: false
splices_into:
  - elaborate
description: Spec source provider — read external PRDs, RFCs, design docs and align H·AI·K·U intent + units to them.
---

# Spec Provider — Behavior Contract

A spec provider is configured (Confluence, Notion, Google Docs, …) when `providers.spec.*` is set in `.haiku/settings.yml`. This is a **source** provider — read-only by default. H·AI·K·U intent and units align to what the spec says; you don't push back to the spec automatically.

## What you, the agent, must do

### At intent setup
- If the user names an external spec document (PRD, RFC, design doc), pull its content using the available MCP tool and distill it into the intent's Context section. Record the source URL/ID as `external_refs.spec_*` on `intent.md`.
- If no MCP tool is available, prompt the user to paste the relevant content into intent.md manually.

### At elaborate (per stage)
- Re-fetch the referenced spec documents and check they haven't materially changed since the last tick. If they have, surface the diff to the user before proceeding to decompose.
- Pull any newly-linked specs (the user may have added refs during the conversation).
- Distill the spec's requirements / constraints / decisions into the stage's elaboration record. Don't copy verbatim — translate.

### At decompose (per unit)
- Every unit cites the spec section it implements (`inputs:` should include the spec path or external ref).
- Translate spec acceptance criteria into unit `quality_gates:` with executable commands. Spec prose like "the form should validate email" becomes `quality_gates: [{ name: email-validation, command: "..." }]`.

## When to push back

Push back to the spec only when the user explicitly asks ("update the PRD with the decisions we made"). Default behavior is read-only. If you do push, translate H·AI·K·U's representation into the provider's native format (don't push raw markdown frontmatter to Confluence).

## What NOT to do

- Don't fabricate spec references. If a unit conceptually maps to a spec section but you can't find it, mark the unit's `inputs:` empty and surface the gap.
- Don't write summary docs back to the provider without explicit user direction.
- Don't load the entire spec into context if a section is enough — distill.

## Translation map

| External concept | H·AI·K·U concept |
|---|---|
| PRD / Requirements doc | Intent context + criteria |
| Design doc / RFC | Stage `inputs:` reference + technical constraint |
| Acceptance criteria in spec | Unit `quality_gates:` + completion prose |
| Decision in meeting notes | Intent Context entry |
