---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the RFP and its requirement set are specific enough for objective vendor evaluation. Vague requirements produce incomparable responses; ambiguous evaluation criteria let preferred vendors win on rationale, not substance.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Priority classification with justification** — Every requirement is classified mandatory / preferred / nice-to-have, and every mandatory item has a business-need justification cited to a source (stakeholder note, ticket, strategic doc) — not "industry standard."
- **Testable specifications** — Every requirement is phrased so a vendor response can be marked yes / no / partial against named evidence. "Must be performant" or "must be scalable" are reject-worthy unless they include measurable thresholds.
- **Pre-contact evaluation methodology** — Evaluation criteria, category weights (summing to 100), and the scoring scale with anchor points are documented before the RFP goes to vendors. A methodology defined after responses arrive is reject-worthy.
- **SLA expectations with measurable thresholds** — Every SLA expectation in the RFP names a metric, a threshold, a measurement method, and a remedy. Descriptive language ("high availability", "responsive support") without numbers is reject-worthy.
- **Non-negotiables present** — Data handling, security, compliance, and exit-provision sections exist in the RFP, even when brief.
- **Response template provided** — The RFP includes a structured response template (yes / no / partial + evidence field + reference customer field where applicable) so responses are comparable.

## Common failure modes to look for

- A requirements section that lists features without naming the stakeholder or business outcome behind each
- A mandatory requirement that no plausible vendor in the market can meet (the team will end up rewriting it under pressure)
- Evaluation weights that don't sum to 100, or weights with no rationale
- SLA language using adjectives ("fast", "reliable") instead of numbers
- An RFP whose length or complexity will discourage qualified vendors from responding
- Procurement-platform-specific templates or named compliance auditors embedded in the plugin default (those belong in a project overlay)
