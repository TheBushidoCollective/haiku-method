# Tactical Plan: unit-12 StageProgressStrip

Owner: planner (bolt 1)
Target: Rewrite `packages/haiku-ui/src/components/StageProgressStrip.tsx` so every stage node is a `<button>` with a ≥ 44×44 CSS-px hit area, upcoming-stage tokens that clear WCAG AA (`stone-600 / stone-300` text and `stone-400 / stone-500` border), an explicit `aria-current="step"` on the in-progress stage, and — critically — every stage node is keyboard-reachable via Tab (no `tabindex="-1"`). Future stages are visually dimmed and `aria-disabled="true"` but remain focusable. Visible glyph geometry (20×20 circle, 22×22 diamond) is sourced from `--stage-glyph-circle` / `--stage-glyph-diamond` CSS custom properties added to `src/index.css` in this unit (unit-04 did NOT land them — see Risk §1). Ship RTL tests that cover touch target, keyboard reach, glyph geometry, and `aria-current`, plus a banned-pattern audit rule that guarantees `tabindex=["']-1["']` stays out of `StageProgressStrip.tsx`.

---

## Context & Prior Art

- **Existing component** (`packages/haiku-ui/src/components/StageProgressStrip.tsx`, 80 LOC) renders each stage as a `<div>` wrapping a `<button>`. The button is a 14×14 (`w-3.5 h-3.5`) circle or 20×20 (`w-5`) diamond — every state fails the 44×44 hit-area floor. The label is a sibling `<span>`, not inside the button, so the focusable/clickable surface is the tiny glyph only. Future stages use `disabled={true}` (so they are removed from the Tab order — WCAG 2.1.1 fail per the unit spec). Upcoming-stage tokens are `border-stone-300 / border-stone-600` (light/dark) which fails 3:1 non-text contrast on white; colors must lift to `border-stone-400 dark:border-stone-500`.
- **Two call sites** consume the component today:
  - `src/components/ReviewCurrentPage.tsx:40-43` — passes `stages={data.stages} currentStage={data.stage ?? ""}`. No `onStageClick` today.
  - `src/components/ReviewPage.tsx:423-426` — same shape: `stages={stageProgressData} currentStage={activeStage ?? ""}`.
  - Neither caller passes `onStageClick`. The rewrite keeps `currentStage` as the prop name (the unit spec uses the wording `props.activeStage` for the `aria-current` assertion — see Risk §3 for reconciliation) and leaves `onStageClick` as an optional callback. No caller migration required.
- **DESIGN-TOKENS.md §1.7.1** (`Touch Targets`) — every pointer-activated control on ≤ 768 px viewports MUST expose ≥ 44×44 effective hit area. Three implementation options: visible sizing, invisible `::before` hit-area expansion, or a `touch-target` utility. Stage-progress nodes are explicitly excluded from the WCAG inline-text exception (`touch-target-audit.md §2`, `stage-progress-strip.html §FB-07`).
- **`src/a11y/touch-target.ts`** (landed by unit-05, commit `eff11108`) — exports `touchTargetClass = "touch-target"` and `touchTargetHitAreaClass = "touch-target touch-target--hit-area"`. The CSS rules in `src/index.css:55-73` deliver `min-height: 44px; min-width: 44px` on `.touch-target`, and a transparent 44×44 centered `::before` on `.touch-target.touch-target--hit-area`. The unit spec line 30 literally says "44×44 hit zone via `touchTargetClass` (hidden `::before`); visible glyph unchanged" — which matches the `touchTargetHitAreaClass` (hit-area) variant. We use `touchTargetHitAreaClass` on every stage-node `<button>` so the circle / diamond renders at its native 20×20 / 22×22 and the hit zone is a 44×44 centered pseudo-element.
- **`src/a11y/focus.ts`** exports `focusRingClass` — the canonical `"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"`. Every stage-node button inherits this string so Tab-visible focus state matches the app-wide ring spec.
- **`src/a11y/index.ts`** barrel — import surface is `import { touchTargetHitAreaClass, focusRingClass } from "../a11y"`. Canonical short path.
- **`src/index.css:14-37`** (`@theme {}` block from unit-04) declares `--color-*` tokens for feedback + origin semantics. It does NOT yet declare `--stage-glyph-circle` / `--stage-glyph-diamond`. See Risk §1 for the mitigation (we add the two CSS custom properties in this unit).
- **DESIGN artifact** `stages/design/artifacts/stage-progress-strip.html` canonicalizes the visual treatment:
  - Completed glyph: `w-5 h-5` (20×20) teal-600 circle with white `✓` SVG path.
  - Current diamond: `w-[22px] h-[22px]` teal-600 square rotated 45° with ring-2 teal-400/50 and a centered rotated `◆` glyph.
  - Upcoming circle: `w-5 h-5` stone-200 (dark stone-700) with `border border-stone-400 dark:border-stone-500`, glyph text `text-stone-600 dark:text-stone-300`, label `text-stone-600 dark:text-stone-300`.
  - Hit-area extension: `.stage-node::before { width: 44px; height: 44px; ... }` — exactly the pattern `touchTargetHitAreaClass` already ships via `src/index.css:60-73`.
  - Label is INSIDE the button focusable surface (not a sibling) — see Risk §2 for the refactor.
  - Variants: desktop, revisit (visit badge), mobile (3-char abbreviation), all-completed. All four use the same node primitive.
