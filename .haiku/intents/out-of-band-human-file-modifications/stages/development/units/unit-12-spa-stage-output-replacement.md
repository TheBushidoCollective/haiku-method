---
title: SPA Stage Output Replacement card + dialog
model: sonnet
depends_on:
  - unit-10-spa-upload-http-endpoints
  - unit-11-spa-knowledge-upload-panel
inputs:
  - intent.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/DESIGN-BRIEF.md
  - product/ACCEPTANCE-CRITERIA.md
  - features/explicit-spa-upload.feature
outputs:
  - packages/haiku-ui/src/molecules/OutputCardMenu.tsx
  - packages/haiku-ui/src/organisms/ReplaceOutputDialog.tsx
  - packages/haiku-ui/src/atoms/OutputThumbnail.tsx
  - packages/haiku-ui/src/pages/review/StageReview.tsx
  - packages/haiku-ui/tests/ReplaceOutputDialog.test.tsx
  - packages/haiku-ui/src/pages/review/stage/StageReview.tsx
quality_gates:
  - name: biome
    command: >-
      bunx biome check packages/haiku-ui/src/molecules/OutputCardMenu.tsx
      packages/haiku-ui/src/organisms/ReplaceOutputDialog.tsx
      packages/haiku-ui/src/atoms/OutputThumbnail.tsx
  - name: typecheck
    command: bun run --cwd packages/haiku-ui typecheck
  - name: ui-tests
    command: bun run --cwd packages/haiku-ui test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku-ui/src/molecules/OutputCardMenu.tsx
      packages/haiku-ui/src/organisms/ReplaceOutputDialog.tsx
      packages/haiku-ui/src/atoms/OutputThumbnail.tsx
  - name: no-raw-hex
    command: >-
      ! grep -nE '#[0-9a-fA-F]{3,8}\b'
      packages/haiku-ui/src/molecules/OutputCardMenu.tsx
      packages/haiku-ui/src/organisms/ReplaceOutputDialog.tsx
      packages/haiku-ui/src/atoms/OutputThumbnail.tsx
status: completed
bolt: 1
hat: ''
started_at: '2026-04-30T21:45:42Z'
hat_started_at: '2026-04-30T21:45:42Z'
iterations:
  - hat: ''
    started_at: '2026-04-30T21:45:42Z'
    completed_at: '2026-04-30T22:01:55Z'
    result: advance
completed_at: '2026-04-30T22:01:55Z'
---
# SPA Stage Output Replacement card + dialog

## Scope

Augment the existing artifact card in `StageReview` Outputs tab with a per-card "Replace this output…" affordance and the modal dialog that drives the replacement. Screen 2 in `stages/design/DESIGN-BRIEF.md`.

Deliverables (component inventory from DESIGN-BRIEF.md §"Component inventory" Screen 2):

1. **`OutputCardMenu.tsx`** (molecule) — the `⋯` button + popover with per-card actions: Open in new tab, Copy permalink, Replace this output…, Download original. Props: `onReplace`, `onDownload`, `onOpen`, `onCopyLink`. Uses Floating-UI-equivalent CSS positioning (`absolute right-0 top-full mt-1 z-30`).
2. **`ReplaceOutputDialog.tsx`** (organism) — native `<dialog>` modal that owns the drop zone, optional note textarea, mime-mismatch warning, and submit button. Props: `open`, `output: { name, mime, size, sha, version }`, `onSubmit({ file, note })`, `onClose`. Reuses `KnowledgeDropZone` from unit-11 with `accept` constrained to the original artifact's mime type and `maxFiles=1`.
3. **`OutputThumbnail.tsx`** (atom) — 64 × 64 preview of the existing output. Image → `<img>`, html → first-paint snapshot via the existing iframe sandbox helper, markdown → first-line text. Props: `output`, `size?: number` (default 64).
4. **`StageReview.tsx` augmentation** — wire `OutputCardMenu` into each artifact card in the Outputs tab. Hover/focus shows the `⋯` trigger on tablet and up; always visible on mobile. Each card carries:
   - `border-l-4 border-l-amber-400` and a "manual change pending" chip in the footer when the artifact is in the post-upload pre-classification window (the SPA derives this from the `drift_detected` WS frame for that file).
   - On `output_replaced` WS frame for the same artifact while the dialog is open from another browser, the dialog shows a non-dismissable banner per DESIGN-BRIEF Screen 2 §"Concurrent change."

