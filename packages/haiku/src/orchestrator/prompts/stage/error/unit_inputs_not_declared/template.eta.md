## Unit `inputs:` Not Declared

Stage `<%= stage %>` has <%= unitCount %> unit(s) with no `inputs:` field in their
frontmatter. Every unit MUST declare what upstream artifacts it reads —
intent doc, knowledge docs, prior-stage outputs — even if the answer is
"nothing" (in which case set `inputs: []` explicitly).

Affected units:
<% for (const u of units) { %>
  - `<%= u %>`
<% } %>

### Fix

For each affected unit, call `haiku_unit_set` to declare the field:

```json
{
  "intent": "<%= slug %>",
  "unit": "<unit-name>",
  "field": "inputs",
  "value": ["stages/<upstream>/artifacts/<file>", "..."]
}
```

If the unit genuinely reads nothing upstream, set `value: []` —
the empty array is a deliberate declaration and is fine. The engine
refuses to dispatch hats against a unit with NO `inputs:` key at
all because that condition is structural drift; the same condition
`haiku_repair` flags. The fix belongs in the unit spec, not in a
repair pass.

After fixing all affected units, call `haiku_run_next` to re-tick.
