# Unit 24 — Design Review Findings

**Reviewer:** design-reviewer hat (bolt 1)
**Unit:** unit-24-live-region-wiring-and-tablist-roving-keyboard
**Scope:** FB-83 (live-region wiring on feedback-card-states.html) + FB-84 (tablist roving-tabindex keyboard contract on inline wireframes)
**Outcome:** APPROVE — all review criteria met.

## 1. Design system consistency

- No raw hex values introduced. All additions use the canonical `sr-only` utility for the live-region nodes and the existing Tailwind token stack elsewhere.
- Live-region DOM block matches exactly the two-node pattern already shipped in `feedback-inline-desktop.html:518-519` and `feedback-inline-mobile.html:336-337` — consistency preserved.
- Comment blocks at top of `feedback-card-states.html` and above the new script correctly cross-reference `aria-landmark-spec.md §1` and `aria-live-sequencing-spec.md §3/§5`.

## 2. State coverage

- Three-phase template is fully implemented: in-flight polite → success polite OR failure assertive.
- `VERBS` map in the inline script covers all five transition keys from `aria-live-sequencing-spec.md §3` table: `close`, `verifyClose`, `reopen`, `reject`, `address`.
- Per-transition button wiring uses `data-fb-id / data-fb-verb / data-fb-from / data-fb-to`. All Dismiss, Verify & Close, and Reopen buttons in the pending/addressed/rejected/closed cards carry the attributes.
- Failure path is exercised deterministically in CI via `?force=failure` and stochastically (10%) in demo sessions — assertive region gets real coverage.

## 3. Responsive behavior

- Live regions are `sr-only` — they are invisible to all viewports and do not impact layout at any breakpoint.
- Tablist roving-tabindex script is attached in both `feedback-inline-desktop.html` and `feedback-inline-mobile.html`; the contract is identical across the two surfaces, which matches `focus-order-spec.md §1` (desktop) and `§2` (mobile).
- Mobile tablist's horizontal scroll is preserved — `.focus()` triggers native `scrollIntoView` so arrow-key users don't lose the active tab off-screen.

## 4. Accessibility (primary review focus)

Verified against `aria-landmark-spec.md §9` and `aria-live-sequencing-spec.md §7`:

| Criterion | Evidence | Result |
|---|---|---|
| Both live regions exist in the DOM | `#feedback-live-polite` role=status + `#feedback-live-assertive` role=alert | PASS |
| `aria-atomic="true"` on both | present on both | PASS |
| Separate nodes (not shared) | two distinct `<div>` elements | PASS |
| In-flight polite template: `"FB-XX {progressive} to {to}…"` | matches `aria-live-sequencing-spec.md §3` | PASS |
| Success polite template: `"FB-XX {past}."` | matches spec §3 | PASS |
| Failure assertive template: `"FB-XX {verb} failed; reverted to {from}."` | matches spec §3 | PASS |
| Empty-then-rAF re-announcement pattern | `announcePolite`/`announceAssertive` helpers use it | PASS |
| Tablist APG contract: Arrow Right/Down → next | implemented with wrap via `step(+1)` | PASS |
| Arrow Left/Up → prev (wrap) | implemented via `step(-1)` | PASS |
| Home → first enabled, End → last enabled | `firstEnabled`/`lastEnabled` with disabled skip | PASS |
| Enter / Space → activate | sets `aria-selected` + panel show/hide | PASS |
| Roving tabindex invariant | exactly one tab has `tabindex="0"` at any time | PASS |
| Disabled tabs skipped | `isEnabled()` checks `aria-disabled="true"` and `[disabled]` | PASS |
| Pointer/keyboard sync | click handler also re-homes the roving tabindex | PASS |
| `event.preventDefault()` + `stopPropagation()` only when handled | `if (handled)` guard | PASS |

## 5. Cross-reference & downstream impact

- `focus-order-spec.md §1 Notes` gains the WCAG 2.1.1 clarification — this correctly escalates the issue from "documentation-only" to "contract-required" for dev-stage components.
- `focus-order-spec.md §10` checklist gains three new bullets, each tagged `(FB-84)`, covering arrow-focus+aria-selected, Home/End, and Tab-leaves-tablist. Verification is testable.
- Dev-stage React components will need to ship the same contract — the spec now explicitly names `@reach/tabs` / Headless UI `<Tab.Group>` as acceptable libraries, which unblocks downstream implementation without forcing hand-rolled keyboard logic.

## 6. Nothing blocking

No consistency issues, no missing states, no accessibility gaps identified. Closes FB-83 and FB-84 cleanly.

**Verdict:** ADVANCE.
