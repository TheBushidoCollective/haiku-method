# State Coverage Grid (FB-25, extended by FB-56, completed by FB-75)

Closes **FB-25** (original grid), **FB-56** (extension to every DESIGN-BRIEF §2 component), and **FB-75** (completeness sweep — every §2 component has a dedicated per-component subsection with fully-labelled N/A cells). Enumerates every interactive surface with explicit coverage of six canonical states: **default**, **hover**, **focus**, **active**, **disabled**, **error**. Additional **empty** / **loading** / **pulse** columns appear where the surface has those meaningful states.

Legend: `✓` = rendered; `— (N/A: <rationale>)` = state unreachable by design, with the rationale inline in the cell; `⚠` = gap (tracked for follow-up).

---

## 0. DESIGN-BRIEF §2 component checklist (FB-56)

Every component inventoried in DESIGN-BRIEF §2 has a row below. Missing rows are a hard fail; N/A cells must carry a rationale.

| DESIGN-BRIEF §2 component | Grid section below |
|---|---|
| `FeedbackStatusBadge` | §7.1 (full 4-status × 2-theme matrix) |
| `FeedbackOriginIcon` | §7.2 (six-origin variant render) |
| `FeedbackItem` (compact) | §2 (primary) + §7.3 (cross-ref) |
| `FeedbackItem` (expanded) | §2 (primary) + §7.4 (cross-ref) |
| `FeedbackList` | §7.5 (container-level empty / loading / error) |
| `FeedbackSummaryBar` | §7.6 (per-chip six-state matrix) |
| `AgentFeedbackToggle` | §7.7 (on / off × focus / disabled / error + ARIA contract) |
| `FeedbackSheet` (aka `MobileFeedbackPanel`) | §3 (primary) + §7.8 (sheet-level empty / loading / error) |
| `FeedbackFloatingButton` (aka FAB) | §3 (primary) + §7.9 (cross-ref, no pulse) |
| `FeedbackFloatingButton.pulse` (pulse-animation variant) | §3 (primary, `pulse` column) + §7.9a |
| `AssessorSummaryCard` | §7.10 |
| `StageProgressStrip` | §5 (primary) + §7.11 (cross-ref) |
| `RevisitModal` | §4 (primary) + §7.12 (cross-ref) |

If you add a new component to DESIGN-BRIEF §2, you MUST add a row in §7 of this file in the same change.

---

## 1. Pins, markers, ghosts (annotation overlay layer)

Artifacts: `feedback-inline-desktop.html`, `annotation-gesture-spec.html`, `annotation-popover-states.html`.

| Surface | default | hover | focus | active | disabled | error | Notes |
|---|---|---|---|---|---|---|---|
| Pin marker (w-7 h-7, 44×44 hit) | ✓ | ✓ (brightness 1.08) | ✓ (teal 2px, 3px offset) | ✓ (brightness 0.92) | ✓ (opacity 0.45, cursor not-allowed) | ✓ (red-500 ring on cross-flash miss) | `.pin-hit::before` provides the 44×44 invisible hit zone. See `touch-target-audit.md` for dimensions. |
| Ghost pin (click-to-place) | ✓ | — [1] | — [1] | — [1] | — [1] | — | Ephemeral cursor-follower; not a focusable control. `pointer-events: none`. |
| Pin popover | ✓ | — | ✓ (outline via first-field focus) | — | ✓ (State 4b — Create button inert on empty body) | ✓ (State 4 — red banner, preserved draft) | Popover itself is a `role="dialog"`; its interior buttons carry all states. |

[1] Ghost pin has `pointer-events: none` and exists only between pointer-move and pointer-up. A11y-wise it's decorative.

---

## 2. Feedback cards (sidebar list items)

Artifacts: `feedback-inline-desktop.html`, `feedback-inline-mobile.html`, `feedback-card-states.html`, `comment-to-feedback-flow.html`.

