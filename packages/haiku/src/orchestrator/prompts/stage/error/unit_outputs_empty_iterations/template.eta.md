## Unit Outputs Declared But Never Built

Stage `<%= stage %>` has <%= unitCount %> unit(s) that declare non-empty
`outputs:` but have an empty `iterations:` array — the per-unit
builder hats never ran. Advancing to spec review against this state
would file `unit_outputs_empty` feedback once per affected unit.

Affected units:
<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

### Fix

Pick one path per unit:

1. **Build it.** If the unit was supposed to produce its declared
   outputs, dispatch the next hat for the unit. Re-tick
   `haiku_run_next` — if the cursor still surfaces this action,
   the unit is blocked by a structural issue (e.g. a `depends_on`
   cycle, missing inputs, or wave-readiness denial). Fix that first.
2. **Delete it.** If the unit was created in error or has been
   superseded, remove it via:
   ```json
   {
     "intent": "<%= slug %>",
     "unit": "<unit-name>"
   }
   ```
   passed to `haiku_unit_delete`.
3. **Clear the contract.** If the unit is intentionally a knowledge-
   class unit (no built outputs), call
   `haiku_unit_set { field: "outputs", value: [] }` so the empty
   contract matches the empty iteration history.

Call `haiku_run_next` after each fix to re-evaluate.
