---
interpretation: lens
---
**Mandate:** The agent **MUST** be the user's eyes for the design stage — render every design artifact the designer produced (mockups, wireframes, component specs, layout sheets) through a real browser and judge them the way a user would experience the shipped UI: by looking at the screen. Static review of the design files cannot catch the gap between "the spec says 16px gutter" and "the rendered mockup has 8px gutter because the token was misnamed." This lens opens the artifacts in a browser, screenshots them, and asserts the visual quality bar the design stage is supposed to enforce. The screenshots ARE the record of what the user would see.

## Check

Open a view session via `haiku_view({ stage: "design" })` and use the bundled `playwright` MCP to navigate to each design artifact. Call `browser_take_screenshot` for every artifact you assert on. **Save each screenshot** to disk under `.haiku/intents/<intent>/stages/design/proof/<artifact-slug>-<viewport-or-state>.png` using the `Write` tool (PNG is the format `playwright` produces; keep it). The `proof/` directory becomes the durable record a human verifier can scroll later. Attach the same screenshots to every finding — a visual finding without a screenshot is unactionable.

Also verify per-unit claims: read every design unit body (`stages/design/units/<unit>.md`) — every wireframe the unit references, every component-state the unit promised, every layout the unit said it would deliver. Each is part of the contract for THIS stage even when it doesn't appear in a downstream `.feature` file. A unit that claims to ship the "empty state" but whose artifact only renders the populated state is a finding.

The agent **MUST** verify each of the following against the rendered output:

- **Spacing and alignment.** Margins, padding, gutters, and gaps match the values declared in `DESIGN-TOKENS.md` / `DESIGN-SYSTEM-ANCHOR.md`. Components that touch (no breathing room) when the spec says they shouldn't, components that drift out of their column grid, baseline mismatches between adjacent text blocks — all findings. Measure visually from the screenshot; do not trust the file claims alone.
- **Font sizes and hierarchy.** Every text element renders at one of the declared type-scale steps (no off-scale values), and the hierarchy in the rendered artifact matches what the brief called for — H1 visibly larger than H2, body text legible at intended viewport, captions distinct from body. A heading that visually disappears into the body text is a hierarchy failure even if the file uses the "correct" token.
- **Color usage.** Colors used in the rendered artifact match `DESIGN-TOKENS.md` exactly — no off-palette hexes, no near-misses where a token exists but a sibling was used. Background/foreground pairs hit the contrast threshold the brief declared (typically WCAG AA: 4.5:1 for body text, 3:1 for large text and UI components).
- **Accessibility — contrast.** Every text+background pair in the rendered artifact meets the contrast threshold the brief declared (WCAG AA minimum unless the brief says otherwise). Use `browser_evaluate` to extract computed text/background colors when ambiguous, then assert the ratio. Low-contrast placeholder text, disabled-state text that fails AA, hover-state-only color cues without a non-color signal — all findings.
- **Accessibility — semantics in the rendered HTML output.** When the design artifact is HTML (a rendered mockup, a Storybook entry, a coded prototype), assert: every interactive element has an accessible name (label, aria-label, or visible text), heading order is sequential without skips, form inputs are associated with labels, focusable order matches visual order, focus indicators are visible at the brief's required threshold.
- **Touch / click target sizes.** Interactive targets in the rendered artifact meet the minimum size the brief declared (typically ≥ 44×44 px on touch, ≥ 24×24 px on mouse). A button that visually appears tappable but fails the target-size threshold is a finding even when the design file lists the token.
- **Responsive behavior at declared breakpoints.** Resize the browser to each breakpoint the brief named (typically mobile / tablet / desktop) via `browser_resize` and screenshot at each one. Layout breaks, overflowing text, components that collide or stack incorrectly, hidden-when-it-shouldn't-be content — all findings.
- **State coverage.** For every component the brief lists multiple states for (hover, focus, active, disabled, error, loading, empty), the rendered artifact actually shows that state when you trigger it (or the artifact is a sheet that shows all states side by side). A state listed in the brief but absent from the rendered mockup is a finding.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- Mockup that visually looks right at thumbnail size but has 8px / 12px / 14px values where the design system declares 8 / 16 / 24 — token misuse hidden by visual approximation
- Heading that uses the right token (`text-2xl`) but renders identically to body because the body token also got bumped to `text-2xl` somewhere else — hierarchy collapsed
- Color combination that's on-palette per the token table but fails contrast — designer used a valid token, just the wrong one for that surface
- Interactive elements rendered at a visual size that meets the spec but the actual hit target (after CSS box model + transforms) is smaller — a touch target that fails 44×44 at the DOM level even though it looks bigger
- Layout that works at desktop but stacks wrong on tablet because the breakpoint rule was named correctly in the spec but never tested in a real viewport
- Focus indicator that exists in code but is invisible against the background it appears over — passes a code review, fails a screenshot
- A hover state declared in the brief but never wired in the mockup — the artifact only shows the resting state
- Empty / loading / error states described in the brief but the rendered artifact only shows the happy path