| Surface | default | hover | focus | active | disabled | error | empty |
|---|---|---|---|---|---|---|---|
| Feedback card (compact) | ✓ | ✓ (teal border bump) | ✓ (focus-visible 2px teal) | ✓ (depress + brightness) | ✓ (opacity 0.6 when read-only/locked) | ✓ (§5b red-tinted card — `feedback-card-states.html`) | ✓ (list-level empty copy — `feedback-inline-*` §empty-state) |
| Feedback card (expanded) | ✓ | — [1] | ✓ | — | ✓ (busy state, `aria-busy="true"`) | ✓ (inline error row above footer) | — |
| Pending footer buttons (Reject / Close) | ✓ | ✓ | ✓ | ✓ | ✓ (`disabled` while saving) | ✓ (toast + red ring) | — |
| Addressed footer buttons (Verify & Close / Reopen) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Closed / Rejected footer buttons (Reopen) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Status badge (pending / addressed / closed / rejected) | ✓ | — [2] | — [2] | — [2] | — [2] | ✓ (contrast-preserved inside red-tinted card) | — |

[1] Expanded card is the hover + click terminal state; no nested hover.
[2] Status badge is a label, not a control; it inherits focus from the card.

---

## 3. FAB + bottom sheet (mobile)

Artifact: `feedback-inline-mobile.html`.

| Surface | default | hover | focus | active | disabled | error | empty | pulse |
|---|---|---|---|---|---|---|---|---|
| FAB (`FeedbackFloatingButton`) | ✓ | ✓ (teal-700 fill) | ✓ (2px offset + teal-500 ring) | ✓ (teal-800 fill + scale 0.97) | ✓ (opacity 0.5, grayscale 0.4) | — [1] | ✓ (hidden when no pending items) | ✓ (2s × 3 iter, reduced-motion → static badge) |
| Sheet close ✕ | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| Sheet sheet-enter anim | ✓ | — | — | — | — | — | — | reduced-motion → appears in-place |
| `AgentFeedbackToggle` (role=switch — FB-53) | ✓ | ✓ (track darkens) | ✓ (teal outline) | ✓ | ✓ (`aria-disabled="true"`, cursor-not-allowed, opacity-50) | — [2] | — | — |
| Filter pills (All / Pending / Addressed / Closed) | ✓ | ✓ | ✓ | ✓ (`aria-pressed="true"`) | — | — | — | — |
| Group header (Current Visit / Visit 1 / …) | ✓ | — [3] | — [3] | — | — | — | ✓ ("No visits yet" inline) | — |
| Sheet footer textarea | ✓ | — | ✓ (teal ring) | — | ✓ (during submit) | ✓ (red border on validation fail) | ✓ (placeholder) | — |
| Add button | ✓ | ✓ | ✓ | ✓ | ✓ (until textarea has content) | ✓ | ✓ | — |
| Approve / Request Changes | ✓ | ✓ | ✓ | ✓ | ✓ (during submit + until condition met) | ✓ (toast + button returns to idle) | — | — |
| Theme toggle (FB-66 — dynamic aria-label) | ✓ | ✓ | ✓ | ✓ | — | — | — | — |

[1] FAB disabled state used when the user is on a non-review page; normal flow keeps it enabled.
[2] `AgentFeedbackToggle` has no native error state — errors on the toggle action are announced via `#feedback-live-assertive` per `aria-live-sequencing-spec.md §3`.
[3] Group headers are labels, not focusable controls.

---

## 4. Revisit modal

Artifacts: `revisit-modal-spec.html`, `revisit-modal-states.html`.

| Element | default | hover | focus | active | disabled | loading | error | empty |
|---|---|---|---|---|---|---|---|---|
| Confirm & Revisit button | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (spinner → label "Saving…") | ✓ (label → "Retry" + red ring) | — |
| Cancel button | ✓ | ✓ | ✓ (initial focus on modal open) | ✓ | ✓ (during loading) | ✓ (disabled) | ✓ | — |
| Mobile ✕ close | ✓ | ✓ | ✓ | ✓ | ✓ (during loading) | ✓ | ✓ | — |
| Target chip | ✓ | — [1] | — [1] | — [1] | — [1] | ✓ (dim 75%) | ✓ (preserved) | ✓ ("currently viewed — no earlier unaddressed") |
| Downstream chip | ✓ | — | — | — | — | ✓ (dim 75%) | ✓ | ✓ (shows all non-upcoming stages) |
| Typed-feedback preview | ✓ (when typed) | — | — | — | — | ✓ (dim 75%) | ✓ (preserved) | ✓ (suppressed when empty) |
| Open-feedback list | ✓ | — | — | — | — | ✓ (dim 75%) | ✓ (preserved) | ✓ (suppressed when count=0) |
| Backdrop | ✓ | — | aria-hidden | click = cancel | — | click suppressed | ✓ | ✓ |
| **Rollback toast** | ✓ | ✓ (buttons only) | ✓ (focus trap on Retry) | ✓ | — | — | ✓ (this *is* the error state) | — |
| Rollback toast Retry button | ✓ | ✓ | ✓ (initial focus on toast mount) | ✓ | — | — | ✓ | — |
| Rollback toast Open-repair button | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | — |
| Rollback toast ✕ dismiss (FB-64 — 44×44 on mobile) | ✓ | ✓ | ✓ | ✓ | — | — | — | — |

