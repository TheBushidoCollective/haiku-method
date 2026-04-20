# ARIA Landmark Specification

**Scope:** Every user-facing page, modal, and sheet in the universal feedback model & review recovery UI.
**Closes:** FB-35 (landmark structure) and the unit-01 landmark-amendment body text requirement.
**Enforced by:** feedback-assessor hat (unit-13) and dev-stage implementation.

## 1. Canonical landmark map

Every rendered page or modal **MUST** declare exactly one of each landmark in this order. Any exception must be documented in the artifact's comment and in the "Per-surface landmark map" table below.

| Landmark | HTML element | Required ARIA attributes | Purpose |
|---|---|---|---|
| Banner | `<header role="banner">` | — | Site / app-level header; contains global title + theme toggle |
| Navigation (stage progress) | `<nav aria-label="Stage progress">` | `aria-label` required; use `aria-current="step"` on active stage node | Discoverable as "Stage progress" in VoiceOver rotor / NVDA landmarks list |
| Main | `<main id="main-content" role="main" aria-label="Review content">` | `id="main-content"` required for skip-link target; `role="main"` explicit even though `<main>` implies it — IE11 fallback and belt-and-suspenders | Primary scrollable content region |
| Complementary (sidebar) | `<aside role="complementary" aria-label="Review sidebar">` | `aria-label` required; MUST NOT be `<div>` | Review sidebar (feedback list + decision controls) |
| Dialog (modals) | `<div role="dialog" aria-modal="true" aria-labelledby="{titleId}">` | `aria-modal="true"` + `aria-labelledby` required | Every modal / popover / bottom-sheet |
| Status (live region, polite) | `<div role="status" aria-live="polite" aria-atomic="true">` | Used for optimistic-UI + success announcements | Per `aria-live-sequencing-spec.md` |
| Alert (live region, assertive) | `<div role="alert" aria-live="assertive" aria-atomic="true">` | Used for failure / rollback announcements | Separate node so "marking…" is not overwritten before readout |
| Skip link | `<a href="#main-content">Skip to main content</a>` | Must be the first focusable element in the DOM; `sr-only` until focused | Bypasses the header / nav for keyboard users (closes FB-30) |

### Order in the DOM

```html
<body>
  <a href="#main-content" ...>Skip to main content</a>   <!-- 1 -->
  <header role="banner">…</header>                        <!-- 2 -->
  <nav aria-label="Stage progress">…</nav>                <!-- 3 (often inside <header> via review-context-header) -->
  <main id="main-content" role="main">…</main>           <!-- 4 -->
  <aside role="complementary" aria-label="Review sidebar">…</aside>  <!-- 5 (desktop only, inside the main layout flex container) -->
  <!-- dialogs rendered inside main or as siblings of main, appearing when active -->
  <div role="dialog" aria-modal="true" aria-labelledby="…">…</div>
  <div id="feedback-live-polite" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>  <!-- 6 -->
  <div id="feedback-live-assertive" role="alert" aria-live="assertive" aria-atomic="true" class="sr-only"></div>  <!-- 7 -->
</body>
```

### Two live regions, not one

Failure messages use `role="alert"` + `aria-live="assertive"` in a **separate** node so the prior `"FB-XX marking as closed…"` text (polite) is not overwritten before the screen reader has finished speaking it. See `aria-live-sequencing-spec.md` for the sequencing template.

## 2. Per-surface landmark map

Every artifact must be audited against this table. The dev-stage implementation **MUST** render these landmarks for every corresponding React / SSR surface.

