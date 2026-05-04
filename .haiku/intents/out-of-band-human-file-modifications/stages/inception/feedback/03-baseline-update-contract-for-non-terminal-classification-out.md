---
title: >-
  Baseline-update contract for non-terminal classification outcomes is
  unresolved — risks steady-state drift loop
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-28T14:37:05Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-03:bolt-1'
bolt: 1
triaged_at: '2026-04-28T14:37:05Z'
resolution: null
replies: []
integrator_attempts: 1
---

## Finding

DESIGN-DECISIONS.md Decision 3 and IMPLEMENTATION-MAP.md Plugin Surface 4 both specify that the `manual_change_assessment` action updates the baseline for findings classified as **"ignore"** or **"inline-fix"**. Neither document specifies what happens to the baseline when the agent classifies a finding as **"surface-as-feedback"** or **"trigger-revisit"**.

If the baseline is not updated for these two outcomes, the drift-detection gate will re-detect the same changed file on **every subsequent tick** until the feedback is resolved or the revisit completes. This is a steady-state loop risk that is distinct from the upgrade-time false-positive storm (which DISCOVERY.md § "Risks: False positives storm" and DESIGN-DECISIONS.md Decision 3 already acknowledge for the "ignore" case).

## Why this is a feasibility concern, not a design detail

The intent's success criterion states (DISCOVERY.md § "Success criteria: Outcome-based"):

> *"Silent loss of human edits — currently a real failure mode — drops to zero for any file inside an intent's tracked surface."*

And (same section):

> *"Designers and product owners can collaborate inside an active intent without needing to understand MCP tools or hooks."*

If a designer replaces a layout and the agent classifies the drift as "surface-as-feedback" (because it can't determine whether it's a cosmetic tweak or a redesign), and the feedback sits unresolved for three ticks, the system will fire `manual_change_assessment` three more times for the same file. The designer watching the SPA's drift assessment view sees three duplicate entries. The feedback channel accumulates redundant findings. The outcome-based criterion — "humans stop circumventing the framework; the framework is now the path of least resistance" — is directly undermined if the framework repeatedly re-surfaces the same finding.

DISCOVERY.md § "Risks: Classification gets stuck in a loop" identifies this risk but frames the fix as either "a 'drift acknowledged' record that updates the baseline" or "a classification outcome that explicitly snapshots the new state as the agent-acknowledged baseline." These are two distinct strategies with different correctness properties. The inception record does not commit to either, and neither does DESIGN-DECISIONS.md.

## What makes this strategic rather than just a design detail

The loop risk is not "which file should we write the baseline to?" (that's clearly a design decision). It is "does the system's core reactive model produce correct eventual-consistency behavior for all four classification outcomes?" If the answer is "we don't know yet," the measurability of the stated success criteria is in question — the system could meet all the implementation goals and still fail the observable-outcome goal because of steady-state re-detection noise.

The two candidate stances from DISCOVERY.md need at least a policy commitment at inception:

- **Stance A:** On any classification, the baseline is immediately updated to the observed file state. The classification outcome determines the *action* (create FB, trigger revisit) but not whether drift is re-detected. This prevents re-detection but means "the agent acknowledged the change" even if action is still pending.
- **Stance B:** On non-terminal outcomes (surface-as-feedback, trigger-revisit), the baseline is NOT updated until the downstream action resolves. The drift signal is suppressed by a "pending assessment" flag rather than a baseline update, and the gate skips files with a pending assessment already open.

Either stance is achievable, but Stance B requires the gate to carry "skip if pending" logic that is not identified anywhere in the inception artifacts. If that logic is absent from the design spec, the design stage may implement Stance A by default without realizing Stance B was available — and without the inception record naming the trade-off, the choice may not be made consciously at all.

## What the fix loop should address

The DESIGN-DECISIONS.md Decision 3 should be extended with an explicit clause stating the baseline-update policy for all four outcomes — either as a new decision entry or as a refinement of Decision 3. The "Open for Design" section should name this as a deferred decision with the two candidate stances described, consistent with how Decision 9 is handled. The IMPLEMENTATION-MAP.md Plugin Surface 4 description should reference this policy explicitly rather than implying the gate handles it.
