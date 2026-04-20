---
title: Design review — unit-18 opacity-on-state removal + disabled button contrast (bolt 2)
unit: unit-18-opacity-state-and-disabled-contrast-fixes
reviewer: design-reviewer
bolt: 2
status: changes-requested
created_at: '2026-04-19T20:05:00Z'
updated_at: '2026-04-19T22:30:00Z'
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
closes_fb:
  - FB-46
  - FB-49
  - FB-61
---

# Design review — unit-18 opacity-on-state + disabled contrast (bolt 2)

Scope of review: re-verify the six quality gates after the designer hat's
bolt-2 repo-wide sweep commit (`181ef48c unit-18 bolt-2: repo-wide sweep —
opacity-on-state + disabled-contrast`), which addressed the four sibling
artifacts the bolt-1 review flagged (`revisit-modal-states.html`,
`agent-feedback-toggle-spec.html`, `review-ui-mockup.html`,
`footer-button-copy-spec.md`) plus the two DESIGN-TOKENS.md drift points.

Verdict: **changes requested (again)**. The four flagged artifacts from
the bolt-1 review are cleanly remediated, DESIGN-TOKENS.md §1.7 and §2.3
are aligned with the canonical tokens, and the 7-file declared scope
still passes all gates. But the audit's §6.2 Bolt-4 summary table claims
**"QG1 extended · no `opacity-60` on any card / button root → 0 hits /
PASS"** and that claim is factually wrong — the `opacity-60` grep still
returns 11 hits across two artifacts the bolt-2 sweep did not touch.
Ten of those eleven are applied to card roots, which is the literal
anti-pattern the unit is meant to eliminate repo-wide.

Because DESIGN-TOKENS.md §1.7 now explicitly states `opacity-50` /
`opacity-60` / `opacity-70` are **banned repo-wide** (the bolt-2 note
itself enumerates all three), the artifacts below contradict the
tokens doc that bolt-2 wrote. This is a self-consistency failure, not
a scope-extension argument.

---

## 1. Quality-gate re-run (repo-wide, literal greps)

| Gate | Status | Notes |
|---|---|---|
| **QG1** — zero `opacity-(70\|50)` on card roots | **FAIL (1 hit, borderline)** | 1 match in `state-signaling-inventory.html:363` — inside a `<code>` tag within an `<li>` prose block that documents the ban. Cosmetically the spec-documentation intent is clear, but the grep pattern as written does not exclude `<code>` blocks in HTML. Either widen the grep exclusion (`-v '<code>'`) in the audit's verification script OR rewrite the `<li>` to describe the ban without the literal class strings. See §2. |
| **QG1 extended** — zero `opacity-60` on card / button roots | **FAIL (11 hits, 10 material)** | `revisit-unit-list.html` applies `opacity-60` to the **root** of 9 rendered `.locked-card` cards (lines 243, 255, 267, 279, 291, 303, 315, 341, 389). `comment-to-feedback-flow.html:962` applies `opacity-60` to a rounded card root with a status left-border. This is the literal banned pattern and it α-composites the card's title text (`text-gray-700 dark:text-gray-400`) below WCAG 1.4.3 AA. See §3. |
| **QG2** — zero `bg-stone-200 text-stone-500` / `disabled:opacity-50` | PASS | `grep -rEn 'bg-stone-200 text-stone-500\|disabled:opacity-50' stages/design/artifacts/*.html` → 0 hits. DESIGN-TOKENS.md §1.7 Interaction Tokens row rewritten; only match in the doc is inside the bolt-2-written explanatory note documenting the ban (correct location). |
| **QG3** — every `<button ... disabled>` has paired `aria-disabled="true"` | PASS | Python walker over all `stages/design/artifacts/*.html` → 0 violations. revisit-modal-states.html, review-ui-mockup.html, agent-feedback-toggle-spec.html all correctly paired in bolt-2. |
| **QG4** — closed card: muted bg + ✓ glyph + "Closed ·" prefix | PARTIAL | `feedback-card-states.html` renders `bg-green-50/60` + ✓ + "Closed ·" ✓; uses `border-l-[3px] border-l-green-500` vs. gate literal `border-l-4 border-l-green-600`. Audit §4 documents this as a pragmatic choice (Read B from bolt-1 review). PASS with documented delta. |
| **QG5** — rejected card: muted bg + × glyph + "Rejected ·" prefix + full-opacity line-through | PARTIAL | Same shape as QG4; artifact uses `border-l-[3px] border-l-stone-400` vs. gate literal `border-l-4 border-l-stone-500`. PASS with documented delta. |
| **QG6** — DESIGN-BRIEF §2 + DESIGN-TOKENS.md §1.7 + §2.3 aligned | PASS | §1.7 rewrites disabled-state row as three canonical rows (secondary / primary-green / primary-amber) with ratios. §2.3 updates `closed: bg-green-50/60` and `rejected: bg-stone-100` (light) + `dark:bg-green-950/25` / `dark:bg-stone-800/50` (dark) — matches the artifact and the gate. DESIGN-BRIEF §2 banned-pairs rows unchanged (were correct from bolt-1). |