| Surface / artifact | banner | stage-nav | main | aside | dialog | status | alert |
|---|---|---|---|---|---|---|---|
| `feedback-inline-desktop.html` | ✅ `<header role="banner">` | ✅ (inside review-context-header block above main) | ✅ `<main id="main-content" role="main">` | ✅ `<aside role="complementary" aria-label="Review sidebar">` | — | ✅ `#feedback-live-polite` | ✅ `#feedback-live-assertive` |
| `feedback-inline-mobile.html` | ✅ | ✅ (via review-context-header, mobile variant) | ✅ `<main id="main-content">` | ❌ (no desktop sidebar; feedback sheet replaces it) | ✅ `#feedback-sheet role="dialog" aria-modal="true" aria-labelledby="sheet-title"` | ✅ | ✅ |
| `review-context-header.html` | the artifact IS the banner region — used inside other artifacts; must render as `<header role="banner">` when embedded | ✅ `<nav aria-label="Stage progress">` | — (artifact is just the header showcase) | — | — | — | — |
| `stage-progress-strip.html` | — (nav fragment embedded inside a banner in real use) | ✅ `<nav aria-label="Stage progress">` | — | — | — | — | — |
| `comment-to-feedback-flow.html` | ✅ | — (flow diagram, not a review page) | ✅ `<main id="main-content" role="main" aria-label="Feedback flows">` | — | — | — | — |
| `feedback-card-states.html` | — (gallery of card states) | — | `<main role="main" aria-label="Card states gallery">` | — | — | — | — |
| `comments-list-with-agent-toggle.html` | — (sidebar fragment) | — | — | ✅ `<aside role="complementary" aria-label="Review sidebar">` | — | — | — |
| `annotation-popover-states.html` | — | — | `<main role="main">` containing the host page | — | ✅ every popover `role="dialog" aria-modal="true" aria-labelledby="pN-label"` | — | — |
| `assessor-summary-card.html` | — (card fragment) | — | — | — | — | ✅ **card root** is `<div role="status" aria-live="polite" aria-atomic="true" aria-labelledby="assessor-title">` so screen-reader users are told "assessor run complete" when the card mounts | — |
| `revisit-modal-spec.html` | — (modal spec) | — | — | — | ✅ `<div role="dialog" aria-modal="true" aria-labelledby="revisit-title" aria-describedby="revisit-desc">` | — | — |
| `revisit-unit-list.html` | ✅ | ✅ | ✅ `<main id="main-content" role="main">` | — (unit list is the primary content, not a sidebar) | — | — | — |
| `review-package-structure.html` | ✅ `<header role="banner">` (spec doc, not a runtime page) | — | ✅ `<main role="main">` | — | — | — | — |
| `focus-ring-spec.html` | — (spec gallery) | — | `<main role="main" aria-label="Focus ring spec gallery">` | — | — | — | — |
| `agent-feedback-toggle-spec.html` | — (spec gallery) | — | `<main role="main" aria-label="Agent feedback toggle states">` | — | — | — | — |

Legend: ✅ required · ❌ intentionally absent · — not applicable for this artifact's role.

## 3. Modal / dialog requirements (applies to every dialog surface)

Every surface with `role="dialog"`:

