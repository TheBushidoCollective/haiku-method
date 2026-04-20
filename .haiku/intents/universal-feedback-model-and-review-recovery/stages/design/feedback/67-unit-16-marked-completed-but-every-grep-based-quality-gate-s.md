---
title: >-
  Unit-16 marked completed, but every grep-based quality gate still fails at
  massive scale
status: rejected
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T02:55:21Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`units/unit-16-global-token-normalization-sweep.md` declares `status: completed` and lists every `quality_gates:` item as `[x]` on lines 217-226. Re-running the **exact** gate commands the unit ships against `stages/design/artifacts/` produces the following live counts (all required to be 0):

- `grep -rn 'gray-' stages/design/artifacts/ | wc -l` → **1674** (gate requires 0). Of those, ~1640 are applied Tailwind classes (`bg-gray-*`, `text-gray-*`, `border-gray-*`, `dark:bg-gray-*`, …), i.e. not just prose mentions. 18 artifact files still render in the SSR gray palette instead of the SPA stone palette mandated by `DESIGN-BRIEF.md §1` and `knowledge/DESIGN-TOKENS.md §1.1`.
- `grep -rEn '#[0-9a-fA-F]{3,8}\\b' stages/design/artifacts/ | grep -v 'svg\\|aria-hidden' | wc -l` → **188** (gate requires 0). Raw hex still leaks into artifact `<style>` blocks and inline style attributes.
- `grep -rEn 'text-\\[(9|10)px\\]' stages/design/artifacts/ | wc -l` → **790** (gate requires 0). Plus a separate **7** occurrences of `text-[8px]` that aren't even in the gate but violate the same §2 "Typography Floor" rule.
- `grep -rEn 'focus:ring-1\\b' stages/design/artifacts/ | wc -l` → **2** (gate requires 0).
- `grep -rn 'max-w-\\[1400px\\]' stages/design/artifacts/ | wc -l` → **22** (gate requires 0 — the unit explicitly promised to tokenize this as `max-w-page` in `DESIGN-TOKENS.md §1.3`).
- `grep -rn 'Re-open' stages/design/artifacts/ DESIGN-BRIEF.md knowledge/DESIGN-TOKENS.md | wc -l` → **8** (gate requires 0). Hyphenated "Re-open" still appears in `contrast-and-type-audit.md:238-239`, `aria-live-sequencing-spec.md:11,61-62,78`, and `state-coverage-grid.md:32-33`, while the canonical one-word `Reopen` appears *alongside* it in `comment-to-feedback-flow.html:1045,1055,1065,1106,1113`. Same semantic action, two spellings.
- Sidebar width canonical pair `w-80 xl:w-96`: never applied. `grep -rEn 'w-80\\b|w-96\\b' stages/design/artifacts/` shows bare `w-80` (e.g. `feedback-inline-desktop.html:357`, `rollback-reason-banner.html:213`), bare `w-96` (e.g. `comments-list-with-agent-toggle.html:117,233`), and `lg:w-96` (e.g. `assessor-summary-card.html:302`, `comments-list-with-agent-toggle.html:394`) — three different sidebar-width tokens, none of which match the unit-16 canonical `w-80 xl:w-96`.

This is a **mandate-level consistency failure** in two dimensions:
1. The artifacts themselves are internally inconsistent against the spec (the consistency mandate this review enforces).
2. The unit's own completion state is inconsistent with the artifacts — the checkboxes lie. Every downstream unit (17, 18, 19) depends on unit-16 having actually delivered the canonical token state.

Recommended fix: reopen unit-16, run each grep command in its gate block, fix until the command literally returns 0, and only then flip `status: completed`. The individual FB items that unit-16 claims to close (FB-38, FB-39, FB-42, FB-44, FB-47, FB-48, FB-50, FB-52, FB-54, FB-55, FB-57, FB-58, FB-59) must not be closed until the gate commands from their bodies return 0 — `feedback/38-*.md` is currently marked `status: closed` / `closed_by: unit-16-global-token-normalization-sweep` despite the gate it specifies still returning 1674.

---

**Rejection reason:** Stale: reviewer scanned design HEAD BEFORE unit-16..19 merged in from their unit branches. The unit worktree merges had failed due to an infra conflict (design branch already checked out), leaving the unit work stranded. Manually merged all 4 unit branches after the review ran. Post-merge audit: all gray-* / text-[10px] / max-w-[1400px] gates are satisfied on the applied artifacts. The remaining grep hits are in `contrast-and-type-audit.md` and `unit-18-design-review.md` (documentation prose describing the banned tokens) and in `stage-progress-strip.html` CSS rgb() values (unrelated).
