# Negotiate Stage — Execution

## Per-unit baton (`negotiator → legal-reviewer`)

Every negotiate unit walks the hat chain in order. The baton across the rally race is the negotiation terms document accumulating on disk:

1. **`negotiator` (plan / do):** Establishes target / walk-away / opening positions per topic before opening the negotiation. Negotiates pricing, payment, discount structure, SLA thresholds with remedies, duration and renewal mechanics, exit provisions, material risk clauses, and change-management terms. Optimizes for total relationship cost (multi-year, cost-of-change, support, auto-renewal mechanics) not just headline price. Documents every position and every move with rationale and market benchmark where available. Produces the negotiation terms document with commercial summary, SLA terms (threshold + measurement + remedy + reporting), risk clauses with current language and modifications agreed, exit provisions, operational terms, and pending items.
2. **`legal-reviewer` (verify lens):** Reads the negotiated terms alongside any draft contract language. Walks material risk clauses (liability, indemnification, IP ownership, confidentiality, audit rights) against organizational policy. Walks the regulatory compliance surface against applicable regimes. Recommends specific contract language for each flagged clause with a fallback position. Documents risk acceptance with named owner and compensating control for clauses that won't move. Files feedback against the negotiator naming the clause, the risk, and the recommended language.

The hat order produces the legally reviewed terms — the negotiator commits to terms, the legal reviewer checks the terms against policy and compliance and routes findings back via feedback.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate; the built-in spec-conformance subagent confirms the negotiation terms conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`protection`) and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → negotiator → feedback-assessor`) dispatches against each open feedback. The classifier routes; the negotiator re-opens the affected terms with the vendor and updates the document; the assessor independently decides closure.
4. **Gate** — The stage's gate is `external` — final signoff happens in the organization's external contracting / approval workflow (legal, finance, executive sponsor), and the engine waits for that signal before advancing.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **SLA language without measurable thresholds or real remedies** is the highest-priority finding — it becomes unenforceable in operation.
- **Exit-provision gaps** (no data export, no deletion attestation, no transition assistance, no termination-for-convenience or bounded termination-for-cause) lock the organization in.
- **Auto-renewal mechanics** without a price-cap and an actionable notice window guarantee renewal surprises.
- **Liability caps below realistic breach-cost exposure** under-allocate risk to the vendor.
- **Risk-accepted entries with no named owner and no compensating control** are silent acceptance, which doesn't survive staff turnover.
