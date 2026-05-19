# Negotiate Stage — Execution

## Per-unit baton (`negotiator → legal-reviewer`)

Every negotiate unit walks the hat chain in order. The baton across the rally race is the negotiation terms document accumulating on disk:

1. **`negotiator` (plan / do):** Establishes target / walk-away / opening positions per topic before opening the negotiation. Negotiates pricing, payment, discount structure, SLA thresholds with remedies, duration and renewal mechanics, exit provisions, material risk clauses, and change-management terms. Optimizes for total relationship cost (multi-year, cost-of-change, support, auto-renewal mechanics) not just headline price. Documents every position and every move with rationale and market benchmark where available. Produces the negotiation terms document with commercial summary, SLA terms (threshold + measurement + remedy + reporting), risk clauses with current language and modifications agreed, exit provisions, operational terms, and pending items.
2. **`legal-reviewer` (verify lens):** Reads the negotiated terms alongside any draft contract language. Walks material risk clauses (liability, indemnification, IP ownership, confidentiality, audit rights) against organizational policy. Walks the regulatory compliance surface against applicable regimes. Recommends specific contract language for each flagged clause with a fallback position. Documents risk acceptance with named owner and compensating control for clauses that won't move. Files feedback against the negotiator naming the clause, the risk, and the recommended language.

The hat order produces the legally reviewed terms — the negotiator commits to terms, the legal reviewer checks the terms against policy and compliance and routes findings back via feedback.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `protection` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `protection` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → negotiator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `negotiator` is the implementer (re-opens the affected terms with the vendor and updates the document); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. Final signoff happens in the organization's external contracting / approval workflow (legal, finance, executive sponsor), and the engine waits for that signal before advancing.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **SLA language without measurable thresholds or real remedies** is the highest-priority finding — it becomes unenforceable in operation.
- **Exit-provision gaps** (no data export, no deletion attestation, no transition assistance, no termination-for-convenience or bounded termination-for-cause) lock the organization in.
- **Auto-renewal mechanics** without a price-cap and an actionable notice window guarantee renewal surprises.
- **Liability caps below realistic breach-cost exposure** under-allocate risk to the vendor.
- **Risk-accepted entries with no named owner and no compensating control** are silent acceptance, which doesn't survive staff turnover.
