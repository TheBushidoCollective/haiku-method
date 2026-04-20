---
title: Design review — unit-18 opacity-on-state removal + disabled button contrast
unit: unit-18-opacity-state-and-disabled-contrast-fixes
reviewer: design-reviewer
status: changes-requested
created_at: '2026-04-19T20:05:00Z'
artifacts_reviewed:
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
closes_fb:
  - FB-46
  - FB-49
  - FB-61
---

# Design review — unit-18 opacity-on-state + disabled contrast

Scope of review: verify the seven declared input artifacts satisfy the six
quality gates, that DESIGN-BRIEF §2 banned-pairs table and DESIGN-TOKENS.md
are aligned, and — because the gates grep `stages/design/artifacts/`
*unscoped* — confirm no sibling artifact re-introduces the banned patterns.

Verdict: **changes requested**. The designer's bolt-1→bolt-3 work on the
seven declared inputs is solid: the State 4b "Create" holdout in
`annotation-popover-states.html` is fixed, the contrast audit gains a
bolt-3 subsection, and the seven-file scope is clean. But the gates as
written are repo-wide and fail on four sibling artifacts. Design-tokens
also drifted from the canonical values the gates require. None of this
is a redo — it is a narrow sweep of the same anti-patterns across files
the bolt-1 investigation did not visit.

---

## 1. Quality-gate coverage

Running each gate's literal grep against the full
`stages/design/artifacts/` tree (which is what the gate text specifies
— not a 7-file subset):

| Gate | Status | Notes |
|---|---|---|
| **QG1** — zero `opacity-(70|50)` on card roots | **FAIL** | 6 hits outside the 7 declared inputs. See §2. |
| **QG2** — zero `bg-stone-200 text-stone-500` / `disabled:opacity-50` | PARTIAL | Canonical token replacements applied on declared inputs; 1 hit in `revisit-modal-states.html` (a caption label, cosmetic) and DESIGN-TOKENS.md §1.7 still documents `disabled:opacity-50` as the canonical disabled state. See §3. |
| **QG3** — every `disabled` has paired `aria-disabled="true"` | **FAIL** | On the 7 declared inputs: PASS (audit §4 table accurate). Repo-wide: 4 bare `disabled` buttons in `revisit-modal-states.html` + 2 in `review-ui-mockup.html` lack `aria-disabled`. See §4. |
| **QG4** — closed card: `bg-green-50/60 border-l-4 border-l-green-600` + ✓ glyph + "Closed · " | PARTIAL | `feedback-card-states.html` renders `bg-green-50/60` + ✓ + "Closed · " ✓, but uses `border-l-[3px] border-l-green-500` not `border-l-4 border-l-green-600`. Minor but gate is literal. See §5. |
| **QG5** — rejected card: `bg-stone-100 border-l-4 border-l-stone-500` + × glyph + "Rejected · " + full-opacity line-through | PARTIAL | `feedback-card-states.html` renders `bg-stone-100` + × + "Rejected · " + full-opacity strikethrough ✓, but uses `border-l-[3px] border-l-stone-400` not `border-l-4 border-l-stone-500`. See §5. |
| **QG6** — DESIGN-BRIEF §2 banned-pairs extended; DESIGN-TOKENS.md §3 adds canonical status backgrounds | **FAIL** | DESIGN-BRIEF §2 has the rows ✓. DESIGN-TOKENS.md §2.3 still lists old tokens (`bg-stone-50`/`bg-green-50/30`) that contradict the canonical gate values (`bg-stone-100`/`bg-green-50/60`). DESIGN-TOKENS.md §1.7 Interaction Tokens still lists `disabled:opacity-50 disabled:cursor-not-allowed` as the disabled-state token. No §3 update; the spec text points at §3 but §3 is the SPA↔SSR mapping table — the canonical background tokens belong in §2.3 and that's where the drift lives. See §6. |

---

## 2. QG1 · `opacity-50` / `opacity-70` repo-wide

