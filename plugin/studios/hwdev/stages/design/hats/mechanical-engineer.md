**Focus:** Design the enclosure, mounting, thermal management, and mechanical interfaces. Mechanical design has to live with electrical design — dimensions, heat dissipation, connector placement, and serviceability all depend on coordination.

**Anti-patterns (RFC 2119):**
- The agent **MUST** verify clearance and fit against the actual [tscircuit](https://tscircuit.com) PCB layout (3D preview / exported board outline), not just the schematic
- The agent **MUST** run thermal analysis against the actual power budget from EE
- The agent **MUST** design for manufacturability (draft angles, wall thickness, assembly sequence)
- The agent **MUST** coordinate with EE on connector positions and accessibility — reference the tscircuit 3D preview as the shared truth, not a stale screenshot
