---
name: design-brief
stage: design
intent: out-of-band-human-file-modifications
scope: intent
format: design
---

# Design Brief — Out-of-Band Human File Modifications

Screen-by-screen design specifications for the three user-facing surfaces this intent introduces:

1. **Knowledge Upload Panel** — adds drag-drop / file-picker affordances to the review SPA so users can drop files directly into intent-scoped knowledge (replaces the "ask Claude to write the file" workaround for inception inputs).
2. **Stage Output Replacement Card** — adds a "Replace this output" affordance to figma / html / image artifact cards on the review page, so a designer can swap the agent-generated mockup for their own without going through the feedback fix-loop.
3. **Drift-Detected Banner** — passive system-state indicator that appears when the pre-tick gate observes SHA drift on stage-baselined files but the `manual_change_assessment` action has not yet run. Read-only — no input controls; it just tells the user what the next tick will see.

Cross-cutting boundary notes:
- *Color tokens, semantic aliases, motion/reduced-motion behavior* — see sibling `DESIGN-TOKENS.md`. This brief references token names (e.g. `bg-amber-100`, `feedback-pending-fg`) but never declares hex values.
- *Concrete mockups (HTML/figma) in `outputs/DESIGN-ARTIFACTS.md`* — sibling produces those; this brief is the spec the mockups must match.
- *MCP tool contract / state-baseline schema* — out of scope for design; depends on architecture artifact (sibling).
- *Pre-tick gate logic and `manual_change_assessment` action shape* — out of scope; depends on workflow-engine architecture (sibling).

All three surfaces extend existing review-app shells — `packages/haiku-ui/src/pages/review/ReviewPage.tsx`, `FeedbackSidebar.tsx`, `StageReview.tsx`. No new top-level routes. No new full-page surfaces. Every component below slots into the existing `<header> · <FeedbackSidebar> · <Main>` three-zone shell.

---

## Screen 1 — Knowledge Upload Panel

**Where it lives.** A new collapsible section inside `FeedbackSidebar` on the LEFT column of `ReviewPage`. It sits below the existing "Feedback list" / above the composer, separated by a hairline border. On mobile (`<xl`) the same panel renders inside `FeedbackSheet` above the composer.

**Why a panel, not a modal.** Uploads are a high-frequency action during elaboration (drop a brand guide, drop a competitor screenshot, drop the meeting transcript). A modal would force a focus-trap context-switch every drop. Inline panel keeps the user's seat in the artifact pane.

### Layout structure