Behavior (DESIGN-BRIEF Screen 2):

- Happy path: `⋯` → menu → "Replace this output…" → dialog opens, focus on drop zone → drop file → mime matches → optional note → "Replace" → multipart POST to `/api/intents/{intentSlug}/uploads/stage-output` (mode `replace`) → 200 → dialog closes → card body refreshes → success toast → card gains `border-l-amber-400` + "manual change pending" chip until the next tick's classification publishes.
- Mime-mismatch: drop file → mime warning surfaces in `aria-live="assertive"` ("Type mismatch: original is text/html, dropped image/png. Pick a matching file or [override type ▾]") → user can `[override type ▾]` to confirm "Yes, change text/html → image/png" → on confirm, warning clears, Replace button enables, note textarea pre-fills with "Type changed: text/html → image/png" so the agent has explicit context.
- Cancel: Esc / backdrop / Cancel button → dialog closes, no state change. Focus returns to `⋯` trigger.
- Submit error: dialog stays open, error toast at action row, Replace button becomes "Retry".

Accessibility (DESIGN-BRIEF Screen 2 §"Accessibility requirements"):

- `⋯` trigger: `aria-label="Output actions for {artifact-name}"` (interpolated EXACTLY per SPA-UI-SPECS.md §0 / §2.4 / §2.6 — verified by test).
- Popover: `role="menu"`, items `role="menuitem"`, arrow keys navigate, Enter/Space activates, Esc closes and returns focus.
- Replace dialog: native `<dialog>` for browser-native focus trap and Esc-close. `aria-labelledby` on title, `aria-describedby` on body. Focus on open lands on drop zone.
- Mime-mismatch warning announced via `aria-live="assertive"` (blocking validation).
- Color-not-only signal: every state pairs an icon (`AlertCircle`, `CheckCircle`) with text and color.
- Touch targets ≥ 44 × 44 on mobile.
- Reduced-motion: backdrop fade and slide-up clamped to 0.01 ms via the existing global rule. `unit-flash` confirmation gated by reduced-motion.

Responsive behavior (DESIGN-BRIEF Screen 2 §"Responsive behavior"):

- 375 px: `⋯` always visible (no hover). Dialog opens fullscreen via `FeedbackSheet` slide-up; thumbnail stacks above drop zone; note textarea `min-h-[120px]`; sticky bottom action bar.
- 768 px: `⋯` becomes hover-reveal (`opacity-0 group-hover:opacity-100` + `group-focus-within:opacity-100`). Dialog centered `<dialog>` `max-w-[560px]`.
- 1280 px: Full layout; dialog `max-w-[640px]`; thumbnail + drop zone side-by-side at `min-w-[600px]`.

Tests in `tests/ReplaceOutputDialog.test.tsx`:

- Card menu opens on click and on keyboard (Enter/Space). Esc closes.
- Selecting "Replace this output…" opens the dialog with focus on the drop zone.
- Replace happy path: drop file, click Replace, mocked 200 response → dialog closes → card shows pending chip.
- Mime mismatch: dropped png on html artifact surfaces `aria-live="assertive"` warning; override flow clears it; note pre-fills.
- Submit error: 500 response keeps dialog open with retry button.
- Concurrent `output_replaced` WS frame surfaces the non-dismissable banner.
- ARIA strings verified: `aria-label="Output actions for hero-mockup.html"`, `role="menu"`, `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded` reflects state.
- Reduced-motion: backdrop fade and slide-up are suppressed under `prefers-reduced-motion: reduce`.
- Mobile (375 px): dialog opens fullscreen; thumbnail stacks; sticky action bar visible.
- Path traversal in `target_path` prop is sanitised before POST.

## Completion Criteria

- All three component files exist; `StageReview.tsx` integrates them.
- Every Screen 2 scenario in `features/explicit-spa-upload.feature` is covered by passing tests.
- Biome, `bun run --cwd packages/haiku-ui typecheck`, `bun run --cwd packages/haiku-ui test` all pass.
- No raw hex (token discipline).
- No placeholders.
