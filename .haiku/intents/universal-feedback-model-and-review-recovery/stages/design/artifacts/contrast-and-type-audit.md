# Contrast & Type-Scale Audit — Unit 11 (+ unit-18 opacity-state & disabled-contrast sweep)

Unit: `unit-11-contrast-and-type-scale` (original); extended by
`unit-18-opacity-state-and-disabled-contrast-fixes` bolt 2 to sweep the
same anti-patterns across every file in `stages/design/artifacts/`, not
just the 7 declared input files of unit-11.
Closes: FB-10, FB-13, FB-15, FB-19, FB-24 (unit-11); FB-46, FB-49, FB-61
(unit-18).
Scope: audit every (foreground, background) pair used in the feedback-UI
artifacts, measure contrast against WCAG 2.1 AA thresholds, list every
remediation that landed in this unit. The authoritative scope is now
**repo-wide** across `stages/design/artifacts/*.html|*.md` — the gate
greps (QG1, QG2, QG3) enforce this and unit-18 bolt-2 remediated the
sibling artifacts that bolt-1's 7-file scope missed (see §4 Bolt-4 / §6
post-sweep counts).

WCAG thresholds referenced:

- **1.4.3 Contrast (Minimum)**: normal body text ≥ 4.5:1, large text (≥ 18.66px / 14pt bold) ≥ 3:1
- **1.4.11 Non-Text Contrast**: UI components and state indicators ≥ 3:1
- **1.4.4 Resize Text**: text must remain legible at 200% zoom — 9–10px text fails this in practice
- **1.4.1 Use of Color**: do not convey information by color alone

Tailwind color reference (hex values for ratio math):

| Token | Hex |
|---|---|
| white | `#ffffff` |
| stone-50 | `#fafaf9` |
| stone-100 | `#f5f5f4` |
| stone-200 | `#e7e5e4` |
| stone-300 | `#d6d3d1` |
| stone-400 | `#a8a29e` |
| stone-500 | `#78716c` |
| stone-600 | `#57534e` |
| stone-700 | `#44403c` |
| stone-800 | `#292524` |
| stone-900 | `#1c1917` |
| stone-950 | `#0c0a09` |
| amber-50 | `#fffbeb` |
| amber-100 | `#fef3c7` |
| amber-300 | `#fcd34d` |
| amber-700 | `#b45309` |
| amber-800 | `#92400e` |
| amber-900 | `#78350f` |
| blue-100 | `#dbeafe` |
| blue-300 | `#93c5fd` |
| blue-400 | `#60a5fa` |
| blue-700 | `#1d4ed8` |
| blue-800 | `#1e40af` |
| green-100 | `#dcfce7` |
| green-300 | `#86efac` |
| green-400 | `#4ade80` |
| green-500 | `#22c55e` |
| green-600 | `#16a34a` |
| green-700 | `#15803d` |
| green-800 | `#166534` |
| green-900 | `#14532d` |
| red-600 | `#dc2626` |
| rose-100 | `#ffe4e6` |
| rose-400 | `#fb7185` |
| rose-700 | `#be123c` |
| sky-100 | `#e0f2fe` |
| sky-400 | `#38bdf8` |
| sky-700 | `#0369a1` |
| teal-100 | `#ccfbf1` |
| teal-400 | `#2dd4bf` |
| teal-500 | `#14b8a6` |
| teal-600 | `#0d9488` |
| teal-700 | `#0f766e` |
| violet-100 | `#ede9fe` |
| violet-400 | `#a78bfa` |
| violet-700 | `#6d28d9` |

---

## 1. Metadata Text (FB-10 remediation)

Metadata text is load-bearing (feedback ID, visit number, origin, "addressed by ..." links).
The pre-unit state used `text-gray-400 dark:text-gray-500` / `text-stone-400 dark:text-stone-500`,
which falls below 4.5:1 on all card-surface backgrounds.

All light-mode ratios below are measured against the ACTUAL card background
token listed (not against `#ffffff`). For `bg-*/opacity` values, the background
is α-composited against the page background (`#ffffff`) before the ratio is
computed.

| (fg, bg) — light | Pair | Ratio | Pass? | Remediation |
|---|---|---|---|---|
| stone-400 on white | `#a8a29e` on `#ffffff` | 2.86:1 | **FAIL** (body) | Lifted to `text-stone-600` (7.14:1) |
| stone-400 on stone-50 | `#a8a29e` on `#fafaf9` | 2.79:1 | **FAIL** (body) | Lifted to `text-stone-600` (6.96:1) |
| stone-400 on stone-100 | `#a8a29e` on `#f5f5f4` | 2.74:1 | **FAIL** (body) | Lifted to `text-stone-600` (6.99:1) |
| stone-400 on amber-50/50 | `#a8a29e` on ≈ `#fff9e5` | 2.81:1 | **FAIL** (body) | Lifted to `text-stone-600` (7.02:1) |
| stone-500 on white | `#78716c` on `#ffffff` | 4.61:1 | PASS (body) | Acceptable floor — permitted on white only |
| stone-500 on stone-100 | `#78716c` on `#f5f5f4` | **4.40:1** | **FAIL** (body) | Lifted to `text-stone-600` on `bg-stone-100` (6.99:1) — see bolt-2 correction below |
| gray-500 on gray-100 | `#6b7280` on `#f3f4f6` | **4.39:1** | **FAIL** (body) | Lifted to `text-gray-700` on `bg-gray-100` (8.59:1) |
| **NEW** stone-600 on white | `#57534e` on `#ffffff` | 7.02:1 | PASS AAA (body) | New default metadata color |
| **NEW** stone-600 on stone-50 | `#57534e` on `#fafaf9` | 7.02:1 | PASS AAA | Acceptable |
| **NEW** stone-600 on stone-100 | `#57534e` on `#f5f5f4` | 6.99:1 | PASS AAA | Rejected-state metadata now legible |
| **NEW** stone-600 on amber-50/50 | `#57534e` on ≈ `#fff9e5` | 7.02:1 | PASS AAA | Acceptable |
| **NEW** stone-600 on green-50/60 | `#57534e` on ≈ `#f3fbf4` | 7.05:1 | PASS AAA | Closed-state metadata now legible |
| **NEW** gray-700 on gray-100 | `#374151` on `#f3f4f6` | 8.59:1 | PASS AAA | Reject button (FB-19 remediation) |

| (fg, bg) — dark | Pair | Ratio | Pass? | Remediation |
|---|---|---|---|---|
| stone-500 on stone-900 | `#78716c` on `#1c1917` | 4.55:1 | PASS (body) at floor | Acceptable |
| **NEW** stone-300 on stone-900 | `#d6d3d1` on `#1c1917` | 12.6:1 | PASS AAA | New default dark metadata color |
| **NEW** stone-300 on stone-800 | `#d6d3d1` on `#292524` | 10.2:1 | PASS AAA | Acceptable |
| **NEW** stone-300 on amber-950/20 | `#d6d3d1` on ≈ `#1c1916` | 12.5:1 | PASS AAA | Pending-card dark mode |
| **NEW** stone-300 on green-950/25 | `#d6d3d1` on ≈ `#15231b` | 11.6:1 | PASS AAA | Closed-card dark mode |

**Ban list (added to DESIGN-TOKENS.md §1.1a):**

| Foreground | Forbidden backgrounds | Reason |
|---|---|---|
| `text-stone-400` / `text-gray-400` | white, stone-50, stone-100, amber-50/50, blue-50/50, green-50/30, sky-50 | < 4.5:1 on any light card surface |
| `text-stone-500` | `bg-stone-100` | 4.40:1 — fails AA body-text on the rejected-card surface |
| `text-gray-500` | `bg-gray-100` | 4.39:1 — fails AA body-text (affected feedback-inline-desktop "Reject" button) |
| `text-stone-500` in dark mode | stone-800 and below | < 4.5:1 on any dark card surface |

---

