---
title: >-
  keyboard-shortcut-map single-key "a"/"r" binding has no documented opt-out
  default for SR users
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:58:58Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`keyboard-shortcut-map.html §3b` documents that bare single-key shortcuts (`a`, `r`, `j`, `k`, `n`, `/`, `?`, `c`) collide with NVDA/JAWS browse-mode single-key navigation and VoiceOver QuickNav, and offers a user-toggleable "Require Alt for single-key shortcuts" setting (`review-ui.shortcutsRequireModifier` in localStorage, §3c).

**Problem:** the setting's default is "off" per the spec. That means the first screen-reader user who opens the review app loses `r` to "previous radio button", `a` to "previous annotation" (JAWS), etc. — they must know the setting exists, find it in the help overlay footer, and toggle it before they can even use the app effectively.

**Why this is an a11y failure, not a minor default:**

1. WCAG 2.1.1 Keyboard (Level A) requires all functionality be operable via keyboard. Technically met by the mouse / Tab fallback, but…
2. WCAG 2.1.4 Character Key Shortcuts (Level A, added in 2.1) requires: *"If a keyboard shortcut is implemented using only letter, punctuation, number, or symbol characters, then at least one of the following is true: Turn off · Remap · Active only on focus."* The app satisfies the Remap clause via the setting, but the setting is not surfaced until the user discovers `?` — which is itself a single-key shortcut that collides with SR browse-mode.

3. A screen-reader user opening the app **cannot reach the Alt-require toggle via keyboard shortcut** (`?` is blocked by their SR's virtual cursor). Their only path is the help overlay footer, which requires Tab navigation through the full page first. This is a discoverability dead-end.

**Fix options (pick one, document in the spec):**

- **Option A (recommended):** flip the default to "require Alt on" when the browser exposes `navigator.userAgent` indicating a screen reader OR when the user has not explicitly opted in via a first-visit nudge. Keep the setting user-overridable.
- **Option B:** make every single-key shortcut *also* focus-scoped (i.e. only fires when focus is inside the review-app root, not when focus is in body). This is the WCAG 2.1.4 "Active only on focus" escape hatch and removes the browse-mode conflict without user configuration.
- **Option C:** raise the first-visit modal to ask "Use keyboard shortcuts requiring Alt?" with Yes / No / Remind later. Screen-reader friendly because the modal is announced as a dialog and can be dismissed.

The spec §3b currently concedes the conflict and says "Documented in help overlay; also offered as a remappable shortcut via the modifier-key setting below." That is documentation, not remediation. WCAG 2.1.4 requires the remediation be wired in by default OR on detection, not gated behind discovery.

**Also:** the `?` help-overlay shortcut itself is announced as `aria-keyshortcuts="?"`. For SR users the `?` key is QuickNav "show help" in some configurations but is also intercepted by NVDA's help. Consider adding `Alt+?` as an alternate binding so the help overlay is reachable even when browse-mode is on.