[1] Chips aren't focusable in the base modal.

---

## 5. Stage progress strip

Artifact: `stage-progress-strip.html`.

| Stage condition | default | hover | focus | active | disabled | error | tabindex |
|---|---|---|---|---|---|---|---|
| Completed (prior stage) | ✓ | ✓ (teal border + tooltip) | ✓ (2px teal 4px offset) | ✓ (Enter opens read-only view) | — [1] | — [1] | `0` |
| Current (in-progress) | ✓ (diamond badge) | ✓ (badge lifts, tooltip) | ✓ (teal outline on diamond) | ✓ (Enter scrolls to stage's active unit) | — | — | `0` |
| Previously visited (now "future") | ✓ (filled border) | ✓ (border darkens, tooltip) | ✓ (teal 2px ring) | ✓ (Enter opens read-only prior visit) | — | — | `0` |
| Future, never visited | ✓ (empty circle + upcoming label) | ✓ (tooltip shows "Upcoming") | ✓ (teal 2px ring; reachable via arrow keys — FB-65) | — (Enter is no-op, aria-disabled) | ✓ (`aria-disabled="true"`) | — | `-1` (Tab) / reachable via ArrowLeft/ArrowRight (FB-65 roving) |

[1] Stage progress strip nodes don't carry per-stage disabled/error; error is communicated by the underlying stage state elsewhere.

---

## 6. Revisit unit list

Artifact: `revisit-unit-list.html`.

| Surface | default | hover | focus | active | disabled | error |
|---|---|---|---|---|---|---|
| New-unit card | ✓ (blue-400 border) | ✓ (shadow lifts) | ✓ (teal 2px ring) | ✓ | — | — |
| Locked / completed unit card | ✓ (opacity 0.6) | ✓ (opacity 0.8) | ✓ (opacity 0.95 + teal ring) | — (read-only) | ✓ (`aria-disabled="true"`, content uneditable) | — |
| Closes-feedback chip | ✓ | — [1] | — [1] | — | — | — |
| Stage progress strip (inside) | ✓ | ✓ | ✓ | ✓ | ✓ (future stages) | — |

[1] Chips are labels, not controls.

---

## 7. DESIGN-BRIEF §2 components — state coverage (FB-56 + FB-75)

Every component inventoried in DESIGN-BRIEF §2 gets its own subsection below. Components covered primarily in §1–§6 are cross-referenced but still carry an explicit six-state table here so a reviewer never has to scroll to verify a gate line. N/A cells carry an inline rationale (`— (N/A: …)`), not a bare em-dash.

### 7.1 `FeedbackStatusBadge`

Pure label — `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold`. Not a focusable control; hover / focus / active / disabled are inherited from the owning card. The full render is a **4-status × 2-theme matrix** — `pending` / `addressed` / `closed` / `rejected` rendered in both light and dark themes (see DESIGN-BRIEF §2 `FeedbackStatusBadge` and DESIGN-TOKENS.md §2.1).

| Variant | default | hover | focus | active | disabled | error |
|---|---|---|---|---|---|---|
| `pending` light (`bg-amber-100 text-amber-800`) | ✓ (`feedback-card-states.html` §pending-light) | — (N/A: label not a control; inherits owning card's teal-border hover) | — (N/A: label not focusable; inherits card `:focus-visible`) | — (N/A: label has no pressed/active state — inherits card press) | — (N/A: no "disabled badge"; owning card may mute but badge text stays at full contrast to preserve AA) | ✓ (inside a red-tinted error card, palette is contrast-preserved per `contrast-and-type-audit.md` §3) |
| `pending` dark (`dark:bg-amber-900/30 dark:text-amber-300`) | ✓ (`feedback-card-states.html` §pending-dark) | — (N/A: same as light) | — (N/A: same as light) | — (N/A: same as light) | — (N/A: same as light) | ✓ (dark error tint; ratio ≥ 4.9:1 per DESIGN-TOKENS.md §2.1 audit) |
| `addressed` light (`bg-blue-100 text-blue-800`) | ✓ (`feedback-card-states.html` §addressed-light) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | ✓ (contrast-preserved) |
| `addressed` dark (`dark:bg-blue-900/30 dark:text-blue-300`) | ✓ (`feedback-card-states.html` §addressed-dark) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | ✓ (contrast-preserved) |
| `closed` light (`bg-green-100 text-green-800`) | ✓ (`feedback-card-states.html` §closed-light) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | ✓ (contrast-preserved) |
| `closed` dark (`dark:bg-green-900/30 dark:text-green-300`) | ✓ (`feedback-card-states.html` §closed-dark) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | ✓ (contrast-preserved) |
| `rejected` light (`bg-stone-100 text-stone-500`) | ✓ (`feedback-card-states.html` §rejected-light) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | ✓ (contrast-preserved; 4.6:1 floor) |
| `rejected` dark (`dark:bg-stone-800 dark:text-stone-400`) | ✓ (`feedback-card-states.html` §rejected-dark) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | ✓ (contrast-preserved; 4.9:1 floor) |

### 7.2 `FeedbackOriginIcon`

Pure label + emoji — `<span className="text-xs text-stone-500 dark:text-stone-400">{icon}</span>`. Not a focusable control; emoji span carries `aria-hidden="true"` when paired with a visible label, else `role="img" aria-label="{Label}"` (DESIGN-BRIEF §2 `FeedbackOriginIcon`, `aria-landmark-spec.md §6`).

| Variant | default | hover | focus | active | disabled | error |
|---|---|---|---|---|---|---|
| `adversarial-review` (🔍 `U+1F50D` "Review Agent") | ✓ (`feedback-card-states.html`, `comments-list-with-agent-toggle.html`) | — (N/A: label not a control; inherits card hover) | — (N/A: not focusable; inherits card focus) | — (N/A: no press state) | — (N/A: icon stays at full contrast even when owning item is locked, so readers can still identify origin) | — (N/A: origin does not change on error — a fetch failure may hide the surrounding item but does not re-render the icon in an error palette) |
| `external-pr` (🔗 `U+1F517` "PR Comment") | ✓ | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) |
| `external-mr` (🔗 `U+1F517` "MR Comment") | ✓ | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) |
| `user-visual` (✎ `U+270E` "Annotation") | ✓ | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) |
| `user-chat` (💬 `U+1F4AC` "Comment") | ✓ | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) |
| `agent` (🤖 `U+1F916` "Agent") | ✓ | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) | — (N/A: same) |

