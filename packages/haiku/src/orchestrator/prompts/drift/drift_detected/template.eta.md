# Drift detected on intent `<%= slug %>`

The drift sweep found <%= eventCount %> change(s) to the premises a signed slot
depends on. A "premise" is what the reviewer signed against — the unit's body
and its declared inputs. Outputs aren't witnessed; producers freely evolve
their deliverables. Drift means *consumer's premise set shifted*, not
*producer's output changed*.

<% for (const e of events) { %>
- `<%= e.kind %>` drift on `<%= e.unit %>` / role `<%= e.role %>`: `<%= e.file %>` (witnessed at `<%= e.since %>`)
<% } %>

## Kind reference

- `spec` — the unit body itself was edited out-of-band. The reviewer
  signed against a different spec than what's on disk now.
- `input_mutation` — a file the slot witnessed as an input has new
  content. Read it; decide whether the change shifts the unit's
  reasoning.
- `input_addition` — a new file appeared inside a witnessed input
  directory (e.g. an upstream stage produced a new discovery output).
  The premise set grew.
- `input_deletion` — a witnessed input file (or a file inside a
  witnessed dir) is gone. The slot was signed against a premise that's
  no longer available.
- `discovery_output` / `discovery_mandate` — a discovery agent's
  output (intent-relative) or mandate (plugin source) changed since
  the discovery slot was signed.

## What to do

File one feedback per drift event via `haiku_feedback`. Each FB:

- `origin: "drift"`
- `source_ref: "drift:<kind>:<file>"`
- `target_unit`: the unit named in the event
- `target_invalidates`: leave empty `[]` for cosmetic ("this premise
  shift doesn't change my conclusions"); list the affected role(s) for
  material ("this premise shift invalidates my work").
- body: include the kind, file path, since timestamp, and a short
  read of why you think the change is cosmetic vs material

After filing each FB, call `haiku_run_next { intent: "<%= slug %>" }`. The
cursor walks Track B and dispatches the fix loop on the new FB(s).

## How resolution closes the loop

- **Cosmetic close** (`target_invalidates: []`): the FB close handler
  rebuilds every surviving review slot's witnesses with current SHAs.
  The next sweep sees current SHAs match the refreshed witnesses → no
  events. The premise shift is accepted as the new acceptable truth.
- **Material close** (`target_invalidates: [<role>]`): the FB close
  handler deletes the named slot. The cursor sees the missing slot
  next tick → re-emits `dispatch_review` → the role re-signs against
  the current premise set → witnesses refreshed against current state
  → next sweep clean.

Both paths terminate. The dedup index (`drift-markers.json` is gone;
the sweep walks open drift FBs directly) suppresses re-emission while
the FB is open, so the loop can't fire again until you close it.

**Do NOT call `haiku_debug({op: "reset_drift"})` as the first response
to drift.** Reset is a global witness re-stamp — it masks real premise
shifts instead of letting the assessor evaluate them. Reach for it
only after every drift FB has closed AND drift continues firing on the
next tick (which under the v9 premise-witness model should be
essentially impossible in normal operation).

**Forward-only**: don't directly edit any unit's spec or another
unit's outputs to "fix" the drift. Either close the FB as cosmetic, or
let the assessor write new corrective units in the current/future
stages. Completed unit bytes are immutable.
