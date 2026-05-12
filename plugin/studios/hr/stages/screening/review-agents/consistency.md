---
interpretation: lens
---
**Mandate:** The agent **MUST** verify screening decisions are consistent across the candidate pool, traceable to specific job-spec criteria, and free of disparate-impact patterns. Calibration drift at screening is invisible to any single decision but devastating in aggregate — a pipeline that screens consistently is the foundation every downstream stage relies on.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Frozen criteria** — The screener restated the must-have / nice-to-have criteria at the top of the batch; every per-candidate evaluation references the same frozen set.
- **Evidence-bar consistency** — Citations of comparable strength produce the same "met / not-met / unclear" status across candidates. A high-confidence "met" for candidate A with the same evidence depth as a "not-met" for candidate B is a calibration failure.
- **Confidence-rubric consistency** — Comparable evidence depth produces comparable confidence levels.
- **Source-leniency check** — Referral, high-prestige-employer, and team-vocabulary-match candidates are not advantaged on weaker evidence than cold-sourced or adjacent-industry candidates with equivalent underlying competency signal.
- **Disposition rules followed** — "Pass" requires every must-have "met" at medium or higher confidence; "Fail" names a specific failed must-have; "Borderline" cases are explicitly resolved by the assessor with cited rationale.
- **Edge-case resolution** — No candidate carries an unresolved "unclear" must-have into the shortlist; each is promoted, demoted, or escalated for follow-up with cited rationale.
- **Scoring methodology documented** — The composite-scoring methodology is written before any score is produced; weights and confidence modifiers are explicit and applied consistently.
- **Shortlist size discipline** — Shortlist size is bounded by the interview capacity drawn from the requisition's hiring timeline; candidates above the must-have bar but below the cutoff are "hold", not "fail".
- **Disparate-impact patterns** — Candidate-pool slices (by source, by surface style, by background pattern) do not show systematically different pass rates that can't be explained by underlying competency signal.

## Common failure modes to look for

- A must-have called "met" with weak evidence for candidate 3 but "not-met" with similar evidence for candidate 11 — calibration drift
- "Pass" dispositions where the rationale is "strong candidate" rather than naming the criteria-level decision
- "Fail" dispositions where no specific must-have is named — soft rejections corrode the audit trail and produce disparate-impact at scale
- Borderline candidates silently absorbed into "pass" or "fail" without the assessor's cited rationale
- Scoring methodology that appears after the scores ("the rankings reflect the following weights ...") — methodology must precede the scoring, not justify it post-hoc
- Pool-composition signals visible in the data but not surfaced by the assessor — a cluster of cold-sourced candidates failing the same must-have that referral candidates pass is signal, not noise
- Shortlist size of 12 when the interview stage has capacity for 5 — wastes interviewer time and tanks candidate experience for the 7 who won't be interviewed
- Source-leniency drift where referral candidates get the benefit of the doubt and cold-sourced candidates don't

Where a finding touches protected-class fairness, disparate-impact analysis, or jurisdictional employment law, file the feedback and flag explicitly that the resolution should defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.
