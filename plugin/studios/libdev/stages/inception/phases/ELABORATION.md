# Library Inception Stage — Elaboration

Library inception is a **research / distillation** stage. Its units are knowledge topics covering both **discovery** (problem, target consumers, competitive landscape) and **API shape** (public surface, semver policy, extension points, error model). Unlike application development, the library API *is* the product, so the API shape is part of the inception knowledge set.

## What a unit IS in this stage

One investigable knowledge topic. Examples:
- "Target consumer profile and primary use case"
- "Competitive library landscape with API styles, install size, license, and ecosystem fit"
- "Public API surface — exported types, function signatures, error variants"
- "Semver policy and extension-point design"
- "Error model: error variants, recovery paths, recoverability classification"
- "Cross-runtime / cross-platform support matrix and constraints"

What a unit is **NOT** in this stage:
- ❌ Implementation source code (those belong in `development`)
- ❌ Detailed test plans or test code (those belong in `development`)
- ❌ Release operational runbooks (those belong in `release`)

## What "completion criteria" means here

Knowledge-artifact criteria are about **substance and accountability**, plus — for API-shape units — concrete signature-level decisions.

### Good criteria — substantive and checkable

- "Public API surface §3 names every exported function/type with full signature and a one-paragraph rationale per name"
- "Semver policy §4 specifies what counts as major/minor/patch with concrete examples for the API surface in §3"
- "Error model §5 enumerates ≥3 distinct error variants with recovery path or `(unrecoverable; document)` annotation"
- "Competitive landscape §2 names ≥3 alternatives with API style, ecosystem position, and the gap this library addresses"
- "Open questions section: each entry has a proposed default for veto-style approval OR `(needs human escalation)`"

### Bad criteria — vague or wrong-stage language

- ❌ "API is good" (no check; "good" by what measure?)
- ❌ "Test coverage is at least 80%" (build-stage language; no implementation exists yet)
- ❌ "Each unit has 3-5 verify-commands" (build-stage language)
- ❌ "Library is performant" (no implementation; can't measure)

## Anti-patterns

- **Drafting implementation in inception.** API surfaces are signatures + rationales, not function bodies. Stop at the signature.
- **Specifying tests during inception.** Tests follow implementation. Inception specifies what behaviors must exist; development authors test specs against those behaviors.
- **Single-document syndrome.** One giant "library design doc" defeats per-topic units; the API surface, semver policy, and error model should be separate units even if they cross-reference.

> Note on the universal FSM_CONTRACTS_ELABORATE_BLOCK: the orchestrator currently injects build-class rules (`depends_on:` cycles, executable `quality_gates:`, criteria-with-verify-commands) into every elaborate dispatch. Those rules are correct for build-class stages but do not apply to this stage's knowledge-artifact units. Treat the build-class rules as defaults the framework hasn't yet split — author your units to the substance/accountability shape above, not to executable verify-commands. (Architecture §7 known issue tracking the split.)