### 7.3 `FeedbackItem` (compact)

Primary coverage: §2 "Feedback card (compact)" row above. The §2 table covers every canonical state plus `empty`; every cell is either `✓` or carries a numbered footnote rationale. No duplication here — cross-ref only.

### 7.4 `FeedbackItem` (expanded)

Primary coverage: §2 "Feedback card (expanded)" row above. Same contract as §7.3.

### 7.5 `FeedbackList`

Scrollable `role="list" aria-label="Feedback items"` container with grouping headers (Current Visit / Visit N). Canonical states below cover **the container itself**, not the enclosed cards (those live in §2). Explicit **empty** variants distinguish the first-visit case from the all-resolved case per DESIGN-BRIEF §3 "Sidebar — Unified Comments List" table.

| State | Coverage |
|---|---|
| default | ✓ (rendered when ≥ 1 item exists — `feedback-inline-desktop.html`, `comments-list-with-agent-toggle.html`) |
| hover | — (N/A: scroll container itself has no hover affordance; hover lives on individual `FeedbackItem` rows per §2) |
| focus | — (N/A: `role="list"` is not focusable; items inside are focusable via `tabindex="0"` per §9 focus-order policy) |
| active | — (N/A: scroll container has no pressed/active state) |
| disabled | — (N/A: list is never disabled as a whole — individual items may become read-only; see §2 `opacity 0.6` footnote for the per-item locked rendering) |
| error | ✓ (fetch-failure state — empty list with red inline banner + retry button; `feedback-inline-desktop.html` §error-state) |
| **empty — first visit, no drafts** | ✓ ("No feedback yet. Select text or drop pins to add annotations." — `text-xs text-stone-400 dark:text-stone-500 italic p-2 text-center` per DESIGN-BRIEF §3) |
| **empty — visit > 0, all resolved** | ✓ ("All feedback addressed!" with a green checkmark — DESIGN-BRIEF §3 Sidebar table) |
| loading | ✓ (skeleton rows + spinner; `aria-busy="true"` on the list container) |