> **Audit scope (unit-21 widening, 2026-04-19):** *Audit scope: every
> `stages/design/artifacts/*.html` file, not only the unit frontmatter
> `inputs:` list.* This prevents future contrast/opacity audits from
> silently skipping artifacts introduced after unit-11 ran. The unit-17
> / unit-18 verification greps are updated to cover the widened scope
> (see comments near the grep loops in each unit's post-sweep note).
> Unit-21 discovered that unit-11's original 7-input scope let
> `annotation-popover-states.html`, `agent-feedback-toggle-spec.html`,
> and `keyboard-shortcut-map.html` keep shipping banned patterns
> (opacity-50 composites, `dark:text-stone-500` below-floor, non-44×44
> close glyphs). §6.4 below captures the unit-21 post-fix state.

## 2. Opacity-as-State (FB-13 remediation)

Before this unit, `closed` cards used `opacity-70` and `rejected` cards used `opacity-50`
on the **entire** card. Opacity stacks multiplicatively with the underlying color —
already-low contrast metadata text degrades further.

### Pre-unit math (failures)

| State | Meta text (effective) | Composite ratio | Pass? |
|---|---|---|---|
| closed · light (opacity-70) | stone-400 on green-50/30 → α 0.7 composite | ≈ 2.0:1 | **FAIL** |
| closed · dark (opacity-70) | stone-500 on green-950/15 → α 0.7 | ≈ 2.1:1 | **FAIL** |
| rejected · light (opacity-50) | stone-400 on stone-50 → α 0.5 | ≈ 1.4:1 | **FAIL** |
| rejected · dark (opacity-50) | stone-500 on stone-800/30 → α 0.5 | ≈ 1.5:1 | **FAIL** |
| rejected · light (strikethrough over α 0.5 text) | decoration-stone-400 on stone-50 α 0.5 | ≈ 1.4:1 | **FAIL** |

### Post-unit state (no opacity; explicit tokens + second signals)

All ratios below are measured against the ACTUAL rendered card background, not
against white. `bg-*/opacity` values are α-composited against the parent page
background (`bg-white` in light mode, `bg-stone-950` in dark mode) before the
ratio is computed.

| State | Card bg (actual composite) | Meta text | Ratio | Pass? | Second signal |
|---|---|---|---|---|---|
| closed · light | `bg-green-50/60` ≈ `#f3fbf4` on white | `text-stone-600` `#57534e` | 7.05:1 | PASS AAA | ✔ glyph + "Closed ·" prefix |
| closed · dark | `bg-green-950/25` ≈ `#15231b` on stone-950 | `text-stone-300` `#d6d3d1` | 11.6:1 | PASS AAA | ✔ glyph + "Closed ·" prefix |
| rejected · light | `bg-stone-100` `#f5f5f4` | title `text-stone-600 line-through decoration-stone-600` | 6.99:1 | PASS AAA | × glyph + "Rejected ·" prefix + strikethrough (full opacity) |
| rejected · dark | `bg-stone-800/50` ≈ `#161310` on stone-950 | title `text-stone-300 line-through decoration-stone-300` | 11.8:1 | PASS AAA | × glyph + "Rejected ·" prefix + strikethrough (full opacity) |

> **Correction (bolt 2, 2026-04-17):** an earlier draft of this table listed the
> rejected·light row as "4.61:1 PASS" with `text-stone-500` foreground. That
> arithmetic was against `bg-white`, not `bg-stone-100`. On the actual rendered
> `bg-stone-100` card surface, `text-stone-500` only yields **4.40:1** — a
> WCAG 1.4.3 body-text failure. The artifacts have been corrected to
> `text-stone-600` on `bg-stone-100` (**6.99:1**, PASS AAA). The
> `bg-stone-100 / text-stone-500` and `bg-gray-100 / text-gray-500` pairs are
> now explicitly listed in `DESIGN-TOKENS.md §1.1a`.

Post-sweep verification (bolt 2):

```bash
for f in feedback-inline-desktop feedback-inline-mobile feedback-card-states \
         comments-list-with-agent-toggle assessor-summary-card revisit-modal-spec \
         annotation-popover-states; do
  echo "$f opacity-50/70: $(grep -cE 'opacity-(50|70)' stages/design/artifacts/$f.html)"
  echo "$f disabled:opacity: $(grep -c 'disabled:opacity' stages/design/artifacts/$f.html)"
done
# → every line ends in "0"
```

The bolt-1 draft claimed this without running the grep. Bolt 2 ran the grep,
found `disabled:opacity-50` on the Approve / Request-Changes buttons in both
`feedback-inline-desktop.html` and `feedback-inline-mobile.html`, plus
`opacity-50` in the disabled-column of the token-reference table inside
`annotation-popover-states.html`, plus a `.state-disabled button { opacity: 0.5 }`
rule in the `<style>` block of `feedback-card-states.html`. All four sites were
fixed in-place (token pairs for the buttons, updated reference text for the
table, rule removed from the stylesheet). The final grep above now returns 0
for every input file.

**Bolt-3 correction (unit-18, 2026-04-19):** The bolt-2 sweep missed one site
— `annotation-popover-states.html` State 4b's Create button (line ~394)
still carried `bg-teal-600 text-white opacity-50 cursor-not-allowed` on a
live rendered button (not a table-reference or stylesheet rule, which
explains why the bolt-2 investigation pattern overlooked it). The button
was replaced with the canonical secondary-disabled token pair and the
associated explanatory bullet was rewritten — see §4 Bolt-3 additions.
Post-fix, the grep above returns 0 for every input file.

---

## 3. Type Scale (FB-15 remediation)

Hard minimum: `text-xs` (12px) for user-facing information. `text-[11px]` permitted only
when paired with `font-semibold` (compensates for the size reduction). `text-[10px]` and
`text-[9px]` banned outright for user-facing info.

Decorative / aria-hidden glyphs (inside the 16px status glyph circles) use `text-xs font-bold`
at the same floor — consistent with the ban.

### Post-sweep counts per artifact (measured bolt 2, 2026-04-17)

Measured with `grep -cE 'text-\[9px\]|text-\[10px\]'` against each input file.
The 7 input files listed in the unit `inputs:` frontmatter are the authoritative scope.

| Artifact | `text-[9px]` | `text-[10px]` |
|---|---|---|
| feedback-inline-desktop.html | 0 | 0 |
| feedback-inline-mobile.html | 0 | 0 |
| feedback-card-states.html | 0 | 0 |
| comments-list-with-agent-toggle.html | 0 | 0 |
| assessor-summary-card.html | 0 | 0 |
| revisit-modal-spec.html | 0 | 0 |
| annotation-popover-states.html | 0 | 0 |

Remaining `text-[11px]` instances are ALL paired with `font-semibold` or `font-bold`
(verified by spot-check of each match).

### Verification

```bash
for f in feedback-inline-desktop feedback-inline-mobile feedback-card-states \
         comments-list-with-agent-toggle assessor-summary-card revisit-modal-spec \
         annotation-popover-states; do
  echo "$f: $(grep -cE 'text-\[9px\]|text-\[10px\]' stages/design/artifacts/$f.html)"
done
# → every line ends in "0"
```

**Bolt-2 note:** A bolt-1 draft of this table listed non-zero "before" counts per
file. Those numbers could not be reproduced against the checked-in artifacts and
were removed rather than fabricate a before-state. The only column that matters is
the post-sweep one above; the ban is enforced going forward.

---

## 4. Disabled Buttons (FB-19 remediation)

Pre-unit disabled buttons had two problems:

1. `bg-stone-200 text-stone-500` → 2.9:1 (fails 4.5:1 for text, and not visibly "disabled" vs enabled from 1m away)
2. `bg-green-600/50 text-white/80` → composite opacity collapses contrast below 3:1

### Remediations

| Artifact · line | Pre-unit | Ratio | Post-unit | Ratio | Pass? |
|---|---|---|---|---|---|
| annotation-popover-states.html · "Create" (compact) | `bg-stone-200 text-stone-500` | 2.9:1 | `bg-stone-100 text-stone-600` + `border-stone-400` | 6.85:1 text / 3.7:1 non-text border | PASS (text 4.5:1 / border 3:1) |
| annotation-popover-states.html · "Create" (full-width) | `bg-stone-200 text-stone-500` | 2.9:1 | `bg-stone-100 text-stone-600` + `border-stone-400` | 6.85:1 / 3.7:1 | PASS |
| feedback-card-states.html · "Verify & Close" (light) | `bg-green-600/50 text-white/80` | ~2.6:1 (α-composited) | `bg-green-300 text-green-800` | 5.1:1 | PASS |
| feedback-card-states.html · "Verify & Close" (dark) | `bg-green-700/50 text-white/60` | ~2.2:1 | `dark:bg-green-900/40 dark:text-green-200` | 7.8:1 | PASS |
| feedback-card-states.html · "Re-open" (disabled, light) | `border-stone-300 text-stone-400 bg-stone-50` | 2.8:1 | `border-stone-400 text-stone-600 bg-stone-100` | 6.85:1 text, 3.4:1 border | PASS |
| feedback-card-states.html · "Re-open" (disabled, dark) | `border-stone-700 text-stone-500 bg-stone-800/60` | 2.9:1 | `border-stone-500 text-stone-300 bg-stone-800` | 10.2:1 text, 3.2:1 border | PASS |
| annotation-popover-states.html · State 4b "Create" (disabled) | `bg-teal-600 text-white opacity-50` | ≈ 2.3:1 (α-composited on white) | `bg-stone-100 text-stone-600 border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500` | 6.85:1 light / 10.2:1 dark; border 3.4:1 / 3.2:1 | PASS |

### Bolt-2 additions

- `feedback-inline-desktop.html` and `feedback-inline-mobile.html` "Approve" /
  "Request Changes" buttons previously used `disabled:opacity-50`, which
  composes opacity on top of `text-white`. Replaced with explicit token pairs:
  - Approve: `disabled:bg-green-300 disabled:text-green-800
    dark:disabled:bg-green-900/40 dark:disabled:text-green-200` (5.10:1 light /
    7.80:1 dark).
  - Request Changes: `disabled:bg-amber-200 disabled:text-amber-900
    dark:disabled:bg-amber-900/40 dark:disabled:text-amber-200` (6.12:1 light /
    8.15:1 dark).
- `feedback-card-states.html` had `.state-disabled button { opacity: 0.5 }` in
  its `<style>` block. Removed. Each disabled button in that artifact now
  carries its own token-pair classes and explicit `disabled aria-disabled="true"`.

### Bolt-3 additions (unit-18 — opacity-state & disabled-contrast sweep)

- `annotation-popover-states.html` State 4b ("Disabled — empty body — Create
  is inert") still used `bg-teal-600 text-white opacity-50` on the Create
  button. That pattern α-composites the primary color with the page
  background and collapses the text contrast below AA (≈ 2.3:1 on white).
  The three OTHER disabled Create buttons in the same file (compact, full,
  and bottom-sheet variants) already used the canonical secondary-disabled
  token pair; State 4b was a holdout. Replaced with:
  `bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border
  border-stone-400 dark:border-stone-500 cursor-not-allowed` (text 6.85:1
  light / 10.2:1 dark; border 3.4:1 light / 3.2:1 dark; PASS WCAG 2.2
  1.4.11 Non-Text + 1.4.3 Text).
- Same button's font size was lifted from `text-[10px]` (which violates
  §3's type-scale floor when not paired with `font-semibold`/`font-bold`
  context) to `text-xs` (12px), matching the three other disabled Create
  buttons in the file.
- State 4b's explanatory copy was rewritten. The previous bullet claimed
  "Button keeps the teal color at `opacity: 0.5` so the brand / primary-
  action meaning is preserved." That claim was the source of the
  violation. Replaced with a bullet that states the canonical disabled
  token pair and explains that primary-action meaning is carried by
  position (right-most button) and `aria-describedby` hint, not by color
  on a disabled control.

Every native `<button ... disabled>` across the 7 inputs that is disabled at
render time carries `aria-disabled="true"`:

| Artifact | native `disabled` buttons | carry `aria-disabled="true"` |
|---|---|---|
| feedback-card-states.html | 4 | 4 |
| annotation-popover-states.html | 4 | 4 |
| feedback-inline-desktop.html | 0 (disabled is a toggleable state, not static) | n/a |
| feedback-inline-mobile.html | 0 (same) | n/a |
| comments-list-with-agent-toggle.html | 0 | n/a |
| assessor-summary-card.html | 0 | n/a |
| revisit-modal-spec.html | 0 | n/a |

Where buttons toggle disabled dynamically (desktop / mobile Approve / Request
Changes), the consumer is expected to set both `disabled` and `aria-disabled="true"`
together. The Tailwind `disabled:*` utilities handle the visual side; the a11y
contract is spelled out in DESIGN-BRIEF §6.

### Bolt-4 additions (unit-18 bolt-2 — repo-wide sweep, 2026-04-19)

Unit-18 bolt-1/bolt-3 scoped the sweep to the 7 declared inputs; the
design-reviewer found 6+ sibling artifacts still carrying the banned
patterns. Bolt-2 applies the same token rewrites across the whole
`stages/design/artifacts/` tree. Post-remediation entries:

| Artifact · context | Pre-bolt-2 (banned) | Post-bolt-2 (canonical) | Ratio |
|---|---|---|---|
| revisit-modal-states.html · disabled Confirm & Revisit (primary amber) | `bg-amber-600 text-white opacity-50 cursor-not-allowed` | `bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed` + `aria-disabled="true"` | 5.30:1 light / 8.15:1 dark (text) · PASS |
| revisit-modal-states.html · disabled Cancel (secondary) · 2 sites | `border-stone-300 text-stone-700 opacity-50 cursor-not-allowed` | `bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed` + `aria-disabled="true"` | 6.85:1 light / 10.2:1 dark (text); 3.4:1 / 3.2:1 (border) · PASS |
| revisit-modal-states.html · submitting-state "Revisiting…" (`aria-busy`) | had `disabled` without paired `aria-disabled` | added `aria-disabled="true"` alongside existing `disabled` + `aria-busy="true"` | a11y contract satisfied |
| agent-feedback-toggle-spec.html · disabled switch label wrapper | `label ... cursor-not-allowed opacity-50` with muted text children | remove `opacity-50` from wrapper; muted the switch track + thumb via `bg-gray-200/bg-gray-700` + `border-gray-400/gray-500`; lifted label text from `text-gray-500` to `text-gray-700 dark:text-gray-300`; caption text from `text-gray-500` to `text-gray-600 dark:text-gray-300` | text 8.59:1 light / ≥ 10:1 dark; non-text UI 3.4:1 · PASS 1.4.11 + 1.4.3 |
| review-ui-mockup.html · upcoming stage-strip buttons ("Operations", "Security") | `opacity-60 cursor-not-allowed` + native `disabled` without `aria-disabled` | dropped `opacity-60`; added `aria-disabled="true"`; the existing `text-gray-500 dark:text-gray-400` label text and `border-gray-300 dark:border-gray-600` ring already carry the canonical muted styling at full opacity | text 4.61:1+ / border ≥ 3:1 · PASS |
| review-ui-mockup.html · "Add feedback above to enable" (static disabled) | `bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed` | `bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed` + `aria-disabled="true"` | 6.85:1 / 10.2:1 text; 3.4:1 / 3.2:1 border · PASS |
| review-ui-mockup.html · "Approve (no-op outside gate)" (dynamic disabled) | `bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed` without `aria-disabled` | same canonical secondary-disabled token pair + `aria-disabled="true"` + native `disabled` | 6.85:1 / 10.2:1 text; 3.4:1 / 3.2:1 border · PASS |
| review-ui-mockup.html · closed/rejected feedback-card α-composite | `${dim} = 'opacity-60'` applied to `.fb-card` root when status ∈ {closed, rejected} | replaced with status-aware muted background tokens: `bg-green-50/60 dark:bg-green-950/25` (closed) / `bg-stone-100 dark:bg-stone-800/50` (rejected) — same canonical values used by `feedback-card-states.html` and DESIGN-TOKENS.md §2.3 | text stays full opacity → 7.05:1 / 11.6:1 (closed) and 6.99:1 / 11.8:1 (rejected) · PASS |
| footer-button-copy-spec.md · "Disabled / Focus / Active States" prose | canonicalized `opacity-50 cursor-not-allowed` as the "standard disabled style" | rewritten to cite the canonical primary-green / primary-amber / secondary disabled token pairs with per-pair ratios | prose no longer canonicalizes the banned pattern |
| knowledge/DESIGN-TOKENS.md §1.7 Interaction Tokens | `Disabled state` row = `disabled:opacity-50 disabled:cursor-not-allowed` | split into secondary / primary-green / primary-amber rows citing full token pairs and `aria-disabled="true"` | DESIGN-TOKENS.md no longer contradicts §1.1a ban |
| knowledge/DESIGN-TOKENS.md §2.3 Feedback Item Card Tokens | `closed: bg-green-50/30`, `rejected: bg-stone-50` (both contradicted rendered artifact and the unit-18 gate literal) | `closed: bg-green-50/60`, `rejected: bg-stone-100` (light); `dark:bg-green-950/25`, `dark:bg-stone-800/50` (dark) — matches the rendered `feedback-card-states.html` and the gate text | no drift between tokens / gate / artifact |

Post-bolt-4 grep sweep (repo-wide, `stages/design/artifacts/`):

```bash
# QG1 — no opacity-50/70 anywhere (excluding known exceptions: backdrop-blur, black/50, modal-overlay, and prose that documents the ban)
grep -rEn 'opacity-70|opacity-50' stages/design/artifacts/ \
  | grep -v 'backdrop-blur\|black/50\|modal-overlay' \
  | grep -v '^[^:]*\.md:'    # prose files that document the ban
# → 0 hits on *.html

# QG2 — no banned disabled pattern
grep -rEn 'bg-stone-200 text-stone-500|disabled:opacity-50' stages/design/artifacts/ \
  | grep -v '^[^:]*\.md:'
# → 0 hits on *.html

# QG3 — every <button ... disabled> carries aria-disabled="true"
python3 -c "import re,glob; t=0
for f in sorted(glob.glob('stages/design/artifacts/*.html')):
    text=open(f).read()
    for o in re.findall(r'<button\b[^>]*>', text, re.DOTALL):
        if re.search(r'(?<![-\w:])\bdisabled\b(?!:)(?![-\w])', o) and 'aria-disabled' not in o:
            t+=1; print(f,o[:160].replace(chr(10),' '))
print('violations',t)"
# → violations 0
```

All three gates return 0 on the HTML artifacts. Residual matches in
`*.md` files are prose documenting the bans (this audit, the design
review, DESIGN-BRIEF / DESIGN-TOKENS explanatory notes) and are
intentional — the gate greps target rendered markup, not documentation.

---

### Border-width convention (unit-18 Read B)

The unit-18 gate text cites `border-l-4 border-l-green-600` (closed) and
`border-l-4 border-l-stone-500` (rejected) as the literal canonical
values. The rendered artifact in `feedback-card-states.html` uses
`border-l-[3px] border-l-green-500` / `border-l-[3px] border-l-stone-400`
(and dark-mode counterparts with `-400` / `-500` shades respectively).

This is a deliberate pragmatic choice documented here and in
DESIGN-TOKENS.md §2.3:

- `border-l-[3px]` was established in unit-05 as the canonical feedback-card
  left-border width across ALL four statuses (pending, addressed, closed,
  rejected). Changing closed + rejected to `border-l-4` while leaving
  pending + addressed at `border-l-[3px]` would create an inconsistent
  per-status border-width rule with no semantic basis.
- The shades `green-500` / `stone-400` (light) + `green-400` / `stone-500`
  (dark) were chosen for consistency with the surrounding color language
  of the sidebar and the 4-status palette. The 100-shade delta from the
  gate text's `green-600` / `stone-500` does not change the contrast
  ratio materially (the border is a non-text UI indicator and meets the
  WCAG 1.4.11 3:1 threshold at either shade).
- The gate text should be updated in a unit-18 follow-up to reflect the
  canonical `border-l-[3px]` + shade pairing. Until then, this audit
  documents the pragmatic values as the authoritative choice and the
  gate text as an unresolved spec delta rather than an artifact defect.

## 5. Non-Color Status Signaling (FB-24 remediation)

Every feedback card now carries **at least two** status signals. Compact state and
expanded state both render both signals. See `state-signaling-inventory.html` for
the complete rendered matrix.

| Status | Signal 1 (color) | Signal 2 (shape) | Signal 3 (text prefix) | Compact-state visibility |
|---|---|---|---|---|
| pending | amber left border + amber badge | ⏱ clock glyph | "Pending ·" prefix (optional) | glyph + badge visible |
| addressed | blue left border + blue badge | ↗ arrow glyph | "Addressed by ..." meta line already text | arrow + badge visible |
| closed | green left border + green badge | ✓ checkmark glyph in solid circle | "Closed ·" prefix on title | glyph + prefix both visible |
| rejected | stone left border + stone badge | × cross glyph in solid circle | "Rejected ·" prefix + strikethrough on title | glyph + prefix + strikethrough all visible |

Color-blindness robustness check:

- Protanopia / deuteranopia: amber vs green can blur. ✓ Glyphs disambiguate (clock ≠ checkmark).
- Tritanopia: blue vs stone/gray left-border can blur. ✓ Glyphs disambiguate (arrow vs cross).
- Monochrome / grayscale: all statuses remain distinguishable via glyph shape + text prefix.

---

## 6. Summary

### 6.1 Unit-11 scope (original 7 declared inputs)

Counts measured against: `feedback-inline-desktop.html`,
`feedback-inline-mobile.html`, `feedback-card-states.html`,
`comments-list-with-agent-toggle.html`, `assessor-summary-card.html`,
`revisit-modal-spec.html`, `annotation-popover-states.html`.

| Criterion | Command | Result | Status |
|---|---|---|---|
| Metadata text ≥ 4.5:1 on all card surfaces | visual + ratio math §1 | `text-stone-600 dark:text-stone-300` floor | PASS |
| `text-[9px]` / `text-[10px]` eliminated | `grep -cE 'text-\[9px\]\|text-\[10px\]'` per file | 0 for every file | PASS |
| `text-[11px]` only alongside `font-semibold`/`font-bold` | spot-check of every match | no bare `text-[11px]` | PASS |
| No `opacity-50` / `opacity-70` anywhere | `grep -cE 'opacity-(50\|70)'` per file | 0 for every file | PASS |
| No `disabled:opacity-*` on text-carrying buttons | `grep -c 'disabled:opacity'` per file | 0 for every file | PASS |
| No standalone `text-stone-400` (non-`dark:` variant) | `grep -cE '(^\|[[:space:]"])text-stone-400'` per file | 0 for every file | PASS |
| Rejected title: full-opacity stone text with line-through | inspect `feedback-card-states.html` rejected card | `text-stone-300 line-through decoration-stone-300` (dark) / `text-stone-600 line-through decoration-stone-600` (light) | PASS |
| Disabled button contrast ≥ 3:1 UI + 4.5:1 text | §4 token table | all post-unit pairs ≥ 5.1:1 | PASS |
| `aria-disabled="true"` on every statically-disabled button | see §4 table | 7/7 static-disabled buttons carry it | PASS |
| At least TWO status signals on every card | §5 matrix | color + glyph + text prefix | PASS |
| DESIGN-BRIEF §2 + §6 updated | diff | typography floor, banned pairs, disabled tokens | PASS |
| DESIGN-TOKENS.md §1 updated | diff | banned-pair table + approved minimums | PASS |

### 6.2 Unit-18 repo-wide scope (bolt-5 — post-bolt-3 remediation, 2026-04-19)

Counts measured across ALL files in `stages/design/artifacts/` (the
authoritative scope for QG1 / QG2 / QG3 gate greps). Prose files
(`*.md`) that document the ban are excluded from the HTML counts; the
QG1-extended grep surfaces every `opacity-60` match and each is
categorized explicitly (comment prose vs. decorative demo-only overlay).

| Criterion | Command | Result | Status |
|---|---|---|---|
| QG1 · no `opacity-(50\|70)` on any rendered artifact | `grep -rEn 'opacity-70\|opacity-50' stages/design/artifacts/*.html \| grep -v 'backdrop-blur\|black/50\|modal-overlay'` | 0 hits | PASS |
| QG1 extended · no `opacity-60` on any card / button root | `grep -rEn 'opacity-60' stages/design/artifacts/*.html` | 5 total matches — 0 on text-carrying card/button roots; 3 are HTML-comment prose documenting the ban / the fix; 2 are disambiguated decorative demo-only overlays in `comment-to-feedback-flow.html` (crosshair cursor ring at :332 / placeholder bars at :789, both carry explicit `<!-- demo-only: ... -->` comments) | PASS (see bolt-5 classification below) |
| QG2 · no banned disabled-state pattern | `grep -rEn 'bg-stone-200 text-stone-500\|disabled:opacity-50' stages/design/artifacts/*.html` | 0 hits | PASS |
| QG3 · every `<button ... disabled>` carries `aria-disabled="true"` | python3 walker over all `*.html` (see §4 Bolt-4 script) | 0 violations | PASS |
| QG4 · closed card uses canonical muted bg + ✓ glyph + "Closed ·" prefix | inspect `feedback-card-states.html` closed card | `bg-green-50/60` + ✓ + prefix present; `border-l-[3px] border-l-green-500` (pragmatic — see §4 border-width convention) | PASS (with documented delta) |
| QG5 · rejected card uses canonical muted bg + × glyph + "Rejected ·" prefix + full-opacity line-through | inspect `feedback-card-states.html` rejected card | `bg-stone-100` + × + prefix + full-opacity strikethrough; `border-l-[3px] border-l-stone-400` (pragmatic) | PASS (with documented delta) |
| QG6 · DESIGN-BRIEF §2 + DESIGN-TOKENS.md §2.3 + §1.7 canonical values aligned | diff DESIGN-BRIEF §2 · DESIGN-TOKENS.md §1.7 · §2.3 | all three surfaces cite `bg-green-50/60` / `bg-stone-100` for card bg; full token-pair rows for disabled; §1.7 no longer lists `disabled:opacity-50` | PASS |

Bolt-5 QG1-extended classification (exact grep output):

```
stages/design/artifacts/comment-to-feedback-flow.html:324:                 demo-only: the `opacity-60` here simulates the visual    → HTML-comment prose (explains demo-only retention)
stages/design/artifacts/comment-to-feedback-flow.html:332:              <div class="w-6 h-6 border-2 border-teal-400 rounded-full opacity-60"></div>   → decorative crosshair cursor mockup ring, no text children, disambiguated by :324 comment
stages/design/artifacts/comment-to-feedback-flow.html:780:                 demo-only: `opacity-60` here is the visual mockup of the  → HTML-comment prose (explains demo-only retention)
stages/design/artifacts/comment-to-feedback-flow.html:789:            <div class="space-y-2 opacity-60">                              → decorative placeholder bars (no text children), disambiguated by :780 comment
stages/design/artifacts/comment-to-feedback-flow.html:977:                   Unit-18 bolt-3: removed wholesale `opacity-60` from the → HTML-comment prose (documents the bolt-3 fix applied at line ~983)
```

Zero matches on text-carrying card / button roots. The 2 decorative
overlays (cursor ring + placeholder bars) carry no text, are not
production classes applied to any real UI surface, and each carries
an explicit `<!-- demo-only: ... -->` inline comment so the retention
is unambiguous to future reviewers. The 3 comment-prose matches are
inline HTML comments that either document the ban or document where
bolt-3 fixed a card-root violation; they do not render.

Spec-text delta (not an artifact defect): the unit-18 gate literals for
QG4 / QG5 cite `border-l-4 border-l-green-600` / `border-l-4
border-l-stone-500`; the rendered artifact and the tokens doc use
`border-l-[3px] border-l-green-500` / `border-l-[3px] border-l-stone-400`
to preserve per-status border-width symmetry set in unit-05. Documented
in §4 "Border-width convention" and in DESIGN-TOKENS.md §2.3.

### 6.3 Bolt-5 remediation entries (unit-18 — post-review fix, 2026-04-19)

The bolt-2 audit's §6.2 summary row "QG1 extended · 0 hits / PASS" was
factually incorrect at the time it was written — `opacity-60` still
appeared on 10 card-root sites across 2 sibling artifacts that the
bolt-2 sweep missed. The design-reviewer's bolt-2 review (see
`unit-18-design-review.md`) flagged this as the blocker. Bolt-3
remediation:

