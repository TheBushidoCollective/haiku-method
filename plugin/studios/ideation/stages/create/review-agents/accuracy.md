---
interpretation: lens
---
**Mandate:** The agent **MUST** fact-check the draft deliverable against source material and known constraints. Accuracy is the lens — a deliverable that ships with confidently-stated incorrect claims damages the reader's trust in everything else the deliverable says. The lens fires before the dedicated `fact-checker` hat in `review` so creator-stage corrections happen in the cheaper iteration.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Factual claims sourced** — Every load-bearing factual claim cites a source the reader could open and verify. Numbers, dates, named statistics, named events, named people's positions all qualify as load-bearing.
- **Numbers and dates correct** — Spot-check the cited source against the section's restatement. A strengthened paraphrase (the source's "may" became the section's "will") is a violation; a weakened paraphrase that hides a stronger source finding is also a violation.
- **No internal contradictions** — Different sections of the deliverable don't make incompatible factual claims. If section A says the market is dominated by X and section B says the market is fragmented across X, Y, and Z, that's a violation unless the contradiction is explicitly reconciled.
- **Conclusions follow from evidence** — Each load-bearing conclusion has a visible inferential chain from the cited evidence. Hidden inferential steps ("therefore obviously") are accuracy violations because they hide the place where the chain might break.
- **No claim contradicts a recorded Decision** — If the intent's decision register has a recorded Decision on a question, the deliverable doesn't quietly assume the opposite. Cite the Decision ID in any such finding.
- **No unsourced load-bearing claim** — A claim with no cited source carrying load is filed at major or critical, depending on how much downstream work depends on it.

## Common failure modes to look for

- A round number stated without a citation — round numbers are usually paraphrased, not measured, and tend to be where strengthened claims hide
- A "studies show" / "research demonstrates" phrasing without naming any specific study
- A graph or table whose source is named in passing but whose underlying data isn't traceable
- A section that pivots its argument on a single sentence-long claim sourced to a tertiary vendor blog
- An inference that quietly imports an assumption from a different domain (e.g., "users in healthcare behave like users in consumer SaaS because…")
- A "common knowledge" claim that the audience for this deliverable might not in fact share
