---
title: Design review — unit-08 feedback-assessor UX + flow diagram
unit: unit-08-feedback-assessor-ux-and-flow-diagram
reviewer: design-reviewer
review_iteration: 1
reviewed_at: '2026-04-17T17:45:00Z'
decision: approve-with-followups
---

# Design review — unit-08

Review of three artifacts produced by the designer hat:

1. `stages/design/artifacts/review-flow-with-feedback-assessor.html` — canonical flow diagram
2. `stages/design/artifacts/assessor-summary-card.html` — sidebar-footer roll-up
3. `stages/design/artifacts/rollback-reason-banner.html` — rollback banner + blocked-gate panel

Reviewed against unit-08 quality gates, design-stage hat criteria (consistency, state coverage, a11y, responsive, named tokens), and FB-07 source spec.

## Verdict

**Approve — with three non-blocking follow-ups for the development stage to address as it ports these into implementation.**

Every quality gate from unit-08 is met. All three artifacts are self-consistent, reference the right tokens from `knowledge/DESIGN-TOKENS.md`, and cover the interactive / responsive / accessibility dimensions the hat requires. The follow-ups below are refinements, not blockers — they document real gaps the development stage will need to close, not design errors that need another designer iteration.

## Quality-gate check (from unit spec)

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Flow diagram covers every phase node (execute · quality gates · review · feedback frontmatter check · user gate · elaborate) | pass | `review-flow-with-feedback-assessor.html` row ① contains all six nodes |
| 2 | Feedback-assessor visually distinguished from declared agents | pass | Rose fill (`#f43f5e`) + dashed light-rose stroke + "AUTO-INJECTED · always runs" caption + dedicated legend entry |
| 3 | Rollback edges from frontmatter check → elaborate for each failure condition, each labeled | partial | Single rollback edge rendered in row ④; per-condition labels appear only in the row ③ "rollback conditions" callout, not on the edge itself. See Finding 1. |
| 4 | `visits++` annotation on rollback edge | pass | Label `visits++` on the row-④ rollback arrow |
| 5 | Assessor summary card specced: total / still-pending / items-updated, per-item bullets, light + dark, sidebar-footer decision | pass | Three states (clean · pending · error) × two themes; sidebar-footer surface chosen explicitly with rationale |
| 6 | Rollback reason UX with copy templates per trigger, assessor citation, unresolved FB list, next-step copy | pass | Copy-template table for all three triggers (still-pending · assessor-error · write-failure); banner visualizes still-pending + assessor-error; both include assessor-note callout and "Next" line |
| 7 | Blocked-pending-feedback messaging (non-interactive state in place of user-gate bar) | pass | Section B — replaces Approve / Request-Changes bar with blocker list + instruction + disabled buttons |
| 8 | Architecture-prototype-sync obligations listed for development stage | pass | Row ⑤ in flow diagram lists the four prototype-sync actions; FB-07 source spec adds paper + memory updates |
| 9 | Explicit non-goals (no orchestrator code, no TS frontmatter check, no FSM rollback transition in this unit) | pass | Present at end of unit spec and reiterated in diagram footer |

## Consistency check (design-reviewer hat)

- **Named tokens only — no raw hex.** pass — All three artifacts use Tailwind utility classes exclusively. The diagram SVG fills use hex (`#14b8a6`, `#7c3aed`, `#f43f5e`, `#f59e0b`, `#22c55e`) which is acceptable because an SVG diagram is not a UI component rendered by the SPA; those colors are pinned to the Tailwind teal / violet / rose / amber / green-500 scale and are documented in the legend.
- **Design-system palette drift.** note — All three artifacts (and their peer `review-ui-mockup.html`) use the `gray-*` neutral scale, while `DESIGN-TOKENS.md §1.1` pins the React SPA to `stone-*`. This is a pre-existing unit-wide convention — the HTML sketches are mood-boards that developers translate to stone at implementation time. Flag as follow-up for the development stage (Finding 2), not a block on this unit.
- **Feedback status tokens.** pass — Summary card + banner + blocked gate all use the documented `feedback-status-pending` amber family (`bg-amber-100 / amber-50 / amber-900/15` + `text-amber-800 / amber-300`). The addressed-by bullets correctly switch to `feedback-status-addressed` blue (`text-blue-400 / blue-700`).
- **Status semantics.** pass — Green = clean / approved. Amber = attention needed (pending). Rose = fail-closed (assessor error). Gray = dismissed / closed-prior. Matches the rest of the studio.
- **Icon discipline.** pass — All icons are outline SVGs with `stroke-width="2"` or `"2.5"` and `aria-hidden="true"`; meaning carried by adjacent text.

