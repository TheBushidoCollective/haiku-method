---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the library's public API is resistant to unsafe use by consumers. Libraries that are easy to misuse are effectively insecure regardless of the internal code quality. The threat model assumes consumers will pass user-controlled input where the API expected developer-controlled input — designs that don't survive that assumption shift blame to the library when the inevitable happens.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Unsafe defaults are flagged** — Default option values that invite misuse (TLS verification off by default, untrusted-input parsers in strict mode off by default, recursive parsing without depth limits) are either fixed or surface a loud opt-in requirement. "Insecure by default" defaults are the highest-priority finding.
- **Injection-prone entry points carry explicit guidance** — Functions that accept paths, URLs, queries, templates, shell-like strings, or serialized data have documented safe-usage patterns. The documentation answers: what counts as trusted input, what counts as untrusted, what sanitization is the consumer's responsibility, what's the library's.
- **No silent trust of unstructured input** — APIs that accept generic strings / records / objects do not silently treat them as trusted. Validation either happens in the library or the contract is explicit that validation is the consumer's responsibility, with concrete guidance.
- **Errors and serialization don't leak sensitive data** — Error messages, error structures, log lines, and serialized output (toString, JSON serialization equivalents) do not include credentials, tokens, raw user input, or internal-state fingerprints that aid an attacker.
- **No accidental privilege amplification** — A library that runs in a privileged context (build tooling, dev tooling, server tooling) does not let consumer-supplied input escalate beyond what the consumer's caller intended.
- **Type signatures encode safety where possible** — When the language supports it, branded / nominal types (`SafeHTML` vs `string`, `UntrustedInput<T>` vs `T`) push misuse into compile-time errors. Designs that could enforce safety via types but rely on prose instead are flagged.
- **Concurrency / re-entrancy hazards documented** — APIs that hold state across calls, cache aggressively, or maintain singletons name their concurrency contract and the consequences of violating it.

## Common failure modes to look for

- A path-accepting function that doesn't resolve traversal — `..` segments reach outside the intended root
- A URL-accepting function that doesn't enforce scheme allowlists — file://, javascript:, and similar slip through
- A template-rendering function that auto-escapes by default but exposes a "raw" variant without making the unsafety obvious
- An options object that accepts a free-form record without a typed schema — every property becomes an undocumented surface
- An error class whose message embeds raw user input, then gets logged downstream
- A "logger" that serializes the entire request, including auth headers
- A parser with no depth / size / repetition limit — algorithmic complexity attack
- A function returning `Promise<any>` from a known-typed source — pushes the contract onto consumer inference, which fails silently when wrong
- A function whose safety depends on the consumer NOT calling it from a callback / event loop / async context, with no documented contract
