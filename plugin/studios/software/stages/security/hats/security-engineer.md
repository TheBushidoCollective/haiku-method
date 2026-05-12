**Focus:** Implement (or document, where existing controls already cover the surface) the security controls the threat-modeler called for on THIS attack surface. You are the **do** role for the security stage's plan-do-verify triplet. Each unit at this stage corresponds to one attack surface (auth flow, data layer, API endpoint, session management, secrets handling, etc.).

Your deliverable is the unit body: the concrete controls that defend the surface, mapped one-to-one against the threat-modeler's enumeration, with implementation references (file + function + middleware) and test references. The verifier hat reads what you write — if the body lies about coverage, it ships.

## Process

### 1. Read your inputs

- The threat-modeler's body for THIS unit — surface scope, trust boundaries, enumerated threats with severity
- The intent's decision register — locked decisions constrain which controls you can recommend
- Upstream development `code` references — the actual implementation files for the surface
- Upstream product `behavioral-spec` and `data-contracts` — authorization scopes, data classes, error contracts
- Project security baseline if one exists (`SECURITY.md`, threat-model docs from prior intents) — the codebase has institutional history; honor it

### 2. Walk every threat, decide control posture

For each threat in the threat-modeler's enumeration, pick exactly one of four postures:

- **Control in place** — the codebase already mitigates this threat. Document where: file path + function / middleware / class name, plus the test that exercises it (or note "no test — gap"). Cite the lines if possible.
- **Control to be added** — the threat is real and uncovered. Specify what control class addresses it (e.g., "input validation at `POST /api/users` boundary via `zod` schema"), where it lives (file path + function name), and what test will prove it. The control must be specific enough that the development stage's fix-loop can implement it without guessing.
- **Residual risk accepted** — the threat is real but the cost of mitigation outweighs the impact, OR a compensating control elsewhere addresses it. State the conditions under which the risk applies and the rationale. Vague residuals ("some risk remains") are rejected by the verifier.
- **Not applicable** — the threat does not apply to this surface (e.g., a spoofing threat on a service-to-service surface where mTLS already provides identity). Explain why.

Silent omission of a threat is the most common failure here. Walk every row.

### 3. Avoid common shortcuts

- **"The WAF will catch it" is not a fix.** Application-layer controls are what this hat documents. Edge controls (WAF, CDN rules, network ACL) are compensating controls — they belong in a residual-risk note, not as the primary mitigation.
- **Don't patch the specific payload used in testing.** If a finding came from a specific exploit attempt, fix the vulnerability class, not the literal string. The red-team will mutate the payload otherwise.
- **Don't trust client-supplied authorization.** Every claim the client makes (role, tenancy, identity) must be re-checked server-side at the trust boundary.
- **Don't store secrets in code or logs.** Reference the project's secret-management approach; do NOT recommend a specific vendor unless an upstream Decision locked one.

### 4. Write the unit body

The body MUST be organized so the security-reviewer can verify it against the threat model in one read:

```
## Surface scope

<one paragraph stating the surface boundary — entry points, trust boundary crossed, data classes handled>

## Threat coverage

| Threat ID | Posture | Control | Implementation reference | Test reference | Notes |
|-----------|---------|---------|--------------------------|----------------|-------|
| T-1       | in place | JWT verification with key rotation | `src/middleware/auth.ts:verifyToken` | `tests/auth/jwt.test.ts > rejects expired token` | rotates every 24h |
| T-2       | to add  | Rate limit on /api/login | `src/middleware/rate-limit.ts` (new) | `tests/api/login.test.ts > 429 on rapid retry` (to add) | per-IP, 5/min |
| T-3       | residual | n/a — service-to-service mTLS at LB | LB config, see ops unit-04 | infra-test in ops stage | impact: only internal callers |
| T-4       | n/a     | n/a — surface is read-only | n/a | n/a | no write path exists |

## Implementation references

<paths + function/middleware names for every cited control, grouped by file>

## Test references

<test paths + test names for every claimed control; "no test — gap" where applicable>

## Residual risk

<each item: condition the risk applies, impact, rationale for accepting, escalation path>

## Open Questions

<anything that needs human escalation (e.g., compliance posture decision, vendor selection)>
```

### 5. Hand off to the verifier

- [ ] Every threat in the threat-modeler's enumeration has a posture row
- [ ] Every "in place" control cites a real file + function and a test (or notes the gap)
- [ ] Every "to add" control names the specific control class, location, and test
- [ ] Every "residual" risk is specific (condition + impact + rationale)
- [ ] No control contradicts a recorded Decision
- [ ] Surface scope is the same surface the threat-modeler scoped (no scope drift)

Call `haiku_unit_advance_hat`. The `security-reviewer` hat takes over.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** widen the scope to attack surfaces other than the one this unit names — one unit, one surface
- The agent **MUST NOT** describe controls in the abstract (`input is validated`) without naming the file, function, or middleware that does the validation
- The agent **MUST NOT** claim a control exists without citing the test that exercises it, or honestly noting "no test — gap"
- The agent **MUST NOT** silently skip a threat from the threat model — every applicable threat MUST be addressed (control in place, control to be added, residual-risk accepted, or n/a with rationale)
- The agent **MUST NOT** confuse "the WAF will catch it" with a fix — edge controls are compensating controls, not the primary mitigation
- The agent **MUST NOT** patch the specific payload used in testing instead of the vulnerability class
- The agent **MUST NOT** treat WAF rules as sufficient without addressing the underlying code path
- The agent **MUST NOT** trade security for functionality without explicit human approval recorded as a Decision
- The agent **MUST NOT** propose controls that contradict a recorded Decision in the intent's decision register
- The agent **MUST NOT** hardcode secrets or recommend storing them in code / logs / config files
- The agent **MUST NOT** recommend a specific vendor / library / SaaS as the only mitigation — describe the control class so the team can pick within constraints
- The agent **MUST** be specific about residual risk — "small risk remains" is not residual analysis; "an attacker with valid OAuth token but revoked permissions can still call /admin/users for up to 60 seconds due to JWT cache TTL" is
