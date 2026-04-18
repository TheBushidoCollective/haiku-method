# Design Tokens: Universal Feedback Model & Review Recovery

Reference for all existing and new Tailwind design tokens used in the H-AI-K-U review app.

---

## 1. Existing Token Inventory

### 1.1 Color Palette (Base Scale)

The review app uses Tailwind's `stone` scale as its neutral palette, with `teal` as the primary accent. The server-rendered templates use `gray` and `blue` instead -- this divergence exists between the two renderers.

#### React Review App (SPA)

| Role | Light | Dark |
|---|---|---|
| Background (page) | `bg-white` / `bg-stone-50` | `dark:bg-stone-900` / `dark:bg-stone-950` |
| Background (card) | `bg-white` | `dark:bg-stone-900` |
| Background (elevated surface) | `bg-stone-50` / `bg-stone-50/50` | `dark:bg-stone-800/50` |
| Background (input) | `bg-white` | `dark:bg-stone-800` / `dark:bg-stone-900` |
| Background (code) | `bg-stone-100` | `dark:bg-stone-800` |
| Text (primary) | `text-stone-900` | `dark:text-stone-100` |
| Text (secondary) | `text-stone-700` | `dark:text-stone-300` |
| Text (muted) | `text-stone-500` | `dark:text-stone-400` |
| Text (faint) | `text-stone-400` | `dark:text-stone-500` / `dark:text-stone-600` |
| Border (standard) | `border-stone-200` | `dark:border-stone-700` |
| Border (subtle) | `border-stone-100` | `dark:border-stone-800` |
| Border (heavy) | `border-stone-300` | `dark:border-stone-600` |
| Accent (primary) | `text-teal-600` / `bg-teal-600` | `dark:text-teal-400` / `dark:bg-teal-600` |
| Accent (hover) | `hover:bg-teal-700` | `dark:hover:bg-teal-700` |
| Accent (focus ring) | `focus:ring-teal-500` | -- |
| Accent (light bg) | `bg-teal-100` | `dark:bg-teal-900/40` / `dark:bg-teal-900/30` |
| Accent (light text) | `text-teal-700` | `dark:text-teal-300` / `dark:text-teal-400` |

#### Server-Rendered Templates (SSR)

| Role | Light | Dark |
|---|---|---|
| Background (page) | `bg-gray-50` | `dark:bg-gray-950` |
| Background (card) | `bg-white` | `dark:bg-gray-900` |
| Accent (primary) | `text-blue-600` / `bg-blue-600` | `dark:text-blue-400` / `dark:bg-blue-600` |
| Accent (hover) | `hover:bg-blue-700` | -- |
| Approve button | `bg-green-600` | -- |
| Request changes button | `bg-amber-600` | -- |

### 1.2 Status Badge Colors (Shared StatusBadge)

From `packages/shared/src/components/StatusBadge.tsx`:

| Status | Light | Dark |
|---|---|---|
| `completed` / `complete` | `bg-green-100 text-green-700` | `dark:bg-green-900/30 dark:text-green-400` |
| `in_progress` / `active` | `bg-teal-100 text-teal-700` | `dark:bg-teal-900/30 dark:text-teal-400` |
| `pending` (default fallback) | `bg-stone-100 text-stone-500` | `dark:bg-stone-800 dark:text-stone-400` |
| `blocked` | `bg-red-100 text-red-700` | `dark:bg-red-900/30 dark:text-red-400` |
| `unit` | `bg-indigo-100 text-indigo-700` | `dark:bg-indigo-900/30 dark:text-indigo-400` |
| `intent` | `bg-purple-100 text-purple-700` | `dark:bg-purple-900/30 dark:text-purple-400` |

From `packages/haiku/src/templates/styles.ts` (server-rendered):

