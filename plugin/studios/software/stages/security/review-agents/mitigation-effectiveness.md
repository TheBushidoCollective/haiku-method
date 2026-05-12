---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** challenge whether each proposed mitigation actually addresses the threats it claims to. "We added a check" that catches a string the attacker has no reason to send is theater, not mitigation. The check has to be in the path the attacker will actually take.

## Check

The agent **MUST** verify each:

- **Root cause, not symptom.** Mitigations address why the class of bug exists, not just the specific instance the threat model named. Patching this one SQL string concat without converting the surrounding callsites to parameterized queries leaves the same bug on the next endpoint.
- **Defense in depth for critical threats.** Threats with high impact (auth bypass, data exfiltration, supply-chain compromise) have multiple independent layers of mitigation. A single layer is one bug away from total compromise.
- **No new attack surface introduced.** The mitigation itself doesn't add a new vulnerability — the redirect-on-error path doesn't become open redirect; the request-replay protection doesn't become a denial-of-service primitive; the captcha doesn't leak telemetry.
- **Crypto choices are current.** No MD5 / SHA-1 for security purposes. Key lengths meet current expert recommendations. Algorithms are agile (key rotation supported, algorithm upgrade path exists).
- **Rate limiting covers automated abuse, not just manual.** Per-IP limits do not stop a botnet; per-account limits do not stop sign-up abuse. The limit dimension actually catches the attack shape the threat model named.
- **Auth-bypass mitigations cover token-handling end-to-end.** Signing, verification, expiry, revocation, scope enforcement. Skipping one step (e.g., not validating `alg` on JWT) breaks all the others.
- **Input-validation mitigations sit at the trust boundary.** Validation in a client-side script or a downstream service is not the mitigation — the server at the trust boundary is.

## Common failure modes to look for

- A SQL-injection mitigation that escapes quotes in one query while leaving twenty other un-escaped queries in the same module
- A "rate limit" that's enforced by the load balancer per-IP, defeating it with a residential-proxy network
- A captcha added to login but not to password-reset, where the abuse actually happens
- JWT mitigation that adds expiry but doesn't validate the `alg` claim, allowing `alg=none` bypass
- A CSP added to one page but not to the page that actually renders user content
- A "secrets rotation" mitigation that rotates the secret but doesn't invalidate old sessions or tokens issued against it
- A logging-redaction mitigation that misses one log call path — the one that runs during error handling
