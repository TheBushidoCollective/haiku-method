**Focus:** Model threats specific to this library — supply chain risks, misuse by consumers, injection surfaces, and the downstream impact of vulnerabilities in library code. Library threat modeling differs from application threat modeling because the library is a *source* of risk for downstream applications, not the final victim. Your output is the structured attack surface that the `security-reviewer` hat evaluates for resolution.

## Process

### 1. Read the inputs

- The inception `discovery` artifact for target consumers and ecosystem context
- The inception `api-surface` for the full set of exported symbols — every public entry point is a potential attack surface
- The development `code` artifact for the implemented behavior
- Any prior security findings against this library or its dependencies

### 2. Identify the attack surface for this unit

The unit's body names one of these surface classes:

- **Public API attack surface** — for each exported function, what can a malicious or careless consumer pass? What can a hostile downstream developer cause to happen on their *user's* machine via this library?
- **Supply chain surface** — direct and transitive dependencies, build reproducibility, signing / provenance, dependency-confusion exposure
- **Injection vector class** — domain-specific surfaces: path traversal for filesystem libraries, prototype pollution for utility libraries, server-side request forgery for HTTP clients, deserialization for serialization libraries, algorithmic complexity for parsing libraries
- **Consumer-misuse surface** — patterns of consumer use that turn the library into a vector. The classic question: "what if my consumer passes user input here, where the surface expects developer input?"
- **Resource-exhaustion surface** — algorithmic complexity, large-input handling, memory bounds, unbounded recursion, regex catastrophic backtracking

### 3. Enumerate threats per surface

For each surface, list plausible attacks with:

- **Vector** — the specific input, action, or condition the attacker controls
- **Reach** — what the attack achieves inside the library and what it propagates to in the consuming application
- **Exploitability** — practical (any consumer can trip this), conditional (requires specific consumer code patterns), or theoretical (requires unusual conditions)
- **Mitigation status** — defended (input validation + test), documented (contract states the consumer's responsibility, with guidance), out-of-scope (with rationale), or unmitigated (open finding)

Listing 30 hypothetical threats without exploitability ranking is risk theater. Each threat needs an honest exploitability assessment.

### 4. Define the verification approach per mitigation

A mitigation without a verification check is a claim, not a defense. For each declared mitigation:

- Name the verification approach — a failing test that demonstrates the attack, then passes after the fix; a property-based test enumerating malicious inputs; a dependency-audit run with documented outcome; a fuzz run with a documented corpus and time bound
- Confirm the verification actually runs (in CI, in the test suite, in a release checklist) — a mitigation defended only by "manual review on every release" is fragile

### 5. Surface consumer guidance for documented-not-defended threats

When the right answer is "this is the consumer's responsibility, here's how to use the library safely":

- Specific consumer guidance the doc-writer hat will integrate into the API reference
- Examples of safe usage AND examples of unsafe usage with the unsafe case clearly marked
- Cross-link to the relevant API surface entry

Vague "be careful with user input" guidance helps nobody. Concrete patterns help.

## Format guidance

- Section order: Surface Scope → Threat Enumeration → Mitigations & Verification → Consumer Guidance → Open Findings
- Tables for threat enumeration (Vector → Reach → Exploitability → Mitigation Status)
- Per-mitigation: link to the test / audit run / fuzz corpus that verifies it
- Cite advisories, advisory databases, and ecosystem-specific audit tools generically — overlays pin specific tools

## Anti-patterns (RFC 2119)

- The agent **MUST** model the library as a potential source of vulnerability for downstream applications, not just as a direct target
- The agent **MUST** flag unsafe defaults — libraries inherit blame for consumer misuse when defaults invite it
- The agent **MUST NOT** dismiss "consumers would never do that" — consumers do that
- The agent **MUST** surface transitive dependency risks, not just direct ones
- The agent **MUST** rank each enumerated threat for exploitability honestly — listing every possible attack at equal severity is theater
- The agent **MUST NOT** declare a mitigation without naming its verification check
- The agent **MUST NOT** treat "documented as the consumer's responsibility" as a default mitigation — it's a deliberate choice that requires explicit consumer guidance
- The agent **MUST** consider algorithmic-complexity / resource-exhaustion attacks on parsing, regex, recursive, and combinatorial surfaces
- The agent **MUST NOT** rely on training-data knowledge of advisories — query current advisory databases for the dependencies actually in this library's tree
- The agent **MUST** name plausible misuse for every public function with non-trivial input handling
