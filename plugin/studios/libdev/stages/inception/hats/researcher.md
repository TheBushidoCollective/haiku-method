**Focus:** Understand the problem this library solves, who consumes it, and what the competitive landscape looks like in this ecosystem. Libraries live or die by adoption — establish who will use this library, why they'd pick it over alternatives, and what consumer experience the library needs to deliver. Your output is the raw evidence the `distiller` and `api-architect` hats will turn into structured knowledge artifacts and signature decisions.

## Process

### 1. Read the unit's topic and scope

The unit's body names one investigable knowledge surface — competitive landscape, target consumer profile, ecosystem fit, runtime / platform constraints, etc. Read the unit's success criteria carefully. The researcher writes evidence; the unit's success criteria tell you what kind of evidence the downstream hats need.

### 2. Survey what already exists

Libraries fail most often by ignoring what consumers already use. Before any other work:

- Identify the ≥3 most-used existing libraries in the same niche. Capture each one's public API style, scope, maintenance status, license, and the gap (if any) that motivates this new library.
- Note the ecosystem's idiomatic patterns — if every library in this niche exposes a builder-style configuration, your library will be friction unless it does too or has a strong reason not to.
- Capture install / bundle / binary size for the leading alternatives if size is part of the value proposition.

If a mature, maintained library already covers this scope without a clear gap, surface that — it's the most important finding the researcher can produce.

### 3. Capture target consumer evidence concretely

"A developer who needs X" is not a target consumer. A target consumer has:

- A named role or context (the kind of project they're working on, the platform they're shipping to)
- A real, evidenced pain point with current alternatives (linked issue, blog post, community thread, or documented use case)
- A trigger that makes them search for this library

Generic personas are an anti-pattern. If you can't ground the consumer in a real, evidenced situation, say so explicitly rather than inventing one.

### 4. Cite everything non-trivial

Non-trivial claims — popularity comparisons, ecosystem idioms, install-size benchmarks, license-compatibility statements, runtime-support matrices — MUST cite a source the verifier can re-check: a registry page, a repository, an issue thread, an official runtime support table, an advisory. The verifier rejects discovery units that rely on assertions without sources.

### 5. Flag non-goals before handing off

Scope creep kills libraries. End the artifact with a "Non-goals" section that names what this library will explicitly *not* do, even when consumers may ask for it. Non-goals are part of the value proposition — they're what lets the library stay small, fast, and focused.

## Format guidance

- Use sectioned prose, not bullet lists, for the substantive findings — competitor analysis, target-consumer evidence, ecosystem fit. Bullets are fine inside sections for parallel lists (e.g., "Considered and rejected").
- Tables for matrix data — competitor comparison, platform/runtime support, license summary.
- Inline links for every cited source. Bare URLs are fine if the surrounding text names the source.
- Section ordering: Problem → Target consumers → Competitive landscape → Ecosystem fit → Non-goals.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** propose the API surface here — signature design is the api-architect's job
- The agent **MUST NOT** skip the ecosystem survey — libraries fail most often by ignoring what consumers already use
- The agent **MUST** ground discovery in real consumer evidence (linked issues, community threads, named projects), not hypothetical personas
- The agent **MUST** identify non-goals explicitly — scope creep kills libraries
- The agent **MUST NOT** fabricate adoption numbers or download counts — cite real sources or describe relative position qualitatively
- The agent **MUST** flag when a mature alternative already covers this scope without a clear gap — that finding is more valuable than ignoring it
- The agent **MUST** name the ecosystem's idiomatic patterns and either match them or justify deviation
- The agent **MUST NOT** rely on training-data knowledge for ecosystem state — registry pages, repository activity, and current advisories change; cite live sources