```
┌─ FeedbackSidebar (left column, w-[var(--sidebar-width)] = 20rem) ─┐
│                                                                    │
│  [stage banner]                                                    │
│  [Feedback — N chip] [tagline]                                     │
│  [Feedback list]                  ← scrollable, flex-1             │
│                                                                    │
│  ─── hairline border-t stone-200 / stone-800 ─────────────────────│
│                                                                    │
│  ┌─ Knowledge Upload (collapsible) ──────────────────────────┐    │
│  │  [▾ Upload knowledge]   [3 staged]            [info icon] │    │
│  │  ─────────────────────────────────────────────────────────│    │
│  │  ╔═══════════════════════════════════════════════════════╗│    │
│  │  ║   Drop files here                                     ║│    │
│  │  ║   ─────────────────────                               ║│    │
│  │  ║   or click to browse                                  ║│    │
│  │  ║   .md  .pdf  .png .jpg .svg  .txt   max 10 MB each    ║│    │
│  │  ╚═══════════════════════════════════════════════════════╝│    │
│  │                                                            │    │
│  │  Staged (not yet uploaded):                                │    │
│  │  ┌──────────────────────────────────────────────────┐     │    │
│  │  │ [icon] brand-guide.pdf   2.4 MB    [×]           │     │    │
│  │  │ [icon] hero-mock.png     480 KB    [×]           │     │    │
│  │  │ [icon] interview.md      12 KB     [×]           │     │    │
│  │  └──────────────────────────────────────────────────┘     │    │
│  │                                                            │    │
│  │  Destination: [Intent knowledge ▾]                         │    │
│  │                                                            │    │
│  │  [ Upload 3 files ]              [ Cancel ]                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ─── hairline ───────────────────────────────────────────────────│
│                                                                    │
│  [composer textarea]                                               │
│  [Add comment] [Smart decision button]                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

- Outer panel: `bg-white dark:bg-stone-900`, `rounded-md`, `border border-stone-200 dark:border-stone-800`, `mx-3 my-2`, `p-3`.
- Header row: 32px tall (`h-8`), `flex items-center justify-between`, gap-2. Disclosure caret on the left, count chip in the middle (only when staged > 0), info icon (`Info` Lucide, `w-4 h-4 text-stone-400`) on the right with title="Files are uploaded to the intent's `knowledge/` directory and become readable to the next workflow tick."
- Drop zone: `min-h-[112px]`, `border-2 border-dashed border-stone-300 dark:border-stone-700`, `rounded-md`, `flex flex-col items-center justify-center text-center`, `p-4`, `gap-2`. Hover: `border-teal-400 bg-teal-50/40 dark:bg-teal-900/10`. Drag-over: same as hover plus `ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-stone-900`.
- Staged-files list: each row 36px tall (`h-9`), `flex items-center gap-2`, `px-2`, `rounded`, `hover:bg-stone-50 dark:hover:bg-stone-800/50`. Filename `truncate font-mono text-xs`, size `text-xs text-stone-500 tabular-nums`, remove button `w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-rose-600` (touch target padded to 44px on mobile via `.touch-target.touch-target--hit-area`).
- Destination selector: `<select>` styled with the same atoms.Input rules — `h-9 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm px-2`, full-width on the row.
- Action buttons: primary "Upload N files" `bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold`, secondary "Cancel" `border border-stone-300 dark:border-stone-700 px-3 py-1.5 rounded-md text-sm`.

### Component inventory

| Component | Location | Purpose | Key props |
|---|---|---|---|
| `KnowledgeUploadPanel` (new molecule) | `pages/review/KnowledgeUploadPanel.tsx` | Composes drop zone + staged list + actions; owns `staged: File[]` and `destination` state | `intentSlug`, `currentStage`, `onUpload(files, dest)`, `onError(msg)`, `disabled` |
| `KnowledgeDropZone` (new atom) | `atoms/KnowledgeDropZone.tsx` | Drop-target + click-to-browse; emits `File[]` on add | `accept` (mime list), `maxBytes`, `onFiles`, `disabled` |
| `StagedFileRow` (new atom) | `atoms/StagedFileRow.tsx` | One row in the staged list | `file`, `onRemove`, `progress?: number` (0–1, only during upload) |
| `DestinationSelect` (new atom) | `atoms/DestinationSelect.tsx` | Picks where the upload lands | `value`, `options` (`intent` always; `stage:design`, `stage:inception`, etc. when relevant), `onChange` |
| `PanelDisclosure` (reuse) | shared with FeedbackSidebar's filter panel | Caret + label + collapsed/expanded chevron | `open`, `onToggle`, `label`, `count?` |

Destination options enumerate as: `Intent knowledge` (default — writes to `.haiku/intents/{slug}/knowledge/`), and one option per stage that has a `discovery/` directory in the studio (each writes to `.haiku/intents/{slug}/stages/{stage}/`). Disabled options for stages whose status is `complete` (per the architecture rule that completed units are forward-only) — show with `text-stone-400` + `title="Stage closed — knowledge cannot be added."`.

### Interaction states (per element)

**Drop zone**
- *Default* — dashed stone-300 border, neutral text, `Cloud-upload` Lucide icon (24px, `text-stone-400`).
- *Hover* — teal-400 border, slight teal-50 tint, icon turns `text-teal-600`.
- *Focus* — full focus ring: `outline-none ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-stone-900`.
- *Drag-over* — solid teal-500 border, teal-100 fill, icon scale 1.1 (skipped under reduced-motion), text reads "Drop to stage".
- *Drop-rejected* (mime not allowed, size > max) — border rose-400, icon `AlertCircle` rose-500, text "File type/size not accepted: <name>" lives below the zone in red `text-xs text-rose-600`. Auto-clears after 4s or next interaction.
- *Disabled* (no intent context, or upload in flight) — `opacity-60 pointer-events-none cursor-not-allowed` + tooltip "Upload in progress…" or "No active intent."
- *Loading* (during upload) — drop zone replaced by determinate progress: full-width track `h-1 bg-stone-200 dark:bg-stone-800`, fill `bg-teal-500` width = % completed; staged list rows show per-file ring spinners.
- *Empty* (no staged files, no drag) — drop zone is the only visible element below the disclosure header; staged-list region is hidden, action buttons are hidden.

**Staged-file row**
- *Default* — stone-50 background on hover, transparent otherwise.
- *Hover* — `bg-stone-50 dark:bg-stone-800/50`.
- *Focus* (filename clickable to preview before upload) — focus ring on the row container.
- *Active* (preview open) — `bg-teal-50/30 dark:bg-teal-900/10`.
- *Disabled* (during upload) — opacity-70, remove button hidden.
- *Error* (upload failed for this file) — left border 3px rose-500, error message `text-xs text-rose-600` below row, retry button replaces remove.
- *Loading* — small spinner replaces the file-type icon; size text replaced by "Uploading…"; remove button disabled.
- *Empty* — N/A (row never renders empty).

**Upload button**
- *Default* — `bg-teal-600 text-white`.
- *Hover* — `bg-teal-700`.
- *Focus* — adds `ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-stone-900`.
- *Active* — `bg-teal-800`.
- *Disabled* (no staged files OR validation failure) — `bg-stone-300 dark:bg-stone-700 text-stone-500 cursor-not-allowed`.
- *Loading* — label changes to "Uploading…" with leading spinner; button width pinned to prevent jitter.
- *Error* (upload partially or fully failed) — button reverts to default; per-file error badges propagate to the rows; toast / inline alert at the panel bottom: "2 of 3 files failed — retry below."

**Destination select**
- *Default / hover / focus* — atoms.Input.tsx rules.
- *Active / open* — native dropdown chrome.
- *Disabled* — when `staged.length === 0` (nothing to send anywhere).
- *Error* — N/A; selection always valid.

### Responsive behavior

| Breakpoint | Layout change |
|---|---|
| **375px (mobile)** | Panel renders inside `FeedbackSheet` (the existing mobile drawer). Drop zone collapses to a single button: `[ + Add files ]` full-width, `h-12`, that opens the native file picker only — no drag-drop affordance (touch devices). Staged list collapses to a single-line summary "3 files staged ·  [view]" that expands to the full list when tapped. Action buttons go full-width stacked. Touch targets all ≥ 44px. |
| **768px (tablet)** | Panel renders inline inside `FeedbackSidebar` if visible (sidebar collapses below `xl`); otherwise inside `FeedbackSheet`. Drop zone min-height grows to 128px; drag-drop is enabled (tablets with trackpads). |
| **1280px (desktop)** | Full inline panel inside the LEFT sidebar as drawn above. Sidebar fixed at `var(--sidebar-width)` = 20rem; at `2xl` it grows to `var(--sidebar-width-xl)` = 24rem and the drop zone gains horizontal breathing room (more vertical centering for the helper text). |

### Navigation flows

- **Path A — Drag-drop happy path:** User drags 1+ files onto the drop zone (anywhere on the page if the panel is expanded — drop zone listens at the panel scope; rest of the SPA preserves native drop). Drop event → file objects pushed into `staged` state → drop zone collapses, staged list renders, action row appears → user picks destination (default Intent knowledge) → clicks "Upload N files" → multipart POST to a new endpoint (out of scope here — see API artifact). On 200, the WS frame `knowledge_added` triggers a refetch of `session.knowledge_files`; the new artifact card appears in `StageReview` Knowledge tab and flashes via `.unit-flash`. Panel auto-collapses, staged list cleared, success toast at panel bottom for 3s ("Uploaded 3 files to intent knowledge").
- **Path B — Click-to-browse:** Click anywhere inside drop zone → triggers hidden `<input type="file" multiple accept="...">` → same staging flow as Path A.
- **Path C — Cancel:** "Cancel" button clears `staged` and collapses the panel back to its disclosed state. No network call.
- **Path D — Validation rejection:** File too large / wrong mime → that file is rejected pre-staging; remaining valid files stage; rejection message appears below drop zone, dismissable, auto-clears after 4s.
- **Path E — Upload error mid-flight:** Partial failure (2 of 3 succeed) → succeeded files removed from staged list and added to KnowledgeFiles; failed rows persist with red border + retry button; primary button label updates: "Retry 1 file".

### Accessibility requirements

- Drop zone has `role="button"`, `tabIndex={0}`, `aria-label="Upload knowledge file"` (authoritative per SPA-UI-SPECS.md §1.4 — exact string required). Enter / Space activates the hidden file input.
- Drag-and-drop is augmented, not replaced — the click-to-browse path is the keyboard-and-screen-reader-equivalent and is wired identically. No drag-only flows.
- All controls (disclosure caret, drop zone, file rows, destination select, buttons) are keyboard reachable via Tab in DOM order: caret → drop zone → first staged row → its remove button → next staged row → … → destination select → Upload → Cancel.
- Staged list is wrapped in `role="list"`; each row is `role="listitem"`. Remove button has `aria-label="Remove ${file.name} from upload"`.
- Live region (`aria-live="polite"`) at the bottom of the panel announces: file added, file removed, validation rejection, upload progress milestones (25 / 50 / 75 / 100%), and final success/failure summary. Screen-reader copy mirrors the visible toast.
- Color contrast: all token-bound text/background pairs are pulled from existing tokens (`text-stone-700 on bg-white`, `text-rose-600 on bg-white`, `bg-teal-600 text-white`) — every pair already meets WCAG AA 4.5:1 in light and 7:1 in dark per `DESIGN-TOKENS.md`. The dashed border pattern by itself does not convey state — error/success state is always paired with an icon AND a text label.
- Focus management: opening the disclosure auto-focuses the drop zone. After successful upload, focus returns to the disclosure caret to prevent a focus-orphan when the staged-list region collapses. After Cancel, focus returns to the caret.
- Reduced motion: drop-zone scale-on-drag-over is suppressed; progress bar still renders (it conveys state, not decoration). Toast slide-in is replaced by an immediate appearance.
- Touch targets: 44×44 minimum on mobile via `.touch-target.touch-target--hit-area`; the X (remove) on staged rows is the only sub-44 visual target and gets the augmented hit area.

---

## Screen 2 — Stage Output Replacement Card

**Where it lives.** Augments the existing artifact card in `StageReview` Outputs tab (`packages/haiku-ui/src/pages/review/stage/StageReview.tsx` — `ArtifactsTab` component). One new affordance per output card.

**Why a per-card affordance, not a global "upload output" button.** Each output card is the precise context for what's being replaced — replacing `hero-v3.figma` and replacing `landing-page.html` are different actions with different mime expectations. Per-card scoping eliminates the "which artifact?" question.

### Layout structure

```
┌─ Output card (existing, augmented) ────────────────────────────┐
│  ┌─ Header row ─────────────────────────────────────────────┐  │
│  │ [kind chip "wireframe"]  hero-mockup.html                │  │
│  │ [NEW badge if unseen]    [feedback-count badge if any]   │  │
│  │                                          [⋯ menu] ◀── new│  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ Body ───────────────────────────────────────────────────┐  │
│  │  [iframe / image / markdown — current artifact body]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ Footer row ─────────────────────────────────────────────┐  │
│  │ [feedback-on-this-card chip]   modified 2h ago [by name] │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
       ▲
       │  click [⋯ menu]
       ▼
