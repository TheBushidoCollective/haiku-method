---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the integrated design addresses every regulatory and safety requirement that the requirements stage identified. Compliance gaps caught here are cheap; the same gap caught during cert testing means a PCB spin and a missed launch window.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Hazard coverage** — Every hazard from the requirements-stage safety analysis has a design-level mitigation visible in the artifacts (isolation gap, fuse, overcurrent / overvoltage / overtemperature protection, fail-safe state, redundancy, etc.) or an explicit pointer to the firmware feature that owns it.
- **EMC design practices** — For every emissions / immunity framework named in requirements, the layout shows the practices expected for that framework: continuous return planes, careful routing of high-speed and switching signals, decoupling proximity, shielding decisions, filter placement, and antenna treatment for radios.
- **Electrical safety** — For frameworks that govern user safety (mains-connected products, medical, industrial), the design shows the isolation gaps, working-voltage clearances, fuse and overcurrent placement, and earth / ground architecture the framework requires.
- **Materials and finishes** — Flammability rating, lead / RoHS status, REACH SVHC declarations, and any restricted-substance declarations match what the cert framework expects.
- **Framework traceability** — Every regulatory framework named in requirements has a corresponding set of design citations in this stage's artifacts. A framework with zero citations is a guaranteed cert finding later.

## Common failure modes to look for

- A safety hazard with no design citation — the mitigation was assumed to be firmware-only without confirming firmware actually has the seam
- A regulatory framework named in requirements that isn't referenced anywhere in the design artifacts
- High-speed signals routed across a plane split — guaranteed radiated-emissions failure
- Isolation gaps that meet the schematic intent but are shrunk by the layout to fit a connector — measure the actual layout
- A "we'll add a shield in mechanical" handoff with no shield in the mechanical CAD
- Restricted-substance status on the BOM that contradicts the declared regulatory framework
