**Focus:** Identify every regulatory framework that applies to this product in its declared target markets, document the applicability evidence (product class, intended use, deployment region), and surface the cost / lead-time impact of certification so downstream stages can plan against it. Compliance cannot be retrofitted — get the framework set right at this stage, or pay an order of magnitude more to redesign and re-cert later.

## Process

### 1. Read your inputs

- The inception artifacts — target markets, declared product class, intended use, distribution channels
- The systems-engineer's functional and safety requirement draft for this unit — frameworks depend on what the product actually does
- The decision register, for any product-class or market decisions already recorded
- Sibling requirement units, for any framework decisions already made

### 2. Identify applicable frameworks by category

Enumerate frameworks across categories generically; pick the specific frameworks based on the declared product class + target markets:

- **Radio / emissions / EMC** — emissions and immunity frameworks for the regions targeted; intentional-radiator frameworks for any RF product
- **Electrical safety** — frameworks governing user safety for mains-connected, battery-powered, or industrial products; required isolation gaps, fault behaviour, and labelling
- **Restricted substances / environmental** — restricted-substance declarations, recyclability, packaging frameworks
- **Industry-specific** — medical-device frameworks, automotive frameworks, industrial machinery, aviation, marine, food-contact — pick the ones the product class triggers
- **Wireless / network protocol** — protocol-specific certifications where applicable
- **Cybersecurity** — connected-product cybersecurity frameworks where targeted markets require them

Name the framework, name its scope (which category of product it governs), and name why this product is in scope.

### 3. Document applicability evidence

For each framework named:

- The product class assertion (consumer / industrial / medical / automotive / etc.) backing applicability
- The intended use that triggers (or exempts) the framework
- The deployment region that brings the framework into scope
- The boundary conditions where the framework would not apply (e.g., "if shipped without the radio module, this framework does not apply")

Applicability evidence is what the cert lab will read first. Vague applicability is what makes lab submissions bounce back.

### 4. Estimate cost and lead-time impact

For downstream planning, name for each framework:

- Test-lab fee category — order of magnitude only at the inception → requirements boundary; precise estimates come during validation planning
- Lead time category (weeks to months) for typical cert submission and result return
- Ongoing surveillance cost category (one-time vs annual vs periodic)
- Any design constraints the framework forces (mandatory isolation gaps, mandatory labelling, mandatory user-facing disclosures, mandatory packaging)

These categories feed into the cost envelope and the manufacturing-readiness gate. Don't fabricate concrete numbers — categories with sources downstream is the contract.

### 5. Hand off

- [ ] Every target market named in inception has its frameworks identified
- [ ] Every framework has applicability evidence (product class + intended use + region)
- [ ] Standards-driven design constraints are surfaced for the `design` stage to satisfy
- [ ] Cost and lead-time categories are documented for downstream planning
- [ ] Any open framework question is defaulted to `(needs human escalation)` — agents do not have authority to defer regulatory framework decisions

## Anti-patterns (RFC 2119)

- The agent **MUST** identify every framework up front; iterative regulatory discovery is a major source of late-stage churn
- The agent **MUST** flag any hazard that requires a specific firmware or design mitigation (overcurrent, thermal cutoff, ESD survivability) so design and firmware can plan against it
- The agent **MUST** document cost and lead-time categories so the cost envelope and schedule reflect cert reality
- The agent **MUST NOT** defer compliance work to the validation stage — validation tests *against* the framework identified here; it doesn't pick the framework
- The agent **MUST NOT** treat regulatory open questions as defaultable; they MUST escalate
- The agent **MUST NOT** prescribe a specific cert lab or framework version in the plugin default — those choices belong in the project overlay
- The agent **MUST** match the framework set to the product class and intended use declared in inception; a "consumer electronics" framework set on a "medical device" is a serious finding
