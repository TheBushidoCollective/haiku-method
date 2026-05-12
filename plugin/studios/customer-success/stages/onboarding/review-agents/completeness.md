---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the onboarding plan covers every step required to reach initial value realization, with each step's ownership and acceptance signal explicit. Onboarding gaps surface months later as adoption-stage failures or renewal-time disputes about whether the customer ever got what they paid for. This lens stops the gap at the stage where it can still be closed cheaply.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **"Initial value" defined in observable terms** — `ONBOARDING-REPORT.md` opens with a single-sentence, measurable definition of what initial value looks like for this customer / segment. Definitions like "the customer is onboarded" are findings.
- **All stakeholder roles named** — Economic buyer, executive sponsor, champion, end users, technical owner are each named, or marked `unknown — to discover` with the discovery as a milestone. Filling one role does not satisfy this check; treating one person as the whole customer is the most common failure.
- **Milestones in dependency order** — The plan sequences milestones by what blocks what, not by calendar. Calendar-ordered plans treat dependencies as suggestions and break when reality interrupts.
- **Each milestone has owners on both sides** — Every milestone has a named team-side owner role and a named customer-side owner. "The team" or "the customer" is a finding.
- **Each milestone has entry, exit, and dependency** — Entry condition (what must be true to start), exit condition (what proves it landed, observable), and named upstream dependency. Soft exit conditions ("training was provided") are findings.
- **Sales commitments surfaced** — The plan lists every commitment from the sales handoff (features, timeline framing, integrations, support, ROI) and marks each as covered, uncovered, or to-be-renegotiated. Uncovered commitments without a named renegotiation conversation become first-renewal disputes.
- **Integration validation is end-to-end** — Each integration surface has an end-to-end test (input → path → expected output → actual output → pass/fail). Single-step validation is a finding. Non-equivalent-environment validations must be flagged as such, not marked green.
- **Configuration run book is reader-ready** — Every configuration decision has what / why / reversal / validation, written so the adoption team can use it without re-deriving anything.
- **Handoff to adoption written** — The plan declares which features were enabled, which were not, which stakeholders are reachable, what's on watch, and what the customer's next priorities are.

## Common failure modes to look for

- A "checklist-style" plan whose steps are activities ("kickoff call", "training session") with no acceptance signal
- A single point of contact treated as the whole customer — no executive sponsor, no champion, no end-user segment named
- An "initial value" definition that's actually a feature-enablement event in disguise
- A milestone sequence that goes in the order tasks are easiest to do, not the order they unblock
- Sales commitments quietly dropped from the plan rather than escalated for renegotiation
- An integration marked "validated" with only the credentials-test step run
- A run book that only the person who wrote it can read
- A handoff to adoption that's silent on what was deliberately not enabled