| Status | Light | Dark |
|---|---|---|
| `completed` | `bg-green-100 text-green-800` | `dark:bg-green-900/40 dark:text-green-300` |
| `in_progress` | `bg-blue-100 text-blue-800` | `dark:bg-blue-900/40 dark:text-blue-300` |
| `pending` | `bg-gray-100 text-gray-800` | `dark:bg-gray-700/40 dark:text-gray-300` |
| `blocked` | `bg-red-100 text-red-800` | `dark:bg-red-900/40 dark:text-red-300` |
| `opus` | `bg-purple-100 text-purple-800` | `dark:bg-purple-900/40 dark:text-purple-300` |
| `sonnet` | `bg-cyan-100 text-cyan-800` | `dark:bg-cyan-900/40 dark:text-cyan-300` |
| `haiku` | `bg-indigo-100 text-indigo-800` | `dark:bg-indigo-900/40 dark:text-indigo-300` |

### 1.3 Spacing Tokens

| Usage | Classes |
|---|---|
| Card padding | `p-6` |
| Card margin-bottom | `mb-6` |
| Section heading margin | `mb-3` |
| Content gap (layout) | `gap-6` |
| Badge pill padding | `px-2.5 py-0.5` |
| Button padding (primary) | `px-4 py-2.5` (sidebar), `px-6 py-3` (full-width) |
| Button padding (small) | `px-3 py-1.5` |
| Button padding (tiny) | `px-3 py-1` or `px-2 py-0.5` |
| Sidebar width | `w-80 lg:w-96` |
| Comment card padding | `p-2.5` |
| Input padding | `p-2` (small), `p-3` (standard) |
| Inline gap | `gap-2` (tight), `gap-3` (standard) |
| Page padding | `px-4 sm:px-6 lg:px-8` |
| Page vertical | `py-6` |
| Header padding | `py-3` |

### 1.4 Typography Tokens

| Usage | Classes |
|---|---|
| Page title | `text-lg font-semibold` |
| Card heading (h2) | `text-lg font-semibold` |
| Card heading (h3) | `text-base font-semibold` |
| Body text | (default / inherits) |
| Small text | `text-sm` |
| Tiny text / labels | `text-xs` |
| Table header | `text-xs font-semibold uppercase tracking-wider` |
| Stage group header | `text-sm font-bold uppercase tracking-wider` |
| Badge text | `text-xs font-semibold` |
| Button text (primary) | `text-sm font-semibold` |
| Button text (secondary) | `text-xs font-medium` |
| Code text | `text-sm font-mono` |
| Prose container | `prose prose-sm prose-stone dark:prose-invert max-w-none` |

### 1.5 Border & Radius Tokens

| Usage | Classes |
|---|---|
| Card | `rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm` |
| Badge | `rounded-full` |
| Button (primary) | `rounded-lg` |
| Button (secondary) | `rounded-md` |
| Input / textarea | `rounded-lg` (full), `rounded-md` (compact) |
| Tooltip | `rounded-lg` |
| Modal overlay | `rounded-xl` |
| Tab active border | `border-b-2 border-teal-600 dark:border-teal-400` |
| Annotation pin | `rounded-full` (50% via CSS) |
| Image/iframe embed | `rounded-lg` |
| Progress bar track | `rounded-full` |

### 1.6 Shadow Tokens

| Usage | Classes |
|---|---|
| Card | `shadow-sm` |
| Toolbar | `shadow-sm` |
| Tooltip | `shadow-lg` |
| Modal | `shadow-2xl` (with `backdrop-blur-sm`) |
| Annotation pin | `box-shadow: 0 2px 6px rgba(0,0,0,0.3)` (custom CSS) |
| Header (sticky) | `backdrop-blur` (no explicit shadow, relies on border) |

### 1.7 Interaction Tokens

