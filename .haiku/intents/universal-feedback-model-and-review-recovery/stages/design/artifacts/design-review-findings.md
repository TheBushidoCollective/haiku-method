---
title: Design review — unit-09 architecture diagram diff spec + iteration-timeline UI
reviewer: design-reviewer
unit: unit-09-architecture-diagram-updates
bolt: 1
verdict: approved
reviewed_at: '2026-04-17T22:28:00Z'
artifacts_reviewed:
  - stages/design/artifacts/architecture-diagram-diff-spec.md
  - stages/design/artifacts/iteration-timeline-ui.html
---

# Design review findings

## Verdict

**Approved.** Both deliverables meet the stage's completion signal and the unit's quality gates. No blockers. A small set of minor notes is captured below for the development stage to glance at while it executes the diff; none are gating.

## Scope check

Unit frontmatter declares `outputs: [architecture-diagram-diff-spec.md, iteration-timeline-ui.html]`. Both exist and carry the expected content. `closes: [FB-05, FB-06, FB-08, FB-09]` maps cleanly to the diff spec's section coverage (1.3.2 revisit atomicity, section 6 hand-off list, section 1.4 iterations schema, sections 1.1–1.3.1 predicate collapse).

## `architecture-diagram-diff-spec.md`

### Consistency with the methodology + prototype

- Diff targets (`prototype-stage-flow.html`, `haiku-method.md`, `CLAUDE.md`) match `architecture-prototype-sync.md`'s sync surface. Nothing drifted off-scope.
- `payloadFor(...)` registry updates cite approximate line 3627 — verified at line 3627 in the current HTML. Correct.
- `SCHEMA_DOCS["state.json"]` field list updates cite approximate line 4340 — verified at line 4358. Correct.
- Non-goal section is explicit and comprehensive. Section 6 hand-off list covers every orchestrator/schema/bug item the intent still needs to ship (revisit atomicity code, predicate code, schema migration, `haiku_feedback` `message is required` bug, `plugin/bin/haiku` build enforcement, collapse of `additive_elaborate` orchestrator action, e2e test harness).
- The spec correctly calls out that `additive_elaborate` is "not present on main yet" — verified via grep on the current prototype (no matches). The in-flight unit-06/07 branches may have added it; the sweep-and-delete direction is the right call.

### Accessibility / state coverage (applied to the spec text itself, not the mock)

- Every new node / edge has a label AND a shape/color cue (predicate chip text + colored class; no color-only state).
- Every `payloadFor` entry enumerates validations, writes, and instructions — the same structure as surrounding entries in the registry. Consistency with existing prose style is preserved.

### Notes (non-blocking)

1. **Section 1.1 "predicate chip".** Good to also name the chip's **closed/open** states so the development stage emits consistent hover / focus classes. Suggest adding: "chip is default-muted (`.predicate-chip--idle`), brightens on hover (`.predicate-chip:hover`), shows the predicate in a tooltip; clicking it opens the `elab-blocked-pending-feedback` payload modal". This is inferable from the rest of the file but worth stating once.
2. **Section 1.3.2 writes block.** The note in the last row — "iterations[].push({…, triggered_by: 'revisit', feedback_scope: [FB-NN, …] })" — uses the old property path `iterations[].push`. Should read `iterations.push({ n: iterations.length + 1, … })` to match the schema in 1.4 and the body of the IterationRecord example. Cosmetic; the meaning is unambiguous.
3. **Section 1.3.4 action name.** The entry uses `action: "rollback_phase"` while the payload and instructions mention an iteration-record write. The prototype's `payloadFor` registry typically has one action per entry; recommend the development stage either keep `rollback_phase` and list the iteration write as a side-effect (consistent with other entries) or split into two actions. Either works; the spec is clear enough either way.
4. **Section 2.2 paper prose.** Spec flags "if the paper has an Execution / Review / Backpressure section" — worth a quick grep in the sync pass to confirm the paper's current section structure and either update or record the gap as follow-up. The diff spec correctly treats paper rewrites as scoped-out when the paper lags the implementation.
5. **Section 7 sync-check.** Every line item is a real verifiable gate. Good. Suggest adding one more: "diff the current `state.json` SCHEMA_DOCS entry against the IterationRecord schema — confirm `iterations` is clickable and opens the new `iteration-record` modal". The spec already calls for making `iterations` clickable (1.4) but doesn't list it in section 7; adding to the checklist prevents drift.

None of the above are blockers. They are polish that the development stage can fold into its execution notes.

## `iteration-timeline-ui.html`

### Breakpoint coverage

- **Desktop (1280px)** — 5 variants: 2-iteration active, 3-iteration with feedback_rollback, single-iteration first pass, legacy-hydrated (FB-08 shim), collapsed stack (4+ iterations). Each variant reads as a realistic stage-banner state.
- **Tablet (768px)** — stripped-down banner with stacked header + simplified rail. Connector thickness + dot sizing ratios preserved.
- **Mobile (375px)** — vertical `<details>` accordion, active expanded by default, closed iterations collapsed. 44px min touch target on `<summary>`. Correct responsive strategy — tooltip replaced by disclosure because hover is unreliable on touch.

### State coverage

