# Design Tokens — Out-of-band Human File Modifications

This document defines the semantic design tokens that the design stage and all downstream stages (development, review, delivery) must use when speccing or building any user-visible surface introduced by this intent. Raw color, spacing, type, radius, shadow, or motion values must NOT appear in unit specs, component code, or documentation; every visual property is referenced by token name.

## Scope and existing-system anchoring

This intent extends the H·AI·K·U review/browse SPA (`packages/haiku-ui`) and the website docs (`website/`). Both surfaces already ship a comprehensive Tailwind v4 token system with OKLCH-based color primitives, semantic feedback/origin/status aliases, container layout tokens, touch-target helpers, and reduced-motion guards.

**This token document does NOT replace the existing system.** It extends it with *new semantic aliases* specific to the out-of-band-human-edits domain (drift detection, classification outcomes, human-attributed writes, baseline state, manual-change-assessment view). All numeric primitives (color scales, spacing scale, type scale, radii, shadow elevations, transition durations) referenced here are the tokens already defined in:

- `packages/haiku-ui/src/index.css` (`@theme` block — Tailwind v4 native, the canonical SPA token surface)
- `packages/haiku-ui/tailwind.config.ts` (safelist + content scanning for runtime-interpolated classes)
- `website/app/globals.css` (`@theme` block — website-side stone/teal/indigo/amber/rose primitives)

**If you find yourself needing a primitive that doesn't exist in the canonical surface, that is a signal — surface it as a question to the design stage rather than authoring a parallel scale here.** A second scale would force downstream stages to choose, which is exactly the gap this document is meant to close.

The following sections name *new semantic tokens* this intent requires, plus the existing tokens that downstream work must reuse for the touched surfaces.

---

## 1. Color Tokens

### 1.1 Palette primitives (existing — REUSE)

The canonical palettes are stone (neutrals), teal (accent + status-ok), indigo (informational accent), amber (warning + highlight), rose (annotation + adversarial), red (error), green (success), blue (active comment + addressed-feedback). All are defined as OKLCH primitives in `globals.css` and consumed via Tailwind utility classes. Downstream work consumes them by Tailwind class name (e.g. `bg-stone-100`, `text-rose-600`) — never by hex literal, never by raw OKLCH coordinates.

The dark-mode pair convention is also established: every light-mode utility has a `dark:` counterpart (e.g. `bg-stone-100 dark:bg-stone-800`). New tokens defined below MUST ship with the dark-mode pair.

### 1.2 Semantic aliases (existing — REUSE in touched surfaces)

These already exist and the new SPA surfaces (stage output upload, knowledge upload, drift assessment view) must reuse them rather than authoring parallel tokens:

- **Feedback statuses** — `--color-feedback-pending-fg/bg`, `--color-feedback-addressed-fg/bg`, `--color-feedback-closed-fg/bg`, `--color-feedback-rejected-fg/bg`. The drift assessment view's "surface-as-feedback" classification outcome must use the pending/addressed/closed states for any feedback artifact it renders, rather than inventing a parallel set.
- **Origin badges** — `--color-origin-adversarial-fg/bg`, `--color-origin-external-fg/bg`, `--color-origin-user-fg/bg`, `--color-origin-agent-fg/bg`. These already distinguish authorship in the FB system; this intent introduces a fifth origin (human, out-of-band) and extends this set in §1.3 below.
- **Annotation pin** — `--color-annotation-pin-bg/fg/selected-outline`. Reused for any drift-assessment-view pin or marker that points to a changed line in a diff.
- **Inline highlight** — `--color-highlight` (amber-400). Reused for diff-line highlights in the drift-assessment view.
- **Active comment / hover tint** — `--color-comment-active` (blue-500). Reused for active-row hover in the drift-assessment view's list of recent drift events.
- **Pulse ring** — `--color-pulse-ring` (teal-600). Reused for any "drift detected, awaiting classification" subtle-attention affordance (one-shot pulse, not steady).
- **Scrim** — `--color-scrim`. Reused for any modal that the drift-assessment view introduces (e.g. "view full diff" overlay).
- **Sheet surface dark** — `--color-sheet-surface-dark` (stone-900). Reused for any new full-screen sheet (mobile drift-assessment view).