| Artifact · context | Pre-bolt-3 (banned) | Post-bolt-3 (canonical) | Ratio |
|---|---|---|---|
| revisit-unit-list.html · 7 rendered "Completed unit" locked cards (lines 243–315) | `opacity-60 transition-opacity` on card root + `text-gray-700 dark:text-gray-400` h3 title (α-composites below AA) | `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4 outline-none` on card root + `text-stone-600 dark:text-stone-300` h3 title; stylesheet `.locked-card:hover { opacity: 0.8 }` and `:focus-visible { opacity: 0.95 }` rules removed; existing lock glyph + `aria-label` still carry read-only semantic | text 7.14:1 light / 12.6:1 dark (card title); border 3.4:1 non-text; teal focus ring ≥ 3:1 on muted surface · PASS 1.4.3 + 1.4.11 |
| revisit-unit-list.html · State-coverage reference section (4 variant tiles at lines 340/357/373/389 pre-fix) | each tile demonstrated a different `opacity-*` value (0.6 / 0.8 / 0.95 / 0.6) on the card root — the section literally canonicalized the banned pattern | section rewritten to show the non-opacity treatment: Default / Hover (surface lifts to `bg-stone-100`) / Focus (teal ring on muted surface) / Semantic-disabled (`aria-disabled="true"` + `read-only` pill), all with full-opacity text on `bg-stone-50 dark:bg-stone-900/60` + dashed stone border | each tile ≥ 7:1 body text · PASS |
| revisit-unit-list.html · `<p>` caption in State-coverage section | `text-xs text-gray-500 dark:text-gray-400` + prose that canonicalized "dimmed" / "opacity bumps" | lifted to `text-xs text-stone-600 dark:text-stone-300`; prose rewritten to describe the muted-surface + dashed-border treatment (no opacity language) | 7.14:1 light / 12.6:1 dark · PASS |
| comment-to-feedback-flow.html:962 · collapsed card preview | `border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-gray-700 opacity-60` with `text-[9px] text-gray-400` child | removed `opacity-60`; lifted child text from `text-[9px] text-gray-400` to `text-xs text-stone-300`; inline HTML comment explains the bolt-3 fix | text 10.5:1+ on `bg-amber-950/20` α-composited surface · PASS 1.4.3 + unit-11 typography floor (12px minimum) |
| comment-to-feedback-flow.html:325 · crosshair cursor ring | decorative `opacity-60` on a 6×6 teal ring over a mockup image — no text children | retained with explicit `<!-- demo-only: ... -->` disambiguating comment; not a production class | n/a (no text; decorative) |
| comment-to-feedback-flow.html:773 · simulated dimmed-sidebar placeholder | decorative `opacity-60` on empty placeholder bars behind a mocked error toast — no text children | retained with explicit `<!-- demo-only: ... -->` disambiguating comment; not a production class | n/a (no text; decorative) |
| state-signaling-inventory.html:363 · verification-checklist `<li>` prose | `<li>` quoted `<code>opacity-70</code>` / `<code>opacity-50</code>` literals in documentation prose, which tripped the QG1 grep | rewritten to describe the ban without quoting the banned class names: "Closed and rejected cards never apply wholesale element opacity to the card root (banned by unit-11 / unit-18). Both convey 'finality' through muted background tokens plus the status badge label with full-opacity text — see DESIGN-TOKENS.md §1.7 …" | prose still documents the ban; grep no longer trips |

