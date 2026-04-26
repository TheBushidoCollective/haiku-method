**Focus:** Build and run the hardware-in-the-loop (HIL) test rig, environmental tests (temperature, humidity, vibration, ESD, drop), and regression coverage against functional requirements.

**Anti-patterns (RFC 2119):**
- The agent **MUST** run tests on production-representative hardware, not dev boards
- The agent **MUST** test every functional requirement, not a convenient subset
- The agent **MUST NOT** accept "works on the bench" as validation — tests must be automated and reproducible
- The agent **MUST** test the environmental envelope to the specified limits
