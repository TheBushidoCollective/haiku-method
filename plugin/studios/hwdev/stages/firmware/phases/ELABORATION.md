# Firmware Stage — Elaboration

Firmware is a **build / execution** stage. Its units are discrete pieces of embedded code that, together, deliver the firmware product. Each unit's spec includes acceptance criteria, completion criteria, and executable verification (build, test, measurement) that the workflow engine and reviewers can run against.

## What a unit IS in this stage

One discrete piece of executable firmware work. Examples:

- "Bootloader + OTA update mechanism — secure boot, dual-bank or staged-write, recovery path"
- "Power-management driver — wake / sleep transitions, peripheral clock gating, supply rail control"
- "Sensor acquisition module — ADC sequencing, calibration, filtering, error handling"
- "Communication stack: BLE / Wi-Fi / wired — pairing, packet handling, connection recovery"
- "Safety supervisor — watchdog, fault handler, hazard mitigations linked to requirement IDs"
- "Application state machine — modes, transitions, persisted state"

What a unit is **NOT** in this stage:

- ❌ A schematic or component selection (those belong in `design`)
- ❌ A manufacturing process or test fixture (those belong in `manufacturing` or `validation`)
- ❌ A regulatory test plan (those belong in `validation`)
- ❌ A multi-feature "everything that runs on the MCU" doc — split it

## What "completion criteria" means here

Firmware units are build-class, so criteria are executable: code compiles, tests pass, on-target measurements satisfy thresholds. Each criterion gets a verify command the workflow engine and reviewers can run.

### Good criteria — executable and measurable

- "All unit tests pass: `<build-system> test --target <unit>`"
- "Flash usage under 70% of available with headroom for OTA: `<toolchain> size --target <unit> | <project-script>`"
- "Worst-case interrupt latency < 50µs measured on target with deterministic stimulus: `<measurement-script>`"
- "Fault-injection test for REQ-SAFE-04 asserts fail-safe behaviour: `<test-runner> --filter safe-04`"
- "Power consumption in idle < 50µA measured on target with calibrated meter: `<measurement-script>`"

The verify commands above are illustrative — the actual command syntax and tool names belong in the project overlay. The plugin default describes the *category* of verification (build, test, resource measurement, timing measurement, power measurement) without prescribing the tool.

### Bad criteria — non-executable or wrong-stage

- ❌ "Firmware works" (no command, no threshold)
- ❌ "Code is clean" (not a build-class criterion; lint / style live in CI, not in unit criteria)
- ❌ "Hardware revision is final" — wrong stage; that belongs to `design`
- ❌ "Cert lab returns pass" — wrong stage; that belongs to `validation`

## How verification happens

Firmware units are verified by the `reviewer` hat (the verify role for this stage). The reviewer checks code-to-requirement coverage, safety-critical path testability, and resource-budget measurements — see `hats/reviewer.md`. The actual test execution happens during the unit's build / test commands, which the workflow engine and reviewers run against the unit's verify commands.

## Anti-patterns

- **Decoupled-from-hardware units.** A firmware unit that doesn't trace back to a schematic decision (peripheral, pin, supply rail) is either premature or scope creep.
- **Untestable safety mitigations.** A safety-critical path with no injectable fault is "untested" by definition. Plan the seam during code design, not after.
- **Skipping headroom.** Flash usage at 99% with no OTA headroom is a bug waiting to ship.
- **Tool prescription in unit content.** Project-specific tool commands belong in the overlay; the plugin default describes verification categories, not tool names.
