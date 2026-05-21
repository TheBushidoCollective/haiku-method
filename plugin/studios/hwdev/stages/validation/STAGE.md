---
name: validation
description: HIL testing, environmental, and regulatory certification
hats: [test-engineer, compliance-officer, validation-lead, verifier]
fix_hats: [classifier, test-engineer, feedback-assessor]
review: await
elaboration: collaborative
inputs:
  - stage: requirements
    discovery: functional-requirements
  - stage: requirements
    discovery: safety-analysis
  - stage: design
    output: schematic
  - stage: firmware
    output: firmware-binary
---

# Validation

Find out whether the design and firmware actually meet the requirements: hardware-in-the-loop testing, environmental testing (temperature, humidity, vibration, ESD, drop), and regulatory certification. This is where the project learns whether its assumptions held — and the cost of being wrong grows with every stage that already happened.

## Scope

Verification of the built product against its requirements: functional and environmental test campaigns, regression sweeps, and regulatory cert. Validation decides *whether the product meets what requirements demanded* — not what those requirements are (requirements), and not how the product gets built at volume (manufacturing). A failure here is a revisit to design or firmware.

## What to do

- Test against the functional and safety requirements with named methods, thresholds, and evidence shapes — not ad-hoc checks.
- Build and run the HIL rig and environmental campaigns, recording evidence in the agreed shape.
- Plan cert-lab slots early; "we'll submit when we're ready" is how launches slip — run pre-scans before formal submission.
- Judge release readiness on aggregate results, with each verification surface scoped to a clean pass/fail.

## What NOT to do

- Don't edit the design or firmware in place to make a test pass — file the finding and route it back upstream.
- Don't redefine requirements to match what the hardware happens to do.
- Don't declare a regulatory framework satisfied on an informal scan in place of the lab's formal return.
- Don't sign off release readiness with a verification surface left ambiguous or unmeasured.
