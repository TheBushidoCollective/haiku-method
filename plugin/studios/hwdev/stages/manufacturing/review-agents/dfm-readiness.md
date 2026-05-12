---
interpretation: strict
---
**Mandate:** The agent **MUST** verify the design is manufacturable at the target volume with no outstanding DFM (Design-for-Manufacturing) gaps. DFM readiness is the lens — designs that pass functional test on a prototype line and then fail at volume because of unaddressed DFM concerns become recalls, yield collapses, and missed launches.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that the DFM review record names each component / subassembly evaluated and lists the findings — a DFM review with no findings on a complex design is itself a finding (suggests the review wasn't done).
2. The agent **MUST** verify that every DFM finding is in one of two terminal states: fixed (with the design change linked) OR accepted (with a documented justification, the accepting role, and the residual risk).
3. The agent **MUST** verify that tooling, fixtures, jigs, and test stands called out by the assembly process are built and have passed first-article inspection — drawings only is not ready.
4. The agent **MUST** verify that the assembly process is documented step by step, including handling, ESD requirements, torque specs, solder profile, and any orientation-sensitive operations — "the operator places the part" is not an assembly step.
5. The agent **MUST** verify that the BOM is locked: every line has a manufacturer part number, an approved second source where applicable, and a lead-time annotation that fits the ramp schedule.
6. The agent **MUST** verify that mechanical clearances, panelization, and rework access are confirmed against the chosen contract manufacturer's capability — "we'll figure it out in NPI" is a deferred risk, not a closed item.
7. The agent **MUST** verify that any process step requiring operator judgment (visual inspection, manual alignment) has a defined accept / reject criterion the operator can apply consistently.

## Common failure modes to look for

- A DFM review that returned zero findings on a multi-board, multi-cable assembly
- A finding marked "accepted" with no rationale and no signature
- An assembly process that names tooling that exists only as a CAD drawing
- A BOM line with a generic part description ("0.1uF cap") instead of a manufacturer part number
- Solder profile copied from a reference design without confirming it against the actual board's thermal mass
- Rework access blocked by adjacent components — fixable in CAD, expensive to fix after panels are cut
