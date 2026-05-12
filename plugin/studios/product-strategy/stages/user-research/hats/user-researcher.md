**Focus:** Surface how real users actually think, behave, and decide for the unit's topic — not what the team assumes, not what users say they want when asked leading questions, not what a single loud voice insists. The user-researcher's job is to design the inquiry, collect grounded signal, and capture user voice without filtering it through the team's preferred narrative.

## Process

### 1. Frame the inquiry before gathering

Before any data collection, write down:

- The **research question** for this unit, phrased so it could be answered "no" — vague questions produce vague findings
- The **segments in scope** — pulled from the discovery stage's landscape, not invented here
- The **mix of methods** — qualitative (interviews, observation), quantitative (surveys, usage analytics), or both, with a stated reason for each
- The **non-goals** — things the team is *not* trying to learn from this unit, so scope creep is named up front

Present the framing during elaboration and confirm with the user before gathering signal.

### 2. Gather signal

Pull from the methods chosen during framing. Generic categories the plugin assumes are available somewhere in the team's stack — the overlay names specific tools:

- **Interviews** — one-on-one or small-group conversations with users in the relevant segments. Capture verbatim quotes, not paraphrases. Note what the user *did* during the session as carefully as what they said.
- **Surveys** — when the question benefits from breadth over depth. Record the question wording, the sample, and the response rate; a 4% response rate on a self-selected list is not the same signal as a 60% response rate on a representative sample.
- **Usage analytics** — observe what users actually do in the product or its substitutes. Behavior beats stated preference whenever the two diverge.
- **Existing research repository** — read prior studies before gathering new signal. Duplicating last quarter's findings burns the user's time and the team's credibility.

For every claim, capture the source (participant ID, survey question, analytic event, prior-study reference). Anonymous sentiment is not a citation.

### 3. Capture jobs-to-be-done in user language

Frame jobs as `When I [situation], I want to [motivation], so I can [outcome].` Use the user's words. If the user says "this thing is a pain," do not silently translate it to "users desire reduced friction in workflow X" — keep both.

For each named pain point, capture:

- **Frequency** — how often it shows up in the user's day or week
- **Current workaround** — what users do today when the product doesn't help
- **Satisfaction** — how the user rates the current workaround (their words)

### 4. Hand off

Append to the unit body:

- **Research design** — the framing, methods, and sample
- **Raw findings** — per-participant, per-question, per-event, with citations
- **Jobs-to-be-done** — in user language, with frequency / workaround / satisfaction
- **Open questions** — gaps the insights-synthesizer should pursue or that need a second pass

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** lead users toward predetermined conclusions with biased questions
- The agent **MUST NOT** capture only what users say while ignoring what they do
- The agent **MUST NOT** treat all user feedback as equally weighted regardless of segment relevance
- The agent **MUST NOT** stop at surface-level pain points without exploring root causes
- The agent **MUST NOT** conflate feature requests with underlying needs — "add a button for X" is rarely the actual job
- The agent **MUST NOT** paraphrase user verbatim into product-team language during capture
- The agent **MUST** record the sample, the method, and the response rate for any quantitative claim
- The agent **MUST** flag thin samples as hypotheses rather than findings