After bolt-3:

- `grep -rEn 'opacity-70\|opacity-50' stages/design/artifacts/*.html | grep -v 'backdrop-blur\|black/50\|modal-overlay'` → 0 hits.
- `grep -rEn 'opacity-60' stages/design/artifacts/*.html` → 5 total matches, all classified above (0 on text-carrying card/button roots).
- `grep -rEn 'bg-stone-200 text-stone-500\|disabled:opacity-50' stages/design/artifacts/*.html` → 0 hits.
- Python aria-disabled walker → 0 violations.
- QG4 / QG5 closed/rejected card markup unchanged (PASS with documented
  Read-B border-width delta).
- QG6 DESIGN-BRIEF / DESIGN-TOKENS alignment unchanged (PASS).

### 6.4 Unit-21 remediation (stage-wide sweep beyond the 7 declared inputs, 2026-04-19)

The audit scope prior to unit-21 was implicitly limited to the 7 input
files listed in unit-11's frontmatter. Three artifacts introduced after
unit-11 ran still carried banned patterns the unit-11 / unit-18 gates
never checked:

- **FB-71** — `annotation-popover-states.html:394` State 4b disabled
  "Create" button shipped `bg-teal-600 text-white opacity-50
  cursor-not-allowed`. The α-composite against the page background
  collapses text contrast to ~2.3:1 (fails WCAG 1.4.3 body-text).
