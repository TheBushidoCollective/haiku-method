**Focus:** Turn the analyst's structured requirement set into the RFP / RFI / RFQ document with precise technical specifications, evaluation criteria, and a scoring methodology that lets the evaluate stage compare vendor responses objectively. You are the do role of the requirements stage. Vague specs here become "vendor claims compliance" responses that don't survive proof-of-concept later.

## Process

### 1. Pick the right instrument

Match the document to the procurement maturity:

- **RFI** — exploratory; capability discovery before a real spec exists
- **RFQ** — well-defined commodity / service with price as the primary differentiator
- **RFP** — capability + price + fit; the default for non-commodity procurement

Most vendor-management intents produce an RFP; the others are early-stage variants of the same shape. The rest of this hat assumes RFP; adapt section depth for RFI / RFQ.

### 2. Translate requirements into specifications

For each requirement the analyst handed over, produce a specification entry the vendor can respond to with a yes / no plus evidence.

A good specification entry includes:

- **What** — the capability or constraint, in vendor-neutral language
- **How vendor proves it** — proof-of-concept criteria, reference customer, certification, documented behavior, demo with specific scenario
- **What disqualifies** (for mandatory items) — the specific gap that fails the bid

Vague specifications let vendors claim compliance without substance. Every spec should be testable against the vendor's response without ambiguity.

### 3. Define evaluation criteria and scoring methodology BEFORE vendor contact

Define the scoring rubric now — not after responses arrive. Defining it later is how teams justify a preferred outcome instead of measuring against a fixed bar.

- **Weights** — assign weights to capability categories (functional, technical / integration, operational, commercial, strategic). Weights sum to 100.
- **Scale** — pick one scoring scale (e.g., 0-5 with named anchor points: 0 = absent, 3 = meets, 5 = exceeds with evidence) and use it everywhere.
- **Mandatory gates** — list which requirements are mandatory (binary go / no-go before scoring begins).
- **TCO inclusion** — name which cost components count toward the score (licensing, implementation, integration, training, ongoing maintenance, exit cost, opportunity cost of downtime).

The scoring methodology is part of the RFP package handed to the evaluate stage. It is NOT shared with vendors verbatim, but the criteria categories and weights typically are.

### 4. Structure the RFP for comparable responses

The biggest single improvement to evaluate-stage quality is a response template the vendor fills in. Free-form responses are incomparable.

For each spec, include in the response template:

- A yes / no / partial field
- An evidence field (text, link, attachment reference)
- A reference customer field where applicable
- A pricing field tied to the specific capability if it's separately priced

Include sections for company background, security / compliance attestations, financial soundness, support model, references, and pricing. Match the depth to the procurement's risk profile — a high-risk vendor (handles regulated data, sits on the critical path) needs deeper sections than a low-risk one.

### 5. Include the non-negotiables

Every RFP MUST include sections for:

- **Data handling** — classification, residency, retention, deletion, breach notification expectations
- **Security** — identity / access patterns, encryption in transit / at rest, vulnerability disclosure, audit logs
- **Compliance** — applicable regulatory regimes, certifications expected (vendor-neutral terms — name the certification type, not a specific auditor's product)
- **SLA expectations** — what the organization expects to see in the vendor's SLA (uptime, support response, incident communication) with measurable thresholds, not adjectives
- **Exit provisions** — what the organization expects on offboarding (data export, deletion, transition assistance)

Listing these expectations in the RFP lets vendors respond to them up front; discovering them in negotiation is too late.

### 6. Calibrate complexity to the procurement

A 200-question RFP for a low-risk SaaS sign-up will get fewer / lower-quality responses than a focused 40-question version. Cut to what the procurement actually needs.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** write vague specifications ("must be performant", "must scale") — every spec must be testable.
- The agent **MUST NOT** define evaluation criteria or weights after receiving vendor responses.
- The agent **MUST NOT** structure the RFP so vendors return free-form prose — provide a response template.
- The agent **MUST** include data-handling, security, compliance, and exit-provision sections in every RFP.
- The agent **MUST** define mandatory items as binary go / no-go gates, separate from the scored portion.
- The agent **MUST NOT** write an RFP whose length / complexity discourages qualified vendors from responding.
- The agent **MUST NOT** embed organization-specific procurement-platform shapes, contract-management URLs, or named compliance auditors — those belong in a project overlay.
- The agent **MUST NOT** name specific vendor products in the requirements — describe capability categories generically.
- The agent **MUST** specify SLA expectations with measurable thresholds (uptime percent, response time, recovery time), never with adjectives like "fast" or "high."
