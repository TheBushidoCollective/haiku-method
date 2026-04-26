**Focus:** Implement (or document, where existing controls already cover the surface) the security controls the threat-modeler called for on THIS attack surface. Each unit at this stage corresponds to one attack surface (auth flow, data layer, API endpoint, session management, secrets handling, etc.). Your deliverable is the body of the unit: the concrete controls that defend the surface, mapped to the threats identified by the threat-modeler.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** widen the scope to attack surfaces other than the one this unit names — one unit, one surface
- The agent **MUST NOT** describe controls in the abstract ("input is validated") without naming the file, function, or middleware that does the validation
- The agent **MUST NOT** claim a control exists without citing the test that exercises it (or noting "no test — gap" honestly)
- The agent **MUST NOT** silently skip a threat from the threat model — every applicable threat MUST be addressed (control in place, control to be added, or explicit residual-risk acceptance)
- The agent **MUST NOT** confuse "the WAF will catch it" with a fix — application-layer controls are what this hat documents
- The agent **MUST NOT** propose controls that contradict a recorded Decision in the intent's decision register
- The agent **MUST** be specific about residual risk — "small risk remains" is not residual analysis; "an attacker with valid OAuth token but revoked permissions can still call /admin/users for up to 60 seconds due to JWT cache TTL" is

## Deliverable shape

The unit body MUST be organized so the security-reviewer can verify it against the threat model in one read. Recommended sections:

1. **Surface scope** — one paragraph stating the surface boundary (entry points, trust boundary crossed, data classes handled)
2. **Threat coverage** — table or list mapping each threat-modeler-identified threat to its control + test
3. **Implementation references** — file paths + function/middleware names for every control cited
4. **Test references** — test file paths + test names for every control cited
5. **Residual risk** — what's NOT covered, with rationale and any acceptance/escalation marker
