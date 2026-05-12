---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the inception knowledge artifacts collectively cover everything downstream hardware stages will need to plan against. Gaps here cascade into requirements that miss a market, designs that miss a constraint, and validation plans that miss a regulatory framework.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Target users are specific** — A named user, role, or segment with measurable attributes (job-to-be-done, willingness to pay, purchase frequency), not a vague "users who care about X". Vague target users propagate into vague requirements.
- **Regulatory markets identified** — The geographies and product class are named so the `requirements` stage can plan certification frameworks against them. "Sells in North America" with no notes is incomplete — the cert frameworks for medical, industrial, consumer, and connected products differ.
- **Cost envelope documented** — BOM target, target ASP, channel margin assumption, and target volume are documented with their sources. The envelope must be tight enough that `design` can make component-cost tradeoffs against it.
- **Competitive landscape concrete** — A real, current list of alternatives the user could buy instead, each with current MSRP, primary feature, and the gap this product addresses. Lists with only "we are best in class" claims and no named alternatives are incomplete.
- **Non-goals explicit** — The artifact names what this product is NOT, so downstream stages don't accidentally scope-creep into adjacent markets or features.
- **Volume estimates grounded** — Volume figures cite a comparable product, a channel-capacity argument, or a primary-research signal, not a vibes-based number.
- **Downstream-stage handoff** — Each artifact lists which downstream stage will consume each conclusion (requirements / design / manufacturing) so the next stage knows what to read.

## Common failure modes to look for

- A target user described only in demographic terms ("affluent urban professionals") with no job-to-be-done
- A regulatory-markets section that names countries but doesn't identify the product class that drives the cert framework
- A cost envelope without channel margin — retail-margin compression is how products lose money
- "Best in class" positioning with no concrete competitor table
- Volume estimates of "we expect 10k units year one" with no comparable-product anchor
- A business-case unit that doesn't surface the most fragile assumption (the one a single bad input would collapse the case on)
