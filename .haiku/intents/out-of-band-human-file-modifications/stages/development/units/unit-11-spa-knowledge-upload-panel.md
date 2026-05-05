---
title: SPA Knowledge Upload Panel (left sidebar)
model: sonnet
depends_on:
  - unit-10-spa-upload-http-endpoints
inputs:
  - intent.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/DESIGN-BRIEF.md
  - product/ACCEPTANCE-CRITERIA.md
  - features/explicit-spa-upload.feature
outputs:
  - packages/haiku-ui/src/pages/review/KnowledgeUploadPanel.tsx
  - packages/haiku-ui/src/atoms/KnowledgeDropZone.tsx
  - packages/haiku-ui/src/atoms/StagedFileRow.tsx
  - packages/haiku-ui/src/atoms/DestinationSelect.tsx
  - packages/haiku-ui/src/index.css
  - packages/haiku-ui/tests/KnowledgeUploadPanel.test.tsx
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku-ui/src/pages/review/KnowledgeUploadPanel.tsx
      packages/haiku-ui/src/atoms/KnowledgeDropZone.tsx
      packages/haiku-ui/src/atoms/StagedFileRow.tsx
      packages/haiku-ui/src/atoms/DestinationSelect.tsx
  - name: typecheck
    command: bun run --cwd packages/haiku-ui typecheck
  - name: ui-tests
    command: bun run --cwd packages/haiku-ui test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku-ui/src/pages/review/KnowledgeUploadPanel.tsx
      packages/haiku-ui/src/atoms/KnowledgeDropZone.tsx
      packages/haiku-ui/src/atoms/StagedFileRow.tsx
      packages/haiku-ui/src/atoms/DestinationSelect.tsx
  - name: no-raw-hex
    command: >-
      ! grep -nE '#[0-9a-fA-F]{3,8}\b'
      packages/haiku-ui/src/pages/review/KnowledgeUploadPanel.tsx
      packages/haiku-ui/src/atoms/KnowledgeDropZone.tsx
      packages/haiku-ui/src/atoms/StagedFileRow.tsx
      packages/haiku-ui/src/atoms/DestinationSelect.tsx
status: completed
bolt: 1
hat: ''
started_at: '2026-04-30T20:38:16Z'
hat_started_at: '2026-04-30T20:38:16Z'
iterations:
  - hat: ''
    started_at: '2026-04-30T20:38:16Z'
    completed_at: '2026-04-30T21:41:58Z'
    result: advance
completed_at: '2026-04-30T21:41:58Z'
---
# SPA Knowledge Upload Panel (left sidebar)

## Scope

Build the Knowledge Upload Panel — Screen 1 in `stages/design/DESIGN-BRIEF.md`. Drop-zone + staged-files list + destination selector + upload/cancel actions. Lives inside `FeedbackSidebar` on the LEFT column of `ReviewPage`, between the existing feedback list and the composer. On mobile (`<xl`) it renders inside `FeedbackSheet` above the composer.

Deliverables (component inventory from DESIGN-BRIEF.md §"Component inventory" Screen 1):

1. **`KnowledgeUploadPanel.tsx`** (molecule) — composes `KnowledgeDropZone`, the staged-files list (`StagedFileRow` × N), `DestinationSelect`, and the action buttons. Owns local state: `staged: File[]` and `destination: string`. Props: `intentSlug`, `currentStage`, `onUpload(files, dest)`, `onError(msg)`, `disabled`.
2. **`KnowledgeDropZone.tsx`** (atom) — drop-target + click-to-browse. Emits `File[]` on add. Props: `accept` (mime list), `maxBytes` (default 10 MB per Screen 1), `onFiles`, `disabled`.
3. **`StagedFileRow.tsx`** (atom) — one row in the staged list. Props: `file`, `onRemove`, `progress?: number` (0–1, only during upload). Renders icon + filename (truncate, mono) + size (text-xs tabular-nums) + remove `×` button (44 × 44 hit area via `.touch-target.touch-target--hit-area`).
4. **`DestinationSelect.tsx`** (atom) — picks where the upload lands. Options: `Intent knowledge` (default → `knowledge/`) plus one option per stage that has a `discovery/`/`knowledge/` directory in the studio config. Disabled options for stages whose status is `complete` (forward-only lifecycle) — `text-stone-400` + tooltip "Stage closed — knowledge cannot be added."
5. **CSS additions in `index.css`:** add the new tokens from DESIGN-TOKENS.md §1.3.4 (`--color-upload-affordance-fg`, `--color-upload-affordance-label-fg`, `--color-upload-affordance-bg-resting`, `--color-upload-affordance-bg-hover`, `--color-upload-affordance-bg-dragover`) under the `@theme` block. New tokens MUST ship in light/dark pairs per DESIGN-TOKENS.md §1.4.

