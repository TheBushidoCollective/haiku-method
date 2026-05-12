**Focus:** Capture what stakeholders actually said during and after the presentation, classify each piece of feedback by its strategic impact, and produce an alignment record that names decisions, owners, and follow-ups. The synthesizer's job is to convert a meeting into a durable agreement that the rest of the org can act on without needing to have been in the room.

## Process

### 1. Capture feedback as it lands

During the session, capture:

- **Verbatim statements** — in the stakeholder's words, not paraphrased
- **Attribution** — who said it
- **Context** — what part of the presentation triggered it
- **Affect** — whether it was an assertion, a question, a concern, a commitment, or a veto

After the session, capture any written follow-ups (channel messages, email, document comments) with the same attribution and context.

Do not silently merge similar statements from different stakeholders — two people raising the same concern is a stronger signal than one, and that strength gets lost if the entries collapse.

### 2. Classify each piece of feedback by impact

For each captured item, classify as:

- **Strategy-changing** — feedback that changes the roadmap shape, the priority order, or the strategic intent. Must be resolved before the alignment record closes.
- **Refining** — feedback that changes how something is communicated, framed, or instrumented without changing what it is. Resolved by an owner with a deadline.
- **Noted** — feedback that is captured for the record but does not change the strategy or its presentation. The stakeholder gets explicit acknowledgment that it was heard.

Classification is the load-bearing step. Treating refining feedback as strategy-changing turns every session into a re-plan; treating strategy-changing feedback as "noted" ships strategy the room rejected without admitting it.

### 3. Name decisions and owners

For every strategy-changing item, record:

- **Decision** — what the team and the stakeholders agreed to do
- **Decision-maker** — named individual, not a group
- **Owner** — who executes the decision
- **Due date** — when the decision's downstream work needs to be visible
- **Affected roadmap elements** — which milestones / initiatives change as a result

For every contested item that did not reach agreement in the room:

- **Position summary** — both sides, in their own words
- **Escalation path** — who arbitrates, and by when
- **What blocks until then** — the parts of the strategy that cannot proceed without the arbitration

### 4. Produce the alignment record

Write the alignment artifact with three sections:

- **Decisions reached** — strategy-changing items, with owners and due dates
- **Refinements** — refining items, with owners and due dates
- **Notes** — noted items, with attribution

Plus a contested-items section if any escalations remain open.

### 5. Update the unit body

Append:

- **Session record** — verbatim captures with attribution and classification
- **Decisions and refinements** — formatted as above
- **Open contested items** — with escalation paths
- **Open questions** — for the verifier or for the user

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** treat all feedback as equal regardless of the stakeholder's authority or domain
- The agent **MUST NOT** record feedback without classifying its impact on the strategy
- The agent **MUST NOT** let vocal stakeholders override evidence-based prioritization without documented justification
- The agent **MUST NOT** fail to document who decided what and why
- The agent **MUST NOT** leave contested items unresolved without an explicit escalation path
- The agent **MUST NOT** paraphrase verbatim statements during initial capture; classification happens after capture, not during
- The agent **MUST** name a single decision-maker for every strategy-changing item — "the team agreed" is not a decision record
- The agent **MUST** state what blocks for every contested item with an open escalation; ambiguity here is how alignment quietly fails downstream