┌─ Card menu (popover, anchored to ⋯) ───┐
│  Open in new tab                        │
│  Copy permalink                         │
│  ─────────────────────                  │
│  Replace this output…    ◀─── new       │
│  Download original                      │
└─────────────────────────────────────────┘
       ▲
       │  click "Replace this output…"
       ▼
┌─ Replace dialog (modal) ────────────────────────────────────────┐
│  ┌─ Header ──────────────────────────────────────────────────┐  │
│  │ Replace output: hero-mockup.html                  [ × ]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌─ Body ────────────────────────────────────────────────────┐  │
│  │ Current:                                                  │  │
│  │ ┌─────────────────┐                                       │  │
│  │ │ [thumbnail]     │   hero-mockup.html                    │  │
│  │ │                 │   text/html · 14 KB · v3              │  │
│  │ └─────────────────┘                                       │  │
│  │                                                           │  │
│  │ Replacement: (drop zone — same as Screen 1)               │  │
│  │ ╔═══════════════════════════════════════════════════════╗ │  │
│  │ ║  Drop new file here                                   ║ │  │
│  │ ║  Must match: text/html  ·  size ≤ 10 MB              ║ │  │
│  │ ╚═══════════════════════════════════════════════════════╝ │  │
│  │                                                           │  │
│  │ Optional note (will be saved as agent-readable knowledge):│  │
│  │ ┌───────────────────────────────────────────────────────┐ │  │
│  │ │ I tightened the hero copy and shrunk the CTA button.  │ │  │
│  │ │                                                       │ │  │
│  │ └───────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ ☑ The next workflow tick will see this change and       │  │
│  │   classify its impact (manual change assessment).         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌─ Actions ─────────────────────────────────────────────────┐  │
│  │                            [ Cancel ]   [ Replace ]       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- Card menu (`⋯`) — `w-7 h-7 rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200`. Touch-target padded.
- Popover — `w-56`, `bg-white dark:bg-stone-900`, `border border-stone-200 dark:border-stone-700`, `rounded-md shadow-lg p-1`, items `h-9 px-2 rounded text-sm hover:bg-stone-100 dark:hover:bg-stone-800` (destructive items would carry rose styling — none here).
- Replace dialog — native `<dialog>` (matches FeedbackSheet pattern in `index.css` line 315), `max-w-[640px]`, `rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800`, scrim is `var(--color-scrim)`.
- Drop zone inside dialog — same molecule as Screen 1 (`KnowledgeDropZone`) with `accept` constrained to the original artifact's mime type, `maxFiles=1`.
- Note textarea — `min-h-[80px]`, atoms.Input rules, `font-mono text-sm`.
- Reassurance checkbox row — `text-xs text-stone-500 dark:text-stone-400 flex items-start gap-2 leading-snug`. Checked + disabled (informational only — user can't opt out of the assessment, they get told it's coming).

