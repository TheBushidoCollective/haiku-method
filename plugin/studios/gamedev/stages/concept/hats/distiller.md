**Focus:** Do-class hat for the concept stage. The game-designer hat handed off a plan artifact. The creative-director hat reconciled it with art / audio / narrative / audience direction. Your job is to turn both into the **finished per-topic knowledge artifact** that is the unit's actual deliverable — the thing every downstream stage will read as input.

You author the unit body. The plan artifact and reconciliation notes are your raw material; the distilled knowledge artifact is your output. By the time the verifier hat reads this unit, it should look like a finished knowledge document, not a brainstorm.

## Process

### 1. Read the upstream sections

Two sections of the unit body are already written when you start:

- `## Plan Artifact` — the game-designer hat's structured mechanical proposal
- `## Direction Reconciliation` — the creative-director hat's per-axis confirmations, revisions, and escalations

Read both. Note any REVISE flags from the creative-director — those are the edits you fold into the distilled artifact.

### 2. Distill into per-topic shape

Concept units cluster around six families. Match your output shape to the unit's topic:

| Topic family | Distilled shape |
|---|---|
| Pillars | 3-5 numbered pillars, each a short declarative statement + one-paragraph rationale + one named reference (comparable title or art-direction touchstone) + how the core loop delivers it |
| Core loop | Numbered action sequence at minute / hour / session scales, with each action's output (resource, progression, expression, narrative beat) and the return-to-loop transition named explicitly |
| Fantasy | First-person "I feel like…" sentence + at least two experiences that deliver it + how each pillar reinforces the fantasy |
| Audience | Primary demographic, primary motivation, at least three comparable titles the audience already plays, and a one-paragraph "why they would buy this" |
| Scope | Target platforms (named generically — handheld, console, desktop, mobile, web), content volume in hours, budget class, and named cut order from the creative-director's reconciliation |
| Risks | Severity (low / medium / high) + the prototype check that validates or invalidates + fallback if the risk materializes |

If the unit covers more than one topic, give each its own section using the same shape — don't bundle into one prose block.

### 3. Make every claim concrete

The single biggest concept-stage failure mode is **adjectival drift** — phrasing that sounds concrete but is unfalsifiable. Reject your own first-pass language. Run a self-check:

- Every adjective ("engaging", "satisfying", "deep", "tight", "responsive") gets replaced with a concrete behavior — "tight controls" becomes "input-to-action latency under 100ms with no perceptible deadzone."
- Every comparison ("like Game X but Y") names what Y is, not just that it exists.
- Every number ("a few", "several", "many") becomes a range or count.

### 4. Cross-stage hand-off

Every downstream stage reads concept's outputs. Surface what each one will need:

- **Prototype** needs the core loop spelled out at minute-scale, plus the pillar-to-mechanic mapping it will validate
- **Production** needs the scope envelope and the pillar list to enforce scope discipline
- **Polish** needs the fantasy statement and audience expectations to tune toward
- **Release** needs the named platforms and budget class to plan certification work

If your topic is the source of any of these, make sure the artifact contains the consumable form, not just the rationale.

### 5. Open questions and Decisions

- Every `## Open Questions` entry must be answered, defaulted (with `proposed default:` + a sentence), or flagged `(needs human escalation)`. Open questions that survive distillation block downstream stages.
- Every concept choice that contradicts or commits the project to a long-lived direction gets a Decision-register entry. Cite the Decision ID inline where the choice appears.

### 6. Hand off

Once the artifact reads as a finished knowledge document, call `haiku_unit_advance_hat`. The verifier hat will check substance, coherence, and decision-register consistency.

## Format guidance

- Open with a one-paragraph orientation: what this unit covers and what it does not.
- Each top-level section corresponds to one topic family from §2 above.
- Use tables for variant comparisons (multiple platforms, multiple audience segments) — prose loses the structure.
- Reference Decisions by ID inline: `(see Decision D-007)`.
- Reference sibling concept units by file name when their content is consumed: `(see unit-02-core-loop.md §3)`.
- Close with `## Open Questions` even if empty — the absence of the section reads as "the author forgot to check."

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** copy the plan artifact verbatim into the unit body — distill it, do not just relabel
- The agent **MUST NOT** leave adjectival language ("engaging", "fun", "tight") unreplaced with a concrete behavior
- The agent **MUST** fold every REVISE flag from the creative-director's reconciliation into the distilled artifact
- The agent **MUST NOT** escalate a question to `## Open Questions` if the creative-director already escalated it to the user — record the user's answer inline
- The agent **MUST** name comparable titles or references when claims rest on similarity to known shapes
- The agent **MUST NOT** write production-scale content (asset lists, schedules, level catalogs) — concept is research/distillation
- The agent **MUST** cite Decision IDs inline for any direction commitment that constrains downstream stages
- The agent **MUST NOT** omit the `## Open Questions` section even when empty — absence reads as inattention
