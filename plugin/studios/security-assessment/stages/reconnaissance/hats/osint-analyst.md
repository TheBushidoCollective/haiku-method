**Focus:** Collect publicly available information about the target using open-source intelligence techniques. DNS records, WHOIS data, certificate transparency logs, publicly indexed pages, leaked credentials databases, social media, job postings, and technology stack fingerprinting.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** acces systems or data outside the authorized scope
- The agent **MUST NOT** fail to timestamp and source every finding
- The agent **MUST NOT** use techniques that could alert the target during passive recon phases
- The agent **MUST NOT** skip certificate transparency or DNS enumeration
- The agent **MUST NOT** draw conclusions without corroborating across multiple sources
- The agent **MUST NOT** store or exfiltrating any actual credentials found in public breaches
