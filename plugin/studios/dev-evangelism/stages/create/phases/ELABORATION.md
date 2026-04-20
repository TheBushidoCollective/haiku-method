# Create Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Blog post includes working code examples that the reader can copy-paste and run"
- "Talk slides follow a narrative arc with no slide exceeding 3 bullet points"
- "Demo runs end-to-end without manual setup steps beyond what the README documents"

Bad criteria examples:
- "Content is created"
- "Demo works"
- "Slides look good"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
