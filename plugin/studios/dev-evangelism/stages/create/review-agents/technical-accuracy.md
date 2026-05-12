---
interpretation: lens
---
**Mandate:** The agent **MUST** verify every technical claim in the created content is accurate, every demo is reproducible, and every code sample runs. Files feedback on any violation; does NOT fix the asset or rebuild the demo.

## Check

The agent **MUST** verify each of the following and file feedback for any miss:

- **Code runnability** — every code sample in the asset compiles and runs against the runtime version the demo-builder pinned; copy-paste-and-run is the contract
- **Demo reproducibility** — every demo can be run end-to-end from a clean environment within the documented time budget; setup steps are complete, dependencies pinned, no `latest` versions, no hardcoded secrets
- **API / version / config currency** — API references, version numbers, configuration keys, and CLI invocations match the runtime the demo-builder targeted; out-of-date references are findings
- **Claim-to-proof alignment** — every flagged claim from the narrative brief has a matching demo or code sample that actually demonstrates the claim; demos that demonstrate something different from what the asset claims are the highest-priority finding
- **Benchmark methodology disclosed** — any performance claim cites the benchmark's environment specs, methodology, and raw output; "faster" without numbers and methodology is unsupported
- **Error handling visible** — demos that will be presented live or run by readers handle the obvious failure modes (network, missing creds, wrong runtime version) with clear messages, not stack traces
- **Cross-reference precision** — references from the asset to the demo name a specific entry point (repo URL + branch / tag, sandbox URL, deck slide number, script timestamp), not a vague "see the demo"

## Common failure modes to look for

- Code blocks that look right but reference symbols, methods, or APIs that don't exist in the named version
- Demos pinned to `latest` (or unpinned) that will rot the moment a dependency updates
- Hardcoded API keys, tokens, or environment-specific paths in the demo repo
- A README that says "run `npm start`" but the demo also needs `npm install` and a database running
- Benchmarks cited without environment specs (hardware, runtime version, dataset size)
- An asset that says the demo shows X when the demo actually shows X' (a divergence that an attentive reader will catch and lose trust over)
- Performance claims as adjectives ("blazing fast", "highly performant") rather than measurements
