---
name: design-system-anchor
location: .haiku/intents/{intent-slug}/knowledge/DESIGN-SYSTEM-ANCHOR.md
scope: intent
format: text
required: true
purpose: Concrete design-system specs extracted from real source — button heights, radii, color tokens, spacing scale — cited to file:line.
---

# Design System Anchor

Concrete design-system specs extracted from the project's source code. Every value is cited to its source file and line number. Downstream hats (designer, design-reviewer) must use these values — not guesses.

## Content Guide

### 1. Atoms

For each reusable atomic component found in source (e.g. Button, Surface, Card, Input, Badge):

- **Component name** and its source file path
- **Dimensions** — height, min-height, min-width, padding (cited to file:line)
- **Border radius** (cited to file:line)
- **States** — list any conditional styles for the canonical 8-state set: `default, hover, focus, active, disabled, error, loading, empty` (cited to file:line). Match `DESIGN-BRIEF.md`'s state vocabulary so downstream consistency review can compare like-for-like.
- **Variants** — any size/color/shape variants the component declares (cited to file:line)

Example entry (substitute your project's actual paths):
```
### Button
Source: <atoms-dir>/Button.<ext>

- height: 44px             # Button.<ext>:23
- border-radius: 8px       # Button.<ext>:31
- padding-h: 16px          # Button.<ext>:28
- default: solid bg, brand-primary text  # Button.<ext>:18
- disabled-opacity: 0.4    # Button.<ext>:47
- empty: ghost variant w/ placeholder copy  # Button.<ext>:55
```

### 2. Tokens

Color, spacing, typography, and radius scales pulled from the project's tokens module (whichever path your design system uses — `theme/colors.*`, `tokens/spacing.*`, `style/typography.*`, or equivalent):

Every recorded color value MUST carry both its raw source value AND its named-token alias as defined in `knowledge/DESIGN-TOKENS.md`. The designer hat is forbidden from using raw hex; if a color exists in source but has no named alias yet, route the gap to `## Open Questions` rather than emitting a raw hex into the anchor — never let unaliased values flow into the design context.

- **Color tokens** — name (token alias), raw value, source citation (file:line)
- **Spacing scale** — each step's named alias and step value (cited to file:line)
- **Typography scale** — font family, sizes, weights, line heights (cited to file:line)
- **Radius scale** — each named radius alias and value (cited to file:line)
- **Shadow/elevation** — any named shadow tokens (cited to file:line)

Example entry (substitute your project's actual paths):
```
### Color Tokens
Source: <theme-dir>/colors.<ext> → mapped to knowledge/DESIGN-TOKENS.md

- color.brand.primary    = #1A73E8    # colors.<ext>:12 → DESIGN-TOKENS.md:8
- color.surface.bg       = #FFFFFF    # colors.<ext>:18 → DESIGN-TOKENS.md:14
- color.text.primary     = #212121    # colors.<ext>:24 → DESIGN-TOKENS.md:20
- (gap) #F5A623 used in Button.<ext>:62 has no named alias → see Open Questions
```

### 3. Active vs Dormant Patterns

Cross-reference era/status tags from the inception stage's `DISCOVERY.md` `## Existing Code Structure` section. For each prior-art file listed there:

- **Active** — pattern is used in the current codebase, values are current
- **Dormant** — era-tagged as legacy (e.g. predecessor-product-era, deprecated-vendor-era) — flag these explicitly so the designer avoids them

### 4. Open Questions

Anything ambiguous from source that requires designer judgment before proceeding:

- Token values that appear overridden in multiple places (list each location and value)
- Components with undocumented variants
- Source files listed in DISCOVERY.md that could not be located
- Any token that has no source citation (must not be used until resolved)

## Quality Signals

- Every atom spec entry cites source file and line number
- Every token entry cites source file and line number
- No invented or approximated values — open questions section covers gaps
- Active vs dormant flags are present for all prior-art files with era tags
- The designer hat can read this document and produce mockups without touching source files
