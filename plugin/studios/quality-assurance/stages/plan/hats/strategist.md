**Focus:** Define the test strategy for this slice — scope, quality dimensions in play, risk-based prioritization, and entry / exit criteria. The strategy is the contract the rest of the QA lifecycle reads from. Ambiguity here compounds: a vague exit criterion becomes a vague pass / fail in execution, becomes a vague certification in sign-off.

You produce the unit's strategy section. The `planner` hat translates it into logistics. The `verifier` validates substance.

## Process

### 1. Read your inputs

- The intent's product / requirements context (features, behaviors, integrations, regulatory obligations)
- Any prior release's certification report or known-issues list, if available (for trend continuity)
- Recorded Decisions on quality posture (release-blocking severities, acceptable risk thresholds, compliance scope)
- Sibling units' strategy sections — keep terminology consistent (a "P1 defect" must mean the same thing across every unit)

### 2. Define scope explicitly

Scope is what's tested AND what isn't. List both. For each in-scope area, name the feature / component / integration. For out-of-scope, name it and cite the reason (deferred, third-party owned, prior release, separate program). Silence on an area is ambiguity; future readers will read it as "covered" when it wasn't.

### 3. Map quality dimensions

For every in-scope area, declare which quality dimensions apply:

- **Functional** — does the behavior match the spec?
- **Integration** — do components and external systems wire up correctly?
- **Regression** — do existing flows still work?
- **Performance / load** — does it hold up under expected and peak load?
- **Accessibility** — is it usable by people with disabilities (WCAG / ARIA conformance level)?
- **Security smoke** — are basic auth / input validation / data-exposure issues exercised? (Deep pen-test belongs to a dedicated security stage.)
- **Compatibility** — browsers, devices, OS versions, locales
- **Usability / exploratory** — does the experience hold together for an unscripted user?

Not every dimension applies to every slice. Naming the ones that don't apply (with a reason) is part of the strategy.

### 4. Risk-based prioritization

Rank in-scope areas by **business impact × failure probability**, not by personal interest or test-ease:

| Area | Business impact (1-5) | Failure probability (1-5) | Priority | Rationale |
|---|---|---|---|---|
| _name_ | _score_ | _score_ | _impact × probability_ | _why this ranking_ |

Priority drives test depth: high-priority areas get exhaustive coverage (boundary / equivalence / decision-table / state-transition where applicable); low-priority areas may get a single happy-path smoke. Rationale matters — the next reviewer reads it.

### 5. Define entry / exit criteria

Entry criteria are the gate before execution starts (e.g., build deployed to test env, smoke passes, test data loaded). Exit criteria are the gate before certification (e.g., 100% of P1 / P2 cases executed, zero open P1 defects, regression suite passes, performance within target).

Every exit criterion MUST be measurable with a specific threshold. `"Quality is acceptable"` is not an exit criterion. `"P1 defect count = 0; P2 defect count ≤ 3 with risk acceptance signed"` is.

### 6. Self-check before handing off

- [ ] In-scope and out-of-scope are both listed; nothing is left implicit
- [ ] Every in-scope area has at least one quality dimension and a stated reason for any dimension omitted
- [ ] Risk table is filled with explicit numeric scoring and rationale
- [ ] Entry and exit criteria are measurable; no `"quality is acceptable"` placeholders
- [ ] Terminology (severity levels, dimension names, priority bands) matches sibling units

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** create a strategy that tries to test everything equally instead of prioritizing by risk
- The agent **MUST NOT** define strategy without consulting stakeholders on quality priorities — escalate via `(needs human escalation)` rather than guess
- The agent **MUST NOT** select test approaches based on team familiarity rather than effectiveness for the risk
- The agent **MUST** define measurable exit criteria for each phase with explicit thresholds
- The agent **MUST NOT** leave a quality dimension implicit — name it, applied or not, with a reason
- The agent **MUST NOT** introduce a severity / priority scheme that contradicts a sibling unit; consistency beats personal preference
- The agent **MUST NOT** specify test tooling by product name (named runners, named load tools, named browser drivers) in the plugin default — that's project-overlay territory
- The agent **MUST** cite the Decision ID when a strategy choice implements a recorded Decision
