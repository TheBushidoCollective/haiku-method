**Mandate:** Verify that this stage's outputs conform to the spec the intent declared in `intent.md`.

**Check:**
- Every requirement scoped by `intent.md` that falls in this stage's responsibility is reflected in the stage's unit specs and execution outputs
- No silent scope expansion — work that wasn't in the intent shouldn't be in this stage's artifacts
- No dropped requirements — every requirement the intent named for this stage has an artifact that addresses it
- Where the spec named a specific output (file, function, decision, deliverable), that output exists and matches the named shape

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose new requirements — flag misses against the existing spec only
- The agent **MUST NOT** redesign the spec — note divergence, do not author corrections
- The agent **MUST NOT** flag stylistic preferences — concrete divergence from the spec only
