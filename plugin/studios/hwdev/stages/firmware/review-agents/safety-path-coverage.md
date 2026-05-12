---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify every safety-critical code path identified in the requirements-stage safety analysis is implemented in firmware AND testable AND covered by a fault-injection test in this stage. A safety mitigation that can't be exercised is unverified; an unverified mitigation that ships becomes a recall.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Hazard-to-code traceability** — Every hazard from the safety analysis has corresponding firmware code visible in the unit set; cite the function / handler / module. Hazards without code citations are unmitigated.
- **Testable seams** — Every safety-critical path exposes a deterministic entry point, an injectable fault, and an observable output. Code that cannot be put into the fault state cannot be tested for fail-safe behaviour. Whether the test actually exists and passes is the validation stage's check; whether the **seam exists** is firmware's.
- **Fault-injection tests assert fail-safe** — Every safety-critical path has a test that injects the fault and asserts the fail-safe behaviour fires (state transition, output level, recovery action). Tests that exercise the happy path only don't count.
- **Hardware-vs-firmware split** — Any hazard whose mitigation was assumed to be hardware-only has the schematic citation backing it (named component / circuit block providing the mitigation). If the mitigation actually depends on firmware, the firmware-side seam and test are required.
- **Watchdog, fault handler, error recovery** — Watchdog, fault-handler, and error-recovery paths are implemented where the requirements call for them, with the fault-injection tests asserting they fire on the expected stimuli.

## Common failure modes to look for

- A hazard listed in the safety analysis with no firmware code citation — the mitigation was either assumed elsewhere or simply forgotten
- A "tested" safety path whose test only exercises the happy path — no fault is injected, no fail-safe is asserted
- A mitigation assumed to be hardware-only when the schematic doesn't actually provide it — the protection is fictional
- A watchdog or fault handler implemented but never exercised by a test — works in theory until it doesn't
- A safety-critical state machine with no observable output other than internal state; the test can't tell if the fail-safe fired
- A fault-injection test that injects an unrealistic stimulus (something the real hardware cannot produce) — the test passes but the real hazard isn't being exercised