Net: QG1 (both original and extended) is the blocker. QG2/QG3/QG6 are
solid. QG4/QG5 are PASS with documented Read-B delta.

---

## 2. QG1 (original gate) · single match in `state-signaling-inventory.html`

```
stages/design/artifacts/state-signaling-inventory.html:363:
  <li>Closed state does not use <code>opacity-70</code>; rejected state
      does not use <code>opacity-50</code>. Both convey "finality"
      through muted background (<code>bg-green-50/60</code> /
      <code>bg-stone-100</code>) plus the status badge label.</li>
```

This is explanatory prose inside a `<code>` element — not a rendered
class applied to any element. Two reasonable reads:

**Read A (preferred).** Widen the audit's §4 / §6 verification grep to
exclude `<code>` spans: e.g. add `-v '<code>'` or an sed-level preprocess
that strips `<code>…</code>` before counting. Then re-state the
post-sweep claim correctly as "0 material hits (1 documentation hit in
`<code>` prose excluded)."

**Read B.** Rewrite the `<li>` to describe the ban without quoting the
literal class names: "Closed state does not apply wholesale opacity to
the card root (banned by unit-11 / unit-18). Both closed and rejected
convey finality through muted background tokens plus the status badge
label."

Either works. Read A keeps the documentation precise; Read B makes the
grep work against the literal pattern as specified.

---

## 3. QG1 extended · `opacity-60` on card roots (the blocker)

`grep -rEn 'opacity-60' stages/design/artifacts/*.html` returns 11
hits — 10 material, 1 cosmetic:

### 3.1 `revisit-unit-list.html` · 9 card-root hits + 1 card-root hit

Lines 243, 255, 267, 279, 291, 303, 315, 341, 389 all carry the exact
same pattern on a completed-unit card root:

```html
<div tabindex="0" role="article" aria-label="Completed unit (...)"
     class="locked-card bg-white dark:bg-gray-900 rounded-lg
            border border-gray-200 dark:border-gray-700 shadow-sm p-4
            opacity-60 transition-opacity outline-none">
  <!-- card body: "completed" badge, lock icon, and an h3 title -->
  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-400 mt-1">
    Feedback Data Model Design
  </h3>
</div>
```

### Impact

`opacity-60` α-composited onto the card root:

