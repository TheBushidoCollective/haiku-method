---
title: Duplicate §6.5 numbering in THREAT-MODEL.md (sentry vs fastify/cors)
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T14:13:48Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-40:bolt-1'
bolt: 1
triaged_at: '2026-05-03T14:13:48Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T14:26:57Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T14:28:15Z'
    result: closed
---
## Finding

`THREAT-MODEL.md` §6 enumerates two distinct sections both labeled `### 6.5`:

- `THREAT-MODEL.md:521`: `### 6.5. \`@sentry/node\``
- `THREAT-MODEL.md:623`: `### 6.5. \`@fastify/cors\``

This was introduced by sequential fix loops (FB-18 added `@sentry/node` as 6.5; FB-29 added `@fastify/cors` and `@fastify/rate-limit` as 6.5/6.6 without re-numbering against the prior 6.5). The downstream `### 6.6. \`@fastify/rate-limit\`` (line 698) and the new `### 6.7. \`marked\`` (added in FB-25 fix) both anchor to the second 6.5, so cross-references to "§6.5" are now ambiguous.

## Why this matters

Cross-references in this artifact and in ASSESSMENTS.md to "§6.5" cannot disambiguate sentry vs cors. Future findings or audit checklists that anchor to "§6.5" will silently target the wrong dep. Markdown TOC generators that key on heading text-not-number will collide.

## Required fix

Renumber `@fastify/cors` to `### 6.6.`, `@fastify/rate-limit` to `### 6.7.`, and `marked` to `### 6.8.`. Update the §6.4 forward-looking parenthetical (currently references "§6.5 – §6.7") to "§6.5 – §6.8". Search the artifact for any `§6.5`/`§6.6`/`§6.7` cross-references and re-target.

## Files

- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:521,623,698,776` (the four affected section headers)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:518` (the §6.4 parenthetical)