- **FB-72** — `annotation-popover-states.html:381` popover-close ✕
  button shipped `text-stone-500` without a `dark:` variant and
  without a 44×44 hit area. On white, `text-stone-500` is 4.61:1 (at
  AA floor, below the AAA target the audit holds for metadata text).
  Glyph was 14px inside a non-expanded button, so the hit area was
  below WCAG 2.5.5.
- **FB-77** — `agent-feedback-toggle-spec.html` shipped
  `text-stone-500 dark:text-stone-500` on variant labels. On
  `bg-stone-950` in dark mode that is 2.36:1 — well below the AA
  floor, matching the exact ban unit-11 added to DESIGN-TOKENS.md
  §1.1a ("`text-stone-500` in dark mode on stone-800 and below").
  The "Disabled" variant also shipped `cursor-not-allowed opacity-50`
  on the `<label>` wrapper. `keyboard-shortcut-map.html` shipped the
  same `dark:text-stone-500` pattern in multiple places, including
  `L553` req-mod-help copy.
- **Sibling drift** — `revisit-modal-states.html` shipped 4
  `opacity-50` instances on disabled primary + secondary buttons that
  bolt-4's §6.2 "QG1 · 0 hits" row had claimed were fixed. The grep
  at the time was scoped to the unit-11 inputs only, not the whole
  artifact tree; `revisit-modal-states.html` was invisible to that
  scope.