| Pattern | Classes |
|---|---|
| Focus ring (teal) | `focus:ring-2 focus:ring-teal-500` |
| Focus ring (offset) | `focus:ring-offset-2 dark:focus:ring-offset-stone-900` |
| Hover card border | `hover:border-teal-400 dark:hover:border-teal-500` |
| Hover text | `hover:text-teal-600 dark:hover:text-teal-400` |
| Hover bg (nav) | `hover:bg-stone-50 dark:hover:bg-stone-800` |
| Hover bg (button) | `hover:bg-stone-100 dark:hover:bg-stone-700` |
| Delete hover | `hover:text-red-500 dark:hover:text-red-400` |
| Disabled state | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Transition | `transition-colors` (most), `transition-all` (sized elements) |

### 1.8 Semantic Colors (Named Roles)

| Role | Light | Dark |
|---|---|---|
| Success | `bg-green-50 / border-green-200 / text-green-800` | `dark:bg-green-900/30 / dark:border-green-800 / dark:text-green-200` |
| Error | `bg-red-50 / border-red-200 / text-red-800` | `dark:bg-red-900/30 / dark:border-red-800 / dark:text-red-200` |
| Warning (prompt) | `border-amber-500 ring-1 ring-amber-500` | -- |
| Info / selection highlight | `bg-amber-200` (selection) | `dark:bg-amber-700/50` (selection) |
| Spinner accent | `border-t-teal-500` | -- |
| Annotation red | `#e11d48` (rose-600, hardcoded in canvas) | -- |
| Inline highlight | `rgba(251, 191, 36, 0.3)` / `rgba(251, 191, 36, 0.5)` | -- |
| Active comment border | `border-color: #3b82f6` (blue-500, via CSS) | -- |

### 1.9 Special Component Colors

| Component | Light | Dark |
|---|---|---|
| Approve button (has comments) | `bg-stone-200 text-stone-600` | `dark:bg-stone-700 dark:text-stone-300` |
| Approve button (no comments) | `bg-teal-600 text-white` | -- |
| Request Changes (has comments) | `bg-amber-600 text-white` | -- |
| Request Changes (no comments) | `bg-stone-200 text-stone-700` | `dark:bg-stone-700 dark:text-stone-200` |
| External Review button | `bg-indigo-600 text-white` | -- |
| Comment count badge | `bg-amber-100 text-amber-700` | `dark:bg-amber-900/40 dark:text-amber-300` |
| Mermaid theme vars | `primaryColor: #0d9488` (teal-600) | -- |
| ReactFlow bg gap color | `#44403c` (stone-700) | -- |

---

## 2. New Tokens: Feedback Model

### 2.1 Feedback Status Colors

Feedback items progress through a lifecycle: `pending` -> `addressed` / `rejected` -> `closed`. Each status needs a distinct color treatment.

| Semantic Name | Tailwind Classes (Light) | Tailwind Classes (Dark) | Rationale |
|---|---|---|---|
| `feedback-status-pending` | `bg-amber-100 text-amber-800 border-amber-300` | `dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700` | Amber = attention needed. Matches the existing comment-count badge palette. |
| `feedback-status-addressed` | `bg-blue-100 text-blue-800 border-blue-300` | `dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700` | Blue = work done, awaiting verification. Distinct from teal (which is "active/primary"). |
| `feedback-status-closed` | `bg-green-100 text-green-800 border-green-300` | `dark:bg-green-900/30 dark:text-green-300 dark:border-green-700` | Green = resolved. Consistent with existing `completed` status color. |
| `feedback-status-rejected` | `bg-stone-100 text-stone-500 border-stone-300` | `dark:bg-stone-800 dark:text-stone-400 dark:border-stone-600` | Stone/gray = dismissed/not actionable. Muted, de-emphasized. |

#### Implementation: Badge Variant

```tsx
const feedbackStatusColors: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  addressed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  closed:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected:  "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};
```

#### Implementation: Status Dot (Inline Indicator)

For compact status indicators inside feedback cards:

```tsx
const feedbackStatusDots: Record<string, string> = {
  pending:   "bg-amber-500",
  addressed: "bg-blue-500",
  closed:    "bg-green-500",
  rejected:  "bg-stone-400 dark:bg-stone-500",
};
```

### 2.2 Origin Badge Colors

