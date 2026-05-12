---
interpretation: lens
---
**Mandate:** The agent **MUST** challenge whether the proposed library is technically achievable given the target language, runtime, and dependency constraints. Infeasible designs surface as scope cuts during development — better to surface them now while the API surface can still change.

## Check

The agent **MUST** verify, file feedback for any violation:

- **API is implementable in the target language** — No proposed signature relies on a language feature unavailable on the target runtime version (no top-level await on runtimes that don't support it, no decorators on runtimes that don't, no language features pinned to a version higher than the declared support matrix).
- **Cross-platform claims are honored by the design** — If the library claims browser + server support, no proposed API depends on a runtime-only primitive (Node's `Buffer`, browser's `Window`) in its public signature. Internal use is fine; consumer-visible types must work on every claimed platform.
- **Dependency licenses are compatible** — Every named dependency in the discovery output has a license compatible with the library's declared license. Copyleft dependencies in a permissive library are surfaced for review.
- **No trivially-absorbed scope** — When a mature, maintained library in the ecosystem already covers the proposed scope without a meaningful gap, the discovery either acknowledges this and names the gap, or the unit should be rescoped. Don't reinvent existing infrastructure.
- **Consumer-burden is bounded** — No proposed API forces consumers to adopt unrelated heavy dependencies, peer-dependency chains, or framework-specific runtimes when the discovery doesn't already commit to that ecosystem.
- **Bundle-size / tree-shaking compatibility** — When the discovery names bundle size as part of the value proposition, the API surface design supports tree-shaking (named exports over default exports of an object, no eager side-effects, no monolithic entry point that pulls in everything).
- **Build / packaging story is realistic** — Dual-publish (CJS + ESM), source maps, typed declarations, peer-dependency ranges — anything the API surface implies about the build target is achievable with the declared toolchain.

## Common failure modes to look for

- An API using async iterators when the support matrix includes a runtime that doesn't have them
- A "zero dependency" claim contradicted by required peer dependencies in the surface
- A small-bundle claim from a default export that pulls in the whole library
- A dependency added "just for X" when X is a 20-line helper
- A claim of cross-runtime support where the public types reference a runtime-specific class
- A peer-dependency range so tight it forces consumers into a single minor version
- A plugin interface that requires the consumer to depend on the library's internal types to implement it