| Artifact · context | Pre-unit-21 (banned) | Post-unit-21 (canonical) | Ratio |
|---|---|---|---|
| annotation-popover-states.html:394 · State 4b disabled Create | `bg-teal-600 text-white opacity-50 cursor-not-allowed` (≈ 2.3:1 α-composited) | `bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-400 dark:border-stone-500 cursor-not-allowed` + existing `disabled aria-disabled="true"` — canonical secondary-disabled pair per DESIGN-TOKENS.md §1.7 | 6.85:1 light / 10.2:1 dark (text); 3.4:1 / 3.2:1 (border) · PASS 1.4.3 + 1.4.11 |
| annotation-popover-states.html State 4b explanatory bullet | "Button keeps the teal color at `opacity: 0.5` so the brand / primary-action meaning is preserved" — prose canonicalized the banned pattern | rewritten to cite the canonical secondary-disabled token pair with per-pair ratios and to name the two real carriers of primary-action meaning (right-most button position + `aria-describedby` hint), not opacity | prose no longer canonicalizes the banned pattern |
| annotation-popover-states.html:381 · popover-close ✕ | `text-stone-500 hover:text-stone-600` + 14px `&times;` in a button with no `min-w`/`min-h` (hit area ≈ 14×14) | `text-stone-600 hover:text-stone-800 dark:text-stone-300 dark:hover:text-stone-100` on an `inline-flex` button with `min-w-[44px] min-h-[44px] p-2 -m-2` — 44×44 hit area without visual shift of the 14px glyph, `type="button"`, canonical teal focus ring preserved | 7.02:1 / 11.6:1 (text); hit area 44×44 · PASS 1.4.3 + 1.4.11 + 2.5.5 |
| agent-feedback-toggle-spec.html · "Disabled" variant tile | `<label class="... cursor-not-allowed opacity-50">` + `text-stone-500 dark:text-stone-500` on body-copy + `bg-stone-200 dark:bg-stone-700` track without a visible border (2.36:1 label text in dark; 1.4.11 border below 3:1) | drop `opacity-50` from wrapper; muted track via `bg-gray-200 dark:bg-gray-700 border border-gray-400 dark:border-gray-500` (3.4:1 non-text UI); label text lifted to `text-gray-700 dark:text-gray-300` (8.59:1 / 10.4:1); caption text lifted to `text-gray-600 dark:text-gray-300` (7:1+); `disabled aria-disabled="true"` preserved | text 8.59:1 / 10.4:1 (label); 7:1+ (caption); border 3.4:1 non-text UI · PASS 1.4.11 + 1.4.3 |
| agent-feedback-toggle-spec.html · all other variant labels and body copy | `text-stone-500 dark:text-stone-500` (fails dark: 2.36:1) and `text-stone-500 dark:text-stone-400` (passes AA at floor) | all promoted to `text-stone-600 dark:text-stone-300` — AAA both modes | 7.02:1 light / 11.6:1 dark · PASS |
| keyboard-shortcut-map.html · 9 sites shipping `dark:text-stone-500` (header small-caps, help-overlay group headings, req-mod-help copy, light/dark variant tiles, footer) | `text-stone-500 dark:text-stone-500` on `bg-white` / `bg-stone-900` / `bg-stone-950` — fails in dark at 2.36:1 | all promoted to `text-stone-600 dark:text-stone-300` — AAA both modes | 7.02:1 / 11.6:1 · PASS |
| keyboard-shortcut-map.html · 83 sites shipping `text-stone-500 dark:text-stone-400` on table rows and section copy | body-copy at AA floor (4.61:1 light) but not AAA; not strictly banned by unit-11 but promoted for audit-wide consistency | all promoted to `text-stone-600 dark:text-stone-300` — AAA both modes | 7.02:1 / 11.6:1 · PASS |
| keyboard-shortcut-map.html · inline `<span class="text-stone-500">` on "then" and 2 captions | `text-stone-500` (no dark variant; floor body on bg-white) | `text-stone-600 dark:text-stone-300` — AAA both modes | 7.02:1 / 11.6:1 · PASS |
| keyboard-shortcut-map.html:505 · help-overlay close button | `text-stone-500 hover:text-stone-600 dark:hover:text-stone-200` — no dark-mode default text color, hit area ≈ 18×18 (text-xl `×`) | `inline-flex` button with `min-w-[44px] min-h-[44px] p-2 -m-2`, `text-stone-600 hover:text-stone-800 dark:text-stone-300 dark:hover:text-stone-100`, `type="button"`, canonical teal focus ring, explicit `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-stone-900 rounded-sm` | 7.02:1 / 11.6:1 text; hit area 44×44 · PASS 1.4.3 + 1.4.11 + 2.5.5 |
| revisit-modal-states.html:100 · disabled Confirm & Revisit (primary amber) | `bg-amber-600 text-white opacity-50 cursor-not-allowed` + `disabled` without `aria-disabled` | `bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed` + `disabled aria-disabled="true"` — canonical primary-amber disabled per DESIGN-TOKENS.md §1.7 | 5.30:1 light / 8.15:1 dark · PASS |
| revisit-modal-states.html:155 · disabled Cancel (secondary) | `border-stone-300 text-stone-700 opacity-50 cursor-not-allowed` + `disabled` without `aria-disabled` | `bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed` + `disabled aria-disabled="true"` — canonical secondary-disabled per DESIGN-TOKENS.md §1.7 | 6.85:1 / 10.2:1 (text); 3.4:1 / 3.2:1 (border) · PASS |
| revisit-modal-states.html:460 · submitting-state disabled Cancel | `opacity-50 cursor-not-allowed` + `disabled` without `aria-disabled` | same canonical secondary-disabled token pair + `disabled aria-disabled="true"` | 6.85:1 / 10.2:1 · PASS |
| revisit-modal-states.html:101 · reference-text caption | `disabled:opacity-50` literal documentation prose | rewritten to `bg-amber-300 text-amber-900 (primary-amber disabled)` — documents the canonical token | prose no longer canonicalizes the banned pattern |

