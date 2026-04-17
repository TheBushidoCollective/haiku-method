---
name: design-artifacts
artifact_type: design-review
unit: unit-04-annotation-creation-ux
reviewer: design-reviewer
bolt: 3
reviewed_files:
  - stages/design/artifacts/annotation-gesture-spec.html
  - stages/design/artifacts/annotation-popover-states.html
outcome: approve
nits_addressed_inline:
  - focus-ring inconsistency (State 3 Step A inputs · gesture-spec §6 form): ring-1 → ring-2
  - aria-required contradiction: moved from title to body; title labelled "Title (optional)"
---

# Design review — Annotation creation UX (unit-04, bolt 3)

Review of bolt-3 designer output against the unit's quality gates, the design-reviewer hat's four-point focus (consistency, state coverage, responsive behavior, accessibility), and the existing design system in `knowledge/DESIGN-TOKENS.md` and `stages/design/DESIGN-BRIEF.md`.

**Outcome:** approve. Every blocker from the bolt-1 review has been properly resolved in bolt 3. Three nits surfaced during this review: #1 is an existing drift in `review-ui-mockup.html` (out of this unit's scope — flagged for dev handoff), and #2 + #3 were single-line fixes applied in place during this review pass so the artifacts ship clean.

## 1. Quality-gate coverage (unit-04 spec § Quality Gates)

| Gate | Artifact | Verdict |
|---|---|---|
| Creation gesture, cursor affordance, popover UX for every artifact kind (image · svg · md/text · html · pdf) | gesture-spec §2 gesture matrix (5 rows) + §§3–6 per-kind callouts | **pass** |
| Coordinate schema: spatial `{x,y}` ∈ [0,1]; text `{line}` 1-indexed; iframe fallback `{page, region}` | gesture-spec §9 storage contract + invariants | **pass** |
| Light + dark wireframes for open / filled / iframe fallback popover states; small-viewport documented | popover-states States 1 (open), 2 (filled), 3 (iframe 2-step), 5 (mobile bottom sheet), 6 (forced-dark parity); all other states carry `dark:` classes | **pass** |
| Keyboard equivalent specified, tied to unit-07 shortcut map | gesture-spec §7 keyboard table; handoff note in unit frontmatter for unit-07 `c` row | **pass** |
| Accessibility: focus trap, focus return, `aria-label`, ESC cancels, ≥44px mobile touch targets | gesture-spec §8 a11y contract; all 7 popover instances set `role="dialog" aria-modal="true" aria-labelledby`; State 5 `h-11` bottom-sheet buttons | **pass** |
| Storage contract persistable through `feedback.target.annotation` | gesture-spec §9 three-shape union + server invariants + JSON example | **pass** |

All six quality gates are satisfied.

## 2. Design-system consistency

Cross-referenced against `knowledge/DESIGN-TOKENS.md` and `stages/design/DESIGN-BRIEF.md`:

- **Popover shell** (`rounded-xl`, `border-teal-300 dark:border-teal-800`, `shadow-2xl`) — matches the DESIGN-BRIEF confirm-dialog / modal token (line 42) and the DESIGN-TOKENS modal overlay row (§ 1.5). The existing `ann-popover` in `review-ui-mockup.html` uses `rounded-lg` + `dark:border-teal-700` — a pre-existing drift from the canonical modal token. The new spec aligns with the canonical token (`rounded-xl` + `dark:border-teal-800`). **Verdict: OK — the new artifacts are right; the reference mockup is the one that's drifted.** Flagged below as nit #1 so dev can harmonize when wiring this up.
- **Input / textarea** — `text-xs p-2 border-stone-300 rounded-md` for desktop (compact variant per DESIGN-TOKENS § 1.5), `text-sm p-3 rounded-lg` for mobile (full variant). Matches the compact/full token split. **Consistent.**
- **Buttons** — desktop footer `px-2.5 py-1 text-[10px] rounded-md` (tight, per the popover density); mobile footer `h-11 flex-1 text-sm rounded-lg` (full size). Primary teal, secondary outline, destructive red-600 retry all match existing button tokens. **Consistent.**
- **Focus ring** — `focus:ring-2 focus:ring-teal-500` on all title / body / mobile / location-form inputs. Matches DESIGN-TOKENS § 1.7 focus-ring pattern. Nit #2 (State 3 Step A + gesture-spec §6 form originally used `focus:ring-1`) **fixed in place during this review** — now consistent across every input in the feature.
- **Status / origin / pin colors** — pins, ghost pin, amber existing-annotation highlight, teal primary all draw from the existing DESIGN-TOKENS palette. **Consistent.**
- **Token provenance section** at the bottom of `annotation-popover-states.html` explicitly lists Tailwind equivalents for every demo-CSS custom property and flags the CSS as demonstration-only. Good discipline — no raw hex leaks, and dev hand-off is unambiguous.

## 3. Interactive state coverage

Popover lifecycle covered end-to-end:
- **State 1** open + empty (spatial anchor)
- **State 2** open + filled, Create enabled (line anchor)
- **State 2B** saving (transient, `aria-busy`, Cancel suppressed, spinner button)
- **State 3** iframe fallback — two-step location form + follow-up popover
- **State 4** error (banner inline, Retry + Discard)
- **State 5** small viewport bottom sheet
- **State 6** forced-dark parity

