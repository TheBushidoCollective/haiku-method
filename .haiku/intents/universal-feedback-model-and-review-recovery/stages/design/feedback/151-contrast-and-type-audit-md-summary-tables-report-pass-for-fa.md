---
title: >-
  contrast-and-type-audit.md summary tables report PASS for failing checks —
  audit unreliable as gate
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:54:03Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

Meta-finding about the quality-gate apparatus itself. `contrast-and-type-audit.md` is the canonical a11y verification document for this stage — its §6.2 / §6.3 tables report PASS on QG1 (`opacity-(50|70)`), QG2 (`bg-stone-200 text-stone-500 | disabled:opacity-50`), and QG3 (disabled buttons paired with `aria-disabled="true"`). Running the same greps against the current artifact tree produces non-trivial non-zero hits.

**Live audit counts vs. documented "0 hits" claims (measured 2026-04-20, `stages/design/artifacts/*.html`):**

- `grep -rEn 'opacity-50' *.html | grep -v 'backdrop-blur\|black/50\|modal-overlay'` — audit claims 0, actual is **6** hits across 4 files:
  - agent-feedback-toggle-spec.html:181, :195
  - annotation-popover-states.html:394
  - revisit-modal-states.html:100, :155, :552
- `grep -rEn 'opacity-60' *.html` — audit §6.2 QG1-extended claims 0 on text-carrying card/button roots, actual is **~13** hits across 3 files:
  - review-ui-mockup.html:136, :153, :790 — all text-carrying surfaces
  - revisit-unit-list.html:247, :259, :271, :283, :295, :307, :319, :345, :393 — 9 text-carrying locked-card surfaces
  - comment-to-feedback-flow.html:329, :777, :966 — the first two are disambiguated demo-only, the third (:966) is a text-carrying card root
- `grep -rEn 'bg-stone-200 text-stone-500' *.html` — audit claims 0, actual has live hits in revisit-unit-list.html read-only pills (lines ~240, ~398 — same pattern with `dark:bg-stone-700 text-stone-400`) and in the review-ui-mockup.html dynamic button at :856 (`text-stone-500` on `bg-stone-100`, which is a related variant on the ban list).
- Python3 `aria-disabled` walker (from §4 Bolt-4 script) — audit claims 0 violations, actual returns **7** violations:
  - review-ui-mockup.html:136, :153, :856
  - revisit-modal-states.html:100, :155, :540-area, :552

**Why this matters more than any individual finding:**

1. The audit is the feedback-assessor's source of truth for the a11y gate. If audit says PASS and artifact says FAIL, the gate advances on a false signal.
2. Downstream units (dev stage, feedback-assessor for intent-completion review) will assume audit is accurate and copy spec text verbatim into implementation. Every `disabled:opacity-50` that survives the audit ships into production.
3. FB-71, FB-86, FB-92, FB-94, FB-108 were all marked `closed_by: unit-26/27` — those units made prose edits but did not touch the rendered markup. The closure signal is not trustworthy.
4. The "bolt-5 QG1-extended classification" passage in §6.2 manually enumerates residual matches and declares each one either a prose/comment or disambiguated demo — but that manual triage missed 10+ text-carrying card roots in `revisit-unit-list.html` and 3 in `review-ui-mockup.html`.

**Fix required:**

1. Re-run every QG grep in `contrast-and-type-audit.md §6.1, §6.2, §6.3` against the current artifact tree. Replace every PASS with the actual count. Any non-zero text-carrying surface is a blocker.
2. Add a stage quality gate (enforced by `stage.sh` or the feedback-assessor hat) that runs the exact scripts in §4 Bolt-4 and §6.2 and fails the gate on any non-zero output. This is infrastructure — without an enforced gate, future reviews will produce the same false closures.
3. Re-open FB-71, FB-86, FB-92, FB-94, FB-97, FB-108 — they were marked closed prematurely.
4. Update `feedback-assessor.md` hat spec for the design stage to require running the QG1-3 scripts + aria-disabled walker before marking any a11y finding `addressed` → `closed`. The closure step is the last verification, and it was the step that was skipped.

**Pattern:** the audit keeps getting updated to *describe* the fix, and the feedback item gets closed on the description — but the artifact markup doesn't get the fix. This is the same failure mode as FB-95 (audit claims vs. reality drift). The fix is to require the grep to return 0 before closure is allowed, not trust the audit's §6 tables.

**WCAG refs:** Process finding — bears on 1.4.3 / 1.4.11 / 2.4.7 enforcement rigor.
