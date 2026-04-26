# Game Concept Stage — Elaboration

Game concept is a **research / distillation** stage. Its units are knowledge topics that define what the game IS — design pillars, core loop, fantasy, target audience, scope envelope. Concept absorbs traditional discovery in gamedev because game concepts are inseparable from market fit and creative vision.

## What a unit IS in this stage

One investigable knowledge topic. Examples:
- "Design pillars (3-5 core promises the game makes to the player)"
- "Core loop — minute-to-minute player actions and what each produces"
- "Fantasy — first-person sentence ('I feel like…') and the experiences delivering it"
- "Target audience — primary demographic, motivation, comparable titles they play"
- "Scope envelope — content volume, target platforms, budget range"
- "Comparable titles analysis — gameplay style, monetization, retention pattern"
- "Risk inventory — creative, technical, and market risks with severity"

What a unit is **NOT** in this stage:
- ❌ A prototype build plan (those belong in `prototype`)
- ❌ Asset pipelines or production schedules (those belong in `production`)
- ❌ Platform certification checklists (those belong in `release`)

## What "completion criteria" means here

Knowledge-artifact criteria are about **substance and internal coherence**, plus — for game concept — explicit creative-decision documentation.

### Good criteria — substantive and checkable

- "Design pillars §2 lists 3-5 short declarative statements with a one-paragraph rationale per pillar"
- "Core loop §3 names every player-facing action with what it produces (resource, progression, expression) and how it returns the player to the loop entry"
- "Fantasy §4 has a first-person 'I feel like X' sentence + ≥2 experiences that deliver it"
- "Audience §5 names a primary demographic, primary motivation, and ≥3 comparable titles the audience already plays"
- "Scope §6 names target platforms (e.g., Steam + Switch), content volume in hours, and a budget range — no adjectival placeholders ('large', 'reasonable')"
- "Open questions section: each entry has a proposed default for veto-style approval OR `(needs human escalation)`"

### Bad criteria — vague or wrong-stage language

- ❌ "Game is fun" (no check; "fun" is the *outcome* you're trying to design toward, not a verifiable criterion)
- ❌ "Pillars cover everything" (no count, no shape)
- ❌ "Each unit has 3-5 verify-commands" (build-stage language)
- ❌ "Prototype passes the smoke test" (wrong stage; no prototype exists yet)

## Anti-patterns

- **Drafting prototype scope in concept.** Concept defines what the game IS; prototype tests whether the core loop is fun. Don't bake prototype scope into concept units.
- **Pillar-loop drift.** Pillars and core loop must reflect each other — a "permadeath consequence" pillar with unlimited respawns in the loop is a contradiction. Verify alignment within concept.
- **Single-document syndrome.** One giant "design doc" defeats per-topic units. Pillars, loop, fantasy, audience, scope — each is its own unit even if they cross-reference.

> Note on the universal FSM_CONTRACTS_ELABORATE_BLOCK: the orchestrator currently injects build-class rules (`depends_on:` cycles, executable `quality_gates:`, criteria-with-verify-commands) into every elaborate dispatch. Those rules are correct for build-class stages but do not apply to this stage's knowledge-artifact units. Treat the build-class rules as defaults the framework hasn't yet split — author your units to the substance/accountability shape above, not to executable verify-commands. (Architecture §7 known issue tracking the split.)
