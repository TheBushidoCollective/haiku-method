# SPA UI Component Specs — Out-of-band Human File Modifications

*Authoritative spec for three new SPA surfaces introduced by the `out-of-band-human-file-modifications` intent. This document supersedes DESIGN-BRIEF.md wherever conflicts exist (see §0 below).*

---

## 0. Conflict Resolution — SPA-UI-SPECS.md is Authoritative

This spec was authored after the design direction was locked to **Direction A: discrete + autonomous classification** (recorded in `stages/design/decision_log.json` and mirrored in `knowledge/DESIGN-DECISIONS.md`). Four specific conflicts with DESIGN-BRIEF.md are resolved here:

1. **"Run now ↻" button** — DESIGN-BRIEF.md's Screen 3 sketches this button. It is **removed** from this spec. Per Direction A, the user does NOT trigger manual-change-assessment. Assessment fires on the next normal `haiku_run_next` tick automatically. No button, no link, no affordance for user-triggered assessment appears on any of the three surfaces.

2. **Raw Tailwind palette classes for drift-state styling** — DESIGN-BRIEF.md uses `bg-amber-50`, `text-amber-900`, etc. for drift state. This spec **replaces** those with CSS custom property references (`var(--color-drift-detected-bg)`, etc.) per the canonical token vocabulary in `knowledge/DESIGN-TOKENS.md`. Raw palette names are not used in any semantic surface.

3. **Deprecated provisional token names** — DESIGN-BRIEF.md references `--color-drift-bg`, `--color-drift-fg`, `--color-drift-stripe`. These are **deprecated**. The canonical four-state taxonomy from `knowledge/DESIGN-TOKENS.md` applies: `--color-drift-detected-fg/bg`, `--color-drift-acknowledged-fg/bg`, `--color-drift-surfaced-fg/bg`, `--color-drift-revisit-fg/bg`. No other drift-state tokens may appear in wireframes or implementation.

4. **`⋯` menu button `aria-label` string** — DESIGN-BRIEF.md Screen 2 uses `aria-label="Output actions for ${name}"`; an earlier draft of this spec used the generic `"More options for {artifact-name}"`. The canonical string is **`aria-label="Output actions for {artifact-name}"`** (interpolated per card with the actual artifact filename, e.g. `aria-label="Output actions for hero-mockup.html"`). The semantic "Output actions" — not the generic "More options" — is required because the menu's items are scoped to output-specific actions (replace this output, etc.) and screen-reader users need the category in the announcement. Implementations and wireframes MUST use this exact format string.

**Passive-observer constraint (Direction A):** All three surfaces are read-only indicators. They show what was detected and what the agent decided. They do NOT contain action buttons for classification, assessment triggers, accept/reject controls, or any control that drives the agent's workflow. The agent classifies autonomously on the next tick.

---

## 1. Knowledge Upload Panel

### 1.1 Placement and Structure

Lives inside `FeedbackSidebar` (LEFT column of `ReviewPage`) as a collapsible `<details>` section, positioned below the existing feedback list and above the composer, separated by a `border-t` hairline. On mobile (≤375px) the same content renders inside the existing `FeedbackSheet` as a sub-panel.

### 1.2 Design Tokens Used

| Token | Applied to |
|---|---|
| `--color-upload-affordance-fg` | Drop-zone dashed border, icon (UI-component scope, WCAG 1.4.11 3:1) |
| `--color-upload-affordance-label-fg` | Drop-zone text label (TEXT scope, WCAG 1.4.3 4.5:1) |
| `--color-upload-affordance-bg-resting` | Drop-zone background (resting — transparent) |
| `--color-upload-affordance-bg-hover` | Drop-zone background on pointer hover |
| `--color-upload-affordance-bg-dragover` | Drop-zone background during active file drag |
| `--color-feedback-pending-fg/bg` | Error-state text and backgrounds (reuse feedback pending token) |

No raw hex values. No raw Tailwind palette classes in semantic surfaces. All color references are CSS custom properties.

### 1.3 Interactive States

**Drop zone** (`role="button"`, `aria-label="Upload knowledge file"`)