### Component inventory

| Component | Location | Purpose | Key props |
|---|---|---|---|
| `OutputCardMenu` (new molecule) | `molecules/OutputCardMenu.tsx` | The `⋯` button + popover with the per-card actions | `onReplace`, `onDownload`, `onOpen`, `onCopyLink` |
| `ReplaceOutputDialog` (new organism) | `organisms/ReplaceOutputDialog.tsx` | Modal that owns drop zone, note textarea, and submit | `open`, `output: {name, mime, size, sha, version}`, `onSubmit({file, note})`, `onClose` |
| `OutputThumbnail` (new atom) | `atoms/OutputThumbnail.tsx` | 64×64 preview of the existing output (image → img, html → first-paint snapshot via existing iframe sandbox, md → first-line text) | `output`, `size?: number` |
| `KnowledgeDropZone` (reuse from Screen 1) | — | Constrained to mime + maxFiles=1 | — |
| Reuse `StagedFileRow` for the single replacement file | — | — | — |

### Interaction states (per element)

**Card `⋯` menu trigger**
- *Default* — stone-400 icon, transparent bg.
- *Hover* — `bg-stone-100 dark:bg-stone-800`, icon turns stone-700 / stone-200.
- *Focus* — focus ring; popover does NOT auto-open on focus (only on click / Enter).
- *Active / open* — `bg-stone-200 dark:bg-stone-700`, icon stone-700 / stone-100. Popover anchored bottom-right of the trigger via Floating-UI-equivalent CSS (`absolute right-0 top-full mt-1 z-30`).
- *Disabled* (output is read-only — the original was deleted; not currently a state but reserved for future) — `opacity-50 cursor-not-allowed`.
- *Empty / loading / error* — N/A; the menu is purely navigational.