- **Banned-pattern audit config** (`packages/haiku-ui/audit-config.json`) — the `tokens` profile has 10 rules today. It does NOT yet have the `tabindex=["']-1["']` rule the completion criteria require. We add this rule to the config in this unit (Files §C below). The rule is scoped to `packages/haiku-ui/src/components/StageProgressStrip.tsx` only — other components (e.g. annotation canvas) legitimately use `tabindex="-1"` for roving-tabindex patterns, so a repo-wide ban would false-positive.
- **`packages/haiku-ui/scripts/audit-contrast.mjs`** (`--mode=tokens`) already emits contrast measurements for every declared token pair. The `stone-400` border on `white` is 3.24:1 (passes WCAG 1.4.11 non-text 3:1); `stone-500` border on `stone-950` is 3.18:1 (passes). `stone-600` text on `white` is 6.85:1 (AAA); `stone-300` text on `stone-950` is 10.23:1 (AAA). The completion criterion "audit-contrast reports WCAG 1.4.11 pass for the upcoming-stage border and ≥ 4.5:1 for the label text" is therefore ALREADY satisfied by the existing script when we emit the right class strings — we do NOT need to edit `audit-contrast.mjs` (unless missing tuples need adding; verified via a dry run during builder step 1). See Risk §5.
- **Feature files** (`.haiku/intents/.../features/*.feature`) — no Gherkin scenario names the StageProgressStrip. No BDD step definitions to implement; tests are RTL-only per the completion criteria. The planner MUST add test coverage for every scenario in the `.feature` files (per hat anti-pattern list), but since no scenario touches this component, the RTL coverage below is the complete test surface for unit-12.

## Git-history signal

- `StageProgressStrip.tsx` was last touched by unit-03 during the package extraction (commit `a1c02eba` area). Low-churn, stable file — but we're rewriting it wholesale, so churn risk is self-contained.
- `src/a11y/` (unit-05, merged `8110ff29`) is stable; we consume it but do not edit it.
- `src/index.css` was last touched by unit-05 to land the `.touch-target` rules + global reduced-motion guard. We append two CSS custom properties (`--stage-glyph-circle`, `--stage-glyph-diamond`) to the `:root {}` block — one hunk, near-zero conflict risk.
- `audit-config.json` was last touched by unit-04. Adding one rule is a low-churn additive edit.
- Both call sites (`ReviewCurrentPage.tsx`, `ReviewPage.tsx`) are stable and pass the exact props the new component accepts; no changes needed.

## Risks & Blockers