| State | Border | Background | Label |
|---|---|---|---|
| Default (empty) | 2px dashed `var(--color-upload-affordance-fg)` | `var(--color-upload-affordance-bg-resting)` | "drop files or click to browse" (visible text — not a placeholder image) |
| Hover | 2px dashed `var(--color-upload-affordance-fg)` | `var(--color-upload-affordance-bg-hover)` | "drop files or click to browse" |
| Focus-visible | 2px dashed `var(--color-upload-affordance-fg)` + `outline: 3px solid var(--color-upload-affordance-fg)` + `outline-offset: 2px` | `var(--color-upload-affordance-bg-hover)` | "drop files or click to browse" |
| Dragover | 2px solid `var(--color-upload-affordance-fg)` | `var(--color-upload-affordance-bg-dragover)` | "Drop to stage" |
| Uploading | 2px dashed `var(--color-upload-affordance-fg)` | `var(--color-upload-affordance-bg-resting)` | progress bar replaces label; `aria-busy="true"` on the button |
| Uploaded | 2px solid `var(--color-upload-affordance-fg)` | `var(--color-upload-affordance-bg-resting)` | replaced by staged-file chip row |
| Error | 2px solid `var(--color-feedback-pending-fg)` | Transparent | Error text announced via `aria-live="polite"` region |
| Disabled | 2px dashed (opacity 40%) | Transparent | `cursor-not-allowed`; `aria-disabled="true"` |

**Upload button**

| State | Appearance |
|---|---|
| Default | `background: var(--accent-review)` (teal-600); white text |
| Hover | Darker shade (teal-700 family) |
| Focus-visible | `outline: 3px solid var(--accent-review)` at `outline-offset: 2px` |
| Active | Pressed (teal-800 family) |
| Disabled | Muted (stone-300/stone-700); `cursor-not-allowed`; `aria-disabled="true"` |
| Loading | "Uploading…" label + leading spinner; `aria-busy="true"` |
| Error | Resets to default; per-file error rows surface errors |

**Staged-file row**

| State | Appearance |
|---|---|
| Default | Transparent background |
| Hover | `bg-stone-50 dark:bg-stone-800/50` |
| Focus-visible | Focus ring on row |
| Active | `bg-teal-50/30 dark:bg-teal-900/10` |
| Disabled (during upload) | `opacity-70`; remove button hidden |
| Error | Left border 3px in `var(--color-feedback-pending-fg)`; error text below row |
| Loading | Spinner replaces file-type icon; "Uploading…" replaces size |
| Empty | Row does not render |

**Destination select**

| State | Appearance |
|---|---|
| Default | atoms.Input.tsx styling |
| Focus-visible | Focus ring on select |
| Disabled | When `staged.length === 0`; `opacity-60`; `aria-disabled="true"` |

### 1.4 ARIA Annotations (Required)