### 1.3 New semantic aliases (THIS INTENT)

These are the new semantic tokens this intent introduces. They MUST be added to the `@theme` block of `packages/haiku-ui/src/index.css` and made available as Tailwind utilities (`bg-…`, `text-…`, `border-…`).

**1.3.1 Out-of-band-human-write origin badge**

A fifth origin alongside the existing four. Used wherever the SPA renders authorship attribution for a write event (drift assessment view, file metadata in stage output area, chat acknowledgment after the human-attributed-write MCP tool fires).

| Token name | Light mode (palette anchor) | Dark mode (palette anchor) | Usage |
|---|---|---|---|
| `--color-origin-human-fg` | `oklch(45% 0.16 295)` (violet-600 family) | `oklch(78% 0.12 295)` (violet-300 family) | Foreground: badge text, icon stroke |
| `--color-origin-human-bg` | `oklch(95% 0.025 295)` (violet-50/100 family) | `oklch(28% 0.06 295)` (violet-900/40) | Background: badge fill |

Rationale: violet sits between the existing `origin-external` (violet-292 family) and `origin-user` (sky-232 family) in hue but is visually distinguishable from both. Avoid red/orange (reserved for adversarial / warning) and avoid green (reserved for closed/success). The "human, out-of-band" origin is meaningfully different from both the existing user-chat-origin and the agent-origin — it's a write that the agent didn't author and the user didn't announce in chat.

**1.3.2 Drift-state colors (manual-change-assessment lifecycle)**

The drift-detection gate emits findings; the agent classifies them; the human reviews the classification in the SPA. This is a four-state lifecycle that needs its own semantic vocabulary.

| Token name | Palette anchor | Maps to lifecycle state |
|---|---|---|
| `--color-drift-detected-fg` / `-bg` | amber-700 / amber-50 (light), amber-300 / amber-900-40 (dark) | Drift observed by gate, awaiting agent classification |
| `--color-drift-acknowledged-fg` / `-bg` | green-700 / green-50, green-300 / green-900-40 | Classified `ignore` or `inline-fix` (terminal — baseline updated) |
| `--color-drift-surfaced-fg` / `-bg` | blue-700 / blue-50, blue-300 / blue-900-40 | Classified `surface-as-feedback` (non-terminal — pending FB resolution) |
| `--color-drift-revisit-fg` / `-bg` | rose-700 / rose-50, rose-300 / rose-900-40 | Classified `trigger-revisit` (non-terminal — pending revisit completion) |

Rationale: the four classification outcomes mirror the existing feedback-status palette intentionally. `acknowledged` mirrors `closed` (green family — done and quiet), `surfaced` mirrors `addressed` (blue family — handed off to another channel), `revisit` mirrors `pending` (rose family — work to do, attention required). `detected` (amber, pre-classification) does not map to any existing state; it's the only color genuinely new to the system. Reusing the green/blue/rose hues from the FB palette is *deliberate*: a drift event that becomes feedback ends up rendered with the same color as that feedback, so the user sees visual continuity between "I edited this" and "the agent surfaced my edit as feedback."

**1.3.3 Baseline-state indicator**

A small, subtle indicator next to a file in the stage output area that signals whether the file is at-baseline (agent-acknowledged) or has-drift (changed since last baseline). Used in the per-stage file list, never as a primary affordance.

| Token name | Palette anchor | Meaning |
|---|---|---|
| `--color-baseline-clean-fg` | stone-400 (light) / stone-500 (dark) | At baseline — no drift detected on most recent tick |
| `--color-baseline-drift-fg` | amber-500 (light) / amber-400 (dark) | Drift detected, classification pending |
| `--color-baseline-stale-fg` | stone-300 (light) / stone-600 (dark) | Baseline-establishment mode (first tick after upgrade — file is being recorded, not assessed) |