Behavior matches DESIGN-BRIEF.md Screen 1:

- All eight visual states for each control (default, hover, focus, active, disabled, loading, error, empty).
- Path A drag-drop happy path: drop file → stage → pick destination → click "Upload N files" → multipart POST to the unit-10 endpoint → on 200, panel auto-collapses, staged list cleared, success toast for 3s.
- Path B click-to-browse: click anywhere in drop zone → triggers hidden `<input type="file" multiple accept="...">` → same staging flow.
- Path C cancel: clears `staged`, collapses panel.
- Path D validation rejection: file too large / wrong mime → that file rejected pre-staging; remaining files staged; rejection message in `text-xs text-rose-600` for 4s.
- Path E partial-failure mid-upload: succeeded files removed; failed rows persist with red border + retry button; primary button label updates to "Retry N file(s)".

Accessibility (DESIGN-BRIEF.md Screen 1 §"Accessibility requirements"):

- Drop zone: `role="button"`, `tabIndex={0}`, `aria-label="Upload knowledge file"` (the EXACT string per SPA-UI-SPECS.md §1.4 — verified by a test that asserts the literal string).
- Staged list wrapped in `role="list"`; rows `role="listitem"`. Remove button `aria-label="Remove ${file.name} from upload"`.
- Live region `aria-live="polite"` at the panel bottom announces file added/removed/validation reject/upload progress milestones (25/50/75/100%)/final summary.
- Tab order: caret → drop zone → first staged row → its remove button → next row → … → destination select → Upload → Cancel.
- Focus management: opening disclosure focuses drop zone; after upload, focus returns to disclosure caret; after cancel, focus returns to caret.
- Reduced-motion: drop-zone scale-on-drag-over suppressed; progress bar still renders (state, not decoration).

Token discipline (DESIGN-TOKENS.md §1.4):

- All colors via Tailwind utilities mapped to existing tokens or the new tokens added in §1.3.4.
- No raw hex outside the `@theme` block (verified by the `no-raw-hex` quality gate).
- Light + dark mode pairs for every new utility used.
- 44 × 44 minimum touch target on every pointer-activated control via `.touch-target` / `.touch-target--hit-area`.

Responsive behavior (DESIGN-BRIEF.md Screen 1 §"Responsive behavior"):

- 375 px: Panel renders inside `FeedbackSheet` (mobile drawer). Drop zone collapses to single full-width button `[ + Add files ]` `h-12` opening native file picker only.
- 768 px: Inline panel inside `FeedbackSidebar` if visible. Drop zone min-height grows to 128 px.
- 1280 px: Full inline panel as drawn in the brief.

Tests in `tests/KnowledgeUploadPanel.test.tsx` (Vitest + React Testing Library):

- Renders disclosure, drop zone, destination select with default `Intent knowledge`.
- Drop event populates staged list; click "Upload" calls `onUpload` with the file array and destination.
- Validation rejection on file too large; remaining valid files stage.
- Cancel clears state; success toast appears after a successful POST mocked at `/api/intents/{intentSlug}/uploads/knowledge`.
- 413 response surfaces "File exceeds size limit" toast.
- Live region announcements fire on add, remove, success.
- ARIA labels match DESIGN-BRIEF strings exactly (`role="button"`, `aria-label="Upload knowledge file"`, etc.).
- Reduced-motion: drag-over scale animation is suppressed under `prefers-reduced-motion: reduce` (mock the media query).
- Mobile (375 px) renders the collapsed single-button variant (test via simulated viewport width).
- Disabled state when no active intent: panel is opacity-60 pointer-events-none.
- Tab order asserts the documented sequence (caret → drop zone → staged rows → destination select → Upload → Cancel).

## Completion Criteria

- All four component files exist with the named exports.
- New tokens are added to `packages/haiku-ui/src/index.css` `@theme` block (light + dark).
- Every scenario in `features/explicit-spa-upload.feature` that touches the Knowledge Upload Panel is covered by a passing test.
- Biome, `bun run --cwd packages/haiku-ui typecheck`, `bun run --cwd packages/haiku-ui test` all pass.
- No raw hex in the new component files (`no-raw-hex` gate).
- No placeholders.
