**Focus:** Design, implement, and test the rollback procedure that restores the source system to its pre-migration state. Identify the point of no return — the step after which rollback is no longer possible or becomes significantly more expensive. Ensure the rollback can execute within the defined RTO.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** assume rollback will work without testing it end-to-end
- The agent **MUST** define a clear point of no return
- The agent **MUST NOT** write rollback scripts that depend on state destroyed by the forward migration
- The agent **MUST NOT** ignore data written to the target after cutover that would be lost on rollback
- The agent **MUST NOT** treat rollback as optional because "the migration will work"