Rationale: stone-on-stone for the clean state keeps it visually quiet (the common case should not draw attention). Amber for drift-pending matches `--color-drift-detected-fg`. A muted stone for stale baselines signals "tracked but not yet evaluated" without alarming the user — this state exists only briefly after upgrade.

**1.3.4 Upload-affordance accent**

The SPA upload UI for stage outputs and knowledge directory needs a primary accent that visually distinguishes "this is an upload control" from the rest of the SPA chrome. Reuse the existing `--accent-review` (teal-500) family rather than introducing a new accent — the upload affordance and the review affordance share the same visual weight in the user's mental model ("I am taking action on this stage").

| Token name | Maps to existing | Notes |
|---|---|---|
| `--color-upload-affordance-fg` | `--accent-review` (teal-500, ~oklch 62% 0.14 185 light / ~oklch 72% 0.12 185 dark) | Border, icon — UI-component scope, WCAG 1.4.11 (Non-text Contrast) 3:1 threshold |
| `--color-upload-affordance-label-fg` | teal-700 family (~oklch 48% 0.16 185 light / ~oklch 82% 0.11 185 dark) | Drop-zone text label — TEXT scope, WCAG 1.4.3 (Contrast Minimum) 4.5:1 threshold (~5.2:1 against white in light mode, ~5.4:1 against `--surface-bg` in dark mode) |
| `--color-upload-affordance-bg-resting` | `transparent` | Resting state is empty / dashed-border-only |
| `--color-upload-affordance-bg-hover` | teal-500 at 8% opacity (`color-mix(in oklch, var(--color-upload-affordance-fg), transparent 92%)`) | Hover state |
| `--color-upload-affordance-bg-dragover` | teal-500 at 15% opacity | File-drag-over state (dropzone active) |

Rationale: explicit aliasing to `--accent-review` documents the design intent (upload === a deliberate workflow action in the same family as approve/request-changes), so a future accent-color swap propagates correctly. The label foreground is a separate token because text and UI-component graphics have different WCAG thresholds (4.5:1 vs 3:1) — a single token cannot satisfy both at the same accent saturation. The label token darkens the same hue (teal-700 family) so the visual identity stays in the teal family while text contrast meets WCAG AA 1.4.3 for normal-sized text (13px / weight 500 is below the large-text threshold of ≥18pt regular or ≥14pt bold).

### 1.4 Color-token usage rules (CRITICAL)

- **All downstream stages MUST reference tokens by name**, never by Tailwind palette class for *new* semantic surfaces. For existing utility classes (`bg-stone-100`, `text-teal-500`, etc.) that already work in the codebase, continue to use them — they are the consumption layer for the primitives.
- **Never use raw hex.** The codebase has zero raw hex outside the `@theme` and `globals.css` token definition blocks; this intent does not change that.
- **Never invent a new palette family.** If the design needs a hue not in the existing seven (stone / teal / indigo / amber / rose / red / green / blue / violet-as-of-this-doc / sky), surface it as a design-stage question rather than authoring it.
- **Always pair light + dark.** No token may exist without its dark-mode counterpart. The `dark:` variant convention is consumed by `@custom-variant dark (&:where(.dark, .dark *))` already in place.
- **Use `color-mix(in oklch, …)` for opacity-derived states**, not new hex tokens. The existing system uses this pattern consistently (see §1.3.4 above and `index.css` lines 207–245); new tokens must too.

---

## 2. Spacing Scale (existing — REUSE)

The Tailwind v4 default spacing scale is the canonical scale: `0`, `0.5` (2px), `1` (4px), `1.5` (6px), `2` (8px), `2.5` (10px), `3` (12px), `4` (16px), `5` (20px), `6` (24px), `8` (32px), `10` (40px), `12` (48px), `16` (64px), `20` (80px), `24` (96px). These map to Tailwind utilities (`p-2`, `gap-4`, `m-6`, etc.).

### 2.1 Specific spacing tokens for new surfaces

The drift-assessment view and the upload affordances follow the same density rules already established for the FB sidebar and the review panel:

- **Card padding** — `p-4` (16px) all sides for drift-event cards in the assessment view, matching feedback-card padding in the existing SPA.
- **List-item gap** — `gap-2` (8px) between consecutive drift-event cards in the assessment list, matching the FB list density.
- **Section gap** — `gap-6` (24px) between distinct sections within the drift assessment view (e.g., "Pending classifications" / "Recently classified" / "Acknowledged baseline").
- **Inline-control gap** — `gap-1.5` (6px) between an icon and its adjacent text in any badge, button, or origin marker. Established convention in the FB-card and origin-badge components.
- **Upload dropzone padding** — `p-6` (24px) interior padding to give the dashed-border affordance enough breathing room to read as a deliberate target rather than a bordered text box.
- **Dropzone min-height** — `min-h-[120px]` for the stage-output and knowledge-upload dropzones, so an empty dropzone is recognizable as a target without dominating the page.

### 2.2 Container tokens (existing — REUSE)

The intent surfaces (drift assessment view, upload affordances) live inside the existing SPA layout. They MUST consume the existing container tokens, not invent new ones:

- `--sidebar-width` (20rem) — sidebar at default width
- `--sidebar-width-xl` (24rem) — sidebar at xl breakpoint and up
- `--content-max` (1400px) — main content max-width
- `--header-height` (53px) — sticky header offset, consumed via `top-[var(--header-height)]` for any new sticky element

The drift assessment view, when implemented as a full-page route, MUST honor `--content-max`. When implemented as a sidebar panel within an existing intent overview, it MUST consume `--sidebar-width` / `--sidebar-width-xl`. No new container width is introduced by this intent.

### 2.3 Touch targets (existing — REUSE; CRITICAL)

The existing 44×44 touch-target convention from `index.css` lines 94–112 (`.touch-target`, `.touch-target--hit-area`) is non-negotiable for every pointer-activated control this intent introduces:

- The upload affordance click/tap target is 44×44 minimum, even when the visual icon is smaller.
- Per-row "view diff" / "view classification" controls in the drift assessment list are 44×44 minimum.
- The "trigger tick" affordance (if added in v1) is 44×44.
- The "view human-attributed write history" disclosure in chat acknowledgments is 44×44.

The `.touch-target` and `.touch-target--hit-area` helper classes in `index.css` are the canonical mechanism. Do not author parallel min-height/min-width Tailwind utilities; use the helper class.

---

## 3. Typography Scale (existing — REUSE)

The font stack and type scale are established. Downstream work consumes them via Tailwind utilities, not raw values.

### 3.1 Font stack (existing)

- **Sans** — `Inter, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` (defined as `--font-sans` in `globals.css`)
- **Mono** — `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` (defined as `--font-mono`)

### 3.2 Type scale (existing — Tailwind v4 defaults)

| Tailwind class | Size / line-height | Typical usage in this intent |
|---|---|---|
| `text-xs` | 12px / 16px | Drift-event timestamps, file-path metadata in assessment list |
| `text-sm` | 14px / 20px | Drift-event body, classification rationale, upload-affordance label |
| `text-base` | 16px / 24px | Default body text in the drift assessment view |
| `text-lg` | 18px / 28px | Drift-event card title (e.g. "Layout replaced") |
| `text-xl` | 20px / 28px | Section headers within the drift assessment view |
| `text-2xl` | 24px / 32px | Page heading for full-page drift assessment route |

### 3.3 Font weights (existing)

- `font-normal` (400) — body, prose, default text
- `font-medium` (500) — labels, button text, badge text
- `font-semibold` (600) — section headers, emphasized body
- `font-bold` (700) — page titles, the rare in-text emphasis (avoid)

### 3.4 Code/diff display

Drift detection produces unified-diff payloads for text files. These MUST be displayed in the SPA using the existing prose-overrides convention from `globals.css`:

- Inline code: `text-sm` mono in `bg-stone-100 dark:bg-stone-800` rounded container (existing `.prose code:not(pre code)` rule)
- Diff blocks: `text-sm` mono in `bg-stone-900 dark:bg-stone-800` block container with `overflow-x-auto` and rounded corners (existing `.prose pre` rule, with line-prefix coloring layered on top — see §1.3.2 colors for added/removed line tints)

