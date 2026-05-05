---
title: >-
  Sanitizer single-pass replace allows nested-tag reconstitution bypass (e.g.
  &lt;scr&lt;script&gt;ipt&gt;)
status: closed
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-03T11:05:51Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-32:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:51Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:14:35Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:16:39Z'
    result: closed
---
**Severity:** Medium (defence-in-depth)

**Summary:** `sanitizeFeedbackBody` runs each `String.prototype.replace` exactly once. The classic nested-tag bypass `<script src=x>` is reconstituted into `` after the inner `` is stripped — the regex doesn't re-scan the result. The sanitizer's stated purpose is "the on-disk artefact itself is safe" so a future renderer-bug cannot resurrect a payload — that promise is broken.

**Where:** `packages/haiku/src/http/feedback-sanitize.ts:69-101, 154-180`.

**Reproduction:**
```js
sanitizeFeedbackBody("<script src=x>")
// → ""   (event handler stripped, but  survives)
```

Trace: `stripBlockTag("script")` runs first; `blockRe` needs both open + close, so no match. Then the standalone-open regex matches the inner `` (positions 4–11) and removes it, leaving the original prefix `<scr` concatenated with the trailing `ipt src=x>` — which is exactly ``. `stripEventHandlers` then removes `onerror=alert(1)`. Result: `` is on disk. Same trick works for every `DANGEROUS_BLOCK_TAGS` entry: `<script>`, `<iframe>`, `<style>`, etc.

**Combined with the read-path stored-XSS finding:** A markdown-rendered feedback body that pass-throughs raw HTML (or the `serveFile` poisoning vector documented separately) will execute this `` payload.

**Spirit of mandate:** The mandate calls out XSS injection vectors. The sanitizer's docstring promises "purpose-built regex sanitizer is more robust than wiring in a dependency like sanitize-html (which itself has had bypasses)" — but the implementation falls to a bypass class that any production HTML sanitizer (DOMPurify, sanitize-html) handles via repeated-pass-until-stable. Saying "we don't need a real sanitizer" then implementing one that fails the canonical bypass is exactly the spirit-of-letter violation the LENS doctrine cares about.

**Other related preserved-by-design payloads (smaller risk, same lens):**
- `data:image/svg+xml;base64,...` is explicitly NOT on `DANGEROUS_URL_SCHEMES` (line 63: only `data:text/html`). SVG-as-image with embedded `` executes in `` and some `` renderings. The comment at line 49 "preserves data:image/* (base64 attachments)" makes this explicit, but it's an XSS sink waiting for a renderer change.
- The `DANGEROUS_URL_SCHEMES` regex doesn't match `data:application/javascript`, `data:text/javascript`, or `data:image/svg+xml;base64,...`.

**Suggested fix:**
- Re-run the sanitizer pipeline until the input is stable (fixed point), bounded by ~5 iterations to prevent pathological inputs. Production sanitizers do this.
- Or: parse via a real DOM sanitizer (e.g. `DOMPurify` server-side via `jsdom`, or `sanitize-html`) for the on-disk write. The "regex is faster + auditable" argument loses when the regex is wrong.
- Add `data:image/svg+xml` and `data:application/(java|ecma)script` to the dangerous-scheme regex.
