---
interpretation: lens
---
**Mandate:** The agent **MUST** challenge whether the **problem is solvable at all** within reasonable constraints. Feasibility at this stage is about **strategic viability**, not architectural compatibility. If a fundamental capability the intent depends on has no viable supplier in principle, surface it now — before any design or development effort sinks into a dead-end.

## Check

The agent **MUST** verify each of the following. File feedback for any failure:

- Every named capability need (e.g., "needs OAuth", "needs Slack integration", "needs a managed event bus") has at least one viable supplier in principle — not which specific library, just that the capability is achievable within the project's constraints.
- Success criteria are measurable in user-observable terms — not in implementation terms, but observably distinguishable from "not done". "Users can sign up in under 30 seconds" is measurable; "users have a great experience" is not.
- Highest-impact strategic risks are surfaced: compliance (PCI / HIPAA / SOC 2 / GDPR), single-vendor dependency, regulatory or legal irreversibility, supply-chain / sanctioned-jurisdiction concerns. Tactical risks live downstream.
- Every named capability is compatible with the intent's recorded decisions. Flag any capability that contradicts a Decision (e.g., "needs SOC2-certified managed database" while a Decision rules out paid SaaS).
- The intent's scope is approachable within a single intent. An intent that implies multiple unrelated programs of work needs to be split — surface as a finding, not a rejection.

## Out of scope (do NOT check at this stage)

The agent **MUST NOT** raise findings on:

- Compatibility with specific frameworks, libraries, or codebase conventions — that is the design stage's feasibility check, after the design proposes a specific approach.
- Whether existing modules / files / classes can support the planned usage — requires reading code as a designer.
- A particular technology choice — selection happens in the design stage.
- "The codebase doesn't have X" unless X is a fundamental capability the intent absolutely requires (e.g., "must ship a mobile app, team has zero mobile experience").

## Common failure modes to look for

- A success criterion phrased entirely in implementation language ("the system uses Redis caching") instead of user terms ("the page loads in under 2 seconds")
- A capability need with no viable supplier (sometimes happens with novel regulatory regimes or niche hardware) presented as if obviously achievable
- A strategic risk (single-vendor lock-in, compliance posture) raised in passing in a sub-section instead of being surfaced as a top-level risk
- An intent scope that implies an org-level transformation when the user wanted a feature
- An "open question" that's actually a hard blocker — flagged as if it can be resolved later, when actually it gates the whole intent

## On rejection

If the problem itself is infeasible (success criteria are inherently unmeasurable, a hard capability is missing, an intent contradicts a recorded Decision), file feedback naming the specific blocker. Otherwise, downstream stages own feasibility for their own scope.