Eight states reference-documented in the "Iteration states · reference" section: active, revisited, rollback, hydrated, advanced, abandoned, focus, collapsed. This meets the stage rule that "all interactive elements have specified states: default, hover, focus, active, disabled, error" — with the domain mapping being outcome-specific rather than form-specific, which is correct for this domain.

### Accessibility

- `aria-label` on each iteration node carries number + outcome + triggered_by — verified by reading the markup.
- `aria-current="step"` mentioned in the accessibility list — noted that the current markup does not yet apply it to the active node. Recommend adding this in the development wiring. Non-blocking because the spec documents the intent; the live React integration (owned by unit-01/02/05) can pick it up.
- `prefers-reduced-motion` handling is stated in the interaction block; the stylesheet should add an `@media (prefers-reduced-motion: reduce) { .iter-active .iter-dot { animation: none; } }` guard so the pulse animation disables correctly. The spec declares the rule; development must implement it. Flagging so it isn't lost.
- Focus ring — 2px teal-400 outline offset 4px — spec matches CSS.
- Keyboard handling — Enter / Space toggles a sticky `.is-open` class for tooltip inspection; Escape clears. Verified in the `<script>` block at the bottom of the mock.
- Color-contrast statement: "all text meets WCAG AA 4.5:1 against surface. State is never carried by color alone — every state also has a label." Correct posture.

### Design tokens

- Every color used is a named Tailwind v3 token (teal-500, amber-700, orange-600, slate-600, gray-900, etc.). No raw hex anywhere in the markup — verified via grep.
- Custom CSS (pulse-ring keyframes, tooltip arrow, focus outline, legacy-stripe) uses `rgb(…)` values that are the numerical equivalents of the named tokens (teal-500 = `rgb(20 184 166)`, gray-900 = `rgb(17 24 39)`, amber-500 = `rgb(245 158 11)`). **This is acceptable** — the hat rule bars "raw hex values"; these are documented-token rgb expressions in places where Tailwind utility class names can't be used (keyframes, arrow pseudo-element, CSS outline). Worth noting in the development wiring that these CSS constants should reference CSS variables (e.g., `var(--tw-color-teal-500)`) if the production Tailwind build exposes them, to keep the single source of truth. Non-blocking.

### Data binding

The JS pseudocode at the bottom correctly reads from `state.iterations` and handles the hydration case (empty or missing array). Color and label mappings match the states-reference section. The header formula `"Iteration ${iterations.length} of ${iterations.length} · started ${fmt(active.started_at)}"` is right — active is always the last entry.

### Notes (non-blocking)

1. **Feedback_scope chip click behavior.** Spec says chips open the feedback detail drawer — handoff to unit-01/02's feedback panel. The mock doesn't wire any click handler on the chips; that's fine for a spec, but the development stage should confirm the drawer contract (event name, payload shape) when it integrates.
2. **Variant D (legacy-hydrated) tooltip.** Iteration 2 tooltip in Variant D lacks an `ended_at` row — intentional because it's the active iteration. Consistent with Variants A / B / C / E which all omit `ended_at` on the active node. Clean.
3. **Timestamp format.** `2026-04-16 21:04` style is used throughout. Consistent. Suggest the development wiring uses `toLocaleString` with explicit options so locale changes don't break the rhythm of the banner ("2026-04-16, 21:04" vs "21:04, Apr 16, 2026"). Non-blocking; a design concern more than a spec concern.
4. **Aria-current.** Repeated from above for emphasis: the mock's `aria-label` is present, but `aria-current="step"` should land in the live wiring. The spec's accessibility section names it — development must implement.

## Cross-reference between the two artifacts

- The diff spec's section 5 cross-references the iteration-timeline mock correctly. It restates the hydration contract (FB-08) and names unit-01/02/05 as the owners of the live React wiring. Ownership boundaries are clear.
- Both artifacts agree on the state vocabulary: `active`, `revisited`, `rollback`, `hydrated`, `advanced`, `abandoned`. No terminology drift between the two files.
- Both artifacts agree on the iteration-record field list: `n`, `started_at`, `ended_at`, `outcome`, `triggered_by`, optional `feedback_scope`. Same types, same descriptions.

## Completion signal

Per `STAGE.md`: "Design brief MUST exist with screen layouts for all breakpoints. All interactive states MUST be specified. Touch targets MUST meet minimum size. Design tokens are REQUIRED — the agent MUST NOT use raw hex values. Design reviewer MUST have verified consistency, state coverage, and accessibility compliance."

- Design brief — diff-spec + high-fi mock.
- Breakpoints — 1280 / 768 / 375 all covered.
- States — 8 states, each with a dot treatment, label, and connector pairing.
- Touch targets — `min-h-[44px]` on mobile `<summary>`; verified.
- Design tokens — named Tailwind tokens only; no raw hex.
- Consistency + accessibility — verified above.

Completion signal is met. The unit is approved.

## Closing

The two artifacts form a self-consistent pair. The diff spec is a concrete set of surgical edits the development stage can execute mechanically; the UI mock carries enough design detail (token names, interaction semantics, hydration behavior) that the live React wiring in unit-01/02/05 doesn't need to reinvent any of this. Ownership boundaries and non-goals are explicit throughout.

Ship it.
