# Revisit Confirmation Modal — Design Review

**Unit:** unit-06-revisit-confirmation-modal
**Reviewer:** design-reviewer (bolt 1)
**Artifacts reviewed:**
- `stages/design/artifacts/revisit-modal-spec.html` (776 lines)
- `stages/design/artifacts/revisit-modal-states.html` (631 lines)

**Reference inputs:**
- `stages/design/feedback/03-revisit-preview-with-confirmation-modal.md` (source feedback)
- `stages/design/artifacts/review-ui-mockup.html` (reference implementation, `openRevisitModal`/`doRevisit`)
- `knowledge/DESIGN-TOKENS.md` (token contract)

**Verdict:** APPROVED — all quality gates met, accessibility and state coverage are thorough, tokens are clean.

---

## 1. Quality-gate checklist (from unit spec)

| # | Criterion | Pass | Evidence |
|---|---|---|---|
| 1 | IA order: target → downstream → new-feedback preview → open feedback → footer | Pass | `revisit-modal-spec.html` §Anatomy — annotations (1)–(5) walk the section order top-to-bottom |
| 2 | Three variants (gate-invoked, user-opened, typed) | Pass | `§variant-gate`, `§variant-user`, `§variant-typed` |
| 3 | Light + dark + mobile-narrow variants | Pass | `§theming` (light/dark side-by-side), `§mobile` (375px phone frame) |
| 4 | Dismiss paths explicit (ESC / backdrop / Cancel), non-destructive, return-focus | Pass | `§a11y` — dismiss-paths table + ARIA code block |
| 5 | Focus trap + return-focus | Pass | `§a11y` focus-order section (Cancel default, Tab cycle, Shift+Tab reverse, return to trigger) |
| 6 | Confirm-button copy names side effects concretely | Pass | `Confirm & Revisit to Product · resets 3 downstream stages` across all variants, plus `· adds 1 new` for Variant C |
| 7 | Approve contrast documented | Pass | Final teal callout in `§tokens` states Approve is single-click, reversible; Revisit is not |

All 7 quality gates satisfied.

---

## 2. Reviewer-focus checks (from `phases/EXECUTION.md`)

### Design-system consistency
- Tokens: every color is a named Tailwind token from `DESIGN-TOKENS.md` — no raw hex. Surface `bg-white dark:bg-stone-900`, border `border-stone-200 dark:border-stone-700`, radius `rounded-xl`, shadow `shadow-2xl`, backdrop `bg-black/50 backdrop-blur-sm`, z-index `z-[100]`. All match §1.5, §1.6, §6.
- Destructive accent correctly scoped to target chip + confirm button + glyph (amber), not leaked into neutral chrome.
- Typed-feedback preview uses `sky` palette per `DESIGN-TOKENS.md §2.2 user-visual origin`. This is a deliberate upgrade from the reference `review-ui-mockup.html` (which used teal in the inline preview — teal is the primary accent and shouldn't double as an origin color). Accepted.

### State coverage
- `revisit-modal-states.html` enumerates: default, hover, focus, active, disabled, loading, plus error and empty. The state-matrix table at the bottom explicitly lists every element × state and marks `n/a` when unreachable by design (e.g. chips aren't focusable). Coverage is complete.
- Loading state correctly disables Cancel and suppresses ESC/backdrop dismiss — prevents racing the in-flight `haiku_revisit` call.
- Error state uses `role="alert"` and switches Confirm copy to `Retry`. Preserves user context (modal stays open, body preserved).
- Empty state suppresses the "open feedback in scope" section rather than rendering an empty list — matches reference `openRevisitModal` behavior.

### Accessibility
- Focus lands on Cancel on open — correct for a destructive-confirm dialog (prevents accidental Enter-confirm).
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` + `aria-describedby` wired.
- Body scroll lock on open, restored on close.
- Reduced-motion: fade-only, no scale; spinner replaced with static busy-dot pulse.
- Touch targets: mobile Confirm/Cancel both `min-h-[44px]`; mobile ✕ close is `44×44`.
- Screen-reader note: confirm button accessible name includes target stage + downstream count so AT users hear the full side-effect summary (matches the visible label).

### Responsive behavior
- 375px: modal fills viewport with 8px insets; footer stacks with Confirm on top in the thumb-reachable zone on iPhone SE.
- 768px: inline right-aligned footer, comfortable spacing.
- 1280px+: inline right-aligned, Confirm carries full side-effect summary.
- Breakpoint matrix is explicit in `§mobile`.

### Copy
- All literals documented in the `§copy` table with `{token}` interpolation markers. Em-dash (not hyphen) for `currently viewed — no earlier unaddressed` matches unit-spec requirement exactly.
- Confirm button pluralizes `stage`/`stages` and appends `· adds 1 new` only when the textarea is non-empty — both behaviors match the reference `openRevisitModal`.

---

## 3. Notes (accepted decisions, no action)

1. **Sky vs teal for typed-feedback preview** — spec deliberately diverges from reference implementation. Sky aligns with the `user-visual` origin token in `DESIGN-TOKENS.md §2.2`; teal is reserved for primary/interactive accents. The reference (`review-ui-mockup.html:1719`) used teal because it predated the origin palette. Accept the spec's choice; implementers should use sky.
2. **"Open feedback in scope" section count includes typed** — spec's `{n}` token header is `allPending.length + (typed ? 1 : 0)` matching reference `openRevisitModal:1725`. Correctly preserved.
3. **Error retry copy lifecycle** — spec says Confirm switches to `Retry` on error, then "returns to the default Confirm copy once the user edits the state or re-opens". Slightly vague on the exact trigger for the reset. Low risk — implementation will naturally reset when the modal re-mounts. Documented for the dev stage to pick up.
4. **Long-list truncation threshold** — `allPending.length > 12` collapses tail to `… N more`. Threshold is a reasonable guess; worth A/B verifying in dev, but no blocker for design approval.

---

## 4. Downstream handoff

Implementation stage (`development`) has everything it needs:
- Pixel-accurate spec with annotated anatomy
- Exact token strings (no raw colors)
- Every interactive state visualized
- ARIA snippet ready to paste
- Copy table with i18n-friendly `{token}` placeholders
- Error/loading/empty semantics explicit

No additional design passes required. Unit is ready to advance.
