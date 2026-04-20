# Narrative Stage — Elaboration

## Criteria Guidance

Good criteria examples:
- "Story arc has a clear problem-solution-outcome structure with a developer-relatable hook"
- "Key messages are distilled to 3 or fewer takeaways that the audience can act on immediately"
- "Narrative brief maps each message to a specific audience segment and content format"

Bad criteria examples:
- "Story is compelling"
- "Messages are clear"
- "Narrative works"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
