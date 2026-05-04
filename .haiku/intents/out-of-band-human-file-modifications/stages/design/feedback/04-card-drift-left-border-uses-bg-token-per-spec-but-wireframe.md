---
title: >-
  Card drift left-border uses -bg token per spec but wireframe silently
  overrides to -fg
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T20:25:05Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-04:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:25:05Z'
resolution: null
replies: []
---

## Finding

`SPA-UI-SPECS.md §2.2` names the card left-border accent tokens as the `-bg` variants:

> `--color-drift-detected-bg` | Card left-border accent when drift is detected

The replacement-affordance wireframe (`wireframes/replacement-affordance.html`) initially sets the border to `-bg` (lines 139–149) but immediately overrides every class with the `-fg` variant in lines 152–155:

```css
/* line 139 */
.artifact-card--drift-detected { border-left: 4px solid var(--color-drift-detected-bg); }
/* line 152 — overrides the above for all cards */
.artifact-card--drift-detected { border-left-color: var(--color-drift-detected-fg); }
```

The comment on line 140 reads "Note: border-left accent uses -bg token per spec (SPA-UI-SPECS.md §2.2)" but the rule at line 152 contradicts that comment and contradicts the spec by swapping in `-fg`.

## Spirit of the check

Token discipline requires that every semantic color reference maps to the correct named token consistently. A spec that says `-bg` and a wireframe that uses `-fg` for the same property will cause inconsistent implementations at development time. The developer will follow the wireframe (the most concrete artifact) and produce a visually different border than what the spec contracts.

## Affected file

`stages/design/artifacts/wireframes/replacement-affordance.html` lines 139–155

## Correct behavior

Either the spec is wrong (the `-fg` token is the intended border color — which is visually sensible since `-bg` is nearly white) and `SPA-UI-SPECS.md §2.2` needs to be updated to name `-fg` as the border token; or the wireframe override is wrong and lines 152–155 must be removed so the border renders with the `-bg` token as documented. The spec owns the contract. Whichever token is chosen, the wireframe and the spec table must agree.
