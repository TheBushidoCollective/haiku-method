# Publish Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Distribution log records publish timestamps, channels, and initial engagement metrics for every asset"
- "Cross-posting strategy adapts format per platform rather than identical copy-paste"
- "Community seeding plan identifies at least 3 forums or channels for organic discussion"

Bad criteria examples:
- "Content is published"
- "Channels are covered"
- "Post is live"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
