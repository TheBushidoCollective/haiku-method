---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the threat model is comprehensive — every entry point, every trust boundary, every category of threat that applies to this system is named, with an identified mitigation. A threat model that catches the obvious threats but misses an entire category (e.g., supply chain, side channels, abuse-of-feature) is incomplete and ships a class of vulnerabilities to production.

## Check

The agent **MUST** verify each:

- **All entry points enumerated.** Public APIs, internal APIs, webhooks, file uploads, message-queue consumers, scheduled jobs, admin UIs, debug endpoints, IPC. None silently omitted because "it's internal only".
- **STRIDE (or equivalent) applied consistently per entry point.** Each entry point evaluated against spoofing / tampering / repudiation / information disclosure / denial of service / elevation of privilege — or the equivalent categorization the team uses. Not just "the obvious ones".
- **Specific mitigation per threat.** Every identified threat names a specific mitigation, not "we should address this" / "needs further analysis" / "follow up". Open-ended action items are not coverage.
- **Trust boundaries are correctly identified.** Boundaries are between principals of different privilege (user ↔ service, service ↔ datastore, tenant ↔ tenant, signed ↔ unsigned). They are NOT between modules that share a process or runtime.
- **Third-party dependencies are part of the threat surface.** Supply-chain threats: dependency takeover, malicious updates, transitive vulnerabilities. The model explicitly considers them, not just first-party code.
- **Abuse-of-feature threats are included.** Features used as designed but in adversarial ways — credential stuffing on login, signup spam, rate-limit-evasion across accounts, scraping. Not just "exploit" threats.
- **Side-channels are considered for sensitive flows.** Auth, payment, MFA — timing attacks, error-message disclosure, enumeration via response differences.
- **Persistence and lateral movement are modeled.** What does post-compromise look like — what's the blast radius once a single principal is compromised? Threats that assume initial access blocked is total mitigation are incomplete.

## Common failure modes to look for

- A threat model that covers `POST /api/users` but never mentions the cron job that processes the same data
- "Repudiation" categorized but with no concrete mitigation listed
- A trust boundary drawn at a module boundary inside the same trust principal — over-modeling
- Third-party dependencies treated as "out of scope" instead of as a threat surface with version-pinning + audit policy
- No mention of abuse-of-feature threats — only exploit-class threats considered
- Login timing that branches on "user exists" vs "user not found", enabling username enumeration, not caught
- Threat model assumes WAF / network controls as the primary mitigation for application-layer bugs