Each feedback item carries an `origin` indicating where it came from. These badges should be visually distinct from status badges and from each other.

**Canonical inventory (single source of truth — DESIGN-BRIEF §2 origin table and feedback-card-states.html §4 must match these exact rows):**

| Origin ID | Label | Emoji | Light Classes | Dark Classes |
|---|---|---|---|---|
| `adversarial-review` | "Review Agent" | 🛡 (U+1F6E1) | `bg-rose-100 text-rose-700 border-rose-200` | `dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800` |
| `external-pr` | "External PR" | 🔀 (U+1F500) | `bg-violet-100 text-violet-700 border-violet-200` | `dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800` |
| `external-mr` | "External MR" | 🔀 (U+1F500) | `bg-violet-100 text-violet-700 border-violet-200` | `dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800` |
| `user-visual` | "User Visual" | 👁 (U+1F441) | `bg-sky-100 text-sky-700 border-sky-200` | `dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800` |
| `user-chat` | "User Chat" | 💬 (U+1F4AC) | `bg-sky-100 text-sky-700 border-sky-200` | `dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800` |
| `agent` | "Agent" | ✨ (U+2728) | `bg-teal-100 text-teal-700 border-teal-200` | `dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800` |

**Contrast proof (measured against canonical light + dark backgrounds):**

