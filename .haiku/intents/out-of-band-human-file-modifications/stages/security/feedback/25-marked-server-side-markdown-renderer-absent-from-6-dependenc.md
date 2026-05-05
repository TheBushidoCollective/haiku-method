---
title: marked (server-side markdown renderer) absent from §6 dependency enumeration
status: closed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:05:06Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-25:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:06Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:13:51Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:14:53Z'
    result: closed
---
## Finding

`marked` is the server-side markdown renderer dependency:
- `packages/haiku/package.json:13`: `"marked": "^17.0.5"`
- `packages/haiku/src/markdown.ts:1`: `import { marked } from "marked"`

It does NOT appear in THREAT-MODEL.md §6 dependency enumeration. This matters because:

1. The V-10 fix (`packages/haiku/src/http/feedback-sanitize.ts`) is described as a server-side input-side sanitizer that "strips ``, ``, ... before disk write". The downstream consumer is `marked`-based rendering — sanitizer-vs-renderer alignment is the load-bearing assumption.
2. `marked` has a documented history of HTML-passthrough/raw-HTML-rendering surfaces (`marked.use({ renderer: { html(...) } })` and the `markedHtml` option). A future code change that enables raw HTML rendering, or that uses `marked.parseInline`, opens the V-10 sanitizer envelope directly.
3. `marked` major-version bumps have shipped sanitizer-relevant breaking changes (the deprecated `sanitize` option, the `breaks`/`gfm` defaults, the renderer override surface).

## Why this is a threat-coverage gap

The mandate requires "third-party dependencies are included in the threat surface". `marked` IS a third-party dependency that:
- Is actively used (`packages/haiku/src/markdown.ts:1`)
- Sits at the rendering chokepoint that the V-10 sanitizer's correctness depends on
- Has its own release-channel + GHSA history that bears on the V-10 mitigation's durability

Compare to §6.2 `gray-matter` which gets full sub-row treatment: YAML deserialization, prototype pollution, resource exhaustion, recommendation. `marked` deserves the same depth.

## Required fix

Add §6.5 (or appropriate slot) `marked`:
- **Raw-HTML passthrough**: future code that calls `marked.use({ renderer: { html(text) { return text } } })` or that passes raw HTML through any custom renderer breaks the V-10 sanitizer's contract. Recommend a code-review checklist item: "any renderer override on `marked` requires re-running the V-10 XSS test fixture".
- **`markedHtml` / `silent` mode**: enumerate which `marked` options are safe vs unsafe relative to the sanitizer's coverage.
- **URL-scheme in autolinks**: `marked` autolinks support `javascript:` URLs by default in some versions; confirm the V-10 sanitizer's URL-scheme allowlist runs BEFORE marked, not after (otherwise marked could re-introduce the scheme).
- **Major-version bump audit**: pin minor version, watch GHSA, re-audit V-10 test fixtures on every `marked` major bump.

The §6.5 entry should explicitly state which sanitizer-renderer alignment assumptions the V-10 mitigation depends on, so a reviewer can see whether a future `marked` change invalidates the closure.

## Files

- `packages/haiku/package.json:13` (the dependency)
- `packages/haiku/src/markdown.ts:1` (where it's used)
- `packages/haiku/src/http/feedback-sanitize.ts` (the sanitizer the renderer-pairing depends on)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:363-453` (§6 — the gap)
