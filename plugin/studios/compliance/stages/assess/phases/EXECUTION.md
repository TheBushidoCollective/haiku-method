# Assess Stage — Execution

## Per-unit baton (`auditor → risk-assessor`)

Every assess unit walks the hat chain in order. The baton across the chain is the unit's body content plus its contribution to the intent-scope `GAP-REPORT.md`:

1. **`auditor` (plan / do):** Reads the upstream `CONTROL-MAPPING.md`. For each (control, system) pair, gathers concrete evidence (config exports, code references, logs, signed attestations), determines status (`met` / `partially met` / `unmet`), and writes the per-control finding with control intent + evidence reviewed + deficiency description. Hands off when every in-scope (control, system) pair has a status + evidence trail + deficiency description (for non-met items).
2. **`risk-assessor` (do / verify):** Takes the auditor's findings, selects (or proposes for confirmation) a scoring methodology, assigns likelihood + impact + residual-risk scores per gap with rationale, credits compensating controls explicitly, surfaces dependencies between gaps, and publishes the prioritized list. Hands off when every gap has a complete risk profile and the prioritized list is published.

This stage's hat chain currently omits a dedicated verifier — `risk-assessor`'s scoring pass implicitly checks the auditor's findings by trying to translate each into a risk score. (Uncertainty flagged: pure plan → do → verify per architecture §3 would add a third hat; structural change is out of scope for this content pass.)

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → auditor → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `auditor` is the implementer (re-evaluates); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Assessment findings carry organizational and legal weight, so a human approves locally before remediation work begins.
