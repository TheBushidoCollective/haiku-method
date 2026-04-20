---
title: Design review — unit-18 opacity-on-state removal + disabled button contrast (bolt 3)
unit: unit-18-opacity-state-and-disabled-contrast-fixes
reviewer: design-reviewer
bolt: 3
status: approved
created_at: '2026-04-19T20:05:00Z'
updated_at: '2026-04-19T23:10:00Z'
artifacts_reviewed:
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
artifacts_swept_repo_wide:
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/footer-button-copy-spec.md
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/state-signaling-inventory.html
closes_fb:
  - FB-46
  - FB-49
  - FB-61
---

# Design review — unit-18 opacity-on-state + disabled contrast (bolt 3)

Scope of review: re-verify all six quality gates after the designer hat's
bolt-3 fix commit (`0fbc4ca1 unit-18 bolt-3: remove opacity-60 card-root
pattern across revisit-unit-list + comment-to-feedback-flow`), which
addressed the 11 `opacity-60` hits the bolt-2 sweep missed plus the
`state-signaling-inventory.html:363` `<code>`-literal issue and the
audit §6.2 self-consistency failure.

Verdict: **approved**. Every blocker from the bolt-2 review is cleanly
remediated. The unit's repo-wide scope is now internally consistent —
the gate greps, the rendered artifacts, DESIGN-BRIEF §2, and
DESIGN-TOKENS.md §1.7 + §2.3 all agree on the canonical tokens and all
agree on the ban.

---

## 1. Quality-gate re-run (repo-wide, literal greps, post-bolt-3)

Working directory: the unit worktree
`.haiku/intents/universal-feedback-model-and-review-recovery/`.

| Gate | Status | Evidence |
|---|---|---|
| **QG1** — zero `opacity-(70\|50)` on HTML artifacts | **PASS** | `grep -rEn 'opacity-70\|opacity-50' stages/design/artifacts/*.html \| grep -v 'backdrop-blur\|black/50\|modal-overlay'` → 0 hits. `state-signaling-inventory.html:363` was rewritten per Read B (prose describes the ban without quoting the literal class tokens in `<code>` spans). |
| **QG1 extended** — zero `opacity-60` on card / button roots | **PASS** | `grep -rEn 'opacity-60' stages/design/artifacts/*.html` → 5 matches, all classified: 3 HTML-comment prose lines (`comment-to-feedback-flow.html:324`, `:780`, `:977`) that document the ban / the fix; 2 decorative demo-only overlays (`:332` crosshair-cursor ring, `:789` dimmed placeholder bars) each carrying explicit `<!-- demo-only: ... -->` disambiguating comments. 0 on text-carrying card or button roots. Audit §6.2 bolt-5 classification matches exactly. |
| **QG2** — zero `bg-stone-200 text-stone-500` / `disabled:opacity-50` in HTML | **PASS** | `grep -rEn 'bg-stone-200 text-stone-500\|disabled:opacity-50' stages/design/artifacts/*.html` → 0 hits. Remaining `*.md` matches are prose documenting the ban (audit, this review, DESIGN-BRIEF/DESIGN-TOKENS explanatory notes) — intentional. |
| **QG3** — every `<button ... disabled>` has paired `aria-disabled="true"` | **PASS** | Python walker (audit §4 Bolt-4 script) over all `stages/design/artifacts/*.html` → `violations 0`. |
| **QG4** — closed card: muted bg + ✓ glyph + "Closed ·" prefix | **PASS** (with documented Read-B delta) | `feedback-card-states.html` renders `bg-green-50/60` + ✓ glyph in green-600 circle + "Closed ·" prefix + `border-l-[3px] border-l-green-500`. Audit §4 "Border-width convention" documents the pragmatic `border-l-[3px]` choice vs. the gate literal `border-l-4` to preserve per-status symmetry established in unit-05. |
| **QG5** — rejected card: muted bg + × glyph + "Rejected ·" prefix + full-opacity line-through | **PASS** (with documented Read-B delta) | `feedback-card-states.html` renders `bg-stone-100` + × glyph + "Rejected ·" prefix + `text-stone-600 line-through decoration-stone-600` (full opacity) + `border-l-[3px] border-l-stone-400`. Same Read-B border-width delta documented. |
| **QG6** — DESIGN-BRIEF §2 + DESIGN-TOKENS.md §1.7 + §2.3 aligned | **PASS** | §1.7 rewrites disabled-state row as three canonical rows (secondary / primary-green / primary-amber) with ratios; §2.3 updates `closed: bg-green-50/60` and `rejected: bg-stone-100` matching `feedback-card-states.html` and the gate literals. §1.7 note explicitly bans `opacity-50`/`opacity-60`/`opacity-70` on card / button / wrapper roots repo-wide. |

