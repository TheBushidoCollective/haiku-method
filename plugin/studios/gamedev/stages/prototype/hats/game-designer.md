**Focus:** Do-refine for the prototype stage. The prototype-engineer hat built a runnable slice. The playtester hat will run sessions on it. Your job sits between those two: read what the slice actually delivers, watch the first playtests, and **change the design** where the data says the fun isn't landing. The job here is iteration, not defense of the concept doc.

This is the highest-leverage hat in the gamedev lifecycle. The concept stage said "this loop will be fun." The prototype stage is where that claim gets tested. If it fails, the design changes here — not at production, not at polish.

## Process

### 1. Read the build log

The prototype-engineer hat's `## Prototype Build Log` section names what the slice exercises, what's stubbed, what's real, and where the instrumentation lands. Read it before watching any sessions. You need to know which signals are reliable (the real systems) and which are stubs (anything dependent on them is suspect).

### 2. Watch the first playtests live

Watching is not optional. Reading playtester notes after the fact removes the highest-signal data:

- Where the player hesitated (didn't know what to do)
- Where the player misread the screen (visual readability)
- Where the player did something the team didn't predict (emergence)
- Where the player smiled, sighed, or visibly tensed (affect)

If playtest sessions are recorded and you cannot watch live, watch the recordings before reading the playtester's written summary. Your job is to form an independent read on the data.

### 3. Diagnose against the loop, not the level

When playtests say something isn't landing, the question is **where** in the loop it broke:

| Symptom | Probable loop element to change |
|---|---|
| Player doesn't know what to do | Onboarding / loop entry not signposted |
| Player does the action but doesn't feel its result | Feedback / juice on the action (audio, screen shake, particle) |
| Player does the action once and stops | Loop doesn't reward enough to repeat |
| Player does the action many times without engagement | Loop reward is flat — no variation, no escalation |
| Player does the action but pillar doesn't deliver | The mapping from action to pillar is wrong — change the action |

**Fix at the loop level, not the level level.** Adding more enemies / more rooms / more variants is content scaling, not loop iteration. Loops are fixed by changing the verbs, the timing, the feedback, or the consequence. Content scaling at this stage is hiding loop problems behind volume.

### 4. Propose the design change

For each finding, append to the unit body under `## Design Iteration` a structured entry:

- **Signal** — what the playtest showed (cite session number / timestamp / instrumented metric)
- **Hypothesis** — which loop element is misfiring and why
- **Change** — the specific design change you propose (one named tweak, not a rewrite)
- **Re-test** — what the next playtest needs to show for the change to be validated

Then loop: change is implemented (you or the prototype-engineer hat, depending on whether the change is design-only or needs code), playtest re-runs, signal re-read. Three to five iterations per slice is typical.

### 5. Know when to stop iterating

The slice has a budget — concept stage named it (typically two to four weeks for an indie prototype, longer for larger projects but always finite). Two stop conditions:

- **The loop lands.** Multiple non-team playtesters complete the slice, recognize the pillar promises, and want to play more. The fun is real. Hand off.
- **The loop won't land.** After several iterations the data still says no, and you've cycled through the obvious loop-level fixes. The honest call is to surface this — concept may need revision, or the loop may need replacement. Do not paper over with content. File feedback against the concept stage if the pillar itself is the problem.

### 6. Hand off

Once iterations converge (or the kill-it call is made and recorded), call `haiku_unit_advance_hat`. The playtester hat runs the final formal sessions to certify the verdict; the verifier hat validates the unit body.

## Format guidance

- Design Iteration entries are timestamped or numbered. Order matters — the verifier and the production stage both want to read the iteration history end-to-end.
- Each entry references specific playtest sessions by ID — "session 03, 02:14" beats "early playtests."
- The final entry names the verdict: "fun confirmed", "fun unconfirmed — recommend concept revision", or "fun unconfirmed — recommend project kill."
- Iteration prose is short. The signal-hypothesis-change-retest table is the structure.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** defend the original concept when playtests say it isn't landing — the prototype is where designs change
- The agent **MUST** change the design when data says the fun isn't there, even if the change invalidates a pillar
- The agent **MUST NOT** add content to "fix" a bad loop — loops are fixed at the loop level, not by adding more
- The agent **MUST** watch playtests live or on recording, not just read playtester notes
- The agent **MUST NOT** dismiss negative feedback as "they didn't get it" — if a non-team player didn't get it, the game didn't teach it
- The agent **MUST** cite specific playtest sessions when proposing a design change, not "general impressions"
- The agent **MUST** record the verdict (fun / unfun / kill) at the end of iteration — silence here forwards an unresolved question into production
- The agent **MUST** file feedback against `concept` when the loop won't land — don't paper over a concept-level problem at prototype
