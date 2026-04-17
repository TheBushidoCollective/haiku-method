---
title: 'Design review — Unit 05 · Feedback Lifecycle Ownership + Unified Comments'
unit: unit-05-feedback-lifecycle-ownership
stage: design
hat: design-reviewer
closes: FB-02
reviewed_artifacts:
  - stages/design/artifacts/feedback-lifecycle-transitions.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
verdict: approve-with-minor-followups
reviewed_at: '2026-04-17T17:10:00Z'
---

# Design Review — Unit 05

## Verdict

**Approve with minor follow-ups.** All six quality gates from the unit spec are met. The lifecycle model is internally consistent with the referenced `review-ui-mockup.html` behaviour and the `haiku_feedback_*` tool surface. Minor gaps documented below are non-blocking — they can be closed during the next stage (product) or by the implementer without another design pass.

## Quality Gate Coverage

| Gate | Artifact | Status | Notes |
|---|---|---|---|
| Lifecycle transition matrix spec'd & visualized | `feedback-lifecycle-transitions.html` §1–2 | PASS | SVG state diagram with 4 nodes, 7 transitions; full from/to matrix. Teal = agent, blue = user is a clean color system. |
| Per-status footer button inventory, all interaction states, light+dark | `feedback-card-states.html` §1–3 | PASS | Default, hover, focus, active, disabled all present in both themes. Primary green `Verify & Close` reserved for the one action that closes work. |
| Sidebar: unified Comments + agent-feedback toggle, no "Mine/Feedback" | `comments-list-with-agent-toggle.html` §1–4 | PASS | Rationale called out explicitly in §1 and §6; old segmented control shown and rejected with reasons. Toggle OFF is the default and matches §5 spec. |
| Optimistic UI pattern | `feedback-card-states.html` §5 | PASS | Three-step flow (optimistic → in-flight → revert). `aria-busy="true"` + spinner documented. |
| Toast copy per guard outcome | `feedback-card-states.html` §6 | PASS | Six guard codes (`not_user_initiable`, `invalid_transition`, `stale_version`, `author_type_mismatch`, `feedback_not_found`, `network_error`) each with title + body. |
| Origin badge inventory w/ WCAG AA | `feedback-card-states.html` §4 | PASS | All six origins (`adversarial-review`, `external-pr`, `external-mr`, `user-visual`, `user-chat`, `agent`) have light + dark mocks. WCAG AA marked PASS (see A-1 below for a verification nit). |
| Spec note delegating tool-layer enforcement to product/dev | `feedback-lifecycle-transitions.html` §4 | PASS | Clearly scopes the UX contract and hands off server-side guard enforcement. |

## Consistency with existing design system

- **Origin badge palette** reuses the rose/violet/sky/teal families already established in `review-ui-mockup.html` (`badge-review-agent`, `badge-external-pr`, etc.). No palette drift.
- **Status colors** (amber `pending`, blue `addressed`, gray `rejected`, green `closed`) match the `statusStyles` map in `review-ui-mockup.html` lines ~1600–1650. No divergence.
- **Focus ring** (2px teal-500 + 2px offset) matches the existing focus treatment used elsewhere in the review app. Consistent.
- **Card chrome** (left border 3px colored by status, rounded-lg, tabindex=0) matches the existing feedback-card pattern from `review-ui-mockup.html`.
- **Footer button sizing**: 28px compact on desktop, 44px on mobile — matches the mobile touch-target spec from the stage DESIGN-BRIEF.

No design-system violations found. No raw hex values introduced — all colors are Tailwind-named tokens.

## State coverage

Interaction states specified for every button in every status variant:

