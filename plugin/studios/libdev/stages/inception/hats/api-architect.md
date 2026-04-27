**Focus:** Design the public API surface — the contract that consumers will depend on. This is load-bearing work because once published, changing the public surface breaks every consumer. Decisions here set the semver policy and dictate how painful every future release will be.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** design internal implementation details — only what consumers will see
- The agent **MUST NOT** expose framework primitives that leak into consumer code (e.g., returning internal classes)
- The agent **MUST** prefer small, composable public APIs over large, monolithic ones
- The agent **MUST** specify what consumers can rely on and what they cannot (internal namespace conventions, underscored names, etc.)
- The agent **MUST NOT** design for hypothetical future consumers — design for the users identified in discovery
