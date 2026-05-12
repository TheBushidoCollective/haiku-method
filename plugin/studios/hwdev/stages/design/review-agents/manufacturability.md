---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the design can be manufactured at the declared target volume without custom tooling, hand-assembly compensation, or exotic processes. DFM findings caught here are corrections; the same findings caught during pilot manufacturing are scrap and rework.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Fab capability fit** — The PCB stack-up, trace / space widths, drill sizes, and copper weights declared in the layout source are within the project's declared fab house's published capability sheet. A stack-up that requires an above-baseline process gets a documented cost / lead-time impact note.
- **Design-tool rules clean** — DRC is clean in the source design tool (design-level check). Gerber-level DRC against committed exports and source-vs-export regeneration parity belong to the manufacturing stage's validation; here the design owns the source-of-truth declaration.
- **Assembly process fit** — The enclosure design supports the declared assembly process: draft angles for moulding, wall thickness for the chosen material, fastener access for the chosen station layout, and tolerance stack-ups within the declared component-supplier bands.
- **Sourcing at volume** — Every BOM component is available at the target production volume from a real distributor within the project's lead-time tolerance. Parts available "in low quantity from one shop" do not pass.
- **Automated-assembly assumptions** — Any design choice that requires hand-assembly when automated assembly was assumed is a finding. Flag every such choice with the assembly step it impacts.
- **DFM-known anti-patterns** — Thieving / venting, copper balance, panel-edge keepout, fiducials present and accessible, soldermask / silkscreen choices compatible with the chosen finish.

## Common failure modes to look for

- A stack-up that prints on the fab's premium-cost process without anyone noticing the cost delta
- A connector cutout whose tolerance stack-up only works if the connector vendor's tolerance is at the favourable end
- A component selected for cost without confirming distributor stock at target volume
- An enclosure feature (clip, snap-fit, undercut) that requires either tooling complexity or hand-assembly the project wasn't budgeted for
- An automated-placement assumption broken by a part that has no machine-readable polarity feature
- A BOM with parts that share a distributor's bulk-pricing tier collapse — same line gets cheaper at higher volume, but the design didn't take credit for it