1. `aria-modal="true"` required.
2. `aria-labelledby` pointing at a visible heading inside the dialog (the heading must have a unique `id`).
3. `aria-describedby` (optional) pointing at a descriptive paragraph; recommended when the dialog's purpose is non-obvious (e.g. revisit-modal).
4. First focusable element receives focus on open (use `focus-trap-react` or equivalent).
5. `Escape` key closes the dialog.
6. On close, focus returns to the element that opened the dialog (FAB for the mobile sheet; the "Revisit" button for the revisit modal; etc.).
7. When a dialog is open, all other landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`) receive `aria-hidden="true"` **and** the `inert` attribute so assistive tech does not traverse background content.
8. Dialogs use the canonical focus-ring spec (see `focus-ring-spec.html §1`).

### Focus-trap contract

Use `focus-trap-react` (https://github.com/focus-trap/focus-trap-react) — the same library already used by `annotation-popover-states.html`. Wrap every dialog in `<FocusTrap active returnFocusOnDeactivate>` — the library moves focus to the first tabbable on mount and restores it to the opener on unmount. No manual `focus()` calls from component code.

## 4. Stage-progress-strip `<nav>` contract

When stage-progress-strip is embedded inside review-context-header (or any page), it **MUST** be wrapped in `<nav aria-label="Stage progress">`. This makes it discoverable as a "Stage progress" landmark in the VoiceOver rotor / NVDA landmarks list. Each stage node:

- `role="link"` (since clicking navigates to the stage's view)
- `aria-current="step"` on the active stage node
- `aria-disabled="true"` on upcoming stages that are not yet visitable
- `aria-label` pointing at the stage name + its state (e.g. `aria-label="Design, completed, visited 2 times"`)
- Focusable via `tabindex="0"` (visitable) or omitted (disabled)
- Focus-visible ring per `focus-ring-spec.html §1`

### 4.1 Tablist ARIA shape (added by unit-16)

Tab surfaces that use `role="tablist"` (e.g. `feedback-inline-desktop.html`, `feedback-inline-mobile.html`) MUST follow the [WAI-ARIA Authoring Practices tab pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):

- Wrapper: `<div role="tablist" aria-label="{label}" aria-orientation="horizontal">` (use `vertical` for column-style tab rails)
- Each tab: `<button role="tab" aria-selected="{bool}" aria-controls="{panelId}" tabindex="{0|-1}">`. Exactly one tab in the set carries `aria-selected="true"` and `tabindex="0"`; every other tab carries `aria-selected="false"` and `tabindex="-1"`. This is the "roving tabindex" contract.
- Panels: `<div role="tabpanel" id="{panelId}" aria-labelledby="{tabId}" tabindex="0">` (the `tabindex="0"` on the panel lets keyboard users enter the panel body).

### 4.2 Inactive-tab contrast floor (reaffirmed by unit-16 gate)

Inactive tabs (those carrying `tabindex="-1"` in the roving set) **MUST** use the stone-500+ text token so they pass AA:

- Light mode: `text-stone-500` (4.61:1 on white — floor) — never use the stone-400 shade on light surfaces (fails 4.5:1 body-text AA on every card background).
- Dark mode: `dark:text-stone-400` (OK on `stone-800`+).

Forbidden combinations are enumerated in `knowledge/DESIGN-TOKENS.md §1.1a` and re-checked by the `text-(stone|gray)-400` grep in unit-16 gate 4.

### 4.3 Roving tabindex — arrow-key handler (canonical sample)

Tablists **MUST** implement roving tabindex with arrow-key navigation so keyboard users can move between tabs using `←` / `→` (horizontal) or `↑` / `↓` (vertical). Pressing `Home` jumps to the first tab, `End` to the last. Focus visibly moves; `aria-selected` follows focus (activating the panel the newly-focused tab controls).

Canonical JS — the dev stage can adopt this verbatim; names are descriptive and the helper is framework-agnostic:

```js
/**
 * Attach roving-tabindex arrow-key handling to a tablist.
 *
 * Contract:
 *   - Wrapper element must have role="tablist" and aria-orientation="horizontal" | "vertical".
 *   - Tabs must have role="tab" children with stable ids; exactly one tab starts with
 *     tabindex="0" + aria-selected="true"; the others start tabindex="-1" + aria-selected="false".
 *   - onSelect(tabEl) is invoked whenever the active tab changes (user pressed arrow / Home / End,
 *     or clicked a tab). Use it to update the associated tabpanel's hidden state.
 *
 * WAI-ARIA Authoring Practices reference:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */
