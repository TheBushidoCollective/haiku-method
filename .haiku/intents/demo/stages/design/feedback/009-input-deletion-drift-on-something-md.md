---
title: input_deletion drift on something.md
status: pending
origin: drift
author: engine
author_type: system
created_at: '2026-05-18T20:01:34Z'
iteration: 0
visit: 0
source_ref: 'drift:input_deletion:stages/design/artifacts/something.md'
closed_by: null
bolt: 0
triaged_at: '2026-05-18T20:01:34.519Z'
resolution: null
replies: []
targets:
  unit: null
  invalidates: []
---

_Engine-authored drift FB. The premise that 1 signed slot(s) depended on has shifted. Read the file at the path below and classify._

**File**: `stages/design/artifacts/something.md` (no longer present on disk)
**Kind**: `input_deletion`
**Witnessed at**: 2026-05-18T15:00:00Z


**Affected slots** (witnesses already restamped to current SHA — drift cannot re-fire):
- `unit-01` / role `spec`

---

## What to do (classifier hat)

Read the file body and the slots' specs. Decide:

- **Cosmetic** — the premise shifted but the consumers' reasoning is unaffected (e.g., whitespace, comments, doc reword that doesn't change the contract). Advance the hat without setting `targets.invalidates`. Closure is a no-op; the witnesses are already current.
- **Material** — the shift invalidates one or more consumers' signoff. Call `haiku_feedback_set_targets` with `invalidates: [<role>, ...]` listing the roles whose signature can no longer stand. The close hook will delete those slots; the cursor's next tick will re-emit `dispatch_review` for them.

This FB will NOT be re-emitted by the next drift sweep — the witness restamp at file time made the SHA mismatch impossible to detect twice.
