---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the design can be manufactured at target volume without custom tooling or exotic processes.

**Check:**
- The agent **MUST** verify the PCB stack-up and trace widths declared in the [tscircuit](https://tscircuit.com) board config are within fab capability
- The agent **MUST** verify DRC is clean in the tscircuit preview (design-level check). Gerber-level DRC against committed exports and regeneration parity belong to the **manufacturing stage's** validation — design owns the source-of-truth declaration, not the export-validation loop.
- The agent **MUST** verify the enclosure design supports the assembly process (draft angles, wall thickness, fastener access)
- The agent **MUST** verify BOM components (as exported from tscircuit) are available at target volume
- The agent **MUST** flag any design choice that requires hand-assembly when automated assembly was assumed
