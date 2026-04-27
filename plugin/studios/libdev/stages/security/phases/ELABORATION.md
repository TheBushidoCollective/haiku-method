# Security Stage — Elaboration

Security is an **adversarial** stage. Its units are attack surfaces — public API attack surface, supply-chain surface, and consumer-misuse surface. Each unit specifies the surface, threat actors, attack vectors, mitigations, and verification approach.

## What a unit IS in this stage

One attack surface or threat boundary. Examples:

- "Public API attack surface — what can a malicious consumer pass to each exported function"
- "Supply chain — transitive dependency CVE scan, build reproducibility, signed releases"
- "Injection vector class — domain-specific (path traversal for fs libs, prototype pollution for JS utility libs, SSRF for HTTP clients, ReDoS for regex-heavy libs)"
- "Consumer-misuse surface — what does this library do if a downstream app misuses it (e.g., passes user input where developer input is expected)"
- "Resource-exhaustion surface — algorithmic complexity, large-input handling, memory bounds"

What a unit is **NOT** in this stage:

- ❌ A new feature (those belong in `development`)
- ❌ A general code-quality concern (that's `development` review-class work)
- ❌ A user-deployment / runtime concern (libraries don't have runtime ops; that's an application concern downstream)

## What "completion criteria" means here

Adversarial-stage criteria specify **threats considered, mitigations declared, and verification approach for each mitigation**. Pass means the surface is named, exercised by a documented attack chain or analysis, and the mitigations have a verifiable check.

### Good criteria — concrete and adversarial

- "API surface unit lists every exported function, names ≥1 plausible misuse per function, and declares whether the misuse is acceptable (documented contract), defended (input validation + test), or out-of-scope (with rationale)"
- "Supply chain unit lists current dependency tree, runs `npm audit` / `pip-audit` / `cargo audit` and records HIGH/CRITICAL findings, names a remediation plan for each non-deferred finding"
- "Injection vector unit demonstrates the attack with a failing test, then ships the fix and shows the test passing"
- "ReDoS / algorithmic complexity unit names the worst-case input class and demonstrates bounded behavior under a 10s timeout"

### Bad criteria — vague or non-adversarial

- ❌ "Library is secure" (not a check)
- ❌ "No vulnerabilities found" (no methodology cited)
- ❌ "Code review passed" — wrong stage; that's `development` reviewer

## How verification happens

Security artifacts are validated by the verify-class hat declared in `STAGE.md` (currently `security-reviewer`). Per architecture §3.5, adversarial hats are exempt from the body-only rule, but a stage that is ENTIRELY adversarial (no plan-do-verify front loop) is an architecture violation worth flagging in a separate restructure proposal.

The verifier checks **threats considered against the surface scope, mitigations declared with verification approach, decision-register accountability** — body-content checks. Frontmatter is not interpreted; workflow engine owns DAG and lifecycle.

## Anti-patterns

- **Adversarial without a verify gate.** A stage with two adversarial-do hats and no verifier produces findings that nobody validated. The chain needs a terminal hat that decides "this surface is closed enough to ship".
- **Dependency-only security.** Running `npm audit` once and calling the stage done misses the public-API misuse surface — which is the harder, more library-specific work.
- **Threats without exploitability.** Listing 30 hypothetical attacks without ranking exploitability inflates risk theater. Each named attack should have an exploitability assessment + mitigation status.
- **Skipping the consumer-misuse lens.** Library security is unique because the *consumer* is a potential attack source on their own users. "What if my consumer passes user input here" is the question that distinguishes library threat models from application threat models.