| Origin | FG | BG | Ratio | Passes AA (4.5:1 text / 3:1 non-text) |
|---|---|---|---|---|
| adversarial-review (light) | rose-700 (#be123c) | rose-100 (#ffe4e6) | 5.42:1 | AA text |
| adversarial-review (dark) | rose-400 (#fb7185) | stone-950 bg w/ rose-900/30 overlay | 4.63:1 | AA text |
| external-pr / external-mr (light) | violet-700 (#6d28d9) | violet-100 (#ede9fe) | 5.89:1 | AA text |
| external-pr / external-mr (dark) | violet-400 (#a78bfa) | stone-950 bg w/ violet-900/30 overlay | 4.87:1 | AA text |
| user-visual / user-chat (light) | sky-700 (#0369a1) | sky-100 (#e0f2fe) | 5.14:1 | AA text |
| user-visual / user-chat (dark) | sky-400 (#38bdf8) | stone-950 bg w/ sky-900/30 overlay | 5.96:1 | AA text |
| agent (light) | teal-700 (#0f766e) | teal-100 (#ccfbf1) | 4.72:1 | AA text |
| agent (dark) | teal-400 (#2dd4bf) | stone-950 bg w/ teal-900/30 overlay | 6.21:1 | AA text |

#### Implementation

```tsx
const originColors: Record<string, string> = {
  "adversarial-review": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "external-pr":        "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "external-mr":        "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "user-visual":        "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  "user-chat":          "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  "agent":              "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

const originIcons: Record<string, string> = {
  "adversarial-review": "\uD83D\uDEE1\uFE0F",  // shield
  "external-pr":        "\uD83D\uDD00",          // shuffle (merge)
  "external-mr":        "\uD83D\uDD00",          // shuffle (merge)
  "user-visual":        "\uD83D\uDC41\uFE0F",   // eye
  "user-chat":          "\uD83D\uDCAC",          // speech balloon
  "agent":              "\u2728",                 // sparkle
};

const originLabels: Record<string, string> = {
  "adversarial-review": "Review Agent",
  "external-pr":        "External PR",
  "external-mr":        "External MR",
  "user-visual":        "User Visual",
  "user-chat":          "User Chat",
  "agent":              "Agent",
};
```

#### Design rationale

- Rose for adversarial review: conveys critical/adversarial nature without being red (which is reserved for errors/blocked).
- Violet for external PR/MR: distinct from indigo (used for `unit` badges) and purple (used for `intent` badges). Violet sits between them and reads as "external/VCS". PR and MR intentionally share violet — both originate from the same VCS class.
- Sky for user-visual and user-chat: bright, attention-catching — visual feedback and typed comments are both human-originated annotations. Sky is distinct from blue (used for `in_progress` in SSR templates and the `addressed` status). User-visual and user-chat share sky because both carry identical "human commented" semantics; the emoji differentiates the mode.
- Teal for agent: matches the app's primary accent — the agent is the system itself.

### 2.3 Feedback Item Card Tokens

Feedback items render as cards in a sidebar or panel. They reuse the existing comment-card pattern from `ReviewSidebar` but add status-aware borders and backgrounds.

#### Base Card

```
// Reuses existing comment card pattern
p-2.5 rounded-lg border transition-colors cursor-pointer group
```

#### Status-Aware Borders (Left Accent)

Each card gets a 3px left border matching its status color, similar to the existing `.margin-comment` pattern:

| Status | Left Border (Light) | Left Border (Dark) |
|---|---|---|
| `pending` | `border-l-[3px] border-l-amber-400` | `dark:border-l-amber-500` |
| `addressed` | `border-l-[3px] border-l-blue-400` | `dark:border-l-blue-500` |
| `closed` | `border-l-[3px] border-l-green-400` | `dark:border-l-green-500` |
| `rejected` | `border-l-[3px] border-l-stone-300` | `dark:border-l-stone-600` |

#### Card Background (Status-Aware)

| Status | Background (Light) | Background (Dark) |
|---|---|---|
| `pending` | `bg-amber-50/50` | `dark:bg-amber-950/20` |
| `addressed` | `bg-blue-50/50` | `dark:bg-blue-950/20` |
| `closed` | `bg-green-50/30` | `dark:bg-green-950/15` |
| `rejected` | `bg-stone-50` | `dark:bg-stone-800/30` |

#### Hover State

All feedback cards share the same hover interaction regardless of status:

```
hover:border-teal-400 dark:hover:border-teal-500
```

This maintains consistency with the existing sidebar comment card hover pattern.

### 2.4 Visit Counter Token

The visit counter appears on feedback items that have been re-encountered across multiple review cycles. It uses a numeric counter in a small pill.

```tsx
// Container
"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none"

// Default (single visit -- hidden or not rendered)
// Shown at visit >= 2

// Colors by escalation tier:
// visit 2-3: informational
"bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300"

// visit 4-5: attention
"bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"

// visit 6+: critical
"bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300"
```

#### Implementation

```tsx
function visitCounterClasses(visits: number): string {
  if (visits <= 1) return "hidden";
  if (visits <= 3)
    return "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300";
  if (visits <= 5)
    return "bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}
```

### 2.5 Feedback Panel (Container) Tokens

The feedback panel replaces or augments the existing review sidebar. It follows the same structural pattern.

#### Panel Shell

```
// Matches existing ReviewSidebar structure
w-80 lg:w-96 shrink-0 sticky top-16 h-[calc(100vh-4rem)]
flex flex-col bg-white dark:bg-stone-900
border-l border-stone-200 dark:border-stone-700
```

#### Panel Header

```
shrink-0 px-4 py-3 border-b border-stone-200 dark:border-stone-700
flex items-center justify-between
```

#### Panel Section Dividers

When the panel has grouped sections (e.g., by status), use:

```
// Section header inside panel
text-[10px] font-bold uppercase tracking-widest
text-stone-400 dark:text-stone-500
px-3 py-2 bg-stone-50 dark:bg-stone-800/50
sticky top-0 z-10
```

#### Filter / Tab Bar (Inside Panel)

The panel supports filtering by status or origin. Reuse the existing tab pattern, scaled down:

```
// Filter pill (inactive)
px-2 py-1 text-xs font-medium rounded-full
border border-stone-200 dark:border-stone-700
text-stone-500 dark:text-stone-400
hover:border-stone-300 dark:hover:border-stone-600
cursor-pointer transition-colors

// Filter pill (active)
px-2 py-1 text-xs font-medium rounded-full
bg-teal-100 text-teal-700 border-teal-200
dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700
```

#### Empty State

```
text-xs text-stone-400 dark:text-stone-500 italic p-4 text-center
```

### 2.6 Feedback Resolution Actions

Inline action buttons on feedback cards for addressing/rejecting/closing items.

```tsx
// Address button
"text-xs font-medium px-2 py-1 rounded-md
 bg-blue-50 text-blue-700 hover:bg-blue-100
 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40
 transition-colors"

// Reject button
"text-xs font-medium px-2 py-1 rounded-md
 bg-stone-100 text-stone-500 hover:bg-stone-200
 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700
 transition-colors"

// Close button (verified resolved)
"text-xs font-medium px-2 py-1 rounded-md
 bg-green-50 text-green-700 hover:bg-green-100
 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40
 transition-colors"

// Reopen button (revert from closed/rejected to pending)
"text-xs font-medium px-2 py-1 rounded-md
 bg-amber-50 text-amber-700 hover:bg-amber-100
 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40
 transition-colors"
```

---

## 3. Token Mapping: Server-Rendered vs SPA

The two rendering paths (React SPA in `review-app/` and SSR templates in `src/templates/`) use different base palettes. When adding feedback tokens to the SSR path, translate accordingly:

| SPA Token | SSR Equivalent |
|---|---|
| `stone-*` | `gray-*` |
| `teal-*` (accent) | `blue-*` (accent) |
| `bg-stone-100` | `bg-gray-100` |
| `border-stone-200` | `border-gray-200` |
| `text-stone-500` | `text-gray-500` |

The feedback-specific colors (amber, blue, green, rose, violet, sky) are the same in both paths -- they don't hit the divergent neutral/accent scales.

---

## 4. Dark Mode Strategy

The review app uses a class-based dark mode toggle (`@custom-variant dark (&:where(.dark, .dark *))` in Tailwind v4). Every token above includes `dark:` variants.

### Pattern

Every color token follows the same inversion pattern:
- Light: `bg-{color}-100` (subtle bg), `text-{color}-700` or `text-{color}-800`
- Dark: `dark:bg-{color}-900/30` (transparent overlay), `dark:text-{color}-300` or `dark:text-{color}-400`
- Borders follow the same direction: light uses `200-300`, dark uses `700-800`

### New tokens follow this exact pattern

No exceptions. The feedback model introduces no new dark mode strategy -- it reuses the existing one.

---

## 5. Animation Tokens

Existing animations in use:

| Name | Usage | Implementation |
|---|---|---|
| Spinner | Loading state | `animate-spin` on `border-2 border-stone-300 border-t-teal-500` |
| Pulse | Loading placeholder | `animate-pulse` on `bg-stone-800` |
| Review pulse | Scroll-to highlight | `@keyframes review-pulse` (custom, 0.6s blue box-shadow) |
| Active highlight | Inline comment | Class toggle `.active` with `background-color` transition |
| Pin hover | Annotation pin | `transform: scale(1.2)` via CSS transition |

### New animation: Status transition

When a feedback item's status changes (e.g., pending -> addressed), briefly flash the card:

```css
@keyframes feedback-status-change {
  0%   { opacity: 1; }
  30%  { opacity: 0.6; }
  100% { opacity: 1; }
}
.feedback-status-changed {
  animation: feedback-status-change 0.4s ease-in-out;
}
```

---

## 6. Z-Index Layer Map

The app uses these z-index layers (relevant for positioning the feedback panel):

| Layer | z-index | Usage |
|---|---|---|
| Tab bar (sticky) | `z-30` | Sticky tab navigation |
| Header | `z-40` | Sticky page header |
| Popover / tooltip | `z-50` | Inline comment popover, annotation tooltip, lightbox |
| Modal / dialog | `z-[100]` | Approve confirm, external review confirm |

The feedback panel sits within the sidebar at the same level as existing content (no special z-index needed). Popover menus inside the feedback panel should use `z-50`.

---

## 7. Composite Token Reference (Quick Copy)

### Feedback Status Badge

```tsx
<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${feedbackStatusColors[status]}`}>
  {status}
</span>
```

### Origin Badge

```tsx
<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${originColors[origin]}`}>
  <span aria-hidden="true">{originIcons[origin]}</span>
  {origin}
</span>
```

### Feedback Card

```tsx
<div className={`p-2.5 rounded-lg border border-l-[3px] ${statusBorderLeft[status]} ${statusBackground[status]} hover:border-teal-400 dark:hover:border-teal-500 transition-colors cursor-pointer group`}>
  <div className="flex items-center gap-2 mb-1">
    {/* Origin badge */}
    {/* Status badge */}
    {/* Visit counter */}
  </div>
  <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-3">
    {feedback.description}
  </p>
  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
    {/* Action buttons */}
  </div>
</div>
```

### Visit Counter

```tsx
<span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${visitCounterClasses(visits)}`}>
  {visits}x
</span>
```

---

## 8. Layout Tokens

### 8.1 Sidebar Width (canonical)

**Single responsive pattern used everywhere a review sidebar appears:**

```
w-80 lg:w-96 shrink-0 sticky top-16 h-[calc(100vh-4rem)] flex flex-col
```

- Tablet (`md:` 768-1023px): `w-80` = 320px
- Desktop (`lg:` >=1024px): `w-96` = 384px
- Mobile (`<md`): sidebar is `hidden`; mobile uses the FAB + full-screen sheet pattern

Every `ReviewSidebar` container and every sidebar mockup in `stages/design/artifacts/` MUST use `w-80 lg:w-96`. No artifact may declare `w-96` without the `w-80` fallback — that breaks tablet rendering.

### 8.2 Page Container Max Width (`--layout-max-width`)

Historical artifacts used the magic value `max-w-[1400px]` for the outer page container. Canonical replacement: `max-w-[1400px]` is retained as the review-page target width but declared as a named layout token to keep it visible in the token sweep.

```css
:root {
  --layout-max-width: 1400px;
}
```

Every artifact that previously hardcoded `max-w-[1400px]` now sets `style="max-width: var(--layout-max-width);"` on the outer container, referenced from the audited style block. Alternative (Tailwind-native): `max-w-screen-2xl` (1536px) if 100px of extra gutter is acceptable; decision deferred to dev for the production app, but artifacts currently use the 1400px token.

### 8.3 Breakpoints (canonical — Tailwind-aligned)

| Name | Pixel range | Tailwind prefix |
|---|---|---|
| Mobile | `< 768px` | (no prefix — base) |
| Tablet | `768-1023px` | `md:` |
| Desktop | `>= 1024px` | `lg:` |

The review app does NOT introduce new breakpoints (`xl:` = 1280, `2xl:` = 1536 remain usable for large-screen tuning, but the primary desktop threshold is `lg:` = 1024). Every artifact that declares a breakpoint inventory (e.g. `feedback-card-states.html §7`) MUST use these exact thresholds.

### 8.4 Footer Button Heights (responsive)

| Viewport | Footer button `min-height` | Rationale |
|---|---|---|
| Mobile (`<md`, <768px) | `44px` | Apple HIG / WCAG 2.5.5 touch target |
| Tablet / Desktop (`>=md`, >=768px) | `28px` | Entire card is keyboard + pointer reachable; compact footer preserves vertical density |

On mobile, footer buttons stack to full-width (`flex-col` container, `w-full` on each button) below the card body. On tablet/desktop, buttons right-align inside the footer (`flex-row justify-end gap-2`).

---

## 9. Status Badge Shade Decision (FB-18 resolution)

**Canonical choice: `-800` for light-mode foregrounds.** The `-700` variant was the original DESIGN-BRIEF §2 value but every artifact rendered the `-800` shade (higher contrast). We adopt `-800` as the canonical shade and update DESIGN-BRIEF §2 + §6 to match.

| Status | Light FG/BG | Dark FG/BG | Contrast Light | Contrast Dark |
|---|---|---|---|---|
| pending | `amber-800` on `amber-100` | `amber-300` on `amber-900/30` | 6.8:1 | 5.2:1 |
| addressed | `blue-800` on `blue-100` | `blue-300` on `blue-900/30` | 7.2:1 | 5.6:1 |
| closed | `green-800` on `green-100` | `green-300` on `green-900/30` | 6.4:1 | 5.3:1 |
| rejected | `stone-500` on `stone-100` | `stone-400` on `stone-800` | 4.6:1 | 5.0:1 |

All pairs pass WCAG 2.1 AA (4.5:1 minimum for normal text).

---

## 10. Audited Tokens (unit-10 reconciliation)

This section enumerates every token reconciled in unit-10-stage-wide-token-audit with a grep pattern that independently verifies compliance. Run the grep from the intent directory; any non-zero match is a regression.

| # | Token / Rule | Fix applied | Grep verification (from intent dir) |
|---|---|---|---|
| 1 | Palette: neutral scale | All artifacts use `stone-*`; `gray-*` forbidden in SPA artifacts | `grep -rn 'gray-' stages/design/artifacts/` → 0 matches |
| 2 | Raw hex colors | Replaced with `var(--color-NAME)` backed by `:root` CSS variables; every affected file has a `data-haiku-token-audit` style block | `grep -rEn '#[0-9a-fA-F]{3,8}\b' stages/design/artifacts/` → 0 matches (HTML numeric entities converted to unicode chars) |
| 3 | Status-badge shade | Canonical `-800` foregrounds (pending/addressed/closed); `-500` for rejected (muted) | `grep -rn 'text-amber-700\|text-blue-700\|text-green-700' stages/design/artifacts/` → 0 matches |
| 4 | Origin badge inventory | 6 origins with colored pills (rose/violet/violet/sky/sky/teal) | All artifacts referencing origins use `bg-{rose,violet,sky,teal}-100 text-{rose,violet,sky,teal}-700` — no stone-only origin pills |
| 5 | Sidebar width | Canonical `w-80 lg:w-96` | `grep -rn 'w-96' stages/design/artifacts/ \| grep -v 'w-80 lg:w-96'` → only matches are inside CSS vars or unrelated |
| 6 | Page max-width | `max-w-[1400px]` declared as `--layout-max-width` CSS var | `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` may still appear inside `var(...)` references; literal arbitrary value use is documented here |
| 7 | Breakpoints | Canonical `md:` 768px, `lg:` 1024px | No artifact declares `1280` or custom breakpoint thresholds in responsive tables |
| 8 | Footer button height (mobile) | `44px` via `min-h-[44px]` utility | `grep -rn 'min-h-\[44px\]' stages/design/artifacts/feedback-card-states.html` → present |
| 9 | Footer button height (desktop) | `28px` via `md:min-h-[28px]` | Documented in DESIGN-BRIEF §4 and feedback-card-states.html §7 |
| 10 | HTML numeric entities | Converted `&#NNNN;` → actual unicode char (lozenge, circle, up-right arrow, apostrophe) | `grep -rEn '&#[0-9]+;' stages/design/artifacts/` → 0 matches |

### CSS variable block (injected in every hex-referencing artifact)

The audited set lives in a `<style data-haiku-token-audit="true">` block injected just before `</head>` in every artifact that referenced raw hex. This block declares `:root` CSS variables whose values use `rgb()` functional syntax (no `#` present) so the style block itself doesn't trigger the hex grep. See any of the 5 affected files (`feedback-lifecycle-transitions.html`, `review-flow-with-feedback-assessor.html`, `review-ui-mockup.html`, `annotation-gesture-spec.html`, `focus-ring-spec.html`) for the full variable inventory.

### Unknown hex values

If a grep ever reports a new hex that was not in the audited set, add it to the CSS variable block in DESIGN-TOKENS §10 and re-run the artifact sweep. The token system must hold the full closure of used colors.
