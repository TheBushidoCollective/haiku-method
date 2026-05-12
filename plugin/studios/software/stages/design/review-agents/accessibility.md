---
applies_to:
  - "*.html"
  - "*.htm"
  - "*.tsx"
  - "*.jsx"
  - "*.vue"
  - "*.svelte"
interpretation: lens
---
<!--
  `applies_to:` gates this review agent by output kind. The web a11y checks
  below (contrast, touch targets, focus indicators, SR flow) presume DOM /
  HTML artifacts. On a stage whose artifacts are all backend specs, CLI
  docs, or non-UI markdown, this agent skips itself rather than raising
  not-applicable findings. Absence of `applies_to:` means "always runs"
  (backward-compatible default).
-->

**Mandate:** The agent **MUST** verify the design meets accessibility requirements and does not exclude users by ability, input modality, or assistive-tech reliance. File feedback for any failure. Accessibility findings are not optional polish — they ship as production defects when missed.

## Check

The agent **MUST** verify each of the following:

- **Color contrast** meets WCAG AA minimum — 4.5:1 for body text, 3:1 for large text and UI components / icons. Project overlays may require WCAG AAA — defer to overlay if present.
- **Touch targets** are at least 44px on the major axis on mobile breakpoints. Targets smaller than that are an accessibility regression for users with motor impairments.
- **Keyboard reachability** — every interactive element can be reached, focused, and activated via keyboard alone. Modals trap focus; dropdowns are operable; custom widgets implement the right ARIA pattern (combobox, listbox, dialog) instead of div-soup.
- **Focus indicators** are visible at every interactive element and meet the WCAG focus-appearance contrast minimum. No `outline: none` without a replacement.
- **Information not conveyed by color alone** — error states pair color with icon or text; chart series pair color with shape or label; status badges pair color with text.
- **Screen-reader flow** — heading order is logical (no skipped levels), images / icons have appropriate `alt` / `aria-label` / decorative markings, landmarks are used for major regions, dynamic content uses live regions where appropriate.
- **Reduced-motion** — animations that move > 5% of viewport respect `prefers-reduced-motion`.
- **Forms** — every input has a programmatic label, errors are linked to the input via `aria-describedby`, required fields are marked beyond color.

## Common failure modes to look for

- Brand-color text on its branded background failing 4.5:1 (corporate palettes routinely fail; the designer didn't measure)
- Custom dropdowns / toggles built from `<div>` + click handler with no keyboard / SR support
- `outline: none` applied globally and not replaced with a custom focus ring
- Error states shown via red border with no icon or text — invisible to users with red-green color blindness
- Icon-only buttons with no `aria-label`
- Modals that don't trap focus, or that return focus to `<body>` on close instead of the trigger
- Charts using color as the only series differentiator
- Heading order skipping levels (h1 → h3) to achieve a visual size
