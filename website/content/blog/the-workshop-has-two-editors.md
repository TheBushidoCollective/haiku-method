---
title: "The Workshop Has Two Editors"
description: "H·AI·K·U used to assume the agent owned every file in the intent dir. Real teams aren't like that. Drift detection, audit logs, and a human-write MCP tool make the workshop honest."
date: 2026-05-04
---

A designer drops fourteen PNGs from Figma into `stages/design/artifacts/`. A PM hand-edits the success criteria on `unit-03`, then asks the agent to take it from there. An operator runs `vim` on `knowledge/runbook.md` to fix a typo before standup.

None of those writes goes through the agent. Until this intent shipped, none of them was visible to the workflow either. The next `haiku_run_next` tick would steamroll the designer's PNGs by re-generating from the brief. Or fight the PM's hand-tuned criteria with a different draft. Or — worse — silently accept the human edits and lose the audit trail entirely.

H·AI·K·U used to assume the agent owned every file in the intent dir. That model holds for greenfield builds where one agent writes the entire workspace. It does not hold for any team you'd actually want to work with.

## The factory and the workshop

The factory has one machine. Materials go in, products come out, the machine writes every step. The pipeline is closed.

The workshop has many craftspeople. The agent has the keyboard most of the time, but a designer can grab it to drop a hero image, a PM can grab it to tighten a unit spec, an operator can grab it to patch a runbook. The work is shared. The pipeline is not closed.

H·AI·K·U was modeled as a factory. The intent-completion gate confirmed it: by the time the workflow ran adversarial reviews, only commits the agent authored were in scope. Anything dropped by a human into the same dir got tagged "untracked" and either ignored or overwritten on the next tick.

The intent that just landed flips the model. The intent dir is a workshop. The agent is one editor. Humans are first-class.

## What it takes to be honest about that

Three things had to change in the engine.

**Detection.** Every tick, before any handler runs, the workflow takes a SHA-256 fingerprint of every file in the tracked surface and compares it to the baseline stored in `state.json`. Any file whose hash doesn't match the baseline fires `manual_change_assessment` — a structured action listing every changed path with a unified diff. The agent reads each finding and classifies: `ignore` (accept the change, baseline updates), `inline-fix` (absorb into the current bolt), `surface-as-feedback` (open an FB and let the next iteration triage), or `trigger-revisit` (the change invalidates a prior stage's work; rewind there). Per-file decision, on the record.

**Attribution.** The agent doesn't just find changes; it labels them. A new MCP tool, `haiku_human_write`, lets a human-instructed write land with `author_class: "human"` in the action log. A SPA upload UI does the same for files dropped through the browser. Anything else that shows up in the diff is `author_class: "unknown"` — the agent can't prove who wrote it, and the workflow records that ambiguity instead of papering over it. Provenance is not negotiable.

**Discipline.** The drift gate doesn't run the moment a human touches a file. It runs the next time the agent ticks. Concurrency is eventually consistent — the workshop has no locks because `vim` doesn't honor `flock` and we're not going to pretend it does. The compensating control is the gate: every tick re-hashes the tracked surface, observes whatever happened since last tick, and reconciles. Writes can race. The reconciler doesn't.

## What this looks like

The PM hand-edits `unit-03-billing-policy.md` and types into the chat: "I tightened the criteria. Take it from here." The next tick:

1. Pre-tick drift gate compares the file's current SHA against the baseline. Mismatch.
2. Engine emits `manual_change_assessment` with the unified diff.
3. Agent reads the diff. The PM's edits added two new completion criteria. Not a regenerate signal — the criteria are tighter, not different.
4. Agent calls `haiku_classify_drift` with `decision: "inline-fix"` and a one-line rationale. Baseline updates. The new criteria are now part of the unit's spec.
5. Workflow continues. The unit's hat sees the updated spec the next time it loads.

No regeneration. No fight. The agent absorbs the PM's signal and proceeds. The action log records: the PM edited the file, the agent classified the edit, the baseline updated. Everything is on the record.

A different scenario: the designer drops fourteen PNGs into `stages/design/artifacts/`. The drift gate notices fourteen new files, fires the assessment with diffs (or `is_binary` markers for the PNGs), the agent classifies them as `ignore` — these are designer-provided artifacts, accept them as canonical. The next time `/haiku:revisit design` runs, the elaborate phase sees them as inputs, not as work to redo.

## What the user actually does

Nothing different. You drop files. You edit specs. You uploaded a brand kit through the SPA. You typed into the chat. You ran `vim`.

The workflow notices. It asks the agent to triage. The triage takes two seconds. Your edits stay. The pipeline integrates. The audit log records who did what.

The intent dir is a workspace. Now it's an honest one.