The diff-line coloring, when added on top of the existing prose pre styling, uses the drift-state palette from §1.3.2:
- Added line background: `bg-green-500/10` (light) / `bg-green-400/15` (dark)
- Removed line background: `bg-red-500/10` (light) / `bg-red-400/15` (dark)
- Context line background: transparent (inherits)

### 3.5 Documentation typography (website)

The website uses `@plugin "@tailwindcss/typography"` and the `.prose` class chain. New website docs introduced by this intent (the new "Out-of-band Human Edits" doc and extensions to Concepts / Workflows / Operating Modes) MUST use the existing `.prose` class. Do not author new typography utilities for the new doc.

---

## 4. Border Radii (existing — REUSE)

The Tailwind v4 default radii scale is canonical:

| Tailwind class | Value | Usage in this intent |
|---|---|---|
| `rounded-none` | 0 | Inline diff lines (full-bleed within their container) |
| `rounded-sm` | 2px | Small inline tags |
| `rounded` | 4px | Default for non-pill badges |
| `rounded-md` | 6px | Code-block inner radius (matches `.comment-entry` convention from `index.css`) |
| `rounded-lg` | 8px | Cards, dropzone container, prose `pre` |
| `rounded-xl` | 12px | Drift-event cards in the assessment view (matches feedback-card radius from companion design system) |
| `rounded-full` | 50% | Origin badges (pill shape), annotation pins, status dots |

### 4.1 Specific radius rules

- **Drift-event cards** — `rounded-xl` (12px). Matches the feedback-card visual weight, since drift events become a sibling artifact category.
- **Origin badges** (including the new `human` origin from §1.3.1) — `rounded-full`. Matches the existing origin-badge pill shape exactly.
- **Upload dropzones** — `rounded-lg` (8px) with a `border-2 border-dashed` accent. Standard convention for file-drop affordances in the larger ecosystem; consistent with the existing review-app card chrome.
- **Diff blocks** — `rounded-lg` (8px). Inherits from existing prose `pre` rule.

---

## 5. Shadow / Elevation Tokens

### 5.1 Existing shadow tokens (REUSE)

The codebase uses Tailwind's default shadow scale plus two semantic shadows defined in `index.css`:

- `--color-shadow-soft` (oklch(0% 0 0 / 0.3)) — used for annotation-pin drop shadow (`box-shadow: 0 2px 6px var(--color-shadow-soft)`)
- The default `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl` scale from Tailwind for general-purpose elevation

### 5.2 Elevation usage rules for this intent

| Surface | Shadow token | Rationale |
|---|---|---|
| Drift-event card (resting) | `shadow-sm` | Sits on the same surface as feedback cards; matches their resting elevation |
| Drift-event card (hover) | `shadow-md` | Lifts on hover to indicate interactivity, same as FB-card hover convention |
| Upload-affordance dropzone (resting) | `shadow-none` | Dashed border is the affordance, not elevation |
| Upload-affordance dropzone (drag-over) | `shadow-md` | Lifts on drag-over to confirm "drop here" recognition |
| "View full diff" modal | `shadow-2xl` | Modal overlay convention — matches the existing FeedbackSheet modal weight |
| Origin-badge `human` (new) | `shadow-none` | Matches existing origin-badge convention (no elevation; flat pill) |

### 5.3 No new shadow primitives

This intent does NOT introduce new shadow primitives. The existing scale plus the existing `--color-shadow-soft` cover every elevation moment in the new surfaces. If a future component spec needs a non-default shadow color (e.g. a teal-tinted glow for "tick imminent"), it should be added to the `@theme` block as a documented exception, not as a new tier in a parallel scale.

---

## 6. Animation / Transition Tokens

### 6.1 Existing motion guarantees (REUSE; CRITICAL)

The codebase has a non-negotiable global reduced-motion guard at `index.css` lines 124–137 that clamps `animation-duration` and `transition-duration` to 0.01ms under `prefers-reduced-motion: reduce`. **Every animation and transition introduced by this intent MUST respect this guard** — meaning either:

