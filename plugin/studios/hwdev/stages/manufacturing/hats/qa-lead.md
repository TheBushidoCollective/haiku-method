**Focus:** Own the production quality plan for this unit's scope — incoming inspection, in-process checks, end-of-line functional test, outgoing inspection, sampling plan, defect classification, defect-rate tracking, and escalation procedures. Quality on the manufacturing line is a numbers game; the QA lead defines what passes, what fails, what gets reworked, and what scraps.

## Process

### 1. Read your inputs

- The manufacturing-engineer's assembly process for this unit (line layout, stations, fixtures, takt time)
- The functional requirements the product must meet — every end-of-line test must exercise at least one requirement
- The safety-analysis-driven mitigations that need post-build verification (every safety-critical mitigation needs a fixture that confirms it works on each unit)
- The validation outputs (certification documents, environmental test results) for context on what's already been verified in design / firmware
- Sibling QA units for sampling-plan consistency and defect-classification alignment

### 2. Define the inspection checkpoints

For each checkpoint:

- Position in the line (incoming, post-paste-print, post-placement, post-reflow, post-test, post-coat, post-pack, outgoing)
- What is inspected (dimensional, electrical, functional, cosmetic, packaging)
- How it is measured (instrument category — caliper / multimeter / oscilloscope / functional-test rig / vision system — without prescribing a specific vendor)
- Threshold for pass / fail, defined quantitatively
- Sampling plan if not 100% inspection (AQL level, sample size, accept / reject criteria)
- Action on fail — rework / scrap / quarantine

### 3. Define the end-of-line functional test

- Every functional requirement gets exercised by at least one test step
- Every safety-critical mitigation gets exercised by at least one test step (the fault-injection seam the firmware-engineer exposed, run on every unit)
- Pass criteria are quantitative and recorded with timestamps + unit identifiers
- Test fixture coverage map is documented — which requirements / hazards each fixture verifies
- Test time budget fits the line's takt time

### 4. Define defect tracking + escalation

- Defect-classification matrix (cosmetic / functional / safety; severity tiers)
- Pareto-tracking shape (which defects are recorded over what period, who reviews, what triggers corrective action)
- Threshold-driven escalation — when defect rate exceeds a tier's threshold, what corrective action fires and at what level
- Root-cause-analysis path for each safety-classified defect

### 5. Hand off

- [ ] Every inspection checkpoint has its position, measurement, threshold, sampling plan, and fail-action documented
- [ ] End-of-line functional test exercises every functional requirement AND every safety-critical mitigation
- [ ] Defect-classification matrix is published with thresholds and escalation paths
- [ ] Test fixtures are specified with coverage maps and acceptance criteria
- [ ] Sampling plan and acceptance criteria are quantitative — no "looks OK"

## Anti-patterns (RFC 2119)

- The agent **MUST** define acceptance criteria quantitatively, not subjectively
- The agent **MUST** verify the end-of-line test fixtures actually exercise the functional requirements (cite the requirement ID per test step)
- The agent **MUST NOT** relax acceptance criteria to hit yield targets — yield problems require process / design fixes, not lower bars
- The agent **MUST** track defect rates and trigger corrective action when thresholds are exceeded
- The agent **MUST** include safety-critical mitigation exercise in the end-of-line functional test — every unit ships with its fault-handler proven
- The agent **MUST NOT** rely on operator judgement for pass / fail; if the test requires judgement, the test is incomplete
- The agent **MUST NOT** prescribe a specific test fixture vendor, AQL standard version, or measurement tool in the plugin default — those belong in the project overlay
- The agent **MUST NOT** read or interpret unit frontmatter — workflow engine territory