**Replace dialog drop zone**
- All states from Screen 1 PLUS:
- *Mime mismatch* — drop event accepted into staging UI but flagged with rose-600 border + message "Type mismatch: original is `text/html`, dropped `image/png`. Pick a matching file or [override type ▾]" — the override is a small dropdown that lets the user explicitly say "yes, change the mime too" (for the legitimate "I'm replacing the html with a png mock" case). Default is strict-match; override is opt-in.
- *Size mismatch* — purely informational; no upper-bound on replacement size beyond the global 10 MB. Show "+/- ${delta}" beside the file size.

**Replace button**
- *Default* — `bg-teal-600 text-white`.
- *Hover / Focus / Active* — same as Screen 1 upload button.
- *Disabled* — when no replacement file is staged OR mime mismatch is unresolved.
- *Loading* — "Replacing…" with spinner, button width pinned.
- *Error* — error message above action row in `text-xs text-rose-600`; button restores to default.

**Note textarea**
- *Default* — atoms.Input.tsx rules; placeholder "Optional — what changed and why? The agent will read this."
- *Focus* — focus ring.
- *Filled* — text appears `font-mono`.
- *Disabled* (during submit) — opacity-60.
- *Error* — N/A; note is optional and unconstrained.
- *Empty* — placeholder visible.

### Responsive behavior

| Breakpoint | Layout change |
|---|---|
| **375px** | Card `⋯` button is always visible (no hover-reveal — touch devices have no hover). Replace dialog opens fullscreen via the existing `FeedbackSheet` pattern (slide-up from bottom, `width: 100vw; height: 100dvh`); thumbnail row stacks above the drop zone instead of side-by-side. Note textarea grows to `min-h-[120px]`. Action row becomes a sticky bottom bar inside the sheet so Cancel / Replace stay visible while the keyboard is open. |
| **768px** | Card `⋯` becomes hover-reveal (`opacity-0 group-hover:opacity-100` with `group-focus-within:opacity-100` for keyboard) — cards on hover/focus reveal the menu trigger. Replace dialog renders as a centered `<dialog>` with `max-w-[560px]`. |
| **1280px** | Full layout as drawn — `⋯` hover-reveal on cards, dialog `max-w-[640px]` centered with the existing scrim. Thumbnail + drop zone side-by-side (2-column grid inside the dialog body) at `min-w-[600px]`. |

### Navigation flows

- **Happy path:** Card `⋯` → menu opens → "Replace this output…" → dialog opens, focus on drop zone → drop file → file matches mime → optional note typed → "Replace" → multipart POST → server writes file to disk under the existing stage outputs path, updates baseline SHA in `state.json`, broadcasts WS frame `output_replaced` → dialog closes, card body refreshes, success toast on the card "Output replaced — next tick will assess impact" + the card gets a yellow left-border 3px stripe (using `border-l-amber-400` from the safelist) + a new "manual change pending" chip in the footer.
- **Mime mismatch flow:** Drop file → mime warning surfaces → user clicks `[override type ▾]` → micro-dropdown lets them confirm "Yes, change `text/html` → `image/png`" → on confirm the warning clears and the Replace button becomes enabled. The note textarea pre-fills with "Type changed: text/html → image/png" so the agent has explicit context.
- **Cancel:** Esc / backdrop / Cancel button → dialog closes, no state change. Focus returns to the `⋯` trigger.
- **Submit error:** Network failure → dialog stays open, drop zone shows last-staged file, error toast inside dialog at action row, Replace button becomes "Retry".
- **Concurrent change:** If WS frame `output_replaced` arrives for the same artifact while the dialog is open (someone else replaced it from another browser), dialog shows a non-dismissable banner at top: "This output was just replaced by another user. Your draft will overwrite theirs — close to keep theirs, or Replace to overwrite." This is the only place this intent's design surfaces multi-user concurrency awareness; everything else is single-user.

### Accessibility requirements

