---
interpretation: lens
---
**Mandate:** The agent **MUST** challenge the proposed API surface for long-term stability risk. Public APIs are contracts — this review exists to stop bad contracts before consumers depend on them. Once published, every weak shape becomes a forced major bump or a lingering deprecation.

## Check

The agent **MUST** verify, file feedback for any violation:

- **No internal-type leakage** — No exported function returns or accepts an internal class, library-internal interface, framework primitive, or runtime-specific handle that would force consumers to depend on the library's internals.
- **Growth-resilient parameter shapes** — Multi-argument signatures use options-object parameters, not positional arguments, when more than two parameters are present. Positional growth forces a major bump every time a new option is added.
- **Stability tiers are explicit** — Every exported symbol has a declared stability classification (`stable`, `experimental`, `internal-may-leak`). Mixed-stability symbols within the same entry point or module are flagged.
- **Closed error sets** — The error model declares whether the typed error variants form a closed (exhaustive) set or an open one. If closed, adding a variant later is a major bump and that constraint is recorded. If open, the rationale for the openness is stated.
- **No caller-inference dependence** — The API does not require the consumer's type system to infer correctness from context. If a consumer mis-types a call, the library should fail explicitly, not silently widen behavior.
- **Semver policy covers behavior changes** — The semver policy explicitly addresses behavior changes that leave signatures unchanged (stricter validation, changed defaults, different ordering) as major.

## Common failure modes to look for

- A signature returning `any`, `unknown`, or the equivalent in the target language — pushes the contract onto the consumer's inference
- An exported class with public fields the library considers internal — every field access becomes a tacit contract
- A function whose options object accepts a free-form record without a typed schema — every property name becomes ambient API
- An error model that throws strings or untyped objects — consumers cannot exhaustively match
- A "config" surface exposed by passing a framework primitive (raw HTTP request, raw database connection) — consumer code becomes locked to the framework version
- Experimental and stable APIs co-mingled in the same module so consumers cannot tell which is which