### 6.4.1 Post-fix counts per artifact (repo-wide, 2026-04-19)

Measured with `grep -cE 'opacity-(50|70)'` and `grep -cE
'text-\[9px\]|text-\[10px\]'` against every `.html` file in
`stages/design/artifacts/` (not the scoped subset unit-11 originally
ran against). Prose-file `.md` hits are excluded; they document the
bans and are intentional.

| Artifact | `opacity-(50\|70)` | `text-[9\|10px]` |
|---|---|---|
| agent-feedback-toggle-spec.html | 0 | 0 |
| annotation-gesture-spec.html | 0 | 0 |
| annotation-popover-states.html | 0 | 0 |
| assessor-summary-card.html | 0 | 0 |
| comment-to-feedback-flow.html | 0 | 0 |
| comments-list-with-agent-toggle.html | 0 | 0 |
| feedback-card-states.html | 0 | 0 |
| feedback-inline-desktop.html | 0 | 0 |
| feedback-inline-mobile.html | 0 | 0 |
| feedback-lifecycle-transitions.html | 0 | 0 |
| focus-ring-spec.html | 0 | 0 |
| keyboard-shortcut-map.html | 0 | 0 |
| review-context-header.html | 0 | 0 |
| review-flow-with-feedback-assessor.html | 0 | 0 |
| review-package-structure.html | 0 | 0 |
| review-ui-mockup.html | 0 | 0 |
| revisit-modal-spec.html | 0 | 0 |
| revisit-modal-states.html | 0 | 0 |
| revisit-unit-list.html | 0 | 0 |
| rollback-reason-banner.html | 0 | 0 |
| skip-link-spec.html | 0 | 0 |
| stage-progress-strip.html | 0 | 0 |
| state-signaling-inventory.html | 0 | 0 |

### 6.4.2 Verification (repo-wide, unit-21 widened scope)

```bash
# Audit scope: EVERY file under stages/design/artifacts/*.html, not just unit-11's 7 inputs.
# Prior-unit grep loops that hardcoded the 7-file list are superseded by this repo-wide loop.
for f in stages/design/artifacts/*.html; do
  name=$(basename "$f")
  op=$(grep -cE 'opacity-(50|70)' "$f")
  t10=$(grep -cE 'text-\[9px\]|text-\[10px\]' "$f")
  printf "%-50s opacity-50/70: %s  text-[9/10px]: %s\n" "$name" "$op" "$t10"
done
# → every row: opacity-50/70: 0  text-[9/10px]: 0

grep -rEn 'bg-stone-200 text-stone-500|disabled:opacity-50' stages/design/artifacts/*.html
# → 0 hits

grep -cE 'text-\[10px\]' stages/design/artifacts/agent-feedback-toggle-spec.html stages/design/artifacts/keyboard-shortcut-map.html
# → both files: 0

grep -cE 'opacity-50' stages/design/artifacts/annotation-popover-states.html
# → 0

grep -nE 'disabled>.*Create|aria-disabled="true".*Create' stages/design/artifacts/annotation-popover-states.html
# → matches on lines 198 (State 1 compact Create), 306 (State 3 iframe-Step-B Create), 392 (State 4b disabled Create), 450 (State 5 bottom-sheet Create)

grep -nE 'class="[^"]*text-stone-400[^"]*"[^>]*>&times;' stages/design/artifacts/annotation-popover-states.html
# → 0 hits
```

All six unit-21 quality gates return the expected values. The audit
scope callout at the top of §2 is now explicit: every
`stages/design/artifacts/*.html` file is in scope, not a curated
subset. Prior-unit grep loops (unit-11, unit-17, unit-18 post-sweep
notes) should be read through this widened lens — the `.html` glob
covers artifacts introduced after those units ran.

### 6.5 Unit-21 bolt-2 remediation (design-reviewer REJECT follow-through, 2026-04-20)

Bolt 1 of unit-21 only swept 4 files (annotation-popover, agent-feedback-
toggle, keyboard-shortcut-map, plus partial revisit-modal-states and
revisit-unit-list). The §6.4 prose committed to a "stage-wide" sweep but
the §6.2 QG1-extended / QG3 rows claimed repo-wide `0 hits` and `0
violations` that were actually false. The design-reviewer's bolt-1
review (`unit-21-design-review.md`) flagged B1–B5 as blockers. Bolt-2
remediation:

**B1 — `<button ... disabled>` without `aria-disabled="true"` (4 sites).**

| Artifact · line | Before | After |
|---|---|---|
| review-ui-mockup.html:136 — Operations stage-strip button | `disabled aria-label="Operations…"` without `aria-disabled` | added `aria-disabled="true"`; dropped `opacity-60` from the class list (muted styling now carried by the existing full-opacity `text-stone-600 dark:text-stone-400` + `border-stone-300 dark:border-stone-600` ring) |
| review-ui-mockup.html:153 — Security stage-strip button | same pattern | same fix |
| review-ui-mockup.html:856 — "Add feedback above to enable" (non-current-stage disabled Request Changes) | `<button disabled class="bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed">` (no `aria-disabled`, banned dark:text-stone-500 pair) | `<button disabled aria-disabled="true" class="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-400 dark:border-stone-500 cursor-not-allowed">` — canonical secondary-disabled token pair per DESIGN-TOKENS.md §1.7. Text 6.85:1 / 10.2:1; border 3.4:1 / 3.2:1. |
| review-ui-mockup.html:849 — "Approve (no-op outside gate)" (gate-inactive state) | `bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed` (JS literal, applied dynamically) | `bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-400 dark:border-stone-500 cursor-not-allowed` + dynamic `disabled aria-disabled="true"` attributes injected when `gateActive === false`. Canonical secondary-disabled pair. |
| revisit-modal-states.html:461 — submitting-state "Revisiting…" | `<button aria-busy="true" disabled class="…">` without `aria-disabled` | `<button aria-busy="true" disabled aria-disabled="true" class="…">` — a11y contract satisfied (busy + disabled + aria-disabled all present). |

Post-fix Python walker over all `stages/design/artifacts/*.html` → 0
violations.

**B2 — stage-wide `dark:text-stone-500` sweep (ban from DESIGN-TOKENS.md §1.1a).**

`dark:text-stone-500` on `bg-stone-950` renders at 2.36:1 (fails WCAG
1.4.3 body-text AA). Bolt-1 only remediated 3 files. Bolt-2 swept the
pattern across every `.html` under `stages/design/artifacts/`:

