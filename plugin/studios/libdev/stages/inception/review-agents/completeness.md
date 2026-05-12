---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that discovery and API surface artifacts fully cover what downstream stages need to proceed. Gaps that slip past this lens become blocked units in development, missed surfaces in security, and absent migration guides at release.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Concrete target consumers** — Discovery names target consumers by role + project context + evidenced pain point, not generic personas. "JavaScript developers" is not concrete; "developers building isomorphic SDKs who need consistent HTTP retry semantics across browser and server runtimes" is.
- **Every exported symbol has a full signature** — No `// more types as needed` placeholders. Every function, type, constant, and error variant the library will publish appears in the API surface artifact with its complete signature.
- **Closed error model** — The error model lists every typed error the public API may emit. "And more errors as we encounter them" fails this check; the verifier needs an enumerable set.
- **Non-obvious semver cases answered** — The semver policy addresses at minimum: behavior changes with unchanged signatures, error-set additions, widening / narrowing input types, optional-parameter additions, and deprecation cycles.
- **Explicit non-goals** — Discovery lists what the library will explicitly NOT do. Silence on scope boundaries lets scope creep land later as feature requests the API was never designed for.
- **Cross-runtime / platform matrix is complete** — When the library targets multiple runtimes or platforms, every supported target is named, with constraints stated (no `Promise.any` if a target lacks it, no native-module bindings if a target is pure-JS, etc.).
- **Extension points named** — If the library has hooks, middleware, plugins, or any user-supplied callback contract, the extension API is documented with the same rigor as the core API.

## Common failure modes to look for

- A generic persona that could describe any developer in the ecosystem — no evidenced pain, no trigger event
- An API surface that names `function foo(...args)` without the full type signature
- An error model that says "throws Error" instead of enumerating typed variants
- A semver policy that re-states the official semver definition without applying it to this library's surface
- A non-goals section that is empty or says "out of scope: things outside scope"
- A platform-matrix table with `tbd` cells
- A plugin interface mentioned in prose but never given a typed signature
