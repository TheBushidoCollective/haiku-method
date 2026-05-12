---
model: opus
interpretation: strict
---
**Mandate:** The agent **MUST** verify every target market identified in inception has its applicable regulatory frameworks named, applicability evidence documented, and a cert path planned. Regulatory gaps caught at requirements are correctable; the same gaps caught at validation mean cert failures, ship-date slips, and PCB respins.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Per-market framework coverage** — Every target market named in inception has its applicable framework categories identified: emissions / immunity, electrical safety, restricted-substance / environmental, industry-specific (medical / automotive / industrial / aviation / marine / food-contact as the product class triggers), wireless / network protocol, and cybersecurity where applicable.
- **Applicability evidence per framework** — Every framework named has a product-class assertion, intended-use statement, and deployment region backing applicability. Vague applicability is what makes cert-lab submissions bounce.
- **Cert path planned** — Each framework has at least the cert-route category identified (self-declaration with technical file, certified-lab submission, accredited-lab plus regulator notification, etc.). The specific cert-lab pick is a validation-stage concern; the route category belongs here.
- **Cost and lead-time category** — Each framework has a documented cost and lead-time category fed back into the cost envelope and the project schedule. "TBD" is a finding, not a placeholder.
- **Standards-driven design constraints surfaced** — Every framework that forces a design constraint (mandatory isolation gap, EMI / EMC layout practice, restricted material, mandatory user-facing label, intended-use disclaimer, cybersecurity update requirement) is captured for the `design` stage to satisfy. Constraints with no carrier into design become cert findings.
- **Regulatory open questions escalated** — Every regulatory open question has `(needs human escalation)` as its disposition. Defaults on regulatory questions are not acceptable.

## Common failure modes to look for

- A target market named but the framework set assumed from a different market (consumer-electronics frameworks on an industrial product)
- A framework with no applicability evidence — names the framework but doesn't say why this product is in scope
- Cost or lead-time category recorded as "TBD" or omitted, leaving the cost envelope unable to absorb cert reality
- A standards-driven design constraint (creepage gap, shielding requirement, mandatory labelling) buried in prose instead of called out for the design stage
- A regulatory open question defaulted instead of escalated — "we'll figure out FCC later" is not a default
- A radio module added in requirements without the corresponding intentional-radiator framework picked up in the framework table