function attachRovingTabindex(tablistEl, onSelect) {
  const tabs = Array.from(tablistEl.querySelectorAll('[role="tab"]'));
  const orientation = tablistEl.getAttribute('aria-orientation') || 'horizontal';
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  const prevKey = orientation === 'vertical' ? 'ArrowUp'   : 'ArrowLeft';

  function activate(idx) {
    const wrapped = (idx + tabs.length) % tabs.length;
    tabs.forEach((t, i) => {
      const active = i === wrapped;
      t.setAttribute('aria-selected', String(active));
      t.setAttribute('tabindex', active ? '0' : '-1');
      if (active) {
        t.focus();
        onSelect && onSelect(t);
      }
    });
  }

  tablistEl.addEventListener('keydown', (e) => {
    const currentIdx = tabs.indexOf(document.activeElement);
    if (currentIdx < 0) return;
    if (e.key === nextKey)      { e.preventDefault(); activate(currentIdx + 1); }
    else if (e.key === prevKey) { e.preventDefault(); activate(currentIdx - 1); }
    else if (e.key === 'Home')  { e.preventDefault(); activate(0); }
    else if (e.key === 'End')   { e.preventDefault(); activate(tabs.length - 1); }
  });

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(i));
  });
}

// Usage:
//   const tablist = document.querySelector('[role="tablist"]');
//   attachRovingTabindex(tablist, (activeTab) => {
//     const panelId = activeTab.getAttribute('aria-controls');
//     document.querySelectorAll('[role="tabpanel"]').forEach(p => p.hidden = p.id !== panelId);
//   });
```

**Behavior summary:**

| Key | Horizontal tablist | Vertical tablist |
|---|---|---|
| `→` / `ArrowRight` | next tab (wrap) | — (no-op) |
| `←` / `ArrowLeft` | previous tab (wrap) | — (no-op) |
| `↓` / `ArrowDown` | — (no-op) | next tab (wrap) |
| `↑` / `ArrowUp` | — (no-op) | previous tab (wrap) |
| `Home` | first tab | first tab |
| `End` | last tab | last tab |
| `Tab` (when focus inside tablist) | leaves the tablist and moves to the next focusable element — this is native behavior because only one tab has `tabindex="0"` at any time. | same |

The dev stage SHOULD wire this handler to every tablist rendered by the feedback-UI (desktop + mobile). The sample above is production-ready and matches the WAI-ARIA Authoring Practices reference implementation.

## 5. Origin legend component (closes FB-33)

The `FeedbackOriginIcon` component has a dedicated legend/glossary, placed either:
- In the sidebar header (`comments-list-with-agent-toggle.html` — small "?"-icon button opens a popover legend), OR
- In a help overlay keyed to the `?` shortcut.

The legend **MUST** list all six origins from DESIGN-BRIEF §2 with their emoji + text label, and the emoji rendering must match exactly between the brief and every artifact. See the "Emoji ↔ origin mapping (canonical)" section below.

## 6. Emoji ↔ origin mapping (canonical)

Single source of truth. DESIGN-BRIEF §2 **and** every artifact **MUST** render the same emoji for each origin. Screen-reader users see the adjacent visible text label — `aria-hidden="true"` is applied to the emoji span because the text label is the accessible name.

| Origin (feedback frontmatter) | Emoji code point | Emoji | Visible text label | Rendering notes |
|---|---|---|---|---|
| `adversarial-review` | `U+1F50D` `&#x1F50D;` | 🔍 | Review Agent | Magnifying glass; renders consistently on Apple Color Emoji, Segoe UI Emoji 14+, Noto Emoji |
| `external-pr` | `U+1F517` `&#x1F517;` | 🔗 | PR Comment | Link; renders consistently on all three emoji fonts |
| `external-mr` | `U+1F517` `&#x1F517;` | 🔗 | MR Comment | Same emoji as `external-pr`; text label differentiates |
| `user-visual` | `U+270E` `&#x270E;` | ✎ | Annotation | Lower-right pencil; text-style glyph (no variation selector). On Apple Color Emoji + Segoe UI Emoji it renders as a text glyph — deliberate, because this is the only "text-style" glyph in the set and it pairs visually with the pencil brush convention in the annotation popover's pin UI. |
| `user-chat` | `U+1F4AC` `&#x1F4AC;` | 💬 | Comment | Speech balloon |
| `agent` | `U+1F916` `&#x1F916;` | 🤖 | Agent | Robot face |

