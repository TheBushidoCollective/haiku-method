---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the curriculum design traces cleanly back to the needs-analysis output. Alignment is the lens — a designed program that addresses adjacent or invented needs wastes the rest of the lifecycle on the wrong target, no matter how good the instructional choices look in isolation.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that every learning objective traces to a specific gap, performance problem, or capability target named in the needs-assessment artifact — orphan objectives that don't map to a gap must be flagged.
2. The agent **MUST** verify that every gap in the needs-assessment has at least one objective addressing it, OR an explicit "deferred — out of scope" note with rationale; silent omission is a violation.
3. The agent **MUST** verify that the chosen instructional strategy matches the cognitive level of the objective — declarative knowledge taught with practice-only formats, or procedural skills taught lecture-only, are misalignment violations.
4. The agent **MUST** verify that module sequencing honors prerequisite dependencies — an objective at Bloom's "apply" level cannot precede the "understand" level it depends on.
5. The agent **MUST** verify that the assessment plan measures what each objective actually claims — a "demonstrate the skill" objective measured by a multiple-choice quiz is a measurement-misalignment violation.
6. The agent **MUST** verify that the chosen modality (instructor-led, async, blended) fits the audience constraints documented in the needs assessment, not the design hat's preferences.
7. The agent **MUST** verify that any objective imported from a generic competency framework is rewritten to reference the audience's actual context, not left as the framework's generic language.

## Common failure modes to look for

- A glossy curriculum plan that adds objectives the needs analysis never identified, because the designer "thought it would be valuable"
- A gap from needs-analysis that disappears from the design with no rationale
- Bloom-level mismatch: objectives written at "evaluate" but instruction stays at "remember"
- Assessment instrument that grades a different skill than the objective declared
- Async-only delivery chosen for an audience the needs analysis documented as low-self-direction
- Module sequence that lets learners hit "apply" exercises before the underlying concept was introduced
