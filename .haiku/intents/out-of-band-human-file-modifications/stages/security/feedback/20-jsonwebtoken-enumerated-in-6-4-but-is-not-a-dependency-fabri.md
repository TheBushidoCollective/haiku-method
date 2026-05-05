---
title: >-
  jsonwebtoken enumerated in §6.4 but is not a dependency — fabricated threat
  surface
status: closed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:04:44Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-20:bolt-1'
bolt: 1
triaged_at: '2026-05-03T11:04:44Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T12:18:16Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-03T12:23:21Z'
    result: closed
---
## Finding

THREAT-MODEL.md §6.4 enumerates `jsonwebtoken` as a third-party dependency with full sub-rows (algorithm-confusion, key-confusion, recommendation). The artifact's intro to §6 explicitly frames it as the "Third-party dependency threat enumeration" section.

`jsonwebtoken` is NOT a dependency:
```
$ grep -n "jsonwebtoken" packages/haiku/package.json
(no output)
$ grep -rn "jsonwebtoken" packages/haiku/src/
(no output)
```

The artifact even acknowledges this in §6.4: "We do *not* use `jsonwebtoken` — we sign and verify in `tunnel.ts` using `crypto.createHmac` directly". So §6.4's claim is "this is a threat surface for a future refactor" — but that's not the section's stated purpose.

## Why this is a threat-coverage gap

The mandate requires "third-party dependencies are included in the threat surface" — meaning REAL dependencies, the actual present surface. Enumerating a fictional dependency-as-if-real:

1. **Misallocates reviewer attention.** A reviewer reading §6 to understand the actual present third-party surface gets four entries, three of which match the real footprint, one of which is forward-looking. The §6.4 reader must re-derive the "this is hypothetical" framing from the prose.
2. **Crowds out real dependencies.** The omitted `@sentry/node`, `marked`, `@fastify/cors`, `@fastify/rate-limit` (separate finding) all could have occupied the §6.4 slot.
3. **Pattern-matches the same anti-pattern that produced FB-11 and FB-12** (already-rejected "fabricates X" claims about the threat model). Filing `jsonwebtoken` under "real dependencies" is one fabrication step short of those — the prose acknowledges the truth, but the section structure does not.

Note this is similar in CLASS to FB-11 (drift-gate kill-switch env-var fabrication) and FB-12 (fastify connectionTimeout fabrication) but distinct in INSTANCE — those were retracted in the current artifact body. This one survives.

## Required fix

Pick one:

(a) **Move §6.4 out of §6.** Restructure so §6 contains only present dependencies. Move the `jsonwebtoken` future-refactor note to a new section "§6.5 Forward-looking dependency hygiene" or fold it into the recommendation under §6.0 ("if `jsonwebtoken` is added later, here's the verify-call audit checklist").

(b) **Delete §6.4.** The hand-rolled HMAC path is correctly characterized in §1.3 / §1.4 (EPHEMERAL_SECRET lifecycle and JWT claim semantics). The future-refactor note can live in a brief code-review checklist comment in `tunnel.ts` or in the `state_revisit` register.

Either way, replace the §6.4 slot with one of the actually-present dependencies the threat model is currently silent on (see related findings on `@sentry/node` and `marked`).

## Files

- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:434-453` (§6.4 — fabricated)
- `packages/haiku/package.json` (canonical dependency list)
- `packages/haiku/src/tunnel.ts` (the actual HMAC implementation correctly described)