The gate's grep pattern (`grep -rEn 'opacity-70|opacity-50'
stages/design/artifacts/ | grep -v 'backdrop-blur\|black/50\|modal-overlay'`)
currently returns 6 material hits outside the 7 declared inputs:

| File · line | Pattern | Impact |
|---|---|---|
| `revisit-modal-states.html:100` | `bg-amber-600 text-white opacity-50 cursor-not-allowed` on disabled "Confirm & Revisit" | Same pattern as bolt-3 fix (primary color + `opacity-50` α-composites to ≈ 2.3:1 on white). Fails WCAG 1.4.3. |
| `revisit-modal-states.html:155` | `border-stone-300 text-stone-700 opacity-50 cursor-not-allowed` on disabled Cancel | Secondary button with opacity-on-root; α-composites text below AA. |
| `revisit-modal-states.html:460` | `border-stone-300 text-stone-700 opacity-50 cursor-not-allowed` on disabled Cancel in "submitting" footer state | Same issue as line 155. |
| `agent-feedback-toggle-spec.html:181` | `cursor-not-allowed opacity-50` applied to `<label>` wrapper containing switch + text | Disabled state shown by applying α on the label root — same anti-pattern banned in unit-11 for card roots. The comment at line 195 claims "still reaches 3:1 contrast for non-text UI" but that only accounts for the switch track; the `text-gray-500` label under opacity-50 composited on `bg-white` light is ≈ 2.3:1 (fails 4.5:1) and composited on `dark:bg-gray-900` is ≈ 2.8:1 (fails 4.5:1). |
| `review-ui-mockup.html:136` | `opacity-60 cursor-not-allowed` on disabled stage-strip button ("Operations") | Not 50/70, so the literal grep doesn't hit, BUT this is the same α-composite-on-disabled anti-pattern and the audit's bolt-1 scope text in contrast-and-type-audit.md §2 cites `.state-disabled button { opacity: 0.5 }` as "banned by FB-19." Flagging for completeness — see §7 recommendation. |
| `review-ui-mockup.html:153` | `opacity-60 cursor-not-allowed` on disabled stage-strip button ("Security") | Same as line 136. |
| `footer-button-copy-spec.md:63` | Prose documents `opacity-50 cursor-not-allowed` as "the standard disabled style" | Contradicts unit-11 and unit-18 policy. This text is the root cause of future regressions because it canonicalizes the banned pattern. |

The 7 declared inputs are clean (`grep -nE 'opacity-70|opacity-50'` across
the 5 HTML inputs returns 0). The gate's repo-wide scope means the
designer hat needs one of:

**Option A (recommended).** Extend the sweep to the 4 sibling artifacts
(`revisit-modal-states.html`, `agent-feedback-toggle-spec.html`,
`review-ui-mockup.html`, `footer-button-copy-spec.md`). Apply the same
canonical secondary-disabled / primary-disabled token pairs. Update
`footer-button-copy-spec.md` §"Disabled" row to point at the canonical
token pair. This is in-scope under the unit's `outputs:` field which
declares `stages/design/artifacts/` wide.

**Option B.** Rewrite QG1/QG2/QG3 gates to scope to the 7 declared
inputs (`grep -rEn ... stages/design/artifacts/feedback-card-states.html
stages/design/artifacts/annotation-popover-states.html ...`). This is a
scope-reduction and should be justified in the audit.

Option A is preferred because the anti-pattern is one category, and
scoping the gate to 7 files creates a silent escape hatch for future
artifacts.

---

## 3. QG2 · banned disabled pairs

The grep `bg-stone-200 text-stone-500|disabled:opacity-50` returns 1
material hit outside the 7 inputs: `revisit-modal-states.html:101` is a
cosmetic caption label (`<p ...>disabled:opacity-50</p>`) inside the
state-inventory grid — it's documenting the literal class string for the
button above it. When line 100 is remediated (see §2), this caption
should be rewritten to describe the new canonical token pair.

`contrast-and-type-audit.md` has several matches (lines 167, 236,
243-244, 254) that are all historical "before" / "after" entries in the
audit prose — those are correct and should stay.

The deeper gap is `knowledge/DESIGN-TOKENS.md:165`:

```
| Disabled state | `disabled:opacity-50 disabled:cursor-not-allowed` |
```

Same root cause as `footer-button-copy-spec.md:63` — the tokens doc
canonicalizes the banned pattern. This row needs to point at the
canonical pair from DESIGN-BRIEF §2 / audit §4, e.g.:

```
| Disabled state (secondary) | `bg-stone-100 text-stone-600 border-stone-400 cursor-not-allowed` + `aria-disabled="true"` |
| Disabled state (primary green) | `bg-green-300 text-green-800 dark:bg-green-900/40 dark:text-green-200 cursor-not-allowed` + `aria-disabled="true"` |
```

---

## 4. QG3 · aria-disabled coverage

Repo-wide count: 66 occurrences of `disabled[ >]`, 34 of
`aria-disabled="true"`. The audit's §4 table scopes to the 7 inputs and
is accurate for that scope (all 8 static-disabled buttons across
feedback-card-states.html (4) + annotation-popover-states.html (4)
carry `aria-disabled="true"`).

Bare `disabled` buttons that lack `aria-disabled="true"` outside the 7
inputs:

| File · line | Element |
|---|---|
| `revisit-modal-states.html:100` | disabled "Confirm & Revisit" (primary) |
| `revisit-modal-states.html:155` | disabled "Cancel" (secondary) |
| `revisit-modal-states.html:460` | disabled "Cancel" in submitting footer |
| `revisit-modal-states.html:461` | disabled "Revisiting…" (`aria-busy` only — should also carry `aria-disabled` since `disabled` is present) |
| `review-ui-mockup.html:136` | disabled "Operations" stage-strip button |
| `review-ui-mockup.html:153` | disabled "Security" stage-strip button |
| `review-ui-mockup.html:856` | disabled "Add feedback above to enable" button (also has `bg-gray-100 text-gray-400` = 2.9:1 — fails 4.5:1) |

All seven need `aria-disabled="true"` per DESIGN-BRIEF §2 line 149. The
review-ui-mockup.html:856 button additionally needs the canonical
secondary-disabled token pair because `text-gray-400` on `bg-gray-100`
is the same 2.9:1 violation the unit is trying to eliminate.

---

## 5. QG4 / QG5 · closed/rejected card token literals

The rendered cards in `feedback-card-states.html` carry the right visual
semantics — muted backgrounds, status glyph, text prefix, full-opacity
strikethrough — but the exact token literals differ from the gate text:

| Gate requirement | feedback-card-states.html actual | Gap |
|---|---|---|
| closed light · `border-l-4 border-l-green-600` | `border-l-[3px] border-l-green-500` | width -1px, color -100 shade |
| rejected light · `border-l-4 border-l-stone-500` | `border-l-[3px] border-l-stone-400` | width -1px, color -100 shade |
| closed dark | `border-l-[3px] border-l-green-400 bg-green-950/25` | not specified in the gate; reasonable dark counterpart but audit should document it |
| rejected dark | `border-l-[3px] border-l-stone-500 bg-stone-800/50` | `bg-stone-800/50` is Tailwind's background-alpha (not wholesale element opacity) so does NOT violate the opacity-on-root policy — but the audit should call this distinction out explicitly because a glance at the class string reads similar to the banned pattern |

Two possible reads:

**Read A (strict).** The gate's literal tokens are canonical; change the
artifact to `border-l-4 border-l-green-600` / `border-l-4
border-l-stone-500`.

**Read B (pragmatic).** `border-l-[3px]` was unit-05's canonical width
for every feedback card status (pending, addressed, closed, rejected);
changing only closed + rejected to `border-l-4` would create an
inconsistency with pending + addressed on the same grid. The color
shades `green-500 / stone-400` pair with the existing sidebar color
language. Update the gate text in a unit-18 follow-up rather than
change the artifact.

Recommendation: **Read B**, because the visual intent is met and
changing widths for only two of four statuses creates asymmetry. The
designer hat should (a) amend the unit-18 audit's §4 / §5 / §6 summary
rows to document the pragmatic token values as canonical, and (b) note
the delta in `contrast-and-type-audit.md` bolt-3 subsection. If the
intent author disagrees and wants Read A, that's one grep-and-replace
per card.

---

## 6. QG6 · DESIGN-BRIEF + DESIGN-TOKENS alignment

DESIGN-BRIEF §2 banned-pairs table already has the opacity-on-state
rows (lines 137-138 in the brief) and the disabled-control row (line
136). **PASS** on that half of the gate.

DESIGN-TOKENS.md gaps:

1. **§1.7 Interaction Tokens (line 165).** Still lists `disabled:opacity-50
   disabled:cursor-not-allowed` as the disabled-state token. This row
   is the canonical source for consumers and directly contradicts the
   banned-pairs in §1.1a line 60. Replace with the canonical
   secondary-disabled and primary-disabled token pairs (see §3 above).

2. **§2.3 Feedback Item Card Tokens (lines 323-328).** The
   status-aware background table lists `closed: bg-green-50/30 /
   dark:bg-green-950/15` and `rejected: bg-stone-50 /
   dark:bg-stone-800/30`. The actual artifact renders AND the unit's
   gate text requires `closed: bg-green-50/60` and `rejected:
   bg-stone-100`. Drift; update the table to the canonical values
   used by the artifact + gate.

3. **§3 Token Mapping.** The unit spec text points at "DESIGN-TOKENS.md
   §3 adds the canonical closed/rejected/pending/addressed background
   tokens" but §3 is the SPA↔SSR mapping table. The canonical card
   backgrounds already live in §2.3 (feedback item card tokens). Two
   reasonable reads:
   - **Read A.** Add the explicit closed/rejected/pending/addressed
     background row to §3 as well, so SSR consumers get the same
     canonical list.
   - **Read B.** Fix the unit spec language (point at §2.3 instead of
     §3) and update §2.3 with the canonical values per point 2 above.
   Either works; Read B is less file churn. Recommend Read B.

---

## 7. Summary — what the designer hat must do

Applying **Option A** from §2 (recommended), **Read B** from §5 and §6.3:

1. **Sweep `revisit-modal-states.html`**: replace the 3 `opacity-50`
   disabled buttons (lines 100, 155, 460) with canonical token pairs:
   - Line 100 (primary amber disabled): `bg-amber-300 text-amber-800
     dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed` (amber
     equivalent of the green-primary-disabled pattern; verify ratios —
     amber-800 on amber-300 light, amber-200 on amber-900/40 dark)
   - Line 155 and 460 (secondary disabled): `bg-stone-100 text-stone-600
     border-stone-400 dark:bg-stone-800 dark:text-stone-300
     dark:border-stone-500 cursor-not-allowed`
   - Add `aria-disabled="true"` on all four (100, 155, 460, 461)
   - Update the caption at line 101 from `disabled:opacity-50` to the
     canonical token-pair string

2. **Sweep `agent-feedback-toggle-spec.html:181`**: remove
   `opacity-50` from the label wrapper; apply muted tokens on the
   individual children (track bg, thumb bg, text color) to signal
   disabled. Update the explanatory prose at line 195 to describe the
   token-based disabled state, not the banned α-composite.

3. **Sweep `review-ui-mockup.html`**:
   - Lines 136, 153: replace `opacity-60 cursor-not-allowed` on the
     upcoming-stage buttons with muted backgrounds/borders via
     `bg-stone-50 dark:bg-stone-900 border-stone-300 dark:border-stone-700
     text-stone-400 dark:text-stone-500` (or equivalent — the stage
     icons already carry muted gray-300 / gray-600 borders, which is
     the right direction). Add `aria-disabled="true"` (`data-disabled="true"`
     already present but screen readers need the ARIA attribute).
   - Line 856: replace `bg-gray-100 dark:bg-gray-800 text-gray-400
     dark:text-gray-500 cursor-not-allowed` with the canonical
     secondary-disabled pair (`bg-stone-100 text-stone-600
     border-stone-400 dark:bg-stone-800 dark:text-stone-300
     dark:border-stone-500 cursor-not-allowed`). Add `aria-disabled="true"`.

4. **Rewrite `footer-button-copy-spec.md:63`**: remove the "Every
   button above inherits ... the standard disabled style (`opacity-50
   cursor-not-allowed`)" claim. Point at the canonical token pair from
   DESIGN-BRIEF §2 / audit §4, split by primary-vs-secondary.

5. **Update `knowledge/DESIGN-TOKENS.md`**:
   - §1.7 line 165: replace `disabled:opacity-50 ...` row with the
     canonical secondary-disabled and primary-disabled token pairs.
   - §2.3 lines 323-328: update `closed: bg-green-50/60` (not /30) and
     `rejected: bg-stone-100` (not `bg-stone-50`). Update dark-mode
     counterparts to match `feedback-card-states.html`.
   - §1.8 / §1.9: cross-check for any other references to the banned
     pattern.

6. **Update `stages/design/artifacts/contrast-and-type-audit.md`**:
   - §2 scope: explicitly state which artifacts were swept and why
     (either widen to 11+ files or keep the 7-file scope and justify
     why the repo-wide gate text is narrowed in practice).
   - §4 table: add rows for the revisit-modal-states.html / review-ui-mockup.html
     / agent-feedback-toggle-spec.html disabled buttons after
     remediation (before/after contrast).
   - §5 aria-disabled table: extend to cover the newly-remediated
     artifacts.
   - §6 Summary table: re-run greps and record post-sweep counts
     (should be 0 for all opacity-50/70 patterns repo-wide).

7. **Optional — §5 Read B documentation.** Amend the audit to note
   that `border-l-[3px]` is the canonical feedback-card-border width
   (set by unit-05, carried forward through unit-18) and that
   `border-l-green-500` / `border-l-stone-400` are the canonical light
   shades. This preserves visual consistency across all four statuses
   while still meeting the spirit of the gate.

---

## 8. What is explicitly NOT required

- No regeneration of `state-signaling-inventory.html`; the status
  glyphs and text prefixes are correct.
- No changes to `feedback-card-states.html` card structure beyond (if
  taking Read A in §5) a single border-width + color bump per status.
- No new components, no new states, no new artifacts. This is a sweep
  of an existing anti-pattern.

---

## 9. Reviewer sign-off criteria

Advance to feedback-assessor when:

- [ ] QG1 grep returns 0 across ALL of `stages/design/artifacts/`
      (not just 7 files), OR the gates are rewritten to scope to 7
      files with justification in the audit.
- [ ] QG2 grep returns 0 and DESIGN-TOKENS.md §1.7 no longer
      documents `disabled:opacity-50` as the canonical disabled state.
- [ ] QG3 aria-disabled coverage is 100% of `<button ... disabled>`
      across all artifacts, with the audit §5 table updated.
- [ ] QG4/QG5 either the artifact matches the gate literals (Read A)
      or the audit documents the pragmatic token choice (Read B).
- [ ] QG6 DESIGN-TOKENS.md §2.3 uses `bg-green-50/60` + `bg-stone-100`
      matching the gate + artifact.
