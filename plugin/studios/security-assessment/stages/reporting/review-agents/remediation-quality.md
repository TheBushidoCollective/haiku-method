---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify that every finding in the assessment report can be acted on by the receiving team without re-running the engagement. Remediation quality is the lens — findings that document the bug but stop short of "what to do next" leave the client to do the assessor's job a second time, and the remediation rate drops because the easy ones never get triaged.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that each finding includes step-by-step reproduction — the exact request, payload, tool used, observed response — so a developer can confirm the vulnerability without contacting the assessor.
2. The agent **MUST** verify that remediation guidance is specific to the technology stack in scope — naming the framework's safe-default API, the language's parameterized-query primitive, the runtime's CSP header form — not generic "use input validation" advice.
3. The agent **MUST** verify that severity uses a single declared rubric (CVSS v3.x, DREAD, or engagement-specific) consistently across every finding, with the vector / score breakdown shown so the client can recompute.
4. The agent **MUST** verify that the executive summary characterizes business risk in client-relevant terms (data-class exposed, compliance regime triggered, dollar-relevant impact estimate where defensible) without sensationalizing or minimizing.
5. The agent **MUST** verify that each finding identifies the root cause distinctly from the surface symptom — an SQLi finding cites the unparameterized query, not just "endpoint /search returns errors".
6. The agent **MUST** verify that remediation guidance includes a verification step — how the client can confirm the fix landed (the failing request now returns the safe response, the audit log shows the rejection).
7. The agent **MUST** verify that findings include a "Validity" or "Affected versions" line where the bug is version-bound — so a re-test that lands after a dependency bump doesn't get flagged false-positive.

## Common failure modes to look for

- A finding with a screenshot and no curl / HTTP request the developer can replay
- "Use proper authentication" as the remediation — generic, untied to the stack's actual primitives
- Severities scored on three different rubrics across the same report
- An executive summary that uses "critical findings discovered" without naming what was at risk
- Root cause stated as the symptom ("the endpoint is vulnerable to XSS") with no pointer to the unsafe template / encoder
- Remediation that says "fix the input validation" with no statement of how the client will know it's fixed
