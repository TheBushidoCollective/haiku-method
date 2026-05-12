**Focus:** Design the public API surface — the contract consumers will depend on. This is load-bearing work because once published, changing the public surface breaks every consumer. Decisions here set the semver policy and dictate how painful every future release will be. You produce the artifact downstream stages build against, verify, and publish.

## Process

### 1. Read the researcher's discovery

Before designing anything, internalize the discovery output for this unit — target consumers, ecosystem idioms, competing libraries' API styles. Your job is to design an API that fits the ecosystem and serves the named consumers, not to express a personal aesthetic. If the ecosystem expects builder-style configuration, deviate only with a recorded rationale.

### 2. Enumerate every public symbol

For each exported function, type, constant, error class, and namespace, write:

- The full signature (parameter names, parameter types, return type, generic constraints)
- A one-paragraph rationale: what this symbol exists for, what alternative shapes were considered, why this shape won
- The stability tier: `stable`, `experimental`, `internal-may-leak`. Mixed-stability symbols in the same module are a frequent contract-drift source.

Underscored / internal namespace conventions — anything consumers should not depend on — MUST be named explicitly. Silence is interpreted as "stable" by consumers regardless of intent.

### 3. Specify the error model

The error model is part of the contract, not an implementation detail. For each operation that can fail:

- Name every error variant the operation may emit (typed, not just stringly)
- Classify each variant: recoverable (consumer can react), unrecoverable (program-state issue), informational (warn-and-continue)
- Document whether errors carry structured data (codes, causes, retry-after metadata) or only messages

Adding an error variant after release is a contract break for consumers who exhaustively switch on the type. The error set has to be complete *and* be a deliberate surface.

### 4. Define the semver policy

For each rule, give a concrete example using the surface you just wrote:

- What counts as a **major** change (removed export, renamed parameter, narrowed type, behavior change to existing entry point)
- What counts as a **minor** change (additive only — new export, new optional parameter, new error variant in a non-exhaustive set)
- What counts as a **patch** (no public surface change; internal bug fix only)

Spell out the non-obvious cases: an additive error variant in an exhaustive (sealed) error set is a major change; a behavior change with the same signature is also major; widening an accepted-input type is usually minor; narrowing it is major.

### 5. Document extension points and stability boundaries

If the library exposes plugin / middleware / hook interfaces, the extension interface is itself a contract:

- What hooks fire, in what order, with what arguments and return contract
- Which extension surfaces are stable vs. experimental
- What guarantees the library makes about evolving the extension API independently of the core API

## Format guidance

- Section order: Public Symbols → Error Model → Semver Policy → Extension Points → Stability Tiers → Open Questions
- Code blocks for every signature — use the target language's signature syntax (TypeScript types, Rust signatures, Python type hints, etc.); reviewers can grep these
- Tables for the semver policy (Change Class → Example → Bump)
- Cross-link to the researcher's discovery output for any rationale that cites consumer evidence
- Use peer-dependency / tree-shaking / dual-publish vocabulary generically; do not name specific registry product features

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** design internal implementation details — only what consumers will see
- The agent **MUST NOT** expose framework primitives that leak into consumer code (returning internal classes, library-internal types, runtime-specific handles)
- The agent **MUST** prefer small, composable public APIs over large, monolithic ones — every exported symbol is a maintenance liability
- The agent **MUST** specify what consumers can rely on and what they cannot (underscored names, internal namespace conventions, experimental tier)
- The agent **MUST NOT** design for hypothetical future consumers — design for the users named in discovery
- The agent **MUST** name every exported symbol with full signature and one-paragraph rationale; no `// more types as needed` placeholders
- The agent **MUST** specify the error variants as a closed set with stability classification — adding a typed error later is a contract break
- The agent **MUST** state the semver policy in concrete examples drawn from this library's surface, not generic prose
- The agent **MUST NOT** mix stable and experimental concerns in the same entry point — split them across modules or stability tiers
- The agent **MUST** prefer options-object parameters over positional arguments when more than two parameters are required, to avoid forced major bumps on additive growth