- **Light mode.** `text-gray-700` (#374151) under 60% opacity on `bg-white` composites to ≈ #7a7f83 → **3.79:1** vs white — FAILS WCAG 1.4.3 (needs ≥ 4.5:1 for body text).
- **Dark mode.** `text-gray-400` (#9ca3af) under 60% opacity on `bg-gray-900` (#111827) composites even worse — ≈ **2.6:1** → FAILS.
- The "completed" and "unit-NN" status badges inside the card also lose contrast through the same α-composite; the badge text was already borderline at ~4.5:1 at full opacity.

This is literally the pattern DESIGN-TOKENS.md §1.7 note (written by
bolt-2 itself) calls out: *"`disabled:opacity-50` and any
`opacity-50`/`opacity-60`/`opacity-70` on a button, card, or wrapper
root is **banned repo-wide**."* The bolt-2 sweep wrote that note and
then missed these 9 card roots in the same tree.

### Remediation

The "locked / read-only / completed" state in `revisit-unit-list.html`
should convey its muted-finality character via non-opacity tokens:

- **Background.** `bg-stone-50 dark:bg-stone-900/60` — subtle surface mute, text/borders stay full opacity.
- **Border.** Keep the existing `border-gray-200 dark:border-gray-700`; optionally dashed to connote read-only: `border-dashed border-stone-300 dark:border-stone-700`.
- **Text.** Lift title from `text-gray-700 dark:text-gray-400` to `text-stone-600 dark:text-stone-300` (metadata contrast per unit-11 / audit §1): 7.14:1 light / 12.6:1 dark.
- **Affordance.** The existing lock glyph + `aria-label="Completed unit (...)"` already carry the read-only semantic; no opacity is needed to reinforce it.
- **Hover behavior.** Replace `transition-opacity` with `transition-colors`; remove the `opacity-60 hover:opacity-80` pattern (line 341 / 389 context) if present, since opacity is no longer load-bearing.

Same treatment for the two "out-of-scope" variants at lines 341 and
389 (each applies `opacity-60` to the card root — same issue).

### 3.2 `comment-to-feedback-flow.html:962` · collapsed card preview

```html
<div class="border-l-[3px] border-l-amber-400 p-2 rounded-lg
            bg-amber-950/20 border border-gray-700 opacity-60">
  <p class="text-[9px] text-gray-400 truncate">Header alignment off...</p>
</div>
```

Three problems in a tight cluster:

1. **`opacity-60` on a card root** with status left-border — the banned pattern (same as §3.1).
2. **`text-[9px]`** — violates unit-11 typography floor (12px minimum for user-facing info; 11px allowed only with `font-semibold`/`font-bold`).
3. **`text-gray-400` on `bg-amber-950/20` composited over parent dark background** — at full opacity already borderline; under 60% α-composite it drops below 3:1.

Remediation: drop `opacity-60`, lift text size to `text-xs`, and use
`text-stone-300` (dark-mode metadata floor) on the `bg-amber-950/20`
card root. This file was not listed in the bolt-1 review §2 table;
bolt-2 picked it up only partially by touching the sibling `revisit-modal-states.html`.

### 3.3 `comment-to-feedback-flow.html:325` and `:773` · cosmetic overlays (not card roots)

- Line 325: `opacity-60` on a 6×6 teal ring used as a visual "crosshair cursor" mockup — decorative, not a card root, not a text carrier. Acceptable to keep.
- Line 773: `opacity-60` on a mockup-placeholder `<div>` meant to visualize "sidebar content dimmed behind error toast" — this IS a demo of what an error overlay looks like in the product, not a production card. Ambiguous. If the intent is to show the literal visual effect, fine; if the intent is a canonical pattern, replace with a solid muted token. Recommend adding an inline comment `<!-- demo-only: simulates backdrop dim; not a production class -->` to disambiguate for future reviewers.

Neither of the cosmetic hits is a blocker in isolation, but the
bolt-2 audit's "0 hits" claim means the audit table should at least
acknowledge the 2 decorative matches + the 1 borderline line 962.

---

## 4. QG2 · canonical disabled-pair verification (post-bolt-2)

Spot-checked every file the bolt-2 commit touched:

- `revisit-modal-states.html`: all three previously-flagged `opacity-50` disabled buttons (lines 100, 155, 460) rewritten to canonical token pairs. Amber-primary-disabled uses `bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200` (ratios 5.30:1 / 8.15:1 per the audit's Bolt-4 table — I recomputed against the literal hex values and confirm). Secondary-disabled uses the canonical `bg-stone-100 text-stone-600 border-stone-400 (+ dark counterpart)` pair. The submitting-footer "Revisiting…" button now carries both `disabled` and `aria-disabled="true"` alongside the existing `aria-busy`.
- `agent-feedback-toggle-spec.html:181`: `opacity-50` removed from the label wrapper. Switch disabled state now conveyed via muted track (`bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500`) + muted thumb; label text stays at full-opacity `text-gray-700 dark:text-gray-300` (≥ 8.59:1 light / ≥ 10:1 dark). Explanatory prose rewritten.
- `review-ui-mockup.html`: line 136 / 153 upcoming-stage buttons had `opacity-60` stripped; stage-strip now renders the muted appearance via `border-gray-300 dark:border-gray-600` + `text-gray-500 dark:text-gray-400` label (full opacity). `aria-disabled="true"` added. Line 856's "Add feedback above to enable" and the dynamic "Approve (no-op outside gate)" buttons both use the canonical secondary-disabled token pair.
- `footer-button-copy-spec.md:63`: the "standard disabled style" prose replaced with three canonical rows (primary-green / primary-amber / secondary) citing ratios.

All four artifacts are clean. QG2 PASSES.

---

## 5. QG3 · aria-disabled coverage (post-bolt-2)

Python walker:

```python
import re, glob
violations = 0
for f in sorted(glob.glob('stages/design/artifacts/*.html')):
    text = open(f).read()
    for o in re.findall(r'<button\b[^>]*>', text, re.DOTALL):
        if re.search(r'(?<![-\w:])\bdisabled\b(?!:)(?![-\w])', o) and 'aria-disabled' not in o:
            violations += 1
            print(f, o[:160])
print('violations', violations)
```

→ **violations 0** repo-wide. The bolt-1 flagged bare-`disabled`
buttons in `revisit-modal-states.html` (4 sites) and `review-ui-mockup.html`
(2 sites) all now pair with `aria-disabled="true"`. QG3 PASSES.

---

## 6. QG4 / QG5 · closed / rejected card token literals (Read-B delta)

`feedback-card-states.html` renders:

- **Closed (light).** `border-l-[3px] border-l-green-500 bg-green-50/60` + ✓ glyph (white on `bg-green-600` circle) + "Closed ·" prefix on title.
- **Closed (dark).** `border-l-[3px] border-l-green-400 bg-green-950/25`.
- **Rejected (light).** `border-l-[3px] border-l-stone-400 bg-stone-100` + × glyph + "Rejected ·" prefix + `text-stone-600 line-through decoration-stone-600` (full opacity).
- **Rejected (dark).** `border-l-[3px] border-l-stone-500 bg-stone-800/50`.

The gate literals cite `border-l-4 border-l-green-600` (closed) and
`border-l-4 border-l-stone-500` (rejected). `contrast-and-type-audit.md`
§4 "Border-width convention" now documents this as a pragmatic choice
to preserve per-status border-width symmetry (unit-05 set
`border-l-[3px]` for ALL four statuses). PASS with documented delta
(Read B from bolt-1 §5 carried forward). No regression; no action
required here.

---

## 7. QG6 · DESIGN-BRIEF + DESIGN-TOKENS alignment (post-bolt-2)

Verified:

1. **DESIGN-TOKENS.md §1.7 Interaction Tokens.** The `disabled:opacity-50` row is replaced with three rows (secondary / primary-green / primary-amber), each citing the canonical token pair + `aria-disabled="true"` + measured contrast ratios. Matches DESIGN-BRIEF §2 and audit §4 / §4 Bolt-4 tables.
2. **DESIGN-TOKENS.md §2.3 Feedback Item Card Tokens.** `closed: bg-green-50/60` (not /30) and `rejected: bg-stone-100` (not `bg-stone-50`) now match `feedback-card-states.html` and the QG4/QG5 literals. Dark-mode counterparts (`dark:bg-green-950/25` / `dark:bg-stone-800/50`) are called out with an explicit note that the dark-mode `bg-*/alpha` tokens use Tailwind's background-alpha (not wholesale element opacity) so do not violate the opacity-on-root ban.
3. **DESIGN-TOKENS.md §1.7 note.** Explicit repo-wide ban: *"`disabled:opacity-50` and any `opacity-50`/`opacity-60`/`opacity-70` on a button, card, or wrapper root is banned repo-wide."* — this is exactly right, and it is precisely this note that makes the §3.1 `revisit-unit-list.html` `opacity-60` usage a blocker.

QG6 PASSES.

---

## 8. Audit self-consistency — §6.2 Bolt-4 summary table

The audit's §6.2 Unit-18 repo-wide scope summary table lists:

> | QG1 extended · no `opacity-60` on any card / button root | `grep -rEn 'opacity-60' stages/design/artifacts/*.html` | 0 hits | PASS |

This row is **factually incorrect**. Re-run:

```bash
$ grep -rEn 'opacity-60' stages/design/artifacts/*.html | wc -l
11
```

With 10 of those 11 on card roots. The audit must be corrected to
match reality. Either:

**Option A (recommended).** Fix the artifacts (§3.1 / §3.2 remediation
above), then re-run the grep — should legitimately hit 0 card-root
matches (leaving only the 2 decorative cursor/mockup overlays in
`comment-to-feedback-flow.html`, which the audit should list
explicitly as "2 decorative-overlay matches retained, not card
roots").

**Option B (NOT recommended).** Scope the gate narrower (e.g. only
the 7 declared inputs) and justify it. This recreates the exact
"silent escape hatch" the bolt-1 review warned against, and
contradicts the bolt-2 DESIGN-TOKENS.md §1.7 note that declares the
ban repo-wide.

Option A is the only path that doesn't write a contradiction into the
tokens doc.

---

## 9. Summary — what the designer hat must do (bolt 3)

1. **Fix `revisit-unit-list.html` locked-card treatment** (§3.1). Remove `opacity-60` from all 11 sites (9 rendered cards + 2 variants at 341/389). Replace with muted background + lifted text tokens per §3.1 recommendation. Lines to touch: 243, 255, 267, 279, 291, 303, 315, 341, 389 (confirm with `grep -nE 'opacity-60' stages/design/artifacts/revisit-unit-list.html`).

2. **Fix `comment-to-feedback-flow.html:962`** (§3.2). Drop `opacity-60`, lift text size to `text-xs`, lift text color to `text-stone-300` on the dark `bg-amber-950/20` surface. Optional: also lift the `text-[9px]` / `text-[10px]` instances in the same file to the unit-11 floor (12px), though this is strictly a unit-11 scope creep — flag it in the audit if deferred.

3. **Disambiguate `comment-to-feedback-flow.html:325` / :773** (§3.3). Add inline comments documenting these as demo-only visual mockups (crosshair cursor ring + simulated dimmed-behind-toast placeholder), not production classes.

4. **Fix `state-signaling-inventory.html:363`** (§2). Either Read A (widen the audit's grep exclusion to skip `<code>` blocks) or Read B (rewrite the `<li>` to describe the ban without literal class names). Read B is less tooling change.

5. **Correct the audit's §6.2 Bolt-4 summary table** (§8). Rewrite the "QG1 extended · 0 hits" row to match post-fix reality. If 2 decorative overlays are intentionally retained, list them explicitly with inline-comment justification.

6. **Re-run all six gates** after the fixes and record post-bolt-3 counts in `contrast-and-type-audit.md` §4 Bolt-5 (next increment). Paste the exact grep output; do not narrate a count that has not been verified.

---

## 10. What is explicitly NOT required (bolt 3)

- No changes to the 7 declared inputs — they passed in bolt-1/bolt-3 and still pass in bolt-2.
- No changes to the canonical disabled-token pairs — they are correct and consistently applied.
- No changes to QG4 / QG5 border-width literals — the Read-B pragmatic delta is documented and accepted.
- No regeneration of `state-signaling-inventory.html` structure beyond the single `<li>` text fix in §2.

---

## 11. Reviewer sign-off criteria (bolt 3)

Advance to feedback-assessor when:

- [ ] `grep -rEn 'opacity-60' stages/design/artifacts/*.html` returns only the 2 disambiguated decorative-overlay matches (or 0).
- [ ] `grep -rEn 'opacity-70\|opacity-50' stages/design/artifacts/*.html | grep -v 'backdrop-blur\|black/50\|modal-overlay'` returns 0 (after the `state-signaling-inventory.html:363` fix).
- [ ] QG2 / QG3 / QG6 remain 0-violation (no regression).
- [ ] `contrast-and-type-audit.md` §6.2 summary table accurately reflects the post-bolt-3 grep counts — no "PASS" row that contradicts its own grep.
- [ ] QG4 / QG5 border-width Read-B delta remains documented in the audit and accepted.