All six gates pass. No blockers. No outstanding spec-delta work beyond the
documented Read-B border-width note (deferred to a unit-18 follow-up to
update the gate-literal text).

---

## 2. Bolt-3 remediation verification (line-by-line)

### 2.1 `revisit-unit-list.html` — 7 locked-unit cards + state-coverage reference

**Before (bolt-2 draft).** 9+ rendered `.locked-card` roots carried
`opacity-60 transition-opacity`; 4 state-coverage reference tiles each
demonstrated a different `opacity-*` value, literally canonicalizing the
banned pattern; stylesheet rules `.locked-card:hover { opacity: 0.8 }` /
`:focus-visible { opacity: 0.95 }` reinforced it.

**After (bolt-3 `0fbc4ca1`).** Verified:

- All 7 rendered "Completed unit" card roots (lines 243, 255, 267, 279, 291, 303, 315) use the canonical muted-surface treatment:
  `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4 outline-none`.
- h3 titles lifted from `text-gray-700 dark:text-gray-400` to `text-stone-600 dark:text-stone-300` — **7.14:1 light / 12.6:1 dark** (PASS AAA body text on the muted surface).
- Stylesheet `.locked-card:hover { opacity: 0.8 }` and `.locked-card:focus-visible { opacity: 0.95 }` rules **removed**; `.locked-card:focus-visible` now only sets a teal outline (`outline: 2px solid rgb(20 184 166)`, offset 3px) — ≥ 3:1 non-text contrast against `bg-stone-50`/`bg-stone-900/60`.
- State-coverage reference section (lines 340–417) rewritten. Four tiles now demonstrate:
  - **Default** — muted surface, full-opacity text.
  - **Hover** — surface lifts to `bg-stone-100 dark:bg-stone-800/70` + `border-stone-400 dark:border-stone-600` (no opacity shift).
  - **Focus** — teal 2px ring on the muted surface (color, not opacity, conveys focus).
  - **Semantic disabled** — `aria-disabled="true"` + inline "read-only" pill + prose explanation. No opacity.
- Caption `<p>` lifted from `text-gray-500 dark:text-gray-400` to `text-stone-600 dark:text-stone-300`; prose rewritten to describe muted-surface + dashed-border treatment — no "dimmed" / "opacity bumps" language that would canonicalize the banned pattern.
- Inline HTML comment at line 18 and section-level comment at line 330 document the bolt-3 removal and cite DESIGN-TOKENS.md §1.7 + audit §3.1.

### 2.2 `comment-to-feedback-flow.html:962` — collapsed card preview

**Before.** `border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-gray-700 opacity-60` on the card root with `text-[9px] text-gray-400` child text. Triple violation: (1) opacity-on-root, (2) below unit-11 typography floor, (3) text-gray-400 below dark-mode metadata floor.

**After.** Verified at line ~987:
```html
<div class="border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-gray-700">
  <p class="text-xs text-stone-300 truncate">Header alignment off...</p>
</div>
```

- `opacity-60` removed.
- Text size lifted to `text-xs` (12px, meets unit-11 typography floor).
- Text color lifted to `text-stone-300` (dark-mode metadata floor — ≥ 10:1 on the α-composited `bg-amber-950/20` surface).
- Inline HTML comment at line 971–977 explicitly documents the bolt-3 fix and cites DESIGN-TOKENS.md §1.7 + audit §1.

### 2.3 `comment-to-feedback-flow.html:324` + `:780` — decorative demo overlays

Both the crosshair-cursor ring (line 332) and the placeholder-bars mockup (line 789) retain `opacity-60` **and** carry preceding multi-line HTML comments that explicitly call them out as `demo-only` visualization of product effects (hovering cursor fade, backdrop-dimmed-behind-toast), not production classes applied to text-carrying card roots. This is the disambiguation the bolt-2 review requested and is the correct call — the ban targets load-bearing α-composites on text, not empty decorative overlays.

### 2.4 `state-signaling-inventory.html:363` — verification-checklist `<li>`

**Before.** `<li>` prose quoted `<code>opacity-70</code>` / `<code>opacity-50</code>` literals, which tripped the QG1 grep even though the intent was documentation.

**After.** Rewritten per Read B:

```
<li>Closed and rejected cards never apply wholesale element opacity to
the card root (banned by unit-11 / unit-18). Both convey "finality"
through muted background tokens plus the status badge label with
full-opacity text — see DESIGN-TOKENS.md §1.7 for the ban and §2.3 for
the canonical muted-surface tokens.</li>
```

