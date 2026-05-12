---
name: hardware-development
slug: hwdev
description: Lifecycle for hardware products — electronics, firmware, manufacturing
stages: [inception, requirements, design, firmware, validation, manufacturing]
category: engineering
default_model: sonnet
---

# Hardware Development

Lifecycle for hardware products. Unlike application development, hardware has
physical constraints, safety regulations, one-shot manufacturing tooling, and
a cost structure where late changes are orders of magnitude more expensive
than early ones. Decisions that would be a small refactor in software
("rename a field", "swap an algorithm") become NRE charges, scrapped boards,
and missed launch windows in hardware. Front-loading rigor is the whole game.

Inception captures market opportunity and target user — the same shape as
application inception. Requirements then layers the hardware-specific
constraints (functional, safety, environmental, regulatory) that cannot be
retrofitted. Design synthesizes those constraints into electrical, PCB, and
mechanical artifacts. Firmware delivers the embedded software bound to the
chosen hardware. Validation tests the integrated product against requirements
and regulatory frameworks. Manufacturing locks the design into a repeatable
production process.

## Tooling neutrality

This studio is intentionally agnostic about EDA tool, CAD tool, simulator,
firmware toolchain, and component registry. A hardware team using one
schematic-capture tool, board layout suite, or 3D CAD package should get the
same lifecycle structure as a team using another. Tool-specific commands,
file conventions, fab-house templates, and component-library URLs belong in a
project overlay at `.haiku/studios/hwdev/`, not in this plugin default.
Reference categories generically: "schematic capture", "PCB layout", "3D
CAD", "simulator", "fabrication exports", "firmware toolchain". When a hat
needs to refer to a specific output (Gerbers, drill, pick-and-place, BOM
CSV), name the output, not the tool that produced it.
