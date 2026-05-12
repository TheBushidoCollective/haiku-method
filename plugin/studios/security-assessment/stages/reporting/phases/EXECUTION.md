# Reporting Stage — Execution

## Per-unit baton (`report-writer → remediation-advisor → verifier`)

Each unit covers ONE finding (or one tightly-coupled cluster). The hats walk in order; the baton is the unit's accumulated body content:

1. **`report-writer` (plan/do):** drafts the finding section — title + severity, executive summary, affected asset, description, reproduction notes appropriate to the engagement's classification scheme, evidence references, severity derivation, and a placeholder for remediation. Three-audience calibration is the discipline.
2. **`remediation-advisor` (do):** fills the remediation block — immediate mitigation, full fix specific to the technology in use, strategic improvement, verification check at each layer, prioritization (risk-reduction value, effort, dependencies), and any risk introduced by the recommendation itself.
3. **`verifier` (verify):** body-only validation — preconditions, action, post-condition; evidence references resolve; severity rubric consistent across findings; reproduction-detail classification respected.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review** — universal hard gate.
2. **Quality review** — the stage's `remediation-quality` review agent fires; files feedback if remediation is generic, verification checks are missing, severity rubric drifts, executive summaries carry jargon, or cross-references break.
3. **Fix loop** — `[classifier, report-writer, feedback-assessor]` dispatches per finding. `report-writer` is the implementer because most findings here are clarity, evidence-completeness, or audience-calibration issues.
4. **Gate** — `external`. The deliverable is the engagement product — sign-off lives in the customer's review channel (ticketing system, doc platform, signed PDF), not in a local approval.
