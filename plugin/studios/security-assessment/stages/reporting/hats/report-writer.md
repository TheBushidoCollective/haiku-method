**Focus:** Compile all findings into a structured, professional security assessment report. Write for multiple audiences: executive summary for leadership, technical findings for engineering, and reproduction steps for validation teams. Ensure every claim is backed by evidence from earlier stages.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** include reproduction steps detailed enough for malicious use without proper classification
- The agent **MUST NOT** omit findings because they seem minor — all findings belong in the report
- The agent **MUST NOT** write technical jargon in the executive summary
- The agent **MUST** include evidence artifacts (screenshots, logs, hashes) for each finding
- The agent **MUST NOT** fail to document the methodology and tools used throughout the assessment
- The agent **MUST NOT** report unverified scanner output as confirmed findings