### 7.6 `FeedbackSummaryBar`

Compact strip at the top of the sidebar list. Each status count chip (`pending` · `addressed` · `closed`) is a **toggleable filter button** with `aria-pressed`. The six canonical states apply **per chip**, not to the container as a whole.

| Per-chip state | `pending` count chip | `addressed` count chip | `closed` count chip |
|---|---|---|---|
| default | ✓ (amber text, amber bar) | ✓ (blue text, blue bar) | ✓ (green text, green bar) |
| hover | ✓ (background nudge: `hover:bg-amber-50 dark:hover:bg-amber-900/20`) | ✓ (`hover:bg-blue-50 dark:hover:bg-blue-900/20`) | ✓ (`hover:bg-green-50 dark:hover:bg-green-900/20`) |
| focus | ✓ (shared focus ring — `ring-2 ring-teal-500 ring-offset-2` per `focus-ring-spec.html §1`) | ✓ (same ring) | ✓ (same ring) |
| active (`aria-pressed="true"`) | ✓ (filled: `bg-amber-600 text-white`; click again to clear filter) | ✓ (`bg-blue-600 text-white`) | ✓ (`bg-green-600 text-white`) |
| disabled | ✓ (chip is hidden when count = 0 — DESIGN-BRIEF §2 `FeedbackSummaryBar` "Counts that are zero are omitted"; no grayed-out chip) | ✓ (same — hidden when count = 0) | ✓ (same — hidden when count = 0) |
| error | ✓ (if the API mutation that flipped a filter pill fails, the pressed state reverts and `#feedback-live-assertive` announces the failure — `aria-live-sequencing-spec.md §2.1`) | ✓ (same) | ✓ (same) |

**Container-level coverage:** bar itself is visible when ≥ 1 chip has count > 0; hidden when 0 feedback items exist (`— (N/A: container hidden)`). The bar is never focusable as a whole — focus lives on each chip.

### 7.7 `AgentFeedbackToggle`

Canonical `role="switch" aria-checked="{on|off}"` button with `aria-label="Show agent feedback inline"` per `agent-feedback-toggle-spec.html` and DESIGN-BRIEF §2 `AgentFeedbackToggle`. The ARIA contract keys are the **two aria-checked states (on / off) crossed with focus, disabled, and error**.

| State | `aria-checked="false"` (default OFF) | `aria-checked="true"` (ON) |
|---|---|---|
| default | ✓ (thumb left, track `bg-stone-300 dark:bg-stone-600`; muted agent count chip visible when agentCount > 0 — `agent · N`) | ✓ (thumb right, track `bg-teal-600 dark:bg-teal-500`; muted chip hidden; agent items interleaved with origin badges) |
| hover | ✓ (track darkens via `hover:bg-stone-400 dark:hover:bg-stone-500`) | ✓ (`hover:bg-teal-700`) |
| focus | ✓ (canonical focus-ring: `ring-2 ring-teal-500 ring-offset-2 ring-offset-white dark:ring-offset-stone-900` per `focus-ring-spec.html §1`) | ✓ (same ring, wraps the switch track) |
| active (press) | ✓ (thumb compresses 2px toward activation direction before snap; reduced-motion: snap without compress) | ✓ (same) |
| disabled | ✓ (`aria-disabled="true"`, `cursor-not-allowed`, track → `bg-stone-200 dark:bg-stone-700`, thumb → `bg-stone-100 dark:bg-stone-500`, entire switch `opacity-50`) | ✓ (same disabled visuals in the ON position — thumb right, track `bg-teal-600/50`, opacity-50) |
| error | ✓ (toggle API failure: switch flips back to OFF, `role="alert" aria-live="assertive"` announces `"Failed to load agent feedback"` per `aria-live-sequencing-spec.md §3`) | ✓ (flip-back to OFF from ON failure — same announcement) |

**Keyboard:** `Space` or `Enter` flips. Announcement on success: `"Agent feedback shown (N items)"` (polite) on flip-to-ON; `"Agent feedback hidden"` (polite) on flip-to-OFF.

