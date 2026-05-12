**Focus:** Sequence the campaign activation across channels. For each launch step the unit owns, declare preconditions (what must be true before this step fires), the action itself (one unambiguous procedure), the post-condition check (how to confirm it worked), and the rollback path. The channel-coordinator hat executes; you write the operational contract that makes execution safe.

## Process

### 1. Read your inputs before sequencing

- Read `content/assets` — the approved content this launch step distributes
- Read the strategy's channel mix and goal targets — those constrain sequence and timing
- Read sibling launch units so dependencies between steps are explicit, not implicit
- Note the intent's environmental context (staging vs. production, feature flags, audience segment routing)

### 2. Define the step's preconditions

A precondition is anything that MUST be true before the action runs. Be explicit; silence is how launches break:

- **Asset readiness** — the specific asset(s) approved, versioned, and locatable
- **Infrastructure readiness** — tracking pixels installed, attribution tags wired, redirect rules in place, DNS / cache state confirmed
- **Channel readiness** — channel account in the right state (paid balance sufficient, email reputation warm, social account verified, etc., named generically — specific platforms in the project overlay)
- **Audience readiness** — segments exported / synced where required, suppression lists applied, frequency caps configured
- **Approvals captured** — the human approvals required for this step, by name where the intent specifies

If a precondition is conditional (e.g., "if feature flag X is on, also …"), state the conditional explicitly.

### 3. Define the action

One step, one action. If the unit contains "publish landing page AND activate paid traffic AND send launch email", that's three units, not one — split it. The action section must capture:

- **What is done** — verb-led, specific ("activate paid placement category Y for audience segment Z with creative variant A")
- **Where it's done** — channel category and the named owned-by-team responsible for executing it
- **When it's done** — the time window or the trigger event (e.g., "on confirmation that landing page is live and tracking firing")
- **Idempotency note** — whether re-running the action is safe; if not, name the guard

### 4. Define the post-condition check

A post-condition without a verifiable check is a wish. The check section must capture:

- **What signal confirms success** — a metric to read, a query to run, a page to load, a tracking ping to verify, with the expected value or range
- **Where the signal lives** — channel reporting category, owned analytics surface, third-party tag inspector — referenced generically; specific tools in the project overlay
- **How long to wait** — the time window in which the signal is expected to appear; signals not appearing within the window trigger the rollback evaluation
- **Negative-case signal** — what would tell you the step failed silently (e.g., zero impressions in 30 minutes on a channel that should be delivering)

### 5. Define the rollback / recovery path

For every step whose action is NOT cleanly idempotent, declare a rollback:

- **Rollback action** — the specific procedure to revert (pause placement, unpublish page, recall send, restore prior config)
- **Rollback trigger criteria** — what observable signal triggers it (CTR below threshold, error rate above threshold, audience complaints, content issue surfaced)
- **Owner during rollback** — who has the authority to call it

If the action genuinely has no rollback (e.g., an email send), state "no rollback — forward-fix only" with the rationale and what "forward-fix" means (correction send, suppression, public note, etc.). Silent absence of rollback is unacceptable for any non-idempotent step.

### 6. Self-check before handing off

- [ ] Preconditions, action, post-condition check, and rollback are each their own section in the unit body
- [ ] Each precondition is verifiable (someone can confirm or deny it before the step runs)
- [ ] The action is a single operation, not a sequence
- [ ] The post-condition check names a specific signal AND its expected value AND the time window AND the negative-case signal
- [ ] Rollback is named OR "no rollback — forward-fix only" is stated with rationale
- [ ] Dependencies on other units are explicit, not assumed
- [ ] Open Questions section flags anything unresolved (e.g., a tracking parameter not yet decided)

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** launch assets without verifying tracking and attribution preconditions
- The agent **MUST NOT** ignore channel dependencies that create broken user journeys (paid traffic before the landing page is live, email before the link works, etc.)
- The agent **MUST NOT** set arbitrary launch dates without accounting for approval workflows and dependency timing
- The agent **MUST** declare a rollback path for any non-idempotent action, OR state "no rollback — forward-fix only" with rationale
- The agent **MUST NOT** treat launch as a single event rather than a sequenced activation
- The agent **MUST NOT** combine multiple actions into one step — one step, one action
- The agent **MUST NOT** write vague post-condition checks ("verify by eye that things look good") — name the signal, the source, the window, and the negative case
- The agent **MUST** reference channel categories generically (paid, owned, earned, direct); specific platforms live in the project overlay
- The agent **MUST** name explicit dependencies between this step and others; implicit ordering is how launches break
- The agent **MUST NOT** assume approval is captured; name the approval required for this step
