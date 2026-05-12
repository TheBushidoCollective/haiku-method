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

Hardware-in-the-loop testing, environmental testing (temperature,
humidity, vibration, ESD, drop), and regulatory certification.
Validation failures mean going back to `design` or `firmware` — this is
where hardware projects find out whether their assumptions held, and the
cost of being wrong grows with every downstream stage that already
happened.

Regulatory certification is often gated by an external lab with its own
schedule. Plan for cert slots early; "we'll just submit when we're
ready" is how launches slip by months. Cert lab choice, scope of work,
and submission packaging belong in a project overlay; the plugin default
names categories of cert work, not specific labs or framework versions.

## Per-unit baton

Each validation unit walks `plan → do → verify`:

- **`test-engineer`** (plan / do for functional / environmental) builds
  and runs the HIL rig, environmental tests, and regression sweep against
  functional requirements; records evidence in the agreed shape.
- **`compliance-officer`** (do for cert) coordinates regulatory cert
  submissions, runs pre-scans before formal submission, and tracks lab
  results.
- **`validation-lead`** (do for plan + judgement) owns the overall
  validation plan, coordinates between test-engineer and
  compliance-officer, and judges release readiness based on aggregate
  results.
- **`verifier`** (verify) checks each verification-surface unit for
  scoped boundary, named method + threshold + evidence shape, and
  mechanical pass / fail — body only.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, test-engineer,
feedback-assessor]` dispatches per finding. The test-engineer is the
implementer because most validation findings are about test scope,
method, or evidence-shape gaps that need the originating role to fix.
The gate is `await` — validation completion typically blocks on an
external event (cert-lab return, environmental-chamber run finishing,
field-trial cohort reporting) rather than a synchronous review.