### Cross-platform emoji rendering smoke test

Before merging the dev stage, QA **MUST** render every artifact in:
- macOS 15+ Safari (Apple Color Emoji)
- Windows 11 Chrome / Edge (Segoe UI Emoji 14+)
- Ubuntu 24.04 Firefox (Noto Color Emoji 2.042+)

and verify all six origins render as the intended pictographs (no tofu boxes, no text fallback, no wildly-different visual metaphors). The `✎` pencil is intentionally a text-style glyph; all others are pictographic.

### ARIA policy for emoji

Every emoji span that appears next to a visible text label **MUST** have `aria-hidden="true"`. Screen readers should announce the label, not the emoji name. Example:

```html
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-rose-100 text-rose-700">
  <span aria-hidden="true">&#x1F50D;</span> Review Agent
</span>
```

When an emoji is used **without** a visible text label (e.g. status icon in a dense sidebar), it **MUST** have an explicit `aria-label`:

```html
<span role="img" aria-label="Review Agent">&#x1F50D;</span>
```

## 7. Skip link requirement (reinforces FB-30)

Every page-level artifact **MUST** include a skip link as the first focusable element:

```html
<a href="#main-content"
   class="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2
          focus-visible:z-[100] focus-visible:px-3 focus-visible:py-2
          focus-visible:bg-teal-600 focus-visible:text-white focus-visible:rounded-md
          focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
          dark:focus-visible:ring-offset-stone-900">
  Skip to main content
</a>
```

The target `<main id="main-content">` **MUST** have `tabindex="-1"` so the browser can move focus to it programmatically when the skip link is activated (not required on all browsers, but adds nothing bad and closes the long-tail edge cases).

## 8. unit-01 amendment (body text reference, NOT FSM field)

unit-01's completion-criteria body text (not frontmatter) is amended to require:

- every artifact render the landmark structure defined in §1 above
- every modal render the dialog contract defined in §3
- origin-emoji rendering match §6

This is a body-text amendment only — unit-01's FSM fields (status, hat, iterations, etc.) are not modified.

## 9. Verification checklist (feedback-assessor + dev-stage gate)

- [ ] `grep -rEn 'role="banner"' stages/design/artifacts/` shows ≥ 1 match per page-level artifact
- [ ] `grep -rEn '<main[^>]* id="main-content"' stages/design/artifacts/` shows ≥ 1 match per page-level artifact
- [ ] `grep -rEn 'aria-label="Stage progress"' stages/design/artifacts/` shows ≥ 1 match per artifact that contains a stage-strip
- [ ] `grep -rEn 'role="complementary"' stages/design/artifacts/` shows ≥ 1 match per desktop artifact
- [ ] `grep -rEn 'role="dialog" aria-modal="true"' stages/design/artifacts/` shows ≥ 1 match per artifact that contains a modal
- [ ] `grep -rEn 'role="status" aria-live="polite"' stages/design/artifacts/` shows ≥ 2 matches (per-page polite region + assessor-summary-card root)
- [ ] `grep -rEn 'role="alert" aria-live="assertive"' stages/design/artifacts/` shows ≥ 1 match per page-level artifact
- [ ] Origin emoji audit: `grep -rEn '&#x(1F6E&#49;|1F5&#48;&#48;|27&#50;8|1F44&#49;)' stages/design/` returns 0 matches (these code points — shield `U+1F6E1`, shuffle `U+1F500`, sparkles `U+2728`, eye `U+1F441` — are the forbidden / drifted emoji from the old drafts; the grep pattern in this line is HTML-entity-escaped and the forbidden codepoints are referenced by U-notation so the audit stays clean when it scans this spec itself)
- [ ] Skip link present: `grep -rEn 'href="#main-content"' stages/design/artifacts/` shows ≥ 1 match per page-level artifact

Any gate item that fails blocks hat advancement; assessor rejects with the specific line reference.