- Use a Tailwind-default `transition-*` utility (e.g. `transition-colors duration-150`), which is automatically clamped, OR
- Author a `@keyframes` rule and provide an explicit `@media (prefers-reduced-motion: reduce) { animation: none; }` override (the same pattern used for `feedback-fab-pulse`, `unit-flash`, `sheet-up`, `backdrop-fade-in` in the existing CSS).

No exceptions.

### 6.2 Standard transition tokens (existing — REUSE)

The codebase establishes these conventions:

| Use case | Duration | Easing | Properties |
|---|---|---|---|
| Theme switch (html bg/color) | 200ms | default | `background-color`, `color` |
| Card border/bg hover | 150ms | default | `border-color`, `background-color` |
| Annotation-pin scale on hover | 100ms | default | `transform` |
| FeedbackSheet open | 300ms | `ease-out` | `transform` (slide-up) |
| FeedbackSheet backdrop fade | 150ms | `ease-out` | `opacity` |
| Drift-pulse / unit-flash | 1200ms | `ease-out` (one-shot) | `box-shadow`, `outline` |
| Drift-fab pulse | 2000ms | `ease-in-out` (3 iterations) | `box-shadow` |

### 6.3 New motion behavior introduced by this intent

| Surface | Behavior | Tokens |
|---|---|---|
| Upload dropzone drag-over | Border thickens + bg fades in | `transition-colors duration-150`, `transition-[border-width] duration-100` |
| Drift-event card hover | Shadow lifts + border darkens | `transition-shadow duration-150`, `transition-colors duration-150` |
| New drift detected (post-tick) | One-shot pulse (teal) on the affected file's row in the stage output area | Reuse `feedback-fab-pulse` keyframes via a new class `.drift-detected-pulse` that aliases the same animation but with `--color-pulse-ring` swapped (no swap needed if teal is acceptable; if a distinct color is needed, add `--color-drift-pulse-ring` per §1.3.2 amber palette and parameterize the keyframe) |
| Classification recorded (post-action) | Brief opacity flash (`feedback-status-changed`) on the row that just got classified | Reuse the existing `.feedback-status-changed` class verbatim — it already drops to `animation: none` under reduced-motion, and the visual semantics ("this row's status changed") are identical |
| Chat acknowledgment of human-attributed write | No motion. Static append to the chat surface; the existing chat scroll behavior handles arrival | N/A |

### 6.4 Motion-token rule

**Reuse before authoring.** The existing keyframes (`feedback-fab-pulse`, `unit-flash`, `feedback-status-change`, `sheet-up`, `backdrop-fade-in`) already cover every motion moment this intent needs. The single new keyframe candidate is `.drift-detected-pulse`, and even that is structurally identical to `feedback-fab-pulse` — design should consider parameterizing the existing keyframe via a CSS custom property rather than authoring a fifth pulse keyframe.

---

## 7. Documentation: token-to-usage map

The following table documents every new token introduced by this intent and where it appears in user-visible surfaces. Downstream stages MUST consult this map before authoring component specs.

| Token | Where it appears | What it communicates |
|---|---|---|
| `--color-origin-human-fg` / `-bg` | Origin badge wherever a write event is rendered (drift assessment view, chat acknowledgment, file metadata in stage output area) | "This file was written via an out-of-band human path (filesystem, SPA upload, or chat-instructed agent-write)" |
| `--color-drift-detected-fg` / `-bg` | Pre-classification drift events in the assessment list | "Drift observed; agent has not yet classified" |
| `--color-drift-acknowledged-fg` / `-bg` | Drift events classified as `ignore` or `inline-fix` | "Drift seen, baseline updated, no further action" |
| `--color-drift-surfaced-fg` / `-bg` | Drift events classified as `surface-as-feedback` | "Drift seen, lives on as a feedback item — see FB list" |
| `--color-drift-revisit-fg` / `-bg` | Drift events classified as `trigger-revisit` | "Drift seen, intent has revisited — see active stage" |
| `--color-baseline-clean-fg` | File-row indicator in stage output area | "At baseline, no drift" (low visual weight — the common case) |
| `--color-baseline-drift-fg` | File-row indicator in stage output area | "Drift detected since last tick" |
| `--color-baseline-stale-fg` | File-row indicator (only during baseline-establishment) | "Tracked, baseline being recorded — first tick after upgrade" |
| `--color-upload-affordance-fg` | Upload dropzone border, icon (UI-component) | "Click or drop file to upload" |
| `--color-upload-affordance-label-fg` | Upload dropzone text label (text scope, 4.5:1) | "Click or drop file to upload" |
| `--color-upload-affordance-bg-resting` / `-hover` / `-dragover` | Upload dropzone background | Resting = empty / Hover = invitational / Drag-over = "drop will succeed" |