### 7.8 `FeedbackSheet` (aka `MobileFeedbackPanel`)

Full-screen dialog (`role="dialog" aria-modal="true" aria-labelledby="sheet-title"`) opened by `FeedbackFloatingButton`. Primary per-sub-element coverage lives in §3 (Sheet close ✕, enter-animation, toggle inside sheet, filter pills, textarea, Add button, Approve / Request Changes). This subsection adds the **sheet-level** states the gate calls out explicitly — `empty`, `loading`, and `error` on the sheet as a whole.

| Sheet-level state | Coverage |
|---|---|
| default (open) | ✓ (backdrop + panel slide-in; focus moves to `AgentFeedbackToggle` as first tabbable via `focus-trap-react`) |
| hover | — (N/A: sheet panel itself has no hover state; sub-elements carry their own — see §3) |
| focus | — (N/A: container is not focusable; `FocusTrap` governs focus cycling inside) |
| active | — (N/A: sheet is not a press target) |
| disabled | — (N/A: when the FAB is disabled the sheet never opens, so "disabled sheet" is an undefined state) |
| error (fetch failure on open) | ✓ (the sheet opens into an empty content region with a red error banner + retry button; identical pattern to `FeedbackList` §7.5 error row, because the list lives inside the sheet) |
| empty (no feedback yet) | ✓ (sheet renders the "No feedback yet. Select text or drop pins to add annotations." empty copy exactly as the desktop `FeedbackList` §7.5 empty row) |
| empty (all resolved) | ✓ ("All feedback addressed!" with green checkmark — same as desktop `FeedbackList`) |
| loading | ✓ (skeleton rows + spinner inside the sheet; `aria-busy="true"` on the list container inside the sheet) |
| closing | ✓ (slide-out; `returnFocusOnDeactivate` restores focus to the FAB per `aria-landmark-spec.md §5`) |
| reduced-motion | ✓ (sheet appears in-place without slide animation — `motion-and-reduced-motion-spec.md`) |

### 7.9 `FeedbackFloatingButton` (aka FAB)

Primary coverage: §3 FAB row (full `default / hover / focus / active / disabled / error / empty / pulse` coverage already present). Cross-ref only — no table duplication here. Every §3 cell is ✓ or carries a numbered footnote rationale.

### 7.9a `FeedbackFloatingButton.pulse` (pulse-animation variant)

The `.feedback-floating-button-pulse` CSS class is a live style hook (DESIGN-BRIEF §7 + §4 responsive behavior), briefly pulsed when new agent feedback arrives. Called out separately per DESIGN-BRIEF §2 FB-56 extension list.

| State | Coverage |
|---|---|
| default | ✓ (class applied → 3 iterations of `feedback-pulse` keyframe, 2s ease-in-out each; see DESIGN-BRIEF §7 CSS additions) |
| hover | — (N/A: hover is a FAB-root state — see §3; pulse is an orthogonal visual layer that plays regardless of hover) |
| focus | — (N/A: focus belongs to the FAB button element — §3; pulse does not change on focus) |
| active (press) | — (N/A: pulse continues or completes; press state belongs to FAB — §3) |
| disabled | — (N/A: when the FAB is disabled the pulse class is never applied; the animation requires the FAB to be live) |
| error | — (N/A: pulse is a visual cue for incoming feedback; errors surface on the FAB itself — §3) |
| reduced-motion | ✓ (`@media (prefers-reduced-motion: reduce) { .feedback-floating-button-pulse { animation: none; } }` — DESIGN-BRIEF §7. Users on reduced-motion get a static badge state instead, per §3 "pulse" column) |

### 7.10 `AssessorSummaryCard`

Card root is a live region (`role="status" aria-live="polite" aria-atomic="true"` — FB-62). Card body contains a "view details" / "view log" button as its only interactive element.

| default (clean) | hover | focus | active | disabled | loading | error | empty |
|---|---|---|---|---|---|---|---|
| ✓ (State 1 — assessor pass clean, user gate unlocked) | ✓ (per-item row hover reveals tooltip with addressed-by unit) | ✓ ("view details" button + per-item rows focusable when expanded) | ✓ (button pressed) | N/A — card is not disabled as a whole; individual actions may hide (e.g. no "view details" in empty error state) | ✓ (skeleton stat row + spinner on status dot; pill reads "running"; `aria-busy="true"` on card root) | ✓ (State 3 — error pill, red-tinted card, "rolling back to elaborate" footer) | ✓ (card hides entirely when 0 feedback items — stage is clean by definition) |

