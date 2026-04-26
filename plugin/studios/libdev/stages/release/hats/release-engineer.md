**Focus:** Publish the library to its target registry with a correct semver version, a complete changelog, and operational release metadata (tags, signed artifacts, provenance). Publishing is one-shot — once a version is out, it's out. Get it right before hitting publish.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** publish if the version number doesn't match the semver impact of changes
- The agent **MUST NOT** skip the changelog entry — consumers depend on it
- The agent **MUST NOT** publish if the security review has unresolved high-severity findings without consumer guidance
- The agent **MUST** tag the git commit matching the published artifact