Element-level states (default / hover / focus / active / disabled / error) enumerated in the interactive state matrix for title input, body textarea, Create button, Cancel button, Close (×), and ghost pin. **Comprehensive.**

## 4. Responsive behavior

- Desktop / tablet: 288px fixed width popover anchored to right-and-below of click with 10px offset.
- Narrow-desktop / wide-tablet (~640–900px, sidebar present): popover docks above/below the artifact when neither left nor right placement fits. Good — this is the bolt-2 fix that replaced the original flip-only rule.
- Small viewport (< 480px): popover promotes to a full-width bottom sheet with 16px top radius, drag handle, ≥ 44px button targets, swipe-down-to-dismiss.

All three breakpoints have explicit rules. **Complete.**

## 5. Accessibility contract

- Focus trap between title → body → Cancel → Create → loop. ✓
- Focus return to the trigger element on close (save / cancel / ESC / click-outside). ✓
- `role="dialog" aria-modal="true" aria-labelledby` on every popover instance, with a stable `ann-popover-label-{uuid}` label id. ✓
- ESC cancels creation; click-outside on desktop is treated as Cancel; mobile cancels via drag-handle swipe or backdrop tap. ✓
- Save triggers a `role="status" aria-live="polite"` announcement (gesture-spec §8 bullet 5). ✓
- Touch targets ≥ 44 × 44px on mobile footer. ✓
- No color-only signals — pin status encoded as both color + numeric label; ghost pin uses dashed border + semi-opaque fill. ✓

**One a11y contradiction found and fixed** (nit #3 below): gesture-spec §8 originally said the title input has `aria-required="true"`, but popover-states State 1's "Create button" callout (line 215) said "Title is optional at the UI layer." Fixed in place during this review: `aria-required="true"` now sits on the body textarea (the field the server actually requires), title is labeled "Title (optional)", and the §8 bullet prose now describes the correct split. States 1, 2, and 3 markup all updated.

## 6. Findings summary

### Blockers from bolt-1 review — verified resolved in bolt 3

All five blockers and three nits flagged in the previous review cycle have been properly addressed. Spot-checks:

- ✓ Storage contract collapsed to exactly three canonical shapes. Server invariants enumerate MIME-conditional rules for `page`. The bolt-2 commit message matches what's on disk.
- ✓ Keyboard remapped to `c` (create) to avoid `a` collision. Gesture matrix, line-row prose, and keyboard table are all consistent. Handoff note added to unit frontmatter for unit-07.
- ✓ All 7 popover instances have `aria-labelledby` pointing at a location-label with a stable id. The header paragraph now carries that id.
- ✓ Click-outside-to-cancel added to §8 bullet 4 with matching mobile variant.
- ✓ State 2B (saving) inserted between filled and error. `aria-busy`, disabled inputs, Cancel suppressed, transitions enumerated.
- ✓ Edge-clipping promoted to flip-or-dock. State 1 callout documents the narrow-desktop dock rule.
- ✓ Token CSS migrated to named custom properties. No raw hex in CSS rules.

### New nits from this review

| # | Location | Severity | Finding | Resolution |
|---|---|---|---|---|
| 1 | `review-ui-mockup.html` line 272 (existing, out-of-scope) | info | Pre-existing popover drift: `rounded-lg` + `dark:border-teal-700` vs canonical `rounded-xl` + `dark:border-teal-800`. | Flagged for dev handoff. Harmonize when dev wires up the new popover — or capture as a seedling. Not this unit's scope. |
| 2 | `annotation-popover-states.html` State 3 Step A (lines 336, 338) + `annotation-gesture-spec.html` §6 form inputs | low | Location-form inputs used `focus:ring-1` while the rest of the popover uses `focus:ring-2`. Inconsistent within the same feature. | **Fixed in this review** — four input classes flipped from `focus:ring-1` to `focus:ring-2`. |
| 3 | `annotation-gesture-spec.html` §8 ARIA bullet + `annotation-popover-states.html` States 1/2/3 title inputs | low | `aria-required="true"` on title contradicted the State 1 Create-button rule that "title is optional at the UI layer." Screen readers would announce title as required and mislead users. | **Fixed in this review** — `aria-required="true"` moved from title → body (where the server actually enforces it); title inputs relabeled "Title (optional)"; body placeholders relabeled "Detail… (required)"; gesture-spec §8 ARIA bullet rewritten to describe the correct split. |

Nit #1 is the only remaining finding and it's explicitly out of scope for this unit — it's a drift in the existing `review-ui-mockup.html` that predates this work. Not a blocker; dev can harmonize at implementation time.

### Handoff hygiene

- ✓ Unit frontmatter carries handoff notes for unit-07 (`c` shortcut row) and `knowledge/DATA-CONTRACTS.md` §3.3 (three-shape union) — both explicitly out of scope for this unit and both correctly flagged as downstream work.
- ✓ Outputs listed in frontmatter match the two artifact files on disk.
- ✓ `bolt: 1`/`hat: designer` in frontmatter is stale (we're on bolt 3, design-reviewer) but that's a state-tracking artifact owned by the harness, not something this hat writes.

## 7. Recommendation

**Advance hat.** All six quality gates pass. All bolt-1/2 blockers are resolved. Nits #2 and #3 were fixed in place during this review pass; nit #1 is an existing drift in an already-merged artifact and is out of this unit's scope. The artifacts are concrete enough for development to wire up without inventing UX — which is the stated bar in the unit's goal statement.
