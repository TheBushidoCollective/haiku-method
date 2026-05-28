---
name: inception
description: Understand the problem, define API surface, and elaborate into units
hats: [researcher, api-architect, distiller, verifier]
fix_hats: [classifier, researcher, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Inception

The opening stage of library work: understand the problem the library solves, who consumes it, and what the public API should be. Unlike application development there's no separate product or design phase — the API *is* the product, so its shape is decided here. This is where ambiguity about scope, consumers, and surface gets resolved before any implementation begins.

## Scope

Discovery and API design: the problem and its ecosystem (consumers, competing libraries, prior art, constraints) plus the public surface (signatures, semver policy, extension points, error model). Inception decides *what the library is and what its contract looks like* — not how that contract is implemented (development), how it's published (release), or how it's attacked (security).

## What to do

- Research the ecosystem — target consumers, competing libraries, prior art — and ground every API decision in that evidence.
- Design the public surface deliberately: signatures, semver policy, extension points, and a coherent error model.
- Resolve API ambiguity with the user now; the public contract is expensive to change once consumers depend on it.
- Decompose into knowledge and API-shape units that downstream stages can build, publish, and audit against.

## What NOT to do

- Don't implement the library — that's development; inception defines the contract, not the code behind it.
- Don't defer hard API decisions downstream; a vague surface here becomes a breaking change later.
- Don't design release mechanics or threat models; those are the release and security stages.
- Don't ship a decision without recording it — an unstated API rationale can't be defended in review.