- Drop-zone element: `role="button"`, `tabIndex={0}`, `aria-label="Upload knowledge file"` (matches the spec verbatim — this exact string is required)
- Uploading state: `aria-busy="true"` on the drop-zone button; an adjacent `aria-live="polite"` region announces "Uploading {filename}" when upload begins
- Uploaded state: the same `aria-live="polite"` region announces "Uploaded {filename}"
- Error state: the `aria-live="polite"` region announces the error text
- Empty state (zero files staged): the visible label "drop files or click to browse" is rendered as real text, not a placeholder image
- Staged list: `role="list"`; each row `role="listitem"`; remove button `aria-label="Remove {file.name} from upload"`
- Keyboard activation: Enter and Space on the drop-zone trigger the hidden `<input type="file" multiple>` — same path as pointer click
- All interactive controls (caret, drop-zone, each row's remove, destination select, Upload, Cancel) are Tab-reachable in DOM order

### 1.5 Keyboard Tab Order

1. `<details>` summary (disclosure caret)
2. Drop zone button
3. First staged-file row's remove button (if staged files exist)
4. Second staged-file row's remove button
5. … (one entry per staged file)
6. Destination select
7. Upload button
8. Cancel button

### 1.6 Responsive Behavior

| Breakpoint | Layout |
|---|---|
| **375px (mobile)** | Panel renders inside `FeedbackSheet`. Drop zone collapses to a single `[ + Add files ]` full-width button (`height: 48px`) that opens the native file picker only — no drag-drop affordance (touch devices have no filesystem drag semantics). Staged list collapses to a single-line summary "N files staged · [view]" that expands to the full list on tap. Action buttons go full-width stacked. Every interactive element explicitly applies `.touch-target` to guarantee minimum 44×44 touch target. |
| **768px (tablet)** | Panel renders inline inside `FeedbackSidebar` when the sidebar is visible; otherwise inside `FeedbackSheet`. Drop zone `min-height: 128px`; drag-drop is enabled (tablets with trackpads). |
| **1280px (desktop)** | Full inline panel inside the LEFT sidebar. Drop zone `min-height: 120px` per DESIGN-TOKENS.md §2.1. All states visible simultaneously for demonstration. |

### 1.7 Touch Target Enforcement

The `.touch-target` utility (declared in `packages/haiku-ui/src/index.css` lines 94–112) MUST be applied to every interactive element at ≤768px breakpoints:
- Drop-zone button (`min-width: 44px; min-height: 44px`)
- Every staged-file row's `×` remove button (sub-44px visual; use `.touch-target--hit-area` to expand hit area without changing visual size)
- Destination select (ensure `height: 44px` at mobile)
- Upload button
- Cancel button

### 1.8 Reduced-Motion

The drag-over scale animation on the drop zone icon (scale 1.1 on dragover) MUST be suppressed under `prefers-reduced-motion: reduce`. The progress bar render (conveying state, not decoration) MUST remain. Toast slide-in MUST be replaced by immediate appearance under reduced-motion.

### 1.9 Empty State

When zero files are staged, the drop-zone is the only visible element below the disclosure header. The staged-file list region and the Upload/Cancel buttons are hidden. The drop zone shows "drop files or click to browse" as visible text — this is the empty state for the panel.

---

## 2. Stage Output Replacement Affordance

### 2.1 Placement and Structure

Augments existing artifact cards in the `StageReview` Outputs tab (`ArtifactsTab` in `StageReview.tsx`). A `⋯` menu button added to each card's header row. On hover/focus, `⋯` is revealed; on mobile it is always visible (touch devices have no hover). Clicking `⋯` opens a popover menu with "Replace this output…" as a new item. Selecting that item opens a modal dialog with a mime-constrained drop zone.

### 2.2 Design Tokens Used

**Card drift states (border-left accent)**

| Token | Applied to |
|---|---|
| `--color-drift-detected-fg` | Card left-border accent when drift is detected, awaiting classification |
| `--color-drift-acknowledged-fg` | Card left-border accent when drift was classified as `ignore` or `inline-fix` |
| `--color-drift-surfaced-fg` | Card left-border accent when drift was classified as `surface-as-feedback` |
| `--color-drift-revisit-fg` | Card left-border accent when drift was classified as `trigger-revisit` |
| `--color-upload-affordance-fg` | Modal drop-zone border and icon (UI-component scope, WCAG 1.4.11 3:1) |
| `--color-upload-affordance-label-fg` | Modal drop-zone text label (TEXT scope, WCAG 1.4.3 4.5:1) |
| `--color-upload-affordance-bg-resting` | Modal drop-zone resting background |
| `--color-upload-affordance-bg-hover` | Modal drop-zone hover background |
| `--color-upload-affordance-bg-dragover` | Modal drop-zone dragover background |

The `-fg` token variants are required for the 4px left-border accent because the `-bg` variants are near-white/near-surface and would render with less than 3:1 contrast against the card surface, failing WCAG 1.4.11 (Non-text Contrast) for UI components. The `-bg` variants are reserved for filled surfaces (badges, banners) where the contrast budget is spent on the text/icon foreground.

No raw hex values. No deprecated `--color-drift-bg/fg/stripe` tokens.

### 2.3 Card Drift States — Non-Color Signal Requirement (WCAG 1.4.1)

Each drift state MUST convey information via a non-color signal in addition to the border-accent color. Color alone does not satisfy WCAG 1.4.1.

| State | Border token | Non-color signal |
|---|---|---|
| Default (no drift) | None | No badge; card renders normally |
| drift-detected | `var(--color-drift-detected-fg)` | Icon badge with text label "Drift detected" (AlertTriangle icon + text, positioned in card footer) |
| drift-acknowledged | `var(--color-drift-acknowledged-fg)` | Icon badge with text label "Acknowledged" (CheckCircle icon + text) |
| drift-surfaced | `var(--color-drift-surfaced-fg)` | Icon badge with text label "Surfaced as feedback" (MessageSquare icon + text) |
| drift-revisit | `var(--color-drift-revisit-fg)` | Icon badge with text label "Revisit triggered" (RefreshCw icon + text) |

The badge text and icon are required in all cases — not optional. A color-blind user or screen reader user must be able to identify the drift state without the color signal.

### 2.4 `⋯` Menu Button — ARIA Requirements

The `⋯` button on each artifact card:
- `aria-label="Output actions for {artifact-name}"` — interpolated per card with the actual artifact filename (e.g. `aria-label="Output actions for hero-mockup.html"`). This is the canonical string per §0 conflict resolution #4 — DESIGN-BRIEF.md Screen 2 also uses this string.
- `aria-haspopup="menu"`
- `aria-expanded` reflects popover open/closed state

Without the interpolated `aria-label`, screen readers announce only "button" with no context. The "Output actions" prefix (vs the generic "More options") is required because the menu is scoped to output-specific actions; the per-card interpolation supplies the artifact filename.

Touch target: `.touch-target` MUST be applied to the `⋯` button at ≤768px. The visual element is sub-44px; `.touch-target--hit-area` expands the hit area.

### 2.5 Interactive States

**`⋯` menu trigger**

| State | Appearance |
|---|---|
| Default | Stone-400 icon, transparent background; hover-reveal on desktop (768px+), always-visible on mobile |
| Hover | Stone-100/Stone-800 background; icon darkens |
| Focus-visible | `outline: 3px solid var(--accent-review)` at `outline-offset: 2px` |
| Active / open | Stone-200/Stone-700 background; popover visible |
| Disabled | `opacity-50; cursor-not-allowed` |

**Popover menu**

| State | Appearance |
|---|---|
| Default | `shadow-lg`; white/stone-900 background; `border border-stone-200 dark:border-stone-700` |
| Item hover | Stone-100/stone-800 row highlight |
| Item focus | Focus ring on item |
| Item active | Stone-200/stone-700 |
| Closed | Hidden; focus returns to `⋯` trigger |

**Replace modal — drop zone**

All states from §1.3 Knowledge Upload drop zone, PLUS:

| Extra state | Appearance |
|---|---|
| Mime mismatch | `border-color: var(--color-feedback-pending-fg)`; text "Type mismatch: original is {mime}, dropped {dropped-mime}" (announced via `aria-live="assertive"` — blocking validation); confirm checkbox appears |
| Size info | Shows "+/- {delta}KB" beside the staged file size; informational only |

**Replace modal — note textarea**

| State | Appearance |
|---|---|
| Default | `font-mono text-sm`; placeholder "Optional — what changed and why? The agent will read this." |
| Focus-visible | Focus ring |
| Filled | `font-mono` text renders |
| Disabled (during submit) | `opacity-60` |
| Empty | Placeholder visible |

**Replace button**

| State | Appearance |
|---|---|
| Default | `background: var(--accent-review)` (teal); white text |
| Hover | Teal-700 |
| Focus-visible | Focus ring matching teal |
| Active | Teal-800 |
| Disabled | Muted stone; `cursor-not-allowed` when no replacement file staged OR mime mismatch unresolved |
| Loading | "Replacing…" + spinner; `aria-busy="true"` |
| Error | Error message above action row; button restores |

### 2.6 ARIA Annotations (Required)

- `⋯` trigger: `aria-label="Output actions for {artifact-name}"` (interpolated — canonical per §0 conflict resolution #4), `aria-haspopup="menu"`, `aria-expanded`
- Popover: `role="menu"`; items `role="menuitem"`; arrow-key navigation; Enter/Space activates; Esc closes and returns focus to `⋯` trigger
- Replace modal: native `<dialog>` element; `aria-labelledby` on dialog title; `aria-describedby` on dialog body; focus on open lands on drop zone; focus on close returns to `⋯` trigger
- Replace modal drop zone: `role="button"`, `tabIndex={0}`, `aria-label="Drop replacement file for {artifact-name}"` (interpolated per modal with the actual artifact filename, e.g. `aria-label="Drop replacement file for hero-mockup.html"`). This string is **distinct from** Screen 1's Knowledge Upload Panel drop zone (`aria-label="Upload knowledge file"`, §1.4) — the replace modal targets a specific stage output, not the knowledge directory, and screen-reader users must hear the action ("Drop replacement file") and the scope (the artifact filename) to avoid being misdirected. Implementations and wireframes MUST use this exact format string for the replace-modal drop zone and MUST NOT reuse Screen 1's `"Upload knowledge file"` label here.
- Mime-mismatch warning: `aria-live="assertive"` — interrupts immediately because it is a blocking validation
- Every state pairs an icon + text with color — never color alone

### 2.7 Keyboard Tab Order (modal)

1. Drop-zone button
2. Override-type dropdown (if mime mismatch triggered)
3. Note textarea
4. Cancel button
5. Replace button

Esc closes modal and returns focus to the `⋯` trigger at all times.

### 2.8 Responsive Behavior

| Breakpoint | Layout |
|---|---|
| **375px (mobile)** | `⋯` button always visible (no hover-reveal). Modal opens as fullscreen bottom sheet via the existing `FeedbackSheet` pattern (`width: 100vw; height: 100dvh`; slide-up animation). Thumbnail stacks above the drop zone vertically. Note textarea `min-height: 120px`. Cancel/Replace are a sticky bottom bar inside the sheet. Touch targets: `.touch-target` on all interactive elements. |
| **768px (tablet)** | `⋯` becomes hover-reveal (`opacity-0 group-hover:opacity-100` + `group-focus-within:opacity-100` for keyboard). Modal renders as centered `<dialog>` with `max-width: 560px`. |
| **1280px (desktop)** | `⋯` hover-reveal; dialog `max-width: 640px` centered with scrim. Thumbnail + drop zone side-by-side (2-column grid inside dialog body). |

### 2.9 Passive-Observer Constraint

The Replace dialog includes a **read-only informational notice** (not a checkbox the user can opt out of):

> "The next workflow tick will see this change and classify its impact."

This is not an "Accept fix" button. It is not a "Surface as feedback" button. It is not an "Ignore" button. It is not a "Run now" trigger. It is a static informational line that tells the user assessment is automatic. The replace action writes the file and stamps `human-via-mcp` author-class; the agent classifies on the next tick without user input.

### 2.10 Touch Target Enforcement

`.touch-target` MUST be applied to:
- `⋯` button (sub-44px visual; `.touch-target--hit-area` expands hit area at ≤768px)
- Every interactive element in the Replace modal (drop zone, confirm checkbox if visible, note textarea, Cancel, Replace)

---

## 3. Drift-Detected Indicator

### 3.1 Placement and Trigger Condition

Sticky strip mounted inside the main pane of `ReviewPage`, positioned between the existing `StageBanner` and `RereviewBanner`. Renders ONLY when the SPA's WebSocket feed signals `drift_detected === true` for the active stage (i.e. the pre-tick gate has observed SHA divergence and queued `manual_change_assessment`, but the next tick has not yet run). Disappears when the tick fires and `manual_change_assessment` completes. Never appears when there is no drift.

**Critical:** This surface has NO "Run now ↻" button, NO "Assess" link, NO "Accept", "Surface", or "Ignore" controls of any kind. It is purely informational. The user cannot trigger classification. Assessment runs on the next normal `haiku_run_next` tick automatically. This is the core of Direction A (locked decision).

### 3.2 Design Tokens Used

| Token | Applied to |
|---|---|
| `--color-drift-detected-fg` | Text color (title, body, entry paths) |
| `--color-drift-detected-bg` | Container background |

No raw hex values. No raw Tailwind palette classes in the semantic surfaces. No deprecated `--color-drift-bg/fg/stripe` tokens.

### 3.3 Content

Banner text (informational, not actionable):

> "**N file(s) changed since the last agent write** — assessment runs on the next tick"

Where N is the count of changed files. This is the full extent of the copy. No action language. No imperative ("click", "run", "trigger"). No buttons.

The strip carries a non-color icon (Clock or FileEdit — an icon that conveys "something changed, system is aware") alongside the text. This ensures the strip is distinguishable without color for color-blind users and screen readers.

### 3.4 Expanded Entry List (Optional)

A disclosure caret on the strip allows expanding a list of the changed files:

```
[▾ See N files]

  stages/design/artifacts/hero.html  modified 4m ago
  knowledge/brand-guide.pdf          added 12m ago
  stages/inception/notes.md          modified 18m ago
```

Each row is informational only:
- File path (monospace, truncated for long paths)
- Event type (modified / added / deleted)
- Relative timestamp
- No action buttons, no "view diff" links (the diff viewer is deferred per DESIGN-BRIEF.md § Design Gaps)

### 3.5 ARIA Annotations (Required)

- Strip container: `role="status"` and `aria-live="polite"` — screen readers announce the strip's appearance when it mounts without interrupting the current focus
- When the strip disappears (assessment completes), an empty live region (`aria-live="polite"`) remains in the DOM as `visibility: hidden` — this prevents abrupt focus loss for screen readers that track live regions
- Disclosure: `aria-expanded` + `aria-controls` on the toggle, wired to the entry list region
- The strip is placed BEFORE the tab content in DOM order so keyboard users encounter the system alert before drilling into stage content
- Entry rows: `<div>` non-interactive (they have no actions); no `role` needed; no focusable elements within
- The non-color icon (Clock or FileEdit) has `aria-hidden="true"` because the adjacent text conveys the same information; the icon is purely visual reinforcement

### 3.6 Interactive States

| State | Appearance |
|---|---|
| Default (drift present) | Full strip visible; `background: var(--color-drift-detected-bg)`; text `color: var(--color-drift-detected-fg)`; non-color icon present |
| Collapsed | Strip visible; entry list hidden |
| Expanded | Strip visible; entry list visible below |
| Loading (not applicable) | Strip is entirely passive — there is no loading state |
| Empty | Strip does NOT render when `drift_detected === false`. The component returns null. |
| Error (not applicable) | Passive observer — no error state; strip either shows (drift present) or doesn't (no drift) |

**Disclosure toggle**

| State | Appearance |
|---|---|
| Default | Text + chevron |
| Hover | Underline |
| Focus-visible | Focus ring (`outline: 3px solid var(--color-drift-detected-fg)` at `outline-offset: 2px`) |
| Active | `background: var(--color-drift-detected-bg)` with slight opacity increase |

### 3.7 Keyboard Tab Order

1. Disclosure toggle (▾ See N files / ▴ Hide files)
2. (No further focusable elements — strip is informational only)

### 3.8 Responsive Behavior

| Breakpoint | Layout |
|---|---|
| **375px (mobile)** | Strip full-width below stage banner. Summary line wraps to two lines if needed. Disclosure toggle sits below the summary text, left-aligned. Expanded entry rows: path drops to its own line, indented (`padding-left: 8px`); monospace `font-size: 11px`; timestamp below path. `.touch-target` on disclosure toggle (44×44 minimum). |
| **768px (tablet)** | Single-line summary if it fits; disclosure toggle right-aligned on the same row. Expanded rows go to 2 lines (path + event on line 1; timestamp on line 2, right-aligned). |
| **1280px (desktop)** | Full single-line strip with summary and disclosure toggle on the same row. Expanded entry rows on single lines. Banner uses the same `mx-6 lg:mx-10` horizontal gutter as the existing `StageBanner`. |

### 3.9 Reduced-Motion

The strip's appearance and disappearance MUST respect the `prefers-reduced-motion` guard already present in `packages/haiku-ui/src/index.css`. Under `prefers-reduced-motion: reduce`:
- Enter animation (if any fade-in or slide-in) clamps to 0.01ms (the existing global rule handles this automatically for Tailwind `transition-*` utilities)
- Exit animation similarly clamps
- The empty live region that remains in the DOM after disappearance is unaffected by motion — it is a DOM node, not an animation

If a custom `@keyframes` rule is authored for the strip's entrance, an explicit `@media (prefers-reduced-motion: reduce) { animation: none; }` override is required, matching the pattern already used for `feedback-fab-pulse`, `unit-flash`, `sheet-up`, and `backdrop-fade-in` in the existing CSS.

---

## 4. Cross-Cutting Requirements

### 4.1 Token Discipline

All three surfaces use CSS custom property references exclusively for semantic color. No raw hex values appear in any wireframe file. No raw Tailwind palette classes (`bg-amber-{50..900}`, `text-amber-*`, `border-amber-*`, or equivalents for other hues) appear in semantic color usage.

The rule: any color that communicates a semantic state (drift detected, acknowledged, surfaced, revisit, upload affordance) MUST be a `var(--token-name)` reference or a token-aliased Tailwind utility. Structural colors (stone-200 for hairline borders, stone-50 for hover backgrounds on neutral surfaces) may continue to use Tailwind palette classes per existing practice.

### 4.2 Touch Targets

Every pointer-activated control at ≤768px breakpoints applies `.touch-target` from `packages/haiku-ui/src/index.css`. This is non-negotiable. Special attention:
- The `⋯` menu button: sub-44px visual; MUST use `.touch-target--hit-area` to expand the hit area without changing visual size
- The `×` remove button in staged-file rows: same treatment
- The disclosure toggle in the drift strip: MUST meet 44×44 minimum (tap target is otherwise too small for reliable touch activation)

### 4.3 Focus Indicators (WCAG 2.4.7)

Every interactive element on every surface must render a clearly-visible focus indicator in the `:focus-visible` pseudo-class:
- Minimum `outline-width: 3px`, `outline-offset: 2px`
- The focus-ring color must achieve minimum 3:1 contrast against the adjacent background color
- The existing `ring-2 ring-teal-500 ring-offset-2` pattern from the review SPA is the standard; match it for all new controls

### 4.4 WCAG AA Contrast Table

The following token pairs are used in the new surfaces. Each has been verified against WCAG AA thresholds:

| Surface | Foreground token | Background token | Approx ratio (light) | Threshold | Pass? |
|---|---|---|---|---|---|
| Drift-detected text | `--color-drift-detected-fg` (amber-700 family, ~oklch 52% 0.18 80) | `--color-drift-detected-bg` (amber-50, ~oklch 97% 0.04 80) | ~5.2:1 | 4.5:1 (normal text) | PASS |
| Drift-acknowledged text | `--color-drift-acknowledged-fg` (green-700 family, ~oklch 51% 0.15 145) | `--color-drift-acknowledged-bg` (green-50, ~oklch 97% 0.04 145) | ~5.3:1 | 4.5:1 | PASS |
| Drift-surfaced text | `--color-drift-surfaced-fg` (blue-700 family, ~oklch 50% 0.18 240) | `--color-drift-surfaced-bg` (blue-50, ~oklch 97% 0.03 240) | ~5.4:1 | 4.5:1 | PASS |
| Drift-revisit text | `--color-drift-revisit-fg` (rose-700 family, ~oklch 50% 0.19 10) | `--color-drift-revisit-bg` (rose-50, ~oklch 97% 0.04 10) | ~5.1:1 | 4.5:1 | PASS |
| Upload affordance text | `--color-upload-affordance-label-fg` (teal-700 family, ~oklch 48% 0.16 185) | `--color-upload-affordance-bg-resting` (transparent → white) | ~5.2:1 | 4.5:1 (normal text — 13px/500 is below WCAG large-text threshold of ≥18pt regular or ≥14pt bold) | PASS |
| Upload affordance text on hover | `--color-upload-affordance-label-fg` (teal-700 family) | `--color-upload-affordance-bg-hover` (teal-500 at 8% opacity over white → near-white effective bg) | ~5.0:1 | 4.5:1 (normal text) | PASS |
| Upload affordance text on dragover | `--color-upload-affordance-label-fg` (teal-700 family) | `--color-upload-affordance-bg-dragover` (teal-500 at 15% opacity over white) | ~4.7:1 | 4.5:1 (normal text) | PASS |
| Upload affordance border / icon | `--color-upload-affordance-fg` (teal-500 family, ~oklch 62% 0.14 185) | `--color-upload-affordance-bg-resting` / `-hover` / `-dragover` | ~3.4:1 – 3.7:1 | 3:1 (WCAG 1.4.11 — graphical UI-component boundaries; not text) | PASS |
| Knowledge-upload count-chip text | `oklch(100% 0 0)` (white) | `--color-upload-affordance-chip-bg` (teal-700 family, ~oklch 45% 0.14 185) | ~4.6:1 | 4.5:1 (10px / 600 weight is below the 14pt-bold large-text threshold) | PASS |
| Drift-detected badge text | `--color-drift-detected-fg` | `--color-drift-detected-bg` | ~5.2:1 | 4.5:1 | PASS |
| Drift-acknowledged badge text | `--color-drift-acknowledged-fg` | `--color-drift-acknowledged-bg` | ~5.3:1 | 4.5:1 | PASS |
| Drift-surfaced badge text | `--color-drift-surfaced-fg` | `--color-drift-surfaced-bg` | ~5.4:1 | 4.5:1 | PASS |
| Drift-revisit badge text | `--color-drift-revisit-fg` | `--color-drift-revisit-bg` | ~5.1:1 | 4.5:1 | PASS |

Note: Exact OKLCH-to-sRGB conversion and precise contrast ratios must be verified by the development stage using the defined token values from `packages/haiku-ui/src/index.css`. The ratios above are computed from the palette anchors documented in `knowledge/DESIGN-TOKENS.md` §1.3.2 and §1.3.4.

**No opacity reductions on token-pair text.** All ratios in this table assume full-opacity foreground tokens. Implementations MUST NOT apply `opacity:` (e.g. `opacity: 0.7`, `opacity: 0.85`) to text rendered with these foreground tokens — opacity blends the foreground toward the background and invalidates the ratios. If a muted/secondary text variant is needed, use the `color-mix(in oklch, …)` pattern documented in `knowledge/DESIGN-TOKENS.md` §1.3.4 to derive a darker foreground (mix toward black, not toward the background) and verify the resulting ratio against the applicable threshold (4.5:1 for normal text, 3:1 for ≥18px or ≥14px-bold large text). Visual hierarchy between title and body text MUST be carried by `font-size`, `font-weight`, and spacing — never by transparency.

### 4.5 Reduced-Motion Summary

Three motion behaviors are introduced by this intent:

1. **Knowledge Upload drop-zone drag-over**: Icon scale animation (1.1 on dragover) → suppressed under `prefers-reduced-motion: reduce`; border color transition remains (conveys state, not decoration).
2. **Drift-Detected Indicator enter/exit**: Any fade/slide animation → clamped to 0.01ms by the existing global guard; the empty live region stays in DOM regardless.
3. **Replace dialog enter**: Modal slide-up → already handled by the existing `sheet-up` reduced-motion pattern.

All other state transitions (border color, background color) use Tailwind `transition-colors duration-150` which is automatically clamped by the global guard.

### 4.6 Passive-Observer Constraint (All Three Surfaces)

No surface introduced by this spec contains any of the following:
- "Run now" button or link
- "Assess" button or link
- "Accept fix" button
- "Surface as feedback" button
- "Ignore" button
- Any other control that triggers or influences the agent's `manual_change_assessment` classification

The user's only interaction with these surfaces is informational viewing (reading what was detected, reading what was classified). The agent classifies autonomously on the next `haiku_run_next` tick. This is the Direction A (discrete + autonomous classification) constraint, locked in the design-stage decision register.

### 4.7 Consistency with ARCHITECTURE.md

Every UI signal in this spec corresponds to a known classification outcome or baseline state defined in `stages/design/artifacts/ARCHITECTURE.md`:

| UI state | Architecture reference |
|---|---|
| Drift strip visible | §3 gate emits drift events; `manual_change_assessment` queued |
| Drift strip gone | §4 action completed; assessment record written to `drift-assessments/DA-{NN}.json` |
| Card state: drift-detected | Finding in `DA-{NN}.json`; baseline not yet updated (non-terminal or awaiting) |
| Card state: drift-acknowledged | §4.4.1 (`ignore`) or §4.4.2 (`inline-fix`); baseline updated to current SHA |
| Card state: drift-surfaced | §4.4.3 (`surface-as-feedback`); pending-assessment marker written; FB item created |
| Card state: drift-revisit | §4.4.4 (`trigger-revisit`); revisit initiated; pending marker written |
| No "Run now" button | §4.1: action is autonomous; "There are no user-facing confirmation buttons or Accept/Reject controls for this action" |
| Upload stamps `human-via-mcp` | §6.1 author-class taxonomy; §7.3 SPA upload timing |
| No classification preview on upload | §7.3: "endpoint deliberately leaves the file's baseline entry stale so that the next pre-tick drift-detection gate observes the SHA divergence" |

---

## 5. Empty States

| Surface | Empty state |
|---|---|
| Knowledge Upload Panel | Drop zone shows "drop files or click to browse" visible text; staged-file list region hidden; Upload/Cancel hidden |
| Stage Output Replacement modal | Drop zone shows "drop a file matching {original-mime}" where {original-mime} is the actual MIME type of the artifact being replaced |
| Drift-Detected Indicator | Component returns null and is not mounted when `drift_detected === false`; the empty `aria-live="polite"` region remains in the DOM as `visibility: hidden` |

---

## 6. Architecture References and Self-Consistency

This spec is internally consistent with Direction A as recorded in the design-stage decision register. It is internally consistent with ARCHITECTURE.md §4.1 ("the action is autonomous — there are no user-facing confirmation buttons"). It explicitly supersedes DESIGN-BRIEF.md on the three named conflicts documented in §0. All token references use the canonical four-state taxonomy from DESIGN-TOKENS.md §1.3.2.
