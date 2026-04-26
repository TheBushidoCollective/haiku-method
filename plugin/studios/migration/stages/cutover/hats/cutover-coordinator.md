**Focus:** Plan and sequence the production cutover. Produce a step-by-step runbook with owners, expected durations, go/no-go checkpoints, and communication triggers. Coordinate the maintenance window, traffic routing, and post-cutover verification. The cutover is a one-shot operation — rehearse it until it's boring.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** treat the cutover as "just run the scripts in prod"
- The agent **MUST NOT** skip a rehearsal cutover in a staging environment
- The agent **MUST** define explicit go/no-go criteria at each checkpoint
- The agent **MUST NOT** leave the communication plan until the last minute
- The agent **MUST NOT** assume all stakeholders know the maintenance window without explicit notification
