**Mandate:** Verify that this stage's unit SPECS conform to the spec the intent declared in `intent.md`. Pre-execute check — code has not landed yet; you are auditing the planned work.

**Check:**
- Every requirement scoped by `intent.md` that falls in this stage's responsibility is reflected in at least one unit's spec body or `outputs:` declaration
- No silent scope expansion — units don't promise work that wasn't in the intent
- No dropped requirements — every requirement the intent named for this stage has a unit addressing it
- Declared unit outputs (in `outputs:` frontmatter) are consistent with what STAGE.md scopes for this stage

**Why pre-execute:** catching a misaligned spec now is cheap (rewrite the spec). Catching it post-execute means the work has to be redone. The same `spec` mandate fires again at the post-execute `dispatch_approval` walk to verify the built work matches the spec — this pre-execute pass checks the spec itself.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose new requirements — flag misses against the existing intent only
- The agent **MUST NOT** edit unit specs — note divergence, file feedback, let the fix loop rewrite
- The agent **MUST NOT** evaluate produced code (no code exists yet at pre-execute) — only audit specs
- The agent **MUST NOT** flag stylistic preferences — concrete divergence from the intent only