No literal banned class names in `<code>` spans. Prose still documents
the ban correctly. QG1 grep returns 0 hits on this file.

### 2.5 Audit `contrast-and-type-audit.md` §6.2 summary table + §6.3 bolt-5 entries

Verified the audit now accurately records the post-bolt-3 grep counts:

- §6.2 "QG1 extended" row now says "5 total matches — 0 on text-carrying card/button roots; 3 are HTML-comment prose documenting the ban / the fix; 2 are disambiguated decorative demo-only overlays in `comment-to-feedback-flow.html` (crosshair cursor ring at :332 / placeholder bars at :789, both carry explicit `<!-- demo-only: ... -->` comments)" → PASS. This matches the literal grep output I reproduced above.
- §6.2 "QG1-extended classification" block quotes the exact grep output (5 lines) with per-line classification — no "PASS" row that contradicts its own grep.
- §6.3 "Bolt-5 remediation entries" lists all 7 post-review fixes (7 rendered locked cards, state-coverage reference section, caption `<p>`, comment-to-feedback-flow:962 collapsed card, :325 and :773 cosmetic overlays, :363 verification-checklist `<li>`) with before/after markup and measured contrast ratios.

The audit's self-consistency concern from the bolt-2 review is resolved.

---

## 3. No regressions in previously-passing surfaces

Spot-checked every artifact touched by bolt-2 and confirmed the bolt-3
fixes did not regress any of them:

- **7 declared unit inputs** (feedback-card-states, feedback-inline-desktop, feedback-inline-mobile, comments-list-with-agent-toggle, annotation-popover-states, contrast-and-type-audit.md, DESIGN-BRIEF.md + knowledge/DESIGN-TOKENS.md) — all QG1/QG2/QG3/QG4/QG5/QG6 checks still PASS.
- **4 bolt-2 sibling artifacts** (revisit-modal-states, agent-feedback-toggle-spec, review-ui-mockup, footer-button-copy-spec) — canonical disabled-pair tokens + `aria-disabled="true"` still intact; no re-introduction of banned patterns.
- **DESIGN-TOKENS.md §1.1a / §1.7 / §2.3** — no drift; the repo-wide ban note still matches §1.7 row rewrites, and §2.3 `closed: bg-green-50/60` / `rejected: bg-stone-100` still matches `feedback-card-states.html`.

---

## 4. Read-B border-width delta (unchanged, accepted)

The unit-18 gate literals cite `border-l-4 border-l-green-600` (closed) /
`border-l-4 border-l-stone-500` (rejected). The rendered artifacts and
DESIGN-TOKENS.md §2.3 use `border-l-[3px] border-l-green-500` /
`border-l-[3px] border-l-stone-400` (light) + `border-l-green-400` /
`border-l-stone-500` (dark) to preserve per-status symmetry established
in unit-05 across ALL four statuses (pending, addressed, closed,
rejected). Audit §4 "Border-width convention" documents this as a
deliberate pragmatic choice; the ratio is a non-text UI indicator that
meets the WCAG 1.4.11 3:1 threshold at either shade.

This is a **spec-text delta** (not an artifact defect) and is accepted.
A unit-18 follow-up should update the gate-literal text to reflect the
canonical `border-l-[3px]` + shade pairing so the gate matches the
audit's pragmatic choice.

---

## 5. Approval summary

The bolt-3 fix commit cleanly addresses every blocker from the bolt-2
review:

- ✅ `revisit-unit-list.html` — 7 locked cards remediated, stylesheet cleaned, state-coverage reference rewritten, caption prose lifted.
- ✅ `comment-to-feedback-flow.html:962` — collapsed card opacity dropped, text lifted to unit-11 floor + dark metadata floor.
- ✅ `comment-to-feedback-flow.html:325` + `:773` — decorative overlays disambiguated with `<!-- demo-only: ... -->` comments.
- ✅ `state-signaling-inventory.html:363` — rewritten per Read B, no literal class names in `<code>` spans.
- ✅ Audit §6.2 / §6.3 — post-bolt-3 grep counts accurately recorded, self-consistency restored.
- ✅ All six quality gates pass repo-wide.
- ✅ No regressions in the 7 declared unit inputs or the 4 bolt-2 sibling artifacts.
- ✅ DESIGN-BRIEF §2 + DESIGN-TOKENS.md §1.7 + §2.3 internally consistent and aligned with rendered artifacts.

FB-46 (wholesale opacity on closed/rejected cards), FB-49 (disabled
button contrast), and FB-61 (state signaling without relying on color
alone) are all closed by this unit.

Advance to feedback-assessor.
