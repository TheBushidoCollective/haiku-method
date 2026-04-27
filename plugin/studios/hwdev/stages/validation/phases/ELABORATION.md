# Validation Stage — Elaboration

Validation is a **validation / certification** stage. Its units are verification surfaces — one per testable boundary or compliance area. Each unit specifies the surface, method, threshold, evidence shape, and pass/fail criteria.

## What a unit IS in this stage

One verification surface. Examples:

- "Functional verification — every `requirements/functional/REQ-FN-NN` has a HIL or bench test that exercises it and records a pass/fail"
- "Environmental: thermal — operating temperature sweep with chamber log, pass criteria mapped to spec"
- "Environmental: ESD — IEC 61000-4-2 contact / air discharge sweep, pass at declared performance criterion"
- "Environmental: drop / vibration — per declared use case (consumer, industrial, automotive)"
- "EMC pre-cert — radiated/conducted emissions and immunity, pre-scan at internal lab before booking the certified lab"
- "Regulatory: FCC Part 15 / CE-RED / ISED RSS — submission package, lab-booking calendar"
- "Reliability: MTBF / HALT — accelerated-life test plan with statistical pass criteria"

What a unit is **NOT** in this stage:

- ❌ A design change (those belong back in `design`; raise feedback)
- ❌ A firmware bug fix (those belong back in `firmware`)
- ❌ A manufacturing process tweak (those belong in `manufacturing`)

## What "completion criteria" means here

Verification-surface criteria specify **method, instrument, threshold, evidence shape, and pass/fail criteria** — pass/fail must be decidable without judgment calls.

### Good criteria — mechanical and audit-ready

- "Method: oscilloscope at TP3, cold-start from 24h soak at -40°C. Threshold: power-on within 500ms ±50ms. Evidence: scope screenshot + CSV. Pass: ≥ 19/20 units within threshold"
- "Method: IEC 61000-4-2, contact discharge ±8kV / air ±15kV at 50 named coupling points. Threshold: performance criterion B (self-recoverable). Evidence: lab report PDF, signed by test engineer. Pass: criterion B met at all coupling points"
- "Method: FCC Part 15 Subpart B radiated emissions, 30 MHz to 1 GHz. Threshold: Class B limits with 6 dB margin. Evidence: certified-lab report. Pass: all emissions ≥ 6 dB below limit"

### Bad criteria — vague or judgmental

- ❌ "Performs adequately" (not decidable)
- ❌ "Passes EMC" (which standard? which limits? which evidence?)
- ❌ "Looks good in the chamber" (no instrument, no threshold)

## How verification happens

Validation artifacts are themselves verified by the verifier hat (`hats/verifier.md`). Note the meta-level: the unit body IS a verification plan; the verifier-hat checks that the plan is **scoped, methodical, and decidable** — body-content checks only, no frontmatter interpretation. The actual certification work is performed by the test-engineer / compliance-officer / validation-lead hats; the verifier-hat checks that their deliverable is sufficient for downstream release / cert sign-off.

## Anti-patterns

- **Plans without thresholds.** "Run drop test and observe" is not a verification surface; "drop from 1.2m onto concrete on each face, ≤ 1 cosmetic defect, no functional failure across 10 units" is.
- **Lumping multiple surfaces into one unit.** Functional + environmental + EMC + regulatory in a single "validation" unit defeats per-surface revisit / sign-off. One surface per unit.
- **Skipping evidence shape.** "Tested OK" is not evidence; "scope trace + signed test record at `validation/runs/run-NN/`" is.
- **Booking certified labs late.** Cert lab calendars run weeks-to-months out; the unit for "FCC submission" should include a `book-lab-by:` decision-class consideration even though the cert action itself is late.
