**Mandate:** Verify that <%= scope === "intent" ? "the merged intent" : "this stage" %>'s outputs conform to the spec the intent declared in `intent.md`.

**Check:**
- Every requirement scoped by `intent.md` is reflected in the <%= scope === "intent" ? "merged stage outputs" : "stage's unit specs and execution outputs" %>
- No silent scope expansion — work that wasn't in the intent shouldn't be in the artifacts
- No dropped requirements — every requirement the intent named has an artifact that addresses it
- Where the spec named a specific output (file, function, decision, deliverable), that output exists and matches the named shape

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose new requirements — flag misses against the existing spec only
- The agent **MUST NOT** redesign the spec — note divergence, do not author corrections
- The agent **MUST NOT** flag stylistic preferences — concrete divergence from the spec only
