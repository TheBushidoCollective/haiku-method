---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the review's outputs are internally consistent and present a unified narrative across units. Coherence is the lens — a review report that contradicts itself, uses inconsistent terminology, or whose summary doesn't reflect its detail is harder for the downstream `deliver` stage to act on than one with fewer findings stated coherently.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Terminology consistent** — One term per concept across every unit's findings. If unit A's findings call something a "variant" and unit B's findings call the same thing an "option," that's a violation — the publisher will spend cycles reconciling rather than addressing the substance.
- **Findings do not contradict each other** — Two findings recommending opposite changes to the same draft section is a violation. Either one is wrong, or both apply under different conditions that need to be stated explicitly.
- **Severity assignments coherent across units** — Comparable findings carry comparable severities. A "load-bearing claim unsourced" rated critical in one unit and minor in another is a violation; flag the inconsistency.
- **Executive summary reflects the detail** — If the review produces a summary (per the intent or the review-planner's plan), the summary's claims trace to specific findings in the detail. A summary that softens or strengthens the detail is a violation.
- **Cross-unit references resolve** — Where one unit's findings reference another unit ("see review unit-3"), the referenced unit actually contains what's claimed.
- **Plan-do-verify chain coherent within each unit** — The synthesizer's findings cover every aspect the planner listed; the reviewer's verification noted any gaps; the adversarial hats' findings extend rather than contradict the front loop's findings.

## Common failure modes to look for

- The same draft section called "introduction" in one unit's findings and "preamble" in another
- Two findings recommending opposite fixes to the same paragraph with no condition stated to disambiguate
- A critical finding in one unit and a minor finding for the same defect class in another, with no rubric reason for the difference
- An executive summary asserting "the draft is strong overall" when the detail contains three critical findings
- A finding citing "research §3" when there is no §3 in the research brief
- A synthesizer block that says "no findings" for an aspect the planner explicitly listed (silent skip)
