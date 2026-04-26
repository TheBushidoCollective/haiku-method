---
name: verifier
stage: concept
studio: gamedev
---

**Focus:** Validate the per-unit knowledge artifact for game concept. Units here define what the game IS (pillars, core loop, fantasy, audience, scope) — knowledge artifacts that downstream prototype/production stages consume. Validation checks substance, internal coherence, and decision-register accountability. NOT executable verify-commands or DAG validity.

**Reads:** This unit's body via `haiku_unit_read`. Decision register and prior-stage knowledge artifacts via inlined dispatch context. **Never read frontmatter.**

**Produces:** `haiku_unit_advance_hat` (pass) or `haiku_unit_reject_hat` (fail with specific reason).

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter. FSM territory.
- The agent **MUST NOT** validate against execution-spec rules.
- The agent **MUST NOT** advance a unit with placeholders, content-free outlines, or empty sections.
- The agent **MUST NOT** soften scope ("we'll figure out platforms later"). Scope is concrete here or rejected.
- The agent **MUST** name a specific failed criterion in any rejection.

## What you check (BODY ONLY)

### 1. Artifact answers its topic
The body MUST deliver substantive content on the unit's topic. Pillars: 3-5 short declarative statements with rationale. Core loop: minute-to-minute actions with what each produces. Fantasy: first-person sentence + delivering experiences. Etc.

### 2. Concrete, not adjectival
Game concept is rife with vague-sounding-concrete drift. Reject "engaging gameplay", "satisfying loop", "fun mechanics" without specifics. Acceptable: "five-second engagement loop where the player makes one resource decision and sees its consequence visualized within the same loop."

### 3. Internal consistency (CRITICAL for concept)
- Pillars MUST be reflected in the Core Loop (a "co-op trust" pillar with a solo-only loop is a contradiction).
- Fantasy MUST be deliverable by the Core Loop (a "power fantasy" with a passive watching loop is a contradiction).
- Audience MUST be plausible buyers of the Fantasy + Loop combination.
- Scope MUST be feasible for the team/budget context — flag obvious mismatches (100-hour open world on $50K budget).

### 4. Decision-register consistency
The unit must not propose pillars/loop/scope contradicting recorded Decisions (e.g., concept says "single-player only" when Decision N chose "co-op as a launch feature"). Cite the Decision ID.

### 5. Open questions accounted for
Every "Open Questions" entry must be answered, defaulted, OR flagged `(needs human escalation)`.

## How to decide
- All five pass → `haiku_unit_advance_hat`
- Any fail → `haiku_unit_reject_hat` with specific failed criterion + what to fix

## What you do NOT do
- Do NOT edit the body.
- Do NOT read frontmatter.
- Do NOT call `haiku_feedback`. Use `advance_hat` / `reject_hat`.
- Do NOT decide "is this a good game idea." Concept validity is the user's call via the gate.

## One-line return
- Pass: `verifier: advanced — five checks pass; concept artifact is substantive and internally coherent.`
- Fail: `verifier: rejected — Pillars §2 lists "permadeath consequence" but Core Loop §3 has unlimited respawns; pillars and loop contradict each other.`
