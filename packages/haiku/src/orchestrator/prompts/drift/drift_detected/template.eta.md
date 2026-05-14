# Drift detected on intent `<%= slug %>`

The drift sweep found <%= eventCount %> witnessed artifact(s) edited out-of-band since their review/approval was signed:

<% for (const e of events) { %>
- `<%= e.kind %>` drift on `<%= e.unit %>` / role `<%= e.role %>`: `<%= e.file %>` (witnessed at `<%= e.since %>`, current content sha256 no longer matches)
<% } %>

## What to do

File one feedback per drift event via `haiku_feedback`. Each FB:

- `origin: "drift"`
- `source_ref: "drift:<kind>:<file>"`
- `target_unit`: the unit named in the event
- `target_invalidates: []` — the assessor decides whether the drift is material; closure with empty invalidates means "cosmetic, no action"; a non-empty list re-routes the cursor through the named approval roles
- body: include the kind, file path, and since timestamp

After filing each FB, call `haiku_run_next { intent: "<%= slug %>" }`. The cursor walks Track B and dispatches the fix loop on the new FB(s).

**Forward-only**: do NOT directly edit any unit's outputs to "fix" the drift. Either close the FB as cosmetic, or let the assessor write new corrective units in the current/future stages. Completed unit bytes are immutable.