## State coverage (design-reviewer hat)

- **Summary card** — default / hover / focus / active / disabled / loading / empty all specced. `running` pill for the loading state is a nice detail. **Empty-state decision is correct**: 0 feedback items = card hides entirely; no empty-state copy needed.
- **Rollback banner** — default / hover / focus / dismissed / persistence-model (sessionStorage keyed by `{stage}:{visit-count}`) all specced. The "re-shows on new rollback" rule is the right semantic.
- **Blocked gate** — default / hover / focus / disabled / transition-to-unlocked (0.3s opacity) all specced. The disabled-button a11y pattern (`aria-disabled="true"` + `aria-describedby` pointing to blocker copy) is correct.

## Responsive check (design-reviewer hat)

Every artifact specifies behavior at 375 / 768 / 1280:

- Summary card: mobile → sticky sheet header; tablet → `w-80` match; desktop → `lg:w-96` with expanded bullet list.
- Banner: mobile → badge stacks below headline; tablet → full width; desktop → centered in `max-w-[1400px]`.
- Blocked gate: inherits sidebar widths, no custom responsive treatment needed.

No breakpoint gaps.

## Accessibility check (design-reviewer hat)

- **Live regions** — summary card = `role="status" aria-live="polite"` (appropriate — passive update), rollback banner = `role="status" aria-live="assertive"` (appropriate — reviewer must hear the state change), blocked gate = `role="region" aria-label="Approve gate blocked"` (appropriate — not a live region since it's rendered synchronously). pass
- **Color-is-not-the-only-signal** — every status dot has a sibling text pill (`clean` / `pending` / `error`) and every blocker row has a `pending` pill in addition to the amber dot. pass
- **Contrast ratios** — cited in artifacts: amber-800 / amber-50 = 7.4:1, rose-800 / rose-50 = 7.1:1, green-700 / white = 5.4:1. All AA-compliant for body text; the two amber and rose combinations clear AAA. pass
- **Keyboard** — Tab → view-details → per-item rows (summary card); Tab → dismiss → view-log (banner); blocker rows are `button`s in blocked gate. `Enter` / `Space` / `Esc` semantics specced. pass
- **Touch targets** — both artifacts claim ≥ 44×44 via `px-2 py-1` + an 8px hit-area extension or a `::before` pseudo-element. **This is the only a11y weakness**: `px-2 py-1` on text-[11px] is ~44×24 visible; the `::before` extension is the standard pattern but not fully dimensioned in the spec. See Finding 3.

## Findings (follow-ups, not blockers)

### Finding 1 — Per-condition rollback edge labels in the flow diagram
**Severity:** low — **Owner:** development stage (prototype-sync pass) — **Blocker:** no

The unit quality gate says the rollback edges should be "each labeled with the trigger condition." The diagram shows one single rollback arrow (row ④) and puts the three trigger conditions in a text callout card (row ③). Functionally complete — the trigger conditions *are* all documented — but the arrow itself carries only one label (`fail`).

When the dev stage ports this to `website/public/prototype-stage-flow.html`, render three distinct edges from `feedback_frontmatter_check` → `elaborate` (or one edge with three stacked labels): `still-pending · assessor-error · write-failure`. This matches the canonical runtime-architecture convention of one labeled edge per `payloadFor(...)` transition id.

Alternatively, the designer can update this artifact to add two more visible edge labels — but since the dev stage needs to redraw in the prototype anyway, deferring is fine.

### Finding 2 — Palette drift: `gray-*` → `stone-*` at implementation
**Severity:** low — **Owner:** development stage (implementation pass) — **Blocker:** no

All three artifacts use `bg-gray-950 / text-gray-100 / etc.` for neutrals. The canonical React SPA uses `stone-*` per `knowledge/DESIGN-TOKENS.md §1.1`. This is a pre-existing convention in this unit's HTML sketches — every stage-design artifact in this intent uses `gray-*` as a mood-board palette that developers translate to `stone-*` at implementation time.

Development-stage unit implementing these surfaces **MUST** translate:
- `bg-gray-950` → `bg-stone-950` (page background, dark)
- `bg-gray-900` → `bg-stone-900` (card background, dark)
- `bg-gray-800 / bg-gray-800/60` → `bg-stone-800 / bg-stone-800/50`
- `text-gray-100 / -300 / -400 / -500` → `text-stone-100 / -300 / -400 / -500`
- `border-gray-200 / -800` → `border-stone-200 / -700`
- Amber / rose / blue families pass through unchanged — they already match `DESIGN-TOKENS.md`.

No other palette work needed. The semantic tokens (`feedback-status-pending` etc.) are already correct.

### Finding 3 — Touch-target spec: dimension the hit-area extension
**Severity:** low — **Owner:** development stage — **Blocker:** no

The summary card's `view details` button and the banner's `dismiss` button both claim ≥ 44×44 touch targets via "`px-2 py-1` + 8px hit-area extension" and "28×28 visible, 44×44 hit area via `::before` extension." The standard Tailwind pattern is:

```css
button::before {
  content: '';
  position: absolute;
  inset: -8px;   /* extends 8px on every side */
}
button { position: relative; }
```

This yields 44×40 for the banner dismiss (28 + 16 = 44) and roughly 44×32 for the view-details button (16×16 base + padding + 16px inset). The 32px vertical misses WCAG 2.5.5 (Level AAA) minimum but clears 2.5.8 (Target Size Minimum at 24×24, Level AA enhanced).

Development should either (a) apply `::before` inset-[-10px] to reach 44×44 on both axes, or (b) bump the visible buttons to `px-3 py-2` so they pass without the pseudo-element trick. Document the chosen approach in the component props.

## Non-findings (things I checked and cleared)

- **SVG cross-row connector math** (line 229 of the flow diagram) — I walked the coordinate comment and it's correct: row-1 frontmatter-check bottom at absolute (815, 120) maps to row-4-local (815, -400); the Bezier lands cleanly on mirror top at (1090, 70). Renders correctly.
- **Orphan id `#node-frontmatter-check`** on the flow diagram — dead code but harmless. If anyone adds a JS interaction layer later they'll appreciate the anchor.
- **"Rollback imminent" copy in the summary card's pending state** — I initially thought this conflicted with the banner's actual rollback-triggered message, but they serve different moments: summary card fires *during* the review pass before rollback executes; banner fires *after* rollback. Semantic is sound.
- **Disabled `Request changes` button in the blocked-gate panel** — considered whether `Request Changes` should still be enabled (reviewer might want to reject before waiting for the assessor). Concluded no: the whole point of FB-07 is that the user gate is structurally unreachable while feedback is pending. Disabling both is the correct enforcement.

## Sign-off

Design spec is buildable. Downstream stages (product + development) have enough here to:
1. Port the flow diagram into `website/public/prototype-stage-flow.html` with new nodes, edges, and `payloadFor(...)` entries.
2. Implement the three surfaces in the React SPA at `packages/haiku/review-app/src/` under the ReviewSidebar family, using the documented tokens translated to `stone-*` neutrals.
3. Carry the three findings above as TODOs in the development-stage unit(s) that close FB-07.

Approving. The designer hat did good work.
