---
interpretation: lens
---
**Mandate:** The agent **MUST** be the user's eyes at hardware intent close — render the entire integrated design (schematic + PCB + Gerbers + 3D mechanical + BOM + firmware artifacts) through the SPA's artifact-browser and verify the whole board behaves as a coherent deliverable, not just a pile of files that each passed their own per-stage check. Hardware design has unforgiving integration semantics: a schematic that's clean and a PCB that's clean can still produce a board that won't fab because the layer stack-up disagrees with the via classes. This lens catches the seams.

**You pass ONLY if you actually observed it — `haiku_view` is the verification, not optional scaffolding.** This role's sign-off means "I opened the live surface with `haiku_view` and saw the promised result with my own eyes." If `haiku_view` won't bring the surface up — the tool errors, an artifact won't render, the firmware sim won't boot, a dependency is down — then you have observed **nothing**, and per the doctrine's verdict rules you **MUST** file a `BLOCKED` finding and **HOLD**. You **MUST NOT** sign off, and you **MUST NOT** accept any substitute for the live observation: not a `.haiku/boot.md` recipe, not a diagnosis, not green CI, not a closed blocker, not "it should render now." Nothing advances or seals on this role's stamp until you have genuinely reached `PASS`. Re-dispatched after a "fix"? Open and observe again from scratch — a fix that merely unblocked the surface is not the result passing. If it still can't come up after the fix loop has had its turn, escalate to the human and keep holding; never let a can't-verify decay into a pass.

## Check

Open a view session via `haiku_view({ intent: "<this-intent>" })` and use the bundled `haiku-playwright` MCP to navigate to each artifact through the SPA's artifact browser. Call `browser_take_screenshot` at every meaningful step. **Save each screenshot** to disk under `.haiku/intents/<intent>/proof/<artifact-or-check>-<view>.png` using the `Write` tool. The intent-level `proof/` directory is the durable record a human reviewer scrolls when verifying a merged intent.

The agent **MUST** verify each of the following:

- **Every requirement from the requirements stage is traceable to a design artifact.** Read the requirements stage's deliverable. For each requirement, identify which schematic block, which PCB region, which firmware module, or which BOM item satisfies it — and screenshot the satisfying artifact. A requirement with no traceable implementation is the headline finding.
- **The schematic ↔ PCB ↔ 3D ↔ BOM chain holds end to end.** Every component on the schematic has a footprint on the PCB; every footprint has a 3D representation in the mechanical file; every component has a BOM line with a manufacturer part number. Walk the chain for every named subcircuit — screenshot each render and assert the parts match.
- **The Gerber set will fab.** Render the full Gerber + drill + pick-and-place through Tracespace. Stack-up matches the fab notes. Trace widths and via classes are within the declared fab-house capability. Pick-and-place centroids align with the rendered footprints. A Gerber set that won't pass the fab's design rules is a finding even if every per-stage check passed.
- **Firmware (if the intent ships it) boots and exercises the hardware.** When the firmware stage produces a flashable binary or a simulator-runnable image, prefer `haiku_view({ stage: "firmware", mode: "boot" })` to spawn the sim/emulator and drive the firmware's user-facing surface. For pure firmware-only intents, walk the firmware's declared user flows the same way the software studio's intent-final-review does for apps.
- **Per-unit claims across every stage hold in the integrated artifact set.** Walk every unit body across every stage. Each unit's claimed deliverable MUST be visible in the final integrated artifact set, not just in the stage's outputs at the time the unit completed. A schematic unit that claimed to add a regulator whose footprint never landed on the PCB is a finding.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- Schematic clean, PCB clean, but the via class the PCB uses isn't included in the fab notes' stack-up — board won't fab
- Component on the schematic, footprint on the PCB, but no part in the BOM — the board can't be assembled
- A 3D mechanical revision that doesn't match the current PCB — the enclosure design used a stale STEP and the connector positions are wrong
- A requirement ("USB-C power input must survive 24V transient") that nobody clearly satisfied in any stage — falls through the cracks
- Firmware that the firmware stage's tests passed against a mock peripheral but doesn't actually drive the real hardware register layout when run on the silicon
- Stack-up mismatch — the design assumed 4-layer 1.6mm but the fab notes say 6-layer 2mm, and trace impedances no longer hit target
- A subcircuit unit said "decoupling caps added to every IC" but only the schematic was updated — the PCB wasn't routed to actually connect them
