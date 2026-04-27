---
interpretation: lens
---
**Focus:** Review the integrated design (schematic, PCB, mechanical, BOM) for correctness, manufacturability, and compliance with requirements. Hardware design reviews are the last cheap place to catch errors before tooling and prototypes cost real money.

**Anti-patterns (RFC 2119):**
- The agent **MUST** verify requirements traceability end-to-end, not just spot-check
- The agent **MUST** flag any BOM item without a second source or with long lead time
- The agent **MUST** verify DRC and ERC are clean in the tscircuit preview, not only in committed exports
- The agent **MUST** verify that committed manufacturing exports (Gerbers, drill, pick-and-place, BOM CSV) regenerate identically from the current tscircuit source — drift between source and exports is a hard fail
- The agent **MUST NOT** approve a design that doesn't address every safety hazard's mitigation
