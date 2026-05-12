---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the design is internally consistent across screens in the intent AND aligns with the project's existing design system. Inconsistency in design becomes drift in implementation becomes confusion in product. File feedback for any failure.

## Check

The agent **MUST** verify each of the following:

- **Token discipline.** All spacing, typography, color, radius, and elevation values reference named tokens from the design-system anchor (`DESIGN-SYSTEM-ANCHOR.md`) or token document (`DESIGN-TOKENS.md`). Raw hex codes, magic pixel values, bare font-family names, and arbitrary px margins are all findings.
- **State coverage parity across screens.** Interactive elements that appear on multiple screens cover the same state set on each. A button with hover / focus / disabled on one screen and only hover on another is inconsistency, not by design.
- **Component naming and reuse.** Component names match the existing pattern language. A "Card" on one screen is the same component as a "Card" on another. Net-new components are flagged as such with rationale in the unit body; they don't appear silently.
- **Layout grid and breakpoint behavior.** The same grid, breakpoint set, and gutter values are used across all screens in the intent. A screen using a 12-col grid alongside a screen using an 8-col grid is a finding unless the unit body explains why.
- **Iconography and illustration style** — same icon family across the intent; same illustration style; no mid-design swap between styles.
- **Typography ramp** — every used type style traces to a step on the ramp. Inventing a one-off `21px/29px/600` is a finding.

## Common failure modes to look for

- One screen using a raw `#3B82F6` and another using token `primary.500` for what's clearly the same intent
- Two units' designs each inventing a slightly different "secondary button" — different padding, different radius
- A component reused on three screens with state coverage on one and not the others
- Mixed icon sets across the intent (Lucide on one screen, Heroicons on another)
- A breakpoint set declared in one unit's body that no other unit honors
- Net-new tokens added inline without documentation in `DESIGN-SYSTEM-ANCHOR.md`
- Inconsistent grid alignment across screens that visually belong together