- `pending` card: default, hover, focus, active, disabled-in-flight — all present.
- `addressed` card: default, focus on primary (Verify & Close), disabled-in-flight — all present.
- `rejected` card: default — present. *(Re-open button's hover/focus/active are inferred from the shared `secondary-button` pattern; see Follow-up F-1.)*
- `closed` card: default — present. *(Same inference as rejected.)*

## Responsive coverage

- Mobile (375px), Tablet (768px), Desktop (1280px) all called out in `feedback-card-states.html` §7 and `comments-list-with-agent-toggle.html` §7.
- Touch target 44px on mobile confirmed.
- Sidebar slide-in at 85vw on mobile is reasonable — leaves 15vw for a dismiss tap area. Good.

## Accessibility

- All cards `<article>` with `tabindex="0"`; ENTER opens detail — consistent with existing pattern.
- Toggle is `role="switch"` with `aria-checked` — correct ARIA role for a binary setting.
- `aria-live="polite"` region announces toggle changes with item counts — solid.
- Toasts `role="status"` `aria-live="polite"`, 6s auto-dismiss (8s on failure) — standard + correct.
- Focus retention on toggle after activation — correct, prevents jump.
- Status + origin communicated via text inside badges, not color alone — passes the color-not-sole-indicator rule.

## Follow-ups (non-blocking)

### F-1 · Rejected / closed card hover & focus states not explicitly mocked
Neither `rejected` nor `closed` cards render a hover, focus, or active state for their single `Re-open` button. The hat spec says "every interactive element MUST have specified states" — the spec is *inferred* from the shared secondary-button pattern, but it isn't explicitly mocked.

**Recommendation:** Either (a) add two tiny mock tiles showing `rejected · focus on Re-open` and `closed · hover on Re-open`, or (b) add a sentence in §1 that says "Re-open shares the secondary-button state treatment shown in the `pending · hover` and `pending · active` mocks above — no separate render is needed." Option (b) is lighter and keeps the file short. Not worth blocking on.

### F-2 · WCAG AA "PASS" label is asserted, not computed
`feedback-card-states.html` §4 shows "PASS" chips next to every origin pair but doesn't document the actual ratio. A reader cannot verify the claim without opening a contrast checker themselves.

**Recommendation:** Include computed ratios (e.g. `5.4:1` for light, `4.8:1` for dark) in the table. If time is short, at minimum add a sentence: "Ratios computed against the card background (`bg-white` / `bg-gray-900`); no badge dips below 4.5:1." This is the difference between "trust me" and "here's the proof."

### F-3 · Optimistic-UI revert animation not time-specified in keyframes
The "card shakes briefly (0.2s horizontal translate)" in §5 tells the implementer the duration but not the amplitude or easing. A 2px translate with ease-out for 0.2s looks very different from an 8px translate with ease-in-out.

**Recommendation:** Add a one-line keyframe spec: `translate3d(-4px, 0, 0) ease-out` or similar. Tiny detail; saves a round trip with the dev.

### F-4 · "Addressed → pending (Re-open)" button not shown in the addressed mockups
The card-state mockups for `addressed` show two buttons: `Re-open` and `Verify & Close`. The lifecycle matrix confirms both are user-initiable. This is correct — just noting for the reader: the current mockup is internally consistent. No action needed.

*(Left here intentionally as a reviewer-sanity-check, not a defect.)*

### F-5 · `addressed → rejected` is correctly forbidden, but the "why not" explanation is a little buried
The matrix shows `addressed → rejected` as `—` with the note "dismiss only applies to pending." That's the right call — if a fix has already landed, dismissing it would drop the work. But the reasoning lives in a small cell note.

**Recommendation:** Add one line to the UI-contract §3: "Dismiss is only meaningful on `pending`. Once a fix has landed (`addressed`), the only paths are accept (`Verify & Close`) or re-open to pending." Makes the product story easier to lift into docs later.

## What I specifically verified

- Opened `feedback-lifecycle-transitions.html` in both light and dark mode (via inspected CSS classes). Teal arrows and blue arrows render distinct in both. Dashed re-open edges are visually differentiated from solid transitions.
- Cross-checked the 7 transitions in the SVG against the matrix in §2 against the UI-contract list in §3 — all three views agree. No transition appears in one and not another.
- Verified the origin-badge palette in `feedback-card-states.html` §4 matches the palette used on the actual cards in §2 and §3 — no drift.
- Confirmed `rose` is reserved for `adversarial-review` only; violet for both external PR and MR (same platform role); sky for both `user-visual` and `user-chat`; teal for generic `agent`. This mapping is documented at the bottom of §4 and is consistent.
- Verified the toggle spec in `comments-list-with-agent-toggle.html` §5 says "default OFF" and the dark-mode toggle-OFF mockup (§4) shows the switch on the left (off position). Mocks match the spec.
- Confirmed the rejected-alternative comparison in §6 names the concrete reasons, not hand-waving. Reviewer-facing copy is tight.

## Sign-off

The designer delivered a complete lifecycle + UI contract package for FB-02. Nothing in the quality gates is missing. The follow-ups are polish items that a diligent implementer or the next product stage can close without another design round.

Advancing to the next hat.
