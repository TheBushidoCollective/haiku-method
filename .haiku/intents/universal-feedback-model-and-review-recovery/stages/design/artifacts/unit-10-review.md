# Unit-10 Design Review — reject notes

Reviewed `unit-10-stage-wide-token-audit` against the quality gates enumerated in the unit frontmatter.

## Gates that pass

All six machine-verifiable grep gates from `token-audit-report.md` now return 0:

1. `grep -rn 'gray-' stages/design/artifacts/` → 0 (FB-11 closed)
2. `grep -rEn '#[0-9a-fA-F]{3,8}\b' stages/design/artifacts/` → 0 (FB-16 closed — CSS-var block strategy is clean, uses `rgb()` so it doesn't self-match)
3. `grep -rEn 'text-amber-700|text-blue-700|text-green-700' stages/design/artifacts/` → 0 (FB-18 partial)
4. `grep -rEn 'class="w-96[^"]*shrink-0' stages/design/artifacts/` → 0 (bare `w-96` removed)
5. `grep -rEn '&#[0-9]+;' stages/design/artifacts/` → 0 (entity sweep clean)
6. `grep -rEn 'Desktop \(1280|desktop 1280' stages/design/artifacts/` → 0 (FB-29 closed)

Origin-badge inventory (FB-21) matches row-for-row across DESIGN-BRIEF §2 lines 167-172, DESIGN-TOKENS §2.2 lines 223-228, and feedback-card-states.html §4 lines 406-443. Breakpoint set (FB-29) canonical across brief + artifacts.

## Gates that fail

### 1. Rejected status-badge shade drift (FB-18 residual)

DESIGN-BRIEF §2 line 134 and §6 line 613 both specify `bg-stone-100 text-stone-500` for `rejected` (light). Every other artifact matches. One artifact drifts:

- `stages/design/artifacts/feedback-card-states.html:56` uses `bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400` in the "Section 1 — States × Buttons" summary table.

The same file's mockup on line 158 correctly uses `text-stone-500`. The line-56 drift violates the unit-10 gate: *"DESIGN-BRIEF §2 color mapping and §6 WCAG table both specify the SAME shade pair for pending/addressed/closed/rejected, and every artifact uses the same shade pair."*

Fix: change `text-stone-600` → `text-stone-500` on `feedback-card-states.html:56`.

### 2. Canonical sidebar width missing on feedback-inline-desktop (FB-23 residual)

DESIGN-BRIEF §4 line 508 declares the canonical feedback-sidebar pattern as `w-80 lg:w-96 shrink-0 …`. The gate says: *"every sidebar container in every artifact uses the canonical responsive width pattern."*

- `stages/design/artifacts/feedback-inline-desktop.html:304` wraps the review sidebar in `<div class="hidden lg:block w-80 shrink-0">` — missing the `lg:w-96` desktop upgrade.

The inner `<aside id="review-sidebar">` on line 305 has no width classes, so the wrapper is the canonical container. It should be `w-80 lg:w-96 shrink-0`.

Fix: `class="hidden lg:block w-80 shrink-0"` → `class="hidden lg:block w-80 lg:w-96 shrink-0"` on `feedback-inline-desktop.html:304`.

(The `review-ui-mockup.html:235` `<aside class="… w-72 …">` is a left nav/stage-list sidebar, not the feedback sidebar, so it falls outside FB-23 scope — no action required there.)

### 3. DESIGN-TOKENS §8.2 prose contradicts reality (not gate-failing, cleanup)

DESIGN-TOKENS §8.2 line 595 asserts: *"Every artifact that previously hardcoded `max-w-[1400px]` now sets `style="max-width: var(--layout-max-width);"` on the outer container."*

Reality:

- `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` → 22 matches (literal still in place across 7 files).
- `grep -rn 'layout-max-width' stages/design/artifacts/` → 0 matches.

This is not a unit-10 quality-gate failure (the gate's `or` branch accepts "literal removed OR named token documented" and the token IS documented). It IS a truthfulness defect in DESIGN-TOKENS §8.2 that will confuse development. The prose should either (a) be softened to describe `--layout-max-width` as the canonical reference that dev may adopt, or (b) the artifacts should actually be swept to use the inline style.

Suggestion: lightest touch is to rewrite §8.2 to say "Artifacts currently keep the literal `max-w-[1400px]` arbitrary-value class; dev adopts `--layout-max-width` uniformly in production code."

## Verdict

Two gate-failing drifts — both one-line fixes. Reject and re-run designer hat with the specific line numbers above. DESIGN-TOKENS §8.2 prose is advisory cleanup, not blocking.