---

## 8. Quality Signals — self-check

- [x] **All downstream stages will use token names, never raw values** — the rules in §1.4 and §6.4 are explicit about this. Every numeric value referenced in this document maps to a named token (existing or newly defined).
- [x] **Token names are semantic** — origins are named by author class (`human`, `agent`, `user`, `external`, `adversarial`), drift states are named by lifecycle position (`detected`, `acknowledged`, `surfaced`, `revisit`), upload affordances are named by interaction state (`resting`, `hover`, `dragover`). No `color-violet-600` style names.
- [x] **The scale is consistent and complete** — all new tokens slot into the existing eight-state lifecycle (4 feedback + 4 origin + this doc's additions). No gaps that would force a downstream stage to use a raw value.
- [x] **Tokens are documented with intended usage context** — §7 maps every new token to its surface and its communicated meaning. Existing tokens reused are pointed back to their canonical source files (`index.css`, `globals.css`, `tailwind.config.ts`).
- [x] **The existing system is extended, not replaced** — every numeric primitive (color, spacing, type, radius, shadow, motion) is sourced from the canonical surface. New aliases are layered on top.
- [x] **Both light and dark mode are covered** — every new color token has a light/dark pair per §1.4.
- [x] **Reduced-motion is respected** — §6.1 states the rule and §6.3 explicitly references existing reduced-motion-aware keyframes.
- [x] **Touch targets are honored** — §2.3 names every new pointer-activated control and applies the existing 44×44 helper.

---

## 9. Context Boundaries (sibling-axis depends-on)

This artifact is one of two design-stage discovery artifacts being authored in parallel. The other is `DESIGN-BRIEF.md` (sibling subagent). Cross-cutting items below are noted here so they're not lost if the sibling artifact misses them; the sibling owns the substance.

- **SPA component architecture** (depends on design-brief artifact) — the drift assessment view, upload affordances, and chat acknowledgment surface are referenced throughout this document by their *visual role*. The actual component decomposition (atoms / molecules / organisms / pages structure within `packages/haiku-ui/src/`) and the integration points with the in-flight `origin/haiku/remote-review-spa/main` branch are the design-brief artifact's territory. This token document assumes those components will exist; it does not name them.
- **MCP tool naming and integrity stance** (depends on inception's open Decision 9 — Human-Write-Path Integrity) — the chat acknowledgment of a human-attributed write uses `--color-origin-human-fg`/`-bg`, but whether the user must explicitly confirm the write before it lands (and therefore whether there is an additional confirmation-modal surface that needs tokens) is open at design. If the design stage chooses "explicit human confirmation required," a confirmation modal will need scrim + sheet tokens — both already exist in §1.2 (`--color-scrim`, `--color-sheet-surface-dark`) and require no new additions to this document.
- **Diff payload format** (depends on plugin-implementation work in development stage) — the diff-block typography and added/removed line colors in §3.4 assume a unified-diff text format for text files and a "binary-changed" signal for binary files (figma/PNG). The exact payload structure is implementation territory; this document specifies how the payload will be rendered, not what it contains.

These boundaries are deliberate. Token decisions are stable across architecture and payload-format choices because tokens are about *visual semantics*, not implementation. If the sibling artifact or downstream stages surface a need that this document doesn't cover, the answer is to extend this document — not to author parallel tokens elsewhere.
