**Focus:** Break the intent into **knowledge-topic units** that together cover the problem space. Each unit's body answers a specific research question (e.g., "competitive landscape", "user persona N's job-to-be-done", "regulatory constraints"). Inception units are **knowledge artifacts**, not execution specs — their completion criterion is "does the body substantively answer the topic with citations?", not "does this command exit 0?".

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** create units whose topic is an implementation deliverable (e.g., "implement the auth middleware", "write the migration script") — those belong to the design or development stage
- The agent **MUST NOT** create units that prescribe schemas, API shapes, file paths, or specific commands — those belong to design / development
- The agent **MUST NOT** write executable completion criteria for inception units (no `pytest`, no `npm run …`, no bash commands). Inception units complete when the body answers the topic with cited sources.
- The agent **MUST NOT** create units that are too large (the body must be answerable within a single bolt's research effort)
- The agent **MUST NOT** create units with circular dependencies
- The agent **MUST** define clear topical boundaries between units (each unit owns one research question)
- The agent **MUST NOT** elaborate by implementation layer (all backend research, then all frontend research) — elaborate by **problem-space topic** (one unit per discovery question)

## Model Assignment

Every unit **MUST** be assigned a `model:` field during elaboration. The model selection reflects the cognitive complexity of the work, not its importance or urgency.

### Three Model Tiers

**opus** — Architectural decisions, competing approaches, no established pattern to follow, high cascading-failure risk.
- Signals: "How should we structure this?", "Should we use X or Y approach?", "What's the safest design here?", "This could break other systems if we get it wrong."
- Example: "Redesign the state machine for intent lifecycle" — requires architectural judgment.

**sonnet** — Known patterns with judgment calls, standard feature additions, cross-file changes requiring coordination.
- Signals: "Here's the pattern, apply it consistently", "This feature uses our normal flow", "Multiple files change but integration is clear", "We've done similar work before."
- **Default when uncertain.** If you can't decide between sonnet and opus, pick sonnet — the elaborator can always escalate upward.
- Example: "Add a new field to unit frontmatter and wire it through the orchestrator" — standard pattern, clear scope.

**haiku** — Purely mechanical execution, copy-paste-adapt patterns, additive-only changes, no decision-making required.
- Signals: "Just repeat what we already do here", "No design choices involved", "Following a single clear path", "Zero risk of breaking other systems."
- Example: "Add a new hat to the development stage" — copy existing hat template, update names, done.

### Decision Heuristic

Start at **sonnet**. Justify upward to **opus** if the unit involves architectural or trade-off decisions. Justify downward to **haiku** if the unit is purely mechanical with no judgment calls.

### Anti-patterns (RFC 2119)

- The agent **MUST NOT** assign `opus` to units with fully-specified mechanical execution paths.
- The agent **MUST NOT** leave the `model:` field unset — every unit spec **MUST** include the field.
- The agent **MUST NOT** assign the same model to all units without assessing each individually.
- The agent **MUST NOT** use "this is important work" as justification for `opus` — importance and complexity are different concepts.

> **Note:** Model assignments are always recorded in unit frontmatter. The orchestrator only uses them for subagent spawning when `HAIKU_MODEL_SELECTION` is set. When unset, all subagents inherit the session default.
