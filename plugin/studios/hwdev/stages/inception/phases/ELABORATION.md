# Hardware Inception Stage — Elaboration

Hardware inception is a **research / distillation** stage. Its units are knowledge topics covering market opportunity, business case, and target-user understanding for a hardware product. Hardware-specific constraints (safety, regulatory, manufacturing feasibility) belong in the **requirements** stage, not here.

## What a unit IS in this stage

One investigable knowledge topic. Examples:
- "Target market segmentation and primary user persona"
- "Competitive product landscape with price, primary features, and gaps"
- "Business case: addressable market, unit economics, payback period"
- "Distribution channels and channel economics"
- "Brand positioning and differentiation thesis"
- "Hardware-product-specific risks (e.g., supply-chain dependencies, component lead times) at a strategic level"

What a unit is **NOT** in this stage:
- ❌ Functional or safety requirements (those belong in `requirements`)
- ❌ Mechanical/electrical/PCB design (those belong in `design`)
- ❌ Manufacturing process specs (those belong in `manufacturing`)
- ❌ A bill of materials or component selection (those follow from design)

## What "completion criteria" means here

Knowledge-artifact criteria are about **substance and accountability**, not testable outcomes. Hardware inception is upstream of any physical artifact.

### Good criteria — substantive and checkable

- "Market segmentation §2 names ≥3 distinct segments with size estimates and a one-paragraph differentiation per segment"
- "Competitive landscape §3 names ≥4 alternatives the user could buy instead, each with current MSRP, primary feature, and the gap this product addresses"
- "Business case §5 cites concrete numbers (volume, ASP, BOM target, channel margin, payback) — no placeholder ranges like 'TBD' or 'reasonable margin'"
- "Open questions section has ≥0 entries; each open question has a proposed default for veto-style approval OR `(needs human escalation)`"

### Bad criteria — vague or wrong-stage language

- ❌ "Market is understood" (no concrete check)
- ❌ "Each unit has a verifiable command" (build-stage language; hardware inception is non-executable)
- ❌ "FCC compliance is verified" (wrong stage — `requirements` owns regulatory framework choice; certification happens in `validation`)
- ❌ "Schematic is finalized" (wrong stage — `design` owns electrical/mechanical artifacts)

## Anti-patterns

- **Bleeding into requirements / design.** Hardware inception is "should we build this and for whom"; not "what does it do" (requirements) or "how is it built" (design).
- **Single-document syndrome.** One giant business-case doc defeats the per-unit model. One topic per unit.
- **Skipping citation.** Hardware decisions cost money to undo; sources for market and competitive claims are mandatory.

> Note on the universal FSM_CONTRACTS_ELABORATE_BLOCK: the orchestrator currently injects build-class rules (`depends_on:` cycles, executable `quality_gates:`, criteria-with-verify-commands) into every elaborate dispatch. Those rules are correct for build-class stages but do not apply to this stage's knowledge-artifact units. Treat the build-class rules as defaults the framework hasn't yet split — author your units to the substance/accountability shape above, not to executable verify-commands. (Architecture §7 known issue tracking the split.)
