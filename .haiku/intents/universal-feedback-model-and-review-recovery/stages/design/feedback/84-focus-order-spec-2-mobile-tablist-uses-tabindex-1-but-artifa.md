---
title: >-
  focus-order-spec §2 mobile tablist uses tabindex=-1 but artifact doesn't
  support Arrow-key nav
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T03:00:00Z'
iteration: 3
visit: 3
source_ref: null
closed_by: unit-24-live-region-wiring-and-tablist-roving-keyboard
---

`focus-order-spec.md §2` row 4 declares: *"Tab strip (4 buttons, horizontal scroll) — tabindex: 0 on active / -1 on others. Arrow keys within."* — i.e. the standard ARIA tablist roving-tabindex pattern.

**Issue:** `feedback-inline-mobile.html:68-71` implements the static markup (`tabindex="0"` on active, `tabindex="-1"` on inactive) but the artifact has no keyboard-event handler showing arrow-key navigation inside the tablist. On desktop (`feedback-inline-desktop.html:109-112`), same pattern — static tabindex values, no Arrow-key wiring.

**Why this is an a11y failure:**

1. WCAG 2.1.1 Keyboard: every tab must be reachable. With `tabindex="-1"` on inactive tabs AND no arrow-key handler, inactive tabs become **completely unreachable by keyboard** — the user must click them with a pointer. This defeats the purpose of the roving-tabindex pattern.

2. The focus-order-spec notes *"Inside a tablist, Arrow keys navigate between tabs"* but the actual implementation contract in the artifact does not emit the `onkeydown` handler that implements Arrow-Left / Arrow-Right tab cycling.

3. W3C ARIA APG Tabs pattern requires: Arrow Left/Right (or Up/Down for vertical) moves focus AND updates `aria-selected`; Home moves to first tab; End to last. None of these are wired in the mobile or desktop artifacts.

4. Because the artifact is the wireframe reference for dev, dev will inherit the broken pattern unless the contract is explicit.

**Fix:**

1. Add an explicit `<script>` block at the bottom of `feedback-inline-desktop.html` and `feedback-inline-mobile.html` implementing the standard tablist keyboard contract (or reference the `@reach/tabs` library / WAI-ARIA APG example). Minimum required events:
   - Arrow Right / Down → focus next tab, skip past disabled, wrap to first
   - Arrow Left / Up → focus previous, wrap to last
   - Home → focus first
   - End → focus last
   - Enter / Space on focused tab → activate (set `aria-selected="true"`, show matching `<tabpanel>`)

2. Update `focus-order-spec.md §10 "Test checklist"` to include:
   - [ ] Inside the tablist, pressing Arrow Right moves focus and updates `aria-selected`
   - [ ] Home/End keys land on first/last tab
   - [ ] Tab key leaves the tablist after the active tab (does NOT iterate through inactive tabs)

3. Add a spec-level note to the focus-order-spec.md that `tabindex="-1"` WITHOUT an arrow-key handler is a violation, not a safe default.