- `⋯` trigger: `aria-label="Output actions for {artifact-name}"` (interpolated per card with the actual artifact filename — see SPA-UI-SPECS.md §0 conflict resolution #4 and §2.4 / §2.6 for the canonical string), `aria-haspopup="menu"`, `aria-expanded` reflects popover open state.
- Popover: `role="menu"`, items `role="menuitem"`, arrow keys navigate, Enter / Space activates, Esc closes and returns focus to the trigger.
- Replace dialog: native `<dialog>` so the focus trap and Esc-to-close are browser-native. `aria-labelledby` on the dialog title, `aria-describedby` on the body. Focus on open lands on the drop zone (primary action). Focus on close returns to the `⋯` trigger.
- Drop zone keyboard path: same as Screen 1.
- Mime-mismatch warning: announced via `aria-live="assertive"` (it's a blocking validation, not a decoration).
- Color is not the only signal: every state pairs an icon (`AlertCircle`, `CheckCircle`, etc.) with the text and the color.
- Touch targets ≥ 44×44 on mobile per the global rule.
- The dialog must respect `prefers-reduced-motion` — backdrop fade and slide-up are clamped to 0.01ms via the existing global rule in `index.css`. The `unit-flash` confirmation animation on the card after replacement is also gated by the existing reduced-motion rule.

---

## Screen 3 — Drift-Detected Banner

**Where it lives.** Sticky banner that mounts inside the main pane of `ReviewPage`, between the existing `StageBanner` and `RereviewBanner`. Renders only when the SPA's WS feed indicates a `drift_detected` flag on the active stage's `state.json` (i.e. the pre-tick gate has observed SHA divergence and queued a `manual_change_assessment` action for the next tick — but the next tick has not yet run). Hidden once the tick fires (action transitions from queued to handled).

**Why a banner, not a toast or modal.** The drift event is informational, not interrupting. The user did the modification — they know they did it. The banner exists so a different person opening the review tab understands "the system noticed your change; here's what it'll look at next."

### Layout structure

```
┌─ Main pane (ReviewPage > Main) ────────────────────────────────┐
│  ┌─ StageBanner (existing, sticky top) ────────────────────┐  │
│  │ [current pill] design  [Phase ●●●○ 3/4] [In Review]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ DriftBanner (new, sticky just below StageBanner) ──────┐  │
│  │ [⚠ icon]  Out-of-band change detected                   │  │
│  │           3 files changed since the last tick.           │  │
│  │           The next workflow tick will assess impact.     │  │
│  │           [▾ See files]                    [Run now ↻]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ RereviewBanner (existing, conditional) ────────────────┐  │
│  │ [if previous_review snapshot]                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [tabs + content as today]                                     │
└────────────────────────────────────────────────────────────────┘
```

When expanded:

```
┌─ DriftBanner (expanded) ──────────────────────────────────────┐
│ [⚠ icon]  Out-of-band change detected                         │
│           3 files changed since the last tick.                │
│           The next workflow tick will assess impact.          │
│           [▴ Hide files]                       [Run now ↻]   │
│ ─────────────────────────────────────────────────────────────│
│  Changed (3):                                                 │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [stage chip]  design   stages/design/outputs/hero.html   ││
│  │   modified 4m ago                       [view diff →]    ││
│  │ ─────────────────────                                    ││
│  │ [intent chip] knowledge knowledge/brand-guide.pdf        ││
│  │   added 12m ago                         [open file →]    ││
│  │ ─────────────────────                                    ││
│  │ [stage chip]  inception stages/inception/notes.md        ││
│  │   modified 18m ago                      [view diff →]    ││
│  └──────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
```

- Banner container: `bg-amber-50 dark:bg-amber-900/20`, `border border-amber-200 dark:border-amber-900/60`, `border-l-4 border-l-amber-500`, `rounded-md`, `mx-6 mt-3 px-4 py-3`. (Uses the existing safelist-covered `border-l-[3px]` pattern but at `border-l-4` for stronger emphasis — informational, not error.)
- Header row: 32px, icon (`AlertTriangle` Lucide, `w-5 h-5 text-amber-600`), title `text-sm font-semibold text-amber-900 dark:text-amber-200`, body `text-xs text-amber-800 dark:text-amber-300`, disclosure caret + "Run now" pinned right.
- "Run now" button: secondary style, `bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60`, `rounded-md text-xs font-semibold px-2.5 py-1`, leading icon `RefreshCw` (no spin unless mid-request — see states).
- Expanded list: same row pattern as the staged-files list from Screen 1 — 36px tall rows, stage / intent chip on left, monospace path (truncate-mid for long paths), timestamp + action on the right.
- Stage chip / intent chip — reuses existing `KIND_BADGE` palette: stage = `bg-violet-50 text-violet-700`, intent = `bg-sky-50 text-sky-700`.

### Component inventory

| Component | Location | Purpose | Key props |
|---|---|---|---|
| `DriftBanner` (new molecule) | `molecules/DriftBanner.tsx` | Owns expand/collapse, renders header + optional list | `drift: DriftEntry[]`, `onRunNow()`, `onOpenFile(entry)`, `onViewDiff(entry)`, `running?: boolean` |
| `DriftEntryRow` (new atom) | `atoms/DriftEntryRow.tsx` | One row in the expanded list | `entry: { path, stage, intent, action: 'modified'\|'added'\|'deleted', age }`, `onView` |
| Reuse `KIND_BADGE` palette from `StageReview.tsx` | — | Visual continuity with knowledge / output kinds | — |

### Interaction states (per element)

**Banner container**
- *Default* — visible whenever `drift_detected === true` for the session's active stage.
- *Hover* — N/A on container; rows have hover.
- *Focus* — N/A on container; only its controls are focusable.
- *Active* — N/A.
- *Disabled* — N/A; banner is read-only-ish (controls have their own states).
- *Loading* — when `running === true`, container gains a `aria-busy="true"` attribute and the "Run now" spinner spins; everything else stays interactive.
- *Error* (run-now failed) — error message replaces the body text: `"Run failed — ${reason}. The change will still be picked up by the next scheduled tick."`. Container border color shifts to `border-rose-300` for the duration; auto-clears after 8s or next interaction.
- *Empty* — banner does NOT render when drift list is empty (the WS frame would carry `drift_detected=false`).

**Disclosure caret ("See files" / "Hide files")**
- *Default* — `text-amber-700 dark:text-amber-300` text + chevron, underline-on-hover.
- *Hover* — underline.
- *Focus* — focus ring.
- *Active* — pressed state via `bg-amber-100`.
- *Disabled* — N/A.

**"Run now ↻" button**
- *Default* — amber-100 chrome.
- *Hover* — amber-200.
- *Focus* — amber focus ring (matching the banner palette: `ring-amber-500`).
- *Active* — amber-300.
- *Disabled* — when there's no active intent / no live MCP connection (status row in header signals this elsewhere).
- *Loading* — leading icon spins (gated by reduced-motion — under reduced-motion, it stays static and the label switches to "Running…").
- *Error* — restores; banner-level error state does the messaging.

**Drift entry row**
- *Default* — transparent.
- *Hover* — `bg-amber-100/40 dark:bg-amber-900/30`.
- *Focus* (entire row is keyboard-focusable when it has a primary action) — focus ring around the row.
- *Active* — `bg-amber-200/60`.
- *Disabled* — N/A.
- *Loading / Error / Empty* — N/A on individual rows.

### Responsive behavior

| Breakpoint | Layout change |
|---|---|
| **375px** | Banner stays full-width below the stage banner. The summary line wraps to two lines; "Run now" + disclosure caret stack vertically below the summary text in a single right-aligned column. Expanded entry rows: chip stacks above the path (path drops to its own line `pl-2` indented, font-mono `text-[11px]`); timestamp + action right-align on a third line. Touch targets 44px on every action. |
| **768px** | Header row stays single-line if it fits; "Run now" + caret remain right-aligned. Expanded rows go to 2 lines (chip + path + timestamp inline; action button below right). |
| **1280px** | Full single-line entry rows as drawn. Banner participates in the same `mx-6 lg:mx-10` gutter as the existing `StageBanner` so margins line up. |

### Navigation flows

- **Path A — Notice and proceed:** User opens review tab → drift banner is visible → user reads the message ("3 files changed, next tick will assess") → goes about their business; the next `haiku_run_next` invocation will fire `manual_change_assessment` → banner disappears once that completes → results surface in `StageReview` Outputs/Knowledge tabs (changed cards get the `border-l-amber-400` left-stripe + "manual change pending" chip until the assessor publishes its disposition).
- **Path B — Force the tick:** User clicks "Run now" → POST to `/api/run-next` (existing endpoint or wrapper) → button enters loading → server runs the tick → WS broadcasts `tick_complete` → banner unmounts → cards refresh → if the assessment produced FBs, those appear in the Feedback list with origin badge `agent-detected`.
- **Path C — Inspect a file:** User clicks "view diff →" on a row → opens a side panel (out of scope for this brief — depends on a diff component sibling). Or clicks "open file →" for added files → opens the artifact card in the relevant tab via the existing `openDetail()` pattern.
- **Path D — Banner stale:** If the banner is open and a `tick_complete` frame arrives, the banner unmounts immediately (no stale state). If a new drift event arrives while the banner is already visible, the count increments and the new entry slides into the expanded list.

### Accessibility requirements

- Banner container: `role="status"`, `aria-live="polite"` so a screen reader hears the drift announcement when it appears (but does not interrupt).
- Disclosure: standard `aria-expanded` + `aria-controls` pattern wired to the entry list region.
- "Run now" button: standard button semantics; loading state announced via `aria-busy="true"` on the button.
- Entry rows that have a primary action (view diff / open file) are wrapped in `<button>` for keyboard activation; rows that don't have a primary action are non-interactive `<div>` with no focus.
- Path text uses `<bdi>` so RTL-locale paths render correctly even in mixed-direction sentences (defensive — actual content is always LTR).
- Color contrast: amber-800 on amber-50 (light) and amber-200 on amber-900/20 (dark) both clear AA per `DESIGN-TOKENS.md`. The stripe border + leading icon ensure color-blind users get the warning shape, not just the hue.
- Reduced motion: "Run now" spinner stops spinning and the banner unmount fade is replaced by an immediate disappearance.
- The banner is placed BEFORE the tabs in DOM order so screen readers and keyboard users encounter the system-level alert before drilling into stage content.

---

## Cross-Screen Concerns

### Token discipline

Every color/spacing/radius reference above maps to existing tokens declared in `packages/haiku-ui/src/index.css` `@theme` block or to the Tailwind v4 default palette already covered by the safelist in `tailwind.config.ts`. No new hex values, no new ad-hoc tokens. New tokens needed (handed off to sibling tokens artifact):

- `--color-drift-bg` → maps to `oklch` of `bg-amber-50`.
- `--color-drift-fg` → maps to `oklch` of `text-amber-800`.
- `--color-drift-stripe` → maps to `oklch` of `border-amber-500`.

These are aliases for clarity in code; the underlying values are existing amber-N stops and need no palette extension.

### Keyboard navigation order (full page)

When all three new surfaces are simultaneously visible (drift banner expanded + sidebar with knowledge upload panel expanded + outputs tab focused with one card menu open), Tab order is:

1. Header — H·AI·K·U brand, intent breadcrumb, theme toggle.
2. Stage progress strip — each stage button.
3. Drift banner — disclosure caret, "Run now", first entry row, second row, …
4. Sidebar feedback list — first feedback card, its action menu, …
5. Sidebar knowledge upload — disclosure caret, drop zone, first staged row + remove, …, destination select, Upload, Cancel.
6. Sidebar composer — textarea, resolution radio, Add, Smart-decision button.
7. Main outputs tab — tab bar (Overview / Units / Knowledge / Outputs), then each output card's `⋯` trigger.

When a modal opens (Replace dialog), focus moves to the modal and Tab cycles within the modal until close.

### Touch targets

Every pointer-activated control on mobile/tablet meets the 44×44 minimum via the existing `.touch-target` utility (declared in `index.css` lines 94–112). Sub-44 visual elements (the small `×` in staged-file rows, the `⋯` on output cards) use `.touch-target.touch-target--hit-area` to inflate the hit area without changing the visual.

### Live regions

Three new `aria-live` regions are introduced:

| Region | Politeness | What it announces |
|---|---|---|
| Knowledge upload panel status (Screen 1, panel bottom) | polite | Files staged / removed / validation rejections / upload progress milestones / final summary. |
| Replace dialog mime-mismatch warning (Screen 2) | assertive | Mime mismatch is blocking; assertive interrupts. Cleared the moment the user resolves it. |
| Drift banner container (Screen 3) | polite | The banner appearing is the announcement; updates to entry count are also announced. |

These are purely additive — none collide with the existing live regions in the review SPA (feedback-status flash, decision submission).

### Empty / loading / error parity

Every screen above defines all six states: default, hover, focus, active, disabled, error, loading, empty (the eight from the quality bar). The "empty" state for drift banner means the banner does not render at all — it is a state of the parent, not a state of the component itself; the drift banner has no separate empty-state copy because it should not exist when there is no drift. Same logic applies to the staged-files list inside the upload panel: empty list = list region hidden, not an empty-state placeholder.

---

## Design Gaps

| Gap | Disposition | Rationale |
|---|---|---|
| Diff viewer for "view diff →" rows in Screen 3 | **Deferred** | Requires sibling architecture work — a diff component, the API endpoint that returns before/after content from baseline SHA + working tree, and the side-panel layout. Tracked as a follow-up; the row's "view diff →" link surfaces the gap to the user explicitly. The intent's MVP works without it: the user can always open the file via the OS path or the existing artifact card. |
| Multi-user concurrency UX beyond the dialog-level banner in Screen 2 | **Out of scope** | Per the intent description, concurrency is eventual-consistency: "next `haiku_run_next` tick observes drift and reacts." Real-time presence indicators (avatars, live cursors) are not in scope. The dialog-level "Someone else replaced this" banner is a defensive minimum. |
| Per-file size/type override controls in Screen 1 | **Designed (basic) — extended override deferred** | The drop zone rejects on mime/size at the validation step today. A future enhancement could let the user manually convert (e.g. transcode an unsupported video format on-device) — out of scope for this intent. |
| Visual diff between old and new replacement output in Screen 2 | **Deferred** | A side-by-side preview would let the user verify "yes, this is the file I meant to upload" before committing. Today the dialog shows only the existing output thumbnail and the staged file's metadata. Worth a v2 once the diff component lands. |
| Scheduled / batched reassessment in Screen 3 | **Out of scope** | "Run now" is the only manual override. Auto-throttling (e.g. coalesce 5 drift events in 30s into one assessment) is a workflow-engine concern, not a design surface. |
| Autopilot-mode disclosure | **Deferred** | When the user is in autopilot, the drift banner's "Run now" is functionally redundant (the next tick is imminent). The banner could collapse to a one-liner. Punt to v2 once we have telemetry on autopilot drift frequency. |
| Stage-baseline reset UI | **Out of scope** | If a user wants to "accept all current state as the new baseline" without an assessment, that's an MCP tool call (`haiku_drift_baseline_reset` or similar). Surfacing it in the SPA is a v2 concern; CLI-only is acceptable for the MVP. |
| Drag-drop into the artifact card body itself (Screen 2) | **Deferred** | Today the affordance is `⋯ → Replace this output…`. A future enhancement could let the user drag a file directly onto the card's iframe to trigger replacement. Punt — discoverability is fine via the menu, and direct-drag on iframes is browser-flaky. |
| Mobile drag-drop in Screen 1 | **Out of scope** | Touch devices don't have meaningful drag-from-file-system semantics. The mobile path is "tap to open native file picker," which is the universally-supported equivalent. |
| Inline "explain why this changed" prompt for the agent on the drift banner | **Out of scope** | The agent's `manual_change_assessment` action will produce its own classification (ignore / inline-fix / surface-as-FB / revisit). Adding a user-driven "tell the agent how to interpret this" prompt would short-circuit that. The optional note field in Screen 2's Replace dialog covers the legitimate "I want to leave the agent a hint" case. |
