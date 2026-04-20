---
title: >-
  RollbackBanner/BlockedGatePanel/RollbackToast live in artifacts but missing
  from DESIGN-BRIEF §2 inventory
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:52:03Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

Consistency defect — the design ships three surfaces (`RollbackBanner` / `BlockedGatePanel` in `rollback-reason-banner.html`, `RollbackToast` + Retry / Open-repair / ✕ dismiss buttons in `revisit-modal-states.html`) that are rendered components with a six-state coverage grid (see `state-coverage-grid.md §4` rollback-toast rows) but NONE appear in DESIGN-BRIEF §2 "New Components" nor in `state-coverage-grid.md §0` "DESIGN-BRIEF §2 component checklist".

Evidence:
1. `stages/design/artifacts/rollback-reason-banner.html` renders `RollbackBanner` and `BlockedGatePanel` as full production components with props, states, copy templates, and ARIA contracts.
2. `state-coverage-grid.md §4` has rows for `Rollback toast`, `Rollback toast Retry button`, `Rollback toast Open-repair button`, `Rollback toast ✕ dismiss (FB-64 — 44×44 on mobile)` — so the grid already tracks their states.
3. BUT `state-coverage-grid.md §0` "DESIGN-BRIEF §2 component checklist" lists only 12 components — missing these three.
4. DESIGN-BRIEF §2 "New Components" lists the same 12 — no rollback-banner / blocked-gate-panel / rollback-toast row.

The state-coverage-grid §0 callout says: "If you add a new component to DESIGN-BRIEF §2, you MUST add a row in §7 of this file in the same change." The inverse is also required per FB-56 extension ("every new component introduced in downstream stages MUST ship with a six-state grid alongside its component spec"): a component that has a grid row SHOULD have a DESIGN-BRIEF §2 inventory row too.

Effect — `RollbackBanner`, `BlockedGatePanel`, `RollbackToast` are "ghost" components: the dev stage will have to infer canonical names from filenames and invent component boundaries. The three already carry spec-level props (copy templates, states, CTAs), so promoting them to §2 is zero new design work — just the cross-reference and naming-convention rationale row.

Fix — atomic edit in three places:
1. **DESIGN-BRIEF §2 "New Components"** — add three rows after `RevisitModal`:
   - `RollbackBanner`: noun phrase; full-width top-of-content banner per `rollback-reason-banner.html §A`; props drive copy template (`still-pending` / `assessor-error` / etc.); ties into FSM rollback event.
   - `BlockedGatePanel`: noun phrase; replaces the user-gate action bar when gate is not reachable; contextual (hides when feedback is not pending).
   - `RollbackToast`: noun phrase; ephemeral toast with Retry + Open-repair + ✕ dismiss buttons; lives inside `RevisitModal` error flow per `revisit-modal-states.html` + `state-coverage-grid.md §4`.

2. **`state-coverage-grid.md §0`** — extend the checklist to 15 rows, each pointing to its §row (§4 for RollbackToast; new §rows for RollbackBanner + BlockedGatePanel).

3. **`component-inventory.md`** — add three rows to "New Components" mirroring the DESIGN-BRIEF §2 additions (thin pointers, same pattern as the existing 12).

This is a naming / inventory consistency fix, not a visual redesign — the artifacts already encode the component boundaries.