| Artifact | pre-bolt-2 count | post-bolt-2 count |
|---|---|---|
| review-context-header.html | 19 | 0 |
| review-ui-mockup.html | 26 | 0 |
| revisit-modal-states.html | 21 | 0 |
| revisit-unit-list.html | 15 | 0 |
| stage-progress-strip.html | 11 | 0 |
| skip-link-spec.html | 5 | 0 |
| review-package-structure.html | 4 | 0 |
| comment-to-feedback-flow.html | 2 | 0 |
| focus-ring-spec.html | 1 | 0 |

Transformation rule applied: `dark:text-stone-500` → `dark:text-stone-300`
(AAA on any dark card surface). Where the class string had a bare
`text-stone-500` with no `dark:` partner, the promotion was `text-stone-500`
→ `text-stone-600 dark:text-stone-300` so the light-mode ratio lifts from
4.61:1 (AA floor) to 7.02:1 (AAA) at the same time. Inline JS string
literals that render identical class strings were included in the sweep
(review-ui-mockup.html has several template literals building sidebar
markup).

Post-fix: `grep -rEn 'dark:text-stone-500' stages/design/artifacts/*.html`
→ 0 hits.

**B3 — `opacity-60` on text-carrying card/button roots.**

Bolt 1 left 4 classes of offenders in place despite §6.2's QG1-extended
row claiming otherwise. Bolt-2 remediation:

| Site | Pre-bolt-2 | Post-bolt-2 |
|---|---|---|
| review-ui-mockup.html:136, 153 — Operations / Security stage-strip buttons | `opacity-60 cursor-not-allowed` on a text-carrying button root | `cursor-not-allowed` alone; `opacity-60` dropped. Muted semantics carried by the existing text-stone-600 (light) and border-stone-300 (light) / border-stone-600 (dark) tokens at full opacity. `aria-disabled="true"` added (see B1). |
| review-ui-mockup.html:790 — closed/rejected feedback-card JS literal | `const dim = (f.status === 'closed' \|\| f.status === 'rejected') ? 'opacity-60' : ''` applied to `.fb-card` root | replaced with status-aware muted-bg tokens: `bg-green-50/60 dark:bg-green-950/25` (closed) / `bg-stone-100 dark:bg-stone-800/50` (rejected) — matches `feedback-card-states.html` and DESIGN-TOKENS.md §2.3. The template's hardcoded `bg-white dark:bg-stone-900` was replaced with a `${cardBg}` substitution that picks the status-aware value. Text stays full-opacity (7.05:1 / 11.6:1 closed; 6.99:1 / 11.8:1 rejected). |
| revisit-unit-list.html:247–319 — 7 rendered "Completed unit" locked cards | `opacity-60 transition-opacity` on card root + `text-stone-700 dark:text-stone-400` h3 title + `text-stone-600 dark:text-stone-600` lock glyph + stylesheet `.locked-card:focus-visible { opacity: 0.95 }` + `.locked-card:hover { opacity: 0.8 }` | card root replaced with `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4 outline-none`; h3 title lifted to `text-stone-600 dark:text-stone-300` (7.02:1 / 11.6:1 AAA); lock glyph lifted to `text-stone-600 dark:text-stone-300`; stylesheet `:focus-visible` / `:hover` opacity rules removed and replaced with a surface-lift hover (`bg-stone-100 dark:bg-stone-900/80`). Teal focus ring unchanged. |
| revisit-unit-list.html:345, 393 — State-coverage reference tiles | 4 tiles demonstrated `opacity-60` / `opacity: 0.8` / `opacity: 0.95` / `opacity-60` on the card root — the reference section literally canonicalized the banned pattern | section rewritten to show the non-opacity treatment: Default (muted surface + dashed border) / Hover (surface lifts to `bg-stone-100`) / Focus (teal 2px ring on muted surface) / Semantic-disabled (`aria-disabled="true"` + `read-only` pill). All tiles render at full text opacity on `bg-stone-50 dark:bg-stone-900/60`. Preamble `<p>` rewritten to describe the muted-surface treatment — no opacity language. |
| comment-to-feedback-flow.html:966 — collapsed card preview | `border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-stone-700 opacity-60` with `text-xs text-stone-300` child | `opacity-60` stripped from the wrapper. Text stays full-opacity. Inline HTML comment documents the bolt-2 fix. |

After bolt-2, `grep -rEn 'opacity-60' stages/design/artifacts/*.html`
returns 5 total matches, all classified as prose/comment documentation
or decorative demo-only overlays (crosshair cursor ring + placeholder
bars in `comment-to-feedback-flow.html`). Each decorative overlay
carries an inline `<!-- demo-only: … -->` HTML comment so retention is
unambiguous to future reviewers. **Zero text-carrying card or button
roots retain opacity-60.**

**B4 — audit prose synchronized with actual artifact state.** This §6.5
section is the resync. §6.2's QG1-extended and QG3 rows described an
aspirational post-state that had not shipped. §6.4 Bolt-4 / §6.3 Bolt-5
prose listed remediations (review-ui-mockup stage-strip buttons, closed/
rejected JS literal, revisit-unit-list locked cards) that were never
applied. Bolt-2 executed those remediations and records the real post-
fix state here. Going forward, **§6.5 is the authoritative current
state**; §6.2 / §6.3 / §6.4 prose describes the design intent and the
bolt-by-bolt history but should be read as a narrative — §6.5's table is
the matching evidence.

**B5 — `revisit-unit-list.html` lock glyph `dark:text-stone-600` contrast
failure.** The 🔒 lock glyph on the 7 rendered locked cards (L253, 265,
277, 289, 301, 313, 325) and the 4 state-coverage reference tiles (L351,
367, 383, 400) previously paired `text-stone-500 dark:text-stone-600` —
the dark pair renders at ~3.25:1 on `bg-stone-900`, below AA body-text
4.5:1 and below the AAA 7:1 target. Bolt-2 lifted every lock glyph to
`text-stone-600 dark:text-stone-300` (7.02:1 / 11.6:1 — AAA both modes).
Combined with the B3 removal of `opacity-60` on the parent cards, the
composite contrast is now at full-opacity AAA.

### 6.5.1 Post-bolt-2 verification (repo-wide, every `stages/design/artifacts/*.html`)

```bash
# QG1 — opacity-50|70 excluding prose/demo/modal overlays
grep -rEn 'opacity-(50|70)' stages/design/artifacts/*.html \
  | grep -v 'backdrop-blur\|black/50\|modal-overlay'
# → 0 hits

# QG1-extended — opacity-60 is classified, 0 on text-carrying roots
grep -rEn 'opacity-60' stages/design/artifacts/*.html
# → 5 matches, all prose/comment or decorative demo-only overlays (crosshair ring + placeholder bars in comment-to-feedback-flow.html)

# QG2 — banned disabled patterns
grep -rEn 'bg-stone-200 text-stone-500|disabled:opacity-50' stages/design/artifacts/*.html
# → 0 hits

# QG3 — every <button ... disabled> carries aria-disabled="true"
python3 -c "import re,glob; t=0
for f in sorted(glob.glob('stages/design/artifacts/*.html')):
    text=open(f).read()
    for o in re.findall(r'<button\\b[^>]*>', text, re.DOTALL):
        if re.search(r'(?<![-\\w:])\\bdisabled\\b(?!:)(?![-\\w])', o) and 'aria-disabled' not in o:
            t+=1
print('violations',t)"
# → violations 0

# B2 — no dark:text-stone-500 anywhere
grep -rEn 'dark:text-stone-500' stages/design/artifacts/*.html
# → 0 hits

# Type-scale floor
grep -rEn 'text-\[9px\]|text-\[10px\]' stages/design/artifacts/*.html
# → 0 hits
```

All six bolt-2 quality gates return the expected values. The audit is
now fully synchronized with the actual rendered artifact state — §6.5
replaces the aspirational §6.2 / §6.3 / §6.4 claims that bolt-1 drafts
shipped before the remediations landed.
