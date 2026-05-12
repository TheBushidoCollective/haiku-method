---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the vendor evaluation is objective, the scoring methodology was applied consistently across vendors, and the technical claims behind the scores survived independent verification. Subjective scoring with preferred outcomes is the #1 source of post-procurement regret.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Methodology applied consistently** — The same scoring scale, anchor points, and weights were applied to every vendor. No vendor was scored on a rubric that didn't apply to the others.
- **Mandatory gates applied before scoring** — Vendors that failed a mandatory requirement are disqualified, not scored down. The disqualification reason is recorded.
- **Score rationale per cell** — Every score has a one-line rationale citing the specific evidence used (response text section, reference customer call, POC result, certification). Scores without rationale are not auditable.
- **POC-backed technical claims** — Where the technical reviewer ran a POC, the score reflects POC outcomes; where the reviewer flagged a claim as unsupported, the score has been revised or the disqualification recorded.
- **Reference checks beyond the vendor list** — Reference contacts include at least one customer the vendor did not supply. Calls cite real, named, contactable customers — no anonymous attributions.
- **Total cost of ownership complete** — TCO includes every component the methodology named (licensing, implementation, integration, training, ongoing operational, exit). Zero rows have a note explaining the zero.
- **Comparative differentiation explained** — The ranking summary names the meaningful differences between top candidates (not just score deltas), so the user can decide on substance.

## Common failure modes to look for

- A scorecard whose cells are numbers without rationale
- A vendor scored well on a capability category but no POC or reference evidence backs the score
- A TCO column that omits a cost the methodology required, or a row with no note explaining a zero
- A reference-check section that only cites vendor-provided contacts
- Mid-evaluation criterion changes — weights, scale, or category definitions that drifted between the first and last vendor scored
- Vendor-product-named scoring rubrics embedded in the plugin default (those belong in a project overlay)
