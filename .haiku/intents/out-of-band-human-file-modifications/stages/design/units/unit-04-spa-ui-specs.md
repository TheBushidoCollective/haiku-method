---
title: 'SPA UI component specs (passive, no-action)'
model: sonnet
depends_on:
  - unit-01-architecture-spec
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - knowledge/DESIGN-DECISIONS.md
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/ARCHITECTURE.md
outputs:
  - stages/design/artifacts/SPA-UI-SPECS.md
  - stages/design/artifacts/wireframes/knowledge-upload.html
  - stages/design/artifacts/wireframes/replacement-affordance.html
  - stages/design/artifacts/wireframes/drift-indicator.html
status: completed
bolt: 1
hat: design-reviewer
started_at: '2026-04-28T19:59:56Z'
hat_started_at: '2026-04-28T20:11:00Z'
iterations:
  - hat: designer
    started_at: '2026-04-28T19:59:56Z'
    completed_at: '2026-04-28T20:11:00Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-28T20:11:00Z'
    completed_at: '2026-04-28T20:13:54Z'
    result: advance
completed_at: '2026-04-28T20:13:54Z'
---
# SPA UI component specs (passive, no-action)

Produce the concrete component specs and HTML wireframes for the three new SPA surfaces, locked to **Direction A: discrete + autonomous classification** as recorded in this stage's decision register (the "Design direction" entry in `stages/design/decision_log.json`, mirrored as a recorded decision in DESIGN-DECISIONS.md). Critical: per that decision, **the UI surfaces are passive observers** — they show what was detected and what the agent decided. They do NOT contain "Run now ↻", "Assess", "Accept fix", "Surface as feedback", or "Ignore" buttons. The agent classifies and acts on the next tick automatically; the UI reflects state, it doesn't drive it.

## Conflict-resolution precedence (READ FIRST)

The design-stage discovery sibling artifact `DESIGN-BRIEF.md` was authored before the design direction was locked. It includes design details that are now superseded by Direction A:

1. **DESIGN-BRIEF.md describes a "Run now ↻" button on the drift banner.** This unit's spec REMOVES that button. SPA-UI-SPECS.md is authoritative; DESIGN-BRIEF.md is superseded on this specific point. The wireframes MUST NOT contain a "Run now" button or any equivalent classification-trigger control.
2. **DESIGN-BRIEF.md uses raw Tailwind palette names (e.g. `bg-amber-50`, `text-amber-900`) for drift-state styling.** SPA-UI-SPECS.md MUST instead reference the semantic tokens declared in `DESIGN-TOKENS.md` (`--color-drift-detected-fg/bg`, `--color-drift-acknowledged-fg/bg`, `--color-drift-surfaced-fg/bg`, `--color-drift-revisit-fg/bg`) via CSS custom properties or token-aliased Tailwind utilities. Raw palette classes in semantic surfaces are a regression.
3. **Provisional token names in DESIGN-BRIEF.md (`--color-drift-bg`, `--color-drift-fg`, `--color-drift-stripe`) are deprecated** — DESIGN-TOKENS.md's four-state taxonomy is canonical. The wireframes and spec MUST use only the canonical names.