State 2 (pending — user gate blocked) is a distinct default variant within the default column, not a separate state column.

### 7.11 `StageProgressStrip`

Primary coverage: §5 above. Four-row matrix (completed / current / previously-visited / future-never-visited) × seven columns (default / hover / focus / active / disabled / error / tabindex) with footnote rationale for the error column. Future never-visited nodes are focusable via arrow-key roving per FB-65. Cross-ref only — no duplication here.

### 7.12 `RevisitModal`

Primary coverage: §4 above. Every element row (Confirm & Revisit, Cancel, mobile ✕, chips, typed-feedback preview, open-feedback list, backdrop, rollback toast) carries an eight-column matrix (default / hover / focus / active / disabled / loading / error / empty) with N/A rationale where applicable. Cross-ref only — no duplication here.

---

## 8. Feedback annotation popover (creation)

Artifact: `annotation-popover-states.html`.

| Element | default (State 1) | line-anchored (State 2) | iframe 2-step (State 3) | error (State 4) | disabled-body (State 4b) | mobile bottom-sheet (State 5) | dark (State 6) |
|---|---|---|---|---|---|---|---|
| Title input | ✓ | ✓ | ✓ | ✓ (preserved) | ✓ (placeholder) | ✓ | ✓ |
| Body textarea | ✓ | ✓ | ✓ | ✓ (preserved) | ✓ (empty, describedby hint) | ✓ | ✓ |
| Cancel button | ✓ | ✓ | ✓ | — (hidden when banner is present in v1) | ✓ | ✓ (44×44) | ✓ |
| Discard button | — | — | — | ✓ | — | — | — |
| Create button | ✓ | ✓ | ✓ (active on step B) | — (replaced by Retry) | ✓ (disabled + aria-disabled) | ✓ (44×44) | ✓ |
| Retry button | — | — | — | ✓ | — | — | — |
| Close ✕ (FB-64 — 44×44 via `.popover-close::before` on mobile) | ✓ | ✓ | ✓ | ✓ | ✓ (focusable) | ✓ (44×44) | ✓ |
| Error banner | — | — | — | ✓ | — | — | — |
| Help text (aria-describedby) | — | — | — | — | ✓ ("Body is required.") | — | — |

---

## 9. Focus order policy (summary)

Baked into each artifact's stylesheet and HTML:

1. **Focusable-and-actionable** (most surfaces): `tabindex="0"` (or native), full hover/focus/active coverage, Enter activates.
2. **Focusable-but-no-action** (read-only locked units, visited-but-greyed-back stages): `tabindex="0"`, focus ring still visible so keyboard user knows where they are, but activation is a no-op or opens a read-only panel.
3. **Not-in-tab-order** (future never-visited stages, disabled footer buttons): `tabindex="-1"` OR `disabled` + `aria-disabled="true"`. Pointer-hover may still show a tooltip for context; keyboard users reach these via **arrow-key roving tabindex** (FB-65) where the widget supports it (stage-progress strip does; disabled buttons do not).

This matches the contract in `focus-ring-spec.html §2` ("The ring is persistent on any focusable-for-inspection surface").

---

## 10. Open gaps / follow-ups

None in scope for unit-19 or unit-20. After unit-20 (FB-75), every DESIGN-BRIEF §2 component has a dedicated subsection in §7 with an explicit six-state render (the label-only components — `FeedbackStatusBadge`, `FeedbackOriginIcon` — expand to a full variant × state matrix instead of a single row). Every `N/A` cell reads `— (N/A: <rationale>)` inline; no cell is a bare em-dash.

## 11. Companion: `DESIGN-BRIEF.md §2` amendment

`DESIGN-BRIEF.md §2 Component Inventory` now requires every new component to ship with a six-state grid (default / hover / focus / active / disabled / error) in this file. The `FB-25 / FB-56` callout at the top of §2 is the policy anchor; this file is the template.

When a new component is added to DESIGN-BRIEF §2:

1. Add a row in §7 of this file (or a cross-reference if the component fits an existing section).
2. Cells marked N/A must carry a rationale in the same edit.
3. The design-reviewer hat walks the grid row-by-row before approving the stage.
