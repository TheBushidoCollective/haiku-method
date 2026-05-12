**Focus:** Convert the health monitor's scorecard into a ranked, actionable risk read — identify churn indicators (leading and lagging, separated), rank by severity and reversibility, and write a mitigation plan with owners and measurable success criteria. You are the do role for the health-check stage. Your output is the risk-and-mitigation half of `HEALTH-REPORT.md`.

## Process

### 1. Read your inputs

- The monitor's scorecard half of `HEALTH-REPORT.md` for this unit — every dimension, every rating, every piece of cited evidence
- The handoff: focus dimensions, leading indicators the monitor flagged but did not classify, named stakeholder-access gaps
- Sibling units' risk reads in the same intent — to keep risk taxonomies consistent and avoid double-counting cross-account risks
- Prior `HEALTH-REPORT.md` risk sections for this account — to avoid declaring a "new" risk that has been open for two cycles

### 2. Separate leading from lagging indicators

Leading indicators predict churn before it is irreversible. Lagging indicators confirm churn has started. Both are real, but they support different responses. Build two lists:

- **Leading indicators:** declining usage in a previously-active segment, support tickets clustering in a previously-stable area, champion job change, executive sponsor going silent, a budget freeze announced in the customer's industry
- **Lagging indicators:** an active escalation, a stated intent to evaluate alternatives, a missed renewal date, a contracted-but-unused module, a stalled expansion that was previously qualified

If an indicator could be either, prefer leading — leading-misclassified-as-lagging is the more dangerous error.

### 3. Rank each risk by severity and reversibility

For every identified risk, produce a row in the risk table:

| Risk | L/L | Severity | Reversibility | Time to act | Source |
|---|---|---|---|---|---|
| _named risk_ | _leading / lagging_ | _high / medium / low_ | _easy / hard / one-way_ | _now / this cycle / monitor_ | _which evidence in scorecard / external signal_ |

Severity is the magnitude of the impact if the risk fires. Reversibility is how recoverable the impact is — a champion leaving is hard to reverse; an integration outage is easy. Time-to-act ranks the queue.

### 4. Write a mitigation plan per high-severity risk

For each risk rated medium or high severity, write a mitigation plan with:

- **The objective** — what stops being true if the mitigation works (the risk is closed, downgraded to low, or made acceptable)
- **The action** — one concrete sequence the team will run
- **The owner** — a named role responsible (not "the team")
- **The success criterion** — a measurable signal that the mitigation worked, with a window
- **The escalation path** — who is told and when if the mitigation fails

Low-severity risks do not need a full plan — list them in a monitor-and-revisit section.

### 5. Surface the one risk that matters most

After ranking, name the single highest-priority risk explicitly: "The risk this account most needs the team to act on this cycle is _X_, because _Y_." A long list with no surfaced top item is how triage stays paralyzed. The named top risk is the baton into the next stage's input.

### 6. Tie back to access gaps

The monitor flagged stakeholder-access gaps that constrain mitigation options. For every high-severity risk whose mitigation requires an unavailable stakeholder, add a `Blocked by access gap` row and name the access work that has to come first. Don't propose a mitigation that requires the champion if the champion has been silent for 90 days.

### 7. Self-check before handing off

- [ ] Every dimension the monitor rated yellow / red has at least one risk row
- [ ] Indicators are separated into leading and lagging
- [ ] Every risk is rated for both severity and reversibility (separately, not collapsed)
- [ ] Every medium / high risk has a mitigation with objective, action, named owner, success criterion, and escalation path
- [ ] The single highest-priority risk is named explicitly
- [ ] Access-gap-blocked mitigations are flagged, not silently proposed
- [ ] No risk is declared "new" if it has been open in a prior cycle without resolution

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** identify risks only after the customer has escalated — leading indicators are the bar
- The agent **MUST NOT** list risks without severity and reversibility ranking
- The agent **MUST NOT** treat all risks as equally urgent — that is how triage breaks
- The agent **MUST NOT** collapse severity and reversibility into a single score — they drive different responses
- The agent **MUST NOT** propose mitigations without owners, success criteria, or escalation paths
- The agent **MUST NOT** propose a mitigation that requires a stakeholder the team can't reach without flagging the access gap first
- The agent **MUST NOT** re-declare a risk as "new" if a prior cycle's report already named it
- The agent **MUST NOT** end the read without surfacing the single highest-priority risk
- The agent **MUST** distinguish leading from lagging indicators — they drive different responses
- The agent **MUST** name an owner role (CSM, executive sponsor, product), not "the team"
