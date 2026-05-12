---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the implementation does not introduce breaking changes to the public API surface relative to what was declared in inception. Breaking changes that slip past this lens become surprise major-bump requirements at release time or, worse, silent breakage for consumers on the next minor.

## Check

The agent **MUST** verify, file feedback for any violation:

- **No removed or renamed public symbol** — Every export named in the inception api-surface still exists at the documented path with the documented name. A removed export is a major-bump change; flagged even if the surface "needed cleanup."
- **No signature changes** — No parameter added (even optional, when the contract was a fixed positional signature), narrowed type, widened return type, changed generic constraint, or altered default value. The signature in the code matches the signature in the api-surface byte-for-byte modulo formatting.
- **Error model intact** — No error variant removed; no error variant added to a closed (exhaustive) error set without explicit semver impact recorded; no error type widened or narrowed; structured-data fields on errors preserved.
- **Behavior preserved where signatures unchanged** — Same inputs produce same outputs as the prior released version. Behavior changes that leave the signature unchanged (stricter validation, changed defaults, different ordering, different idempotency semantics) are major-bump changes and MUST be flagged with an explicit semver impact note.
- **Stability tier respected** — A symbol marked `experimental` in inception MAY change without ceremony; a symbol marked `stable` MUST NOT. Changes to `internal-may-leak` symbols are flagged for review but not blocked.
- **Deprecation policy honored** — If an API was deprecated in the prior minor, removing it requires a major bump. If it wasn't deprecated, it can't be removed in a major either without a deprecation cycle.

## Common failure modes to look for

- A parameter renamed for "clarity" — every consumer using a named-argument call pattern just broke
- A return type widened from `User` to `User | null` — every consumer's exhaustive handling just broke
- An error class that no longer extends the documented base class — instanceof checks just broke
- A function that used to throw on invalid input now returns a sentinel value (or vice versa) — observable behavior change
- A new optional parameter inserted *before* an existing optional parameter — positional callers just shifted
- An exported symbol moved from one module path to another without a re-export at the old path
- An error variant added to a typed union the API surface declared closed
- A default value changed in a way the consumer can observe (e.g., timeout default lowered from 30s to 5s)