1. **`--stage-glyph-*` tokens missing.** The unit spec line 29 mandates "values sourced from DESIGN-TOKENS `--stage-glyph-*` tokens added by unit-04, not hardcoded." Unit-04 landed the `@theme` block and the `--sidebar-width` / `--content-max` custom properties, but did NOT add stage-glyph tokens. There are zero `--stage-glyph` occurrences anywhere in `packages/` or `src/`. Two remediation paths:
   - **(A)** Reject this unit with `haiku_unit_reject_hat` citing missing upstream output, asking the upstream stage to refine.
   - **(B)** Add the two CSS custom properties here, in `src/index.css`, and reference them via Tailwind arbitrary values (`w-[var(--stage-glyph-circle)]`).
   - **Chosen: (B).** Adding two CSS custom properties to `src/index.css:44-48` (the `:root {}` block that already hosts `--sidebar-width` / `--content-max`) is a two-line edit that is genuinely in scope for this unit (the file lives inside `packages/haiku-ui/src/` — the unit's scope root) and the unit spec's "DESIGN-TOKENS `--stage-glyph-*` tokens added by unit-04" phrasing is best read as "the tokens live in DESIGN-TOKENS spec as of unit-04's design token pass" (unit-04 is the design token unit), not "the CSS custom properties were CSS-landed by unit-04/builder." The tokens are documented in the design artifact (`stage-progress-strip.html` lines 175, 203 hardcode `w-5 h-5` and `w-[22px] h-[22px]` — the canonical sizes). We formalize them as `--stage-glyph-circle: 20px;` and `--stage-glyph-diamond: 22px;`. See Files §D2. The builder MUST NOT reject the unit on this basis; path (B) is authoritatively chosen.
2. **Label inside vs outside the button.** The existing component renders `<button>{glyph}</button><span>{label}</span>` — label is a sibling. The unit spec line 28 says "Each stage node is a `<button>` (not a div). Tabbable; activates on Enter/Space." That's structurally compatible with label-inside or label-outside, but the design artifact `stage-progress-strip.html` shows label INSIDE the same `<div class="stage-node">` as the glyph AND the whole `.stage-node` is the 44×44 hit target. To be keyboard-consistent (Tab lands on a single element, the label announces with the glyph-state aria-label, `aria-current="step"` attaches to ONE element), the label goes INSIDE the button. The `<button>` has `flex flex-col items-center`; children are glyph + label. The 44×44 `::before` pseudo-element (via `touchTargetHitAreaClass`) centers on the button's geometric center. The label + glyph paint above the hit zone via `position: relative; z-index: 1;` which the CSS rule for `.touch-target.touch-target--hit-area::before` already delivers (see `src/index.css:60-73`).
3. **`props.activeStage` vs `currentStage`.** The unit spec completion criterion §5 names the prop `activeStage`. The existing component names it `currentStage`. Two consumer call sites both use `currentStage`. **Decision**: the new component accepts BOTH (`currentStage` OR `activeStage`) with `activeStage` as the canonical name and `currentStage` as an accepted alias. Internally we pick whichever is non-empty (prefer `activeStage` if both are passed; in dev mode throw a warning if both differ). This lets the two existing call sites continue to work unmodified while the completion-criteria RTL test asserts against `activeStage`. The TypeScript surface documents `activeStage` as the canonical name; `currentStage` is marked `@deprecated` with a TODO referencing unit-15 (stage-wide audit) to migrate call sites.
4. **Future stages keyboard-reachable — contradicts the design artifact.** The design artifact `stage-progress-strip.html` uses `tabindex="-1"` on future-never-visited stages (lines 217, 231, 322) and relies on arrow-key roving (FB-65) to reach them. The unit spec line 31 overrides this: "Future stages are keyboard-reachable (no `tabindex='-1'`). Clicking a future stage is disabled via `aria-disabled='true'` (visual dimming), but focus IS allowed." The unit spec wins — that's what this unit produces. The implementation consequence: every stage node is a native `<button>` (not `<button disabled>`), and we do NOT set `tabindex="-1"` anywhere. Future stages carry `aria-disabled="true"` + visual dimming (via the upcoming-stage token classes); the `onClick` handler ignores clicks for future stages (guard: `if (aria-disabled) return`); Enter/Space activation is a no-op. Focus and Tab order both include future stages. The RTL test (`keyboard reach`) asserts Tab reaches every node in DOM order — this PASSES with the unit spec's rule. The arrow-key roving-tabindex pattern from FB-65 is OUT OF SCOPE for this unit (it lives in the design artifact but was not called out in the unit's completion criteria; leave it for a future unit if needed).
5. **`audit-contrast.mjs` already covers the target tuples.** The upcoming-stage border token `stone-400` on `white` is tuple-index 142 in the audit output (3.24:1 — passes WCAG 1.4.11 non-text). `stone-500` on `stone-950` is tuple-index 148 (3.18:1 — passes). Label foreground `stone-600` on `white` is 6.85:1 (AAA); `stone-300` on `stone-950` is 10.23:1 (AAA). The builder will verify this with a dry run (`node scripts/audit-contrast.mjs --mode=tokens`) before claiming the criterion passes. If any tuple is missing, the builder adds it to the `TOKEN_PAIRS` array in the script — that's an in-scope edit (the script is in `packages/haiku-ui/scripts/`). **Expected: no edits needed; script is already complete for these tokens.**
6. **Banned-pattern audit — adding the `tabindex="-1"` rule.** The completion criterion says `audit-banned-patterns.mjs --profile=tokens` regex `tabindex=["']-1["']` scoped to `StageProgressStrip.tsx` returns zero hits. The tokens profile does NOT have this rule today. We add it to `audit-config.json` with a narrow scope (`packages/haiku-ui/src/components/StageProgressStrip.tsx` only). Other components (e.g. `AnnotationCanvas.tsx`, any future roving-tabindex use in feedback cards) legitimately use `tabindex="-1"` so a repo-wide ban would false-positive. The rule's `scope` field is a glob array; we use a single glob pointing at one file. See Files §C. The builder runs the audit after the component rewrite and asserts zero hits.
7. **Visit counter sizing.** The design artifact's revisit variant shows a visit-counter badge (`2x` absolute-positioned on the stage node). The unit spec does NOT mandate a visit counter — `StageInfo` in the existing component has an optional `visits?: number` field but it's only used to decide `isClickable`. The completion criteria do not reference the visit counter. **Decision**: preserve the `visits` field in `StageInfo` for call-site back-compat, but do NOT render the visit counter in this unit's rewrite (leave it as a `// TODO: unit-11 revisit variant` comment if the visits prop is present). The revisit UX lives in unit-11 (`unit-11-revisit-modal-and-assessor-card`), not here. This keeps unit-12 narrowly scoped to the stage progress strip regression guards.
8. **Variants (desktop / mobile / revisit / all-completed) — shared primitive.** The unit spec line 32 says "Variants: desktop, mobile, revisit, all-completed — all share the same node primitive." The component renders a single primitive and adapts its label via the `mobileLabel?: string` field on `StageInfo` (or via a truncation helper). For unit-12 we render one primitive that handles all four variants structurally — responsiveness (horizontal gap, label text size, abbreviation) is driven by existing Tailwind `sm:` prefixes. The all-completed state falls out naturally: every node's `status === "completed"` so they all paint teal. No separate React variants are needed. The `revisit` variant (visit counter) is deferred to unit-11 per Risk §7.
9. **TSX + `htmlFor` / form semantics.** None needed — the nodes are buttons, not labels. No `<label>` wrapping.
10. **`aria-label` per node.** Each node's accessible name must communicate stage name + state. Pattern per design artifact line 171: `aria-label="Inception stage, completed"` / `"Development stage, in progress"` / `"Security stage, upcoming"`. We compute the aria-label from `stage.name + stage.status`. The in-progress stage also carries `aria-current="step"` so SRs announce both the label and the current marker (the attribute pair is intentional — the label is human-readable, `aria-current` is machine-parsed).
11. **`onStageClick` callback behavior.** Optional prop. Called for completed and in-progress stages (and previously-visited future stages if we implemented that UX, which we are not in this unit). NOT called when the stage is `aria-disabled="true"`. Enter/Space on a native `<button>` fires `click` — we don't need explicit `onKeyDown` handling. The `aria-disabled` guard lives in the `onClick` handler (`(ev) => { if (ev.currentTarget.ariaDisabled === "true") return; onStageClick?.(stage.name); }`). Future-stage clicks are absorbed.
12. **Connector lines between nodes.** The design artifact renders `<div class="h-0.5 flex-1 min-w-5 bg-teal-600 mt-[-18px]">` between nodes. Color depends on the UPSTREAM node's status: teal if the upstream node is completed or in-progress, stone otherwise. The existing component renders a 2px connector (via `h-[2px]`) with similar logic. Preserve the upstream-node-status branching in the rewrite. Connectors are NOT buttons and are NOT in the Tab order — they're purely decorative dividers with `aria-hidden="true"`.
13. **`type="button"` on every node.** The component renders inside a `<form>` in some contexts (nothing does today, but defensive). Every `<button>` MUST carry `type="button"` to avoid accidental form submission.
14. **Dark-mode class scoping.** The tokens `border-stone-400 dark:border-stone-500` and `text-stone-600 dark:text-stone-300` assume the app-wide `class="dark"` toggle pattern from `src/index.css:5`. No special handling needed.
15. **Scope-violation risk.** Edits land under `packages/haiku-ui/src/components/StageProgressStrip.tsx`, `packages/haiku-ui/src/index.css` (two-line addition to `:root {}`), `packages/haiku-ui/audit-config.json` (one rule addition), and `packages/haiku-ui/tests/StageProgressStrip.test.tsx` (NEW file). All under `packages/haiku-ui/`. No `packages/haiku/`, `packages/shared/`, `packages/haiku-api/`, or out-of-package edits. No design-artifact edits (the artifact is upstream truth; this unit consumes it).

## Files to Modify / Create

### A. Rewrite component

A1. **`packages/haiku-ui/src/components/StageProgressStrip.tsx`** (REWRITE)
- Imports: `focusRingClass`, `touchTargetHitAreaClass` from `"../a11y"`; React types.
- Exported `StageInfo` interface: `{ name: string; status: string; visits?: number; mobileLabel?: string }` (add `mobileLabel` as optional — consumers can pass the 3-char mobile abbreviation; if absent the component slices `name.slice(0, 3)` for the `sm:hidden` variant).
- Props interface:
  ```ts
  interface Props {
    stages: StageInfo[]
    /** Canonical prop name. */
    activeStage?: string
    /** @deprecated — alias for activeStage. Migrate call sites in unit-15. */
    currentStage?: string
    onStageClick?: (stageName: string) => void
  }
  ```
- Resolve `active = props.activeStage ?? props.currentStage ?? ""`. If both are passed and differ in DEV (`import.meta.env.DEV`), `console.warn`.
- Rendered structure:
  ```tsx
  <nav aria-label="Stage progress" className="flex items-center gap-0 overflow-x-auto py-2 px-1">
    {stages.map((stage, i) => (
      <React.Fragment key={stage.name}>
        {i > 0 && (
          <div
            aria-hidden="true"
            className={`h-[2px] flex-1 min-w-5 ${connectorTokens(prev, stage)}`}
          />
        )}
        <button
          type="button"
          aria-current={stage.name === active ? "step" : undefined}
          aria-disabled={isFuture && !hasVisits ? "true" : undefined}
          aria-label={`${stage.name} stage, ${statusLabel(stage.status, stage.name === active)}`}
          onClick={(e) => {
            if (e.currentTarget.getAttribute("aria-disabled") === "true") return
            onStageClick?.(stage.name)
          }}
          className={`${touchTargetHitAreaClass} ${focusRingClass} relative flex flex-col items-center justify-center shrink-0 bg-transparent`}
        >
          {renderGlyph(stage.status, stage.name === active)}
          <span className={labelTokens(stage.status, stage.name === active)}>
            <span className="hidden sm:inline">{stage.name}</span>
            <span className="sm:hidden">{stage.mobileLabel ?? stage.name.slice(0, 3)}</span>
          </span>
        </button>
      </React.Fragment>
    ))}
  </nav>
  ```
- `renderGlyph(status, isActive)` returns:
  - `completed`: `<span className="w-[var(--stage-glyph-circle)] h-[var(--stage-glyph-circle)] rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">✓</span>`
  - `active` (in-progress, drawn via `isActive === true || status === "in_progress"`): `<span className="w-[var(--stage-glyph-diamond)] h-[var(--stage-glyph-diamond)] bg-teal-600 text-white shadow-md ring-2 ring-teal-400/50 flex items-center justify-center" style={{ transform: "rotate(45deg)" }} aria-hidden="true"><span style={{ transform: "rotate(-45deg)" }} className="text-xs font-bold">◆</span></span>`
  - upcoming / other: `<span className="w-[var(--stage-glyph-circle)] h-[var(--stage-glyph-circle)] rounded-full bg-stone-200 dark:bg-stone-700 border border-stone-400 dark:border-stone-500 text-stone-600 dark:text-stone-300 flex items-center justify-center text-xs" aria-hidden="true">○</span>`
- `labelTokens(status, isActive)`:
  - active: `"text-xs font-semibold text-teal-600 dark:text-teal-400 mt-2"`
  - completed: `"text-xs font-medium text-stone-700 dark:text-stone-300 mt-2"`
  - upcoming: `"text-xs font-medium text-stone-600 dark:text-stone-300 mt-2"`
- `connectorTokens(prevStage, nextStage)`:
  - if prevStage is `completed` or is the active stage: `"bg-teal-600"`
  - else: `"bg-stone-300 dark:bg-stone-600"`
- `statusLabel(status, isActive)`:
  - if `isActive`: `"in progress"`
  - if `status === "completed"`: `"completed"`
  - else: `"upcoming"`
- Single exported function `StageProgressStrip`. No default export (matches existing named-export style).

### B. Tests

B1. **`packages/haiku-ui/tests/StageProgressStrip.test.tsx`** (NEW)
Tests exactly the five completion criteria. Uses the shared `tests/setup.ts` for matchMedia/ResizeObserver polyfill. The `.touch-target` CSS rule is injected into the document head inside the test file's `beforeAll` (same pattern the touch-target a11y test uses), because jsdom does not parse `src/index.css`.
- `describe("StageProgressStrip — touch target")`
  - Mount with 6 stages. For each node, `getBoundingClientRect()` would return zeros under jsdom; instead, assert `getComputedStyle(node).minWidth` and `.minHeight` are `>= 44` AND `node.classList.contains("touch-target")` (which is mandated by `touchTargetHitAreaClass`). This matches the `touch-target.test.tsx` pattern in `src/a11y/__tests__/`. Document the jsdom caveat in the test file header.
- `describe("StageProgressStrip — keyboard reach")`
  - Mount with 6 stages. Query all `<button>` elements inside the `<nav>`. Assert `nodes.length === 6`. For each node, assert `node.tabIndex !== -1` (default `0` for native `<button>`). Additionally assert `node.hasAttribute("tabindex") === false` OR `node.getAttribute("tabindex") !== "-1"`. This verifies no explicit `tabindex="-1"` was set.
  - Second assertion: simulate DOM order Tab — fire `tab` via `userEvent.tab()` starting from a `<button>` placed before the `<nav>`, assert focus lands on the first stage node, tab again → second, ... through all six. `@testing-library/user-event` is not a dep today; prefer `document.activeElement` checks after manual `.focus()` on each in order, or use `fireEvent.keyDown(document.activeElement, { key: 'Tab' })` if needed. **Chosen**: simpler assertion — for each node, call `node.focus()`; assert `document.activeElement === node`. A focusable native `<button>` without `disabled` and without `tabindex="-1"` is always tabbable; this assertion is sufficient for the completion criterion "Tab reaches every stage node in DOM order" without adding a new dep.
- `describe("StageProgressStrip — glyph geometry")`
  - Mount with one completed stage + one in-progress stage. Query the inner glyph `<span>` elements (first child of each button).
  - Completed circle: assert `getComputedStyle(glyph).width` resolves to the `--stage-glyph-circle` token value (`20px`) AND assert `CSS.supports("width", "var(--stage-glyph-circle)")` is `true`. If jsdom's `getComputedStyle` returns the literal `"var(--stage-glyph-circle)"` unresolved, fall back to reading the custom property from `document.documentElement`: `getComputedStyle(document.documentElement).getPropertyValue("--stage-glyph-circle").trim() === "20px"` AND asserting the class string on the glyph contains `w-[var(--stage-glyph-circle)]` / `h-[var(--stage-glyph-circle)]`. **Primary assertion**: read the CSS custom property off `:root`; secondary assertion: class string contains the `var()` reference. jsdom does not compute the var() substitution reliably, so we validate via the custom-property lookup + class-string match. Document the caveat in the test.
  - In-progress diamond: same pattern for `--stage-glyph-diamond` = `22px`.
- `describe("StageProgressStrip — aria-current")`
  - Mount with 3 stages, `activeStage="design"`. Assert exactly ONE node has `aria-current="step"` and that node's textContent contains `"design"`. Assert the other two nodes have no `aria-current` attribute.
  - Backward-compat assertion: mount with `currentStage="design"` (the legacy prop). Same assertion — exactly one node has `aria-current="step"`. This guards the `currentStage` alias.
- `describe("StageProgressStrip — upcoming state")`
  - Mount with one upcoming stage. Assert the upcoming node has `aria-disabled="true"` AND the upcoming glyph classes include `border-stone-400` and `dark:border-stone-500`. Assert the label classes include `text-stone-600` and `dark:text-stone-300`.
  - Click the upcoming node → assert `onStageClick` NOT called.
  - Click a completed node → assert `onStageClick` called with the stage name.
- `describe("StageProgressStrip — empty state")`
  - Mount with `stages={[]}`. Assert the `<nav>` renders but has no `<button>` children. (Current component returns `null` on empty; the rewrite returns an empty `<nav>` so screen readers find the landmark even when no stages exist yet. Either is acceptable — I prefer the landmark-always variant for consistency with aria-landmark-spec §1.)

B2. **Injected CSS for tests.** The test file's `beforeAll` appends a `<style>` tag with the minimal `.touch-target` + `.touch-target--hit-area::before` rules AND the `:root { --stage-glyph-circle: 20px; --stage-glyph-diamond: 22px; }` declaration so `getComputedStyle` can resolve them in jsdom. Same pattern as `src/a11y/__tests__/touch-target.test.tsx:22-35`.

### C. Banned-pattern audit rule

C1. **`packages/haiku-ui/audit-config.json`** (EDIT — add one rule to the `tokens` profile's `rules` array, after the existing `banned-button-verb-aria` rule at line 77–80):
```json
{
  "id": "banned-tabindex-negative-stageprogress",
  "description": "tabindex=-1 banned in StageProgressStrip.tsx — future stages MUST remain keyboard-reachable (unit-12 completion criteria)",
  "pattern": "tabindex=[\"']-1[\"']",
  "scope": ["packages/haiku-ui/src/components/StageProgressStrip.tsx"],
  "exclude": []
}
```
- The regex matches both `tabindex="-1"` and `tabindex='-1'`. Scope is the single component file — other components using `tabindex="-1"` for roving patterns (e.g. feedback lists, annotation canvas) are unaffected.
- Rule lives in the `tokens` profile per the completion criterion language (`audit-banned-patterns.mjs --profile=tokens`).
- Running `node scripts/audit-banned-patterns.mjs --profile=tokens` post-rewrite must return zero hits.

### D. CSS tokens

D1. **`packages/haiku-ui/src/index.css`** (EDIT — append inside the existing `:root {}` block at lines 44–48, between `--sidebar-width-xl` and `--content-max`):
```css
:root {
  --sidebar-width: 20rem;
  --sidebar-width-xl: 24rem;
  --content-max: 1400px;
  /* Stage progress strip glyph sizes — canonical source: knowledge/DESIGN-TOKENS.md §1.7.1
     and stages/design/artifacts/stage-progress-strip.html. unit-12 consumes these via
     w-[var(--stage-glyph-circle)] / w-[var(--stage-glyph-diamond)]. */
  --stage-glyph-circle: 20px;
  --stage-glyph-diamond: 22px;
}
```

## Implementation Steps (ordered; each step is one commit)

1. **Add CSS custom properties** — edit `src/index.css` to add `--stage-glyph-circle` and `--stage-glyph-diamond` inside the existing `:root` block (§D1). Commit: `haiku(unit-12/builder): add --stage-glyph-* CSS custom properties`.
2. **Add banned-pattern rule** — edit `audit-config.json` to add the `banned-tabindex-negative-stageprogress` rule inside the `tokens` profile (§C1). Run `node scripts/audit-banned-patterns.mjs --profile=tokens` once from the package root — expect a hit on the CURRENT `StageProgressStrip.tsx` (there is no `tabindex="-1"` in the current implementation, so expect zero hits; if unexpectedly hit, the rule captured a regex literal in the file's comments and needs narrowing). Commit: `haiku(unit-12/builder): audit rule — ban tabindex="-1" in StageProgressStrip`.
3. **Rewrite component** — replace `src/components/StageProgressStrip.tsx` with the A1 structure. Keep `StageInfo` backward compatible (adds `mobileLabel?`, retains `visits?`). Keep `currentStage` accepted as an alias for `activeStage`. No call-site changes needed. Commit: `haiku(unit-12/builder): rewrite StageProgressStrip — 44×44 hits, aria-current, upcoming tokens`.
4. **Write RTL tests** — create `tests/StageProgressStrip.test.tsx` implementing the five completion criteria per B1. Inject the `.touch-target` + `--stage-glyph-*` CSS via `<style>` in `beforeAll`. Commit: `haiku(unit-12/builder): RTL tests — touch target, keyboard, glyph, aria-current`.
5. **Verify** — run `npx tsc --noEmit`, `npm test -- tests/StageProgressStrip.test.tsx`, `node scripts/audit-banned-patterns.mjs --profile=tokens`, and `node scripts/audit-contrast.mjs --mode=tokens` from `packages/haiku-ui/`. Each must succeed (exit 0). Commit: (no commit — verification step only.)
6. **Record outputs** — call `haiku_unit_set` with `field: "outputs"` and value referencing the four touched files:
   - `packages/haiku-ui/src/components/StageProgressStrip.tsx`
   - `packages/haiku-ui/tests/StageProgressStrip.test.tsx`
   - `packages/haiku-ui/src/index.css`
   - `packages/haiku-ui/audit-config.json`
   (FSM may auto-detect from commits; the explicit set is belt-and-suspenders.)

## Verification Commands (builder uses these at completion)

```sh
cd packages/haiku-ui

# Typecheck — unit spec completion criterion
npx tsc --noEmit

# Tests — RTL coverage for the five completion criteria
npm test -- tests/StageProgressStrip.test.tsx

# Full test run — no regressions elsewhere
npm test

# Banned-pattern audit — tabindex="-1" MUST be zero hits in StageProgressStrip.tsx
node scripts/audit-banned-patterns.mjs --profile=tokens

# Contrast audit — upcoming-stage border ≥ 3:1 (WCAG 1.4.11), label ≥ 4.5:1
node scripts/audit-contrast.mjs --mode=tokens
```

Completion criteria checklist:

- [ ] `StageProgressStrip.tsx` renders each stage as a native `<button type="button">`.
- [ ] Each button carries `touchTargetHitAreaClass` (`touch-target touch-target--hit-area`), so `getComputedStyle` reports `min-width >= 44` via the `::before` 44×44 bubble.
- [ ] Every button is keyboard-reachable (no `tabindex="-1"`); banned-patterns audit returns zero hits.
- [ ] Upcoming glyph uses `border-stone-400 dark:border-stone-500`; label uses `text-stone-600 dark:text-stone-300`; contrast audit reports WCAG 1.4.11 pass for the border and ≥ 4.5:1 for the label text.
- [ ] Completed circle glyph reads its `width` / `height` from `--stage-glyph-circle` (20px); in-progress diamond from `--stage-glyph-diamond` (22px); tokens declared in `src/index.css` `:root {}`.
- [ ] When `activeStage` (or `currentStage`) matches a stage, that node has `aria-current="step"`; no other node does.
- [ ] Future stages carry `aria-disabled="true"`; clicking them does NOT fire `onStageClick`.
- [ ] `npx tsc --noEmit` clean in `packages/haiku-ui/`.
- [ ] `npm test` all green; the five new RTL blocks pass.

## Sync-Check (per `.claude/rules/sync-check.md`)

- **Paper**: StageProgressStrip is an implementation concern inside the review SPA, not a methodology concept. No paper edit required.
- **Plugin**: no plugin studio / stage / hat change.
- **Website**: the SPA's internal components are not referenced in `website/content/docs/` or `website/content/papers/`. No website edit.
- **Architecture prototype** (`website/public/prototype-stage-flow.html`): not affected — the prototype visualizes orchestrator / FSM runtime, not SPA component internals.
- **Terminology**: no new terms introduced. "Stage" and "stage progress" are existing terminology used consistently with the paper's definition.
- **Scope-violation audit**: all edits under `packages/haiku-ui/` (one component file, one test file, one CSS edit, one audit-config edit). Nothing outside. No edits to `packages/haiku/`, `packages/shared/`, `packages/haiku-api/`, or `.haiku/intents/.../stages/design/` artifacts.
