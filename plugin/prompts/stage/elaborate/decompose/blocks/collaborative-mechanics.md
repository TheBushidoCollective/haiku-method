Mode: **collaborative** — record at least one **decision** in the stage's `decision_log` (via `haiku_decision_record`), OR honestly declare `no_decisions: true` with a rationale. A decision is a real choice between concrete options, not a question for the sake of asking.

Two valid decision sources, both count:

- **`source: "user"`** — you presented options the user couldn't reasonably resolve from the codebase, and they picked.
- **`source: "autonomous-acknowledged"`** — you decided from clear conventions, surfaced the choice for veto-style approval, and got no pushback by the next turn.

### Quality bar for user-facing questions

Every question MUST clear all four before being asked:

- **Real decision** — can't be answered from the codebase, manifest files, prior stages' outputs, or existing conventions.
- **≥2 concrete options** — you've articulated the alternatives. One-option defaults fail.
- **Tradeoff axis** — each option carries a known tradeoff. If all options are equivalent, the choice doesn't need user input.
- **Recorded** — after the pick, call `haiku_decision_record { decision, options, choice, source: "user", rationale? }`.

#### Banned question patterns

- **Yes/no on defaults** — *"Should we follow your existing patterns?"*, *"Want tests?"*. Obvious yes, or already covered by quality gates.
- **Codebase-answerable** — *"What test runner do you use?"* Read `package.json` / `pyproject.toml` / `Cargo.toml`.
- **Permission-asking** — *"Is it OK if I extend the User model?"* Make the choice and surface autonomously.
- **Confirmation-seeking** — *"Does this approach sound good?"* with no concrete alternatives.

### One question at a time

Even when you have multiple questions, ask ONE, wait for the answer, then ask the next. Don't batch questions in a single `ask_user_visual_question` call; don't dump numbered questions as plain text.

### Surface autonomous decisions for veto-style approval

For decisions you can resolve from the codebase or clear conventions:

1. State the decision and cite the evidence — *"I'm using `<lib X>` for HTTP because `package.json` already includes it."*
2. State the alternative considered — *"(Considered `<lib Y>`, but no existing usage.)"*
3. Invite veto — *"Reply 'change' if you'd prefer otherwise."*
4. If no pushback by the next turn, call `haiku_decision_record { source: "autonomous-acknowledged", ... }`.

Most decisions in a routine stage should be autonomous-acknowledged.

### Honest no-decisions declaration

If the work is purely conventional with NO architectural choices in scope (a doc update following an established style guide, a routine ops runbook against a fixed pipeline), call `haiku_decision_record { intent: "...", no_decisions: true, rationale: "<why this stage has no choices>" }` and proceed. Faking a decision to satisfy the gate is the failure mode this design exists to prevent.

### Tools for asking

Use the structured MCP tools (`AskUserQuestion`, `ask_user_visual_question`, `pick_design_direction`) with pre-selected `options[]` — never plain conversation text. Include an *"Other (let me specify)"* option when the list may not be exhaustive.
