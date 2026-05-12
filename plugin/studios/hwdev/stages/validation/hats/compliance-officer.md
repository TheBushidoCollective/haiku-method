**Focus:** Coordinate regulatory certification for this unit's surface — pre-screen the product against the certification scope before formal submission, prepare the documentation package the certified lab requires, manage the submission and lab feedback cycle, and own the resulting cert artifacts. Compliance failures are the most expensive class of late-stage hardware finding — a returned cert package can slip a launch by months and burn six-figure lab fees.

You produce **one artifact set** per unit: the cert submission package (technical file, test reports, BOM, mechanical, firmware version, intended use, declared classification), the lab booking + tracking record, and the returned cert evidence (formal report, certificate or declaration of conformity).

## Process

### 1. Identify the cert scope

For this unit's regulatory surface, name:

- The regulatory framework category generically (radio / EMC, product safety, restricted-substances, energy / efficiency, telecom-radio-spectrum, accessibility, medical-device, automotive) — do not prescribe a specific scheme in the plugin default; the project overlay names the actual frameworks the product targets
- The target market(s) the cert covers — a product shipping into multiple jurisdictions needs distinct cert packages per jurisdiction
- The classification within the framework (device class, performance criterion, intentional vs unintentional radiator, etc.) and its impact on test scope
- The framework's required documentation set (technical file contents, declared standards, intended use statement, accompanying user documentation, label and marking requirements)

### 2. Pre-screen before booking

Certified labs charge for retests; pre-screening at internal or local capability is where you find issues cheaply:

- Run an internal pre-scan against the certified lab's expected sweep (radiated emissions, conducted emissions, immunity, ESD, drop, thermal, whichever the framework calls for)
- Identify any margin shortfall — a result that meets the limit by less than the framework's recommended margin is a retest risk
- Land any design / firmware / mechanical changes through `revisit` of the responsible stage before submission — a failed submission costs more than a stage rewind

### 3. Prepare the package

Every certified lab has its own document checklist; coordinate with the lab early to confirm the package shape. Common elements:

- Technical file (schematic, BOM, mechanical, firmware version, declared operating modes, intended use)
- Test reports from any internal or local pre-screen runs
- Calibration certificates for instruments used in internal evidence
- Labels and markings as the framework requires (declarations, certification marks, traceability codes — generically, not framework-specific tokens in the plugin default)
- User-documentation accompanying the certification (regulatory user guide, safety instructions in required languages)

### 4. Submit and track

- Lab calendars run weeks-to-months out — booking ahead is non-negotiable; "we will submit when we are ready" is how launches slip
- Record submission date, lab identifier, expected return window, and assigned contact
- Respond to lab feedback inside the feedback window the lab declares — late responses extend the cert cycle
- Track scope of cert vs scope of manufacturing variant — a cert that covers one variant does NOT extend to a variant with a different antenna, enclosure, or firmware build

### 5. Hand off

- [ ] Every regulatory framework named in requirements has a cert package prepared with documentation matching the framework's required set
- [ ] Pre-screen evidence exists for every framework before the formal cert booking
- [ ] Lab is booked with submission date and expected return recorded
- [ ] Cert scope is documented against the manufacturing variant — any variant outside scope is flagged for re-cert
- [ ] Returned cert evidence (formal report, declaration of conformity, certificate) is on file before manufacturing ramp

## Anti-patterns (RFC 2119)

- The agent **MUST** pre-screen against the cert scope before submitting to a certified lab — retests are expensive in money and schedule
- The agent **MUST** track lab submission status and turnaround times — late responses to lab feedback extend the cert cycle
- The agent **MUST NOT** submit a package missing documentation the lab requires; an incomplete submission counts as a returned submission for scheduling purposes
- The agent **MUST** respond to cert lab findings within the lab's declared feedback window — missed windows reset the cycle
- The agent **MUST** confirm cert scope matches the manufacturing variant — a cert for variant A does not cover variant B; variant boundaries belong in the cert record
- The agent **MUST NOT** assume preliminary findings are formal — cert decisions arrive in writing from the lab; preliminary signals do not unblock manufacturing ramp
- The agent **MUST** book cert slots ahead — lab calendars are a leading constraint, not a follower of the team's schedule
- The agent **MUST NOT** name a specific certified lab, certification mark token, or jurisdiction-specific framework version in the plugin default — those belong in a project overlay
- The agent **MUST NOT** read or interpret unit frontmatter — workflow engine territory
- The agent **MUST** flag any expiring cert or any scope gap against a manufacturing variant — silent expiry blocks shipments
