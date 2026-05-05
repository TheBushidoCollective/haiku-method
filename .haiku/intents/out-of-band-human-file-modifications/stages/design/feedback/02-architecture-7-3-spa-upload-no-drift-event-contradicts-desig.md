---
title: >-
  ARCHITECTURE §7.3 SPA-upload-no-drift-event contradicts DESIGN-BRIEF's "next
  tick will assess" UX promise
status: rejected
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-04-28T19:51:37Z'
iteration: 1
visit: 1
source_ref: 'design-reviewer hat, bolt 2, unit-01-architecture-spec'
closed_by: null
bolt: 2
triaged_at: '2026-04-28T19:51:37Z'
resolution: null
replies: []
---

## Finding

ARCHITECTURE.md §7.3 specifies that SPA upload endpoints *immediately update the baseline* with `author_class: "human-via-mcp"` so the next drift gate sees an already-acknowledged write and emits **no drift event**:

> SPA uploads are immediately baselined with `author_class: "human-via-mcp"` at upload time — the next tick's drift gate sees them as already-acknowledged human writes and does not emit a drift event.

DESIGN-BRIEF.md Screen 2 (Stage Output Replacement Card) makes the *opposite* user-facing promise. The whole point of the dialog's reassurance copy and post-replace card chip is that the next tick **will** assess the change:

- Line 218: *"☑ The next workflow tick will see this change and classify its impact (manual change assessment)."*
- Line 284: *"updates baseline SHA in `state.json`, broadcasts WS frame `output_replaced` → dialog closes, card body refreshes, success toast on the card 'Output replaced — next tick will assess impact' + the card gets a yellow left-border 3px stripe + a new 'manual change pending' chip in the footer."*
- Line 413 (Screen 3 Path A): *"the next `haiku_run_next` invocation will fire `manual_change_assessment` → banner disappears once that completes → results surface in `StageReview` Outputs/Knowledge tabs (changed cards get the `border-l-amber-400` left-stripe + 'manual change pending' chip until the assessor publishes its disposition)."*
- Line 414 (Path B): *"if the assessment produced FBs, those appear in the Feedback list."*

The architecture says SPA uploads are silently absorbed into the baseline (no `manual_change_assessment` ever fires for them). The brief tells the user — in dialog reassurance copy, in toast text, and in the entire Drift Banner UX — that an assessment is coming. If §7.3 ships as written, every SPA replacement falsely promises "next tick will assess" when in fact no assessment will run.

There is also a smaller storage-location mismatch: DESIGN-BRIEF line 284 says the dialog "updates baseline SHA in `state.json`," but ARCHITECTURE §2.2 puts the baseline at `stages/{stage}/baseline.json`. That's a separate inconsistency the brief or the architecture needs to reconcile, but it's secondary to the UX-promise contradiction above.

## Why this is in scope (design-system / interaction consistency)

The design-reviewer mandate covers interaction-flow correctness: error states, empty states, loading states, and — by extension — that the user-promised flow actually fires. The architecture spec is silently changing the SPA-upload interaction model in a way DESIGN-BRIEF's UX copy explicitly contradicts. A user clicking Replace, reading the dialog's "next workflow tick will see this change," and then watching no assessment ever fire is a broken interaction promise.

This also fails the architecture's own completion criterion: *"Document is internally consistent with DESIGN-DECISIONS.md — every decision recorded there shows up in the architecture, and no architectural choice contradicts a recorded decision."* DESIGN-DECISIONS Decision 1 says detection must work for SPA upload paths (it cites SPA upload as one of the three paths the unified detection covers). §7.3's "no drift event for SPA uploads" turns SPA into the one path that bypasses `manual_change_assessment` entirely — a contradiction of Decision 1's "all three paths covered by the same mechanism" stance.

## What needs to change

Resolve the contradiction by picking the path DESIGN-BRIEF promises:

**Recommended: SPA uploads emit a drift event and run through `manual_change_assessment` like every other write path.** This means §7.3 should say:

- The SPA upload endpoint writes the file to disk.
- The endpoint stamps an entry in the action log marking the upload's author_class as `human-via-mcp` so the gate's inference rule (§6.2) doesn't tag it as `human-implicit`.
- The endpoint does NOT update the baseline directly — it leaves the baseline-divergence state intact so the next pre-tick drift gate sees the change, emits a drift event with `author_class: "human-via-mcp"`, and dispatches `manual_change_assessment`.
- The agent's classification then runs (typically `inline-fix` for explicit user replacement, since the user's intent is unambiguous from the upload action).
- Baseline updates happen on classification per §2.3 / §5.4, exactly as for filesystem drops.

This honors DESIGN-BRIEF's "next tick will assess" UX promise, keeps Decision 1's three-path unification intact, and removes the §7.3 fast-path special case from the architecture entirely.

The fallback paragraph at the end of §7.3 ("The implicit-detection path … is a fallback") becomes the *only* path, simplifying the model.

Also reconcile the storage-location mention: DESIGN-BRIEF line 284 should reference `baseline.json` (not `state.json`) — file a sibling brief amendment or note the mismatch so the development stage doesn't implement against the wrong path.

## File / location

`.haiku/intents/out-of-band-human-file-modifications/stages/design/artifacts/ARCHITECTURE.md` §7.3 (SPA Upload Timing) — primary contradiction; also touches §2.3 (Write Triggers, item 2) and §6.1 (`human-via-mcp` description) which propagate the same fast-path assumption.

---

**Rejection reason:** stale — bolt 1 (commit 66d6a881) already unified SPA uploads through the standard detection-and-classification flow. Current ARCHITECTURE.md §7.3 explicitly states the upload endpoint "Does **not** update `baseline.json` directly" (line 418), that the next pre-tick drift gate "emits a drift event with `author_class: \"human-via-mcp\"`, and dispatches `manual_change_assessment`" (line 418), and that this "honors the 'next workflow tick will assess this change' UX promise made in DESIGN-BRIEF Screen 2" (line 422) with "no fast-path special case for SPA uploads" (line 422). §2.3 item 2 (line 66), §6.1 (line 357), §6.3 (line 380), and the §10 Decision 1 traceability row (line 532) are all aligned to the same unified flow. The finding quotes "SPA uploads are immediately baselined with `author_class: \"human-via-mcp\"` at upload time — the next tick's drift gate sees them as already-acknowledged human writes and does not emit a drift event" — that text no longer exists in the artifact. The contradiction the reviewer raised has been resolved.