In any other point of divergence, SPA-UI-SPECS.md (this unit's primary output) takes precedence over DESIGN-BRIEF.md.

## Scope

The SPA-UI-SPECS.md must specify, and the wireframes must demonstrate visually:

- **Knowledge Upload Panel**
  - Lives inside `FeedbackSidebar` (LEFT column of `ReviewPage`) as a collapsible `<details>` section below the existing feedback list
  - Drop-zone affordance: drag-and-drop on desktop, click-to-browse fallback everywhere
  - Staged-files list with destination selector (intent-scope vs. stage-scope knowledge)
  - On upload, file lands at the selected path stamped `human-via-mcp` author-class — NO confirmation dialog, NO classification preview; the next tick handles it
  - Mobile (≤375px): collapses to a single button that opens the existing `FeedbackSheet` with the upload UI as a sub-panel
  - States: default, dragover (highlight border), uploading (progress), uploaded (chip with filename), error (token-colored)
  - **ARIA requirements**: drop-zone is a `<button>` (or `role="button"`) with `aria-label="Upload knowledge file"`. Uploading state sets `aria-busy="true"` on the button and announces "Uploading {filename}" via an `aria-live="polite"` region adjacent. Uploaded state announces "Uploaded {filename}". Error state announces the error text. Empty (no files staged) shows visible label "drop files or click to browse"; not just a placeholder image.
  - Tokens: `--color-upload-affordance-bg-resting` / `--color-upload-affordance-bg-hover` / `--color-upload-affordance-bg-dragover` (defined in DESIGN-TOKENS.md)
- **Stage Output Replacement Affordance**
  - Augments existing artifact cards in the `StageReview` Outputs tab
  - `⋯` menu button on hover/focus reveals "Replace this output…" — opens a small modal with mime-matching drop zone
  - **`⋯` button MUST carry `aria-label="More options for {artifact-name}"`** (interpolated per card). Without this, screen readers announce only "button" with no context.
  - On drop, the file replaces the output and stamps `human-via-mcp` baseline — NO "this will be classified as inline-fix" preview; the agent decides on the next tick
  - Modal has an optional "note for the agent" field (becomes the rationale in the audit log)
  - **States on the card itself**: default, drift-detected, drift-acknowledged, drift-surfaced, drift-revisit. Each drift state MUST be conveyed by a non-color signal (a labelled icon badge or text label like "Drift detected", "Acknowledged") in addition to the border-accent color. WCAG 1.4.1: information not conveyed by color alone.
  - Mime-mismatch handling: if the dropped file's mime doesn't match the original's, modal shows a one-line warning and a confirm checkbox; no auto-rejection
  - Tokens for state borders: `--color-drift-detected-bg`, `--color-drift-acknowledged-bg`, `--color-drift-surfaced-bg`, `--color-drift-revisit-bg` (canonical names from DESIGN-TOKENS.md, NOT the deprecated `--color-drift-bg/fg/stripe` from DESIGN-BRIEF.md)
- **Drift-Detected Indicator** (passive)
  - Sticky strip between `StageBanner` and `RereviewBanner` — appears ONLY when the pre-tick gate has observed drift but `manual_change_assessment` has not yet run on the next tick
  - Content: "N file(s) changed since the last agent write — assessment runs on the next tick" (informational)
  - **NO "Run now ↻" button.** Per the locked Direction A decision, the user does not trigger assessment. The next normal `haiku_run_next` tick consumes the drift events and classifies. (DESIGN-BRIEF.md's Screen 3 sketches this button; it is REMOVED in this unit's spec — see Conflict-resolution precedence above.)
  - **ARIA requirements**: strip MUST render with `role="status"` and `aria-live="polite"` so screen readers announce its appearance. When it disappears, an empty live region remains in the DOM (visibility:hidden) to avoid abrupt focus loss. Strip carries a non-color icon (e.g. clock or change-flag) alongside the text so it's distinguishable without color.
  - Auto-disappears once the assessment completes; the per-file outcome is reflected in the artifact-card border accent + non-color badge (drift-acknowledged / drift-surfaced / drift-revisit)
  - Tokens: `--color-drift-detected-fg` / `--color-drift-detected-bg`
- **Cross-cutting requirements**
  - All three surfaces use existing tokens declared in DESIGN-TOKENS.md — no raw hex values, no raw Tailwind palette classes (`bg-amber-50`, `text-amber-900`, etc.) in semantic surfaces. CSS custom property references (`background: var(--color-drift-detected-bg)`) or token-aliased Tailwind utilities only.
  - Touch targets ≥44×44 on ≤768px breakpoints via the existing `.touch-target` utility — explicitly applied to the `⋯` button (which is otherwise small enough to fail this) and to every interactive element in the upload panel
  - Keyboard navigation: tab order documented for each surface, AND visible focus indicators required on every interactive element (focus-ring meeting WCAG 2.4.7 — minimum 3:1 contrast against adjacent colors). Each wireframe MUST render a clearly-visible focus state for the `:focus-visible` pseudo-class on every interactive element.
  - WCAG AA contrast verification — for each new token combination used (text on `--color-drift-detected-bg`, text on `--color-upload-affordance-bg-resting`, drift-acknowledged badge on its background, etc.), the SPA-UI-SPECS.md MUST include a contrast table listing the foreground/background pair, the computed contrast ratio, and pass/fail vs WCAG AA (4.5:1 normal text, 3:1 large text and UI components). Minimum: one row per drift state × text color, plus the upload affordance.
  - Reduced-motion: drift-indicator's appearance/disappearance respects the `prefers-reduced-motion` guard already in the SPA's `index.css`
  - Empty states: knowledge upload shows "drop files or click to browse" when zero files staged; replacement modal shows "drop a file matching {original-mime}" by default

## Completion Criteria

- SPA-UI-SPECS.md exists at `stages/design/artifacts/SPA-UI-SPECS.md` and is at least 5KB of substantive prose
- Three HTML wireframe files exist at `stages/design/artifacts/wireframes/{knowledge-upload,replacement-affordance,drift-indicator}.html`, each rendering at desktop (1280px) AND mobile (375px) breakpoints (single file with both via media queries OR two files)
- Each wireframe and the spec explicitly demonstrates the passive-observer constraint: NO "Run now", "Assess", "Accept", "Surface", "Ignore", or any other classification-triggering button on any of the three surfaces — verifiable by grep of those phrases against the wireframe HTML returning zero matches
- Spec specifies all interactive states (default, hover, focus, active, disabled, error, loading, empty, dragover, drift-detected, drift-acknowledged, drift-surfaced, drift-revisit) for each applicable surface
- Spec specifies responsive behavior at 375 / 768 / 1280 breakpoints for each surface, with explicit copy/layout differences (not "it's responsive")
- Spec lists the design tokens used per surface (referencing DESIGN-TOKENS.md canonical names — `--color-drift-detected-fg/bg` and the four-state palette, NOT DESIGN-BRIEF.md's deprecated `--color-drift-bg/fg/stripe`); zero raw hex values appear in any wireframe — verifiable by grep `#[0-9a-fA-F]{3,6}` returning nothing in `stages/design/artifacts/wireframes/`
- Wireframes use CSS custom property references (`var(--color-...)`) or token-aliased utilities for color — NO raw Tailwind palette classes (`bg-amber-{50..900}`, `text-amber-*`, `border-amber-*`, etc.) in semantic surfaces — verifiable by grep `bg-amber-|text-amber-|border-amber-` returning nothing in the new wireframe files (the existing SPA's pre-feature usage is out of scope)
- Spec includes a WCAG AA contrast table with one row per token-pair used in the new surfaces (foreground / background / ratio / pass-vs-AA-threshold); table is in the SPA-UI-SPECS.md artifact body
- Spec specifies tab order for keyboard navigation per surface AND explicitly requires visible focus indicators on every interactive element with the focus-ring meeting WCAG 2.4.7 (3:1 contrast against adjacent colors); each wireframe demonstrates the focus state
- Spec confirms touch targets ≥44px on mobile via the existing `.touch-target` utility and explicitly applies it to the `⋯` button
- Spec specifies all required ARIA annotations: drop-zone (`role="button"` + `aria-label="Upload knowledge file"`), uploading state (`aria-busy="true"` + `aria-live="polite"` announcement), `⋯` menu (`aria-label="More options for {artifact-name}"`), drift strip (`role="status"` + `aria-live="polite"` + persistent empty live region on disappearance), drift-state cards (non-color badge or text label alongside border accent)
- Spec specifies that drift state on artifact cards is conveyed by both color AND a non-color signal (icon-with-label or text badge) — WCAG 1.4.1 compliance
- Spec specifies reduced-motion behavior: the drift indicator's enter/exit animation respects `prefers-reduced-motion`
- Spec is internally consistent with Direction A (discrete) recorded in this stage's decision register; verifier confirms by reading either `stages/design/decision_log.json` (auto-managed by `haiku_decision_record`) or the design-direction decision recorded in DESIGN-DECISIONS.md, whichever is available
- Spec is internally consistent with ARCHITECTURE.md — every UI signal corresponds to a known classification outcome or baseline state defined there
- Spec explicitly states that SPA-UI-SPECS.md takes precedence over DESIGN-BRIEF.md wherever they conflict, with the three named conflicts (Run-now button, raw palette classes, deprecated token names) resolved per this unit's scope
