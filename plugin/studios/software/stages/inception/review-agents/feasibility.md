---
interpretation: lens
---
**Mandate:** The agent **MUST** challenge whether the **problem is solvable at all** within reasonable constraints. Feasibility at this stage is about **strategic viability**, not architectural compatibility.

**Check (in scope):**
- The agent **MUST** verify that the named capability needs (e.g., "needs OAuth", "needs Slack integration") have at least one viable supplier in principle — not which library, just that the capability is achievable
- The agent **MUST** verify that the success criteria, as written, are measurable in user-observable terms (not impossible to evaluate)
- The agent **MUST** verify that the highest-impact strategic risks are surfaced (compliance, dependency-on-a-single-vendor, regulatory, irreversibility), not just obvious tactical ones
- The agent **MUST** flag any capability need that is fundamentally incompatible with a Decision already recorded in the intent's decision register (e.g., "needs SOC2-certified database" while a Decision rules out paid SaaS)

**Out of scope (do NOT check at this stage):**
- The agent **MUST NOT** check compatibility with specific frameworks, libraries, or codebase conventions — that's the **design stage's** feasibility check, after the design proposes a specific approach
- The agent **MUST NOT** check whether existing modules / files / classes can support the planned usage — that requires reading code as a designer, not an inception reviewer
- The agent **MUST NOT** demand that any unit specify a particular technology choice; technology selection happens in the design stage
- The agent **MUST NOT** raise findings that say "the codebase doesn't have X" unless X is a fundamental capability that the intent absolutely requires (e.g., "we need to ship a mobile app but have zero mobile expertise")

**On rejection:** If the problem itself is infeasible (e.g., the success criteria are inherently unmeasurable, or a capability need contradicts a hard Decision), name the specific blocker. Otherwise, downstream stages own feasibility for their own scope.
